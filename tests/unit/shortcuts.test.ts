import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import {
  captureShortcut,
  supportedUrl,
} from '../../extension/src/background/shortcuts';
const tab = (
  id: number,
  url = 'https://www.youtube.com/watch?v=abcdefghijk',
): chrome.tabs.Tab => ({
  id,
  url,
  index: 0,
  pinned: false,
  highlighted: true,
  windowId: 1,
  active: true,
  incognito: false,
  selected: true,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
});
afterEach(() => vi.unstubAllGlobals());
it('两个独立命令，打开面板不创建笔记', async () => {
  const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
  expect(Object.keys(manifest.commands).sort()).toEqual([
    '_execute_action',
    'capture-note',
  ]);
  expect(manifest.commands._execute_action.suggested_key.mac).not.toBe(
    manifest.commands['capture-note'].suggested_key.mac,
  );
  const capture = vi.fn();
  await captureShortcut('_execute_action', tab(3), capture);
  await captureShortcut('unknown', tab(3), capture);
  expect(capture).not.toHaveBeenCalled();
});
it('优先使用触发快捷键时的标签，避免异步查询后切到另一视频', async () => {
  const query = vi.fn().mockResolvedValue([tab(99)]),
    capture = vi.fn();
  vi.stubGlobal('chrome', { tabs: { query } });
  await captureShortcut('capture-note', tab(3), capture);
  expect(query).not.toHaveBeenCalled();
  expect(capture).toHaveBeenCalledExactlyOnceWith(3);
});
it('缺少事件标签时查询当前标签，空窗口不执行', async () => {
  const query = vi
      .fn()
      .mockResolvedValueOnce([tab(5)])
      .mockResolvedValueOnce([]),
    capture = vi.fn();
  vi.stubGlobal('chrome', { tabs: { query } });
  await captureShortcut('capture-note', undefined, capture);
  await captureShortcut('capture-note', undefined, capture);
  expect(capture).toHaveBeenCalledExactlyOnceWith(5);
});
it('站外、Shorts、无效地址不执行快捷笔记', async () => {
  const capture = vi.fn();
  for (const url of [
    'https://example.com/watch?v=abcdefghijk',
    'https://www.youtube.com/shorts/abcdefghijk',
    'invalid',
    'https://www.youtube.com/watch?v=bad',
  ]) {
    expect(supportedUrl(url)).toBe(false);
    await captureShortcut('capture-note', tab(3, url), capture);
  }
  expect(capture).not.toHaveBeenCalled();
});
it('笔记保存错误向上报告，不重试或伪报成功', async () => {
  const capture = vi.fn().mockRejectedValue(new Error('保存失败'));
  await expect(
    captureShortcut('capture-note', tab(3), capture),
  ).rejects.toThrow('保存失败');
  expect(capture).toHaveBeenCalledTimes(1);
});
