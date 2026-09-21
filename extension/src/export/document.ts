import { textItems } from '../ui/analysis-format';
import { timestamp, type Mode, type VideoRecord } from '@youtube-note/shared';
import { transcriptText } from './index';
export type ExportSection = 'transcript' | 'notes' | 'analysis';
export type Block = { heading?: boolean; text: string; markdown?: string };
export function exportBlocks(
  record: VideoRecord,
  mode: Mode,
  sections: ExportSection[],
): Block[] {
  const blocks: Block[] = [
    { heading: true, text: record.title },
    { text: `https://www.youtube.com/watch?v=${record.videoId}` },
  ];
  if (sections.includes('transcript'))
    blocks.push(
      { heading: true, text: '逐字稿' },
      { text: transcriptText(record, mode) || '暂无逐字稿' },
    );
  if (sections.includes('notes')) {
    blocks.push({ heading: true, text: '笔记' });
    for (const note of record.notes)
      blocks.push(
        {
          heading: true,
          text: timestamp(note.startMs) + (note.draft ? ' · 草稿' : ''),
        },
        ...[
          note.sourceKind === 'analysis' ? '引用性质：AI 梳理摘录' : '',
          note.excerptTitle,
          note.excerptEdited ? '摘录已手动编辑' : '',
          note.selectedText,
          note.selectedText === undefined && note.original,
          note.selectedText === undefined && note.translated,
          note.thought && `💡 ${note.thought}`,
          note.question && `❓ 待理解的问题：${note.question}`,
          ...(note.aiConversation ?? []).map(
            (turn) =>
              `AI 提问：${turn.question}\nAI 回答（需核对）：${turn.answer}`,
          ),
        ]
          .filter((text): text is string => !!text)
          .map((text) => ({
            text,
            markdown:
              text === note.selectedText ? note.excerptMarkdown : undefined,
          })),
      );
    if (!record.notes.length) blocks.push({ text: '暂无笔记' });
  }
  if (sections.includes('analysis')) {
    blocks.push({ heading: true, text: '视频脉络' });
    const a = record.analysis;
    if (!a) blocks.push({ text: '暂无视频脉络' });
    else {
      blocks.push({ heading: true, text: '全片总结' }, { text: a.summary });
      if (a.clipOverview)
        blocks.push(
          { heading: true, text: '全片切片判断' },
          { text: a.clipOverview },
        );
      blocks.push({ text: '基于逐字稿，仅初步判断内容独立性，未检查画面。' });
      for (const t of a.topics)
        blocks.push(
          {
            heading: true,
            text: `${timestamp(t.startMs)}–${timestamp(t.endMs)} ${t.title}`,
          },
          { text: t.introduction },
          {
            text: `解决问题：${textItems(t.problem)
              .map((s) => `• ${s}`)
              .join(
                '\n',
              )}\n适用场景${t.applicationOrigin ? `（${t.applicationOrigin}）` : ''}：${textItems(
              t.application,
            )
              .map((s) => `• ${s}`)
              .join('\n')}\n切片建议：${t.clipVerdict ?? ''} ${textItems(
              t.clipReason,
            )
              .map((s) => `• ${s}`)
              .join('\n')}`,
          },
        );
      blocks.push({ heading: true, text: '知识清单' });
      for (const item of a.knowledge ?? [])
        blocks.push(
          { heading: true, text: item.title },
          {
            text: `需要理解：${textItems(item.understanding)
              .map((t) => `• ${t}`)
              .join('\n')}\n视频中的作用：${textItems(item.role)
              .map((t) => `• ${t}`)
              .join('\n')}\n对应时间：${item.segmentIds
              .flatMap((id) => {
                const s = record.segments.find((s) => s.id === id);
                return s ? [timestamp(s.startMs)] : [];
              })
              .join('、')}`,
          },
        );
      blocks.push({ heading: true, text: '前置知识' });
      for (const item of a.prerequisites ?? [])
        blocks.push({
          text: `${item.title}（${item.origin}）：${item.description}`,
        });
      blocks.push({ heading: true, text: '金句' });
      for (const q of a.quotes) {
        const source = record.segments.find((s) => s.id === q.segmentId);
        blocks.push({
          text: `${q.category ?? ''} ${source ? timestamp(source.startMs) : ''}\n${q.original}\n${q.chinese}${q.category === '关键事实' ? '\n讲者陈述，未独立核实' : ''}`,
        });
      }
      blocks.push({ heading: true, text: '有效方法' });
      for (const m of a.methods)
        blocks.push({ heading: true, text: m.title }, { text: m.description });
      for (const warning of a.warnings ?? []) blocks.push({ text: warning });
    }
  }
  return blocks;
}
export const escapeXml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
export function exportText(blocks: Block[], markdown: boolean) {
  return blocks
    .map(
      (block, i) =>
        `${markdown && block.heading ? (i === 0 ? '# ' : '## ') : ''}${markdown ? (block.markdown ?? block.text) : block.text}`,
    )
    .join('\n\n');
}
export function printPdf(blocks: Block[]) {
  const view = window.open('', '_blank');
  if (!view) throw new Error('浏览器拦截了导出窗口，请允许弹窗后重试');
  view.document.write(
    `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${escapeXml(blocks[0].text)}</title><style>body{font:14px/1.8 system-ui;margin:32px;color:#222}p{white-space:pre-wrap;overflow-wrap:anywhere}h2{font-size:18px;break-after:avoid}@page{size:A4;margin:18mm}@media print{button{display:none}}</style></head><body><button id="print">打印 / 保存为 PDF</button>${blocks.map((b) => `<${b.heading ? 'h2' : 'p'}>${escapeXml(b.text)}</${b.heading ? 'h2' : 'p'}>`).join('')}</body></html>`,
  );
  view.document.close();
  const button = view.document.getElementById('print');
  button?.addEventListener('click', () => view.print());
  view.focus();
  view.print();
}
