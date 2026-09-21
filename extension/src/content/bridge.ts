import { activeCaptionUrl } from './caption-tracks';
// 在页面世界只读取播放器公开状态，不读取 Cookie 或执行远程代码。
interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    lengthSeconds?: string;
    isLive?: boolean;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: {
        baseUrl: string;
        languageCode: string;
        kind?: string;
      }[];
    };
  };
}
interface PlayerElement extends HTMLElement {
  getPlayerResponse?: () => PlayerResponse;
}
const previousBridge = globalThis as typeof globalThis & {
  __youtubeNoteBridgeDispose?: () => void;
};
previousBridge.__youtubeNoteBridgeDispose?.();
let last = '';
function publish() {
  const url = new URL(location.href);
  if (url.pathname !== '/watch') return;
  const id = url.searchParams.get('v');
  if (!id || !/^[-\w]{11}$/.test(id)) return;
  const player = document.querySelector<PlayerElement>('#movie_player');
  const response = player?.getPlayerResponse?.();
  const details = response?.videoDetails;
  if (details?.videoId !== id) return;
  const tracks = (
    response?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  ).map((t) => ({
    url: activeCaptionUrl(
      t.baseUrl,
      id,
      t.languageCode,
      performance.getEntriesByType('resource').map((entry) => entry.name),
    ),
    language: t.languageCode,
    automatic: t.kind === 'asr',
  }));
  const data = JSON.stringify({
    videoId: id,
    title: details.title ?? document.title,
    durationMs: Number(details.lengthSeconds ?? 0) * 1000,
    live: details.isLive === true,
    tracks,
  });
  if (last !== data) {
    last = data;
    window.dispatchEvent(
      new CustomEvent('youtube-note-metadata', { detail: data }),
    );
  }
}
const bridgeTimer = setInterval(publish, 1000);
function refreshMetadata() {
  last = '';
  publish();
}
window.addEventListener('youtube-note-request-metadata', refreshMetadata);
previousBridge.__youtubeNoteBridgeDispose = () => {
  clearInterval(bridgeTimer);
  window.removeEventListener('youtube-note-request-metadata', refreshMetadata);
};
publish();
