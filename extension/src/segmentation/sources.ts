import type { Segment } from '@youtube-note/shared';
import type { Cue } from './regroup';
const compact = (text: string) => text.replace(/\s/g, '');

// 升级优先恢复已保存的细粒度时间和字符范围；手改段由调用方隔离。
export function recoverCues(segments: Segment[]): Cue[] {
  const cues: Cue[] = [];
  for (const segment of segments) {
    const spans = segment.sourceSpans;
    if (
      !spans?.length ||
      compact(spans.map((s) => s.text).join('')) !== compact(segment.original)
    ) {
      cues.push({
        id: `snapshot-${cues.length}`,
        sourceId: segment.id,
        text: segment.original,
        startMs: segment.startMs,
        endMs: segment.endMs,
        speaker: segment.speaker,
      });
      continue;
    }
    for (const span of spans) {
      const previous = cues.at(-1);
      if (
        previous &&
        previous.sourceId === span.cueId &&
        (previous.sourceStartChar ?? 0) + previous.text.length ===
          span.startChar &&
        previous.startMs === span.startMs &&
        previous.endMs === span.endMs &&
        previous.speaker === segment.speaker
      ) {
        previous.text += span.text;
      } else
        cues.push({
          id: `source-${cues.length}`,
          sourceId: span.cueId,
          sourceStartChar: span.startChar,
          text: span.text,
          startMs: span.startMs,
          endMs: span.endMs,
          speaker: segment.speaker,
        });
    }
  }
  return cues;
}
