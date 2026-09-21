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
  return {
    warnings: parts.flatMap((part) => part.warnings ?? []),
    summary: parts.map((part) => part.summary).join('\n\n'),
    topics: parts
      .flatMap((part) => part.topics)
      .sort((a, b) => a.startMs - b.startMs),
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
