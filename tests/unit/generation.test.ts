import { it, expect } from 'vitest';
import { estimateCredits } from '../../service/src/generation';
it('生成估算按分钟上取整，不能少算最后不足一分钟', () =>
  expect(estimateCredits(61000, 2)).toBe(4));
it.each([
  [0, 2],
  [60000, null],
  [-1, 2],
  [60000, 0],
  [Number.NaN, 2],
])('没有可靠时长和规则时禁止估算 %s %s', (duration, rate) =>
  expect(() => estimateCredits(duration!, rate)).toThrow(),
);
