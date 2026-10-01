import { useEffect, useRef, useState } from 'react';
import type { Segment, VideoContext } from '@youtube-note/shared';
import { currentSegment } from '../segmentation';
import {
  clearHighlight,
  reconcileHighlight,
  type HighlightTarget,
  type SeekTarget,
} from './playback-highlight';

export function usePlaybackHighlight(
  segments: Segment[] | undefined,
  context: VideoContext | null,
  videoId: string | undefined,
) {
  const [target, setTarget] = useState<HighlightTarget | null>(null);
  const serial = useRef(0);
  useEffect(() => {
    setTarget((previous) =>
      reconcileHighlight(previous, videoId, context?.currentMs),
    );
  }, [videoId, context]);
  const requestId = target?.requestId;
  const arrived = target?.arrived;
  useEffect(() => {
    if (requestId === undefined || arrived) return;
    // 没有进度回传时也不能无限锁住高亮；正常到达会清除此计时器。
    const timer = setTimeout(
      () => setTarget((previous) => clearHighlight(previous, requestId)),
      5000,
    );
    return () => clearTimeout(timer);
  }, [requestId, arrived]);
  function begin(selection: SeekTarget) {
    const id = ++serial.current;
    const segment = selection.id
      ? segments?.find((item) => item.id === selection.id)
      : segments && currentSegment(segments, selection.startMs);
    setTarget(
      segment && videoId
        ? { requestId: id, videoId, segment, arrived: false }
        : null,
    );
    return id;
  }
  function cancel(id: number) {
    setTarget((previous) => clearHighlight(previous, id));
  }
  const active =
    target?.videoId === videoId && target
      ? target.segment
      : segments && context
        ? currentSegment(segments, context.currentMs)
        : undefined;
  return { active, begin, cancel };
}
