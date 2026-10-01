// 先发布播放器接受的实际位置，不等待轮询或 play() 的缓冲结果。
export async function seekPlayback(
  video: Pick<HTMLVideoElement, 'currentTime' | 'play'>,
  startMs: number,
  publish: () => void,
): Promise<void> {
  video.currentTime = startMs / 1000;
  publish();
  await video.play();
}
