export function supportedUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === 'https://www.youtube.com' &&
      parsed.pathname === '/watch' &&
      /^[\w-]{11}$/.test(parsed.searchParams.get('v') ?? '')
    );
  } catch {
    return false;
  }
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
