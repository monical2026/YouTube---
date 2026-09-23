import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { load, save } from '../../extension/src/storage/database';
it('并发旧版本写入不能覆盖已保存的记录', async () => {
  const original = await load('storage-one');
  const saved = await save({ ...original, title: '保留这条笔记' }, 0);
  await expect(save({ ...original, title: '旧窗口' }, 0)).rejects.toThrow(
    '另一窗口',
  );
  expect((await load('storage-one')).title).toBe(saved.title);
});
it('按视频隔离持久数据', async () => {
  const a = await load('video-a');
  await save({ ...a, title: '视频 A' }, 0);
  expect((await load('video-b')).title).toBe('');
  expect((await load('video-a')).title).toBe('视频 A');
});
it('知识引用和 AI 问答在写入与重新读取后完整保留', async () => {
  const record = await load('learning-storage');
  const note = {
    id: 'learning-note',
    videoId: record.videoId,
    title: '知识笔记',
    startMs: 1000,
    segmentId: 'source',
    sourceRevision: 0,
    original: 'Source',
    translated: '来源',
    selectedText: '知识点',
    sourceKind: 'analysis' as const,
    thought: '个人理解',
    question: '仍有疑问',
    revision: 0,
    draft: true,
    updatedAt: 1,
    aiConversation: [{ question: '请解释', answer: '模型补充', createdAt: 1 }],
  };
  await save({ ...record, notes: [note] }, record.revision);
  expect((await load(record.videoId)).notes[0]).toEqual(note);
});
it('历史目录保留旧数据、笔记与版本，新增写入记录真实时间', async () => {
  const { listHistory } = await import('../../extension/src/storage/database');
  const saved = await load('learning-storage');
  const result = await listHistory();
  expect(result.invalidCount).toBe(0);
  const entry = result.entries.find(e => e.videoId === saved.videoId)!;
  expect(entry.updatedAt).toBe(saved.updatedAt);
  expect(entry.notes[0].fields).toContain('知识点');
  expect(JSON.stringify(entry)).not.toContain('模型补充');
  expect((await load(saved.videoId)).revision).toBe(saved.revision);
});
it('旧版记录无需重写即可列出，异常项只报告计数且不删除原数据', async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('youtube-note', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    tx.objectStore('videos').put({ videoId: 'legacy', title: '旧版视频', revision: 3, segments: [], notes: [], analysis: null });
    tx.objectStore('videos').put({ videoId: 'invalid', notes: 'broken' });
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  const { listHistory } = await import('../../extension/src/storage/database');
  const list = await listHistory();
  expect(list.invalidCount).toBe(1);
  expect(list.entries.find(e => e.videoId === 'legacy')?.updatedAt).toBeUndefined();
  expect((await load('legacy')).revision).toBe(3);
  await expect(load('invalid')).rejects.toThrow('原数据未修改');
  db.close();
});
