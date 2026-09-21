import { z } from 'zod';
import { groupCues } from './regroup';
export { groupCues, prepareSegments } from './regroup';
import type { Segment } from '@youtube-note/shared';
const eventSchema = z.object({
  tStartMs: z.number().nonnegative(),
  dDurationMs: z.number().nonnegative().optional(),
  segs: z.array(z.object({ utf8: z.string() })).optional(),
});
export function parseCaptions(input: unknown): Segment[] {
  const raw = z.object({ events: z.array(eventSchema) }).parse(input);
  const cues = raw.events.flatMap((e, index) => {
    const text = e.segs?.map((s) => s.utf8).join('');
    return text?.trim()
      ? [
          {
            id: `cue-${index}`,
            startMs: e.tStartMs,
            endMs: e.tStartMs + (e.dDurationMs ?? 0),
            text,
          },
        ]
      : [];
  });
  return groupCues(cues);
}
// 缓存不可变段落数组的区间索引，播放事件不扫描全文。
const timeIndexes = new WeakMap<Segment[], number[]>();
export function currentSegment(
  segments: Segment[],
  ms: number,
): Segment | undefined {
  let ends = timeIndexes.get(segments);
  if (!ends) {
    let latestEnd = -1;
    ends = segments.map((s) => (latestEnd = Math.max(latestEnd, s.endMs)));
    timeIndexes.set(segments, ends);
  }
  let lo = 0,
    hi = segments.length;
  // 来源时间重叠时优先最早仍有效的一段，不虚构句内时间。
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid] < ms) lo = mid + 1;
    else hi = mid;
  }
  const found = segments[lo];
  return found && found.startMs <= ms ? found : undefined;
}
