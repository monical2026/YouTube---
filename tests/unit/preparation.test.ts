import { beforeEach, expect, it, vi } from 'vitest';
import { recordSchema, segmentSchema } from '../../shared/src';
const state = vi.hoisted(() => ({ effects: [] as (() => void)[] }));
vi.mock('../../extension/node_modules/react', () => ({
  useRef: (current: unknown) => ({ current }),
  useEffect: (fn: () => void) => state.effects.push(fn),
}));
import { usePreparation } from '../../extension/src/ui/usePreparation';
const empty = recordSchema.parse({
  videoId: 'abcdefghijk',
  title: 'Test',
  revision: 0,
  segments: [],
  notes: [],
  analysis: null,
});
beforeEach(() => {
  state.effects.length = 0;
});
it('打开无缓存视频自动抓字幕，重复 effect 不重复提交', () => {
  const getCaptions = vi.fn();
  const translateLocal = vi.fn();
  usePreparation({
    record: empty,
    videoId: empty.videoId,
    busy: '',
    quickId: null,
    mode: 'bilingual',
    getCaptions,
    translateLocal,
  });
  state.effects[0]();
  state.effects[0]();
  expect(getCaptions).toHaveBeenCalledTimes(1);
  expect(translateLocal).not.toHaveBeenCalled();
});
it.each(['chinese', 'bilingual'] as const)(
  '有字幕且选择 %s 时自动本地翻译一次',
  (mode) => {
    const translateLocal = vi.fn();
    usePreparation({
      record: {
        ...empty,
        segments: [
          segmentSchema.parse({
            id: 's',
            original: 'hello',
            startMs: 0,
            endMs: 1000,
          }),
        ],
      },
      videoId: empty.videoId,
      busy: '',
      quickId: null,
      mode,
      getCaptions: vi.fn(),
      translateLocal,
    });
    state.effects[0]();
    state.effects[0]();
    expect(translateLocal).toHaveBeenCalledTimes(1);
  },
);
it('原文模式不启动翻译，快捷窗口也不争抢本地翻译任务', () => {
  const translateLocal = vi.fn();
  const record = {
    ...empty,
    segments: [
      segmentSchema.parse({
        id: 's',
        original: 'hello',
        startMs: 0,
        endMs: 1000,
      }),
    ],
  };
  for (const [mode, quickId] of [
    ['original', null],
    ['bilingual', 'note'],
  ] as const) {
    usePreparation({
      record,
      videoId: empty.videoId,
      busy: '',
      quickId,
      mode,
      getCaptions: vi.fn(),
      translateLocal,
    });
  }
  state.effects.forEach((fn) => fn());
  expect(translateLocal).not.toHaveBeenCalled();
});
it('历史阅读没有播放上下文时，不自动获取字幕或翻译', () => {
  const getCaptions = vi.fn(), translateLocal = vi.fn();
  usePreparation({ record: empty, videoId: undefined, mode: 'bilingual', busy: '', quickId: null, getCaptions, translateLocal });
  state.effects[0]();
  expect(getCaptions).not.toHaveBeenCalled();
  expect(translateLocal).not.toHaveBeenCalled();
});
