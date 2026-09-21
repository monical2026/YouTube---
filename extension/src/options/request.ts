// 页面等待有上限；超时不等于服务端取消，不能自动重复计费请求。
export async function withDeadline<T>(
  request: Promise<T>,
  milliseconds = 35000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `等待超过 ${milliseconds / 1000} 秒，尚未确认结果。请检查连接；服务端可能仍在处理，未自动重试。`,
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
