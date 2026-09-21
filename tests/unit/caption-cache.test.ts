import { expect, it, vi } from 'vitest';
import { recordSchema, segmentSchema } from '../../shared/src';
import { createCaptionCache } from '../../extension/src/background/caption-cache';
it('首次抓取即后台持久化，下次打开和后台重建均不再请求外部服务', async () => {
  let record = recordSchema.parse({
    videoId: 'v',
    title: '',
    revision: 0,
    segments: [],
    notes: [],
    analysis: null,
  });
  const load = vi.fn(async () => structuredClone(record));
  const save = vi.fn(async (next: typeof record) => {
    record = { ...next, revision: record.revision + 1 };
    return record;
  });
  const fetch = vi.fn(async () => [
    segmentSchema.parse({
      id: 's',
      original: 'saved',
      startMs: 0,
      endMs: 1000,
    }),
  ]);
  const cached = createCaptionCache(load, save);
  await Promise.all([cached('v', fetch), cached('v', fetch)]);
  expect(save).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  await createCaptionCache(load, save)('v', fetch);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('字幕保存遇到笔记更新冲突只重试保存，不重新抓字幕', async () => {
  let record = recordSchema.parse({
    videoId: 'v',
    title: '',
    revision: 0,
    segments: [],
    notes: [],
    analysis: null,
  });
  let attempts = 0;
  const cache = createCaptionCache(
    async () => structuredClone(record),
    async (next) => {
      if (++attempts === 1) {
        record = { ...record, revision: 1, title: '其他窗口更新' };
        throw new Error('记录已在另一窗口更新');
      }
      record = { ...next, revision: next.revision + 1 };
      return record;
    },
  );
  const fetch = vi.fn(async () => [
    segmentSchema.parse({
      id: 's',
      original: 'saved',
      startMs: 0,
      endMs: 1000,
    }),
  ]);
  await cache('v', fetch);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(record.title).toBe('其他窗口更新');
  expect(record.segments).toHaveLength(1);
});
