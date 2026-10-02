import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  realpath,
  stat,
  open,
  readdir,
  unlink,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { configDirectory } from './config';
const execute = promisify(execFile);
const targetSchema = z.object({ folder: z.string(), vault: z.string() });
const exportSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/),
  title: z.string().max(1000),
  markdown: z.string().max(6_000_000),
  copy: z.boolean().default(false),
});
export async function validateTarget(folder: string) {
  const canonical = await realpath(folder);
  if (!(await stat(canonical)).isDirectory()) throw new Error('目标不是文件夹');
  let ancestor = canonical;
  while (true) {
    try {
      if ((await stat(join(ancestor, '.obsidian'))).isDirectory())
        return { folder: canonical, vault: ancestor };
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
    const parent = dirname(ancestor);
    if (parent === ancestor)
      throw new Error(
        '请选择 Obsidian 知识库或其中的文件夹（知识库需包含 .obsidian 文件夹）',
      );
    ancestor = parent;
  }
}
export function safeTitle(title: string) {
  return (
    title
      .split('')
      .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
      .join('')
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/^[. ]+|[. ]+$/g, '')
      .slice(0, 65) || '视频学习'
  );
}
export async function writeObsidian(folder: string, input: unknown) {
  const request = exportSchema.parse(input);
  const target = await validateTarget(folder);
  if (target.folder !== folder)
    throw new Error('目标文件夹位置已变化，请重新选择');
  const files = await readdir(folder);
  const identity = `[${request.videoId}]`;
  const existing = files.filter(
    (file) => file.includes(identity) && file.endsWith('.md'),
  );
  if (existing.length && !request.copy)
    return { status: 'duplicate', files: existing.slice(0, 5) };
  const stem = `${safeTitle(request.title)} ${identity}`;
  for (let number = existing.length ? 1 : 0; number < 10000; number++) {
    const suffix =
      number === 0 ? '' : number === 1 ? '（副本）' : `（副本 ${number}）`;
    const filename = `${stem}${suffix}.md`;
    let file;
    try {
      file = await open(join(folder, filename), 'wx', 0o600);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        if (!request.copy) return { status: 'duplicate', files: [filename] };
        continue;
      }
      throw error;
    }
    try {
      await file.writeFile(request.markdown, 'utf8');
      await file.sync();
    } catch (error) {
      await unlink(join(folder, filename));
      throw error;
    } finally {
      await file.close();
    }
    return { status: 'saved', filename, folder };
  }
  throw new Error('同名副本过多，请更换导出文件夹');
}
export async function obsidian(operation: string, payload: unknown) {
  const settingsFile = join(configDirectory, 'obsidian-target.json');
  if (operation === 'obsidianChoose') {
    if (process.platform !== 'darwin')
      throw new Error('当前目录选择仅支持 macOS');
    let stdout: string;
    try {
      ({ stdout } = await execute(
        '/usr/bin/osascript',
        [
          '-e',
          'POSIX path of (choose folder with prompt "选择 Obsidian 知识库或其中用于存放视频笔记的文件夹")',
        ],
        { timeout: 120000, maxBuffer: 16384 },
      ));
    } catch (error) {
      if (error instanceof Error && error.message.includes('-128'))
        return { cancelled: true };
      throw new Error('选择文件夹失败或超时，请重试', { cause: error });
    }
    const target = await validateTarget(stdout.trim());
    await mkdir(configDirectory, { recursive: true, mode: 0o700 });
    const temporary = join(configDirectory, `obsidian-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(target), { mode: 0o600 });
    await rename(temporary, settingsFile);
    return target;
  }
  let target;
  try {
    target = targetSchema.parse(
      JSON.parse(await readFile(settingsFile, 'utf8')),
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      if (operation === 'obsidianTarget') return null;
      throw new Error('请先选择 Obsidian 保存文件夹', { cause: error });
    }
    throw new Error('Obsidian 目录配置无法读取，请重新选择文件夹', {
      cause: error,
    });
  }
  if (operation === 'obsidianTarget') return target;
  return writeObsidian(target.folder, payload);
}
