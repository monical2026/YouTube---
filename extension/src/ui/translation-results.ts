import type { Segment } from '@youtube-note/shared';
export type TranslationCandidate = {
  id: string;
  revision: number;
  text: string;
};
export function applyTranslations(
  segments: Segment[],
  rows: TranslationCandidate[],
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const conflicts: TranslationCandidate[] = [];
  const updated = segments.map((segment) => {
    const row = byId.get(segment.id);
    if (!row) return segment;
    if (segment.manual || segment.revision !== row.revision) {
      conflicts.push(row);
      return segment;
    }
    return {
      ...segment,
      translated: row.text,
      engine: 'llm',
      revision: segment.revision + 1,
    };
  });
  return { segments: updated, conflicts };
}
