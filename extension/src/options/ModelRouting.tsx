import type { Dispatch, SetStateAction } from 'react';
import { profileLabel } from './profiles';
import type { Settings } from '@youtube-note/shared';
export function ModelRouting({
  settings,
  setSettings,
  busy,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  busy: boolean;
}) {
  return (
    <section id="routing">
      <h2>模型分工</h2>
      {(
        [
          ['translateProfile', 'LLM 翻译', 'llm'],
          ['analyzeProfile', '中文摘要与视频脉络', 'llm'],
          ['subtitleProfile', '字幕服务', 'supadata'],
        ] as const
      ).map(([field, label, kind]) => (
        <label className="field" key={field}>
          {label}
          <select
            disabled={busy}
            value={settings[field]}
            onChange={(e) =>
              setSettings({ ...settings, [field]: e.target.value })
            }
          >
            <option value="">请选择</option>
            {settings.profiles
              .filter((p) => p.kind === kind)
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {profileLabel(p)}
                </option>
              ))}
          </select>
        </label>
      ))}
      <p className="muted">
        AI
        输出固定为中文，不随逐字稿显示模式变化。个人理解与疑问不会自动提交给模型。
      </p>
    </section>
  );
}
