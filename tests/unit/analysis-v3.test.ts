import { requestReviewPlan } from '../../service/src/providers/analysis-review-request';
import { expect, it } from 'vitest';
import { createElement } from '../../extension/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../extension/node_modules/react-dom/server.node.js';
import {
  segmentSchema,
  analysisSchema,
  recordSchema,
  mergeAnalyses,
} from '../../shared/src';
import { resolveAnalysis } from '../../service/src/providers/analysis';
import {
  reviewMaterial,
  reviewAnalysis,
} from '../../service/src/providers/analysis-review';
import { AnalysisDetails } from '../../extension/src/ui/AnalysisDetails';
import { ContentViews } from '../../extension/src/ui/ContentViews';
import { itemSources } from '../../extension/src/ui/analysis-format';
import { exportBlocks, exportText } from '../../extension/src/export/document';
const segments = [
  'Interest is not a purchase.',
  'Test willingness to pay.',
  'A seed controls randomness.',
  'Keep the settings unchanged.',
].map((original, i) =>
  segmentSchema.parse({
    id: `s${i}`,
    startMs: i * 1000,
    endMs: (i + 1) * 1000,
    original,
    translated: 'PRIVATE TRANSLATION',
  }),
);
function output() {
  return {
    formatVersion: 3,
    summary: '如何在大量开发前验证客户需求。',
    topics: [
      {
        title: '验证需求',
        startId: '1',
        endId: '4',
        introduction: '讲清具体做法。',
        problem: [],
        application: [],
        applicationOrigin: 'AI 延伸',
        keyPoints: ['检验付费意愿'],
        clipVerdict: '高',
        clipReason: ['问题和做法完整。'],
      },
    ],
    knowledge: [
      {
        title: '付费意愿',
        understanding: ['喜欢不等于付费'],
        role: ['支撑需求验证'],
        segmentIds: ['1', '2', '4'],
        sources: [
          { segmentId: '1', endSegmentId: '2', label: '主要讲解' },
          { segmentId: '4', endSegmentId: '4', label: '补充条件' },
        ],
      },
    ],
    prerequisites: [],
    quotes: [
      {
        segmentId: '1',
        endSegmentId: '1',
        excerpt: 'Interest is not a purchase.',
        chinese: '感兴趣不等于购买。',
        category: '点透本质',
      },
    ],
    methods: [
      {
        title: '检验需求',
        description: '先验证再投入',
        applicability: '不确定客户是否愿意购买时',
        steps: ['展示最小版本', '询问付费意愿'],
        limitations: ['说明完成状态'],
        segmentId: '1',
        sources: [{ segmentId: '1', endSegmentId: '2', label: '主要讲解' }],
      },
    ],
  };
}
it('新版结构往返保存，空栏目合法，来源编号映射为真实 ID 和完整范围', () => {
  const a = resolveAnalysis(output(), segments);
  expect(a.formatVersion).toBe(3);
  expect(a.topics[0].keyPoints).toEqual(['检验付费意愿']);
  expect(a.topics[0].problem).toEqual([]);
  expect(a.methods[0].sources?.[0]).toMatchObject({
    segmentId: 's0',
    endSegmentId: 's1',
  });
  expect(analysisSchema.parse(JSON.parse(JSON.stringify(a)))).toEqual(a);
  expect(itemSources(a.methods[0], segments)[0]).toMatchObject({
    startMs: 0,
    endMs: 2000,
    ids: ['s0', 's1'],
  });
});
it.each(['高', '中', '低', '需核对画面'])('新版切片等级 %s 可保存', (value) => {
  const data = output();
  data.topics[0].clipVerdict = value;
  expect(resolveAnalysis(data, segments).topics[0].clipVerdict).toBe(value);
});
it('来源空洞、倒序、缺要点和伪造的方法范围阻止替换旧结果', () => {
  for (const mutate of [
    (d: ReturnType<typeof output>) => {
      d.topics[0].startId = '2';
    },
    (d: ReturnType<typeof output>) => {
      d.topics[0].endId = '3';
    },
    (d: ReturnType<typeof output>) => {
      d.topics[0].keyPoints = [];
    },
    (d: ReturnType<typeof output>) => {
      d.methods[0].sources[0].endSegmentId = '99';
    },
    (d: ReturnType<typeof output>) => {
      d.methods[0].steps = [];
    },
  ]) {
    const data = output();
    mutate(data);
    expect(() => resolveAnalysis(data, segments)).toThrow('已有');
  }
});
it('超过两句话及不在原文中的金句不进入新版结果', () => {
  const data = output();
  data.quotes = [
    {
      ...data.quotes[0],
      endSegmentId: '3',
      excerpt: segments
        .slice(0, 3)
        .map((s) => s.original)
        .join(' '),
    },
    { ...data.quotes[0], excerpt: 'Invented quotation.' },
  ];
  const result = resolveAnalysis(data, segments);
  expect(result.quotes).toEqual([]);
  expect(result.warnings?.join('')).toContain('2 处');
});
it('同名关键点分批阶段不丢补充出处，全片复核统一处理', () => {
  const a = resolveAnalysis(output(), segments);
  const b = {
    ...a,
    knowledge: [
      {
        ...a.knowledge![0],
        sources: [{ segmentId: 's2', endSegmentId: 's3', label: '新增讲解' }],
      },
    ],
  };
  const merged = mergeAnalyses([a, b]);
  expect(merged.formatVersion).toBe(3);
  expect(merged.knowledge).toHaveLength(2);
  expect(merged.knowledge![1].sources![0].segmentId).toBe('s2');
});
it('复核材料保留边界原话及全片章节，剔除翻译和笔记，引用重新编号', () => {
  const data = reviewMaterial(resolveAnalysis(output(), segments), segments);
  expect(data.topics[0]).toMatchObject({ startId: '1', endId: '4' });
  expect(data.boundaryEvidence).toHaveLength(2);
  expect(data.methods[0].sources[0].segmentId).toBe('1');
  expect(data.methods[0].index).toBe(0);
  expect(data.knowledge[0].index).toBe(0);
  expect(data.quotes[0].index).toBe(0);
  expect(JSON.stringify(data)).not.toContain('PRIVATE');
});
it('全片复核采用统一规则，模型失败或旧结构不能冒充新版结果', async () => {
  const a = resolveAnalysis(output(), segments);
  const result = await reviewAnalysis(a, segments, async (prompt) => {
    if (prompt.includes('你只看到了下面这些候选句子'))
      return JSON.stringify({ keep: [0] });
    expect(prompt).toContain('这是最后一次全片复核');
    expect(prompt).toContain('不依赖上下文');
    return JSON.stringify({
      summary: output().summary,
      topics: [{ startId: '1', endId: '4' }],
      knowledge: [{ indexes: [0] }],
      methods: [{ indexes: [0] }],
      prerequisites: [],
      quotes: [{ index: 0 }],
    });
  });
  expect(result.summary).toBe(a.summary);
  await expect(
    reviewAnalysis(a, segments, async () => 'PRIVATE'),
  ).rejects.toThrow('已有结果未覆盖');
  const old = { ...output(), formatVersion: undefined };
  await expect(
    reviewAnalysis(a, segments, async () => JSON.stringify(old)),
  ).rejects.toThrow('复核计划格式');
});
it('新版界面省略空栏目，主要时间在标题前，补充出处折叠且有横向剪刀', () => {
  const a = resolveAnalysis(output(), segments);
  a.warnings = ['有 2 处来源或摘录不符合规则，已省略；其余内容已保留。'];
  const record = recordSchema.parse({
    videoId: 'abcdefghijk',
    title: '测试',
    revision: 0,
    segments,
    notes: [],
    analysis: a,
  });
  const html = renderToStaticMarkup(
    createElement(ContentViews, {
      tab: 'analysis',
      record,
      context: null,
      busy: '',
      mode: 'bilingual',
      getCaptions: async () => {},
      seek: async () => {},
      setEditing: () => {},
      newNote: async () => {},
      setEdit: () => {},
      onAskNote: () => {},
      deleteNote: async () => {},
    }),
  );
  expect(html).not.toContain('<strong>解决的问题</strong>');
  expect(html).not.toContain('<strong>应用场景</strong>');
  expect(html).toContain('切片价值：高');
  expect(html).toContain('clip-icon');
  expect(html).toContain('补充出处（1）');
  expect(html).toContain('关键点');
  expect(html).toContain('具体做法');
  expect(html).toContain('0:00–0:02');
  expect(html).not.toContain('来源或摘录不符合规则');
  expect(record.analysis?.warnings).toEqual(a.warnings);
});
it('新版导出保留结构、合并时间和折叠来源，旧版内容不重标等级', () => {
  const a = resolveAnalysis(output(), segments);
  const record = recordSchema.parse({
    videoId: 'abcdefghijk',
    title: '测试',
    revision: 0,
    segments,
    notes: [],
    analysis: a,
  });
  const text = exportText(
    exportBlocks(record, 'bilingual', ['analysis']),
    true,
  );
  expect(text).toContain('**要点**');
  expect(text).toContain('**切片价值：高**');
  expect(text).toContain('## 0:00–0:02 付费意愿');
  expect(text).toContain('<summary>补充出处（1）</summary>');
  expect(text).not.toContain('对应时间：0:00、0:01');
  const old = analysisSchema.parse({
    ...a,
    formatVersion: 2,
    topics: [{ ...a.topics[0], clipVerdict: '有条件建议' }],
  });
  expect(old.topics[0].clipVerdict).toBe('有条件建议');
});
it('无合格金句与方法时显示真实空结果，而不是强行填充', () => {
  const a = resolveAnalysis({ ...output(), quotes: [], methods: [] }, segments);
  const html = renderToStaticMarkup(
    createElement(AnalysisDetails, {
      analysis: a,
      segments,
      seek: async () => {},
    }),
  );
  expect(html).toContain('未发现符合独立表达要求的金句');
  expect(html).toContain('未提取到有足够具体做法的方法');
});

