import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recordSchema, type VideoRecord } from '../../shared/src';
import { ResegmentDialog } from '../../extension/src/ui/ResegmentDialog';
import '../../extension/src/ui/style.css';

// 仅使用截图文字复现断句；内存保存夹具，不连接真实账户或视频数据库。
const initial = recordSchema.parse({
  videoId: 'local-fixture',
  title: '截图文字分段复现',
  revision: 0,
  analysis: null,
  segments: [
    {
      id: 'a',
      original: 'This is really the the meaning of that',
      translated: '这真的是它的意思',
      startMs: 654000,
      endMs: 657000,
    },
    {
      id: 'b',
      original: 'number E.',
      translated: '编号 E。',
      startMs: 655000,
      endMs: 658000,
    },
  ],
  notes: [],
});
function Harness() {
  const [record, setRecord] = useState(initial);
  const [open, setOpen] = useState(false);
  const [fail, setFail] = useState(false);
  const [status, setStatus] = useState('');
  async function mutate(change: (r: VideoRecord) => VideoRecord) {
    if (fail) throw new Error('模拟保存失败，原内容保留');
    const next = recordSchema.parse(change(record));
    const saved = { ...next, revision: record.revision + 1 };
    setRecord(saved);
    return saved;
  }
  return (
    <main style={{ maxWidth: 430, margin: 'auto', padding: 16 }}>
      <h1>分段交互验证</h1>
      <p>
        截图文字复现；使用真实分段代码和预览组件，保存操作为内存夹具，不代表
        Chrome 产品验收。
      </p>
      <button onClick={() => setOpen(true)}>预览分段</button>
      <label>
        <input
          type="checkbox"
          checked={fail}
          onChange={(e) => setFail(e.target.checked)}
        />
        模拟保存失败
      </label>
      <p role="status">{status}</p>
      <div data-testid="segments">
        {record.segments.map((s) => (
          <article className="segment" key={s.id}>
            <p>{s.original}</p>
            <p>{s.translated || '尚未翻译'}</p>
          </article>
        ))}
      </div>
      <p>备份：{record.transcriptBackup?.segments.length ?? 0} 段</p>
      {open && (
        <ResegmentDialog
          record={record}
          mutate={mutate}
          onClose={(changed) => {
            setOpen(false);
            setStatus(changed ? '已保存' : '已取消');
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
