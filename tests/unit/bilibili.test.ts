import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  bilibiliMetadata,
  bilibiliSegments,
} from '../../extension/src/platforms/bilibili';
import { requestBilibiliSubtitles } from '../../extension/src/platforms/bilibili-request';
import {
  pageSource,
  matchesVideoPage,
  videoUrl,
  requestSchema,
  recordSchema,
  transcriptLanguage,
  readingMode,
} from '../../shared/src';
import { transcriptText } from '../../extension/src/export';
import { exportBlocks } from '../../extension/src/export/document';
import { prepareSegments } from '../../extension/src/segmentation';
import { questionRequestSchema } from '../../shared/src/questions';
const bvid = 'BV1qW411N7FU';
const id = `bilibili-${bvid}-40809285-p2`;
const href = `https://www.bilibili.com/video/${bvid}/?p=2`;
const state = {
  cid: 40809285,
  p: 2,
  videoData: {
    bvid,
    cid: 40809259,
    title: '多 P 测试',
    pages: [
      { page: 1, cid: 40809259, duration: 1025, part: '第一部分' },
      { page: 2, cid: 40809285, duration: 1118, part: '第二部分' },
    ],
  },
};
const body = {
  body: [
    { from: 1.25, to: 4.5, content: '原始中文逐字稿。' },
    { from: 5, to: 8, content: '第二句话。' },
  ],
};
it('多 P 使用当前 cid，不误取 videoData 的 P1 cid；错页、旧播放器和交互视频不发布', () => {
  expect(bilibiliMetadata(state, href, 1118)).toMatchObject({
    videoId: id,
    durationMs: 1118000,
    title: '多 P 测试 · P2 第二部分',
  });
  expect(bilibiliMetadata(state, href.replace('p=2', 'p=1'), 1118)).toBeNull();
  expect(bilibiliMetadata({ ...state, cid: 40809259 }, href, 1118)).toBeNull();
  expect(bilibiliMetadata(state, href, 1025)).toBeNull();
  expect(
    bilibiliMetadata(
      {
        ...state,
        videoData: { ...state.videoData, rights: { is_stein_gate: 1 } },
      },
      href,
      1118,
    ),
  ).toBeNull();
});
it('跨平台键与原链接保留分 P，YouTube 键和时间链接兼容', () => {
  expect(videoUrl(id, 12345)).toBe(`${href}&t=12`);
  expect(videoUrl('abcdefghijk', 12345)).toBe(
    'https://www.youtube.com/watch?v=abcdefghijk&t=12s',
  );
  expect(matchesVideoPage(href, id)).toBe(true);
  expect(matchesVideoPage(href.replace('p=2', 'p=1'), id)).toBe(false);
  for (const url of [
    'https://www.bilibili.com/',
    'https://live.bilibili.com/123',
    href.replace('www.bilibili.com', 'www.bilibili.com.evil.test'),
    href.replace('p=2', 'p=0'),
    'https://www.youtube.com/shorts/abcdefghijk',
  ])
    expect(pageSource(url)).toBeNull();
  for (const type of [
    'deleteHistory',
    'openVideoTime',
    'returnVideo',
    'openHistory',
  ])
    expect(requestSchema.safeParse({ type, videoId: id }).success).toBe(true);
});
it('字幕秒转毫秒、保留中文语言和来源；拒绝倒序时间及超出分 P 的字幕', () => {
  const segments = bilibiliSegments(body, 'zh', 1118000);
  expect(segments[0].startMs).toBe(1250);
  expect(segments.at(-1)?.endMs).toBe(8000);
  expect(segments[0].sourceSpans?.[0].text).toContain('原始中文');
  expect(prepareSegments(segments)).toEqual(segments);
  expect(transcriptLanguage(segments)).toBe('zh');
  expect(readingMode(segments, 'bilingual')).toBe('original');
  expect(() =>
    bilibiliSegments(
      { body: [{ from: 2, to: 1, content: '错位' }] },
      'zh',
      10000,
    ),
  ).toThrow();
  expect(() => bilibiliSegments(body, 'zh', 1000)).toThrow('超出当前分 P');
});
it('中文导出只出现一份原稿，保留 B 站地址，旧英文仍有双语', () => {
  const record = recordSchema.parse({
    videoId: id,
    title: '测试',
    revision: 0,
    notes: [],
    analysis: null,
    segments: bilibiliSegments(body, 'zh', 1118000),
  });
  expect(transcriptText(record, 'chinese')).toContain('原始中文');
  expect(transcriptText(record, 'bilingual').match(/原始中文/g)).toHaveLength(
    1,
  );
  expect(exportBlocks(record, 'bilingual', ['transcript'])[1].text).toBe(href);
  expect(
    readingMode(
      [
        {
          ...record.segments[0],
          sourceLanguage: 'en',
          original: 'English text',
        },
      ],
      'bilingual',
    ),
  ).toBe('bilingual');
});
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('location', { href });
  vi.stubGlobal('__INITIAL_STATE__', state);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
