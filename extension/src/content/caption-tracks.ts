// 只复用当前视频已经发出的字幕资源地址；临时签名留在内存，不写入存储或日志。
export function activeCaptionUrl(
  baseUrl: string,
  videoId: string,
  language: string,
  resources: string[],
): string {
  for (let index = resources.length - 1; index >= 0; index--) {
    let url: URL;
    try {
      url = new URL(resources[index]);
    } catch {
      continue;
    }
    if (
      url.origin !== 'https://www.youtube.com' ||
      url.pathname !== '/api/timedtext'
    )
      continue;
    if (
      url.searchParams.get('v') !== videoId ||
      url.searchParams.get('lang') !== language ||
      url.searchParams.has('tlang')
    )
      continue;
    if (url.searchParams.has('pot')) return url.href;
  }
  return baseUrl;
}
