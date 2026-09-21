import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
export function pinnedLookup(selected: {
  address: string;
  family: number;
}): LookupFunction {
  return (_host, options, callback) => {
    // Node 自动选择地址族时要求地址数组；返回单个字符串会在联网前失败。
    if (options.all) callback(null, [selected]);
    else callback(null, selected.address, selected.family);
  };
}
export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // 仅允许全局单播 IPv6，拒绝映射地址和所有本机／链路地址。
  return (
    isIP(ip) === 6 &&
    /^[23][0-9a-f]{3}:/.test(ip) &&
    !ip.startsWith('2001:db8:')
  );
}
export function serviceUrl(base: string, path: string): URL {
  const url = new URL(base);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error('服务地址必须是无账号、查询参数的 HTTPS 地址');
  if (url.port && url.port !== '443')
    throw new Error('第一版仅支持 HTTPS 443 端口');
  url.pathname =
    url.pathname.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  return url;
}
export async function requestJson(
  url: URL,
  headers: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error('不允许请求本机或私有网络地址');
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        lookup: pinnedLookup(selected),
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
          if (text.length > 8 * 1024 * 1024) {
            req.destroy();
            reject(new Error('服务响应超过限制'));
          }
        });
        response.on('error', () => reject(new Error('服务响应中断')));
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `外部服务返回 HTTP ${status}${status === 401 ? '，API key 无效或已过期，请重新填写' : status === 402 ? '，账户余额不足，请检查服务账户' : status === 403 ? '，此账户没有访问权限' : status === 404 ? '，请检查 API 根地址或模型名称，不能填写平台登录网址' : status === 429 ? '，请求过多，请稍后重试' : ''}`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error('外部服务未返回有效 JSON'));
          }
        });
      },
    );
    req.setTimeout(90000, () => req.destroy(new Error('外部服务请求超时')));
    req.on('error', () =>
      reject(new Error('外部服务连接失败或超时，请检查网络与服务地址')),
    );
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
