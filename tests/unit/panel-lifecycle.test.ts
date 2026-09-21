import { afterEach, beforeEach, expect, it, vi } from 'vitest';
class NodeElement {
  children: NodeElement[] = [];
  parent?: NodeElement;
  shadowRoot?: NodeElement;
  style = { cssText: '', height: '', display: '' };
  hidden = false;
  textContent = '';
  contentWindow = {};
  onclick?: () => void;
  attributes = new Map<string, string>();
  constructor(
    public tag: string,
    public root = false,
  ) {}
  get isConnected(): boolean {
    return this.root || !!this.parent?.isConnected;
  }
  attachShadow() {
    this.shadowRoot = new NodeElement('shadow');
    this.shadowRoot.parent = this;
    return this.shadowRoot;
  }
  append(...nodes: NodeElement[]) {
    for (const node of nodes) {
      node.remove();
      node.parent = this;
      this.children.push(node);
    }
  }
  prepend(node: NodeElement) {
    node.remove();
    node.parent = this;
    this.children.unshift(node);
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((n) => n !== this);
    this.parent = undefined;
  }
  querySelector(tag: string): NodeElement | undefined {
    return this.children.find((n) => n.tag === tag);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
let below: NodeElement, secondary: NodeElement, pageWindow: EventTarget;
const listeners = new Set<
  (message: unknown, sender: unknown, respond: (value: unknown) => void) => void
>();
async function mount() {
  await import('../../extension/src/content/index');
  pageWindow.dispatchEvent(
    new CustomEvent('youtube-note-metadata', {
      detail: JSON.stringify({
        videoId: 'abcdefghijk',
        title: 'Test',
        durationMs: 1000,
        live: false,
        tracks: [],
      }),
    }),
  );
  await vi.advanceTimersByTimeAsync(400);
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  listeners.clear();
  below = new NodeElement('below', true);
  secondary = new NodeElement('secondary', true);
  pageWindow = new EventTarget();
  vi.stubGlobal('window', pageWindow);
  vi.stubGlobal('location', {
    pathname: '/watch',
    href: 'https://www.youtube.com/watch?v=abcdefghijk',
  });
  vi.stubGlobal('document', {
    createElement: (tag: string) => new NodeElement(tag),
    body: new NodeElement('body', true),
    querySelector: (selector: string) =>
      selector === '#below'
        ? below
        : selector === '#secondary-inner'
          ? secondary
          : selector === 'video'
            ? { currentTime: 0, paused: true }
            : undefined,
  });
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test',
      getURL: (path: string) => 'chrome-extension://test/' + path,
      sendMessage: vi.fn(async () => true),
      onMessage: {
        addListener: (fn: typeof listeners extends Set<infer T> ? T : never) =>
          listeners.add(fn),
        removeListener: (
          fn: typeof listeners extends Set<infer T> ? T : never,
        ) => listeners.delete(fn),
      },
    },
  });
  await mount();
});
afterEach(() => {
  const scope = globalThis as typeof globalThis & {
    __youtubeNoteDispose?: () => void;
  };
  scope.__youtubeNoteDispose?.();
  delete scope.__youtubeNoteDispose;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('反复收起展开保留同一个 iframe，留下横条并恢复显示', () => {
  const button = below.children[0];
  button.onclick!();
  const host = secondary.children[0],
    frame = host.shadowRoot!.querySelector('iframe')!;
  for (let i = 0; i < 10; i++) {
    const close = new Event('message');
    Object.assign(close, {
      origin: 'chrome-extension://test',
      source: frame.contentWindow,
      data: { type: 'close-panel' },
    });
    pageWindow.dispatchEvent(close);
    expect(frame.hidden).toBe(true);
    expect(host.shadowRoot!.children[0].style.display).toBe('flex');
    host.shadowRoot!.children[0].children[1].onclick!();
    expect(frame.hidden).toBe(false);
    expect(secondary.children).toEqual([host]);
  }
  host.remove();
  button.onclick!();
  expect(secondary.children[0]).toBe(host);
});
it('扩展图标消息能打开面板并给出成功响应', () => {
  const respond = vi.fn();
  listeners.forEach((fn) => fn({ type: 'toggle' }, {}, respond));
  expect(respond).toHaveBeenCalledWith({ ok: true });
  expect(secondary.children).toHaveLength(1);
});
it('重复注入清理旧定时器和消息监听，返回缓存页面不停止入口', async () => {
  vi.resetModules();
  await mount();
  expect(listeners.size).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
  const hide = new Event('pagehide');
  Object.assign(hide, { persisted: true });
  pageWindow.dispatchEvent(hide);
  expect(vi.getTimerCount()).toBe(1);
  below.children[0].onclick!();
  expect(secondary.children).toHaveLength(1);
});
