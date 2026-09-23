import { textItems } from './analysis-format';
import { AnalysisDetails } from './AnalysisDetails';
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
  history?: boolean;
  tab: string;
  record: VideoRecord | null;
  context: VideoContext | null;
  busy: string;
  mode: Mode;
  active?: Segment;
  getCaptions: () => Promise<void>;
  seek: (segment: Pick<Segment, 'startMs'>) => Promise<void>;
  setEditing: (segment: Segment) => void;
  newNote: (segment: Segment, text?: string) => Promise<void>;
  setEdit: (note: Note) => void;
  onAskNote: (note: Note) => void;
  deleteNote: (id: string) => Promise<void>;
};
export function ContentViews({
  history = false,
  tab,
  record,
  context,
  busy,
  mode,
  active,
  getCaptions,
  seek,
  setEditing,
  newNote,
  setEdit,
  onAskNote,
  deleteNote,
}: Props) {
  return (
    <>
      {' '}
      {tab === 'transcript' &&
        (!record?.segments.length ? (
          <div className="empty">
            <p>
              {history
                ? '这条记录尚未保存逐字稿，可返回原视频获取。'
                : '自动获取未完成，可重试；无字幕时可使用下方生成选项。'}
            </p>
            {!history && (
              <>
                <button
                  className="primary"
                  disabled={!context || !!busy}
                  onClick={() => void getCaptions()}
                >
                  重试获取字幕
                </button>
              </>
            )}
          </div>
        ) : (
          record.segments.map((segment) => (
            <article
              key={segment.id}
              data-id={segment.id}
              className={`segment ${active?.id === segment.id ? 'current' : ''}`}
              onClick={(e) => {
                if (
                  history ||
                  window.getSelection()?.toString() ||
                  (e.target instanceof Element &&
                    e.target.closest('button,textarea'))
                )
                  return;
                void seek(segment);
              }}
            >
              <div className="row">
                <button
                  className="time"
                  title="跳转到视频对应位置"
                  onClick={() => void seek(segment)}
                >
                  {timestamp(segment.startMs)} – {timestamp(segment.endMs)}
                </button>
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
      {tab === 'notes' &&
        (record?.notes.length ? (
          record.notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => setEdit(note)}
              onAsk={() => onAskNote(note)}
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
          {!record?.analysis && (
            <p className="empty">
              {history
                ? '这条记录尚未保存视频脉络，可返回原视频整理。'
                : '点击下方“脉络”整理这个视频。'}
            </p>
          )}
          {record?.analysis && (
            <>
              <h2 className="analysis-section-title">全片总结</h2>
              {record.analysis.summary.length <= 200 ? (
                <p data-source-ids={record.segments.map((s) => s.id).join(' ')}>
                  {record.analysis.summary}
                </p>
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
              {record.analysis.formatVersion !== 2 && (
                <p className="notice">
                  这份结果使用旧版整理方式，重新整理可生成切片判断、知识清单和新版金句。
                </p>
              )}
              {record.analysis.clipOverview && (
                <>
                  <h2 className="analysis-section-title">全片切片判断</h2>
                  <p>{record.analysis.clipOverview}</p>
                </>
              )}
              <p className="muted">
                基于逐字稿，仅初步判断内容价值与独立性，未检查画面。
              </p>
              {record.analysis.topics.map((topic, i) => (
                <article
                  className="card"
                  key={i}
                  data-source-ids={record.segments
                    .filter(
                      (s) =>
                        s.startMs >= topic.startMs && s.startMs < topic.endMs,
                    )
                    .map((s) => s.id)
                    .join(' ')}
                >
                  <div className="topic-heading">
                    <button className="time" onClick={() => void seek(topic)}>
                      {timestamp(topic.startMs)} – {timestamp(topic.endMs)}
                    </button>
                    <h3 className="analysis-item-title">{topic.title}</h3>
                  </div>
                  <p>{topic.introduction}</p>
                  <strong>解决问题</strong>
                  <ul className="analysis-list">
                    {textItems(topic.problem).map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                  <strong>
                    适用场景
                    {topic.applicationOrigin
                      ? `（${topic.applicationOrigin}）`
                      : ''}
                  </strong>
                  <ul className="analysis-list">
                    {textItems(topic.application).map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                  <strong>
                    切片建议{topic.clipVerdict ? ` · ${topic.clipVerdict}` : ''}
                  </strong>
                  <ul className="analysis-list">
                    {textItems(topic.clipReason).map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                </article>
              ))}
              <AnalysisDetails
                key={`${record.videoId}:${record.analysisSource}`}
                analysis={record.analysis}
                segments={record.segments}
                seek={seek}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
