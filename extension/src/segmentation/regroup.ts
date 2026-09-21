import type { Segment } from '@youtube-note/shared';
import { readingBoundaries, type Boundary } from './candidates';
import { recoverCues } from './sources';

export const SEGMENTATION_VERSION = 2;
export type Cue = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  sourceId?: string;
  sourceStartChar?: number;
};
type LocatedCue = Cue & { from: number; to: number };
type Unit = {
  from: number;
  to: number;
  length: number;
  pause: boolean;
  kind: Boundary['kind'];
};

function joinCues(cues: Cue[]) {
  let text = '';
  const located: LocatedCue[] = [];
  for (const cue of cues) {
    const separator =
      text &&
      !/\s$/.test(text) &&
      !/^\s|^[,.;!?，。；！？]/.test(cue.text) &&
      !(/[\u3400-\u9fff]$/.test(text) && /^[\u3400-\u9fff]/.test(cue.text))
        ? ' '
        : '';
    text += separator;
    const from = text.length;
    text += cue.text;
    located.push({ ...cue, from, to: text.length });
  }
  return { text, located };
}

function unitsOf(text: string, cues: LocatedCue[], target: number): Unit[] {
  const units: Unit[] = [];
  let from = 0;
  let cursor = 0;
  const starts = new Set(
    cues.map((c) => c.from + (c.text.length - c.text.trimStart().length)),
  );
  for (const { offset: to, kind } of readingBoundaries(text, starts, target)) {
    if (!text.slice(from, to).trim()) {
      if (kind === 'turn' && units.length) units[units.length - 1].kind = kind;
      continue;
    }
    while (cursor + 1 < cues.length && cues[cursor].to < to) cursor++;
    const next = cues[cursor + 1];
    const pause =
      !!next &&
      !text.slice(to, cues[cursor].to).trim() &&
      next.startMs - cues[cursor].endMs >= 1400;
    units.push({
      from,
      to,
      length: text.slice(from, to).trim().length,
      pause,
      kind,
    });
    from = to;
  }
  // 尾部空白仍归属于最后一句，保持来源文本可重建。
  if (units.length) units[units.length - 1].to = text.length;
  return units;
}

function chooseGroups(units: Unit[], target: number): [number, number][] {
  const costs = new Float64Array(units.length + 1);
  const next = new Uint32Array(units.length);
  // 每个起点最多比较后面 32 个句子或分句候选，不在词语中间硬切。
  for (let i = units.length - 1; i >= 0; i--) {
    let length = 0,
      crossedPauses = 0;
    costs[i] = Infinity;
    for (let j = i; j < Math.min(units.length, i + 32); j++) {
      if (j > i && units[j - 1].kind === 'turn') break;
      length += units[j].length + (j > i ? 1 : 0);
      if (j > i && units[j - 1].pause) crossedPauses++;
      const deviation = (length - target) / target;
      const cost =
        deviation * deviation * (deviation > 0 ? 4 : 1) +
        0.18 +
        (units[j].kind === 'clause' ? 0.35 : 0) +
        crossedPauses * 3 +
        costs[j + 1];
      if (cost < costs[i]) {
        costs[i] = cost;
        next[i] = j + 1;
      }
      if (length > target * 2) break;
    }
  }
  const groups: [number, number][] = [];
  for (let i = 0; i < units.length; i = next[i])
    groups.push([units[i].from, units[next[i] - 1].to]);
  return groups;
}

function groupBlock(cues: Cue[]): Segment[] {
  const { text, located } = joinCues(cues);
  // 中文字符占多数时采用独立软目标，不按中文译文重切英文原稿。
  const target =
    (text.match(/[\u3400-\u9fff]/g)?.length ?? 0) > text.length / 2 ? 100 : 220;
  const units = unitsOf(text, located, target);
  const inferred = new Set(
    units.filter((u) => u.kind === 'clause').map((u) => u.to),
  );
  const ranges = chooseGroups(units, target);
  let cursor = 0;
  const speaker = cues.every((c) => c.speaker === cues[0].speaker)
    ? cues[0].speaker
    : undefined;
  return ranges.map(([from, to]) => {
    while (cursor < located.length && located[cursor].to <= from) cursor++;
    const sourceSpans: NonNullable<Segment['sourceSpans']> = [];
    for (let i = cursor; i < located.length && located[i].from < to; i++) {
      const cue = located[i];
      const startChar = Math.max(from, cue.from) - cue.from;
      const endChar = Math.min(to, cue.to) - cue.from;
      if (endChar > startChar)
        sourceSpans.push({
          cueId: cue.sourceId ?? cue.id,
          startChar: (cue.sourceStartChar ?? 0) + startChar,
          endChar: (cue.sourceStartChar ?? 0) + endChar,
          text: cue.text.slice(startChar, endChar),
          startMs: cue.startMs,
          endMs: cue.endMs,
        });
    }
    const first = sourceSpans[0],
      last = sourceSpans[sourceSpans.length - 1];
    return {
      id: `reading-${SEGMENTATION_VERSION}-${encodeURIComponent(first.cueId)}-${first.startChar}-${encodeURIComponent(last.cueId)}-${last.endChar}`,
      sourceCueIds: [...new Set(sourceSpans.map((s) => s.cueId))],
      sourceSpans,
      segmentationVersion: SEGMENTATION_VERSION,
      segmentationWarning:
        to - from > target * 2
          ? 'unresolved'
          : inferred.has(from) || inferred.has(to)
            ? 'inferred'
            : undefined,
      speaker,
      startMs: first.startMs,
      endMs: sourceSpans.reduce(
        (end, s) => Math.max(end, s.endMs),
        first.startMs,
      ),
      original: text.slice(from, to).replace(/\s+/g, ' ').trim(),
      translated: '',
      revision: 0,
      manual: false,
      engine: '',
    };
  });
}

export function groupCues(cues: Cue[]): Segment[] {
  const sorted = [...cues]
    .filter((c) => c.text.trim())
    .sort((a, b) => a.startMs - b.startMs);
  const ids = new Set<string>();
  for (const cue of sorted) {
    if (
      !Number.isFinite(cue.startMs) ||
      !Number.isFinite(cue.endMs) ||
      cue.startMs < 0 ||
      cue.endMs < cue.startMs ||
      ids.has(cue.id)
    )
      throw new Error('字幕时间或来源编号无效，未修改原始内容');
    ids.add(cue.id);
  }
  const result: Segment[] = [];
  let block: Cue[] = [],
    speaker: string | undefined;
  for (const cue of sorted) {
    if (speaker && cue.speaker && speaker !== cue.speaker) {
      result.push(...groupBlock(block));
      block = [];
    }
    if (cue.speaker) speaker = cue.speaker;
    block.push(cue);
  }
  if (block.length) result.push(...groupBlock(block));
  return result;
}

// 已重组结果直接复用；旧来源不反复分段，也不清空已有译文。
export function prepareSegments(segments: Segment[]): Segment[] {
  if (segments.every((s) => s.segmentationVersion === SEGMENTATION_VERSION))
    return segments;
  if (segments.some((s) => s.manual || s.translated))
    throw new Error('已有编辑或译文，请使用重新分段预览');
  return groupCues(recoverCues(segments));
}
