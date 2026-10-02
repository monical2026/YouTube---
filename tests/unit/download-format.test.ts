import { expect, it } from 'vitest';
import { createDownloadBlob } from '../../extension/src/export/download';
import { requestSchema } from '../../shared/src';
it('Markdown 使用对应 MIME 和 md 文件名，TXT 保持纯文本类型', async () => {
  const blocks = [{heading:true,text:'视频学习'},{text:'正文'}];
  const markdown = createDownloadBlob(blocks,'md');
  expect(markdown.type).toBe('text/markdown;charset=utf-8');
  expect(await markdown.text()).toContain('# 视频学习');
  const dataUrl = `data:${markdown.type};base64,${Buffer.from(await markdown.arrayBuffer()).toString('base64')}`;
  expect(requestSchema.safeParse({type:'downloadExport',filename:'视频.md',dataUrl}).success).toBe(true);
  expect(createDownloadBlob(blocks,'txt').type).toBe('text/plain;charset=utf-8');
});
