import type { Segment } from '@youtube-note/shared';
export type SeekTarget = Pick<Segment, 'startMs'> &
  Partial<Pick<Segment, 'id'>>;
export type HighlightTarget = {
  requestId: number;
  videoId: string;
  segment: Segment;
  arrived: boolean;
};
export function reconcileHighlight(
  target: HighlightTarget | null,
  videoId: string | undefined,
  currentMs: number | undefined,
): HighlightTarget | null {
  if (!target || target.videoId !== videoId) return null;
  const inside =
    currentMs !== undefined &&
    currentMs >= target.segment.startMs &&
    currentMs < target.segment.endMs;
  if (inside) return target.arrived ? target : { ...target, arrived: true };
  // 跳转途中旧进度不能夺走点击目标；到达后离开目标段则恢复正常跟随。
  return target.arrived ? null : target;
}
export function clearHighlight(
  target: HighlightTarget | null,
  requestId: number,
) {
  return target?.requestId === requestId ? null : target;
}
