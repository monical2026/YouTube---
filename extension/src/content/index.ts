import { contextSchema, type VideoContext } from '@youtube-note/shared';
import { createRuntimeSession } from './runtime-session';
const previous = globalThis as typeof globalThis & {
  __youtubeNoteDispose?: () => void;
};
previous.__youtubeNoteDispose?.();
let collapsedBar: HTMLElement | undefined;
let metadata: Omit<VideoContext, 'currentMs' | 'playing' | 'ad'> | undefined;
let mountedVideo = '';
let button: HTMLButtonElement | undefined;
let panel: HTMLElement | undefined;
let noteWindow: HTMLElement | undefined;
let panelOpen = false;
const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
const panelUrl = chrome.runtime.getURL('panel.html');
const listeners = new AbortController();
const session = createRuntimeSession(
  () => chrome.runtime.id,
  (message) => chrome.runtime.sendMessage(message),
  () => {
    clearInterval(timer);
    listeners.abort();
    try {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    } catch {
      /* 扩展已失效时 Chrome 已清理运行时监听器。 */
    }
    reset();
    panelOpen = false;
    metadata = undefined;
  },
);
previous.__youtubeNoteDispose = () => session.stop();
function frameHost(noteId?: string): HTMLElement {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const frame = document.createElement('iframe');
  frame.src = `${panelUrl}${noteId ? `?note=${encodeURIComponent(noteId)}` : ''}`;
  frame.title = noteId ? '快捷笔记' : '学习笔记';
  frame.allow = 'translator';
  frame.style.cssText =
    'width:100%;height:100%;border:0;border-radius:14px;color-scheme:light dark';
  shadow.append(frame);
  host.style.cssText = noteId
    ? 'position:fixed;right:24px;bottom:24px;width:400px;max-width:95vw;height:440px;z-index:2147483000;box-shadow:0 12px 36px #0004;border-radius:14px'
    : 'width:100%;max-width:560px;min-width:320px;height: min(780px,85vh);margin-bottom:16px';
  return host;
}
function validVideo(): boolean {
  return (
    location.pathname === '/watch' &&
    !!metadata &&
    new URL(location.href).searchParams.get('v') === metadata.videoId &&
    !metadata.live
  );
}
function showPanel() {
  if (!session.active() || !validVideo()) return;
  if (!panel) {
    panel = frameHost();
    collapsedBar = document.createElement('div');
    collapsedBar.style.cssText =
      'align-items:center;justify-content:space-between;padding:8px 12px;background:#f5f5fa;color:#242630;border:1px solid #e4e7f0;border-radius:12px;font:14px system-ui';
    const name = document.createElement('span');
    name.textContent = 'YouTube 学习笔记';
    const expand = document.createElement('button');
    expand.textContent = '展开';
    expand.style.cssText =
      'border:0;border-radius:8px;background:#e9ecff;color:#4658cb;padding:6px 12px;cursor:pointer';
    expand.onclick = showPanel;
    collapsedBar.append(name, expand);
    panel.shadowRoot?.prepend(collapsedBar);
  }
  if (!panel.isConnected) {
    const target =
      document.querySelector('#secondary-inner') ??
      document.querySelector('#below');
    if (!target) return;
    target.prepend(panel);
  }
  alignPanel();
  panelOpen = true;
  panel.style.height = 'min(780px,85vh)';
  const frame = panel.shadowRoot?.querySelector('iframe');
  if (frame) frame.hidden = false;
  if (collapsedBar) collapsedBar.style.display = 'none';
  button?.setAttribute('aria-expanded', 'true');
}
function alignPanel() {
  const video = document.querySelector('video');
  if (!panel?.isConnected || typeof video?.getBoundingClientRect !== 'function')
    return;
  panel.style.marginTop = '0px';
  panel.style.transform = '';
  panel.style.marginBottom = '16px';
  const player = (
      document.querySelector('#player') ?? video
    ).getBoundingClientRect(),
    side = panel.getBoundingClientRect();
  // 只在双栏布局调整右栏顶部，影院模式或窄屏不移动到播放器区域。
  const gap = side.top - player.top;
  if (side.left >= player.right - 8 && gap > 0 && gap <= 200) {
    panel.style.transform = `translateY(-${gap}px)`;
    panel.style.marginBottom = `${16 - gap}px`;
  }
}
window.addEventListener('resize', alignPanel, { signal: listeners.signal });
function collapsePanel() {
  if (!panel) return;
  panelOpen = false;
  const frame = panel.shadowRoot?.querySelector('iframe');
  if (frame) frame.hidden = true;
  panel.style.height = 'auto';
  if (collapsedBar) collapsedBar.style.display = 'flex';
  button?.setAttribute('aria-expanded', 'false');
}
function reset() {
  button?.remove();
  panel?.remove();
  noteWindow?.remove();
  button = undefined;
  panel = undefined;
  collapsedBar = undefined;
  noteWindow = undefined;
  mountedVideo = '';
}
window.addEventListener(
  'youtube-note-metadata',
  (event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'string')
      return;
    try {
      const parsed = contextSchema.parse({
        ...JSON.parse(event.detail),
        currentMs: 0,
        playing: false,
        ad: false,
      });
      metadata = parsed;
    } catch {
      return;
    }
  },
  { signal: listeners.signal },
);
window.addEventListener(
  'message',
  (event) => {
    if (
      event.origin !== extensionOrigin ||
      !event.data ||
      typeof event.data !== 'object'
    )
      return;
    const sourceFrame = [panel, noteWindow].some(
      (host) =>
        host?.shadowRoot?.querySelector('iframe')?.contentWindow ===
        event.source,
    );
    if (!sourceFrame) return;
    if (event.data.type === 'close-note') {
      noteWindow?.remove();
      noteWindow = undefined;
    }
    if (event.data.type === 'close-panel') {
      collapsePanel();
    }
  },
  { signal: listeners.signal },
);
function handleRuntimeMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  respond: (response?: unknown) => void,
) {
  if (!session.active()) return;
  if (!message || typeof message !== 'object' || !('type' in message)) return;
  if (message.type === 'toggle') {
    window.dispatchEvent(new Event('youtube-note-request-metadata'));
    showPanel();
    respond({ ok: panelOpen });
    return;
  }
  if (
    message.type === 'capture' &&
    'noteId' in message &&
    typeof message.noteId === 'string' &&
    validVideo()
  ) {
    noteWindow?.remove();
    noteWindow = frameHost(message.noteId);
    document.body.append(noteWindow);
  }
  if (
    message.type === 'seek' &&
    'videoId' in message &&
    'startMs' in message &&
    message.videoId === metadata?.videoId &&
    validVideo()
  ) {
    const video = document.querySelector('video');
    const ad = document.querySelector('#movie_player.ad-showing');
    if (video && !ad && typeof message.startMs === 'number') {
      video.currentTime = message.startMs / 1000;
      void video.play().then(
        () => respond({ ok: true }),
        () => respond({ ok: false }),
      );
      return true;
    }
  }
}
chrome.runtime.onMessage.addListener(handleRuntimeMessage);
const timer = setInterval(() => {
  if (!session.active()) return;
  if (!validVideo()) {
    if (mountedVideo) {
      reset();
      void session.send({ type: 'invalidate' });
    }
    return;
  }
  if (metadata && (mountedVideo !== metadata.videoId || !button?.isConnected)) {
    const reopen = panelOpen;
    reset();
    panelOpen = false;
    mountedVideo = metadata.videoId;
    button = document.createElement('button');
    button.textContent = '学习笔记';
    button.setAttribute('aria-expanded', 'false');
    button.style.cssText =
      'font:500 14px system-ui;background:#4658cb;color:white;border:0;border-radius:18px;padding:9px 16px;margin:8px 0;cursor:pointer';
    button.onclick = showPanel;
    (
      document.querySelector('#below') ??
      document.querySelector('ytd-watch-flexy')
    )?.prepend(button);
    if (reopen) showPanel();
  }
  const video = document.querySelector('video');
  if (!video || !metadata) return;
  const context: VideoContext = {
    ...metadata,
    currentMs: video.currentTime * 1000,
    playing: !video.paused,
    ad: !!document.querySelector('#movie_player.ad-showing'),
  };
  void session.send({ type: 'context', context });
}, 400);

window.dispatchEvent(new Event('youtube-note-request-metadata'));
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) session.stop();
  },
  {
    signal: listeners.signal,
  },
);
