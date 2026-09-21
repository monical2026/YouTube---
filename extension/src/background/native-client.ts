export async function native(
  operation: string,
  payload: unknown,
): Promise<unknown> {
  try {
    const result: unknown = await chrome.runtime.sendNativeMessage(
      'com.youtube_note.host',
      { id: crypto.randomUUID(), operation, payload },
    );
    if (!result || typeof result !== 'object')
      throw new Error('本机组件返回格式错误');
    if ('error' in result)
      throw new Error(
        typeof result.error === 'string' ? result.error : '本机组件请求失败',
      );
    if (!('data' in result)) throw new Error('本机组件未返回结果');
    return result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : '本机组件不可用';
    if (/host|native messaging|not found/i.test(message))
      throw new Error('尚未安装本机组件。请在设置中查看安装步骤。', {
        cause: error,
      });
    throw new Error(message, { cause: error });
  }
}
