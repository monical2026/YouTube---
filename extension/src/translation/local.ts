interface LocalTranslator {
  translate(text: string): Promise<string>;
  destroy(): void;
}
interface TranslatorFactory {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<LocalTranslator>;
}
export async function createLocal(
  onProgress: (value: number) => void,
): Promise<LocalTranslator> {
  const factory = (
    globalThis as typeof globalThis & { Translator?: TranslatorFactory }
  ).Translator;
  if (!factory)
    throw new Error(
      '此页面暂不能使用 Chrome 本地翻译。可打开独立阅读页，或主动选择 LLM 翻译。',
    );
  const options = { sourceLanguage: 'en', targetLanguage: 'zh' };
  if ((await factory.availability(options)) === 'unavailable')
    throw new Error('当前 Chrome 或设备不支持英中本地翻译');
  try {
    return await factory.create({
      ...options,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if ('loaded' in event && typeof event.loaded === 'number')
            onProgress(event.loaded);
        });
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError')
      throw new Error(
        'Chrome 首次准备本地翻译需要一次确认。请点击“继续准备”，完成后会自动翻译；后续打开视频会自动使用。',
        { cause: error },
      );
    throw error;
  }
}
