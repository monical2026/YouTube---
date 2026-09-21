import type { Segment } from '@youtube-note/shared';
export function textItems(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
  return value
    .split(/\n+|(?<=[。；])\s*/u)
    .map((s) => s.replace(/^\s*(?:[-•]|\d+[.、])\s*/, '').trim())
    .filter(Boolean);
}
// 来源按逐字稿顺序排列，只合并相邻片段或重叠时间范围，保留实际引用标识。
export function sourceRanges(ids: string[], segments: Segment[]) {
  const selected = new Set(ids);
  const ranges: { startMs: number; endMs: number; ids: string[] }[] = [];
  let previous = -2;
  segments.forEach((s, index) => {
    if (!selected.has(s.id)) return;
    const last = ranges.at(-1);
    if (last && (index === previous + 1 || s.startMs <= last.endMs)) {
      last.endMs = Math.max(last.endMs, s.endMs);
      last.ids.push(s.id);
    } else ranges.push({ startMs: s.startMs, endMs: s.endMs, ids: [s.id] });
    previous = index;
  });
  return ranges;
}
