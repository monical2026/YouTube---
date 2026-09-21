import { useState } from 'react';
import type { Segment } from '@youtube-note/shared';
import type { useVideo } from './useVideo';
import { errorText } from '../lib/rpc';
export function SegmentEditor({
  segment,
  mutate,
  onClose,
}: {
  segment: Segment;
  mutate: ReturnType<typeof useVideo>['mutate'];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(segment),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await mutate((r) => ({
        ...r,
        segments: r.segments.map((s) => {
          if (s.id !== draft.id) return s;
          if (s.revision !== draft.revision)
            throw new Error('此段已有更新，请核对后重试');
          return { ...draft, revision: s.revision + 1, manual: true };
        }),
      }));
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="editor" style={{ position: 'absolute', inset: 0 }}>
      <h2>修正逐字稿</h2>
      <textarea
        aria-label="原文"
        value={draft.original}
        onChange={(e) => setDraft({ ...draft, original: e.target.value })}
      />
      <textarea
        aria-label="译文"
        value={draft.translated}
        onChange={(e) => setDraft({ ...draft, translated: e.target.value })}
      />
      <p role="alert">{error}</p>
      <button disabled={saving} onClick={onClose}>
        取消
      </button>
      <button className="primary" disabled={saving} onClick={() => void save()}>
        保存修正
      </button>
    </div>
  );
}
