import { z } from 'zod';
import { rpc } from '../lib/rpc';
export const obsidianTargetSchema = z.object({
  folder: z.string(),
  vault: z.string(),
});
export type ObsidianTarget = z.infer<typeof obsidianTargetSchema>;
const resultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('duplicate'), files: z.array(z.string()) }),
  z.object({
    status: z.literal('saved'),
    filename: z.string(),
    folder: z.string(),
  }),
]);
export async function getObsidianTarget() {
  return obsidianTargetSchema
    .nullable()
    .parse(
      await rpc({ type: 'native', operation: 'obsidianTarget', payload: {} }),
    );
}
export async function chooseObsidianTarget() {
  const result = z
    .union([obsidianTargetSchema, z.object({ cancelled: z.literal(true) })])
    .parse(
      await rpc({ type: 'native', operation: 'obsidianChoose', payload: {} }),
    );
  return 'cancelled' in result ? null : result;
}
export async function sendToObsidian(payload: {
  videoId: string;
  title: string;
  markdown: string;
  copy: boolean;
}) {
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 7_000_000)
    throw new Error('内容过大，请减少所选内容后导出，或使用下载文件');
  return resultSchema.parse(
    await rpc({ type: 'native', operation: 'obsidianExport', payload }),
  );
}
export function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('文件生成失败'));
    reader.onerror = () => reject(new Error('文件生成失败'));
    reader.readAsDataURL(blob);
  });
}
