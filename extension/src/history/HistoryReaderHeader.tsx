import type { VideoRecord } from '@youtube-note/shared';
export function BookIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" />
    </svg>
  );
}
export function HistoryReaderHeader({
  record,
  tab,
  setTab,
  onReturn,
  onExport,
}: {
  record: VideoRecord | null;
  tab: string;
  setTab: (tab: string) => void;
  onReturn: () => void;
  onExport: () => void;
}) {
  return (
    <header className="history-reader-header">
      <h1>{record?.title || record?.videoId || '正在读取视频…'}</h1>
      <div className="history-reader-meta">
        {record && (
          <>
            <span>{record.notes.length} 条笔记</span>
            {!!record.updatedAt && (
              <span>
                最近更新{' '}
                {new Date(record.updatedAt).toLocaleDateString('zh-CN')}
              </span>
            )}
          </>
        )}
      </div>
      <div className="history-reader-actions">
        <button disabled={!record} onClick={onReturn}>
          返回原视频 ↗
        </button>
        <button className="primary" disabled={!record} onClick={onExport}>
          导出
        </button>
      </div>
      <nav className="tabs" aria-label="历史内容类型">
        {[
          ['transcript', '逐字稿', '☰'],
          ['analysis', '视频脉络', '⌘'],
          ['notes', '笔记', '▤'],
        ].map(([id, label, symbol]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            <span aria-hidden="true">{symbol}</span>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
