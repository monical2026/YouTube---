import { it, expect } from 'vitest';
import { profileSchema, type Profile } from '../../shared/src';
import { isProfileSaved } from '../../extension/src/options/save-state';
import {
  codexArguments,
  codexResponse,
} from '../../service/src/providers/codex';
const profile: Profile = {
  id: 'a',
  name: 'DeepSeek',
  kind: 'llm',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  configured: true,
};
it('未改配置的测试不改变已保存状态', () =>
  expect(isProfileSaved({ ...profile }, profile)).toBe(true));
it('修改名称、模型、地址或临时密钥才显示未保存', () => {
  for (const change of [
    { name: '另一名称' },
    { model: 'another' },
    { baseUrl: 'https://example.com' },
  ])
    expect(isProfileSaved({ ...profile, ...change }, profile)).toBe(false);
  expect(isProfileSaved(profile, profile, 'fixture')).toBe(false);
});
it('保存成功更新基准后同步已保存，改回原值也恢复已保存', () => {
  const changed = { ...profile, model: 'new' };
  expect(isProfileSaved(changed, changed)).toBe(true);
  expect(isProfileSaved(profile, profile, '')).toBe(true);
  expect(isProfileSaved(profile, undefined)).toBe(false);
});
it('旧配置兼容默认 API，本机 Codex 不要求 URL', () => {
  expect(profileSchema.parse(profile).connection).toBeUndefined();
  expect(
    profileSchema.safeParse({ ...profile, connection: 'codex', baseUrl: '' })
      .success,
  ).toBe(true);
  expect(profileSchema.safeParse({ ...profile, baseUrl: '' }).success).toBe(
    false,
  );
});
it('Codex 参数禁用 shell 与插件，使用只读权限和标准输入', () => {
  const args = codexArguments('gpt-5.5');
  expect(args).toContain('read-only');
  expect(args).toContain('shell_tool');
  expect(args).toContain('plugins');
  expect(args.at(-1)).toBe('-');
  expect(args).toContain('--model');
  expect(args).toContain('gpt-5.5');
  expect(() => codexArguments('')).toThrow('选择明确');
  expect(() => codexArguments('--bad model')).toThrow();
});
it('Codex 只提取最终文本，失败不冒充成功', () => {
  expect(
    codexResponse(
      '{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}',
    ),
  ).toBe('OK');
  expect(() => codexResponse('{"type":"turn.failed"}')).toThrow();
  expect(() => codexResponse('{"type":"turn.completed"}')).toThrow();
});
