import type { Note, QuestionRequest } from '@youtube-note/shared';
import { questionPayload } from './learning-notes';
export async function answerNote(
  note: Note,
  save: (note: Note) => Promise<void>,
  generate: (payload: QuestionRequest) => Promise<string>,
  current: () => boolean,
  received: (note: Note) => void,
  answerInstructions?: string,
) {
  const payload = {
    ...questionPayload(note, note.question),
    answerInstructions,
  };
  await save(note);
  if (!current()) return;
  const answer = await generate(payload);
  if (!current()) return;
  const answered = {
    ...note,
    aiConversation: [
      ...(note.aiConversation ?? []),
      { question: note.question, answer, createdAt: Date.now() },
    ],
    updatedAt: Date.now(),
  };
  received(answered);
  await save(answered);
  return answered;
}
