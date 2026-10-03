import { useRef, useState } from 'react';
import { errorText } from '../lib/rpc';
export function DeleteNoteButton({
  onDelete,
  iconOnly = false,
}: {
  onDelete: () => Promise<void>;
  iconOnly?: boolean;
}) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (locked.current) return;
    if (
      !window.confirm(
        '确定删除这条笔记？摘录、个人理解、疑问及 AI 问答都会删除，无法撤销。',
      )
    )
      return;
    locked.current = true;
    setError('');
    setBusy(true);
    try {
      await onDelete();
    } catch (e) {
      setError(errorText(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <span className={iconOnly ? 'note-delete' : undefined}>
      <button
        disabled={busy}
        aria-label={busy ? '正在删除笔记' : '删除笔记'}
        title="删除笔记"
        onClick={() => void remove()}
      >
        {iconOnly ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
          </svg>
        ) : busy ? (
          '正在删除…'
        ) : (
          '删除'
        )}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
