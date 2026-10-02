import { z } from 'zod';
import { pageSource, type VideoContext } from '@youtube-note/shared';
import { groupCues } from '../segmentation';
const partSchema = z.object({
  cid: z.number().int().positive(),
  page: z.number().int().positive(),
  duration: z.number().positive(),
  part: z.string(),
});
const stateSchema = z.object({
  bvid: z.string().optional(),
  cid: z.number().int().positive(),
  p: z.number().int().positive(),
  videoData: z.object({
    bvid: z.string(),
    title: z.string(),
    pages: z.array(partSchema),
    rights: z.object({ is_stein_gate: z.number().optional() }).optional(),
  }),
});
export function bilibiliMetadata(
  input: unknown,
  href: string,
  duration: number,
): Omit<VideoContext, 'ad' | 'playing' | 'currentMs'> | null {
  const page = pageSource(href),
    parsed = stateSchema.safeParse(input);
  if (page?.platform !== 'bilibili' || !parsed.success) return null;
  const state = parsed.data;
  const part = state.videoData.pages.find((p) => p.page === page.page);
  if (
    state.videoData.bvid !== page.id ||
    state.p !== page.page ||
    !part ||
    part.cid !== state.cid ||
    state.videoData.rights?.is_stein_gate === 1 ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    Math.abs(duration - part.duration) > 3
  )
    return null;
  return {
    videoId: `bilibili-${page.id}-${state.cid}-p${page.page}`,
    title:
      state.videoData.title +
      (state.videoData.pages.length > 1 ? ` · P${part.page} ${part.part}` : ''),
    durationMs: Math.round(duration * 1000),
    live: false,
    tracks: [],
  };
}
const subtitleSchema = z.object({
  body: z
    .array(
      z
        .object({
          from: z.number().nonnegative(),
          to: z.number().nonnegative(),
          content: z.string(),
        })
        .refine((c) => c.to >= c.from),
    )
    .min(1)
    .max(100000),
});
export function bilibiliSegments(
  input: unknown,
  language: string,
  durationMs: number,
) {
  const parsed = subtitleSchema.parse(input);
  if (parsed.body.some((c) => c.to * 1000 > durationMs + 3000))
    throw new Error('字幕时间超出当前分 P，未保存');
  const segments = groupCues(
    parsed.body.map((c, i) => ({
      id: `bili-${i}`,
      text: c.content,
      startMs: Math.round(c.from * 1000),
      endMs: Math.round(c.to * 1000),
    })),
  );
  if (!segments.length) throw new Error('字幕内容为空');
  return segments.map((s) => ({ ...s, sourceLanguage: language }));
}
