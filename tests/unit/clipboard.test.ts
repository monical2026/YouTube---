import { afterEach, expect, it, vi } from 'vitest';
import { copyText } from '../../extension/src/lib/clipboard';
afterEach(() => vi.unstubAllGlobals());
function browser(copied: boolean, writeText = vi.fn(async () => {})) {
  class Element {
    focus = vi.fn();
    select = vi.fn();
    remove = vi.fn();
    setAttribute = vi.fn();
    style = { cssText: '' };
    value = '';
  }
  const active = new Element(),
    input = new Element(),
    range = { cloneRange: () => range };
  const selection = {
    rangeCount: 1,
    getRangeAt: () => range,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  };
  vi.stubGlobal('HTMLElement', Element);
  vi.stubGlobal('window', { getSelection: () => selection });
  vi.stubGlobal('document', {
    activeElement: active,
    createElement: () => input,
    body: { append: vi.fn() },
    execCommand: vi.fn(() => copied),
  });
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  return { input, active, selection, writeText };
}
it('嵌入页现代剪贴板不可用时，点击内同步复制仍成功且恢复用户选区', async () => {
  const state = browser(
    true,
    vi.fn(async () => {
      throw new Error('权限策略拒绝');
    }),
  );
  await expect(copyText('中文\nEnglish')).resolves.toBeUndefined();
  expect(state.input.value).toBe('中文\nEnglish');
  expect(state.writeText).not.toHaveBeenCalled();
  expect(state.input.remove).toHaveBeenCalled();
  expect(state.selection.addRange).toHaveBeenCalled();
  expect(state.active.focus).toHaveBeenCalled();
});
it('同步复制失败会自动尝试现代接口，无需手动选择文字', async () => {
  const state = browser(false);
  await copyText('文字');
  expect(state.writeText).toHaveBeenCalledWith('文字');
});
it('两个接口都拒绝时不能虚报成功，给出权限恢复步骤', async () => {
  browser(
    false,
    vi.fn(async () => {
      throw new Error('denied');
    }),
  );
  await expect(copyText('文字')).rejects.toThrow('重新加载扩展');
});
