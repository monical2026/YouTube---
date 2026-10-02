import { z } from 'zod';
import { videoSource, type VideoContext } from '@youtube-note/shared';
import { parseCaptions } from '../segmentation';
import { bilibiliSegments } from '../platforms/bilibili';
import { requestBilibiliSubtitles } from '../platforms/bilibili-request';
import { native } from './native-client';
export async function fetchCaptions(context: VideoContext, tabId: number) {
  const source = videoSource(context.videoId);
  if (source.platform === 'bilibili') {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: requestBilibiliSubtitles,
      args: [source.id, source.cid, source.page],
    });
    const response = z
      .union([
        z.object({ error: z.string().max(200) }),
        z.object({ language: z.string().max(30), body: z.unknown() }),
      ])
      .parse(results.find((r) => r.frameId === 0)?.result);
    if ('error' in response) throw new Error(response.error);
    return bilibiliSegments(
      response.body,
      response.language,
      context.durationMs,
    );
  }
  const tracks = [...context.tracks].sort(
    (a, b) =>
      (b.language === 'en' ? 2 : 0) -
      (a.language === 'en' ? 2 : 0) +
      (a.automatic ? 1 : 0) -
      (b.automatic ? 1 : 0),
  );
  for (const track of tracks.slice(0, 2)) {
    try {
      const url = new URL(track.url);
      if (
        url.origin !== 'https://www.youtube.com' ||
        url.pathname !== '/api/timedtext'
      )
        continue;
      url.searchParams.set('fmt', 'json3');
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        credentials: 'include',
      });
      if (!response.ok) continue;
      const data: unknown = await response.json();
      const segments = parseCaptions(data);
      if (segments.length)
        return segments.map((s) => ({ ...s, sourceLanguage: track.language }));
    } catch {
      /* 当前轨道失败后尝试下一条；最终失败在服务入口显示。 */
    }
  }
  return native('transcript', { videoId: context.videoId, mode: 'native' });
}
