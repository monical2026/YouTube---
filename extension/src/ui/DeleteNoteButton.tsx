import { useState } from 'react';
import { errorText } from '../lib/rpc';
export function DeleteNoteButton({
  onDelete,
}: {
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!window.confirm('删除这条笔记及其理解、疑问？此操作无法撤销。')) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      <button disabled={busy} onClick={() => void remove()}>
        {busy ? '正在删除…' : '删除'}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
