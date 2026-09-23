import { Icon } from './icons';
import { ExcerptEditor } from './ExcerptEditor';
import { AnswerText } from './AnswerText';
import { DeleteNoteButton } from './DeleteNoteButton';
import { useEffect, useRef, useState } from 'react';
import { type Note, type Segment, timestamp } from '@youtube-note/shared';
import { errorText } from '../lib/rpc';
export function NoteEditor({
  note,
  registerLeave,
  source,
  onSave,
  onAsk,
  onClose,
  onDelete,
}: {
  note: Note;
  registerLeave?: (leave: (() => Promise<boolean>) | null) => void;
  source?: Segment;
  onSave: (note: Note) => Promise<void>;
  onAsk: (note: Note) => void;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(note),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const latest = useRef(draft);
  latest.current = draft;
  const save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    registerLeave?.(async () => {
      try {
        await save.current(latest.current);
        return true;
      } catch (e) {
        setStatus(errorText(e));
        return false;
      }
    });
    return () => registerLeave?.(null);
  }, [registerLeave]);
  useEffect(() => {
    if (
      !source ||
      latest.current.selectedText !== undefined ||
      latest.current.original ||
      latest.current.translated
    )
      return;
    const next = {
      ...latest.current,
      segmentId: source.id,
      sourceRevision: source.revision,
      original: source.original,
      translated: source.translated,
    };
    latest.current = next;
    setDraft(next);
    void save.current(next).then(
      () => setStatus('已补齐引用'),
      (e) => setStatus(errorText(e)),
    );
  }, [source]);
  const update = (
    field: 'original' | 'translated' | 'thought' | 'question',
    value: string,
  ) => {
    const next = { ...latest.current, [field]: value, updatedAt: Date.now() };
    latest.current = next;
    setDraft(next);
    setStatus('正在保存…');
    void save.current(next).then(
      () => setStatus('已保存'),
      (e) => setStatus(errorText(e)),
    );
  };
  async function finish() {
    setBusy(true);
    try {
      await onSave({ ...latest.current, draft: false, updatedAt: Date.now() });
      onClose();
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await onSave(latest.current);
      onClose();
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor">
      <div className="row">
        <strong className="note-editor-title">
          {timestamp(note.startMs)} · {note.draft ? '新笔记' : '编辑笔记'}
        </strong>
        <button
          onClick={async () => {
            try {
              await onSave(latest.current);
              onClose();
            } catch (e) {
              setStatus(errorText(e));
            }
          }}
        >
          关闭
        </button>
      </div>
      {draft.selectedText === undefined &&
        source &&
        (source.id !== draft.segmentId ||
          source.revision !== draft.sourceRevision) && (
          <div className="notice">
            引用来源有更新。
            <details>
              <summary>查看当前来源</summary>
              <p>{source.original}</p>
              <p>{source.translated}</p>
            </details>
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  original: source.original,
                  translated: source.translated,
                  segmentId: source.id,
                  sourceRevision: source.revision,
                })
              }
            >
              更新引用
            </button>
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  segmentId: source.id,
                  sourceRevision: source.revision,
                })
              }
            >
              保留摘录
            </button>
          </div>
        )}
      {draft.selectedText !== undefined && (
        <>
          <ExcerptEditor
            text={draft.selectedText}
            markdown={draft.excerptMarkdown}
            edited={draft.excerptEdited}
            onChange={(text, markdown) => {
              const next = {
                ...latest.current,
                selectedText: text,
                excerptMarkdown: markdown,
                excerptEdited: true,
                updatedAt: Date.now(),
              };
              latest.current = next;
              setDraft(next);
              setStatus('正在保存…');
              void save.current(next).then(
                () => setStatus('已保存'),
                (e) => setStatus(errorText(e)),
              );
            }}
          />
        </>
      )}
      {draft.selectedText === undefined && (
        <>
          <textarea
            aria-label="英文摘录"
            value={draft.original}
            onChange={(e) => update('original', e.target.value)}
            placeholder="等待当前片段…"
          />
          <textarea
            aria-label="中文摘录"
            value={draft.translated}
            onChange={(e) => update('translated', e.target.value)}
            placeholder="可补充或修正译文"
          />
        </>
      )}
      <label className="note-field" title="我的理解与价值">
        <span>
          <Icon kind="thought" /> 我的理解与价值{' '}
          <small className="muted">（选填）</small>
        </span>
        <textarea
          aria-label="我的理解与价值"
          value={draft.thought}
          onChange={(e) => update('thought', e.target.value)}
          placeholder="我怎么理解它？为什么值得记？可以用在哪里？"
        />
      </label>
      <label className="note-field" title="我的疑问">
        <span>
          <Icon kind="question" /> 我的疑问{' '}
          <small className="muted">（选填）</small>
        </span>
        <textarea
          aria-label="我的疑问"
          value={draft.question}
          onChange={(e) => update('question', e.target.value)}
          placeholder="有什么还没想明白？"
        />
      </label>
      {draft.aiConversation?.map((turn, i) => (
        <details className="note-conversation" key={i}>
          <summary>AI提问：{turn.question}</summary>
          <AnswerText text={turn.answer} />
          <small className="muted">AI 回答，需核对</small>
        </details>
      ))}
      <div role="status" className="muted">
        {status}
      </div>
      <div className="note-editor-actions">
        <DeleteNoteButton onDelete={onDelete} />
        <button disabled={busy} onClick={() => void cancel()}>
          取消
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onSave(latest.current)
              .then(
                () => onAsk(latest.current),
                (e) => setStatus(errorText(e)),
              )
              .finally(() => setBusy(false));
          }}
        >
          AI提问
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void finish()}
        >
          完成
        </button>
      </div>
    </section>
  );
}
