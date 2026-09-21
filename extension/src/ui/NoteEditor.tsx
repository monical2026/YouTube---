import { DeleteNoteButton } from './DeleteNoteButton';
import { useEffect, useRef, useState } from 'react';
import { type Note, type Segment, timestamp } from '@youtube-note/shared';
import { Icon } from './icons';
import { errorText } from '../lib/rpc';
export function NoteEditor({
  note,
  source,
  onSave,
  onClose,
  onDelete,
}: {
  note: Note;
  source?: Segment;
  onSave: (note: Note) => Promise<void>;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(note),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const initial = useRef(note);
  const latest = useRef(draft);
  latest.current = draft;
  const save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    if (!source || latest.current.original || latest.current.translated) return;
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
      await onSave(initial.current);
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
        <strong>
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
      {source &&
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
      {draft.selectedText && (
        <blockquote>
          {draft.selectedText}
          <div className="muted">选中文字；下方保留对应双语上下文</div>
        </blockquote>
      )}
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
      <label title="我的理解">
        <Icon kind="thought" />
        <textarea
          aria-label="我的理解"
          value={draft.thought}
          onChange={(e) => update('thought', e.target.value)}
          placeholder="记下此刻的想法…"
        />
      </label>
      <label title="我的疑问">
        <Icon kind="question" />
        <textarea
          aria-label="我的疑问"
          value={draft.question}
          onChange={(e) => update('question', e.target.value)}
          placeholder="有什么还没想明白？"
        />
      </label>
      <div role="status" className="muted">
        {status}
      </div>
      <div className="row">
        <DeleteNoteButton onDelete={onDelete} />
        <button disabled={busy} onClick={() => void cancel()}>
          取消编辑
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
