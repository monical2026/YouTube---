import { beforeEach, expect, it, vi } from 'vitest';
import {
  recordSchema,
  parseAnalysisRequest,
  segmentSchema,
  type VideoRecord,
  type Analysis,
} from '../../shared/src';
import { videoActions } from '../../extension/src/ui/videoActions';
import { rpc } from '../../extension/src/lib/rpc';
vi.mock('../../extension/src/lib/rpc', () => ({
  rpc: vi.fn(),
  errorText: (e: Error) => e.message,
}));
const mockedRpc = vi.mocked(rpc);
const segment = (id: string, original = 'hello') =>
  segmentSchema.parse({
    id,
    original,
    startMs: Number(id) * 1000,
    endMs: (Number(id) + 1) * 1000,
  });
function setup(segments = [segment('0')], analysis: Analysis | null = null) {
  let record: VideoRecord = recordSchema.parse({
    videoId: 'abcdefghijk',
    title: 'Test',
    revision: 0,
    segments,
    notes: [],
    analysis,
  });
  const generation = { current: 1 };
  const setCandidate = vi.fn();
  const setError = vi.fn();
  const actions = videoActions({
    record,
    context: {
      videoId: record.videoId,
      title: 'Test',
      currentMs: 0,
      durationMs: 100000,
      live: false,
      playing: true,
      ad: false,
      tracks: [],
    },
    tabId: 1,
    mutate: async (change) => {
      record = change(record);
      return record;
    },
    setError,
    busy: '',
    generation,
    jobLock: { current: null },
    setBusy: vi.fn(),
    setProgress: vi.fn(),
    setCandidate,
  });
  return {
    actions,
    read: () => record,
    setCandidate,
    setError,
    generation,
    update: (change: (r: VideoRecord) => VideoRecord) => {
      record = change(record);
    },
  };
}
beforeEach(() => vi.clearAllMocks());
it('LLM 当前段翻译成功立即保存，无需二次应用', async () => {
  mockedRpc.mockResolvedValue([{ id: '0', text: '你好' }]);
  const state = setup();
  await state.actions.llmTranslate();
  expect(state.read().segments[0].translated).toBe('你好');
  expect(state.setCandidate).toHaveBeenLastCalledWith(null);
});
it('全片翻译分批保存，手改段落仅保留对照结果', async () => {
  mockedRpc.mockImplementation(async (input) => {
    const payload = input as { payload: { segments: { id: string }[] } };
    return payload.payload.segments.map((s) => ({ id: s.id, text: '译文' }));
  });
  const segments = Array.from({ length: 23 }, (_, i) => segment(String(i)));
  segments[0] = { ...segments[0], manual: true, translated: '我的修改' };
  const state = setup(segments);
  await state.actions.llmTranslate('all');
  expect(mockedRpc).toHaveBeenCalledTimes(2);
  expect(state.read().segments[0].translated).toBe('我的修改');
  expect(
    state
      .read()
      .segments.slice(1)
      .every((s) => s.translated === '译文'),
  ).toBe(true);
  expect(state.setCandidate).toHaveBeenLastCalledWith([
    { id: '0', text: '译文', revision: 0 },
  ]);
});
it('长视频实际请求通过服务契约，分批整理覆盖全部来源且合并结果', async () => {
  const seen: string[] = [];
  mockedRpc.mockImplementation(async (input) => {
    const parsed = parseAnalysisRequest(
      (input as { payload: unknown }).payload,
    );
    expect(parsed.segments.every((s) => s.original.length > 0)).toBe(true);
    if (
      (input as { payload: { task: string } }).payload.task === 'reviewAnalysis'
    )
      return {
        ...(input as { payload: { analysis: Analysis } }).payload.analysis,
        summary: '全片简短总览',
      };
    const { segments } = (
      input as {
        payload: { segments: { id: string; startMs: number; endMs: number }[] };
      }
    ).payload;
    seen.push(...segments.map((s) => s.id));
    return {
      formatVersion: 3,
      summary: `部分 ${segments[0].id}`,
      topics: [
        {
          title: '主题',
          startMs: segments[0].startMs,
          endMs: segments.at(-1)!.endMs,
          introduction: '介绍',
          problem: '问题',
          application: '用途',
          clipReason: '理由',
        },
      ],
      quotes: [],
      methods: [],
    };
  });
  const segments = Array.from({ length: 100 }, (_, i) =>
    segment(String(i), 'a'.repeat(2100)),
  );
  const state = setup(segments);
  await state.actions.analyze();
  expect(mockedRpc.mock.calls.length).toBeGreaterThan(1);
  expect(seen).toEqual(segments.map((s) => s.id));
  expect(state.read().analysis?.topics.at(-1)?.endMs).toBe(100000);
  expect(state.read().analysis?.summary).toBe('全片简短总览');
  expect(state.setError).not.toHaveBeenCalledWith(
    expect.stringContaining('超出'),
  );
});
it('翻译期间切换视频，迟到结果不写入新界面', async () => {
  const state = setup();
  mockedRpc.mockImplementation(async () => {
    state.generation.current++;
    return [{ id: '0', text: '旧结果' }];
  });
  await state.actions.llmTranslate();
  expect(state.read().segments[0].translated).toBe('');
});

