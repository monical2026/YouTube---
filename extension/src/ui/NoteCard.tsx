import { AnswerText } from './AnswerText';
import { timestamp, type Note } from '@youtube-note/shared';
import { Icon } from './icons';
import { DeleteNoteButton } from './DeleteNoteButton';
export function NoteCard({
  note,
  onEdit,
  onAsk,
  onSeek,
  onDelete,
}: {
  note: Note;
  onEdit: () => void;
  onAsk: () => void;
  onSeek: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <article className="card note-card">
      <div className="note-card-heading">
        <span className="note-card-label">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path
              d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"
              strokeLinejoin="round"
            />
          </svg>
          {note.draft ? '草稿' : '笔记'}
        </span>
        <svg
          className="note-link"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path
            d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
            transform="translate(1 1) scale(.9)"
            strokeLinecap="round"
          />
        </svg>
        <button
          className="time note-time"
          title="跳转到视频对应位置"
          onClick={() => void onSeek()}
        >
          {timestamp(note.startMs).padStart(5, '0')}
        </button>
      </div>
      {note.selectedText && (
        <blockquote className="excerpt-content">
          {note.excerptMarkdown ? (
            <AnswerText text={note.excerptMarkdown} headings />
          ) : (
            note.selectedText
          )}
          {note.excerptEdited && (
            <small className="muted">（已手动编辑）</small>
          )}
        </blockquote>
      )}
      {note.aiConversation?.map((turn, i) => (
        <details className="note-conversation" key={i}>
          <summary>AI提问：{turn.question}</summary>
          <AnswerText text={turn.answer} />
          <small className="muted">AI 回答，需核对</small>
        </details>
      ))}
      {note.thought && (
        <p className="note-annotation note-thought">
          <Icon kind="thought" />
          <span>{note.thought}</span>
        </p>
      )}
      {note.selectedText === undefined && note.original && (
        <blockquote className="note-quote">
          <p>{note.original}</p>
        </blockquote>
      )}
      {note.selectedText === undefined && note.translated && (
        <p className="note-translation">{note.translated}</p>
      )}
      {note.question && (
        <p className="note-annotation note-question">
          <Icon kind="question" />
          <span>{note.question}</span>
        </p>
      )}
      <div className="note-actions">
        <button onClick={onAsk}>AI提问</button>
        <button onClick={onEdit}>{note.draft ? '继续草稿' : '编辑'}</button>
        <button onClick={() => void onSeek()}>跳转</button>
        <DeleteNoteButton onDelete={onDelete} />
      </div>
    </article>
  );
}
