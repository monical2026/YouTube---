import { exportText, type Block } from './document';
import { wordDocument } from './word';
export function createDownloadBlob(blocks: Block[], format: string) {
  if (format === 'docx')
    return new Blob([wordDocument(blocks)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  return new Blob([exportText(blocks, format === 'md')], {
    type:
      format === 'md'
        ? 'text/markdown;charset=utf-8'
        : 'text/plain;charset=utf-8',
  });
}
