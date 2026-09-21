// 重新加载扩展不会自动移除旧页面脚本，所有运行时访问共用失效边界。
export function createRuntimeSession(
  runtimeId: () => string | undefined,
  sendMessage: (message: unknown) => Promise<unknown>,
  cleanup: () => void,
) {
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    cleanup();
  }
  function active(): boolean {
    if (stopped) return false;
    try {
      if (runtimeId()) return true;
    } catch {
      // 已失效的运行时属性访问也可能同步抛错。
    }
    stop();
    return false;
  }
  async function send(message: unknown): Promise<void> {
    if (!active()) return;
    try {
      await sendMessage(message);
    } catch {
      // 同步抛错与异步拒绝都终止旧会话，避免持续轮询失效连接。
      stop();
    }
  }
  return { active, send, stop };
}
