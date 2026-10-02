import { itemSources } from './analysis-format';
import { AnalysisList, ExtraSources, SourceHeading } from './AnalysisFields';
import { copyText } from '../lib/clipboard';
import { useState } from 'react';
import {
  transcriptLanguage,
  timestamp,
  type Analysis,
  type Segment,
} from '@youtube-note/shared';
type Props = {
  analysis: Analysis;
  segments: Segment[];
  seek: (segment: Pick<Segment, 'startMs'>) => Promise<void>;
};
type Quote = Analysis['quotes'][number];
export function quoteText(
  quote: Quote,
  mode: 'bilingual' | 'chinese' | 'original',
  source?: Segment,
) {
  if (source && transcriptLanguage([source]) === 'zh') return quote.original;
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
  const chineseOriginal = !!source && transcriptLanguage([source]) === 'zh';
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  async function copy(mode: 'bilingual' | 'chinese' | 'original') {
    setOpen(false);
    try {
      await copyText(quoteText(quote, mode, source));
      setStatus(
        `已复制${chineseOriginal ? '原文' : mode === 'bilingual' ? '双语' : mode === 'chinese' ? '中文' : '原文'}`,
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
            title={chineseOriginal ? '复制原文' : '复制双语'}
            aria-label={chineseOriginal ? '复制原文' : '复制双语'}
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
          {!chineseOriginal && (
            <button
              className="quote-copy-icon"
              title="选择复制语言"
              aria-label="选择复制语言"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              ⌄
            </button>
          )}
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
      {!chineseOriginal && <p>{quote.chinese}</p>}
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
  function jump(source: Pick<Segment, 'startMs'>) {
    setError('');
    void seek(source).catch(() => setError('跳转失败，请回到视频页面后重试'));
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <h2 className="analysis-section-title">
        {analysis.formatVersion === 3 ? '关键点' : '知识清单'}
      </h2>
      {analysis.knowledge?.length ? (
        analysis.knowledge.map((item, index) => {
          const ranges = itemSources(item, segments);
          return (
            <article
              className="card"
              key={index}
              data-source-ids={ranges.flatMap((r) => r.ids).join(' ')}
              data-excerpt-title={item.title}
            >
              <SourceHeading title={item.title} ranges={ranges} jump={jump} />
              <AnalysisList
                title={analysis.formatVersion === 3 ? '核心含义' : '需要理解'}
                value={item.understanding}
              />
              <AnalysisList title="在视频中的作用" value={item.role} />
              <ExtraSources ranges={ranges} jump={jump} />
            </article>
          );
        })
      ) : (
        <p className="muted">
          {analysis.formatVersion !== undefined
            ? '本次未提取到有明确来源的关键点。'
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
            {analysis.formatVersion !== undefined
              ? '无特别前置要求。'
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
        <p className="muted">未发现符合独立表达要求的金句。</p>
      )}
      <h2 className="analysis-section-title">有效方法</h2>
      {analysis.methods.map((m, i) => {
        const ranges = itemSources(m, segments);
        return (
          <article
            className="card"
            key={i}
            data-source-ids={ranges.flatMap((r) => r.ids).join(' ')}
            data-excerpt-title={m.title}
          >
            <SourceHeading title={m.title} ranges={ranges} jump={jump} />
            {m.steps ? (
              <>
                <AnalysisList title="适用情况" value={m.applicability} />
                <strong>具体做法</strong>
                <ol className="analysis-list">
                  {m.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
                <AnalysisList title="条件与限制" value={m.limitations} />
              </>
            ) : (
              <p>{m.description}</p>
            )}
            <ExtraSources ranges={ranges} jump={jump} />
          </article>
        );
      })}
      {!analysis.methods.length && (
        <p className="muted">未提取到有足够具体做法的方法。</p>
      )}
    </>
  );
}
