import {
  sourceVersion,
  type Segment,
  type VideoRecord,
} from '@youtube-note/shared';
import { groupCues, SEGMENTATION_VERSION } from './regroup';
import { recoverCues } from './sources';

export type TranscriptPreview = {
  videoId: string;
  source: string;
  segments: Segment[];
};
export function previewTranscript(record: VideoRecord): TranscriptPreview {
  const segments: Segment[] = [];
  let pending: Segment[] = [];
  function flush() {
    const byId = new Map(pending.map((s) => [s.id, s]));
    const unchangedKey = (s: Segment) =>
      JSON.stringify([s.startMs, s.endMs, s.original]);
    const byContent = new Map<string, Segment[]>();
    for (const old of pending) {
      const key = unchangedKey(old);
      byContent.set(key, [...(byContent.get(key) ?? []), old]);
    }
    const grouped = groupCues(recoverCues(pending));
    for (const segment of grouped) {
      const old =
        segment.sourceCueIds?.length === 1
          ? byId.get(segment.sourceCueIds[0])
          : undefined;
      const same = old ?? byContent.get(unchangedKey(segment))?.shift();
      // 边界未变时保留原标识、译文和修订，避免无谓重翻译。
      segments.push(
        same && unchangedKey(same) === unchangedKey(segment) ? same : segment,
      );
    }
    pending = [];
  }
  for (const segment of record.segments) {
    // 手改段落与已采用当前算法的段落作为边界，保持已有成果。
    if (
      segment.manual ||
      segment.segmentationVersion === SEGMENTATION_VERSION
    ) {
      flush();
      segments.push(segment);
    } else pending.push(segment);
  }
  flush();
  return {
    videoId: record.videoId,
    source: sourceVersion(record.segments),
    segments,
  };
}
export function applyTranscript(
  record: VideoRecord,
  preview: TranscriptPreview,
): VideoRecord {
  if (
    record.videoId !== preview.videoId ||
    sourceVersion(record.segments) !== preview.source
  )
    throw new Error('视频或逐字稿已变化，请重新预览；原内容未覆盖');
  if (sourceVersion(record.segments) === sourceVersion(preview.segments))
    return record;
  return {
    ...record,
    segments: preview.segments,
    transcriptBackup: { segments: record.segments, savedAt: Date.now() },
  };
}
export function restoreTranscript(
  record: VideoRecord,
  preview: TranscriptPreview,
): VideoRecord {
  if (!record.transcriptBackup) throw new Error('没有可恢复的逐字稿');
  return applyTranscript(record, {
    ...preview,
    segments: record.transcriptBackup.segments,
  });
}
