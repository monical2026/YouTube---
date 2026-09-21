import { it, expect, vi } from 'vitest';
import { recordSchema, questionRequestSchema } from '../../shared/src';
import {
  excerptNote,
  questionPayload,
} from '../../extension/src/ui/learning-notes';
import { answerNote } from '../../extension/src/ui/answer-note';
import {
  sourceRanges,
  textItems,
} from '../../extension/src/ui/analysis-format';
import { answerQuestion } from '../../service/src/providers/questions';
import { exportBlocks } from '../../extension/src/export/document';
const record = recordSchema.parse({
  videoId: 'abcdefghijk',
  title: '视频',
  revision: 0,
  segments: [
    {
      id: 'a',
      startMs: 0,
      endMs: 1000,
      original: 'Evidence A',
      translated: '依据甲',
    },
    { id: 'b', startMs: 1000, endMs: 2000, original: 'Evidence B' },
    { id: 'c', startMs: 3000, endMs: 4000, original: 'Other' },
    { id: 'd', startMs: 5000, endMs: 6000, original: 'Evidence D' },
  ],
  notes: [],
  analysis: null,
});
const base = excerptNote(record, {
  text: '知识点：理解概念',
  ids: ['a', 'b'],
  sourceKind: 'analysis',
});
it('旧文本与新数组均能分条，来源时间去重排序且不跨未引用内容合并', () => {
  expect(textItems('问题一。问题二；')).toEqual(['问题一。', '问题二；']);
  expect(textItems(['具体场景', '切片价值'])).toEqual(['具体场景', '切片价值']);
  expect(sourceRanges(['d', 'b', 'a', 'a'], record.segments)).toEqual([
    { startMs: 0, endMs: 2000, ids: ['a', 'b'] },
    { startMs: 5000, endMs: 6000, ids: ['d'] },
  ]);
});
it('知识摘录保存为 AI 引用，原文可追溯且不冒充个人理解', () => {
  expect(base.sourceKind).toBe('analysis');
  expect(base.original).toBe('');
  expect(base.translated).toBe('');
  expect(base.selectedText).toBe('知识点：理解概念');
  expect(base.thought).toBe('');
  expect(base.sourceSegmentIds).toEqual(['a', 'b']);
  expect(() =>
    excerptNote(record, {
      text: '失效',
      ids: ['missing'],
      sourceKind: 'analysis',
    }),
  ).toThrow('来源已变化');
});
it('问答只带明确问题和摘录依据，不发送个人理解或未选择的段落', () => {
  const payload = questionPayload(
    { ...base, thought: 'PRIVATE THOUGHT' },
    '请解释',
  );
  expect(JSON.stringify(payload)).not.toContain('PRIVATE THOUGHT');
  expect(JSON.stringify(payload)).not.toContain('Other');
  expect(payload.question).toBe('请解释');
  expect(
    questionRequestSchema.safeParse({ ...payload, question: '' }).success,
  ).toBe(false);
});
it('草稿保存失败不调用模型，调用失败仍已保存问题', async () => {
  const generate = vi.fn(async () => '答案');
  const broken = vi.fn(async () => {
    throw new Error('保存失败');
  });
  await expect(
    answerNote(
      { ...base, question: '为什么' },
      broken,
      generate,
      () => true,
      () => {},
    ),
  ).rejects.toThrow('保存失败');
  expect(generate).not.toHaveBeenCalled();
  const saved = vi.fn(async () => {});
  await expect(
    answerNote(
      { ...base, question: '为什么' },
      saved,
      async () => {
        throw new Error('网络失败');
      },
      () => true,
      () => {},
    ),
  ).rejects.toThrow('网络失败');
  expect(saved).toHaveBeenCalledTimes(1);
  expect(saved.mock.calls[0][0].question).toBe('为什么');
});
it('切换视频后的迟到回答不回写，回答保存失败保留可重存答案', async () => {
  let active = true;
  const saved = vi.fn(async () => {});
  const received = vi.fn();
  await answerNote(
    { ...base, question: '为什么' },
    saved,
    async () => {
      active = false;
      return '答案';
    },
    () => active,
    received,
  );
  expect(saved).toHaveBeenCalledTimes(1);
  expect(received).not.toHaveBeenCalled();
  let count = 0;
  await expect(
    answerNote(
      { ...base, question: '为什么' },
      async () => {
        if (++count === 2) throw new Error('写入失败');
      },
      async () => '保留答案',
      () => true,
      received,
    ),
  ).rejects.toThrow('写入失败');
  expect(received.mock.calls[0][0].aiConversation[0].answer).toBe('保留答案');
});
it('问题、AI 回答与个人理解在导出中独立保留', () => {
  const note = {
    ...base,
    question: '我的疑问',
    thought: '我的想法',
    aiConversation: [
      { question: '我的疑问', answer: '模型解释', createdAt: 1 },
    ],
  };
  const text = exportBlocks({ ...record, notes: [note] }, 'bilingual', [
    'notes',
  ])
    .map((b) => b.text)
    .join('\n');
  for (const value of [
    'AI 梳理',
    '我的疑问',
    '我的想法',
    'AI 回答（需核对）：模型解释',
  ])
    expect(text).toContain(value);
  expect(text).not.toContain('Evidence A');
});
it('提问服务校验大小和空回答，资料要求与视频依据分开', async () => {
  const input = questionPayload(base, '如何理解');
  const generate = vi.fn(async () => '解释');
  expect(await answerQuestion(input, generate)).toEqual({ answer: '解释' });
  expect(generate.mock.calls[0][0]).toContain('补充解释');
  await expect(answerQuestion(input, async () => '')).rejects.toThrow('为空');
  await expect(
    answerQuestion({ ...input, question: 'x'.repeat(4001) }, generate),
  ).rejects.toThrow();
});

