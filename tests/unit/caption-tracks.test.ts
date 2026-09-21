import { it, expect } from 'vitest';
import { activeCaptionUrl } from '../../extension/src/content/caption-tracks';
import { matchesExtensionPage } from '../../extension/src/background/origin';
it('优先使用当前视频实际请求中的字幕签名地址', () => {
  const current =
    'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en&pot=fixture';
  expect(activeCaptionUrl('base', 'abcdefghijk', 'en', [current])).toBe(
    current,
  );
});
it('不能误用其他视频、其他语言、翻译轨或站外地址', () => {
  const urls = [
    'https://www.youtube.com/api/timedtext?v=other-video&lang=en&pot=fixture',
    'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=fr&pot=fixture',
    'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en&tlang=zh&pot=fixture',
    'https://example.com/api/timedtext?v=abcdefghijk&lang=en&pot=fixture',
  ];
  expect(activeCaptionUrl('base', 'abcdefghijk', 'en', urls)).toBe('base');
});
it('设置页带导航锚点仍被识别，但相似路径或其他扩展不能访问', () => {
  expect(
    matchesExtensionPage(
      'chrome-extension://test/options.html#routing',
      'test',
      'options.html',
    ),
  ).toBe(true);
  expect(
    matchesExtensionPage(
      'chrome-extension://test/options.html.evil',
      'test',
      'options.html',
    ),
  ).toBe(false);
  expect(
    matchesExtensionPage(
      'chrome-extension://other/options.html',
      'test',
      'options.html',
    ),
  ).toBe(false);
});
