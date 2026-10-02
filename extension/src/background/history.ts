import { matchesVideoPage, videoUrl } from '@youtube-note/shared';
export async function openHistory(videoId?: string) {
  const query = new URLSearchParams({ history: '1' });
  if (videoId) query.set('video', videoId);
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`panel.html?${query}`),
  });
  return true;
}
export async function openVideoTime(videoId: string, startMs?: number) {
  const tabs = await chrome.tabs.query({
    url: ['https://www.youtube.com/watch*', 'https://www.bilibili.com/video/*'],
  });
  const target = tabs.find((tab) => matchesVideoPage(tab.url, videoId));
  const url = new URL(videoUrl(videoId, startMs));
  if (target?.id !== undefined) {
    if (startMs !== undefined) {
      let sought = false;
      try {
        const response: unknown = await chrome.tabs.sendMessage(target.id, {
          type: 'seek',
          videoId,
          startMs,
        });
        sought =
          !!response &&
          typeof response === 'object' &&
          'ok' in response &&
          response.ok === true;
      } catch {
        /* 页面接收端不可用时，通过带时间的原视频地址恢复。 */
      }
      if (!sought) await chrome.tabs.update(target.id, { url: url.href });
    }
    await chrome.tabs.update(target.id, { active: true });
    await chrome.windows.update(target.windowId, { focused: true });
  } else await chrome.tabs.create({ url: url.href });
  return true;
}
