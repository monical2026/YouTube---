import { historyEntry, type HistoryEntry } from '../history/records';
import { recordSchema, type VideoRecord } from '@youtube-note/shared';
let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  return (database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('youtube-note', 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore('videos', { keyPath: 'videoId' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      database = undefined;
      reject(new Error('无法打开笔记数据库'));
    };
  }));
}
export async function load(videoId: string): Promise<VideoRecord> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos');
    const r = tx.objectStore('videos').get(videoId);
    r.onsuccess = () => {
      try {
        resolve(
          r.result
            ? recordSchema.parse(r.result)
            : {
                videoId,
                title: '',
                revision: 0,
                segments: [],
                notes: [],
                analysis: null,
                analysisSource: '',
              },
        );
      } catch {
        reject(new Error('本地记录格式异常，原数据未修改'));
      }
    };
    r.onerror = () => reject(new Error('读取笔记失败'));
  });
}
export async function save(
  record: VideoRecord,
  expected: number,
): Promise<VideoRecord> {
  const db = await open();
  const next = { ...record, revision: expected + 1, updatedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    let conflict = false;
    const get = store.get(record.videoId);
    get.onsuccess = () => {
      const parsed = recordSchema.safeParse(get.result);
      if (get.result && !parsed.success) {
        tx.abort();
        return;
      }
      const current = get.result ? recordSchema.parse(get.result).revision : 0;
      if (current !== expected) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(next);
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? '记录已在另一窗口更新。请保留输入并重新加载后核对。'
            : '保存失败，输入仍保留在当前窗口',
        ),
      );
    tx.onerror = () => reject(new Error('数据库写入失败'));
  });
}

// 逐条读取，返回轻量目录；逐字稿与模型回答不进入搜索索引。
export async function listHistory(): Promise<{
  entries: HistoryEntry[];
  invalidCount: number;
}> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos');
    const request = tx.objectStore('videos').openCursor();
    const entries: HistoryEntry[] = [];
    let invalidCount = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const parsed = recordSchema.safeParse(cursor.value);
      if (parsed.success) entries.push(historyEntry(parsed.data));
      else invalidCount++;
      cursor.continue();
    };
    tx.oncomplete = () => resolve({ entries, invalidCount });
    tx.onerror = () => reject(new Error('读取历史记录失败，请重试'));
    tx.onabort = () => reject(new Error('读取历史记录已中断，请重试'));
  });
}
