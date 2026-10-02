import type { HistoryEntry } from './records';

export function HistoryRecordMeta({
  entry,
  date,
}: {
  entry: HistoryEntry;
  date: number;
}) {
  const recordedAt = date ? new Date(date) : undefined;
  return (
    <>
      <span className="history-meta">
        {entry.hasTranscript && (
          <span className="history-content-kind">逐字稿</span>
        )}
        {entry.hasAnalysis && (
          <span className="history-content-kind">脉络</span>
        )}
        <span className="history-note-count">{entry.noteCount} 条笔记</span>
        {entry.draftCount > 0 && (
          <span className="history-note-count">{entry.draftCount} 条草稿</span>
        )}
      </span>
      <span className="history-date">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path d="M5.5 2v3M10.5 2v3M2.5 7h11" strokeLinecap="round" />
        </svg>
        {recordedAt ? (
          <>
            <span>最近学习</span>
            <time dateTime={recordedAt.toISOString()}>
              {recordedAt.toLocaleDateString('zh-CN')}
            </time>
          </>
        ) : (
          '日期未记录'
        )}
      </span>
    </>
  );
}
