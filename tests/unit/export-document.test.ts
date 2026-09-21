import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { recordSchema, segmentSchema } from '../../shared/src';
import {
  exportBlocks,
  exportText,
  escapeXml,
} from '../../extension/src/export/document';
import { wordDocument } from '../../extension/src/export/word';
const record = recordSchema.parse({
  videoId: 'abcdefghijk',
  title: '中文学习 <视频>',
  revision: 0,
  segments: [
    segmentSchema.parse({
      id: 's',
      original: 'English quotation',
      translated: '中文字幕',
      startMs: 0,
      endMs: 1000,
    }),
  ],
  notes: [],
  analysis: {
    summary: '全片总览',
    topics: [
      {
        title: '主题',
        startMs: 0,
        endMs: 1000,
        introduction: '主题内容',
        problem: '问题',
        application: '场景',
        clipReason: '理由',
      },
    ],
    quotes: [],
    methods: [],
  },
});
it('只导出所选内容，并遵循逐字稿语言模式', () => {
  const text = exportText(
    exportBlocks(record, 'chinese', ['transcript']),
    false,
  );
  expect(text).toContain('中文字幕');
  expect(text).not.toContain('English quotation');
  expect(text).not.toContain('全片总览');
  const all = exportText(
    exportBlocks(record, 'bilingual', ['transcript', 'notes', 'analysis']),
    true,
  );
  expect(all).toContain('## 视频脉络');
  expect(all).toContain('全片总览');
  expect(all).toContain('English quotation');
  expect(all).toContain('暂无笔记');
});
it('TXT 没有 Markdown 标题标记，XML 特殊字符安全编码', () => {
  expect(exportText([{ heading: true, text: '标题' }], false)).toBe('标题');
  expect(escapeXml('<script>&"')).toBe('&lt;script&gt;&amp;&quot;');
});
it('Word 是可解压且 CRC 正确的 DOCX，中文及文档关系完整', () => {
  const directory = mkdtempSync(join(tmpdir(), 'youtube-note-export-'));
  try {
    const file = join(directory, 'test.docx');
    writeFileSync(
      file,
      wordDocument(
        exportBlocks(record, 'bilingual', ['transcript', 'analysis']),
      ),
    );
    expect(
      execFileSync('/usr/bin/unzip', ['-t', file], { encoding: 'utf8' }),
    ).toContain('No errors detected');
    const document = execFileSync(
      '/usr/bin/unzip',
      ['-p', file, 'word/document.xml'],
      { encoding: 'utf8' },
    );
    expect(document).toContain('中文字幕');
    expect(document).toContain('&lt;视频&gt;');
    expect(document).toContain('全片总览');
    const relations = execFileSync(
      '/usr/bin/unzip',
      ['-p', file, '_rels/.rels'],
      { encoding: 'utf8' },
    );
    expect(relations).toContain('Target="word/document.xml"');
  } finally {
    rmSync(directory, { recursive: true });
  }
});
