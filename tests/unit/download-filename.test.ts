import { expect, it } from 'vitest';
import { exportDownloadUrl, exportDownloadFilename } from '../../extension/src/background/download-export';
it.each(['md','txt','docx'])('保留视频标题及 %s 后缀，不采用浏览器的下载默认名', format => {
  const filename = `视频标题 #1 与 100%（测试）.${format}`;
  const url = exportDownloadUrl('data:text/plain;base64,YQ==',filename);
  expect(exportDownloadFilename({url,byExtensionId:'ours'},'ours')).toBe(filename);
  expect(url.slice(url.indexOf(',') + 1)).toBe('YQ==');
});
it('同内容不同视频名称互不串用，其他扩展下载与不安全文件名不修改', () => {
  const one = exportDownloadUrl('data:text/markdown;base64,YQ==','视频一.md');
  const two = exportDownloadUrl('data:text/markdown;base64,YQ==','视频二.md');
  expect(exportDownloadFilename({url:one,byExtensionId:'ours'},'ours')).toBe('视频一.md');
  expect(exportDownloadFilename({url:two,byExtensionId:'ours'},'ours')).toBe('视频二.md');
  expect(exportDownloadFilename({url:one,byExtensionId:'other'},'ours')).toBeUndefined();
  expect(exportDownloadFilename({url:exportDownloadUrl('data:text/plain;base64,YQ==','../x.md'),byExtensionId:'ours'},'ours')).toBeUndefined();
});
