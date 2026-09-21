import type { Analysis, Segment } from './index';
// 只计算真正提交给模型的原文与时间，译文、笔记和编辑元数据不占分析预算。
export function analysisInput(segments: Segment[]) {
  return segments.map((s) => ({
    id: s.id,
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.original,
  }));
}
export function analysisBatches(
  segments: Segment[],
  limit = 24000,
): Segment[][] {
  const batches: Segment[][] = [];
  let batch: Segment[] = [];
  let size = 2;
  for (const segment of segments) {
    const length = JSON.stringify(analysisInput([segment])[0]).length + 1;
    if (length + 2 > limit)
      throw new Error('单个逐字稿段落过长，请先缩短该段再整理');
    if (size + length > limit && batch.length) {
      batches.push(batch);
      batch = [];
      size = 2;
    }
    batch.push(segment);
    size += length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
export function mergeAnalyses(parts: Analysis[]): Analysis {
  const topics = parts
    .flatMap((part) => part.topics)
    .sort((a, b) => a.startMs - b.startMs);
  const known = topics.filter((t) => t.clipVerdict);
  const recommended = known.filter((t) => t.clipVerdict === '建议切片');
  const conditional = known.filter((t) => t.clipVerdict === '有条件建议');
  const clipOverview =
    known.length === topics.length && known.length
      ? `${recommended.length ? '值得挑选局部片段' : conditional.length ? '部分内容可有条件切片' : '暂不建议独立切片'}。共 ${topics.length} 个主题，${recommended.length} 个建议切片，${conditional.length} 个有条件建议。${[
          ...recommended,
          ...conditional,
        ]
          .slice(0, 3)
          .map((t) => `可关注「${t.title}」`)
          .join(' ')}（基于各段文字独立性的初步汇总）`
      : undefined;
  const knowledge = new Map<
    string,
    NonNullable<Analysis['knowledge']>[number]
  >();
  for (const item of parts.flatMap((part) => part.knowledge ?? [])) {
    const key = item.title.trim().toLocaleLowerCase();
    const existing = knowledge.get(key);
    knowledge.set(
      key,
      existing
        ? {
            ...existing,
            understanding: [
              ...new Set([existing.understanding, item.understanding].flat()),
            ],
            role: [...new Set([existing.role, item.role].flat())],
            segmentIds: [
              ...new Set([...existing.segmentIds, ...item.segmentIds]),
            ],
          }
        : item,
    );
  }
  return {
    formatVersion:
      parts.length && parts.every((part) => part.formatVersion === 2)
        ? 2
        : undefined,
    clipOverview,
    knowledge: [...knowledge.values()],
    prerequisites: [
      ...new Map(
        parts
          .flatMap((part) => part.prerequisites ?? [])
          .map((p) => [`${p.title}:${p.description}:${p.origin}`, p]),
      ).values(),
    ],
    warnings: parts.flatMap((part) => part.warnings ?? []),
    summary: parts.map((part) => part.summary).join('\n\n'),
    topics,
    quotes: [
      ...new Map(
        parts
          .flatMap((part) => part.quotes)
          .map((q) => [`${q.segmentId}:${q.original}`, q]),
      ).values(),
    ],
    methods: [
      ...new Map(
        parts
          .flatMap((part) => part.methods)
          .map((m) => [`${m.segmentId}:${m.title}`, m]),
      ).values(),
    ],
  };
}
