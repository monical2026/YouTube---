import { useState } from 'react';
import type { Mode, VideoRecord } from '@youtube-note/shared';
import {
  exportBlocks,
  exportText,
  printPdf,
  type ExportSection,
} from '../export/document';
import { wordDocument } from '../export/word';
import { errorText } from '../lib/rpc';
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
    'transcript',
    'notes',
    'analysis',
  ]);
  const [format, setFormat] = useState('md'),
    [error, setError] = useState('');
  function runExport() {
    try {
      const blocks = exportBlocks(record, mode, selected);
      if (format === 'pdf') {
        printPdf(blocks);
        return;
      }
      const blob =
        format === 'docx'
          ? new Blob([wordDocument(blocks)], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
          : new Blob([exportText(blocks, format === 'md')], {
              type: 'text/plain;charset=utf-8',
            });
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `${record.title.replace(/[/:*?"<>|]/g, '_')}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (e) {
      setError(errorText(e));
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
          if (event.key === 'Escape') {
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
          <button autoFocus onClick={onClose}>
            关闭
          </button>
        </div>
        <fieldset>
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
        <fieldset>
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
        <p className="muted">
          逐字稿按当前语言模式导出，笔记保留双语。
          {format === 'pdf' ? 'PDF 将打开打印窗口，请选择“另存为 PDF”。' : ''}
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={!selected.length}
          onClick={runExport}
        >
          导出所选内容
        </button>
      </section>
    </div>
  );
}
