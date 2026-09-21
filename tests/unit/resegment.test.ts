import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { recordSchema, segmentSchema } from '../../shared/src';
import {
  applyTranscript,
  previewTranscript,
  restoreTranscript,
} from '../../extension/src/segmentation/resegment';
import {
  prepareSegments,
  parseCaptions,
  currentSegment,
  groupCues,
} from '../../extension/src/segmentation';
import { createCaptionCache } from '../../extension/src/background/caption-cache';
import { load, save } from '../../extension/src/storage/database';

const original = () =>
  recordSchema.parse({
    videoId: 'resegment',
    title: '测试',
    revision: 0,
    analysis: null,
    segments: [
      {
        id: 'a',
        original: 'This is the meaning of that',
        translated: '旧译文一',
        startMs: 0,
        endMs: 3000,
      },
      {
        id: 'b',
        original: 'number E.',
        translated: '旧译文二',
        startMs: 1500,
        endMs: 4500,
      },
    ],
    notes: [
      {
        id: 'n',
        videoId: 'resegment',
        title: '测试',
        startMs: 1500,
        segmentId: 'b',
        sourceRevision: 0,
        original: 'number E.',
        translated: '旧译文二',
        thought: '个人理解',
        question: '疑问',
        revision: 0,
        draft: true,
        updatedAt: 0,
      },
    ],
  });

it('预览不改原记录；应用保留旧译文备份和笔记快照，重新加载后可恢复', async () => {
  const record = original(),
    copy = structuredClone(record);
  const preview = previewTranscript(record);
  expect(record).toEqual(copy);
  expect(preview.segments).toHaveLength(1);
  const next = applyTranscript(record, preview);
  expect(next.notes).toEqual(copy.notes);
  expect(next.transcriptBackup?.segments).toEqual(copy.segments);
  expect(next.segments[0].translated).toBe('');
  expect(next.segments[0].sourceCueIds).toEqual(['a', 'b']);
  await save(next, 0);
  const reloaded = await load(record.videoId);
  expect(reloaded.transcriptBackup?.segments).toEqual(copy.segments);
  expect(reloaded.segments[0].sourceSpans?.map((s) => s.text).join(' ')).toBe(
    'This is the meaning of that number E.',
  );
  const restored = restoreTranscript(reloaded, previewTranscript(reloaded));
  expect(restored.segments).toEqual(copy.segments);
  expect(restored.notes).toEqual(copy.notes);
});
it('预览之后发生翻译或视频切换时拒绝覆盖', () => {
  const record = original(),
    preview = previewTranscript(record);
  expect(() =>
    applyTranscript({ ...record, videoId: 'other' }, preview),
  ).toThrow('已变化');
  const edited = structuredClone(record);
  edited.segments[0].revision++;
  expect(() => applyTranscript(edited, preview)).toThrow('已变化');
});
it('预览后保存失败保留原数据，最新笔记独立更新可保留', async () => {
  const record = { ...original(), videoId: 'conflict' };
  const before = await save(record, 0);
  const preview = previewTranscript(before);
  const other = await save({ ...before, title: '另一窗口' }, before.revision);
  await expect(
    save(applyTranscript(before, preview), before.revision),
  ).rejects.toThrow('另一窗口');
  expect((await load('conflict')).segments).toEqual(record.segments);
  const noteUpdate = {
    ...other,
    notes: other.notes.map((n) => ({ ...n, thought: '新想法' })),
  };
  expect(applyTranscript(noteUpdate, preview).notes[0].thought).toBe('新想法');
});
it('手改段落不拆不并，未变边界的旧译文不丢', () => {
  const record = original();
  record.segments[0].manual = true;
  const preview = previewTranscript(record);
  expect(preview.segments).toEqual(record.segments);
  expect(applyTranscript(record, preview)).toBe(record);
});
it('YouTube 和供应商已有或生成片段使用相同规则，正常化可重复调用', () => {
  const texts = ['This is the meaning of that', 'number E.'];
  const youtube = parseCaptions({
    events: texts.map((utf8, i) => ({
      tStartMs: i * 1500,
      dDurationMs: 3000,
      segs: [{ utf8 }],
    })),
  });
  for (const prefix of ['supadata', 'generated']) {
    const segments = prepareSegments(
      texts.map((original, i) =>
        segmentSchema.parse({
          id: `${prefix}-${i}`,
          original,
          startMs: i * 1500,
          endMs: i * 1500 + 3000,
        }),
      ),
    );
    expect(segments.map((s) => s.original)).toEqual(
      youtube.map((s) => s.original),
    );
    expect(prepareSegments(segments)).toBe(segments);
  }
});
it('旧缓存有译文时直接复用，不在打开时重组或发请求', async () => {
  const record = original(),
    fetch = vi.fn(),
    write = vi.fn();
  const cache = createCaptionCache(async () => record, write);
  expect(await cache(record.videoId, fetch)).toEqual(record.segments);
  expect(fetch).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
it('来源片段内部拆句仍能逐字还原，区间精度不变', () => {
  const text = 'A'.repeat(149) + '.\n\n' + 'B'.repeat(149) + '.  ';
  const result = groupCues([{ id: 'raw', text, startMs: 1000, endMs: 9000 }]);
  expect(result).toHaveLength(2);
  expect(
    result
      .flatMap((s) => s.sourceSpans ?? [])
      .map((s) => s.text)
      .join(''),
  ).toBe(text);
  expect(result.map((s) => [s.startMs, s.endMs])).toEqual([
    [1000, 9000],
    [1000, 9000],
  ]);
  expect(currentSegment(result, 1000)?.id).toBe(result[0].id);
  expect(currentSegment(result, 9001)).toBeUndefined();
});
it('重叠时间不会因后一个短片段过期而失去仍有效的定位', () => {
  const segments = [
    { startMs: 0, endMs: 10000 },
    { startMs: 1000, endMs: 2000 },
  ].map((s, i) => segmentSchema.parse({ ...s, id: String(i), original: 'x' }));
  expect(currentSegment(segments, 3000)?.id).toBe('0');
});
it('来源范围通过消息和存储校验保留，非法范围被拒绝', () => {
  const segment = groupCues([
    { id: 'raw', text: 'Some text.', startMs: 0, endMs: 1000 },
  ])[0];
  expect(segmentSchema.parse(segment)).toEqual(segment);
  const invalid = structuredClone(segment);
  invalid.sourceSpans![0].endChar++;
  expect(() => segmentSchema.parse(invalid)).toThrow();
});
