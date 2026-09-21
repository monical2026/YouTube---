import { providerByName } from '../../extension/src/options/providers';
import { pinnedLookup } from '../../service/src/security/http';
import { describe, it, expect, vi } from 'vitest';
import { defaultSettings, type Profile } from '../../shared/src';
import {
  renameProfile,
  removeProfile,
} from '../../extension/src/options/profiles';
import { withDeadline } from '../../extension/src/options/request';
const profile: Profile = {
  id: 'a',
  kind: 'llm',
  name: '我的 LLM',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  configured: false,
};
describe('服务配置', () => {
  it('识别名称并预填官方地址和普通翻译模型', () => {
    expect(renameProfile(profile, 'DeepSeek')).toMatchObject({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
    });
  });
  it('明确改为另一服务商时更新地址及模型，不残留 DeepSeek 推荐', () => {
    const deepseek = renameProfile(profile, 'DeepSeek');
    expect(
      renameProfile({ ...deepseek, configured: true }, '智谱'),
    ).toMatchObject({
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4.7-flash',
    });
    expect(renameProfile(deepseek, 'ChatGPT')).toMatchObject({
      baseUrl: 'https://api.openai.com/v1',
      model: '',
    });
  });
  it('未知名称不猜测接口，同一服务商保留手选模型', () => {
    const custom = { ...profile, baseUrl: 'https://example.com/v1' };
    expect(renameProfile(custom, '我的翻译服务').baseUrl).toBe(custom.baseUrl);
    const deepseek = {
      ...renameProfile(profile, 'deepseek'),
      model: 'user-selected',
    };
    expect(renameProfile(deepseek, 'DeepSeek').model).toBe('user-selected');
  });
  it('删除连接同时清理相关分工，保留其他连接', () => {
    const result = removeProfile(
      {
        ...defaultSettings,
        profiles: [profile, { ...profile, id: 'b' }],
        translateProfile: 'a',
        analyzeProfile: 'b',
      },
      'a',
    );
    expect(result.profiles.map((p) => p.id)).toEqual(['b']);
    expect(result.translateProfile).toBe('');
    expect(result.analyzeProfile).toBe('b');
  });
  it('没有响应时结束等待，迟到结果不作为成功返回', async () => {
    vi.useFakeTimers();
    try {
      const request = withDeadline(new Promise(() => {}));
      const assertion = expect(request).rejects.toThrow('等待超过 35 秒');
      await vi.advanceTimersByTimeAsync(35000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
  it('成功和失败直接反馈', async () => {
    await expect(withDeadline(Promise.resolve(['model']))).resolves.toEqual([
      'model',
    ]);
    await expect(
      withDeadline(Promise.reject(new Error('HTTP 401'))),
    ).rejects.toThrow('HTTP 401');
  });
});

it('DNS 固定地址兼容 Node 的单地址和多地址回调', () => {
  const address = { address: '8.8.8.8', family: 4 };
  const callback = vi.fn();
  pinnedLookup(address)('example.com', { all: true }, callback);
  expect(callback).toHaveBeenLastCalledWith(null, [address]);
  pinnedLookup(address)('example.com', { all: false }, callback);
  expect(callback).toHaveBeenLastCalledWith(null, address.address, 4);
});

it('本机 Codex 登录连接不误识别为 OpenAI API 配置', () => {
  expect(providerByName('codex')).toBeUndefined();
});
