import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import {
  settingsSchema,
  defaultSettings,
  type Settings,
  type Profile,
} from '@youtube-note/shared';
import { rpc, errorText } from '../lib/rpc';
import '../ui/style.css';
import './settings.css';
import { ShortcutSettings } from './ShortcutSettings';
import { SettingsNav } from './SettingsNav';
import { ModelRouting } from './ModelRouting';
import { SubtitleCosts } from './SubtitleCosts';
import { ProfileCard } from './ProfileCard';
import { withDeadline } from './request';
import { isProfileSaved } from './save-state';
import { hasCodexConnection, removeProfile } from './profiles';
function SettingsApp() {
  const [settings, setSettings] = useState<Settings>(defaultSettings),
    [savedSettings, setSavedSettings] = useState<Settings>(defaultSettings),
    [keys, setKeys] = useState<Record<string, string>>({}),
    [status, setStatus] = useState('正在连接本机组件…'),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<Record<string, string>>({}),
    [models, setModels] = useState<Record<string, string[]>>({});
  async function load() {
    try {
      const loaded = settingsSchema.parse(await rpc({ type: 'settings' }));
      setSettings(loaded);
      setSavedSettings(loaded);
      setReady(true);
      setStatus('本机组件已连接。密钥保存在 macOS 钥匙串。');
    } catch (e) {
      setStatus(errorText(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function update(id: string, change: Partial<Profile>) {
    setFeedback((m) => ({ ...m, [id]: '' }));
    const previous = settings.profiles.find((p) => p.id === id);
    if (change.baseUrl !== undefined && change.baseUrl !== previous?.baseUrl) {
      setKeys((k) => ({ ...k, [id]: '' }));
      setModels((m) => ({ ...m, [id]: [] }));
      setFeedback((m) => ({
        ...m,
        [id]: '地址已更新，请填写对应服务的密钥并重新测试。',
      }));
    } else if (change.model !== undefined && change.model !== previous?.model) {
      setFeedback((m) => ({ ...m, [id]: '' }));
    }
    setSettings((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...change } : p)),
    }));
  }
  function add(kind: Profile['kind'], connection: 'api' | 'codex' = 'api') {
    const existing = settings.profiles.find((p) => p.connection === 'codex');
    if (connection === 'codex' && existing) {
      document
        .getElementById(`profile-${existing.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setStatus('本机 Codex 连接已存在，可以在这张卡片修改模型。');
      return;
    }
    const id = crypto.randomUUID();
    setSettings((s) =>
      connection === 'codex' && hasCodexConnection(s)
        ? s
        : {
            ...s,
            profiles: [
              ...s.profiles,
              {
                id,
                kind,
                connection,
                name:
                  connection === 'codex'
                    ? '本机 Codex'
                    : kind === 'llm'
                      ? '我的 LLM'
                      : 'Supadata',
                baseUrl: kind === 'llm' ? '' : 'https://api.supadata.ai/v1',
                model: connection === 'codex' ? 'gpt-5.5' : '',
                configured: false,
              },
            ],
          },
    );
  }
  function remove(id: string) {
    setSettings((s) => removeProfile(s, id));
    setKeys((k) => {
      const next = { ...k };
      delete next[id];
      return next;
    });
    setStatus(
      '已移除此连接，点击保存全部设置后生效；不会删除笔记。原钥匙串条目保留。',
    );
  }
  async function save() {
    setBusy(true);
    try {
      const saved = settingsSchema.parse(
        await rpc({
          type: 'native',
          operation: 'saveSettings',
          payload: { settings, keys },
        }),
      );
      setSettings(saved);
      setSavedSettings(saved);
      setKeys({});
      setStatus('保存完成。');
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function test(profile: Profile, operation: 'probe' | 'models') {
    setBusy(true);
    setFeedback((m) => ({
      ...m,
      [profile.id]:
        operation === 'models' ? '正在获取模型列表…' : '正在测试模型…',
    }));
    setStatus(
      operation === 'probe'
        ? '正在测试此模型，请求可能产生少量费用…'
        : '正在获取模型列表…',
    );
    try {
      const result = await withDeadline(
        rpc({
          type: 'native',
          operation,
          payload: { profile, key: keys[profile.id] || undefined },
        }),
        profile.connection === 'codex' ? 125000 : 35000,
      );
      if (operation === 'models' && profile.connection === 'codex') {
        z.object({ loggedIn: z.literal(true) }).parse(result);
        setFeedback((m) => ({
          ...m,
          [profile.id]: '已检测到本机 Codex，ChatGPT 登录有效。',
        }));
      } else if (operation === 'models') {
        const list = [...new Set(z.array(z.string()).parse(result))];
        setModels((m) => ({ ...m, [profile.id]: list }));
        setFeedback((m) => ({
          ...m,
          [profile.id]: list.length
            ? `已获取 ${list.length} 个模型，请在下方选择。`
            : '服务返回了空列表，可手动填写模型名称。',
        }));
      } else
        setFeedback((m) => ({
          ...m,
          [profile.id]: '连接成功，模型测试通过。',
        }));
      setStatus(
        operation === 'probe'
          ? '连接成功，模型测试通过。'
          : profile.connection === 'codex'
            ? '本机 Codex 已登录。'
            : '模型列表已更新，也可手动输入模型名。',
      );
    } catch (e) {
      setStatus(errorText(e));
      setFeedback((m) => ({ ...m, [profile.id]: `操作失败：${errorText(e)}` }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="settings">
      <h1>YouTube 学习笔记 · 设置</h1>
      <p className="muted">个人电脑上的服务连接与翻译偏好</p>
      <div className="settings-layout">
        <SettingsNav />
        <div>
          <div className="notice" role="status">
            {status}
            {ready && (
              <div>
                {settings.profiles.length === savedSettings.profiles.length &&
                settings.profiles.every((p) =>
                  isProfileSaved(
                    p,
                    savedSettings.profiles.find((old) => old.id === p.id),
                    keys[p.id],
                  ),
                ) &&
                settings.translateProfile === savedSettings.translateProfile &&
                settings.analyzeProfile === savedSettings.analyzeProfile &&
                settings.subtitleProfile === savedSettings.subtitleProfile &&
                settings.generationCreditsPerMinute ===
                  savedSettings.generationCreditsPerMinute
                  ? '全部设置已保存。'
                  : '有未保存的修改，请点击保存全部设置。'}
              </div>
            )}
          </div>
          <section id="connections">
            <div className="row">
              <h2>服务连接</h2>
              <button
                disabled={!ready || busy}
                onClick={() => void save()}
                className="primary"
              >
                保存全部设置
              </button>
            </div>
            <p className="muted">
              密钥输入后只在本次设置页内暂存；保存成功会清空输入框。测试连接不会保存。
            </p>
            {settings.profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                busy={busy}
                ready={ready}
                saved={isProfileSaved(
                  profile,
                  savedSettings.profiles.find((p) => p.id === profile.id),
                  keys[profile.id],
                )}
                keys={keys}
                models={models}
                feedback={feedback}
                update={update}
                remove={remove}
                test={test}
                setKeys={setKeys}
                clearFeedback={() =>
                  setFeedback((m) => ({ ...m, [profile.id]: '' }))
                }
              />
            ))}
            <div className="row">
              <button disabled={busy || !ready} onClick={() => add('llm')}>
                添加 LLM
              </button>
              <button
                disabled={busy || !ready}
                onClick={() => add('llm', 'codex')}
              >
                {hasCodexConnection(settings)
                  ? '查看本机 Codex'
                  : '连接本机 Codex'}
              </button>
              <button disabled={busy || !ready} onClick={() => add('supadata')}>
                添加 Supadata
              </button>
            </div>
          </section>
          <ModelRouting
            settings={settings}
            setSettings={setSettings}
            busy={busy}
          />
          <SubtitleCosts
            rate={settings.generationCreditsPerMinute}
            onRate={(rate) =>
              setSettings((s) => ({ ...s, generationCreditsPerMinute: rate }))
            }
          />
          <section id="translation">
            <h2>普通翻译</h2>
            <p>
              <strong>当前实现：Chrome 本地 Translator API</strong>
            </p>
            <p>
              首次使用时 Chrome
              可能需要下载语言模型。模型准备完成后在本机翻译，译文按片段缓存。
            </p>
            <p className="muted">
              备选：client=gtx
              免费端点，先保留方案，在真实插件使用反馈后决定是否切换。LLM
              翻译需在逐字稿页面主动点击。
            </p>
          </section>
          <ShortcutSettings />
          <section id="component">
            <h2>本机组件</h2>
            <p>
              Chrome
              按需启动组件以访问系统钥匙串和外部服务，不需要长期运行后台程序。
            </p>
            <p>
              首次安装请按项目 README 的本机组件注册步骤操作，再点击重新连接。
            </p>
            <button disabled={busy} onClick={() => void load()}>
              重新连接
            </button>
            <p className="muted">
              生成字幕需先查看消耗并确认；取消不会提交任务。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>,
);
