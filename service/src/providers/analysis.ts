import { analysisRules } from './analysis-prompt';
import {
  validateAnalysisV3,
  resolveSources,
  quoteSentenceCount,
} from './analysis-validation';
import { parseAnalysisOutput } from './analysis-output';
import { analysisSchema, type Segment } from '@youtube-note/shared';
export async function analyzeSegments(
  segments: Segment[],
  generate: (prompt: string) => Promise<string>,
) {
  const rows = segments.map((s, i) => ({
    id: String(i + 1),
    text: s.original,
  }));
  if (!rows.length) throw new Error('没有可分析的逐字稿');
  if (JSON.stringify(rows).length > 30000)
    throw new Error('单批分析内容超出范围，请重新加载新版插件');
  const prompt = `${analysisRules}\n逐字稿：${JSON.stringify(rows)}`;
  const text = await generate(prompt);
  let input: unknown;
  try {
    input = JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, ''),
    );
  } catch {
    throw new Error('AI 梳理未返回有效 JSON，已有内容未覆盖，请重新整理。');
  }
  return resolveAnalysis(input, segments);
}
export function resolveAnalysis(input: unknown, segments: Segment[]) {
  const parsed = parseAnalysisOutput(input);
  const byId = new Map(
    segments.map((segment, index) => [String(index + 1), segment]),
  );
  const topics = parsed.topics.flatMap((topic) => {
    const start = byId.get(topic.startId),
      end = byId.get(topic.endId);
    if (
      !start ||
      !end ||
      Number(topic.startId) > Number(topic.endId) ||
      end.endMs <= start.startMs
    )
      return [];
    return [
      {
        title: topic.title,
        startMs: start.startMs,
        endMs: end.endMs,
        introduction: topic.introduction,
        ...(parsed.formatVersion === 3
          ? {
              startSegmentId: start.id,
              endSegmentId: end.id,
              keyPoints: topic.keyPoints,
            }
          : {}),
        problem: topic.problem,
        application: topic.application,
        clipReason: topic.clipReason,
        clipVerdict: topic.clipVerdict,
        applicationOrigin: topic.applicationOrigin,
      },
    ];
  });
  if (!topics.length)
    throw new Error('模型没有返回可定位的视频主题，请重试整理');
  const quotes = parsed.quotes.flatMap((quote) => {
    const start = segments.findIndex((s) => s === byId.get(quote.segmentId));
    const end = segments.findIndex(
      (s) => s === byId.get(quote.endSegmentId ?? quote.segmentId),
    );
    if (start < 0 || end < start) return [];
    const original = segments
      .slice(start, end + 1)
      .map((s) => s.original)
      .join(' ');
    if (quote.excerpt && !original.includes(quote.excerpt)) return [];
    const excerpt = quote.excerpt ?? original;
    if (
      parsed.formatVersion === 3 &&
      (!quote.excerpt ||
        quoteSentenceCount(excerpt) > 2 ||
        quoteSentenceCount(quote.chinese) > 2)
    )
      return [];
    const offset = original.indexOf(excerpt);
    let cursor = 0;
    const cited = segments.slice(start, end + 1).filter((segment) => {
      const overlaps =
        cursor < offset + excerpt.length &&
        cursor + segment.original.length > offset;
      cursor += segment.original.length + 1;
      return overlaps;
    });
    if (!cited.length) return [];
    return [
      {
        segmentId: cited[0].id,
        endSegmentId: cited[cited.length - 1].id,
        original: excerpt,
        chinese: quote.chinese,
        category: quote.category,
      },
    ];
  });
  const knowledge = (parsed.knowledge ?? []).flatMap((item) => {
    const ranges = resolveSources(item.sources, byId, segments);
    const sources = item.segmentIds.map((id) => byId.get(id));
    if (sources.some((source) => !source)) return [];
    return [
      {
        ...item,
        ...(ranges ? { sources: ranges } : {}),
        segmentIds: [
          ...new Set(sources.flatMap((source) => (source ? [source.id] : []))),
        ],
      },
    ];
  });
  const skipped =
    parsed.topics.length -
    topics.length +
    parsed.quotes.length -
    quotes.length +
    (parsed.knowledge?.length ?? 0) -
    knowledge.length +
    parsed.methods.filter(
      (m) =>
        !byId.has(
          parsed.formatVersion === 3
            ? (m.sources?.[0]?.segmentId ?? m.segmentId)
            : m.segmentId,
        ),
    ).length;
  if (parsed.formatVersion === 3) {
    validateAnalysisV3(parsed, segments.length);
    if (topics.length !== parsed.topics.length)
      throw new Error('主题时间范围无效，已有结果未覆盖');
  }
  return analysisSchema.parse({
    formatVersion:
      parsed.formatVersion === 3
        ? 3
        : parsed.knowledge &&
            parsed.prerequisites &&
            topics.every((t) => t.clipVerdict && t.applicationOrigin)
          ? 2
          : undefined,
    knowledge,
    prerequisites: parsed.prerequisites ?? [],
    warnings: [
      ...parsed.warnings,
      ...(skipped
        ? [`有 ${skipped} 处来源或摘录不符合规则，已省略；其余内容已保留。`]
        : []),
    ],
    summary: parsed.summary,
    topics,
    quotes,
    methods: parsed.methods.flatMap((method) => {
      const ranges = resolveSources(method.sources, byId, segments);
      const source =
        parsed.formatVersion === 3 && ranges?.[0]
          ? segments.find((s) => s.id === ranges[0].segmentId)
          : byId.get(method.segmentId);
      return source
        ? [
            {
              ...method,
              ...(ranges ? { sources: ranges } : {}),
              segmentId: source.id,
            },
          ]
        : [];
    }),
  });
}
