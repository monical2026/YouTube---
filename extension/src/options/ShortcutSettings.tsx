import { useEffect, useState } from 'react';
import { errorText } from '../lib/rpc';

const actions = [
  {
    name: '_execute_action',
    label: '打开学习笔记',
    detail: '直接打开当前视频的学习笔记面板。',
  },
  {
    name: 'capture-note',
    label: '快速记笔记',
    detail: '记录当前视频时间并打开笔记窗，无需先打开面板。',
  },
];

export function ShortcutSettings() {
  const [commands, setCommands] = useState<chrome.commands.Command[] | null>(
    null,
  );
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    let request = 0;
    async function read() {
      const current = ++request;
      try {
        const result = await chrome.commands.getAll();
        if (!active || current !== request) return;
        setCommands(result);
        setError('');
      } catch (e) {
        if (!active || current !== request) return;
        setCommands(null);
        setError(errorText(e));
      }
    }
    function visible() {
      if (document.visibilityState === 'visible') void read();
    }
    void read();
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  async function edit() {
    try {
      await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } catch (e) {
      setError(
        `无法打开快捷键设置：${errorText(e)}。请在地址栏输入 chrome://extensions/shortcuts。`,
      );
    }
  }
  return (
    <section id="shortcuts">
      <h2>快捷键</h2>
      <p>在 YouTube 普通视频页使用，无需先点击页面上的学习笔记按钮。</p>
      {actions.map(({ name, label, detail }) => (
        <div className="card" key={name}>
          <div className="row">
            <strong>{label}</strong>
            <kbd>
              {commands === null
                ? error
                  ? '读取失败'
                  : '正在读取…'
                : commands.find((c) => c.name === name)?.shortcut || '未设置'}
            </kbd>
          </div>
          <p className="muted">{detail}</p>
        </div>
      ))}
      <p>
        点击下方按钮，在 Chrome 页面找到“YouTube
        学习笔记”，分别录入两个快捷键。修改后由 Chrome
        自动保存，返回这里会更新显示，无需点击“保存全部设置”。
      </p>
      <p className="muted">
        显示“未设置”时，请指定按键；按键已被系统或其他扩展占用时，请换一个组合。
      </p>
      <div className="row">
        <button onClick={() => void edit()}>修改快捷键</button>
        <button onClick={() => setRefresh((n) => n + 1)}>刷新当前快捷键</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
