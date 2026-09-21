import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const responseSchema = z.object({
  secret: z.string().optional(),
  saved: z.boolean().optional(),
  missing: z.boolean().optional(),
  error: z.string().optional(),
});
export async function credential(
  operation: 'get' | 'set',
  account: string,
  secret?: string,
): Promise<string | undefined> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(account)) throw new Error('凭据标识无效');
  const executable = fileURLToPath(
    new URL('./keychain-bridge', import.meta.url),
  );
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('钥匙串操作超时，请完成系统授权后重试'));
    }, 120000);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 65536) {
        child.kill();
        reject(new Error('钥匙串响应过大'));
      }
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('无法启动钥匙串组件，请重新构建安装'));
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const result = responseSchema.parse(JSON.parse(output));
        if (result.error) throw new Error(result.error);
        resolve(result.secret);
      } catch {
        reject(new Error('钥匙串操作未完成，请检查系统授权'));
      }
    });
    child.stdin.on('error', () => reject(new Error('钥匙串连接中断')));
    child.stdin.end(JSON.stringify({ operation, account, secret }));
  });
}
