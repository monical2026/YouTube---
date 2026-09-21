import { NoteCard } from './NoteCard';
import {
  timestamp,
  sourceVersion,
  type VideoRecord,
  type VideoContext,
  type Segment,
  type Note,
  type Mode,
} from '@youtube-note/shared';
type Props = {
  tab: string;
  record: VideoRecord | null;
  context: VideoContext | null;
  busy: string;
  mode: Mode;
  active?: Segment;
  selected: { text: string; id: string } | null;
  getCaptions: () => Promise<void>;
  seek: (segment: Pick<Segment, 'startMs'>) => Promise<void>;
  setEditing: (segment: Segment) => void;
  newNote: (segment: Segment, text?: string) => Promise<void>;
  setEdit: (note: Note) => void;
  analyze: () => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
};
export function ContentViews({
  tab,
  record,
  context,
  busy,
  mode,
  active,
  selected,
  getCaptions,
  seek,
  setEditing,
  newNote,
  setEdit,
  analyze,
  deleteNote,
}: Props) {
  return (
    <>
      {' '}
      {tab === 'transcript' &&
        (!record?.segments.length ? (
          <div className="empty">
            <p>自动获取未完成，可重试；无字幕时可使用下方生成选项。</p>
            <button
              className="primary"
              disabled={!context || !!busy}
              onClick={() => void getCaptions()}
            >
              重试获取字幕
            </button>
          </div>
        ) : (
          record.segments.map((segment) => (
            <article
              key={segment.id}
              data-id={segment.id}
              className={`segment ${active?.id === segment.id ? 'current' : ''}`}
              onClick={(e) => {
                if (
                  window.getSelection()?.toString() ||
                  (e.target instanceof Element &&
                    e.target.closest('button,textarea'))
                )
                  return;
                void seek(segment);
              }}
            >
              <div className="row">
                <span className="time">
                  {timestamp(segment.startMs)} – {timestamp(segment.endMs)}
                </span>
                <div>
                  <button onClick={() => setEditing(segment)}>编辑</button>
                  <button onClick={() => void newNote(segment)}>摘录</button>
                </div>
              </div>
              {mode !== 'chinese' && (
                <p
                  data-language="original"
                  className={mode === 'bilingual' ? 'english' : ''}
                >
                  {segment.original}
                </p>
              )}
              {mode !== 'original' && (
                <p data-language="translated">
                  {segment.translated || '尚未翻译'}
                </p>
              )}
              {segment.segmentationWarning === 'unresolved' && (
                <p className="muted">这一段仍偏长，原文缺少可靠断点。</p>
              )}
            </article>
          ))
        ))}
      {selected && tab === 'transcript' && (
        <button
          className="primary"
          style={{ position: 'sticky', bottom: 4 }}
          onClick={() => {
            const s = record?.segments.find((s) => s.id === selected.id);
            if (s) void newNote(s, selected.text);
          }}
        >
          做笔记
        </button>
      )}
      {tab === 'notes' &&
        (record?.notes.length ? (
          record.notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => setEdit(note)}
              onSeek={() => seek(note)}
              onDelete={() => deleteNote(note.id)}
            />
          ))
        ) : (
          <div className="empty">
            使用快速记笔记快捷键，或选中逐字稿文字，留下第一条笔记。快捷键可在设置中查看和修改。
          </div>
        ))}
      {tab === 'analysis' && (
        <>
          <button
            className="primary"
            disabled={!!busy || !record?.segments.length}
            onClick={() => void analyze()}
          >
            用 LLM 整理视频脉络
          </button>
          {record?.analysis && (
            <>
              <h2>全片总结</h2>
              {record.analysis.summary.length <= 200 ? (
                <p>{record.analysis.summary}</p>
              ) : (
                <p className="muted">
                  这份旧结果尚无简短的全片总结，可重新整理。各部分内容见下方。
                </p>
              )}
              {record.analysis.warnings?.map((warning, index) => (
                <p className="notice" key={index}>
                  {warning}
                </p>
              ))}
              {record.analysisSource !== sourceVersion(record.segments) && (
                <p className="notice">逐字稿有更新，可重新整理。</p>
              )}
              {record.analysis.topics.map((topic, i) => (
                <article className="card" key={i}>
                  <button className="time" onClick={() => void seek(topic)}>
                    {timestamp(topic.startMs)} – {timestamp(topic.endMs)}
                  </button>
                  <h3>{topic.title}</h3>
                  <p>{topic.introduction}</p>
                  <p>解决问题：{topic.problem}</p>
                  <p>适用场景：{topic.application}</p>
                  <p>短视频建议：{topic.clipReason}</p>
                </article>
              ))}
              <h2>金句</h2>
              {record.analysis.quotes.map((q, i) => (
                <div className="card" key={i}>
                  <p>{q.original}</p>
                  <p>{q.chinese}</p>
                </div>
              ))}
              <h2>有效方法</h2>
              {record.analysis.methods.map((m, i) => (
                <div className="card" key={i}>
                  <h3>{m.title}</h3>
                  <p>{m.description}</p>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}
