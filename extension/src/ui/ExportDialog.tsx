import { useState } from 'react';
import type { Mode, VideoRecord } from '@youtube-note/shared';
import {
  exportBlocks,
  exportText,
  printPdf,
  type ExportSection,
} from '../export/document';
import { createDownloadBlob } from '../export/download';
import { DuplicateExportDialog } from './DuplicateExportDialog';
import {
  blobDataUrl,
  getObsidianTarget,
  chooseObsidianTarget,
  sendToObsidian,
  type ObsidianTarget,
} from '../export/obsidian';
import { errorText, rpc } from '../lib/rpc';
export function ExportDialog({
  record,
  mode,
  onClose,
}: {
  record: VideoRecord;
  mode: Mode;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ExportSection[]>([
    ...(record.notes.length ? ['notes' as const] : []),
    ...(record.analysis ? ['analysis' as const] : []),
    ...(!record.notes.length && !record.analysis && record.segments.length
      ? ['transcript' as const]
      : []),
  ]);
  const [format, setFormat] = useState('md'),
    [error, setError] = useState('');
  const [destination, setDestination] = useState('download');
  const [target, setTarget] = useState<ObsidianTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [duplicates, setDuplicates] = useState<string[]>([]);
  async function chooseTarget() {
    setBusy(true);
    setError('');
    try {
      const chosen = await chooseObsidianTarget();
      if (chosen) {
        setTarget(chosen);
        setDuplicates([]);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function setExportDestination(value: string) {
    setDestination(value);
    setError('');
    setMessage('');
    setDuplicates([]);
    if (value !== 'obsidian') return;
    setBusy(true);
    try {
      setTarget(await getObsidianTarget());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function runExport(copy = false) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const blocks = exportBlocks(record, mode, selected);
      if (destination === 'obsidian') {
        const result = await sendToObsidian({
          videoId: record.videoId,
          title: record.title,
          markdown: exportText(blocks, true),
          copy,
        });
        if (result.status === 'duplicate') {
          setDuplicates(result.files);
          return;
        }
        setDuplicates([]);
        setMessage('导出成功');
        return;
      }
      if (format === 'pdf') {
        printPdf(blocks);
        return;
      }
      const blob = createDownloadBlob(blocks, format);
      const filename = `${(record.title || record.videoId)
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
        .join('')
        .replace(/[/\\:*?"<>|]/g, '_')
        .slice(0, 100)}.${format}`;
      await rpc({
        type: 'downloadExport',
        filename,
        dataUrl: await blobDataUrl(blob),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="export-overlay">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导出学习内容"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault();
            onClose();
          }
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<
              HTMLInputElement | HTMLButtonElement
            >('input, button'),
          ].filter((control) => !control.disabled);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="row">
          <h2>导出</h2>
          <button autoFocus disabled={busy} onClick={onClose}>
            关闭
          </button>
        </div>
        <fieldset disabled={busy}>
          <legend>导出到</legend>
          <label>
            <input
              type="radio"
              name="export-destination"
              checked={destination === 'download'}
              onChange={() => void setExportDestination('download')}
            />
            下载文件
          </label>
          <label>
            <input
              type="radio"
              name="export-destination"
              checked={destination === 'obsidian'}
              onChange={() => void setExportDestination('obsidian')}
            />
            Obsidian
          </label>
        </fieldset>
        {destination === 'obsidian' && (
          <div className="export-target">
            <p>
              {target
                ? `保存位置：${target.folder}`
                : '请选择本机 Obsidian 知识库或其中的目标文件夹。'}
            </p>
            <button disabled={busy} onClick={() => void chooseTarget()}>
              {target ? '更换文件夹' : '选择文件夹'}
            </button>
          </div>
        )}
        <fieldset disabled={busy}>
          <legend>选择内容（可多选）</legend>
          {(
            [
              ['transcript', '逐字稿'],
              ['notes', '笔记'],
              ['analysis', '视频脉络'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                disabled={
                  value === 'transcript'
                    ? !record.segments.length
                    : value === 'notes'
                      ? !record.notes.length
                      : !record.analysis
                }
                checked={selected.includes(value)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, value]
                      : selected.filter((item) => item !== value),
                  )
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        {destination === 'download' && (
          <fieldset disabled={busy}>
            <legend>文件格式</legend>
            {[
              ['md', 'Markdown'],
              ['txt', 'TXT'],
              ['pdf', 'PDF'],
              ['docx', 'Word'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="export-format"
                  checked={format === value}
                  onChange={() => setFormat(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        {destination === 'download' && format === 'pdf' && (
          <p className="muted">PDF 将打开打印窗口，请选择“另存为 PDF”。</p>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={
            busy ||
            !selected.length ||
            !!duplicates.length ||
            (destination === 'obsidian' && !target)
          }
          onClick={() => void runExport()}
        >
          {busy
            ? '正在处理…'
            : destination === 'obsidian'
              ? '导出到 Obsidian'
              : '下载文件'}
        </button>
        {message && (
          <p role="status" className="export-result">
            <span aria-hidden="true">✓</span>
            {message}
          </p>
        )}
      </section>
      {!!duplicates.length && (
        <DuplicateExportDialog
          files={duplicates}
          busy={busy}
          error={error}
          onConfirm={() => void runExport(true)}
          onCancel={() => {
            setDuplicates([]);
            setError('');
          }}
        />
      )}
    </div>
  );
}
