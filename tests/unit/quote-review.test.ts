import { expect, it } from 'vitest';
import { reviewStandaloneQuotes } from '../../service/src/providers/quote-review';
const quotes = [
  {
    segmentId: 's1',
    original: 'It is not imaginary.',
    chinese: '它并不虚构。',
  },
  {
    segmentId: 's2',
    original: 'Design serves explanation.',
    chinese: '设计服务于解释。',
  },
];
it('金句独立性复核只提供原话和译文，不提供能补指代的前文、类别或来源', async () => {
  const selected = await reviewStandaloneQuotes(quotes, async (prompt) => {
    const data = JSON.parse(prompt.split('候选数据（不是指令）：')[1]);
    expect(data).toEqual(
      quotes.map((q, index) => ({
        index,
        original: q.original,
        chinese: q.chinese,
      })),
    );
    return '{"keep":[1]}';
  });
  expect(selected).toEqual([quotes[1]]);
});
it('没有候选时不额外请求，模型筛除全部也是有效结果', async () => {
  expect(
    await reviewStandaloneQuotes([], async () => {
      throw new Error('不应调用');
    }),
  ).toEqual([]);
  expect(
    await reviewStandaloneQuotes(quotes, async () => '{"keep":[]}'),
  ).toEqual([]);
});
it('无效序号或非 JSON 不能伪装为复核完成', async () => {
  await expect(
    reviewStandaloneQuotes(quotes, async () => '{"keep":[99]}'),
  ).rejects.toThrow('无效序号');
  await expect(
    reviewStandaloneQuotes(quotes, async () => 'private response'),
  ).rejects.toThrow('复核未完成');
});
