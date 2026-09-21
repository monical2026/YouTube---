import { Fragment } from 'react';
import { answerSections, answerHeading } from './answer-sections';
function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
// 只呈现常见标题、加粗与条目，模型文本不进入 HTML 执行环境。
export function AnswerText({
  text,
  headings = false,
}: {
  text: string;
  headings?: boolean;
}) {
  return (
    <div className="ai-answer">
      {(headings
        ? text.split(/\n\s*\n/).filter(Boolean)
        : answerSections(text)
      ).map((block, i) => {
        const title = !headings ? answerHeading(block) : undefined;
        if (title)
          return (
            <h4 className="answer-section-title" key={i}>
              <span aria-hidden="true">◆</span>
              {title}
            </h4>
          );
        const lines = block.split('\n');
        if (lines.every((line) => /^\s*(?:[-*]|\d+[.、])\s+/.test(line)))
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>
                  {inline(line.replace(/^\s*(?:[-*]|\d+[.、])\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        if (headings && /^#{1,6}\s/.test(block))
          return <h3 key={i}>{inline(block.replace(/^#{1,6}\s+/, ''))}</h3>;
        return <p key={i}>{inline(block.replace(/^#{1,4}\s+/, ''))}</p>;
      })}
    </div>
  );
}
