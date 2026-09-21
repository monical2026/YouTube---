import { expect, it, vi } from 'vitest';
import { createRuntimeSession } from '../../extension/src/content/runtime-session';

it('扩展失效同步抛错时停止会话，后续播放轮询不再发送', async () => {
  const cleanup = vi.fn();
  const send = vi.fn(() => {
    throw new Error('Extension context invalidated.');
  });
  const session = createRuntimeSession(() => 'extension-id', send, cleanup);
  await expect(session.send({ type: 'context' })).resolves.toBeUndefined();
  await session.send({ type: 'context' });
  expect(send).toHaveBeenCalledTimes(1);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(session.active()).toBe(false);
});
it('异步发送失败也清理且仅清理一次', async () => {
  const cleanup = vi.fn();
  const session = createRuntimeSession(
    () => 'id',
    () => Promise.reject(new Error('disconnected')),
    cleanup,
  );
  await session.send({ type: 'invalidate' });
  session.stop();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
it.each([
  () => undefined,
  () => {
    throw new Error('invalidated');
  },
])('运行时 ID 不可用时不再访问消息接口', async (id) => {
  const send = vi.fn();
  const cleanup = vi.fn();
  const session = createRuntimeSession(id, send, cleanup);
  await session.send({});
  expect(send).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
it('正常会话持续发送，显式停止后不再发送', async () => {
  const send = vi.fn(() => Promise.resolve());
  const cleanup = vi.fn();
  const session = createRuntimeSession(() => 'id', send, cleanup);
  await session.send({ type: 'context' });
  await session.send({ type: 'invalidate' });
  expect(session.active()).toBe(true);
  session.stop();
  await session.send({});
  expect(send).toHaveBeenCalledTimes(2);
  expect(cleanup).toHaveBeenCalledTimes(1);
});
