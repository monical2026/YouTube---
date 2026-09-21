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
      store.put({ ...record, revision: expected + 1 });
    };
    tx.oncomplete = () => resolve({ ...record, revision: expected + 1 });
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
