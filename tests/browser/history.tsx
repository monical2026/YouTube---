import React from 'react';
import { createRoot } from 'react-dom/client';
import { recordSchema, requestSchema, type VideoRecord } from '../../shared/src';
import { historyEntry } from '../../extension/src/history/records';
import { HistoryPage } from '../../extension/src/history/HistoryPage';
import '../../extension/src/ui/style.css';
const base = recordSchema.parse({ videoId: 'fixture0001', title: '验证 A · Agent 工作流', revision: 0, segments: [
  { id: 's1', startMs: 0, endMs: 10000, original: 'Break the problem into steps.', translated: '把问题拆成可以验证的步骤。' }
], notes: [{ id: 'n1', videoId: 'fixture0001', title: '验证 A', startMs: 0, segmentId: 's1', sourceRevision: 0, original: '', translated: '', selectedText: '把问题拆成可以验证的步骤。', thought: '用小实验验证想法', question: '怎样确定验证标准？', revision: 0, draft: true, updatedAt: 1 }], analysis: null });
const records = new Map<string, VideoRecord>([[base.videoId, base], ['fixture0002', { ...base, videoId: 'fixture0002', title: '验证 B · 无逐字稿的旧记录', notes: [], segments: [] }]]);
const listeners = new Set<(message: unknown) => void>();
let failSave = false, models = 0, writes = 0;
const memory: Record<string, unknown> = {};
const status = document.createElement('div');
status.style.cssText = 'position:fixed;bottom:6px;left:8px;z-index:1000;background:#fff;color:#222;border:1px solid #ccc;padding:4px';
const toggle = document.createElement('button');
toggle.textContent = '模拟保存失败：关';
toggle.onclick = () => { failSave = !failSave; toggle.textContent = `模拟保存失败：${failSave ? '开' : '关'}`; };
const counter = document.createElement('span');
function showCounts() { counter.textContent = ` 模型调用 ${models} · 写入 ${writes}`; }
status.append(toggle, counter); document.body.append(status); showCounts();
Object.defineProperty(window, 'chrome', { configurable: true, value: {
  storage: { local: { get: async () => ({ ...memory }), set: async (data: object) => Object.assign(memory, data) } },
  runtime: {
    connect: () => {
      let listener: ((message: unknown) => void) | undefined;
      return { onMessage: { addListener: (fn: (message: unknown) => void) => { listener = fn; listeners.add(fn); } }, disconnect: () => { if (listener) listeners.delete(listener); } };
    },
    sendMessage: async (input: unknown) => {
      try {
        const r = requestSchema.parse(input);
        if (r.type === 'listHistory') return { data: { entries: [...records.values()].map(historyEntry), invalidCount: 0 } };
        if (r.type === 'load') return { data: structuredClone(records.get(r.videoId)) };
        if (r.type === 'save') {
          if (failSave) throw new Error('模拟写入失败，输入仍保留');
          if (records.get(r.record.videoId)?.revision !== r.expectedRevision) throw new Error('版本冲突');
          const saved = { ...r.record, revision: r.expectedRevision + 1, updatedAt: Date.now() };
          records.set(saved.videoId, saved); writes++; showCounts();
          listeners.forEach(fn => fn({ type: 'recordChanged', videoId: saved.videoId, revision: saved.revision }));
          return { data: structuredClone(saved) };
        }
        if (r.type === 'native') { models++; showCounts(); return { data: { answer: '通俗解释：先写清楚输入、预期结果和如何核对。\n准确概念：这是验收标准。\n模型专用检索排除词' } }; }
        throw new Error(`隔离验证不允许 ${r.type}`);
      } catch (e) { return { error: e instanceof Error ? e.message : '验证失败' }; }
    },
  },
} });
createRoot(document.getElementById('root')!).render(<React.StrictMode><HistoryPage /></React.StrictMode>);
