import { it, expect } from 'vitest';
import {
  defaultSettings,
  validateCodexConnections,
  type Profile,
} from '../../shared/src';
import {
  profileLabel,
  hasCodexConnection,
} from '../../extension/src/options/profiles';
const profile: Profile = {
  id: 'local',
  name: '本机 Codex',
  kind: 'llm',
  connection: 'codex',
  baseUrl: '',
  model: 'gpt-5.5',
  configured: false,
};
it('模型分工明确显示模型，修改后立即更新标签', () => {
  expect(profileLabel(profile)).toBe('本机 Codex · gpt-5.5');
  expect(profileLabel({ ...profile, model: 'gpt-6-astra' })).toBe(
    '本机 Codex · gpt-6-astra',
  );
  expect(profileLabel({ ...profile, model: '' })).toBe(
    '本机 Codex · 未选择模型',
  );
});
it('识别已有本机连接，拒绝保存重复连接或空模型', () => {
  expect(hasCodexConnection({ ...defaultSettings, profiles: [profile] })).toBe(
    true,
  );
  expect(hasCodexConnection(defaultSettings)).toBe(false);
  expect(() => validateCodexConnections([profile])).not.toThrow();
  expect(() =>
    validateCodexConnections([profile, { ...profile, id: 'other' }]),
  ).toThrow('重复');
  expect(() => validateCodexConnections([{ ...profile, model: '' }])).toThrow(
    '模型名称',
  );
});
