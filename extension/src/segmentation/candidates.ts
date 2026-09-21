import { sentenceEnds } from './boundaries';

export type Boundary = { offset: number; kind: 'sentence' | 'clause' | 'turn' };
const verbs =
  'am|is|are|was|were|have|has|had|do|does|did|can|could|will|would|should|must|might|may|think|know|believe|feel|feels|felt|love|loved|like|want|wanted|need|remember|realize|see|saw|look|looks|looked|mean|means|say|said|says|started|start|moved|move|spent|spend|spends|work|worked|works|met|meet|found|find|finds|took|take|takes|got|get|gets|made|make|makes|built|build|builds|decided|decide|hope|enjoy|enjoyed|use|used|uses|try|tried|keep|kept|go|goes|went|seem|seems|became|become|bought|brought|chose|choose|put|added|add|turn|turns|released|release|learn|learned|live|lived|lives';
const transition =
  '(?:(?:and so|and then|but then|so|but|however|anyway|now|next|finally|also|and)\\s+(?:(?:obviously|actually|of course|um|uh)\\s+)?)';
const subject =
  "(?:i|we|you|they|he|she|it|this|that|there|these|those)(?:['’](?:m|re|ve|d|ll|s)\\b|\\s+(?:(?:really|actually|absolutely|just|still|also|always|never|often|usually|probably|certainly|basically|honestly|now)\\s+){0,2}(?:" +
  verbs +
  ')\\b)';
const nounSubject =
  '(?:the|my|our|your|this|that|these|those)\\s+(?:[a-z]+\\s+){1,3}(?:is|are|was|were|feels|looks|seems)\\b';
const incomplete =
  /\b(?:a|an|the|of|to|for|with|from|into|about|than|as|and|or|but|because|when|while|if|although|unless|until|once|since|before|after|though|that|which|who|whose|where|whether|how|what|why|am|is|are|was|were|be|been|being|have|has|had|can|could|would|will|should|must|might|may|not|very|really|think|know|knew|say|says|said|mean|means|realize|realized|hope|wish|believe|feel|felt|see|saw|sure|thing|myself|way|obviously|course)\s*$/i;
const contraction =
  /\b(?:i|we|you|they|he|she|it|that|there)['’](?:m|re|ve|d|ll|s)\s*$/i;

function clauseOffsets(text: string, base: number, target: number): number[] {
  const firstPerson = subject.replace(
    'i|we|you|they|he|she|it|this|that|there|these|those',
    'i|we',
  );
  const pattern = new RegExp(
    '\\b(?:' +
      transition +
      '(?:' +
      subject +
      '|' +
      nounSubject +
      ')|' +
      firstPerson +
      "|(?:so|now|next|then)\\s+(?:welcome|let[’']s|let us|next)\\b|this\\s+(?:uh\\s+)?(?:[a-z]+\\s+)?is\\b|(?:thanks?\\s+(?:you|so much)|hi\\s+everyone)\\b)",
    'gi',
  );
  const offsets: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    const left = text.slice(0, at).trimEnd();
    if (at < target * 0.35 || text.length - at < target * 0.25) continue;
    if (
      incomplete.test(left) ||
      contraction.test(left) ||
      /["“‘([]$/.test(left)
    )
      continue;
    offsets.push(base + at);
  }
  return offsets;
}

// 先确认会话标记惯例；未确认时只采纳条目开头或句末后的标记。
function turnOffsets(text: string, cueStarts: Set<number>): number[] {
  const turns: number[] = [];
  const conversational =
    /^(?:hello|hi|thank|thanks|yes|yeah|no|well|right|okay|sure|so|and|but|i|we|you|what|how|why|can|do|does|is|are|it|that|the|this|wild|let['’]s|um|uh|could|would|exactly|absolutely)\b/i;
  const markers = [...text.matchAll(/>>\s+/g)];
  const markedConversation =
    text.trimStart().startsWith('>> ') ||
    markers.filter(
      (m) =>
        cueStarts.has(m.index) &&
        conversational.test(text.slice(m.index + m[0].length)),
    ).length >= 2;
  for (const match of markers) {
    const at = match.index;
    const left = text.slice(Math.max(0, at - 10), at).trimEnd();
    if (
      !markedConversation &&
      at > 0 &&
      !cueStarts.has(at) &&
      !/[.!?。！？]["”']?$/.test(left)
    )
      continue;
    if (conversational.test(text.slice(at + match[0].length))) turns.push(at);
  }
  return turns;
}

export function readingBoundaries(
  text: string,
  cueStarts: Set<number>,
  target: number,
): Boundary[] {
  const boundaries = new Map<number, Boundary['kind']>();
  for (const offset of sentenceEnds(text)) boundaries.set(offset, 'sentence');
  for (const offset of turnOffsets(text, cueStarts))
    if (offset > 0) boundaries.set(offset, 'turn');
  const strong = [...boundaries.keys()].sort((a, b) => a - b);
  let from = 0;
  for (const to of strong) {
    // 超长只触发分句候选搜索，没有候选时保留原文并报告，不按定长截断。
    if (to - from > target * 2) {
      for (const offset of clauseOffsets(text.slice(from, to), from, target))
        if (!boundaries.has(offset)) boundaries.set(offset, 'clause');
    }
    from = to;
  }
  return [...boundaries]
    .sort(([a], [b]) => a - b)
    .map(([offset, kind]) => ({ offset, kind }));
}
