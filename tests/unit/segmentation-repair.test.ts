import { expect, it } from 'vitest';
import { groupCues } from '../../extension/src/segmentation';
import { previewTranscript } from '../../extension/src/segmentation/resegment';
import { recordSchema, segmentSchema } from '../../shared/src';
const cue = (text: string, i = 0) => ({
  id: `c${i}`,
  text,
  startMs: i * 3000,
  endMs: i * 3000 + 5000,
});
const joined = (rows: ReturnType<typeof groupCues>) =>
  rows
    .map((s) => s.original)
    .join('')
    .replace(/\s/g, '');
it('远距离错配引号不屏蔽中间完整句', () => {
  const text =
    'He says "Please remind me. ' +
    'This is another complete explanation for the audience. '.repeat(35) +
    'Later she says "Use this version."';
  const rows = groupCues([cue(text)]);
  expect(rows.length).toBeGreaterThan(5);
  expect(Math.max(...rows.map((s) => s.original.length))).toBeLessThan(500);
  expect(joined(rows)).toBe(text.replace(/\s/g, ''));
});
it('无标点长内容按独立分句线索分段，不删除或增加原话', () => {
  const parts = [
    'this is the entrance hall and it brings a lot of natural light into our home',
    'so next is the dining room and we spend time here with our family every evening',
    'I really love this room because the windows look out over the beautiful garden',
    'we moved here several years ago and we have made many changes since that time',
    'the garden is large enough for the children and they play outside after school',
    'now we are going upstairs and I will show you the other rooms in the house',
    'this is my favourite space and it feels very peaceful after a long day at work',
    'so that is the tour of our house and I hope you enjoyed looking around with us',
  ];
  const rows = groupCues(parts.map(cue));
  expect(rows.length).toBeGreaterThan(1);
  expect(Math.max(...rows.map((s) => s.original.length))).toBeLessThan(500);
  expect(joined(rows)).toBe(parts.join('').replace(/\s/g, ''));
});
it('明确的问答轮次不合并，位移符号不冒充换人', () => {
  const rows = groupCues([
    cue('>> Hello. Welcome to the show.'),
    cue('>> Thank you for having me.', 1),
  ]);
  expect(rows.map((s) => s.original)).toEqual([
    '>> Hello. Welcome to the show.',
    '>> Thank you for having me.',
  ]);
  expect(
    groupCues([
      cue('The expression value >> count shifts the bits to the right.'),
    ]),
  ).toHaveLength(1);
});
it('旧巨段升级恢复细粒度来源，不能全都跳回旧巨段开头', () => {
  const originals = Array.from({ length: 10 }, (_, i) =>
    cue(
      `This is complete sentence number ${i} describing another part of the lesson.`,
      i,
    ),
  );
  const old = segmentSchema.parse({
    id: 'old',
    startMs: 0,
    endMs: 32000,
    original: originals.map((c) => c.text).join(' '),
    segmentationVersion: 1,
    sourceSpans: originals.map((c) => ({
      cueId: c.id,
      startChar: 0,
      endChar: c.text.length,
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
    })),
  });
  const record = recordSchema.parse({
    videoId: 'v',
    title: '',
    revision: 0,
    segments: [old],
    notes: [],
    analysis: null,
  });
  const preview = previewTranscript(record);
  expect(preview.segments.length).toBeGreaterThan(1);
  expect(preview.segments.at(-1)!.startMs).toBeGreaterThan(0);
  expect(preview.segments[0].sourceSpans?.[0].cueId).toBe('c0');
  expect(record.segments).toEqual([old]);
});

it('旧版边界未变化时保留译文、标识与修订', () => {
  const old = {
    ...groupCues([cue('Welcome to our beautiful home.')])[0],
    segmentationVersion: 1,
    translated: '欢迎来到我们美丽的家。',
    revision: 4,
  };
  const record = recordSchema.parse({
    videoId: 'v',
    title: '',
    revision: 0,
    segments: [old],
    notes: [],
    analysis: null,
  });
  expect(previewTranscript(record).segments).toEqual([old]);
});

it('无法找到分句的长原文保留并提示，不硬切词语', () => {
  const text = 'beautiful wooden furniture '.repeat(40);
  const rows = groupCues([cue(text)]);
  expect(rows).toHaveLength(1);
  expect(rows[0].segmentationWarning).toBe('unresolved');
  expect(segmentSchema.parse(rows[0]).segmentationWarning).toBe('unresolved');
  expect(joined(rows)).toBe(text.replace(/\s/g, ''));
});

it('候选不能把宾语、从句引导词和搭配补语拆开', () => {
  const text =
    'this is the beautiful entrance hall '.repeat(3) +
    'I first viewed the house and it was a selling point ' +
    'when we moved in it was completely bare ' +
    'I think we have made great progress and I love the way that it looks ' +
    'this is the garden and we spend our evenings here '.repeat(8);
  const rows = groupCues([cue(text)]);
  for (const row of rows) {
    expect(row.original).not.toMatch(/(?:viewed|when|think|the way)$/i);
    expect(row.original).not.toMatch(/^(?:the house and it|that it looks)/i);
  }
});

it('已确认会话标记的同一字幕条目内也能切换轮次', () => {
  const rows = groupCues([
    cue('>> Thank you for having me >> Can you tell us about your work?'),
  ]);
  expect(rows.map((s) => s.original)).toEqual([
    '>> Thank you for having me',
    '>> Can you tell us about your work?',
  ]);
});
