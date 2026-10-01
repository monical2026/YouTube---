import { expect, it } from 'vitest';
import { segmentSchema } from '../../shared/src';
import { currentSegment } from '../../extension/src/segmentation';
import {
  clearHighlight,
  reconcileHighlight,
  type HighlightTarget,
} from '../../extension/src/ui/playback-highlight';
const segments = [
  segmentSchema.parse({
    id: 'before',
    startMs: 1790000,
    endMs: 1800000,
    original: '上一段',
  }),
  segmentSchema.parse({
    id: 'clicked',
    startMs: 1800000,
    endMs: 1810000,
    original: '点击的段落',
  }),
];
const pending = (): HighlightTarget => ({
  requestId: 2,
  videoId: 'video-a',
  segment: segments[1],
  arrived: false,
});
it('点击 30 分钟的交界点，不再定位上一段', () => {
  expect(currentSegment(segments, 1799999)?.id).toBe('before');
  expect(currentSegment(segments, 1800000)?.id).toBe('clicked');
});
it('跳转期间旧进度不能覆盖点击项，到达后自然播放可以离开', () => {
  let target: HighlightTarget | null = pending();
  for (const ms of [1000, 1799500, 1799999]) {
    target = reconcileHighlight(target, 'video-a', ms);
    expect(target?.segment.id).toBe('clicked');
    expect(target?.arrived).toBe(false);
  }
  target = reconcileHighlight(target, 'video-a', 1800000);
  expect(target?.arrived).toBe(true);
  expect(reconcileHighlight(target, 'video-a', 1805000)?.segment.id).toBe(
    'clicked',
  );
  expect(reconcileHighlight(target, 'video-a', 1810000)).toBeNull();
});
it('来源重叠时到达仍保持用户点击的段落', () => {
  const overlap = [{ ...segments[0], endMs: 1801000 }, segments[1]];
  expect(currentSegment(overlap, 1800000)?.id).toBe('before');
  expect(reconcileHighlight(pending(), 'video-a', 1800000)?.segment.id).toBe(
    'clicked',
  );
});
it('取消只影响对应请求，旧失败不撤销新点击；切换视频清除目标', () => {
  expect(clearHighlight(pending(), 1)?.requestId).toBe(2);
  expect(clearHighlight(pending(), 2)).toBeNull();
  expect(reconcileHighlight(pending(), 'video-b', 1800000)).toBeNull();
});
