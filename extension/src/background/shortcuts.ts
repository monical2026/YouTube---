import { pageSource } from '@youtube-note/shared';
export function supportedUrl(url?: string): boolean {
  return pageSource(url) !== null;
}

// 打开面板使用 Chrome 的 _execute_action，不能落入快速笔记处理。
export async function captureShortcut(
  command: string,
  tab: chrome.tabs.Tab | undefined,
  capture: (tabId: number) => Promise<void>,
): Promise<void> {
  if (command !== 'capture-note') return;
  const target =
    tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (target?.id === undefined || !supportedUrl(target.url)) return;
  await capture(target.id);
}
