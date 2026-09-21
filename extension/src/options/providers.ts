export const providers = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    aliases: ['deepseek', '深度求索'],
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    help: '普通翻译可先使用 deepseek-flash；模型可随时更换。',
    docs: 'https://api-docs.deepseek.com/',
  },
  {
    id: 'zhipu',
    name: '智谱',
    aliases: ['智谱', '智谱ai', 'zhipu', 'bigmodel', 'glm'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.7-flash',
    help: '先提供官方免费模型 glm-4.7-flash。这里使用通用 API，不是 Coding 套餐地址。',
    docs: 'https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    aliases: ['openai', 'chatgpt', 'chat gpt', 'gpt'],
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    help: '请获取模型列表后选择支持聊天的文本模型。ChatGPT / Codex 订阅不等于 API 额度。',
    docs: 'https://platform.openai.com/docs/models',
  },
] as const;
export function providerByName(name: string) {
  const normalized = name.trim().toLowerCase();
  return providers.find((p) => p.aliases.some((alias) => alias === normalized));
}
export function providerByUrl(baseUrl: string) {
  return providers.find((p) => p.baseUrl === baseUrl.replace(/\/$/, ''));
}
