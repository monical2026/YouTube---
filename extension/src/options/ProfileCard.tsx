import type { Dispatch, SetStateAction } from 'react';
import type { Profile } from '@youtube-note/shared';
import { renameProfile } from './profiles';
import { providerByName, providerByUrl, providers } from './providers';
import { ClearableInput } from './ClearableInput';
type Props = {
  profile: Profile;
  busy: boolean;
  ready: boolean;
  saved: boolean;
  clearFeedback: () => void;
  keys: Record<string, string>;
  models: Record<string, string[]>;
  feedback: Record<string, string>;
  update: (id: string, change: Partial<Profile>) => void;
  remove: (id: string) => void;
  test: (profile: Profile, operation: 'models' | 'probe') => Promise<void>;
  setKeys: Dispatch<SetStateAction<Record<string, string>>>;
};
export function ProfileCard({
  profile,
  busy,
  ready,
  saved,
  clearFeedback,
  keys,
  models,
  feedback,
  update,
  remove,
  test,
  setKeys,
}: Props) {
  const provider = providerByUrl(profile.baseUrl);
  const namedProvider = providerByName(profile.name);
  const llm = profile.kind === 'llm';
  const codex = profile.connection === 'codex';
  const change = (fields: Partial<Profile>) => update(profile.id, fields);
  return (
    <fieldset
      id={`profile-${profile.id}`}
      className="card connection-card"
      disabled={busy}
    >
      <div className="row">
        <div>
          <span className="eyebrow">{llm ? '模型服务' : '字幕服务'}</span>
          <h3>{profile.name || '未命名连接'}</h3>
        </div>
        <span className="badge">{saved ? '已保存' : '未保存'}</span>
      </div>
      {llm && (
        <p className="current-model">
          当前模型：<strong>{profile.model || '未选择模型'}</strong>
        </p>
      )}
      {llm && !codex && (
        <label className="field">
          服务商
          <select
            value={provider?.id ?? 'custom'}
            onChange={(event) => {
              const selected = providers.find(
                (p) => p.id === event.target.value,
              );
              change(
                selected
                  ? {
                      name: selected.name,
                      baseUrl: selected.baseUrl,
                      model: selected.model,
                    }
                  : { name: '自定义服务', baseUrl: '', model: '' },
              );
            }}
          >
            <option value="custom">自定义 · OpenAI 兼容接口</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <ClearableInput
        label="连接名称"
        value={profile.name}
        placeholder="例如 DeepSeek、智谱、OpenAI，或自定义名称"
        onValue={(name) => change({ name })}
        onBlur={() => {
          if (llm && namedProvider)
            change(renameProfile(profile, profile.name));
        }}
      />
      {!codex && (
        <>
          <ClearableInput
            label="API 地址（Base URL）"
            type="url"
            value={profile.baseUrl}
            readOnly={!llm}
            placeholder="服务商的 API 根地址"
            onValue={(baseUrl) => change({ baseUrl })}
          />
          {llm && (
            <p className="field-help">
              {provider ? (
                <>
                  {provider.help}{' '}
                  <a href={provider.docs} target="_blank" rel="noreferrer">
                    查看官方说明 ↗
                  </a>
                </>
              ) : (
                '填写服务商提供的 OpenAI 兼容地址。未适配的原生协议（例如 Anthropic Messages）目前不能直接使用。'
              )}
            </p>
          )}
          <ClearableInput
            label="API Key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={keys[profile.id] ?? ''}
            placeholder={
              profile.configured
                ? '已安全保存；留空继续使用'
                : '粘贴此服务的 API Key'
            }
            onValue={(value) => (
              clearFeedback(),
              setKeys((k) => ({ ...k, [profile.id]: value }))
            )}
          />
          <p className="field-help">
            小叉仅清空本次输入；已保存的钥匙串密钥不会被删除。更换 API
            地址后须填写新地址对应的密钥。
          </p>
        </>
      )}
      {codex && (
        <p className="field-help">
          使用本机 Codex 已有的 ChatGPT 登录，无需 API Key 或 API 地址。任务使用
          Codex 账户额度。只处理本次提供的文字，最长等待两分钟。
        </p>
      )}
      {llm && (
        <>
          <ClearableInput
            label="模型名称"
            value={profile.model}
            placeholder={
              codex
                ? '请填写具体模型，例如 gpt-5.5'
                : '获取列表后选择，也可以手动填写'
            }
            onValue={(model) => change({ model })}
          />
          {!!models[profile.id]?.length && (
            <label className="field">
              可用模型
              <select
                value={
                  models[profile.id].includes(profile.model)
                    ? profile.model
                    : ''
                }
                onChange={(e) => change({ model: e.target.value })}
              >
                <option value="">请选择模型</option>
                {models[profile.id].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="field-help">
            {saved
              ? '此连接已保存。'
              : '此连接有未保存的修改，请点击上方“保存全部设置”。'}
          </p>
          <div className="connection-feedback" role="status">
            {feedback[profile.id] ||
              (!ready
                ? '请先连接本机组件。'
                : !profile.model
                  ? '先获取列表或填写模型，再测试连接。'
                  : '获取列表不调用聊天模型；测试模型可能产生少量费用。')}
          </div>
          <div className="row wrap">
            <div className="button-group">
              <button
                disabled={!ready || (!codex && !profile.baseUrl)}
                onClick={() => void test(profile, 'models')}
              >
                {codex ? '检测本机登录' : '获取模型列表'}
              </button>
              <button
                disabled={
                  !ready || !profile.model || (!codex && !profile.baseUrl)
                }
                onClick={() => void test(profile, 'probe')}
              >
                {busy && feedback[profile.id] === '正在测试模型…'
                  ? '测试中，请稍候…'
                  : '测试此模型'}
              </button>
            </div>
            <button
              className="remove-connection"
              onClick={() => remove(profile.id)}
            >
              删除连接
            </button>
          </div>
        </>
      )}
      {!llm && (
        <button
          className="remove-connection"
          onClick={() => remove(profile.id)}
        >
          删除连接
        </button>
      )}
    </fieldset>
  );
}