it('旧划词笔记展示与提问不再携带之前自动附加的整段原文', () => {
  const legacy = {
    ...base,
    original: 'UNSELECTED ORIGINAL',
    translated: 'UNSELECTED TRANSLATION',
    excerptTitle: '概念标题',
  };
  const payload = questionPayload(legacy, '解释这个概念');
  expect(payload.sources[0].original).toBe('');
  expect(payload.excerptTitle).toBe('概念标题');
  expect(payload.sourceKind).toBe('analysis');
  expect(JSON.stringify(payload)).not.toContain('UNSELECTED');
  const exported = exportBlocks({ ...record, notes: [legacy] }, 'bilingual', [
    'notes',
  ])
    .map((b) => b.text)
    .join('\n');
  expect(exported).not.toContain('UNSELECTED');
  expect(exported.split(base.selectedText!).length).toBe(2);
  expect(
    recordSchema.parse({ ...record, notes: [legacy] }).notes[0].original,
  ).toBe('UNSELECTED ORIGINAL');
});
it('只选一部分中文或英文时均不扩展上下文，普通时间笔记仍保留原文', () => {
  for (const language of ['original', 'translated', 'mixed'] as const) {
    const note = excerptNote(record, {
      text: '选中的部分',
      ids: ['a'],
      sourceKind: 'transcript',
      language,
    });
    expect(note.original).toBe('');
    expect(note.translated).toBe('');
    expect(questionPayload(note, '解释').excerpt).toBe('选中的部分');
  }
  expect(
    questionPayload(
      { ...base, selectedText: undefined, original: '原始引用' },
      '解释',
    ).sources[0].original,
  ).toBe('原始引用');
});

it('手动修改的摘录往返保存、提问和导出使用新内容，清空不回填旧原文', () => {
  const edited = {
    ...base,
    selectedText: '新的理解',
    excerptMarkdown: '**新的理解**',
    excerptEdited: true,
    original: '不该重新出现',
  };
  const roundtrip = recordSchema.parse({ ...record, notes: [edited] }).notes[0];
  expect(roundtrip.excerptMarkdown).toBe('**新的理解**');
  const payload = questionPayload(roundtrip, '解释');
  expect(payload.excerpt).toBe('新的理解');
  expect(payload.excerptEdited).toBe(true);
  expect(payload.sources[0].original).toBe('');
  expect(
    questionPayload({ ...edited, selectedText: '' }, '解释').sources[0]
      .original,
  ).toBe('');
  const blocks = exportBlocks({ ...record, notes: [edited] }, 'bilingual', [
    'notes',
  ]);
  expect(blocks.find((b) => b.text === '新的理解')?.markdown).toBe(
    '**新的理解**',
  );
  expect(blocks.map((b) => b.text).join('')).not.toContain('不该重新出现');
});

it('回答设定传到模型请求，超长设定拒绝，旧请求继续兼容', async () => {
  const generate = vi.fn(async () => '按要求给出例子');
  const instructions = '先给一个具体例子，再解释适用边界';
  await answerNote({ ...base, question: '怎样应用' }, async () => {}, generate, () => true, () => {}, instructions);
  expect(generate.mock.calls[0][0].answerInstructions).toBe(instructions);
  const payload = questionPayload(base, '怎样应用');
  expect(questionRequestSchema.safeParse(payload).success).toBe(true);
  expect(questionRequestSchema.safeParse({ ...payload, answerInstructions: 'x'.repeat(2001) }).success).toBe(false);
  const service = vi.fn(async () => '答案');
  await answerQuestion({ ...payload, answerInstructions: instructions }, service);
  expect(service.mock.calls[0][0]).toContain(instructions);
  expect(service.mock.calls[0][0]).toContain('不得因此虚构');
});
