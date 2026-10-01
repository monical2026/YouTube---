import type { Segment } from '@youtube-note/shared';
import type { parseAnalysisOutput } from './analysis-output';
type Output = ReturnType<typeof parseAnalysisOutput>;
export function quoteSentenceCount(text: string) {
  // Intl 分句能识别常见英文缩写；语义独立性由全片复核负责。
  return [
    ...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text),
  ].filter((s) => s.segment.trim()).length;
}
export function validateAnalysisV3(data: Output, count: number) {
  const fail = (field: string) => {
    throw new Error(`新版脉络的${field}不完整，已有结果未覆盖，请重新整理。`);
  };
  if (!data.summary.trim() || data.summary.length > 200) fail('简短总结');
  if (!data.knowledge || !data.prerequisites) fail('关键点或前置知识栏目');
  let next = 1;
  for (const [index, topic] of data.topics.entries()) {
    const start = Number(topic.startId),
      end = Number(topic.endId),
      field = `第 ${index + 1} 个主题`;
    if (start !== next || !Number.isInteger(end) || end < start || end > count)
      fail(`${field}连续来源范围`);
    if (!topic.keyPoints?.length) fail(`${field}要点`);
    if (!Array.isArray(topic.problem) || !Array.isArray(topic.application))
      fail(`${field}分条问题或场景`);
    if (
      !['高', '中', '低', '需核对画面'].includes(topic.clipVerdict ?? '') ||
      !topic.clipReason.length
    )
      fail(`${field}切片等级或理由`);
    next = end + 1;
  }
  if (next !== count + 1) fail('主题末尾覆盖范围');
  for (const [index, item] of (data.knowledge ?? []).entries()) {
    if (
      !item.sources?.length ||
      !Array.isArray(item.understanding) ||
      !item.understanding.length ||
      !Array.isArray(item.role) ||
      !item.role.length
    )
      fail(`第 ${index + 1} 个关键点内容或出处`);
  }
  for (const [index, method] of data.methods.entries()) {
    if (
      !method.applicability?.trim() ||
      !method.steps?.length ||
      !method.sources?.length
    )
      fail(`第 ${index + 1} 个方法的场景、步骤或出处`);
  }
}
export function resolveSources(
  sources:
    { segmentId: string; endSegmentId: string; label: string }[] | undefined,
  byId: Map<string, Segment>,
  segments: Segment[],
) {
  if (!sources) return undefined;
  const merged: { start: number; end: number; label: string }[] = [];
  for (const range of sources) {
    const start = byId.get(range.segmentId),
      end = byId.get(range.endSegmentId);
    if (!start || !end || segments.indexOf(start) > segments.indexOf(end))
      throw new Error('脉络出处范围无效，已有结果未覆盖，请重新整理。');
    let next = {
      start: segments.indexOf(start),
      end: segments.indexOf(end),
      label: range.label,
    };
    let insertAt = merged.length;
    for (let i = 0; i < merged.length;) {
      const previous = merged[i];
      if (previous.start <= next.end + 1 && next.start <= previous.end + 1) {
        insertAt = Math.min(insertAt, i);
        next = {
          start: Math.min(next.start, previous.start),
          end: Math.max(next.end, previous.end),
          label: previous.label,
        };
        merged.splice(i, 1);
        i = 0;
      } else i++;
    }
    merged.splice(insertAt, 0, next);
  }
  return merged.map((range) => ({
    segmentId: segments[range.start].id,
    endSegmentId: segments[range.end].id,
    label: range.label,
  }));
}
