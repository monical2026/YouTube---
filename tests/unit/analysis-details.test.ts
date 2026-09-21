import { expect, it } from 'vitest';
import { analysisSchema, mergeAnalyses } from '../../shared/src';
import { quoteText } from '../../extension/src/ui/AnalysisDetails';
import { exportBlocks } from '../../extension/src/export/document';
import { recordSchema } from '../../shared/src';
const part = analysisSchema.parse({
  formatVersion: 2,
  summary: '摘要',
  topics: [
    {
      title: '主题',
      startMs: 0,
      endMs: 1000,
      introduction: '介绍',
      problem: '问题',
      application: '场景',
      applicationOrigin: 'AI 延伸',
      clipVerdict: '有条件建议',
      clipReason: '需要前文',
    },
  ],
  quotes: [],
  methods: [],
  knowledge: [
    {
      title: '概念',
      understanding: '定义',
      role: '解释问题',
      segmentIds: ['a'],
    },
  ],
  prerequisites: [],
});
it('合并长视频知识来源并汇总粗判断，不冒充独立的全片模型判断', () => {
  const second = analysisSchema.parse({
    ...part,
    knowledge: [{ ...part.knowledge![0], segmentIds: ['b'] }],
  });
  const merged = mergeAnalyses([part, second]);
  expect(merged.knowledge).toHaveLength(1);
  expect(merged.knowledge![0].segmentIds).toEqual(['a', 'b']);
  expect(merged.clipOverview).toContain('2 个有条件建议');
  expect(merged.clipOverview).toContain('初步汇总');
});
it('旧分析数据仍可读取但不标新版，不凭空生成切片结论', () => {
  const old = analysisSchema.parse({
    summary: '旧',
    topics: [],
    quotes: [],
    methods: [],
  });
  expect(old.formatVersion).toBeUndefined();
  expect(mergeAnalyses([old]).clipOverview).toBeUndefined();
});
it('双语、中文、原文复制内容准确且不混入界面标签', () => {
  const quote = { segmentId: 'a', original: 'Source.', chinese: '原文。' };
  expect(quoteText(quote, 'bilingual')).toBe('原文。\n\nSource.');
  expect(quoteText(quote, 'chinese')).toBe('原文。');
  expect(quoteText(quote, 'original')).toBe('Source.');
});
it('导出新增知识、前置知识和切片判断', () => {
  const record = recordSchema.parse({
    videoId: 'abcdefghijk',
    title: '测试',
    revision: 0,
    segments: [{ id: 'a', original: '来源', startMs: 0, endMs: 1000 }],
    notes: [],
    analysis: mergeAnalyses([part]),
  });
  const text = exportBlocks(record, 'bilingual', ['analysis'])
    .map((b) => b.text)
    .join('\n');
  expect(text).toContain('全片切片判断');
  expect(text).toContain('需要理解：• 定义');
  expect(text).toContain('对应时间：0:00');
  expect(text).toContain('前置知识');
});

it('五类金句可往返保存，旧分类读取时兼容映射且不影响原文', () => {
  for (const [input, expected] of [
    ['反直觉洞察', '反直觉洞察'],
    ['点透本质', '点透本质'],
    ['方法与原则', '方法与原则'],
    ['关键事实', '关键事实'],
    ['案例与经验', '案例与经验'],
    ['惊人事实', '关键事实'],
    ['轶事', '案例与经验'],
  ]) {
    const parsed = analysisSchema.parse({
      ...part,
      quotes: [
        { segmentId: 'a', original: '原话', chinese: '翻译', category: input },
      ],
    });
    expect(parsed.quotes[0].category).toBe(expected);
    expect(
      analysisSchema.parse(JSON.parse(JSON.stringify(parsed))).quotes[0]
        .original,
    ).toBe('原话');
  }
});

it('知识清单数组跨批次合并仍保留逐条结构，兼容旧文本', () => {
  const first = analysisSchema.parse({
    ...part,
    knowledge: [
      {
        ...part.knowledge![0],
        understanding: ['定义', '条件'],
        role: ['解释选择'],
      },
    ],
  });
  const second = analysisSchema.parse({
    ...part,
    knowledge: [
      {
        ...part.knowledge![0],
        understanding: ['条件', '区别'],
        role: '提供依据',
      },
    ],
  });
  const merged = mergeAnalyses([first, second]);
  expect(merged.knowledge![0].understanding).toEqual(['定义', '条件', '区别']);
  expect(merged.knowledge![0].role).toEqual(['解释选择', '提供依据']);
});
