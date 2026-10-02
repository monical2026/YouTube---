import { useEffect, useRef } from 'react';
export function DuplicateExportDialog({
  files,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  files: string[];
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="duplicate-export-dialog"
      aria-labelledby="duplicate-export-title"
      aria-describedby="duplicate-export-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="duplicate-export-title">这个视频已导出过</h2>
      <p id="duplicate-export-description">
        目标文件夹中已有这个视频的导出文档，内容可能重合。继续将生成文件名带“副本”的新文档，已有文件不会被覆盖。
      </p>
      <ul>
        {files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <div className="row">
        <button autoFocus disabled={busy} onClick={onCancel}>
          取消
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? '正在导出…' : '继续导出副本'}
        </button>
      </div>
    </dialog>
  );
}
