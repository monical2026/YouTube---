import { SegmentEditor } from './SegmentEditor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Mode, type Note, type Segment } from '@youtube-note/shared';
import { useVideo } from './useVideo';
import { rpc, errorText } from '../lib/rpc';
import { currentSegment } from '../segmentation';
import { videoActions } from './videoActions';
import { AskDialog } from './AskDialog';
import { excerptNote, type Excerpt } from './learning-notes';
import { useTextSelection, SelectionActions } from './useTextSelection';
import { ExportDialog } from './ExportDialog';
import { NoteEditor } from './NoteEditor';
import { PanelControls } from './PanelControls';
import { GenerateCaptions } from './GenerateCaptions';
import { ContentViews } from './ContentViews';
import { usePreparation } from './usePreparation';
import { LoadingView } from './LoadingView';
import type { HistoryReader, LeaveReader } from '../history/HistoryPage';
export function App({ history }: { history?: HistoryReader }) {
  const { context, record, tabId, error, setError, mutate, saveNote } =
    useVideo(history?.videoId);
  const [tab, setTab] = useState('transcript'),
    [mode, setMode] = useState<Mode>('bilingual'),
    [busy, setBusy] = useState(''),
    [progress, setProgress] = useState<number | null>(null),
    [follow, setFollow] = useState(true),
    [edit, setEdit] = useState<Note | null>(null),
    [editing, setEditing] = useState<Segment | null>(null),
    [asking, setAsking] = useState<Note | null>(null);
  const [candidate, setCandidate] = useState<
    { id: string; revision: number; text: string }[] | null
  >(null);
  const [exportOpen, setExportOpen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const { selected, setSelected, selectText } = useTextSelection(
    scroll,
    record,
    tab,
  );
  const sessionVideoId = history?.videoId ?? context?.videoId;
  const currentVideo = useRef(sessionVideoId);
  currentVideo.current = sessionVideoId;
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
    setAsking(null);
    setBusy('');
    setProgress(null);
    setSelected(null);
    setCandidate(null);
    setEdit(null);
    setEditing(null);
    return () => {
      generation.current = token + 1;
    };
  }, [sessionVideoId, setSelected]);
  useEffect(() => {
    setSelected(null);
  }, [tab, setSelected]);
  useEffect(() => {
    if (quickId && record && !asking) {
      const note = record.notes.find((n) => n.id === quickId);
      if (note) setEdit((previous) => previous ?? note);
    }
  }, [quickId, record, asking]);
  const leaveEditor = useRef<LeaveReader | null>(null);
  const registerEditorLeave = useCallback((leave: LeaveReader | null) => {
    leaveEditor.current = leave;
  }, []);
  const registerLeave = history?.registerLeave;
  useEffect(() => {
    if (!registerLeave) return;
    registerLeave(async () => {
      if (asking || editing || exportOpen) {
        setError('请先保存并关闭当前编辑或提问窗口，再切换记录。');
        return false;
      }
      if (edit && leaveEditor.current) {
        if (!(await leaveEditor.current())) return false;
        setEdit(null);
      }
      return true;
    });
    return () => registerLeave(null);
  }, [registerLeave, asking, editing, exportOpen, edit, setError]);
  const selectedNoteId = history?.noteId;
  const selectionKey = history?.selectionKey;
  useEffect(() => {
    if (selectedNoteId) setTab('notes');
  }, [selectedNoteId, selectionKey]);
  const loadedVideoId = record?.videoId;
  useEffect(() => {
    if (tab !== 'notes' || !selectedNoteId || !loadedVideoId) return;
    const target = scroll.current?.querySelector<HTMLElement>(
      `[data-note-id="${CSS.escape(selectedNoteId)}"]`,
    );
    target?.scrollIntoView({ block: 'center' });
    target?.focus({ preventScroll: true });
  }, [tab, selectedNoteId, selectionKey, loadedVideoId]);
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
    videoId: history ? undefined : context?.videoId,
    mode,
    busy,
    quickId,
    getCaptions,
    translateLocal,
  });
  async function seek(segment: Pick<Segment, 'startMs'>) {
    try {
      await rpc({
        type: history ? 'openVideoTime' : 'seek',
        tabId,
        videoId: record?.videoId,
        startMs: segment.startMs,
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function newNote(segment: Segment, text?: string) {
    if (!record) return;
    await captureExcerpt(
      {
        text: text ?? (segment.translated || segment.original),
        ids: [segment.id],
        sourceKind: 'transcript',
      },
      false,
    );
  }
  async function captureExcerpt(excerpt: Excerpt, ask: boolean) {
    if (!record) return;
    const token = generation.current;
    try {
      const note = excerptNote(record, excerpt);
      await saveNote(note);
      if (token !== generation.current) return;
      setSelected(null);
      if (ask) setAsking(note);
      else setEdit(note);
    } catch (e) {
      if (token === generation.current) setError(errorText(e));
    }
  }
  function askNote(note: Note) {
    if (note.videoId !== currentVideo.current) return;
    setEdit(null);
    setAsking(note);
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
  if (quickId && edit && !asking)
    return (
      <NoteEditor
        key={edit.id}
        note={edit}
        source={
          record?.segments.find((s) => s.id === edit.segmentId) ??
          (record ? currentSegment(record.segments, edit.startMs) : undefined)
        }
        onAsk={askNote}
        onSave={saveNote}
        onDelete={() => deleteNote(edit.id)}
        onClose={closeNote}
      />
    );
  return (
    <main className="app">
      <PanelControls
        history={!!history}
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
        }}
      />
      <div
        className={`scroll ${busy ? 'is-loading' : ''}`}
        ref={scroll}
        onWheel={() => setFollow(false)}
        onTouchMove={() => setFollow(false)}
        onMouseUp={() => {
          selectText();
          if (window.getSelection()?.toString()) setFollow(false);
        }}
        onKeyUp={selectText}
        onScroll={() => setSelected(null)}
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
              history={!!history}
              {...{
                tab,
                record,
                context,
                busy,
                mode,
                active,
                getCaptions,
                seek,
                setEditing,
                newNote,
                setEdit,
                onAskNote: askNote,
                deleteNote,
              }}
            />
          </>
        )}
      </div>
      {selected && !asking && !edit && !busy && (
        <SelectionActions
          selected={selected}
          onNote={() => void captureExcerpt(selected, false)}
          onAsk={() => void captureExcerpt(selected, true)}
        />
      )}
      {asking && (
        <AskDialog
          key={asking.id}
          note={asking}
          onSave={saveNote}
          onClose={() => setAsking(null)}
        />
      )}
      <footer>
        {!history && (
          <>
            <button
              disabled={!!busy || !record?.segments.length}
              onClick={() => {
                setSelected(null);
                setTab('analysis');
                void analyze();
              }}
            >
              脉络
            </button>
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
          </>
        )}
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
      {edit && !asking && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
          <NoteEditor
            key={edit.id}
            registerLeave={registerEditorLeave}
            note={edit}
            source={
              record?.segments.find((s) => s.id === edit.segmentId) ??
              (record
                ? currentSegment(record.segments, edit.startMs)
                : undefined)
            }
            onAsk={askNote}
            onSave={saveNote}
            onDelete={() => deleteNote(edit.id)}
            onClose={closeNote}
          />
        </div>
      )}
      {editing && (
        <SegmentEditor
          segment={editing}
          mutate={mutate}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
