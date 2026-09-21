import { timestamp, type Note } from '@youtube-note/shared';
import { Icon } from './icons';
import { DeleteNoteButton } from './DeleteNoteButton';
export function NoteCard({
  note,
  onEdit,
  onSeek,
  onDelete,
}: {
  note: Note;
  onEdit: () => void;
  onSeek: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <article className="card note-card">
      <div className="note-card-heading">
        <span className="note-card-label">
          {note.draft ? '草稿' : '笔记'}
          <span aria-hidden="true"> · </span>
        </span>
        <button
          className="time note-time"
          title="跳转到视频对应位置"
          onClick={() => void onSeek()}
        >
          {timestamp(note.startMs).padStart(5, '0')}
        </button>
      </div>
      {note.thought && (
        <p className="note-annotation note-thought">
          <Icon kind="thought" />
          <span>{note.thought}</span>
        </p>
      )}
      {note.original && (
        <blockquote className="note-quote">
          <p>{note.original}</p>
        </blockquote>
      )}
      {note.translated && <p className="note-translation">{note.translated}</p>}
      {note.question && (
        <p className="note-annotation note-question">
          <Icon kind="question" />
          <span>{note.question}</span>
        </p>
      )}
      <div className="note-actions">
        <button onClick={onEdit}>{note.draft ? '继续草稿' : '编辑'}</button>
        <button onClick={() => void onSeek()}>跳转</button>
        <DeleteNoteButton onDelete={onDelete} />
      </div>
    </article>
  );
}