it('同一连续讲解即使返回多个字幕出处也合并为一个范围', () => {
  const data = output();
  data.methods[0].sources = [
    { segmentId: '1', endSegmentId: '1', label: '主要讲解' },
    { segmentId: '2', endSegmentId: '2', label: '同段后半' },
  ];
  const result = resolveAnalysis(data, segments);
  expect(result.methods[0].sources).toEqual([
    { segmentId: 's0', endSegmentId: 's1', label: '主要讲解' },
  ]);
});

it('精简复核计划合并同义条目并保留各处来源，不重复回传全文', async () => {
  const original = resolveAnalysis(output(), segments);
  const draft = {
    ...original,
    knowledge: [
      ...original.knowledge!,
      {
        ...original.knowledge![0],
        title: '客户愿不愿买',
        segmentIds: ['s2'],
        sources: [{ segmentId: 's2', endSegmentId: 's2', label: '补充解释' }],
      },
    ],
  };
  const result = await reviewAnalysis(draft, segments, async () =>
    JSON.stringify({
      summary: '如何判断真实购买意愿。',
      topics: [{ startId: '1', endId: '4' }],
      knowledge: [
        {
          indexes: [0, 1],
          title: '付费意愿',
          understanding: ['口头喜欢不等于实际购买'],
          role: ['检验需求'],
        },
      ],
      methods: [{ indexes: [0] }],
      prerequisites: [],
      quotes: [],
    }),
  );
  expect(result.knowledge).toHaveLength(1);
  expect(result.knowledge![0].segmentIds).toEqual(['s0', 's1', 's3', 's2']);
  expect(result.knowledge![0].sources).toHaveLength(1);
  expect(result.quotes).toEqual([]);
});
it('复核计划不能引用不存在的候选或拼接新金句', async () => {
  const original = resolveAnalysis(output(), segments);
  const plan = {
    summary: '总结',
    topics: [{ startId: '1', endId: '4' }],
    knowledge: [{ indexes: [99] }],
    methods: [],
    prerequisites: [],
    quotes: [],
  };
  await expect(
    reviewAnalysis(original, segments, async () => JSON.stringify(plan)),
  ).rejects.toThrow('无效条目');
  await expect(
    reviewAnalysis(original, segments, async () =>
      JSON.stringify({
        ...plan,
        knowledge: [],
        quotes: [{ index: 0, excerpt: 'Invented quotation.', chinese: '虚构' }],
      }),
    ),
  ).rejects.toThrow('已核验原话');
});

