import { selectionMarkdown } from './excerpt-format';
import { useState, type RefObject } from 'react';
import type { VideoRecord } from '@youtube-note/shared';
import type { Excerpt } from './learning-notes';
export type TextSelection = Excerpt & { left: number; top: number };
export function useTextSelection(
  scroll: RefObject<HTMLDivElement | null>,
  record: VideoRecord | null,
  tab: string,
) {
  const [selected, setSelected] = useState<TextSelection | null>(null);
  function selectText() {
    if (!record || !['transcript', 'analysis'].includes(tab)) {
      setSelected(null);
      return;
    }
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.toString().trim()) {
      setSelected(null);
      return;
    }
    const range = selection.getRangeAt(0),
      root = scroll.current;
    if (
      !root?.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      setSelected(null);
      return;
    }
    const nodes = [
      ...root.querySelectorAll(
        tab === 'transcript' ? 'p[data-language]' : '[data-source-ids]',
      ),
    ].filter((p) => range.intersectsNode(p));
    const ids = [
      ...new Set(
        nodes.flatMap((p) =>
          tab === 'transcript'
            ? [p.closest('[data-id]')?.getAttribute('data-id') ?? '']
            : (p.getAttribute('data-source-ids') ?? '').split(' '),
        ),
      ),
    ].filter((id) => record.segments.some((s) => s.id === id));
    const sourceText =
      nodes.flatMap((node) => [...node.querySelectorAll('p,li')])[0] ??
      nodes[0];
    const fontSize = sourceText
      ? Number.parseFloat(getComputedStyle(sourceText).fontSize)
      : undefined;
    const languages = new Set(
      nodes.map((p) => p.getAttribute('data-language')),
    );
    const rect =
      [...range.getClientRects()].at(-1) ?? range.getBoundingClientRect();
    setSelected(
      ids.length
        ? {
            text: selection.toString().trim(),
            markdown: selectionMarkdown(range),
            fontSize:
              fontSize && fontSize >= 8 && fontSize <= 32
                ? fontSize
                : undefined,
            title:
              nodes.length === 1
                ? (nodes[0].getAttribute('data-excerpt-title') ?? undefined)
                : undefined,
            ids,
            sourceKind: tab === 'analysis' ? 'analysis' : 'transcript',
            language:
              tab === 'analysis'
                ? 'mixed'
                : languages.size === 1 && languages.has('original')
                  ? 'original'
                  : languages.size === 1 && languages.has('translated')
                    ? 'translated'
                    : 'mixed',
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 180)),
            top: Math.min(rect.bottom + 6, window.innerHeight - 48),
          }
        : null,
    );
  }
  return { selected, setSelected, selectText };
}
export function SelectionActions({
  selected,
  onNote,
  onAsk,
}: {
  selected: TextSelection;
  onNote: () => void;
  onAsk: () => void;
}) {
  return (
    <div
      className="selection-actions"
      role="toolbar"
      aria-label="选中文字操作"
      style={{ left: selected.left, top: selected.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={onNote}>note</button>
      <button onClick={onAsk}>AI提问</button>
    </div>
  );
}
