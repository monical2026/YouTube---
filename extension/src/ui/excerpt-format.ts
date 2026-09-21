// 仅保留本插件的文字结构，不复制 HTML、事件、链接或任意内联样式。
export function excerptMarkdown(root: Node): string {
  function visit(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE)
      return (node.textContent ?? '').replace(/\u00a0/g, ' ');
    if (!(node instanceof Element) && !(node instanceof DocumentFragment))
      return '';
    const tag = node instanceof Element ? node.tagName.toLowerCase() : '';
    if (['button', 'svg', 'script', 'style', 'input', 'textarea'].includes(tag))
      return '';
    const content = [...node.childNodes].map(visit).join('');
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b')
      return content.trim() ? `**${content}**` : '';
    if (tag === 'ul' || tag === 'ol')
      return `\n\n${[...node.childNodes]
        .map(visit)
        .map((value) => value.trim())
        .filter(Boolean)
        .join('\n')}\n\n`;
    if (tag === 'li') return `\n- ${content.trim()}\n`;
    if (/^h[1-6]$/.test(tag)) return `\n\n### ${content.trim()}\n\n`;
    if (
      ['p', 'div', 'article', 'section', 'blockquote', 'ul', 'ol'].includes(tag)
    )
      return `\n\n${content.trim()}\n\n`;
    return content;
  }
  return visit(root)
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function selectionMarkdown(range: Range): string {
  const fragment = range.cloneContents();
  const parent =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const context = parent?.closest('h1,h2,h3,h4,h5,h6,li,strong,b');
  if (context && !fragment.querySelector('p,h1,h2,h3,h4,h5,h6,li,strong,b')) {
    const wrapper = document.createElement(context.tagName);
    wrapper.append(fragment);
    return excerptMarkdown(wrapper);
  }
  return excerptMarkdown(fragment);
}
export function excerptPlain(markdown: string): string {
  return markdown.replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1');
}
