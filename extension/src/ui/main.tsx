import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { type Mode, type Note, type Segment } from '@youtube-note/shared';
import { useVideo } from './useVideo';
import { rpc, errorText } from '../lib/rpc';
import { currentSegment } from '../segmentation';
import { videoActions } from './videoActions';
import { ResegmentDialog } from './ResegmentDialog';
import { ExportDialog } from './ExportDialog';
import { NoteEditor } from './NoteEditor';
import { PanelControls } from './PanelControls';
import { GenerateCaptions } from './GenerateCaptions';
import { ContentViews } from './ContentViews';
import { usePreparation } from './usePreparation';
import { LoadingView } from './LoadingView';
import './style.css';
function App() {
  const { context, record, tabId, error, setError, mutate, saveNote } =
    useVideo();
  const [tab, setTab] = useState('transcript'),
    [mode, setMode] = useState<Mode>('bilingual'),
    [busy, setBusy] = useState(''),
    [progress, setProgress] = useState<number | null>(null),
    [follow, setFollow] = useState(true),
    [edit, setEdit] = useState<Note | null>(null),
    [editing, setEditing] = useState<Segment | null>(null),
    [selected, setSelected] = useState<{
      text: string;
      id: string;
      ids: string[];
      language: 'original' | 'translated' | 'mixed';
    } | null>(null);
  const [candidate, setCandidate] = useState<
    { id: string; revision: number; text: string }[] | null
  >(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [resegmentOpen, setResegmentOpen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const jobLock = useRef<number | null>(null);
  const quickId = new URLSearchParams(location.search).get('note');
  const active =
    record && context
      ? currentSegment(record.segments, context.currentMs)
      : undefined;
  useEffect(() => {
    const token = ++generation.current;
    setExportOpen(false);
    setResegmentOpen(false);
    setBusy('');
    setProgress(null);
    setSelected(null);
    setCandidate(null);
    setEdit(null);
    setEditing(null);
    return () => {
      generation.current = token + 1;
    };
  }, [context?.videoId]);
  useEffect(() => {
    if (quickId && record) {
      const note = record.notes.find((n) => n.id === quickId);
      if (note) setEdit((previous) => previous ?? note);
    }
  }, [quickId, record]);
  const activeId = active?.id;
  useEffect(() => {
    if (follow && activeId)
      scroll.current
        ?.querySelector(`[data-id="${CSS.escape(activeId)}"]`)
        ?.scrollIntoView({ block: 'center' });
  }, [activeId, follow]);
  const { run, getCaptions, translateLocal, llmTranslate, analyze } =
    videoActions({
      record,
      context,
      tabId,
      mutate,
      setError,
      busy,
      generation,
      jobLock,
      setBusy,
      setProgress,
      setCandidate,
    });
  usePreparation({
    record,
    videoId: context?.videoId,
    mode,
    busy,
    quickId,
    getCaptions,
    translateLocal,
  });
  async function seek(segment: Pick<Segment, 'startMs'>) {
    try {
      await rpc({
        type: 'seek',
        tabId,
        videoId: context?.videoId,
        startMs: segment.startMs,
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function newNote(segment: Segment, text?: string) {
    if (!record || !context) return;
    const sourceSegments =
      text && selected
        ? record.segments.filter((s) => selected.ids.includes(s.id))
        : [segment];
    const original = sourceSegments.map((s) => s.original).join('\n');
    const translated = sourceSegments.map((s) => s.translated).join('\n');
    const language = text && selected ? selected.language : undefined;
    const note: Note = {
      id: crypto.randomUUID(),
      videoId: record.videoId,
      title: context.title,
      startMs: segment.startMs,
      segmentId: segment.id,
      sourceRevision: segment.revision,
      original: language === 'original' ? text! : original,
      translated: language === 'translated' ? text! : translated,
      sourceSegmentIds: sourceSegments.map((s) => s.id),
      selectedText: text,
      selectionLanguage: language,
      thought: '',
      question: '',
      revision: 0,
      draft: true,
      updatedAt: Date.now(),
    };
    try {
      await saveNote(note);
      setSelected(null);
      setEdit(note);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function deleteNote(id: string) {
    await mutate((r) => ({
      ...r,
      notes: r.notes.filter((note) => note.id !== id),
    }));
    if (edit?.id === id) closeNote();
  }
  function closeNote() {
    setEdit(null);
    if (quickId)
      window.parent.postMessage(
        { type: 'close-note' },
        'https://www.youtube.com',
      );
  }
  function selectText() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text || !selection.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    const paragraphs = [
      ...(scroll.current?.querySelectorAll('p[data-language]') ?? []),
    ].filter((p) => range.intersectsNode(p));
    const ids = [
      ...new Set(
        paragraphs
          .map((p) => p.closest('[data-id]')?.getAttribute('data-id'))
          .filter((id): id is string => !!id),
      ),
    ];
    const languages = new Set(
      paragraphs.map((p) => p.getAttribute('data-language')),
    );
    const language =
      languages.size === 1
        ? languages.has('original')
          ? 'original'
          : 'translated'
        : 'mixed';
    setSelected(ids.length ? { text, id: ids[0], ids, language } : null);
    setFollow(false);
  }
  if (quickId && edit)
    return (
      <NoteEditor
        key={edit.id}
        note={edit}
        source={
          record?.segments.find((s) => s.id === edit.segmentId) ??
          (record ? currentSegment(record.segments, edit.startMs) : undefined)
        }
        onSave={saveNote}
        onDelete={() => deleteNote(edit.id)}
        onClose={closeNote}
      />
    );
  return (
    <main className="app">
      <PanelControls
        {...{
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
          progress,
          candidate,
          setCandidate,
          translateLocal,
          llmTranslate,
          run,
          mutate,
          openResegment: () => {
            if (editing || edit) {
              setError('请先保存或关闭当前编辑，再预览分段');
              return;
            }
            setResegmentOpen(true);
          },
        }}
      />
      <div
        className={`scroll ${busy ? 'is-loading' : ''}`}
        ref={scroll}
        onWheel={() => setFollow(false)}
        onTouchMove={() => setFollow(false)}
        onMouseUp={selectText}
      >
        {busy ? (
          <LoadingView label={busy} progress={progress} />
        ) : (
          <>
            {tab === 'transcript' &&
              context &&
              record &&
              !record.segments.length && (
                <GenerateCaptions
                  key={context.videoId}
                  context={context}
                  tabId={tabId}
                  onReady={async (segments) => {
                    await mutate((r) => ({
                      ...r,
                      segments: r.segments.length ? r.segments : segments,
                      title: context.title,
                    }));
                  }}
                />
              )}
            <ContentViews
              {...{
                tab,
                record,
                context,
                busy,
                mode,
                active,
                selected,
                getCaptions,
                seek,
                setEditing,
                newNote,
                setEdit,
                analyze,
                deleteNote,
              }}
            />
          </>
        )}
      </div>
      {resegmentOpen && record && (
        <ResegmentDialog
          key={record.videoId}
          record={record}
          mutate={mutate}
          onClose={(changed) => {
            setResegmentOpen(false);
            if (changed) {
              setCandidate(null);
              setSelected(null);
              setEditing(null);
            }
          }}
        />
      )}
      <footer>
        <button
          className="follow-button"
          onClick={() => {
            setFollow(true);
            if (active)
              scroll.current
                ?.querySelector(`[data-id="${CSS.escape(active.id)}"]`)
                ?.scrollIntoView({ block: 'center' });
          }}
        >
          {follow ? '正在跟随' : '跟随播放'}
        </button>
        <button
          className="export-trigger"
          disabled={!record}
          onClick={() => setExportOpen(true)}
        >
          导出
        </button>
      </footer>
      {exportOpen && record && (
        <ExportDialog
          record={record}
          mode={mode}
          onClose={() => setExportOpen(false)}
        />
      )}
      {edit && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
          <NoteEditor
            key={edit.id}
            note={edit}
            source={
              record?.segments.find((s) => s.id === edit.segmentId) ??
              (record
                ? currentSegment(record.segments, edit.startMs)
                : undefined)
            }
            onSave={saveNote}
            onDelete={() => deleteNote(edit.id)}
            onClose={closeNote}
          />
        </div>
      )}
      {editing && (
        <div className="editor" style={{ position: 'absolute', inset: 0 }}>
          <h2>修正逐字稿</h2>
          <textarea
            aria-label="原文"
            value={editing.original}
            onChange={(e) =>
              setEditing({ ...editing, original: e.target.value })
            }
          />
          <textarea
            aria-label="译文"
            value={editing.translated}
            onChange={(e) =>
              setEditing({ ...editing, translated: e.target.value })
            }
          />
          <button onClick={() => setEditing(null)}>取消</button>
          <button
            className="primary"
            onClick={() =>
              void run('正在保存…', async () => {
                await mutate((r) => ({
                  ...r,
                  segments: r.segments.map((s) => {
                    if (s.id !== editing.id) return s;
                    if (s.revision !== editing.revision)
                      throw new Error('此段已有更新，请核对后重试');
                    return {
                      ...editing,
                      revision: s.revision + 1,
                      manual: true,
                    };
                  }),
                }));
                setEditing(null);
              })
            }
          >
            保存修正
          </button>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
