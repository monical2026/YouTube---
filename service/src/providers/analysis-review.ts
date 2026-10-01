import { requestReviewPlan } from './analysis-review-request';
import { reviewStandaloneQuotes } from './quote-review';
import { applyReviewPlan } from './analysis-review-plan';
import { type Analysis, type Segment } from '@youtube-note/shared';
import { resolveAnalysis } from './analysis';

// 仅提交脉络、原文来源和边界证据，不携带笔记、个人疑问或翻译。
export function reviewMaterial(analysis: Analysis, segments: Segment[]) {
  const ids = new Map(segments.map((s, i) => [s.id, String(i + 1)]));
  const ref = (id: string) => {
    const mapped = ids.get(id);
    if (!mapped) throw new Error('全片复核来源已失效，已有结果未覆盖');
    return mapped;
  };
  const ranges = (
    sources: NonNullable<Analysis['methods'][number]['sources']>,
  ) =>
    sources.map((s) => ({
      ...s,
      segmentId: ref(s.segmentId),
      endSegmentId: ref(s.endSegmentId),
    }));
  const evidence = new Set<string>();
  const topics = analysis.topics.map((t) => {
    if (!t.startSegmentId || !t.endSegmentId)
      throw new Error('请更新本机组件后重新整理，新版脉络需要完整来源');
    const start = segments.findIndex((s) => s.id === t.startSegmentId);
    const end = segments.findIndex((s) => s.id === t.endSegmentId);
    // 保留章节首末原话，使合并/拆分不只依赖摘要。
    for (const i of [start, end])
      if (i >= start && i <= end) evidence.add(segments[i].id);
    return {
      title: t.title,
      introduction: t.introduction,
      problem: t.problem,
      application: t.application,
      applicationOrigin: t.applicationOrigin,
      keyPoints: t.keyPoints,
      clipVerdict: t.clipVerdict,
      clipReason: t.clipReason,
      startId: ref(t.startSegmentId),
      endId: ref(t.endSegmentId),
    };
  });
  return {
    segmentCount: segments.length,
    allowedBoundaryIds: segments.flatMap((s) =>
      evidence.has(s.id) ? [ref(s.id)] : [],
    ),
    summary: analysis.summary,
    topics,
    knowledge: (analysis.knowledge ?? []).map((k, index) => ({
      ...k,
      index,
      segmentIds: k.segmentIds.map(ref),
      sources: ranges(k.sources ?? []),
    })),
    prerequisites: (analysis.prerequisites ?? []).map((p, index) => ({
      ...p,
      index,
    })),
    quotes: analysis.quotes.map((q, index) => ({
      index,
      segmentId: ref(q.segmentId),
      endSegmentId: ref(q.endSegmentId ?? q.segmentId),
      excerpt: q.original,
      chinese: q.chinese,
      category: q.category,
    })),
    methods: analysis.methods.map((m, index) => ({
      ...m,
      index,
      segmentId: ref(m.segmentId),
      sources: ranges(m.sources ?? []),
    })),
    boundaryEvidence: segments.flatMap((s) =>
      evidence.has(s.id) ? [{ id: ref(s.id), text: s.original }] : [],
    ),
  };
}
export async function reviewAnalysis(
  analysis: Analysis,
  segments: Segment[],
  generate: (prompt: string) => Promise<string>,
) {
  const material = reviewMaterial(analysis, segments);
  const input = await requestReviewPlan(material, generate);
  const result = resolveAnalysis(applyReviewPlan(input, material), segments);
  if (result.formatVersion !== 3)
    throw new Error('全片复核未采用新版结构，已有结果未覆盖');
  // 最终金句必须来自已核验候选；模型不能借复核新增断章取义的原话。
  const quotes = result.quotes.filter((q) =>
    analysis.quotes.some((old) => old.original.includes(q.original)),
  );
  return {
    ...result,
    quotes: await reviewStandaloneQuotes(quotes, generate),
    warnings: [
      ...new Set([
        ...(analysis.warnings ?? []),
        ...(result.warnings ?? []),
        ...(quotes.length < result.quotes.length
          ? ['复核新增的金句未在候选中，已省略。']
          : []),
      ]),
    ],
  };
}
