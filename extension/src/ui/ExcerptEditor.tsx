import { useRef } from 'react';
import { AnswerText } from './AnswerText';
import { excerptMarkdown, excerptPlain } from './excerpt-format';
export function ExcerptEditor({
  text,
  markdown,
  edited = false,
  onChange,
}: {
  text: string;
  markdown?: string;
  edited?: boolean;
  onChange: (text: string, markdown: string) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  // 输入期间保持 DOM 由浏览器编辑，避免自动保存重渲染使光标跳动。
  const initial = useRef(
    markdown ? <AnswerText text={markdown} headings /> : <p>{text}</p>,
  );
  function changed() {
    if (!editor.current) return;
    const value = excerptMarkdown(editor.current);
    onChange(excerptPlain(value), value);
  }
  function format(command: string, value?: string) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    changed();
  }
  return (
    <div className="excerpt-field">
      <div className="excerpt-heading">
        <span>摘录</span>
        {edited && <small className="excerpt-edited">已手动编辑</small>}
      </div>
      <small className="muted">可直接编辑；只修改这条笔记</small>
      <div className="excerpt-tools" role="toolbar" aria-label="摘录排版">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format('bold')}
        >
          加粗
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format('insertUnorderedList')}
        >
          列表
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format('formatBlock', 'h3')}
        >
          小标题
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format('formatBlock', 'p')}
        >
          正文
        </button>
      </div>
      <div
        ref={editor}
        className="excerpt-content excerpt-input"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="编辑摘录"
        aria-multiline="true"
        onInput={changed}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            'insertText',
            false,
            event.clipboardData.getData('text/plain'),
          );
          changed();
        }}
      >
        {initial.current}
      </div>
    </div>
  );
}
