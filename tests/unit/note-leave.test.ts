import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ effects: [] as (() => unknown)[], setters: [] as ReturnType<typeof vi.fn>[] }));
vi.mock('../../extension/node_modules/react', () => ({
  useState: (initial: unknown) => { const setter = vi.fn(); state.setters.push(setter); return [initial, setter]; },
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => unknown) => state.effects.push(effect),
}));
import { NoteEditor } from '../../extension/src/ui/NoteEditor';
const note = { id: 'n', videoId: 'abcdefghijk', title: 'Title', startMs: 0, segmentId: '', sourceRevision: 0, original: '', translated: '', selectedText: '保留摘录', thought: '待保存输入', question: '', revision: 0, draft: true, updatedAt: 1 };
beforeEach(() => { state.effects.length = 0; state.setters.length = 0; });
it('切换视频先保存当前草稿；失败返回 false 并显示错误，不结束草稿', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('写入失败')).mockResolvedValue(undefined);
  const registerLeave = vi.fn();
  NoteEditor({ note, onSave: save, onClose: vi.fn(), onAsk: vi.fn(), onDelete: vi.fn(), registerLeave });
  state.effects[0]();
  const leave = registerLeave.mock.calls[0][0];
  expect(await leave()).toBe(false);
  expect(state.setters[1]).toHaveBeenLastCalledWith('写入失败');
  expect(await leave()).toBe(true);
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ thought: '待保存输入', draft: true }));
});
