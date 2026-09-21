import { sourceRanges, textItems } from './analysis-format';
import { copyText } from '../lib/clipboard';
import { useState } from 'react';
import { timestamp, type Analysis, type Segment } from '@youtube-note/shared';
type Props = {
  analysis: Analysis;
  segments: Segment[];
  seek: (segment: Pick<Segment, 'startMs'>) => Promise<void>;
};
type Quote = Analysis['quotes'][number];
export function quoteText(
  quote: Quote,
  mode: 'bilingual' | 'chinese' | 'original',
) {
  return mode === 'chinese'
    ? quote.chinese
    : mode === 'original'
      ? quote.original
      : `${quote.chinese}\n\n${quote.original}`;
}
function QuoteCard({
  quote,
  source,
  sourceIds,
  jump,
}: {
  quote: Quote;
  source?: Segment;
  sourceIds: string[];
  jump: (source: Segment) => void;
}) {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  async function copy(mode: 'bilingual' | 'chinese' | 'original') {
    setOpen(false);
    try {
      await copyText(quoteText(quote, mode));
      setStatus(
        `已复制${mode === 'bilingual' ? '双语' : mode === 'chinese' ? '中文' : '原文'}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '复制未完成，请重试');
    }
  }
  return (
    <article className="card" data-source-ids={sourceIds.join(' ')}>
      <div className="quote-toolbar">
        <span className="muted">{quote.category}</span>
        {source && (
          <button
            className="time"
            title="跳转到视频对应位置"
            onClick={() => jump(source)}
          >
            {timestamp(source.startMs)}
          </button>
        )}
        <div className="quote-copy">
          <button
            className="quote-copy-icon"
            title="复制双语"
            aria-label="复制双语"
            onClick={() => void copy('bilingual')}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="8" y="8" width="12" height="13" rx="2" />
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
          <button
            className="quote-copy-icon"
            title="选择复制语言"
            aria-label="选择复制语言"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            ⌄
          </button>
          {open && (
            <div
              className="quote-copy-menu"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
              }}
            >
              <button onClick={() => void copy('bilingual')}>复制双语</button>
              <button onClick={() => void copy('chinese')}>复制中文</button>
              <button onClick={() => void copy('original')}>复制原文</button>
            </div>
          )}
        </div>
      </div>
      <p>{quote.chinese}</p>
      <p>{quote.original}</p>
      {quote.category === '关键事实' && (
        <small className="muted">讲者陈述，未独立核实</small>
      )}
      <div className="muted" role="status">
        {status}
      </div>
    </article>
  );
}
export function AnalysisDetails({ analysis, segments, seek }: Props) {
  const [error, setError] = useState('');
  const sources = new Map(segments.map((s) => [s.id, s]));
  function jump(source: Segment) {
    setError('');
    void seek(source).catch(() => setError('跳转失败，请回到视频页面后重试'));
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <h2 className="analysis-section-title">知识清单</h2>
      {analysis.knowledge?.length ? (
        analysis.knowledge.map((item, index) => {
          const ranges = sourceRanges(item.segmentIds, segments);
          const timeLink = (range: (typeof ranges)[number]) => (
            <button
              className="source-time"
              key={range.ids[0]}
              onClick={() =>
                void seek(range).catch(() => setError('跳转失败，请重试'))
              }
            >
              {timestamp(range.startMs)}–{timestamp(range.endMs)}
            </button>
          );
          return (
            <article
              className="card"
              key={index}
              data-source-ids={item.segmentIds.join(' ')}
              data-excerpt-title={item.title}
            >
              <h3 className="analysis-item-title">{item.title}</h3>
              <strong>需要理解</strong>
              <ul className="analysis-list">
                {textItems(item.understanding).map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
              <strong>视频中的作用</strong>
              <ul className="analysis-list">
                {textItems(item.role).map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
              <div className="knowledge-sources">
                <span className="muted">视频依据</span>
                {ranges[0] && timeLink(ranges[0])}
                {ranges.length > 1 && (
                  <details>
                    <summary>另 {ranges.length - 1} 处</summary>
                    {ranges.slice(1).map(timeLink)}
                  </details>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <p className="muted">
          {analysis.formatVersion === 2
            ? '本次未提取到可定位的核心知识点。'
            : '重新整理后可查看知识清单。'}
        </p>
      )}
      <details className="analysis-prerequisites">
        <summary>前置知识</summary>
        {analysis.prerequisites?.length ? (
          analysis.prerequisites.map((item, i) => (
            <div key={i}>
              <h3>
                {item.title} <small className="muted">{item.origin}</small>
              </h3>
              <p>{item.description}</p>
            </div>
          ))
        ) : (
          <p className="muted">
            {analysis.formatVersion === 2
              ? '无需特别的前置知识。'
              : '重新整理后可查看前置知识。'}
          </p>
        )}
      </details>
      <h2 className="analysis-section-title">金句</h2>
      {analysis.quotes.map((quote, i) => (
        <QuoteCard
          key={`${quote.segmentId}:${i}:${quote.original}`}
          quote={quote}
          sourceIds={segments
            .slice(
              segments.findIndex((s) => s.id === quote.segmentId),
              segments.findIndex(
                (s) => s.id === (quote.endSegmentId ?? quote.segmentId),
              ) + 1,
            )
            .map((s) => s.id)}
          source={sources.get(quote.segmentId)}
          jump={jump}
        />
      ))}
      {!analysis.quotes.length && (
        <p className="muted">本次未提取到有明确来源的金句。</p>
      )}
      <h2 className="analysis-section-title">有效方法</h2>
      {analysis.methods.map((m, i) => (
        <div className="card" key={i} data-source-ids={m.segmentId}>
          <h3 className="analysis-item-title">{m.title}</h3>
          <p>{m.description}</p>
        </div>
      ))}
    </>
  );
}
