import { timestamp, type Analysis, type Segment } from '@youtube-note/shared';
import { itemSources, textItems } from './analysis-format';
export function AnalysisList({
  title,
  value,
}: {
  title: string;
  value?: string | string[];
}) {
  const items = value === undefined ? [] : textItems(value);
  if (!items.length) return null;
  return (
    <>
      <strong>{title}</strong>
      <ul className="analysis-list">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </>
  );
}
export function ClipIcon() {
  return (
    <svg
      className="clip-icon"
      width="23"
      height="18"
      viewBox="0 0 28 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6L25 17L15 13M9 16L25 5L15 9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="5" r="3.5" stroke="#db5964" strokeWidth="2.2" />
      <circle cx="6" cy="17" r="3.5" stroke="#db5964" strokeWidth="2.2" />
      <circle cx="14" cy="11" r="1.3" fill="currentColor" />
    </svg>
  );
}
export function ClipOverview({
  analysis,
  seek,
}: {
  analysis: Analysis;
  seek: (s: Pick<Segment, 'startMs'>) => Promise<void>;
}) {
  if (analysis.formatVersion !== 3)
    return analysis.clipOverview ? (
      <>
        <h2 className="analysis-section-title">全片切片判断</h2>
        <p>{analysis.clipOverview}</p>
      </>
    ) : null;
  const counts = ['高', '中', '低', '需核对画面']
    .map(
      (value) =>
        `${value} ${analysis.topics.filter((t) => t.clipVerdict === value).length} 段`,
    )
    .join(' · ');
  return (
    <>
      <h2 className="analysis-section-title">全片切片判断</h2>
      <p>{counts}</p>
      {(['高', '中', '需核对画面'] as const).map((value) => {
        const topics = analysis.topics.filter((t) => t.clipVerdict === value);
        if (!topics.length) return null;
        return (
          <details className="clip-overview" key={value} open={value === '高'}>
            <summary>
              {value === '高'
                ? '可直接剪出的片段'
                : value === '中'
                  ? '需补少量背景的片段'
                  : '需核对画面的片段'}
              （{topics.length}）
            </summary>
            <ul className="analysis-list">
              {topics.map((t, i) => (
                <li key={i}>
                  <button className="source-time" onClick={() => void seek(t)}>
                    {timestamp(t.startMs)}
                  </button>{' '}
                  {t.title}
                  {value !== '高' && (
                    <span>：{textItems(t.clipReason).join('；')}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}
export function SourceHeading({
  title,
  ranges,
  jump,
}: {
  title: string;
  ranges: ReturnType<typeof itemSources>;
  jump: (s: Pick<Segment, 'startMs'>) => void;
}) {
  return (
    <div className="topic-heading">
      {ranges[0] && (
        <button className="time" onClick={() => jump(ranges[0])}>
          {timestamp(ranges[0].startMs)}–{timestamp(ranges[0].endMs)}
        </button>
      )}
      <h3 className="analysis-item-title">{title}</h3>
    </div>
  );
}
export function ExtraSources({
  ranges,
  jump,
}: {
  ranges: ReturnType<typeof itemSources>;
  jump: (s: Pick<Segment, 'startMs'>) => void;
}) {
  if (ranges.length < 2) return null;
  return (
    <details className="knowledge-sources">
      <summary>补充出处（{ranges.length - 1}）</summary>
      {ranges.slice(1).map((r, i) => (
        <div key={i}>
          <button className="source-time" onClick={() => jump(r)}>
            {timestamp(r.startMs)}–{timestamp(r.endMs)}
          </button>{' '}
          {r.label}
        </div>
      ))}
    </details>
  );
}
