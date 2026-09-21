import { timestamp, type VideoRecord, type Mode } from '@youtube-note/shared';
export function transcriptText(record: VideoRecord, mode: Mode): string {
  return record.segments
    .map(
      (s) =>
        `[${timestamp(s.startMs)} – ${timestamp(s.endMs)}]\n${[mode !== 'chinese' ? s.original : '', mode !== 'original' ? s.translated : ''].filter(Boolean).join('\n')}`,
    )
    .join('\n\n');
}
export function notesMarkdown(record: VideoRecord): string {
  return (
    `# ${record.title}\n\n` +
    record.notes
      .map(
        (n) =>
          `## [${timestamp(n.startMs)}](https://www.youtube.com/watch?v=${record.videoId}&t=${Math.floor(n.startMs / 1000)})${n.draft ? ' · 草稿' : ''}\n\n${n.selectedText ? `> ${n.selectedText.replaceAll('\n', '\n> ')}\n\n` : ''}${n.original}\n\n${n.translated}\n\n${n.thought ? `💡 ${n.thought}\n\n` : ''}${n.question ? `❓ ${n.question}\n` : ''}`,
      )
      .join('\n')
  );
}
export function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/plain;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
