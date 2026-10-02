import { bilibiliMetadata } from '../platforms/bilibili';
const scope = globalThis as typeof globalThis & {
  __INITIAL_STATE__?: unknown;
  __youtubeNoteBridgeDispose?: () => void;
};
scope.__youtubeNoteBridgeDispose?.();
let last = '';
function publish() {
  const video = document.querySelector('video');
  const metadata = bilibiliMetadata(
    scope.__INITIAL_STATE__,
    location.href,
    video?.duration ?? 0,
  );
  const data = JSON.stringify(metadata);
  if (data !== last) {
    last = data;
    window.dispatchEvent(
      new CustomEvent('youtube-note-metadata', { detail: data }),
    );
  }
}
function refresh() {
  last = '';
  publish();
}
const timer = setInterval(publish, 400);
window.addEventListener('youtube-note-request-metadata', refresh);
scope.__youtubeNoteBridgeDispose = () => {
  clearInterval(timer);
  window.removeEventListener('youtube-note-request-metadata', refresh);
};
publish();
