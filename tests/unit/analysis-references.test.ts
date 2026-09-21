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
it('跨段金句精确摘录，拒绝伪造和倒序来源', () => {
  const result = resolveAnalysis(
    {
      ...output,
      quotes: [
        {
          segmentId: '1',
          endSegmentId: '2',
          excerpt: 'Exact source! Next sentence.',
          chinese: '准确来源。下一句。',
          category: '点透本质',
        },
        { segmentId: '1', excerpt: '虚构原话', chinese: '虚构' },
        { segmentId: '2', endSegmentId: '1', chinese: '倒序' },
      ],
    },
    segments,
  );
  expect(result.quotes).toHaveLength(1);
  expect(result.quotes[0]).toMatchObject({
    original: 'Exact source! Next sentence.',
    segmentId: 'real-a',
    endSegmentId: 'real-b',
  });
  expect(result.warnings?.[0]).toContain('2 处');
});
it('知识点引用全部核验，新结构保留场景来源与切片结论', () => {
  const result = resolveAnalysis(
    {
      ...output,
      topics: [
        {
          ...output.topics[0],
          applicationOrigin: 'AI 延伸',
          clipVerdict: '有条件建议',
        },
      ],
      prerequisites: [],
      knowledge: [
        {
          title: '有效',
          understanding: '含义',
          role: '论证',
          segmentIds: ['1', '2'],
        },
        {
          title: '伪造',
          understanding: '含义',
          role: '论证',
          segmentIds: ['1', '99'],
        },
      ],
    },
    segments,
  );
  expect(result.formatVersion).toBe(2);
  expect(result.knowledge).toEqual([
    {
      title: '有效',
      understanding: '含义',
      role: '论证',
      segmentIds: ['real-a', 'real-b'],
    },
  ]);
  expect(result.topics[0].clipVerdict).toBe('有条件建议');
  expect(result.warnings?.[0]).toContain('1 处');
});
it('摘录落在范围后段时，跳转来源收紧到真正包含摘录的段落', () => {
  const result = resolveAnalysis(
    {
      ...output,
      quotes: [
        {
          segmentId: '1',
          endSegmentId: '2',
          excerpt: 'Next sentence.',
          chinese: '下一句。',
        },
      ],
    },
    segments,
  );
  expect(result.quotes[0].segmentId).toBe('real-b');
  expect(result.quotes[0].endSegmentId).toBe('real-b');
});
it('模型真实返回未约定金句类型时保留有效原文，提示省略分类而不使整批失败', () => {
  const result = resolveAnalysis(
    {
      ...output,
      quotes: [{ segmentId: '1', chinese: '测试', category: '方法洞察' }],
    },
    segments,
  );
  expect(result.quotes).toHaveLength(1);
  expect(result.quotes[0].original).toBe(segments[0].original);
  expect(result.quotes[0].category).toBeUndefined();
  expect(result.warnings?.join(' ')).toContain('金句分类');
  expect(result.topics).toHaveLength(1);
});
it('标签首尾空白可规范化，不能改写或猜测金句分类', () => {
  const result = resolveAnalysis(
    {
      ...output,
      quotes: [{ segmentId: '1', chinese: '测试', category: ' 点透本质 ' }],
    },
    segments,
  );
  expect(result.quotes[0].category).toBe('点透本质');
});
it('真实结构错误指出栏目和字段，错误中不回显模型内容', () => {
  expect(() =>
    resolveAnalysis(
      {
        ...output,
        knowledge: [
          {
            title: '概念',
            understanding: '含义',
            role: '作用',
            segmentIds: '私人内容不可回显',
          },
        ],
      },
      segments,
    ),
  ).toThrow('知识清单第 1 项的来源片段');
  try {
    resolveAnalysis(
      { ...output, summary: { secret: 'PRIVATE-SENTINEL' } },
      segments,
    );
  } catch (error) {
    expect(String(error)).not.toContain('PRIVATE-SENTINEL');
  }
});
it('非 JSON 回复给出明确错误，不泄漏原始回复', async () => {
  await expect(
    analyzeSegments(segments, async () => 'PRIVATE-SENTINEL'),
  ).rejects.toThrow('AI 梳理未返回有效 JSON');
});
