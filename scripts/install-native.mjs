import { readFile, writeFile, mkdir, copyFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
const extensionId = process.argv[2];
if (!/^[a-p]{32}$/.test(extensionId ?? ''))
  throw new Error(
    '用法：pnpm native:install 扩展程序ID（在 chrome://extensions 查看）',
  );
const directory = join(
  homedir(),
  'Library',
  'Application Support',
  'YouTubeNote',
);
const registrationDirectory = join(
  homedir(),
  'Library',
  'Application Support',
  'Google',
  'Chrome',
  'NativeMessagingHosts',
);
await mkdir(directory, { recursive: true, mode: 0o700 });
await mkdir(registrationDirectory, { recursive: true });
for (const file of ['host.mjs', 'keychain-bridge'])
  await copyFile(resolve('service/dist', file), join(directory, file));
// 固定本机已验证的 Node 路径，Chrome 启动时不依赖交互 Shell 的 PATH。
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
await writeFile(
  join(directory, 'launch.sh'),
  `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(join(directory, 'host.mjs'))} "$@"\n`,
  { mode: 0o700 },
);
await chmod(join(directory, 'keychain-bridge'), 0o700);
const registration = {
  name: 'com.youtube_note.host',
  description: 'YouTube 学习笔记钥匙串组件',
  path: join(directory, 'launch.sh'),
  type: 'stdio',
  allowed_origins: [`chrome-extension://${extensionId}/`],
};
await writeFile(
  join(directory, 'host-registration.json'),
  JSON.stringify(registration, null, 2),
  { mode: 0o600 },
);
await writeFile(
  join(registrationDirectory, 'com.youtube_note.host.json'),
  JSON.stringify(registration, null, 2),
  { mode: 0o600 },
);
await readFile(join(directory, 'host.mjs'));
process.stdout.write(
  '本机组件已注册。回到扩展设置页，点击重新连接。未读取或写入任何 API key。\n',
);
