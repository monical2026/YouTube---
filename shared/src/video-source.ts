import { z } from 'zod';
const youtubeId = /^[\w-]{11}$/;
const bilibiliId =
  /^bilibili-(BV[0-9A-Za-z]{10})-([1-9]\d{0,14})-p([1-9]\d{0,4})$/;
export const videoIdSchema = z
  .string()
  .refine((id) => youtubeId.test(id) || bilibiliId.test(id), '视频标识无效');
export function videoSource(id: string) {
  const match = bilibiliId.exec(id);
  if (match)
    return {
      platform: 'bilibili' as const,
      id: match[1],
      cid: match[2],
      page: Number(match[3]),
    };
  if (youtubeId.test(id)) return { platform: 'youtube' as const, id, page: 1 };
  throw new Error('视频标识无效');
}
export function videoUrl(id: string, startMs?: number) {
  const source = videoSource(id);
  const url = new URL(
    source.platform === 'youtube'
      ? `https://www.youtube.com/watch?v=${source.id}`
      : `https://www.bilibili.com/video/${source.id}/?p=${source.page}`,
  );
  if (startMs !== undefined) {
    if (!Number.isFinite(startMs) || startMs < 0)
      throw new Error('视频时间无效');
    url.searchParams.set(
      't',
      `${Math.floor(startMs / 1000)}${source.platform === 'youtube' ? 's' : ''}`,
    );
  }
  return url.href;
}
export function pageSource(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.origin === 'https://www.youtube.com' && url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return youtubeId.test(id)
        ? { platform: 'youtube' as const, id, page: 1 }
        : null;
    }
    const match = /^\/video\/(BV[0-9A-Za-z]{10})\/?$/.exec(url.pathname);
    const page = url.searchParams.get('p') ?? '1';
    if (
      url.origin === 'https://www.bilibili.com' &&
      match &&
      /^[1-9]\d{0,4}$/.test(page)
    )
      return {
        platform: 'bilibili' as const,
        id: match[1],
        page: Number(page),
      };
  } catch {
    return null;
  }
  return null;
}
export function matchesVideoPage(url: string | undefined, id: string) {
  const page = pageSource(url);
  const parsed = videoIdSchema.safeParse(id);
  if (!page || !parsed.success) return false;
  const source = videoSource(parsed.data);
  return (
    page.platform === source.platform &&
    page.id === source.id &&
    page.page === source.page
  );
}
export function videoOrigin(id: string) {
  return new URL(videoUrl(id)).origin;
}
