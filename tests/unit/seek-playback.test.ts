import { expect, it, vi } from 'vitest';
import { seekPlayback } from '../../extension/src/content/seek-playback';

it('点击后立即发布实际时间，不等待播放缓冲或 400ms 轮询', async () => {
  let finish!: () => void;
  const video = {
    currentTime: 5,
    play: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const times: number[] = [];
  const pending = seekPlayback(video, 120000, () =>
    times.push(video.currentTime),
  );
  expect(times).toEqual([120]);
  finish();
  await pending;
});

it('快速连续跳转不会被先前播放请求的迟到完成覆盖', async () => {
  const finishes: (() => void)[] = [];
  const video = {
    currentTime: 5,
    play: () => new Promise<void>((resolve) => finishes.push(resolve)),
  };
  const times: number[] = [];
  const first = seekPlayback(video, 120000, () =>
    times.push(video.currentTime),
  );
  const second = seekPlayback(video, 20000, () =>
    times.push(video.currentTime),
  );
  finishes[1]();
  await second;
  finishes[0]();
  await first;
  expect(times).toEqual([120, 20]);
  expect(video.currentTime).toBe(20);
});

it('播放失败仍保留已跳转的真实位置并将失败交给调用方', async () => {
  const video = {
    currentTime: 5,
    play: async () => {
      throw new Error('播放被拒绝');
    },
  };
  const publish = vi.fn();
  await expect(seekPlayback(video, 10000, publish)).rejects.toThrow(
    '播放被拒绝',
  );
  expect(publish).toHaveBeenCalledOnce();
  expect(video.currentTime).toBe(10);
});