it('复核材料显式列出可用边界，范围变化必须重新给出完整解释与评级', async () => {
  const a = resolveAnalysis(output(), segments);
  expect(reviewMaterial(a, segments).allowedBoundaryIds).toEqual(['1', '4']);
  const plan = {
    summary: '简短总结',
    topics: [
      { startId: '1', endId: '2' },
      { startId: '3', endId: '4' },
    ],
    knowledge: [],
    methods: [],
    prerequisites: [],
    quotes: [],
  };
  await expect(
    reviewAnalysis(a, segments, async () => JSON.stringify(plan)),
  ).rejects.toThrow('调整章节边界缺少完整说明');
});

it('新版方法以核验的完整范围为准，兼容单来源指向范围中段不导致整批失败', () => {
  const data = output();
  data.methods[0].segmentId = '2';
  const result = resolveAnalysis(data, segments);
  expect(result.methods[0].segmentId).toBe('s0');
  expect(result.methods[0].sources?.[0]).toMatchObject({
    segmentId: 's0',
    endSegmentId: 's1',
  });
  expect(result.warnings).toEqual([]);
});

it('长视频复核按章节和提炼条目分两次请求，保持原数组序号', async () => {
  const material = reviewMaterial(
    resolveAnalysis(output(), segments),
    segments,
  );
  material.topics = Array.from({ length: 25 }, () => material.topics[0]);
  let calls = 0;
  const plan = await requestReviewPlan(material, async (prompt) => {
    calls++;
    const data = JSON.parse(prompt.split('全片材料：')[1]);
    if (calls === 1) {
      expect(data.knowledge).toEqual([]);
      expect(data.topics).toHaveLength(25);
      return JSON.stringify({
        summary: '全片总结',
        topics: [{ startId: '1', endId: '4' }],
      });
    }
    expect(data.knowledge).toHaveLength(1);
    expect(data.boundaryEvidence).toEqual([]);
    expect(data.summary).toBe('全片总结');
    return JSON.stringify({
      knowledge: [{ indexes: [0] }],
      methods: [{ indexes: [0] }],
      prerequisites: [],
      quotes: [],
    });
  });
  expect(calls).toBe(2);
  expect(plan).toMatchObject({
    summary: '全片总结',
    knowledge: [{ indexes: [0] }],
    topics: [{ startId: '1', endId: '4' }],
  });
});
