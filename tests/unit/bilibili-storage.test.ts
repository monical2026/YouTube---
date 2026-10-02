import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { load, save, deleteHistory } from '../../extension/src/storage/database';
import { segmentSchema } from '../../shared/src';
it('B 站不同分 P 与旧 YouTube 记录隔离，语言重读保留，删除一 P 不影响其余记录', async () => {
  const ids = ['abcdefghijk','bilibili-BV1qW411N7FU-40809259-p1','bilibili-BV1qW411N7FU-40809285-p2'];
  for (const id of ids) {
    const record=await load(id);
    await save({...record,title:id,segments:[segmentSchema.parse({id:'s',startMs:0,endMs:1000,original:id,sourceLanguage:id.startsWith('bilibili')?'zh':'en'})]},record.revision);
  }
  for(const id of ids) expect((await load(id)).segments[0].original).toBe(id);
  expect((await load(ids[2])).segments[0].sourceLanguage).toBe('zh');
  const old=await load(ids[1]);
  await deleteHistory(ids[1]);
  await expect(save(old,old.revision)).rejects.toThrow();
  expect((await load(ids[2])).segments).toHaveLength(1);
  expect((await load(ids[0])).segments).toHaveLength(1);
});
