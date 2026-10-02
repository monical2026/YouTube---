// 此函数由 scripting.executeScript 在当前视频网页执行，不能引用模块外变量。
// 仅向固定字幕接口和字幕 CDN 请求；登录凭据留在浏览器内。
export async function requestBilibiliSubtitles(
  bvid: string,
  cid: string,
  part: number,
) {
  if (
    !/^BV[0-9A-Za-z]{10}$/.test(bvid) ||
    !/^[1-9]\d{0,14}$/.test(cid) ||
    !Number.isInteger(part) ||
    part < 1
  )
    throw new Error('视频标识无效');
  function matches() {
    const url = new URL(location.href);
    const state = (
      globalThis as typeof globalThis & {
        __INITIAL_STATE__?: {
          cid?: unknown;
          p?: unknown;
          videoData?: { bvid?: unknown };
        };
      }
    ).__INITIAL_STATE__;
    return (
      url.origin === 'https://www.bilibili.com' &&
      (url.pathname === `/video/${bvid}/` ||
        url.pathname === `/video/${bvid}`) &&
      Number(url.searchParams.get('p') ?? 1) === part &&
      state?.videoData?.bvid === bvid &&
      String(state.cid) === cid &&
      state.p === part
    );
  }
  async function json(
    url: URL,
    credentials: RequestCredentials,
  ): Promise<unknown> {
    const response = await fetch(url, {
      credentials,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('字幕请求失败，请稍后重试');
    return response.json();
  }
  try {
    if (!matches()) throw new Error('视频已切换，请重新获取');
    const info = await json(
      new URL(
        `https://api.bilibili.com/x/player/wbi/v2?bvid=${bvid}&cid=${cid}`,
      ),
      'include',
    );
    if (
      !info ||
      typeof info !== 'object' ||
      !('code' in info) ||
      info.code !== 0 ||
      !('data' in info) ||
      !info.data ||
      typeof info.data !== 'object'
    )
      throw new Error('B 站字幕接口暂不可用，请稍后重试');
    const data = info.data;
    if ('need_login_subtitle' in data && data.need_login_subtitle === true)
      throw new Error('请先在当前浏览器登录 B 站，再重试获取字幕');
    const subtitle = 'subtitle' in data ? data.subtitle : null;
    if (
      !subtitle ||
      typeof subtitle !== 'object' ||
      !('subtitles' in subtitle) ||
      !Array.isArray(subtitle.subtitles)
    )
      throw new Error('B 站字幕响应格式异常');
    const tracks = subtitle.subtitles
      .flatMap((item: unknown) => {
        if (
          !item ||
          typeof item !== 'object' ||
          !('lan' in item) ||
          typeof item.lan !== 'string' ||
          !('subtitle_url' in item) ||
          typeof item.subtitle_url !== 'string'
        )
          return [];
        return [{ language: item.lan, url: item.subtitle_url }];
      })
      .sort((a, b) => {
        const rank = (lan: string) =>
          (lan.startsWith('ai-') ? 2 : 0) + (/^(ai-)?zh/.test(lan) ? 0 : 1);
        return rank(a.language) - rank(b.language);
      });
    if (!tracks.length)
      throw new Error(
        '此视频没有可读取的独立字幕；B 站音频转写尚未接入，可先记笔记',
      );
    const track = tracks[0];
    const url = new URL(track.url, 'https://www.bilibili.com');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      ![
        'aisubtitle.hdslb.com',
        'i0.hdslb.com',
        'i1.hdslb.com',
        'i2.hdslb.com',
      ].includes(url.hostname) ||
      !url.pathname.endsWith('.json')
    )
      throw new Error('字幕地址不在允许范围，未请求');
    const body = await json(url, 'omit');
    if (!matches()) throw new Error('视频已切换，本次字幕未保存');
    return { language: track.language, body };
  } catch (error) {
    return {
      error:
        error instanceof Error &&
        !/fetch|network|json|abort/i.test(error.message)
          ? error.message
          : '字幕读取失败，请检查网络后重试',
    };
  }
}
