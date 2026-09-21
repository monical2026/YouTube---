import { describe, it, expect } from 'vitest';
import {
  parseCaptions,
  groupCues,
  currentSegment,
} from '../../extension/src/segmentation';
import { isPublicAddress, serviceUrl } from '../../service/src/security/http';
import { notesMarkdown, transcriptText } from '../../extension/src/export';
import { recordSchema, timestamp } from '../../shared/src';
describe('逐字稿分段与播放定位', () => {
  it('完整短句可以合并，不改变来源时间', () => {
    const result = groupCues([
      { id: 'a', startMs: 1000, endMs: 2000, text: 'Hello' },
      { id: 'b', startMs: 2100, endMs: 3000, text: 'world.' },
      { id: 'c', startMs: 3100, endMs: 4000, text: 'Next sentence.' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceCueIds: ['a', 'b', 'c'],
      original: 'Hello world. Next sentence.',
      startMs: 1000,
      endMs: 4000,
    });
    expect(currentSegment(result, 4001)).toBeUndefined();
    expect(currentSegment(result, 3100)?.id).toBe(result[0].id);
  });
  it('忽略空字幕但不伪造持续时间', () => {
    const result = parseCaptions({
      events: [
        { tStartMs: 0, segs: [{ utf8: '\n' }] },
        {
          tStartMs: 1200,
          dDurationMs: 500,
          segs: [{ utf8: 'Do not delete it.' }],
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].endMs).toBe(1700);
  });
  it('拒绝格式错误的数据', () =>
    expect(() => parseCaptions({ events: [{ tStartMs: 'zero' }] })).toThrow());
  it('字幕间隔不能单独切开缺标点文本', () =>
    expect(
      groupCues([
        { id: 'a', startMs: 0, endMs: 100, text: 'One' },
        { id: 'b', startMs: 4000, endMs: 4100, text: 'two' },
      ]),
    ).toHaveLength(1));
});
describe('外部服务边界', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '192.168.0.1',
    '172.16.1.2',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
  ])('拒绝私有地址 %s', (ip) => expect(isPublicAddress(ip)).toBe(false));
  it('允许公网地址', () => expect(isPublicAddress('8.8.8.8')).toBe(true));
  it.each([
    'http://example.com',
    'https://user:password@example.com',
    'https://example.com?key=x',
    'https://example.com:8080',
  ])('拒绝危险服务地址 %s', (url) =>
    expect(() => serviceUrl(url, 'models')).toThrow(),
  );
  it('保留兼容接口路径', () =>
    expect(serviceUrl('https://example.com/v1/', 'models').href).toBe(
      'https://example.com/v1/models',
    ));
});
describe('导出', () => {
  const record = recordSchema.parse({
    videoId: 'abcdefghijk',
    title: '测试',
    revision: 0,
    segments: [
      {
        id: 'a',
        startMs: 0,
        endMs: 1000,
        original: 'Do not delete.',
        translated: '不要删除。',
      },
    ],
    notes: [
      {
        id: 'n',
        videoId: 'abcdefghijk',
        title: '测试',
        startMs: 1200,
        segmentId: 'a',
        sourceRevision: 0,
        original: 'Do not delete.',
        translated: '不要删除。',
        thought: '先备份',
        question: '如何恢复？',
        revision: 0,
        draft: true,
        updatedAt: 0,
      },
    ],
    analysis: null,
  });
  it('中文模式不导出英文', () => {
    expect(transcriptText(record, 'chinese')).toContain('不要删除。');
    expect(transcriptText(record, 'chinese')).not.toContain('Do not');
  });
  it('笔记保留想法、疑问、草稿和回跳链接', () => {
    const output = notesMarkdown(record);
    expect(output).toContain('先备份');
    expect(output).toContain('如何恢复？');
    expect(output).toContain('&t=1');
    expect(output).toContain('草稿');
  });
  it('支持一小时以上时间', () => expect(timestamp(3661000)).toBe('1:01:01'));
});
