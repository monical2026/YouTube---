import { useEffect, useRef } from 'react';
import type { Mode, VideoRecord } from '@youtube-note/shared';

// 每次进入视频只自动尝试一次；失败交给明确的重试操作，避免无限请求。
export function usePreparation({
  record,
  videoId,
  mode,
  busy,
  quickId,
  getCaptions,
  translateLocal,
}: {
  record: VideoRecord | null;
  videoId?: string;
  mode: Mode;
  busy: string;
  quickId: string | null;
  getCaptions: () => Promise<void>;
  translateLocal: () => Promise<void>;
}) {
  const attempted = useRef({
    videoId: '',
    captions: false,
    translation: false,
  });
  useEffect(() => {
    if (!record || record.videoId !== videoId || busy) return;
    if (attempted.current.videoId !== videoId)
      attempted.current = { videoId, captions: false, translation: false };
    if (!record.segments.length) {
      if (!attempted.current.captions) {
        attempted.current.captions = true;
        void getCaptions();
      }
      return;
    }
    if (
      !quickId &&
      mode !== 'original' &&
      !attempted.current.translation &&
      record.segments.some((s) => !s.translated && !s.manual)
    ) {
      attempted.current.translation = true;
      void translateLocal();
    }
  }, [record, videoId, busy, mode, quickId, getCaptions, translateLocal]);
}
