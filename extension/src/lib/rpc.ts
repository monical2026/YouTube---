import { z } from 'zod';
export async function rpc(input: unknown): Promise<unknown> {
  const response: unknown = await chrome.runtime.sendMessage(input);
  const parsed = z
    .object({ data: z.unknown().optional(), error: z.string().optional() })
    .parse(response);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.data;
}
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试';
}
