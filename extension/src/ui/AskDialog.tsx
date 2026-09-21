import { AnswerSettings, defaultAnswerInstructions } from './AnswerSettings';
import { AnswerText } from './AnswerText';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { Note } from '@youtube-note/shared';
import { rpc, errorText } from '../lib/rpc';
import { answerNote } from './answer-note';
export function AskDialog({
  note,
  onSave,
  onClose,
}: {
  note: Note;
  onSave: (note: Note) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(note),
    [question, setQuestion] = useState(note.question),
    [busy, setBusy] = useState(false),
    [settingsReady, setSettingsReady] = useState(false),
    [status, setStatus] = useState(''),
    [answerInstructions, setAnswerInstructions] = useState(
      defaultAnswerInstructions,
    ),
    [unsaved, setUnsaved] = useState<Note | null>(null);
  const alive = useRef(true),
    locked = useRef(false),
    editVersion = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function persist(next: Note, version = editVersion.current) {
    await onSave(next);
    if (alive.current && version === editVersion.current) {
      setDraft(next);
      setUnsaved(null);
      setStatus('已保存到笔记');
    }
  }
  function changeQuestion(text: string) {
    editVersion.current++;
    setQuestion(text);
    const next = { ...draft, question: text, updatedAt: Date.now() };
    setDraft(next);
    setUnsaved(next);
    void persist(next).catch((e) => {
      if (alive.current) setStatus(errorText(e));
    });
  }
  async function ask() {
    if (locked.current || !settingsReady) return;
    locked.current = true;
    setBusy(true);
    setStatus('正在保存问题…');
    try {
      const next = {
        ...draft,
        question: question.trim(),
        updatedAt: Date.now(),
      };
      await answerNote(
        next,
        persist,
        async (payload) => {
          setStatus('正在向当前分析模型提问…');
          return z
            .object({ answer: z.string().min(1).max(20000) })
            .parse(
              await rpc({ type: 'native', operation: 'generate', payload }),
            ).answer;
        },
        () => alive.current,
        (answered) => {
          setDraft(answered);
          setUnsaved(answered);
        },
        answerInstructions,
      );
    } catch (e) {
      if (alive.current) setStatus(errorText(e));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function close() {
    try {
      await persist(unsaved ?? { ...draft, question, updatedAt: Date.now() });
      onClose();
    } catch (e) {
      setStatus(errorText(e));
    }
  }
  return (
    <div className="export-overlay">
      <section
        className="export-dialog ask-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="AI提问"
      >
        <div className="row">
          <h2>AI提问</h2>
          <button disabled={busy} onClick={() => void close()}>
            关闭
          </button>
        </div>
        <p className="muted">
          使用当前分析模型。发送问题和此处摘录；追问会附上最近四轮问答。可能消耗模型额度。问题与回答自动保存到笔记。
        </p>
        <details>
          <summary>查看本次摘录与来源</summary>
          <blockquote>
            {note.selectedText ?? (note.translated || note.original)}
          </blockquote>
          {note.excerptTitle && <p>{note.excerptTitle}</p>}
        </details>
        {draft.aiConversation?.map((turn, i) => (
          <article className="card" key={i}>
            <strong>问题：{turn.question}</strong>
            <AnswerText text={turn.answer} />
            <small className="muted">AI 回答，需结合来源核对</small>
          </article>
        ))}
        <AnswerSettings
          value={answerInstructions}
          onChange={setAnswerInstructions}
          disabled={busy}
          onReady={setSettingsReady}
        />
        <label>
          我的问题
          <textarea
            autoFocus
            aria-label="我的问题"
            value={question}
            disabled={busy}
            onChange={(e) => changeQuestion(e.target.value)}
            placeholder="哪里不理解？也可以要求举例或补充解释。"
          />
        </label>
        <p role="status">{status}</p>
        <div className="row">
          {unsaved && !busy && (
            <button
              onClick={() =>
                void persist(unsaved).catch((e) => setStatus(errorText(e)))
              }
            >
              重新保存笔记
            </button>
          )}
          <button
            disabled={busy || !question.trim()}
            onClick={() => void close()}
          >
            仅保存问题
          </button>
          <button
            className="primary"
            disabled={busy || !settingsReady || !question.trim() || !!unsaved}
            onClick={() => void ask()}
          >
            {busy ? '回答中…' : '发送问题'}
          </button>
        </div>
      </section>
    </div>
  );
}
