import { captureShortcut, supportedUrl } from './shortcuts';
import { createCaptionCache } from './caption-cache';
import { matchesExtensionPage } from './origin';
import { z } from 'zod';
import { requestSchema, type VideoContext } from '@youtube-note/shared';
import { load, save } from '../storage/database';
import { parseCaptions, currentSegment } from '../segmentation';
import { native } from './native-client';
const contexts = new Map<number, VideoContext>();
const ports = new Set<chrome.runtime.Port>();
const cachedCaptions = createCaptionCache(load, save);
const page = (name: string) => chrome.runtime.getURL(name);
function isUi(sender: chrome.runtime.MessageSender) {
  return matchesExtensionPage(sender.url, chrome.runtime.id, 'panel.html');
}
function isSettings(sender: chrome.runtime.MessageSender) {
  return matchesExtensionPage(sender.url, chrome.runtime.id, 'options.html');
}
function sourceTab(sender: chrome.runtime.MessageSender, explicit?: number) {
  return isUi(sender) && explicit !== undefined ? explicit : sender.tab?.id;
}
chrome.runtime.onConnect.addListener((port) => {
  if (!port.sender || !isUi(port.sender)) return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
});
function broadcast(tabId: number, context: VideoContext | null) {
  for (const p of ports) {
    if (p.sender?.tab?.id === tabId || p.name === `video:${tabId}`) {
      try {
        p.postMessage(context);
      } catch {
        ports.delete(p);
      }
    }
  }
}
function recordChanged(videoId: string, revision: number) {
  for (const port of ports) {
    try {
      port.postMessage({ type: 'recordChanged', videoId, revision });
    } catch {
      ports.delete(port);
    }
  }
}
async function captions(videoId: string, tabId: number) {
  const context = contexts.get(tabId);
  if (context?.videoId !== videoId) throw new Error('视频已切换，请重新打开');
  const cached = await load(videoId);
  if (cached.segments.length) return cached.segments;
  const tracks = [...context.tracks].sort(
    (a, b) =>
      (b.language === 'en' ? 2 : 0) -
      (a.language === 'en' ? 2 : 0) +
      (a.automatic ? 1 : 0) -
      (b.automatic ? 1 : 0),
  );
  for (const track of tracks.slice(0, 2)) {
    try {
      const url = new URL(track.url);
      if (
        url.origin !== 'https://www.youtube.com' ||
        url.pathname !== '/api/timedtext'
      )
        continue;
      url.searchParams.set('fmt', 'json3');
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        credentials: 'include',
      });
      if (!response.ok) continue;
      const data: unknown = await response.json();
      const segments = parseCaptions(data);
      if (segments.length) return segments;
    } catch {
      /* 当前轨道失败后尝试下一条；最终失败在服务入口显示。 */
    }
  }
  return native('transcript', { videoId, mode: 'native' });
}
async function capture(tabId: number) {
  const context = contexts.get(tabId);
  if (!context || context.live || context.ad)
    throw new Error('当前不能定位普通视频的正片时间');
  const record = await load(context.videoId);
  let note = record.notes.find((n) => n.draft);
  if (!note) {
    const segment = currentSegment(record.segments, context.currentMs);
    note = {
      id: crypto.randomUUID(),
      videoId: context.videoId,
      title: context.title,
      startMs: context.currentMs,
      segmentId: segment?.id ?? '',
      sourceRevision: segment?.revision ?? 0,
      original: segment?.original ?? '',
      translated: segment?.translated ?? '',
      thought: '',
      question: '',
      revision: 0,
      draft: true,
      updatedAt: Date.now(),
    };
    const saved = await save(
      { ...record, title: context.title, notes: [...record.notes, note] },
      record.revision,
    );
    recordChanged(saved.videoId, saved.revision);
  }
  await chrome.tabs.sendMessage(tabId, { type: 'capture', noteId: note.id });
}
async function handle(
  input: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  if (sender.id !== chrome.runtime.id) throw new Error('来源不被允许');
  const r = requestSchema.parse(input);
  const ui = isUi(sender),
    settings = isSettings(sender);
  const tabId = sourceTab(sender, 'tabId' in r ? r.tabId : undefined);
  if (
    r.type === 'invalidate' &&
    sender.frameId === 0 &&
    sender.url?.startsWith('https://www.youtube.com/') &&
    tabId !== undefined
  ) {
    contexts.delete(tabId);
    broadcast(tabId, null);
    return true;
  }
  if (r.type === 'context') {
    if (
      !sender.url?.startsWith('https://www.youtube.com/watch?') ||
      sender.frameId !== 0 ||
      tabId === undefined
    )
      throw new Error('视频来源无效');
    if (new URL(sender.url).searchParams.get('v') !== r.context.videoId)
      throw new Error('视频上下文不一致');
    contexts.set(tabId, r.context);
    broadcast(tabId, r.context);
    return true;
  }
  if (!ui && !settings) throw new Error('此操作仅允许插件界面调用');
  if (r.type === 'openSettings') {
    await chrome.runtime.openOptionsPage();
    return true;
  }
  if (r.type === 'getContext')
    return {
      context: tabId === undefined ? null : (contexts.get(tabId) ?? null),
      tabId,
    };
  if (r.type === 'load') return load(r.videoId);
  if (r.type === 'save') {
    const saved = await save(r.record, r.expectedRevision);
    recordChanged(saved.videoId, saved.revision);
    return saved;
  }
  if (r.type === 'seek') {
    if (tabId === undefined) throw new Error('找不到视频标签');
    const response: unknown = await chrome.tabs.sendMessage(tabId, { ...r });
    if (
      !response ||
      typeof response !== 'object' ||
      !('ok' in response) ||
      !response.ok
    )
      throw new Error('无法跳转播放，请确认视频仍在当前页面且不是广告');
    return true;
  }
  if (r.type === 'openReader') {
    await chrome.tabs.create({
      url: page(`panel.html?tab=${r.tabId}&video=${r.videoId}`),
    });
    return true;
  }
  if (r.type === 'returnVideo') {
    let target: chrome.tabs.Tab | undefined;
    if (r.tabId !== undefined) {
      try {
        target = await chrome.tabs.get(r.tabId);
      } catch {
        /* 原标签已关闭，下面重新打开。 */
      }
    }
    const url = `https://www.youtube.com/watch?v=${r.videoId}`;
    if (
      !target?.id ||
      !target.url ||
      new URL(target.url).searchParams.get('v') !== r.videoId
    ) {
      await chrome.tabs.create({ url });
    } else {
      await chrome.tabs.update(target.id, { active: true });
      if (target.windowId !== undefined)
        await chrome.windows.update(target.windowId, { focused: true });
    }
    return true;
  }
  if (r.type === 'settings') return native('settings', {});
  if (r.type === 'native') {
    if (!settings && ['saveSettings', 'probe', 'models'].includes(r.operation))
      throw new Error('只有设置页可以管理连接');
    if (['prepareGeneration', 'confirmGeneration'].includes(r.operation)) {
      const payload = z
        .object({ videoId: z.string(), durationMs: z.number() })
        .parse(r.payload);
      const ctx = tabId === undefined ? null : contexts.get(tabId);
      if (
        !ctx ||
        ctx.videoId !== payload.videoId ||
        ctx.durationMs !== payload.durationMs ||
        ctx.live
      )
        throw new Error('当前视频与生成确认不一致');
    }
    return native(r.operation, r.payload);
  }
  if (r.type === 'captions') {
    if (tabId === undefined) throw new Error('找不到视频标签');
    return cachedCaptions(r.videoId, () => captions(r.videoId, tabId));
  }
  throw new Error('不支持的操作');
}
chrome.runtime.onMessage.addListener((input: unknown, sender, respond) => {
  void handle(input, sender).then(
    (data) => respond({ data }),
    (error) =>
      respond({ error: error instanceof Error ? error.message : '请求失败' }),
  );
  return true;
});
chrome.commands.onCommand.addListener((command, tab) => {
  void captureShortcut(command, tab, capture).catch(() => {
    void chrome.action.setBadgeText({ text: '!' });
    void chrome.action.setTitle({ title: '快捷笔记未保存，请刷新视频后重试' });
  });
});
async function restoreContent(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: ['bridge.js'],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined || !supportedUrl(tab.url)) return;
  const tabId = tab.id;
  void (async () => {
    let opened = false;
    try {
      opened =
        (await chrome.tabs.sendMessage(tabId, { type: 'toggle' }))?.ok === true;
    } catch {
      /* 扩展更新后旧页面缺少有效接收端，重新挂载。 */
    }
    if (!opened) {
      await restoreContent(tabId);
      await chrome.tabs.sendMessage(tabId, { type: 'toggle' });
    }
  })().catch(() =>
    chrome.action.setTitle({ tabId, title: '视频尚未准备好，请稍后再次打开' }),
  );
});
chrome.runtime.onInstalled.addListener(() => {
  void chrome.tabs
    .query({ url: 'https://www.youtube.com/watch*' })
    .then(async (tabs) => {
      for (const tab of tabs)
        if (tab.id !== undefined && supportedUrl(tab.url))
          await restoreContent(tab.id);
    })
    .catch(() =>
      chrome.action.setTitle({ title: '点击图标恢复当前 YouTube 视频入口' }),
    );
});
chrome.tabs.onRemoved.addListener((id) => contexts.delete(id));
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    contexts.delete(details.tabId);
    broadcast(details.tabId, null);
  }
});