const oldAnalysis: Analysis = {
  summary: '原有总结',
  topics: [],
  quotes: [],
  methods: [],
};
const newAnalysis: Analysis = {
  formatVersion: 3,
  summary: '新总结',
  topics: [],
  quotes: [],
  methods: [],
};
it('全片复核失败不覆盖旧脉络，也不提交第二次复核', async () => {
  const state = setup(undefined, oldAnalysis);
  mockedRpc.mockImplementation(async (input) => {
    const task = (input as { payload: { task: string } }).payload.task;
    if (task === 'reviewAnalysis') throw new Error('复核失败');
    return newAnalysis;
  });
  await state.actions.analyze();
  expect(state.read().analysis).toEqual(oldAnalysis);
  expect(mockedRpc).toHaveBeenCalledTimes(2);
  expect(state.setError).toHaveBeenLastCalledWith('复核失败');
});
it('全片复核中切换视频，迟到结果不能覆盖旧脉络', async () => {
  const state = setup(undefined, oldAnalysis);
  mockedRpc.mockImplementation(async (input) => {
    if (
      (input as { payload: { task: string } }).payload.task === 'reviewAnalysis'
    )
      state.generation.current++;
    return newAnalysis;
  });
  await state.actions.analyze();
  expect(state.read().analysis).toEqual(oldAnalysis);
});
it('复核期间逐字稿变更保留新文字与旧脉络，发送材料不含翻译', async () => {
  const state = setup(undefined, oldAnalysis);
  mockedRpc.mockImplementation(async (input) => {
    const payload = (
      input as { payload: { task: string; segments: unknown[] } }
    ).payload;
    expect(payload.segments[0]).not.toHaveProperty('translated');
    if (payload.task === 'reviewAnalysis')
      state.update((r) => ({
        ...r,
        segments: r.segments.map((s) => ({
          ...s,
          original: '用户新文字',
          revision: s.revision + 1,
        })),
      }));
    return newAnalysis;
  });
  await state.actions.analyze();
  expect(state.read().analysis).toEqual(oldAnalysis);
  expect(state.read().segments[0].original).toBe('用户新文字');
  expect(state.setError).toHaveBeenLastCalledWith(
    expect.stringContaining('逐字稿已修改'),
  );
});

it('错误的逐字稿字段在调用模型前报告请求不兼容且不泄露原文', () => {
  expect(() =>
    parseAnalysisRequest({
      task: 'analyze',
      segments: [{ id: '0', startMs: 0, endMs: 1000, text: '私密内容' }],
    }),
  ).toThrow('脉络请求格式不兼容，尚未调用模型');
});
