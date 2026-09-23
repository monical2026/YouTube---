import { expect, it, vi, beforeEach } from 'vitest';
import { recordSchema, requestSchema } from '../../shared/src';
import { historyEntry, searchHistory } from '../../extension/src/history/records';
import { openHistory, openVideoTime } from '../../extension/src/background/history';
const record = recordSchema.parse({ videoId: 'abcdefghijk', title: 'Agent design', revision: 0, segments: [], analysis: null, notes: [{
  id: 'one', videoId: 'abcdefghijk', title: 'Title', startMs: 0, segmentId: '', sourceRevision: 0, original: '旧引用', translated: '旧译文',
  selectedText: '修改后的摘录', thought: '值得学习', question: '如何验证', revision: 0, draft: true, updatedAt: 100,
  aiConversation: [{ question: '旧问题', answer: '模型专用词', createdAt: 200 }],
}] });
it('标题不区分大小写；笔记搜索包含手改摘录、理解、疑问，排除被替代引用和 AI 回答', () => {
  const entries = [historyEntry(record)];
  for (const query of ['AGENT', '修改后', '值得', '如何']) expect(searchHistory(entries, query)).toHaveLength(1);
  for (const query of ['模型专用词', '旧引用', '旧译文']) expect(searchHistory(entries, query)).toHaveLength(0);
  expect(searchHistory(entries, '修改后')[0].hits[0].noteId).toBe('one');
  expect(entries[0]).toMatchObject({ noteCount: 1, draftCount: 1, updatedAt: 100 });
});
it('旧数据日期未知时不生成虚构日期', () => {
  expect(historyEntry({ ...record, notes: [] }).updatedAt).toBeUndefined();
});
it('时间跳转消息拒绝外部地址、负数时间', () => {
  expect(requestSchema.safeParse({ type: 'openVideoTime', videoId: 'https://evil.test', startMs: 1 }).success).toBe(false);
  expect(requestSchema.safeParse({ type: 'openVideoTime', videoId: record.videoId, startMs: -1 }).success).toBe(false);
});
const api = { query: vi.fn(), create: vi.fn(), update: vi.fn(), sendMessage: vi.fn(), focus: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  api.query.mockResolvedValue([]);
  vi.stubGlobal('chrome', { runtime: { getURL: (p: string) => `chrome-extension://test/${p}` }, tabs: api, windows: { update: api.focus } });
});
it('打开历史页不需要原标签，地址只携带历史标识和视频标识', async () => {
  await openHistory(record.videoId);
  expect(api.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/panel.html?history=1&video=abcdefghijk' });
  expect(api.query).not.toHaveBeenCalled();
});
it('原视频已关闭时，显式时间跳转创建对应时间地址', async () => {
  await openVideoTime(record.videoId, 485000);
  expect(api.create).toHaveBeenCalledWith({ url: 'https://www.youtube.com/watch?v=abcdefghijk&t=485s' });
});
it('已有同一视频时复用标签并定位，接收端失败则恢复带时间的地址', async () => {
  api.query.mockResolvedValue([{ id: 7, windowId: 2, url: 'https://www.youtube.com/watch?v=abcdefghijk' }]);
  api.sendMessage.mockResolvedValue({ ok: true });
  await openVideoTime(record.videoId, 1000);
  expect(api.sendMessage).toHaveBeenCalledWith(7, { type: 'seek', videoId: record.videoId, startMs: 1000 });
  expect(api.create).not.toHaveBeenCalled();
  api.sendMessage.mockRejectedValue(new Error('closed'));
  await openVideoTime(record.videoId, 1000);
  expect(api.update).toHaveBeenCalledWith(7, { url: 'https://www.youtube.com/watch?v=abcdefghijk&t=1s' });
});
