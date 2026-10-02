import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { App } from '../ui/App';
import { rpc, errorText } from '../lib/rpc';
import { historyListSchema, searchHistory, type HistoryEntry } from './records';
import './history.css';
import { HistorySidebar } from './HistorySidebar';
import { Icon } from '../ui/icons';
import './history-reader.css';
import { retainHistoryDates } from './list-order';
import { BookIcon } from './HistoryReaderHeader';
export type LeaveReader = () => Promise<boolean>;
export type HistoryReader = {
  videoId: string;
  noteId?: string;
  selectionKey: number;
  registerLeave: (leave: LeaveReader | null) => void;
};
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
  const [listingDates, setListingDates] = useState<Record<string, number>>({});
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
          if (!initial)
            setListingDates((previous) =>
              retainHistoryDates(previous, list.entries),
            );
          setInvalidCount(list.invalidCount);
          if (!initial)
            setSelected((previous) =>
              previous &&
              list.entries.some((entry) => entry.videoId === previous.videoId)
                ? previous
                : null,
            );
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
          setListingDates(retainHistoryDates({}, list.entries, dates));
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
            (listingDates[b.videoId] ?? 0) - (listingDates[a.videoId] ?? 0) ||
            a.title.localeCompare(b.title),
        ),
        query,
      ),
    [entries, query, listingDates],
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
  async function remove(videoId: string, title: string) {
    if (switchLock.current) return;
    if (
      !window.confirm(
        `确定删除“${title}”？\n该视频的逐字稿、视频脉络和全部笔记（包括草稿与 AI 回答）都会删除，无法撤销。`,
      )
    )
      return;
    switchLock.current = true;
    setSwitching(true);
    try {
      await rpc({ type: 'deleteHistory', videoId });
      setEntries((previous) =>
        previous.filter((entry) => entry.videoId !== videoId),
      );
      if (selected?.videoId === videoId) {
        setSelected(null);
        const url = new URL(location.href);
        url.searchParams.delete('video');
        window.history.replaceState(null, '', url);
      }
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      switchLock.current = false;
      setSwitching(false);
    }
  }
  return (
    <div className={`history-layout ${collapsed ? 'history-collapsed' : ''}`}>
      <div className="history-appbar">
        <div className="history-brand">
          <span className="history-brand-icon">
            <BookIcon />
          </span>
          <strong>学习笔记</strong>
          <span>历史记录</span>
        </div>
        <div className="history-global-actions">
          <span>本地历史记录</span>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed ? '展开视频列表' : '收起视频列表'}
          </button>
          <button
            aria-label="服务设置"
            onClick={() =>
              void rpc({ type: 'openSettings' }).catch((e) =>
                setError(errorText(e)),
              )
            }
          >
            <Icon kind="settings" />
          </button>
        </div>
      </div>
      <HistorySidebar
        {...{
          results,
          query,
          setQuery,
          error,
          invalidCount,
          loading,
          switching,
          opened,
          listingDates,
          select,
          remove,
        }}
        selectedId={selected?.videoId}
      />
      <section className="history-reading" aria-label="历史内容">
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
