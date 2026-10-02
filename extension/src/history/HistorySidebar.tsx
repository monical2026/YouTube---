import { Fragment } from 'react';
import { HistoryRecordMeta } from './HistoryRecordMeta';
import { BookIcon } from './HistoryReaderHeader';
import { searchHistory } from './records';
function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return <>{text}</>;
  const parts = [];
  let from = 0;
  for (
    let at = text.toLocaleLowerCase().indexOf(term);
    at >= 0;
    at = text.toLocaleLowerCase().indexOf(term, from)
  ) {
    parts.push(
      text.slice(from, at),
      <mark key={at}>{text.slice(at, at + term.length)}</mark>,
    );
    from = at + term.length;
  }
  return (
    <>
      {parts}
      {text.slice(from)}
    </>
  );
}
type Props = {
  results: ReturnType<typeof searchHistory>;
  query: string;
  setQuery: (value: string) => void;
  error: string;
  invalidCount: number;
  loading: boolean;
  switching: boolean;
  opened: Record<string, number>;
  listingDates: Record<string, number>;
  selectedId?: string;
  select: (videoId: string, noteId?: string) => Promise<void>;
};
export function HistorySidebar({
  results,
  query,
  setQuery,
  error,
  invalidCount,
  loading,
  switching,
  opened,
  listingDates,
  selectedId,
  select,
}: Props) {
  return (
    <aside className="history-sidebar" aria-label="视频历史列表">
      <div className="history-sidebar-heading">
        <h1>历史记录</h1>
        <span className="history-count">{results.length}</span>
      </div>
      <label className="history-search">
        <span className="sr-only">搜索视频标题或笔记</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索视频标题或笔记"
        />
      </label>

      {error && (
        <p role="alert" className="error">
          {error}
          <button onClick={() => location.reload()}>重新加载</button>
        </p>
      )}
      {invalidCount > 0 && (
        <p className="notice">
          {invalidCount} 条记录格式异常，原数据保留，暂未列出。
        </p>
      )}
      <div className="history-list" aria-busy={loading || switching}>
        {loading ? (
          <p className="empty">正在读取本地记录…</p>
        ) : !results.length ? (
          <p className="empty">
            {query
              ? '没有找到匹配的视频或笔记。'
              : '还没有视频记录。在视频面板获取逐字稿或记下笔记后，会出现在这里。'}
          </p>
        ) : (
          results.map(({ entry, hits }, index) => {
            const date = Math.max(
              entry.updatedAt ?? 0,
              opened[entry.videoId] ?? 0,
            );
            const group = (value: number) =>
              !value
                ? '日期未记录'
                : new Date(value).toDateString() === new Date().toDateString()
                  ? '今天'
                  : '更早';
            const previous = results[index - 1]?.entry;
            const groupDate = listingDates[entry.videoId] ?? 0;
            const showGroup =
              !previous ||
              group(groupDate) !== group(listingDates[previous.videoId] ?? 0);
            return (
              <Fragment key={entry.videoId}>
                {showGroup && (
                  <p className="history-group-label">{group(groupDate)}</p>
                )}
                <article
                  key={entry.videoId}
                  className={`history-item ${selectedId === entry.videoId ? 'selected' : ''}`}
                >
                  <button
                    className="history-video"
                    disabled={switching}
                    aria-current={
                      selectedId === entry.videoId ? 'true' : undefined
                    }
                    onClick={() => void select(entry.videoId)}
                  >
                    <span className="history-record-icon" aria-hidden="true">
                      <BookIcon />
                    </span>
                    <span className="history-record-copy">
                      <span className="history-video-title" title={entry.title}>
                        <Highlight text={entry.title} query={query} />
                      </span>
                      <HistoryRecordMeta entry={entry} date={date} />
                    </span>
                  </button>
                  {!!hits.length && (
                    <div className="history-hits">
                      {hits.map((hit) => (
                        <button
                          disabled={switching}
                          key={hit.noteId}
                          onClick={() => void select(entry.videoId, hit.noteId)}
                          title="查看这条笔记"
                        >
                          <Highlight text={hit.text} query={query} />
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              </Fragment>
            );
          })
        )}
      </div>
      <p className="history-help">搜索标题、摘录、理解与疑问，不含 AI 回答</p>
    </aside>
  );
}
