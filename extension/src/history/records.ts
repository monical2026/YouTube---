import { z } from 'zod';
import type { VideoRecord } from '@youtube-note/shared';
export const historyEntrySchema = z.object({
  videoId: z.string(),
  title: z.string(),
  updatedAt: z.number().optional(),
  hasTranscript: z.boolean(),
  hasAnalysis: z.boolean(),
  noteCount: z.number(),
  draftCount: z.number(),
  notes: z.array(z.object({ id: z.string(), fields: z.array(z.string()) })),
});
export const historyListSchema = z.object({
  entries: z.array(historyEntrySchema),
  invalidCount: z.number(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export function historyEntry(record: VideoRecord): HistoryEntry {
  const updatedAt = Math.max(
    record.updatedAt ?? 0,
    ...record.notes.map((n) => n.updatedAt),
  );
  return {
    videoId: record.videoId,
    title: record.title || record.notes[0]?.title || record.videoId,
    updatedAt: updatedAt || undefined,
    hasTranscript: record.segments.length > 0,
    hasAnalysis: !!record.analysis,
    noteCount: record.notes.length,
    draftCount: record.notes.filter((n) => n.draft).length,
    notes: record.notes.map((n) => ({
      id: n.id,
      fields: [
        ...(n.selectedText !== undefined
          ? [n.selectedText]
          : [n.original, n.translated]),
        n.thought,
        n.question,
      ],
    })),
  };
}
export function snippet(text: string, query: string): string {
  const at = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, at - 24);
  const end = Math.min(text.length, Math.max(start + 110, at + query.length));
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
export function searchHistory(entries: HistoryEntry[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  return entries.flatMap((entry) => {
    const hits = term
      ? entry.notes.flatMap((note) => {
          const field = note.fields.find((text) =>
            text.toLocaleLowerCase().includes(term),
          );
          return field === undefined
            ? []
            : [{ noteId: note.id, text: snippet(field, term) }];
        })
      : [];
    return !term ||
      entry.title.toLocaleLowerCase().includes(term) ||
      hits.length
      ? [{ entry, hits }]
      : [];
  });
}
