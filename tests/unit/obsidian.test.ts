import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateTarget, writeObsidian } from '../../service/src/obsidian';
import { nativeRequestSchema, requestSchema } from '../../shared/src';
const roots: string[] = [];
async function vault() {
  const root = await mkdtemp(join(tmpdir(), 'youtube-note-export-')); roots.push(root);
  await mkdir(join(root, '.obsidian'));
  const folder = join(root, '视频待整理'); await mkdir(folder);
  return (await validateTarget(folder)).folder;
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const input = {videoId:'abcdefghijk',title:'课程',markdown:'# 视频脉络\n正文\n# 笔记\n个人疑问',copy:false};
it('导出为单个文件，重复请求先提示，副本不覆盖手改内容', async () => {
  const folder = await vault();
  const first = await writeObsidian(folder, input);
  expect(first.status).toBe('saved');
  const duplicate = await writeObsidian(folder, input);
  expect(duplicate.status).toBe('duplicate');
  expect(await readdir(folder)).toHaveLength(1);
  await writeObsidian(folder, {...input, markdown:'副本内容', copy:true});
  await writeObsidian(folder, {...input, copy:true});
  expect(await readFile(join(folder,'课程 [abcdefghijk].md'),'utf8')).toBe(input.markdown);
  expect(await readFile(join(folder,'课程 [abcdefghijk]（副本）.md'),'utf8')).toBe('副本内容');
  expect(await readdir(folder)).toContain('课程 [abcdefghijk]（副本 2）.md');
});
it('并发导出不会覆盖，改标题仍识别同一视频', async () => {
  const folder = await vault();
  const result = await Promise.all([writeObsidian(folder,input),writeObsidian(folder,input)]);
  expect(result.map(r=>r.status).sort()).toEqual(['duplicate','saved']);
  expect((await writeObsidian(folder,{...input,title:'新标题'})).status).toBe('duplicate');
});
it('拒绝知识库外路径，标题路径字符不能跨目录，目标软链接变化不写入', async () => {
  const folder = await vault();
  await expect(validateTarget(tmpdir())).rejects.toThrow('Obsidian');
  const result = await writeObsidian(folder,{...input,title:'../../课程/恶意'});
  expect(result.status).toBe('saved');
  expect((await readdir(folder))[0]).not.toContain('/');
  const link = join(roots[0], 'link'); await symlink(folder,link);
  await expect(writeObsidian(link,input)).rejects.toThrow('已变化');
});
it('下载协议只接受生成文档和安全文件名，Native 导出操作可解析', () => {
  expect(requestSchema.safeParse({type:'downloadExport',filename:'课程.md',dataUrl:'data:text/plain;charset=utf-8;base64,YQ=='}).success).toBe(true);
  for (const filename of ['../课程.md','课程.exe']) expect(requestSchema.safeParse({type:'downloadExport',filename,dataUrl:'data:text/plain;base64,YQ=='}).success).toBe(false);
  expect(requestSchema.safeParse({type:'downloadExport',filename:'课程.md',dataUrl:'https://example.com/private'}).success).toBe(false);
  expect(nativeRequestSchema.safeParse({id:'1',operation:'obsidianExport',payload:input}).success).toBe(true);
});

it('B 站 Obsidian 导出接受安全平台键，分 P 分别保存且不覆盖 YouTube 文件', async () => {
  const folder=await vault();
  await writeObsidian(folder,input);
  const id='bilibili-BV1qW411N7FU-40809285-p2';
  expect((await writeObsidian(folder,{...input,videoId:id})).status).toBe('saved');
  expect((await writeObsidian(folder,{...input,videoId:id})).status).toBe('duplicate');
  expect(await readdir(folder)).toHaveLength(2);
  await expect(writeObsidian(folder,{...input,videoId:'../escape'})).rejects.toThrow();
});
