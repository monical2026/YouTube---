import { beforeEach, expect, it, vi } from 'vitest';
import {
  contextSchema,
  recordSchema,
  type VideoRecord,
} from '../../shared/src';
const state = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  effects: [] as (() => unknown)[],
  listeners: [] as ((input: unknown) => void)[],
}));
vi.mock('../../extension/node_modules/react', () => ({
  useState: (value: unknown) => {
    const setter = vi.fn();
    state.setters.push(setter);
    return [value, setter];
  },
  useRef: (current: unknown) => ({ current }),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => unknown) => {
    state.effects.push(effect);
  },
}));
vi.mock('../../extension/src/lib/rpc', () => ({
  rpc: vi.fn(),
  errorText: (e: Error) => e.message,
}));
import { rpc } from '../../extension/src/lib/rpc';
import { useVideo } from '../../extension/src/ui/useVideo';
const ctx = contextSchema.parse({
  videoId: 'abcdefghijk',
  title: 'Test',
  currentMs: 0,
  durationMs: 1000,
  live: false,
  playing: false,
  ad: false,
  tracks: [],
});
let stored: VideoRecord;
beforeEach(() => {
  state.setters.length = 0;
  state.effects.length = 0;
  state.listeners.length = 0;
  stored = recordSchema.parse({
    videoId: ctx.videoId,
    title: 'Test',
    revision: 0,
    segments: [],
    notes: [],
    analysis: null,
  });
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('chrome', {
    runtime: {
      connect: () => ({
        onMessage: {
          addListener: (fn: (input: unknown) => void) =>
            state.listeners.push(fn),
        },
        disconnect: vi.fn(),
      }),
    },
  });
  vi.mocked(rpc).mockImplementation(async (request) => {
    const r = request as {
      type: string;
      record?: VideoRecord;
      expectedRevision?: number;
    };
    if (r.type === 'getContext') return { context: ctx, tabId: 1 };
    if (r.type === 'save') {
      if (r.expectedRevision !== stored.revision)
        throw new Error('revision conflict');
      stored = { ...r.record!, revision: stored.revision + 1 };
    }
    return structuredClone(stored);
  });
});
it('快捷笔记在另一窗口完成后，主面板收到通知立即刷新列表', async () => {
  useVideo();
  state.effects[0]();
  await vi.waitFor(() =>
    expect(state.setters[1]).toHaveBeenLastCalledWith(stored),
  );
  stored = {
    ...stored,
    revision: 1,
    notes: [
      {
        id: 'note',
        videoId: ctx.videoId,
        title: 'Test',
        startMs: 0,
        segmentId: '',
        sourceRevision: 0,
        original: 'quote',
        translated: '引用',
        thought: '我的理解',
        question: '我的疑问',
        revision: 1,
        draft: false,
        updatedAt: 1,
      },
    ],
  };
  state.listeners[0]({
    type: 'recordChanged',
    videoId: ctx.videoId,
    revision: 1,
  });
  await vi.waitFor(() =>
    expect(state.setters[1]).toHaveBeenLastCalledWith(stored),
  );
  const calls = vi.mocked(rpc).mock.calls.length;
  state.listeners[0]({
    type: 'recordChanged',
    videoId: 'othervideo1',
    revision: 99,
  });
  await Promise.resolve();
  expect(vi.mocked(rpc).mock.calls.length).toBe(calls);
});
it('翻译保存前读取最新记录，不用旧缓存覆盖另一窗口的新笔记', async () => {
  const video = useVideo();
  state.effects[0]();
  await vi.waitFor(() =>
    expect(state.setters[1]).toHaveBeenLastCalledWith(stored),
  );
  stored = { ...stored, revision: 1, title: '另一窗口更新' };
  await video.mutate((r) => ({ ...r, analysisSource: 'translation' }));
  expect(stored.title).toBe('另一窗口更新');
  expect(stored.revision).toBe(2);
});
it('删除笔记写入持久记录并保留其余笔记，通知后同步为空列表', async () => {
  const video = useVideo();
  state.effects[0]();
  await vi.waitFor(() =>
    expect(state.setters[1]).toHaveBeenLastCalledWith(stored),
  );
  const note = {
    id: 'delete-me',
    videoId: ctx.videoId,
    title: 'Test',
    startMs: 0,
    segmentId: '',
    sourceRevision: 0,
    original: '',
    translated: '',
    thought: '测试',
    question: '',
    revision: 0,
    draft: false,
    updatedAt: 1,
  };
  stored = {
    ...stored,
    revision: 1,
    notes: [note, { ...note, id: 'keep-me' }],
  };
  await video.mutate((r) => ({
    ...r,
    notes: r.notes.filter((n) => n.id !== 'delete-me'),
  }));
  expect(stored.notes.map((n) => n.id)).toEqual(['keep-me']);
  stored = { ...stored, revision: stored.revision + 1, notes: [] };
  state.listeners[0]({
    type: 'recordChanged',
    videoId: ctx.videoId,
    revision: stored.revision,
  });
  await vi.waitFor(() =>
    expect(state.setters[1]).toHaveBeenLastCalledWith(stored),
  );
});
