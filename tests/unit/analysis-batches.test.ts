import { expect, it } from 'vitest';
import {
  analysisBatches,
  analysisInput,
  segmentSchema,
} from '../../shared/src';
import { applyTranslations } from '../../extension/src/ui/translation-results';
it('分批按实际请求长度计量，不携带中文翻译与编辑信息', () => {
  const segments = Array.from({ length: 100 }, (_, i) =>
    segmentSchema.parse({
      id: String(i),
      original: 'text'.repeat(100),
      translated: '译'.repeat(10000),
      startMs: i * 1000,
      endMs: (i + 1) * 1000,
    }),
  );
  const batches = analysisBatches(segments, 3000);
  expect(batches.flat()).toEqual(segments);
  for (const batch of batches)
    expect(JSON.stringify(analysisInput(batch)).length).toBeLessThanOrEqual(
      3000,
    );
  expect(analysisInput(segments)[0]).not.toHaveProperty('translated');
});
it('单段过长明确失败，不静默截断原文', () => {
  const s = segmentSchema.parse({
    id: 'x',
    original: 'a'.repeat(3000),
    startMs: 0,
    endMs: 1000,
  });
  expect(() => analysisBatches([s], 1000)).toThrow('单个逐字稿');
});
it('翻译返回时版本已变更，不能覆盖用户的新内容', () => {
  const s = segmentSchema.parse({
    id: 'x',
    original: 'new',
    translated: '新内容',
    revision: 2,
    startMs: 0,
    endMs: 1000,
  });
  const result = applyTranslations(
    [s],
    [{ id: 'x', revision: 1, text: '旧请求结果' }],
  );
  expect(result.segments[0]).toEqual(s);
  expect(result.conflicts).toHaveLength(1);
});
