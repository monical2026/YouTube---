import { expect, it } from 'vitest';
import { segmentSchema } from '../../shared/src';
import {
  resolveAnalysis,
  analyzeSegments,
} from '../../service/src/providers/analysis';
const segments = [
  segmentSchema.parse({
    id: 'real-a',
    startMs: 23845,
    endMs: 27612,
    original: "It's a test.\nExact source!",
  }),
  segmentSchema.parse({
    id: 'real-b',
    startMs: 27612,
    endMs: 30098,
    original: 'Next sentence.',
  }),
];
const output = {
  summary: '总结',
  topics: [
    {
      title: '主题',
      startId: '1',
      endId: '2',
      introduction: '介绍',
      problem: '问题',
      application: '场景',
      clipReason: '理由',
    },
  ],
  quotes: [{ segmentId: '1', chinese: '测试', original: '模型改过标点的原文' }],
  methods: [{ title: '方法', description: '说明', segmentId: '2' }],
};
it('由真实片段生成精确毫秒时间，不使用模型猜测的时间', () => {
  const result = resolveAnalysis(output, segments);
  expect(result.topics[0]).toMatchObject({ startMs: 23845, endMs: 30098 });
  expect(result.quotes[0]).toMatchObject({
    segmentId: 'real-a',
    original: segments[0].original,
  });
  expect(result.methods[0].segmentId).toBe('real-b');
});
it('无效引用不能伪装成有效引用，单条无效金句不阻断其他主题', () => {
  const result = resolveAnalysis(
    { ...output, quotes: [{ segmentId: '99', chinese: '无来源' }] },
    segments,
  );
  expect(result.quotes).toEqual([]);
  expect(result.topics).toHaveLength(1);
});
it('全部主题编号无效或顺序颠倒时仍拒绝保存', () => {
  expect(() =>
    resolveAnalysis(
      {
        ...output,
        topics: [{ ...output.topics[0], startId: '2', endId: '1' }],
      },
      segments,
    ),
  ).toThrow('可定位');
});
it('支持模型输出数值编号与 JSON 代码围栏', async () => {
  const result = await analyzeSegments(segments, async (prompt) => {
    expect(prompt).toContain('禁止输出时间戳');
    return (
      '```json\n' +
      JSON.stringify({
        ...output,
        topics: [{ ...output.topics[0], startId: 1, endId: 2 }],
      }) +
      '\n```'
    );
  });
  expect(result.topics[0].endMs).toBe(30098);
});
