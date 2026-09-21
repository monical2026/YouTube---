import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

// 仅重用先前公开性质的人工样本，不读取用户笔记或凭据。
const local = JSON.parse(await readFile('artifacts/probes/local-translation-results.json', 'utf8'));
const results = [];
for (const sample of local.samples) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't', q: sample.source }).toString();
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!response.ok) {
      const failure = { id: sample.id, error: `HTTP ${response.status}`, status: response.status,
        retryAfter: response.headers.get('retry-after') };
      results.push(failure);
      console.log(JSON.stringify(failure));
      // 限流或拒绝访问时停止本轮，不轮换地址或密集重试。
      if (response.status === 429 || response.status === 403) break;
      continue;
    }
    const body = await response.json();
    if (!Array.isArray(body) || !Array.isArray(body[0]) || body[0].length === 0) {
      throw new Error('响应缺少翻译分段');
    }
    const translation = body[0].map((part) => {
      if (!Array.isArray(part) || typeof part[0] !== 'string') throw new Error('翻译分段格式异常');
      return part[0];
    }).join('');
    const result = { ...sample, localElapsedMs: sample.elapsedMs, gtxTranslation: translation,
      gtxElapsedMs: Math.round(performance.now() - startedAt), status: response.status };
    delete result.elapsedMs;
    results.push(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    const result = { id: sample.id, error: error instanceof Error ? error.message : '未知请求错误' };
    results.push(result);
    console.log(JSON.stringify(result));
  }
}
await writeFile('artifacts/probes/gtx-comparison.json', JSON.stringify({
  executedAt: new Date().toISOString(), endpoint: 'translate.googleapis.com/translate_a/single',
  parameters: { client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't' }, results,
}, null, 2) + '\n');
if (results.some((result) => 'error' in result)) process.exitCode = 1;
