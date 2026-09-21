const section =
  /^(?:#{1,6}\s*)?(?:\d+[.、]\s*)?(?:\*\*)?(摘录内容|视频依据|通俗解释|准确概念|补充解释|具体例子|适用边界|直接回答)(?:[：:]?\*\*|\*\*[：:]?|[：:]|$)\s*(.*)$/;
export function answerSections(text: string) {
  const normalized = text
    .split('\n')
    .flatMap((line) => {
      const match = line.trim().match(section);
      return match ? ['', `## ${match[1]}`, '', match[2], ''] : [line];
    })
    .join('\n');
  return normalized.split(/\n\s*\n/).filter((block) => block.trim());
}
export function answerHeading(block: string): string | undefined {
  const match = block
    .trim()
    .match(
      /^## (摘录内容|视频依据|通俗解释|准确概念|补充解释|具体例子|适用边界|直接回答)$/,
    );
  return match?.[1];
}
