import React from 'react';
import { createRoot } from 'react-dom/client';
import { recordSchema } from '../../shared/src';
import { ContentViews } from '../../extension/src/ui/ContentViews';
import '../../extension/src/ui/style.css';
const sources = [
  { segmentId: 's1', endSegmentId: 's2', label: '主要讲解' },
  { segmentId: 's4', endSegmentId: 's4', label: '如何确定第一步' },
];
const record = recordSchema.parse({
  videoId: 'fixture0001',
  title: '隔离验证 · 示例数据',
  revision: 0,
  segments: Array.from({ length: 4 }, (_, i) => ({
    id: `s${i + 1}`,
    startMs: i * 60000,
    endMs: (i + 1) * 60000,
    original: [
      'Define the deliverable.',
      'Break it into concrete actions.',
      'Keep the result checkable.',
      'Choose the first step.',
    ][i],
  })),
  notes: [],
  analysis: {
    formatVersion: 3,
    summary:
      '介绍如何把模糊的大目标拆成可以立即执行的小步骤，帮助克服复杂任务无从开始的困难。',
    topics: [
      {
        title: '把大任务拆成可以开始的小步骤',
        startMs: 0,
        endMs: 120000,
        introduction:
          '说明如何明确最终交付物，再拆解具体动作，并通过示例找到第一步。',
        problem: ['面对复杂任务，不知道从哪里开始，因而迟迟无法行动。'],
        application: ['写长文章。', '启动新项目。', '安排持续数周的学习任务。'],
        keyPoints: ['明确交付物。', '拆出具体动作。', '找到第一步。'],
        clipVerdict: '高',
        clipReason: ['问题、做法与示例完整，不需要前后文即可理解。'],
      },
      {
        title: '补充任务的检查条件',
        startMs: 120000,
        endMs: 240000,
        introduction: '说明如何检查拆解后的动作。',
        problem: [],
        application: [],
        keyPoints: ['保留明确的检查标准。'],
        clipVerdict: '中',
        clipReason: ['需要补充前段对交付物的说明。'],
      },
    ],
    knowledge: [
      {
        title: '从目标到动作',
        understanding: ['目标描述结果，动作说明具体要做什么。'],
        role: ['串起任务拆解和选择第一步。'],
        segmentIds: ['s1', 's2', 's4'],
        sources,
      },
    ],
    prerequisites: [],
    quotes: [
      {
        segmentId: 's1',
        endSegmentId: 's1',
        original: 'Define the deliverable.',
        chinese: '明确交付物。',
        category: '方法与原则',
      },
    ],
    methods: [
      {
        title: '把模糊目标拆成可执行动作',
        description: '任务拆解',
        segmentId: 's1',
        applicability: '目标较大、描述模糊，不知道从哪里开始时。',
        steps: [
          '写清最终交付物及完成标准。',
          '拆成具体动作。',
          '找到当前可以开始的一步。',
        ],
        limitations: [],
        sources,
      },
    ],
  },
});
const noop = async () => {};
const root = createRoot(document.getElementById('root')!);
function render() {
  root.render(
    <main style={{ maxWidth: 680, margin: '0 auto', padding: 20 }}>
      <p className="notice">隔离界面验证，示例数据；不连接模型或个人存储。</p>
      <ContentViews
        tab="analysis"
        record={record}
        context={null}
        busy=""
        mode="bilingual"
        getCaptions={noop}
        seek={async (s) => {
          document.title = `跳转 ${s.startMs}ms`;
        }}
        setEditing={() => {}}
        newNote={noop}
        setEdit={() => {}}
        onAskNote={() => {}}
        deleteNote={noop}
      />
    </main>,
  );
}
render();
