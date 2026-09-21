import { applyTranslations } from './translation-results';
import { z } from 'zod';
import {
  segmentSchema,
  analysisSchema,
  sourceVersion,
  analysisBatches,
  mergeAnalyses,
  type Analysis,
} from '@youtube-note/shared';
import { rpc, errorText } from '../lib/rpc';
import { currentSegment } from '../segmentation';
import { createLocal } from '../translation/local';
import type { useVideo } from './useVideo';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
type Candidate = { id: string; revision: number; text: string }[] | null;
type Props = Pick<
  ReturnType<typeof useVideo>,
  'record' | 'context' | 'tabId' | 'mutate' | 'setError'
> & {
  busy: string;
  generation: MutableRefObject<number>;
  jobLock: MutableRefObject<number | null>;
  setBusy: Dispatch<SetStateAction<string>>;
  setProgress: Dispatch<SetStateAction<number | null>>;
  setCandidate: Dispatch<SetStateAction<Candidate>>;
};
export function videoActions({
  record,
  context,
  tabId,
  mutate,
  setError,
  busy,
  generation,
  jobLock,
  setBusy,
  setProgress,
  setCandidate,
}: Props) {
  async function run(label: string, action: (token: number) => Promise<void>) {
    if (busy || jobLock.current === generation.current) return;
    const token = generation.current;
    jobLock.current = token;
    setBusy(label);
    setError('');
    try {
      await action(token);
    } catch (e) {
      if (token === generation.current) setError(errorText(e));
    } finally {
      if (jobLock.current === token) jobLock.current = null;
      if (token === generation.current) {
        setBusy('');
        setProgress(null);
      }
    }
  }
  async function getCaptions() {
    await run('正在获取已有字幕…', async (token) => {
      const result = z
        .array(segmentSchema)
        .parse(
          await rpc({ type: 'captions', videoId: context?.videoId, tabId }),
        );
      if (token !== generation.current) return;
      await mutate((r) => ({
        ...r,
        title: context?.title ?? r.title,
        segments: r.segments.length ? r.segments : result,
      }));
    });
  }
  async function translateLocal() {
    if (!record) return;
    await run('正在准备本地翻译…', async (token) => {
      const translator = await createLocal((value) => {
        if (token === generation.current) setProgress(value);
      });
      try {
        const pending = record.segments.filter(
          (s) => !s.translated && !s.manual,
        );
        let completed = 0;
        for (const segment of pending) {
          if (token !== generation.current) break;
          setBusy(`正在翻译 ${completed + 1} / ${pending.length}`);
          const translated = await translator.translate(segment.original);
          if (token !== generation.current) break;
          await mutate((r) => ({
            ...r,
            segments: r.segments.map((s) =>
              s.id === segment.id &&
              s.revision === segment.revision &&
              !s.manual
                ? {
                    ...s,
                    translated,
                    engine: 'chrome-local',
                    revision: s.revision + 1,
                  }
                : s,
            ),
          }));
          setProgress(++completed / pending.length);
        }
      } finally {
        translator.destroy();
      }
    });
  }
  async function llmTranslate(scope: 'current' | 'all' = 'current') {
    if (!record || !context) return;
    const current = currentSegment(record.segments, context.currentMs);
    const segments =
      scope === 'all' ? record.segments : current ? [current] : [];
    if (!segments.length) {
      setError('当前位置没有对应逐字稿，请选择有字幕的时间');
      return;
    }
    await run(
      scope === 'all' ? '正在翻译全片…' : '正在翻译当前片段…',
      async (token) => {
        const candidate: NonNullable<Candidate> = [];
        for (let offset = 0; offset < segments.length; offset += 20) {
          if (token !== generation.current) return;
          const batch = segments.slice(offset, offset + 20);
          const rows = z
            .array(z.object({ id: z.string(), text: z.string() }))
            .parse(
              await rpc({
                type: 'native',
                operation: 'generate',
                payload: { task: 'translate', segments: batch },
              }),
            );
          if (token !== generation.current) return;
          candidate.push(
            ...rows.map((row) => ({
              ...row,
              revision: batch.find((s) => s.id === row.id)?.revision ?? -1,
            })),
          );
          await mutate((r) => {
            const applied = applyTranslations(r.segments, candidate);
            candidate.splice(0, candidate.length, ...applied.conflicts);
            return { ...r, segments: applied.segments };
          });
          if (token !== generation.current) return;
          setCandidate(candidate.length ? [...candidate] : null);
          setProgress(Math.min(1, (offset + batch.length) / segments.length));
        }
      },
    );
  }
  async function analyze() {
    if (!record) return;
    await run('正在整理视频脉络…', async (token) => {
      const batches = analysisBatches(record.segments);
      const parts: Analysis[] = [];
      for (const [index, segments] of batches.entries()) {
        if (token !== generation.current) return;
        setBusy(`正在整理视频脉络 · 第 ${index + 1} / ${batches.length} 部分`);
        parts.push(
          analysisSchema.parse(
            await rpc({
              type: 'native',
              operation: 'generate',
              payload: { task: 'analyze', segments },
            }),
          ),
        );
        if (token !== generation.current) return;
        setProgress((index + 1) / batches.length);
      }
      const result = mergeAnalyses(parts);
      if (parts.length > 1 || result.summary.length > 160) {
        setBusy('正在生成简短总览…');
        try {
          result.summary = z
            .string()
            .min(1)
            .max(200)
            .parse(
              await rpc({
                type: 'native',
                operation: 'generate',
                payload: {
                  task: 'summarize',
                  summaries: parts.map((part) => part.summary),
                },
              }),
            );
        } catch {
          result.warnings = [
            ...(result.warnings ?? []),
            '简短总览未生成，暂保留各部分总结，可展开查看。',
          ];
        }
        if (token !== generation.current) return;
      }
      await mutate((r) => {
        if (sourceVersion(r.segments) !== sourceVersion(record.segments))
          throw new Error('整理期间逐字稿已修改，请重新整理；已有内容仍保留');
        return {
          ...r,
          analysis: result,
          analysisSource: sourceVersion(record.segments),
        };
      });
    });
  }

  return { run, getCaptions, translateLocal, llmTranslate, analyze };
}
