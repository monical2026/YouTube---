import { expect, it, vi } from 'vitest';
import { noteSchema } from '../../shared/src';
import { answerNote } from '../../extension/src/ui/answer-note';
const note = noteSchema.parse({
  id: 'n1',
  videoId: 'abcdefghijk',
  title: '视频',
  startMs: 0,
  sourceRevision: 0,
  translated: '',
  thought: '',
  revision: 0,
  draft: false,
  updatedAt: 1,
  segmentId: 's1',
  original: 'Source',
  question: '如何理解？',
});
it('同一笔记重新打开并发送相同问题，不重复调用模型或追加问答', async () => {
  const generate = vi.fn(async () => '回答');
  let stored = note;
  const save = async (next: typeof note) => {
    stored = structuredClone(next);
  };
  await answerNote(
    note,
    save,
    generate,
    () => true,
    () => {},
  );
  const reopened = structuredClone(stored);
  await answerNote(
    { ...reopened, question: ' 如何理解？ ' },
    save,
    generate,
    () => true,
    () => {},
  );
  expect(generate).toHaveBeenCalledTimes(1);
  expect(stored.aiConversation).toHaveLength(1);
});
it('不同笔记的相同问题分别保存，新追问追加并保留前一轮', async () => {
  const generate = vi.fn(async () => '回答');
  const save = vi.fn(async () => {});
  const first = await answerNote(
    note,
    save,
    generate,
    () => true,
    () => {},
  );
  const other = await answerNote(
    { ...note, id: 'n2' },
    save,
    generate,
    () => true,
    () => {},
  );
  const follow = await answerNote(
    { ...first!, question: '举个例子？' },
    save,
    generate,
    () => true,
    () => {},
  );
  expect(other?.id).toBe('n2');
  expect(follow?.aiConversation?.map((t) => t.question)).toEqual([
    '如何理解？',
    '举个例子？',
  ]);
  expect(generate).toHaveBeenCalledTimes(3);
});

it('回答保存失败后只重存收到的答案，不重新请求；旧问答和个人内容保留', async () => {
  const generate = vi.fn(async () => '待保存回答');
  const prior = {
    ...note,
    thought: '个人理解',
    aiConversation: [{ question: '旧问题', answer: '旧回答', createdAt: 1 }],
  };
  let received = prior;
  const save = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('磁盘写入失败'))
    .mockResolvedValue(undefined);
  await expect(
    answerNote(
      prior,
      save,
      generate,
      () => true,
      (n) => {
        received = n;
      },
    ),
  ).rejects.toThrow('磁盘写入失败');
  expect(received.aiConversation).toHaveLength(2);
  await save(received);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(received.thought).toBe('个人理解');
  expect(received.aiConversation[0].answer).toBe('旧回答');
});
