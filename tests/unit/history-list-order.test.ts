import { expect, it } from 'vitest';
import { retainHistoryDates } from '../../extension/src/history/list-order';
import { historyEntry } from '../../extension/src/history/records';
import { recordSchema } from '../../shared/src';

const entries = [300, 200, 100].map((updatedAt, i) =>
  historyEntry(
    recordSchema.parse({
      videoId: `fixture000${i}`,
      title: `Video ${i}`,
      revision: 0,
      updatedAt,
      segments: [],
      notes: [],
      analysis: null,
    }),
  ),
);
it('点击第三项或编辑笔记后保持页面内顺序；重新打开页面才采用新时间排序', () => {
  const initial = retainHistoryDates({}, entries);
  const edited = entries.map((entry, i) =>
    i === 2 ? { ...entry, updatedAt: 900 } : entry,
  );
  const next = retainHistoryDates(initial, edited, { fixture0002: 1000 });
  expect(next).toEqual(initial);
  expect(
    retainHistoryDates({}, edited, { fixture0002: 1000 }).fixture0002,
  ).toBe(1000);
});
it('无日期的旧记录在本次浏览中保持原分组，新记录正常加入', () => {
  const previous = { fixture0000: 0 };
  expect(retainHistoryDates(previous, entries)).toEqual({
    fixture0000: 0,
    fixture0001: 200,
    fixture0002: 100,
  });
});