const info = (tracks: unknown[], needLogin = false) => ({
  code: 0,
  data: { need_login_subtitle: needLogin, subtitle: { subtitles: tracks } },
});
const response = (value: unknown) => ({ ok: true, json: async () => value });
const track = {
  lan: 'zh',
  subtitle_url: 'https://aisubtitle.hdslb.com/test.json',
};
it('真实注入函数优先非 AI 中文轨道；字幕 CDN 不携带登录凭据', async () => {
  fetchMock
    .mockResolvedValueOnce(response(info([{ ...track, lan: 'ai-zh' }, track])))
    .mockResolvedValueOnce(response(body));
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    language: 'zh',
    body,
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  expect(fetchMock.mock.calls[1][1].credentials).toBe('omit');
  expect(fetchMock.mock.calls[1][1].redirect).toBe('error');
});
it('登录受限、真正无字幕与网络错误区分；均不调用生成服务', async () => {
  fetchMock.mockResolvedValue(response(info([], true)));
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    error: expect.stringContaining('登录'),
  });
  fetchMock.mockResolvedValue(response(info([])));
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    error: expect.stringContaining('没有可读取'),
  });
  fetchMock.mockRejectedValue(new Error('Failed to fetch'));
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    error: expect.stringContaining('网络'),
  });
  expect(
    fetchMock.mock.calls.every((call) =>
      String(call[0]).startsWith('https://api.bilibili.com/x/player/wbi/v2?'),
    ),
  ).toBe(true);
});
it.each([
  'https://evil.test/a.json',
  'http://aisubtitle.hdslb.com/a.json',
  'https://aisubtitle.hdslb.com.evil.test/a.json',
  'https://aisubtitle.hdslb.com/private',
])('拒绝任意字幕目标 %s', async (url) => {
  fetchMock.mockResolvedValue(
    response(info([{ ...track, subtitle_url: url }])),
  );
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    error: expect.stringContaining('允许范围'),
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('请求中切换分 P 后拒绝迟到字幕，起始身份不匹配不发请求', async () => {
  fetchMock
    .mockResolvedValueOnce(response(info([track])))
    .mockImplementationOnce(async () => {
      vi.stubGlobal('location', { href: href.replace('p=2', 'p=1') });
      return response(body);
    });
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    error: expect.stringContaining('视频已切换'),
  });
  fetchMock.mockClear();
  expect(await requestBilibiliSubtitles(bvid, '40809285', 2)).toEqual({
    error: expect.stringContaining('视频已切换'),
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('B 站笔记 AI 提问接受平台键，拒绝伪造 URL 键', () => {
  const request = {
    task: 'ask',
    videoId: id,
    question: '如何理解？',
    excerpt: '摘录',
    sources: [{ id: 's', startMs: 0, original: '原文' }],
    history: [],
  };
  expect(questionRequestSchema.safeParse(request).success).toBe(true);
  expect(
    questionRequestSchema.safeParse({
      ...request,
      videoId: 'https://evil.test',
    }).success,
  ).toBe(false);
});
