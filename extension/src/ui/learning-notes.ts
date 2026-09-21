import {
  questionRequestSchema,
  type Note,
  type VideoRecord,
} from '@youtube-note/shared';
export type Excerpt = {
  text: string;
  markdown?: string;
  fontSize?: number;
  title?: string;
  ids: string[];
  sourceKind: 'transcript' | 'analysis';
  language?: 'original' | 'translated' | 'mixed';
};
export function excerptNote(record: VideoRecord, excerpt: Excerpt): Note {
  const sources = record.segments.filter((s) => excerpt.ids.includes(s.id));
  const first = sources[0];
  if (!first) throw new Error('摘录来源已变化，请重新选择');
  return {
    id: crypto.randomUUID(),
    videoId: record.videoId,
    title: record.title,
    startMs: first.startMs,
    segmentId: first.id,
    sourceRevision: first.revision,
    sourceSegmentIds: sources.map((s) => s.id),
    sourceKind: excerpt.sourceKind,
    original: '',
    translated: '',
    excerptTitle: excerpt.title,
    selectedText: excerpt.text,
    excerptMarkdown: excerpt.markdown,
    excerptFontSize: excerpt.fontSize,
    selectionLanguage: excerpt.language,
    thought: '',
    question: '',
    revision: 0,
    draft: true,
    updatedAt: Date.now(),
  };
}
export function questionPayload(note: Note, question: string) {
  return questionRequestSchema.parse({
    task: 'ask',
    videoId: note.videoId,
    question,
    excerpt: note.selectedText ?? '',
    excerptTitle: note.excerptTitle,
    sourceKind: note.sourceKind,
    excerptEdited: note.excerptEdited,
    sources: [
      {
        id: note.segmentId,
        startMs: note.startMs,
        original: note.selectedText !== undefined ? '' : note.original,
      },
    ],
    history: (note.aiConversation ?? [])
      .slice(-4)
      .map(({ question, answer }) => ({ question, answer })),
  });
}
