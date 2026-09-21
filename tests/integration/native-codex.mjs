import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
// 通过实际已注册组件验证接法；不读取密钥，也不自动保存测试配置。
const [extensionId, operation = 'models', model = ''] = process.argv.slice(2);
if (
  !/^[a-p]{32}$/.test(extensionId ?? '') ||
  !['models', 'probe'].includes(operation)
)
  throw new Error('请提供扩展 ID 和 models 或 probe');
const packet = Buffer.from(
  JSON.stringify({
    id: crypto.randomUUID(),
    operation,
    payload: {
      profile: {
        id: 'codex-integration',
        name: '本机 Codex',
        kind: 'llm',
        connection: 'codex',
        baseUrl: '',
        model,
        configured: false,
      },
    },
  }),
);
const size = Buffer.alloc(4);
size.writeUInt32LE(packet.length);
const child = spawn(
  join(homedir(), 'Library/Application Support/YouTubeNote/launch.sh'),
  [`chrome-extension://${extensionId}/`],
  { stdio: ['pipe', 'pipe', 'ignore'] },
);
let buffer = Buffer.alloc(0);
const timer = setTimeout(() => {
  child.kill('SIGKILL');
  process.exitCode = 1;
  console.log('本机集成调用超时');
}, 135000);
child.on('error', () => {
  clearTimeout(timer);
  process.exitCode = 1;
  console.log('本机组件启动失败');
});
child.stdout.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  if (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE()) {
    clearTimeout(timer);
    const response = JSON.parse(
      buffer.subarray(4, 4 + buffer.readUInt32LE()).toString(),
    );
    console.log(JSON.stringify(response));
    if (response.error) process.exitCode = 1;
    child.stdin.end();
    child.kill();
  }
});
child.stdin.write(Buffer.concat([size, packet]));
