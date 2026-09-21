import { useState } from 'react';
import {
  sourceVersion,
  timestamp,
  type VideoRecord,
} from '@youtube-note/shared';
import {
  applyTranscript,
  previewTranscript,
  restoreTranscript,
} from '../segmentation/resegment';
import { errorText } from '../lib/rpc';
import type { useVideo } from './useVideo';

export function ResegmentDialog({
  record,
  mutate,
  onClose,
}: {
  record: VideoRecord;
  mutate: ReturnType<typeof useVideo>['mutate'];
  onClose: (changed: boolean) => void;
}) {
  const [preview] = useState(() => previewTranscript(record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const changed =
    sourceVersion(record.segments) !== sourceVersion(preview.segments);
  async function save(restore: boolean) {
    setSaving(true);
    try {
      await mutate((r) =>
        restore ? restoreTranscript(r, preview) : applyTranscript(r, preview),
      );
      onClose(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="export-overlay">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="重新分段预览"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onClose(false);
          if (event.key !== 'Tab') return;
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button',
            ),
          ].filter((b) => !b.disabled);
          const first = buttons[0],
            last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2>重新分段预览</h2>
        <p>
          当前 {record.segments.length} 段 → 整理后 {preview.segments.length}{' '}
          段。
        </p>
        <p>
          仅在本机整理，不重新获取字幕。手改段落保持原样，笔记保留原引用。改变边界的段落需要重新翻译，旧逐字稿及译文会备份，可恢复。
        </p>
        {!changed && <p>当前没有需要调整的段落。</p>}
        {record.segments.some((s) => s.manual) && (
          <p>手改段落已保留，不参与合并或拆分。</p>
        )}
        {preview.segments.some((s) => s.segmentationWarning === 'inferred') && (
          <p className="muted">
            部分原文缺少标点，已根据分句线索整理，请在下方预览中检查衔接。
          </p>
        )}
        {preview.segments.some(
          (s) => s.segmentationWarning === 'unresolved',
        ) && (
          <p className="notice">
            仍有{' '}
            {
              preview.segments.filter(
                (s) => s.segmentationWarning === 'unresolved',
              ).length
            }{' '}
            段偏长，未找到足够可靠的断点，已在预览中标出。
          </p>
        )}
        <details>
          <summary>查看全部整理结果</summary>
          {preview.segments.map((s) => (
            <p key={s.id}>
              <span className="time">
                {timestamp(s.startMs)} – {timestamp(s.endMs)}
              </span>
              <br />
              {s.original}
              {s.segmentationWarning === 'unresolved' && (
                <em>（仍偏长，请检查）</em>
              )}
            </p>
          ))}
        </details>
        <p className="muted">
          时间仍采用来源字幕精度；同一来源条目拆成多段时，时间范围可能重叠。
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="row">
          <button autoFocus disabled={saving} onClick={() => onClose(false)}>
            取消
          </button>
          <button
            className="primary"
            disabled={saving || !changed}
            onClick={() => void save(false)}
          >
            应用分段
          </button>
          {record.transcriptBackup && (
            <button disabled={saving} onClick={() => void save(true)}>
              恢复上次逐字稿
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
