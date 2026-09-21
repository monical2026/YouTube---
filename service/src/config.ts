import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  unlink,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  settingsSchema,
  defaultSettings,
  type Settings,
} from '@youtube-note/shared';
export const configDirectory = join(
  homedir(),
  'Library',
  'Application Support',
  'YouTubeNote',
);
const filename = join(configDirectory, 'settings.json');
export async function readSettings(): Promise<Settings> {
  try {
    return settingsSchema.parse(JSON.parse(await readFile(filename, 'utf8')));
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return defaultSettings;
    throw new Error('设置文件损坏或无法读取，未覆盖现有文件', { cause: error });
  }
}
export async function writeSettings(settings: Settings) {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  const temporary = join(configDirectory, `settings-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
  await rename(temporary, filename);
}

export async function withSettingsLock<T>(
  action: () => Promise<T>,
): Promise<T> {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  const lockPath = join(configDirectory, 'settings.lock');
  const handle = await open(lockPath, 'wx').catch(() => {
    throw new Error('另一个设置操作尚未完成，请稍后重试');
  });
  try {
    return await action();
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}
