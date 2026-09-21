import {
  segmentSchema,
  type Segment,
  type VideoRecord,
} from '@youtube-note/shared';
import { z } from 'zod';
import { prepareSegments } from '../segmentation';
export function createCaptionCache(
  load: (id: string) => Promise<VideoRecord>,
  save: (record: VideoRecord, revision: number) => Promise<VideoRecord>,
) {
  const pending = new Map<string, Promise<Segment[]>>();
  async function retrieve(id: string, fetch: () => Promise<unknown>) {
    const cached = await load(id);
    if (cached.segments.length) return cached.segments;
    const segments = prepareSegments(
      z
        .array(segmentSchema)
        .min(1)
        .parse(await fetch()),
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await load(id);
      if (current.segments.length) return current.segments;
      try {
        return (await save({ ...current, segments }, current.revision))
          .segments;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes('记录已在另一窗口更新') ||
          attempt === 2
        )
          throw error;
      }
    }
    throw new Error('字幕保存失败，请稍后重试');
  }
  return function cachedCaptions(id: string, fetch: () => Promise<unknown>) {
    const existing = pending.get(id);
    if (existing) return existing;
    const task = retrieve(id, fetch);
    pending.set(id, task);
    void task.finally(() => pending.delete(id)).catch(() => undefined);
    return task;
  };
}
