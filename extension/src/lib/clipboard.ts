// 在点击事件内先同步复制，避免异步权限检查耗掉用户手势；失败再用现代接口。
export async function copyText(text: string): Promise<void> {
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) =>
        selection.getRangeAt(i).cloneRange(),
      )
    : [];
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('aria-hidden', 'true');
  input.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
  document.body.append(input);
  let copied: boolean;
  try {
    input.focus();
    input.select();
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    input.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
  if (!copied) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      throw new Error('复制权限尚未生效，请重新加载扩展并刷新视频后重试');
    }
  }
}
