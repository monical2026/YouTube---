import { type Dispatch, type SetStateAction } from 'react';
import {
  type VideoContext,
  type VideoRecord,
  type Mode,
} from '@youtube-note/shared';
import { Icon } from './icons';
import { rpc, errorText } from '../lib/rpc';
import type { useVideo } from './useVideo';
type Candidate = { id: string; revision: number; text: string }[] | null;
type Setter<T> = Dispatch<SetStateAction<T>>;
type Props = {
  history?: boolean;
  context: VideoContext | null;
  record: VideoRecord | null;
  tabId?: number;
  tab: string;
  setTab: Setter<string>;
  mode: Mode;
  setMode: Setter<Mode>;
  error: string;
  setError: Setter<string>;
  busy: string;
  candidate: Candidate;
  setCandidate: Setter<Candidate>;
  translateLocal: () => Promise<void>;
  llmTranslate: (scope?: 'current' | 'all') => Promise<void>;
  run: (
    label: string,
    action: (token: number) => Promise<void>,
  ) => Promise<void>;
  mutate: ReturnType<typeof useVideo>['mutate'];
};
export function PanelControls({
  history = false,
  context,
  record,
  tabId,
  tab,
  setTab,
  mode,
  setMode,
  error,
  setError,
  busy,
  candidate,
  setCandidate,
  llmTranslate,
  translateLocal,
  run,
  mutate,
}: Props) {
  return (
    <>
      <header>
        <div className="panel-heading">
          <div className="panel-video-title">
            {(history ? record?.title || record?.videoId : context?.title) ??
              '正在读取视频…'}
          </div>
          <div className="row panel-header-actions">
            <button
              className="settings-icon-button"
              title="服务设置"
              aria-label="服务设置"
              onClick={() =>
                void rpc({ type: 'openSettings' }).catch((e) =>
                  setError(errorText(e)),
                )
              }
            >
              <Icon kind="settings" />
            </button>
            {window.parent !== window && (
              <button
                onClick={() =>
                  window.parent.postMessage(
                    { type: 'close-panel' },
                    'https://www.youtube.com',
                  )
                }
              >
                收起
              </button>
            )}
          </div>
        </div>
        {window.parent === window && (record || context) && (
          <button
            onClick={() =>
              void rpc({
                type: history ? 'openVideoTime' : 'returnVideo',
                tabId,
                videoId:
                  new URLSearchParams(location.search).get('video') ??
                  record?.videoId ??
                  context?.videoId,
              }).catch((e) => setError(errorText(e)))
            }
          >
            返回原视频
          </button>
        )}
        <nav className="tabs">
          {[
            ['transcript', '逐字稿'],
            ['analysis', '视频脉络'],
            ['notes', '笔记'],
          ].map(([id, label]) => (
            <button
              className={tab === id ? 'active' : ''}
              key={id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      {error && (
        <div role="alert" className="error">
          {error}
          {error.includes('Chrome 首次准备本地翻译') && (
            <button disabled={!!busy} onClick={() => void translateLocal()}>
              继续准备
            </button>
          )}
          <button onClick={() => setError('')}>关闭提示</button>
        </div>
      )}
      {tab === 'transcript' && (
        <div className="toolbar">
          <div
            className="language-buttons"
            role="group"
            aria-label="逐字稿显示语言"
          >
            {(
              [
                ['chinese', '中文'],
                ['original', '英文'],
                ['bilingual', '中英'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={mode === value}
                className={mode === value ? 'active' : ''}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {!history && (
            <>
              <button
                disabled={!!busy || !record?.segments.length}
                onClick={() => void llmTranslate('all')}
              >
                LLM翻译
              </button>
              <button
                className="history-trigger"
                onClick={() =>
                  void rpc({
                    type: 'openHistory',
                    videoId: context?.videoId,
                  }).catch((e) => setError(errorText(e)))
                }
              >
                历史记录
              </button>
            </>
          )}
        </div>
      )}
      {candidate && (
        <div className="notice">
          <details>
            <summary>
              有 {candidate.length} 段存在手动修改或版本变化，查看译文对照
            </summary>
            {candidate.map((c) => (
              <div key={c.id} className="card">
                <p className="muted">当前译文</p>
                <p>
                  {record?.segments.find((s) => s.id === c.id)?.translated ||
                    '尚未翻译'}
                </p>
                <p className="muted">LLM 译文</p>
                <p>{c.text}</p>
              </div>
            ))}
          </details>
          <button
            disabled={!!busy}
            onClick={() =>
              void run('正在应用候选译文…', async () => {
                const reviewed = new Map(
                  record?.segments.map((s) => [s.id, s.revision]),
                );
                await mutate((r) => ({
                  ...r,
                  segments: r.segments.map((s) => {
                    const c = candidate.find((c) => c.id === s.id);
                    if (c && reviewed.get(s.id) !== s.revision)
                      throw new Error('核对期间该段又有修改，请重新查看后应用');
                    return c
                      ? {
                          ...s,
                          translated: c.text,
                          engine: 'llm',
                          revision: s.revision + 1,
                        }
                      : s;
                  }),
                }));
                setCandidate(null);
              })
            }
          >
            确认替换这些段落的译文
          </button>
          <button onClick={() => setCandidate(null)}>放弃</button>
        </div>
      )}
    </>
  );
}
