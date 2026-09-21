// 句末标点层只保护短引用；长引用和不完整引号不屏蔽远处句末。
const titleAbbreviations =
  /^(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|fig|eq|no|vol|inc)$/i;
const commonAbbreviations = /^(?:e\.g|i\.e|a\.m|p\.m)$/i;
const sentenceStarters =
  /^(?:I|We|You|He|She|It|They|The|This|That|These|Those|There|Here|Now|Next|However|But|So|And)\b/;

function specialPeriod(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 32), index);
  const after = text.slice(index + 1).trimStart();
  const token = before.match(/([a-zA-Z.]+)$/)?.[1] ?? '';
  if (/\d$/.test(before) && /^\d/.test(text.slice(index + 1))) return true;
  if (titleAbbreviations.test(token) || commonAbbreviations.test(token))
    return true;
  if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(token) || /^[A-Z]$/.test(token))
    return !sentenceStarters.test(after);
  return false;
}

export function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const quotations = [
    ...text.matchAll(/"[^"\n]*"|“[^”]*”|「[^」]*」|『[^』]*』/g),
  ]
    .filter((m) => m[0].length <= 240)
    .map((m) => ({ from: m.index, to: m.index + m[0].length }));
  let quoteIndex = 0;
  const marks = /[.!?。！？]+["”’')\]】」』]*/g;
  for (const match of text.matchAll(marks)) {
    const index = match.index;
    const end = index + match[0].length;
    while (quoteIndex < quotations.length && quotations[quoteIndex].to <= index)
      quoteIndex++;
    const quotation = quotations[quoteIndex];
    if (quotation && quotation.from < index && end < quotation.to) continue;
    // 英文网址、缩写内部的点后没有空白；中文标点不要求空白。
    if (/^[.!?]/.test(match[0]) && end < text.length && !/\s/.test(text[end]))
      continue;
    if (match[0].startsWith('...')) continue;
    if (match[0][0] === '.' && specialPeriod(text, index)) continue;
    const next = text.slice(end).trimStart();
    if (
      /["”’']$/.test(match[0]) &&
      /^(?:(?:he|she|they)\s+)?(?:said|says|asked|replied)\b/.test(next)
    )
      continue;
    ends.push(end);
  }
  if (ends.at(-1) !== text.length) ends.push(text.length);
  return ends;
}
