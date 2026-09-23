import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { App } from '../ui/App';
import { rpc, errorText } from '../lib/rpc';
import { historyListSchema, searchHistory, type HistoryEntry } from './records';
import './history.css';
export type LeaveReader = () => Promise<boolean>;
export type HistoryReader = {
  videoId: string;
  noteId?: string;
  selectionKey: number;
  registerLeave: (leave: LeaveReader | null) => void;
};
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
export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [invalidCount, setInvalidCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [selected, setSelected] = useState<{
    videoId: string;
    noteId?: string;
    selectionKey: number;
  } | null>(null);
  const [opened, setOpened] = useState<Record<string, number>>({});
  const leave = useRef<LeaveReader | null>(null);
  const switchLock = useRef(false);
  const registerLeave = useCallback((callback: LeaveReader | null) => {
    leave.current = callback;
  }, []);
  useEffect(() => {
    document.title = '历史记录 · 学习笔记';
    let disposed = false,
      request = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(initial = false) {
      const token = ++request;
      try {
        const list = historyListSchema.parse(
          await rpc({ type: 'listHistory' }),
        );
        if (disposed) return;
        if (token === request) {
          setEntries(list.entries);
          setInvalidCount(list.invalidCount);
        }
        if (initial) {
          const stored = await chrome.storage.local.get([
            'historyLastVideo',
            'historyOpened',
          ]);
          if (disposed) return;
          const times = z
            .record(z.string(), z.number().nonnegative())
            .safeParse(stored.historyOpened);
          const dates = times.success ? times.data : {};
          setOpened(dates);
          const explicit = new URLSearchParams(location.search).get('video');
          const last =
            typeof stored.historyLastVideo === 'string'
              ? stored.historyLastVideo
              : '';
          const first = [...list.entries].sort(
            (a, b) =>
              Math.max(b.updatedAt ?? 0, dates[b.videoId] ?? 0) -
              Math.max(a.updatedAt ?? 0, dates[a.videoId] ?? 0),
          )[0];
          const id =
            explicit && /^[\w-]{11}$/.test(explicit)
              ? explicit
              : (list.entries.find((e) => e.videoId === last)?.videoId ??
                first?.videoId);
          if (id) setSelected({ videoId: id, selectionKey: 0 });
        }
      } catch (e) {
        if (!disposed) setError(errorText(e));
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void refresh(true);
    const port = chrome.runtime.connect({ name: 'history-list' });
    port.onMessage.addListener((message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('type' in message) ||
        message.type !== 'recordChanged'
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 250);
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      port.disconnect();
    };
  }, []);
  const results = useMemo(
    () =>
      searchHistory(
        [...entries].sort(
          (a, b) =>
            Math.max(b.updatedAt ?? 0, opened[b.videoId] ?? 0) -
              Math.max(a.updatedAt ?? 0, opened[a.videoId] ?? 0) ||
            a.title.localeCompare(b.title),
        ),
        query,
      ),
    [entries, query, opened],
  );
  async function select(videoId: string, noteId?: string) {
    if (switchLock.current) return;
    switchLock.current = true;
    setSwitching(true);
    try {
      if (leave.current && !(await leave.current())) return;
      const dates = { ...opened, [videoId]: Date.now() };
      await chrome.storage.local.set({
        historyLastVideo: videoId,
        historyOpened: dates,
      });
      const url = new URL(location.href);
      url.searchParams.set('video', videoId);
      window.history.replaceState(null, '', url);
      setOpened(dates);
      setSelected((previous) => ({
        videoId,
        noteId,
        selectionKey: (previous?.selectionKey ?? 0) + 1,
      }));
      setError('');
      if (window.matchMedia('(max-width: 760px)').matches) setCollapsed(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      switchLock.current = false;
      setSwitching(false);
    }
  }
  return (
    <div className={`history-layout ${collapsed ? 'history-collapsed' : ''}`}>
      <aside className="history-sidebar" aria-label="视频历史列表">
        <div className="history-sidebar-heading">
          <h1>历史记录</h1>
          <button onClick={() => setCollapsed(true)} aria-label="收起视频列表">
            收起
          </button>
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
        <p className="history-help">搜索摘录、理解与疑问，不含 AI 回答</p>
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
            results.map(({ entry, hits }) => {
              const date = Math.max(
                entry.updatedAt ?? 0,
                opened[entry.videoId] ?? 0,
              );
              return (
                <article
                  key={entry.videoId}
                  className={`history-item ${selected?.videoId === entry.videoId ? 'selected' : ''}`}
                >
                  <button
                    className="history-video"
                    disabled={switching}
                    aria-current={
                      selected?.videoId === entry.videoId ? 'true' : undefined
                    }
                    onClick={() => void select(entry.videoId)}
                  >
                    <span className="history-video-title" title={entry.title}>
                      <Highlight text={entry.title} query={query} />
                    </span>
                    <span className="history-meta">
                      {[
                        entry.hasTranscript && '逐字稿',
                        entry.hasAnalysis && '脉络',
                        `${entry.noteCount} 条笔记`,
                        entry.draftCount > 0 && `${entry.draftCount} 条草稿`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="history-meta">
                      {date
                        ? `最近学习 ${new Date(date).toLocaleDateString('zh-CN')}`
                        : '日期未记录'}
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
              );
            })
          )}
        </div>
      </aside>
      <section className="history-reading" aria-label="历史内容">
        <div className="history-reading-bar">
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed ? '展开视频列表' : '视频列表'}
          </button>
          <span>本地历史 · 阅读不会自动调用模型</span>
        </div>
        {selected ? (
          <App
            key={selected.videoId}
            history={{ ...selected, registerLeave }}
          />
        ) : (
          <div className="empty">
            {loading
              ? '正在读取…'
              : '从左侧选择一个视频，查看逐字稿、脉络和笔记。'}
          </div>
        )}
      </section>
    </div>
  );
}
