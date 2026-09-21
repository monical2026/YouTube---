import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  contextSchema,
  recordSchema,
  type VideoContext,
  type VideoRecord,
  type Note,
} from '@youtube-note/shared';
import { rpc, errorText } from '../lib/rpc';
const contextEnvelope = z.object({
  context: contextSchema.nullable(),
  tabId: z.number().optional(),
});
export function useVideo() {
  const query = new URLSearchParams(location.search);
  const explicit = query.has('tab') ? Number(query.get('tab')) : undefined;
  const [context, setContext] = useState<VideoContext | null>(null),
    [record, setRecord] = useState<VideoRecord | null>(null),
    [error, setError] = useState(''),
    [tabId, setTabId] = useState(explicit);
  const current = useRef(record);

  const videoId = useRef('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let disposed = false;
    videoId.current = '';
    const port = chrome.runtime.connect({
      name: explicit === undefined ? 'panel' : `video:${explicit}`,
    });
    function receive(input: unknown) {
      const update = z
        .object({
          type: z.literal('recordChanged'),
          videoId: z.string(),
          revision: z.number(),
        })
        .safeParse(input);
      if (update.success && !disposed) {
        const target = update.data.videoId;
        if (target !== videoId.current) return;
        const task = queue.current
          .catch(() => undefined)
          .then(async () => {
            if (
              disposed ||
              target !== videoId.current ||
              (current.current?.revision ?? -1) >= update.data.revision
            )
              return;
            const loaded = recordSchema.parse(
              await rpc({ type: 'load', videoId: target }),
            );
            if (
              !disposed &&
              target === videoId.current &&
              loaded.revision > (current.current?.revision ?? -1)
            ) {
              current.current = loaded;
              setRecord(loaded);
            }
          });
        queue.current = task;
        void task.catch((e) => {
          if (!disposed) setError(errorText(e));
        });
        return;
      }
      if (input === null && !disposed) {
        videoId.current = '';
        current.current = null;
        setContext(null);
        setRecord(null);
        return;
      }
      const parsed = contextSchema.safeParse(input);
      if (!parsed.success || disposed) return;
      const ctx = parsed.data;
      setContext(ctx);
      if (ctx.videoId === videoId.current) return;
      videoId.current = ctx.videoId;
      current.current = null;
      setRecord(null);
      void rpc({ type: 'load', videoId: ctx.videoId })
        .then((data) => {
          if (!disposed && videoId.current === ctx.videoId) {
            const loaded = recordSchema.parse(data);
            current.current = loaded;
            setRecord(loaded);
          }
        })
        .catch((e) => {
          if (!disposed) setError(errorText(e));
        });
    }
    port.onMessage.addListener(receive);
    void rpc({ type: 'getContext', tabId: explicit })
      .then((data) => {
        const envelope = contextEnvelope.parse(data);
        if (!disposed) {
          setTabId(envelope.tabId);
          if (envelope.context) receive(envelope.context);
        }
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      });
    return () => {
      disposed = true;
      port.disconnect();
    };
  }, [explicit]);
  const mutate = useCallback(
    (change: (record: VideoRecord) => VideoRecord): Promise<VideoRecord> => {
      const target = videoId.current;
      const task = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (!current.current || current.current.videoId !== target)
            throw new Error('视频已切换，操作已停止');
          const before = recordSchema.parse(
            await rpc({ type: 'load', videoId: target }),
          );
          if (videoId.current !== target)
            throw new Error('视频已切换，操作已停止');
          const after = recordSchema.parse(
            await rpc({
              type: 'save',
              record: change(before),
              expectedRevision: before.revision,
            }),
          );
          if (videoId.current === target) {
            current.current = after;
            setRecord(after);
          }
          return after;
        });
      queue.current = task;
      return task;
    },
    [],
  );
  const saveNote = useCallback((note: Note): Promise<void> => {
    const task = queue.current
      .catch(() => undefined)
      .then(async () => {
        const fresh = recordSchema.parse(
          await rpc({ type: 'load', videoId: note.videoId }),
        );
        const existing = fresh.notes.find((n) => n.id === note.id);
        // 只替换指定笔记，不回写旧逐字稿；同一笔记的版本冲突留给用户处理。
        const local = current.current?.notes.find((n) => n.id === note.id);
        if (existing && local && existing.revision !== local.revision)
          throw new Error('这条笔记已在另一窗口更新，输入仍保留，请核对后保存');
        const updated = { ...note, revision: (existing?.revision ?? 0) + 1 };
        const saved = recordSchema.parse(
          await rpc({
            type: 'save',
            record: {
              ...fresh,
              notes: [...fresh.notes.filter((n) => n.id !== note.id), updated],
            },
            expectedRevision: fresh.revision,
          }),
        );
        if (videoId.current === note.videoId) {
          current.current = saved;
          setRecord(saved);
        }
      });
    queue.current = task;
    return task;
  }, []);
  return { context, record, tabId, error, setError, mutate, saveNote };
}
