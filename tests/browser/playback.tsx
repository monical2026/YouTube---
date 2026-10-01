import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { contextSchema, recordSchema } from '../../shared/src';
import { ContentViews } from '../../extension/src/ui/ContentViews';
import { usePlaybackHighlight } from '../../extension/src/ui/usePlaybackHighlight';
import '../../extension/src/ui/style.css';
const record = recordSchema.parse({
  videoId: 'abcdefghijk',
  title: '隔离高亮测试',
  segments: [
    { id: 'before', startMs: 1790000, endMs: 1800000, original: '上一段' },
    { id: 'clicked', startMs: 1800000, endMs: 1810000, original: '点击目标' },
    { id: 'after', startMs: 1810000, endMs: 1820000, original: '下一段' },
  ],
  notes: [],
  revision: 0,
  analysis: null,
});
function Fixture() {
  const [context, setContext] = useState(
    contextSchema.parse({
      videoId: record.videoId,
      title: record.title,
      currentMs: 1795000,
      durationMs: 1820000,
      live: false,
      playing: true,
      ad: false,
      tracks: [],
    }),
  );
  const { active, begin, cancel } = usePlaybackHighlight(
    record.segments,
    context,
    context.videoId,
  );
  const [request, setRequest] = useState(0);
  const progress = (currentMs: number) =>
    setContext((c) => ({ ...c, currentMs }));
  return (
    <>
      <div>
        <button onClick={() => progress(1799999)}>旧进度</button>
        <button onClick={() => progress(1800000)}>到达边界</button>
        <button onClick={() => progress(1810000)}>播放下一段</button>
        <button onClick={() => cancel(request)}>跳转失败</button>
        <button
          onClick={() => setContext((c) => ({ ...c, videoId: 'other-video' }))}
        >
          切换视频
        </button>
      </div>
      <ContentViews
        tab="transcript"
        record={record}
        context={context}
        mode="original"
        busy=""
        active={active}
        seek={async (segment) => setRequest(begin(segment))}
        getCaptions={async () => {}}
        setEditing={() => {}}
        newNote={async () => {}}
        setEdit={() => {}}
        onAskNote={() => {}}
        deleteNote={async () => {}}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
