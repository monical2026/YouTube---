import type { HistoryEntry } from './records';

// Keep ordering dates stable for this page session, including undated records.
export function retainHistoryDates(
  previous: Record<string, number>,
  entries: HistoryEntry[],
  opened: Record<string, number> = {},
): Record<string, number> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.videoId,
      previous[entry.videoId] ??
        Math.max(entry.updatedAt ?? 0, opened[entry.videoId] ?? 0),
    ]),
  );
}
