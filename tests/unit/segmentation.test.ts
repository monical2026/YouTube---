import { describe, expect, it } from 'vitest';
import { groupCues } from '../../extension/src/segmentation';

const cue = (text: string, index: number, speaker?: string) => ({
  id: `c${index}`,
  text,
  startMs: index * 2500,
  endMs: index * 2500 + 5000,
  speaker,
});
const content = (segments: ReturnType<typeof groupCues>) =>
  segments
    .map((s) => s.original)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('完整句重组回归', () => {
  it('截图中的姓名和未完句跨条目连接，短完整句可以合并', () => {
    const text = [
      "There we go. Let's go. I'm Lorna",
      "Croshawn, Figma's Chief Design Officer,",
      "and I'm excited to welcome you to the",
      'second day of Config.',
    ];
    const result = groupCues(text.map((s, i) => cue(s, i)));
    expect(result).toHaveLength(1);
    expect(content(result)).toBe(text.join(' '));
  });
  it('截图中的 number E. 不再孤立', () => {
    const result = groupCues([
      cue('This is really the the meaning of that', 0),
      cue('number E.', 1),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe(
      'This is really the the meaning of that number E.',
    );
  });
  it('超过字符和时长目标的完整句不被硬切', () => {
    const text = [
      'The explanation includes',
      ...Array.from({ length: 12 }, () => 'several connected ideas and'),
      'ends here.',
    ];
    const result = groupCues(text.map((s, i) => cue(s, i)));
    expect(result).toHaveLength(1);
    expect(result[0].original.length).toBeGreaterThan(240);
    expect(result[0].endMs).toBeGreaterThan(20000);
  });
  it('字幕时间空隙不能把未完句硬切', () => {
    expect(
      groupCues([
        { ...cue('The most important thing is', 0), endMs: 1000 },
        { ...cue('how you use it.', 1), startMs: 8000, endMs: 10000 },
      ]),
    ).toHaveLength(1);
  });
  it('可靠换人保留短回应，未知身份不臆测', () => {
    const result = groupCues([
      cue('Are you ready?', 0, 'A'),
      cue('Yes.', 1, 'B'),
      cue('Let us begin.', 2, 'A'),
    ]);
    expect(result.map((s) => s.original)).toEqual([
      'Are you ready?',
      'Yes.',
      'Let us begin.',
    ]);
  });
  it('跨条目中间断句并向后比较，避免留下短尾巴', () => {
    const sentences = [
      'A'.repeat(149) + '.',
      'B'.repeat(79) + '.',
      'C'.repeat(69) + '.',
    ];
    const result = groupCues([cue(sentences.join(' '), 0)]);
    expect(result.map((s) => s.original)).toEqual([
      sentences[0],
      sentences.slice(1).join(' '),
    ]);
    expect(result.every((s) => s.startMs === 0 && s.endMs === 5000)).toBe(true);
  });
  it('保护缩写、小数、网址、引号和真实口语重复', () => {
    const text =
      'Dr. Smith explains e.g. the value 3.14 at example.com. He says "This is very, very important."';
    expect(content(groupCues([cue(text, 0)]))).toBe(text);
    const prefix = 'x '.repeat(105);
    const result = groupCues([
      cue(prefix + 'Dr. Smith gives a value of 3.14.', 0),
    ]);
    expect(result).toHaveLength(1);
  });
  it('中文完整句可以组合，中文单句也不因长度截断', () => {
    const text = '这是一个例子。接下来我们继续解释！';
    expect(groupCues([cue(text, 0)]).map((s) => s.original)).toEqual([text]);
  });
});

it('15000 条字幕的重组保真与播放索引开销', () => {
  const cues = Array.from({ length: 15000 }, (_, i) =>
    cue(`This sentence describes example ${i} in the lesson.`, i),
  );
  const start = performance.now();
  const result = groupCues(cues);
  const elapsedMs = performance.now() - start;
  expect(content(result)).toBe(cues.map((c) => c.text).join(' '));
  expect(new Set(result.map((s) => s.id)).size).toBe(result.length);
  console.info(
    JSON.stringify({
      case: '15000 条字幕重组',
      cues: cues.length,
      segments: result.length,
      elapsedMs: Math.round(elapsedMs),
    }),
  );
});

it('超过短引语保护范围后允许按内部完整句拆分，并保留全部原文', () => {
  const quote =
    'He says “' +
    'Useful words '.repeat(16) +
    '. ' +
    'More words '.repeat(8) +
    '.”';
  const next =
    'The next topic covers ' +
    'a different example with '.repeat(6) +
    'new details.';
  const result = groupCues([cue(quote + ' ' + next, 0)]);
  expect(result[0].original).toBe(quote.slice(0, quote.indexOf('.') + 1));
  expect(content(result)).toBe(quote + ' ' + next);
});

it('有效句末的长字幕间隔可以支持另起段，未知说话人不被标为已知身份', () => {
  const result = groupCues([
    { ...cue('Hello.', 0), endMs: 1000 },
    { ...cue('Another sentence.', 1, 'A'), startMs: 8000, endMs: 9000 },
  ]);
  expect(result).toHaveLength(2);
  expect(result[0].speaker).toBeUndefined();
});
