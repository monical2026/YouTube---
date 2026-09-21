// 仅打开验证页面，不承担翻译或保存任何凭据。
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage().catch(() => {
    console.error('无法打开验证页面');
  });
});
