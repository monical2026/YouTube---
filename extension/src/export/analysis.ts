import {
  transcriptLanguage,
  timestamp,
  type Analysis,
  type Segment,
} from '@youtube-note/shared';
import { textItems, itemSources } from '../ui/analysis-format';
import type { Block } from './document';
function list(title: string, value: string | string[] | undefined): Block[] {
  const items = value === undefined ? [] : textItems(value);
  return items.length
    ? [
        {
          text: `${title}\n${items.map((s) => `• ${s}`).join('\n')}`,
          markdown: `**${title}**\n\n${items.map((s) => `- ${s}`).join('\n')}`,
        },
      ]
    : [];
}
function sourcedTitle(
  title: string,
  ranges: ReturnType<typeof itemSources>,
): Block[] {
  const range = ranges[0];
  return [
    {
      heading: true,
      text: `${range ? `${timestamp(range.startMs)}–${timestamp(range.endMs)} ` : ''}${title}`,
    },
  ];
}
function extras(ranges: ReturnType<typeof itemSources>): Block[] {
  const lines = ranges
    .slice(1)
    .map((r) => `${timestamp(r.startMs)}–${timestamp(r.endMs)} ${r.label}`);
  return lines.length
    ? [
        {
          text: `补充出处\n${lines.join('\n')}`,
          markdown: `<details>\n<summary>补充出处（${lines.length}）</summary>\n\n${lines.map((s) => `- ${s}`).join('\n')}\n\n</details>`,
        },
      ]
    : [];
}
export function analysisBlocks(a: Analysis, segments: Segment[]): Block[] {
  const blocks: Block[] = [
    { heading: true, text: '全片总结' },
    { text: a.summary },
    { heading: true, text: '全片切片判断' },
  ];
  blocks.push({
    text: ['高', '中', '低', '需核对画面']
      .map(
        (v) => `${v} ${a.topics.filter((t) => t.clipVerdict === v).length} 段`,
      )
      .join(' · '),
  });
  for (const value of ['高', '中', '需核对画面']) {
    const items = a.topics
      .filter((t) => t.clipVerdict === value)
      .map(
        (t) =>
          `${timestamp(t.startMs)}–${timestamp(t.endMs)} ${t.title}${value !== '高' ? `：${textItems(t.clipReason).join('；')}` : ''}`,
      );
    blocks.push(
      ...list(
        value === '高'
          ? '可直接剪出的片段'
          : value === '中'
            ? '需补少量背景的片段'
            : value,
        items,
      ),
    );
  }
  blocks.push({ text: '基于逐字稿判断内容独立性，未检查画面。' });
  for (const t of a.topics)
    blocks.push(
      {
        heading: true,
        text: `${timestamp(t.startMs)}–${timestamp(t.endMs)} ${t.title}`,
      },
      { text: t.introduction },
      ...list('解决的问题', t.problem),
      ...list('应用场景', t.application),
      ...list('要点', t.keyPoints),
      ...list(`切片价值：${t.clipVerdict}`, t.clipReason),
    );
  blocks.push({ heading: true, text: '关键点' });
  for (const k of a.knowledge ?? []) {
    const ranges = itemSources(k, segments);
    blocks.push(
      ...sourcedTitle(k.title, ranges),
      ...list('核心含义', k.understanding),
      ...list('在视频中的作用', k.role),
      ...extras(ranges),
    );
  }
  if (!a.knowledge?.length)
    blocks.push({ text: '本次未提取到有明确来源的关键点。' });
  blocks.push({ heading: true, text: '前置知识' });
  for (const p of a.prerequisites ?? [])
    blocks.push({ text: `${p.title}（${p.origin}）：${p.description}` });
  if (!a.prerequisites?.length) blocks.push({ text: '无特别前置要求。' });
  blocks.push({ heading: true, text: '金句' });
  for (const q of a.quotes) {
    const source = segments.find((s) => s.id === q.segmentId);
    blocks.push({
      text: `${q.category ?? ''} ${source ? timestamp(source.startMs) : ''}\n${source && transcriptLanguage([source]) === 'zh' ? q.original : `${q.chinese}\n${q.original}`}${q.category === '关键事实' ? '\n讲者陈述，未独立核实' : ''}`,
    });
  }
  if (!a.quotes.length) blocks.push({ text: '未发现符合独立表达要求的金句。' });
  blocks.push({ heading: true, text: '有效方法' });
  for (const m of a.methods) {
    const ranges = itemSources(m, segments);
    blocks.push(
      ...sourcedTitle(m.title, ranges),
      ...list('适用情况', m.applicability),
      ...list('具体做法', m.steps),
      ...list('条件与限制', m.limitations),
      ...extras(ranges),
    );
  }
  if (!a.methods.length)
    blocks.push({ text: '未提取到有足够具体做法的方法。' });
  for (const text of a.warnings ?? []) blocks.push({ text });
  return blocks;
}
