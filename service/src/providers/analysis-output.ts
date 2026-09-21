import { z } from 'zod';
import { analysisSchema } from '@youtube-note/shared';
const reference = z.coerce.string();
const outputSchema = z.object({
  summary: z.string(),
  topics: z.array(
    z.object({
      title: z.string(),
      startId: reference,
      endId: reference,
      introduction: z.string(),
      problem: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
      application: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
      clipReason: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
      clipVerdict: z
        .enum(['建议切片', '有条件建议', '不建议单独切片'])
        .optional(),
      applicationOrigin: z.enum(['讲者明确', 'AI 延伸']).optional(),
    }),
  ),
  knowledge: z
    .array(
      z.object({
        title: z.string(),
        understanding: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
        role: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
        segmentIds: z.array(reference).min(1),
      }),
    )
    .optional(),
  prerequisites: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        origin: z.enum(['讲者明确', 'AI 延伸']),
      }),
    )
    .optional(),
  quotes: z.array(
    z.object({
      segmentId: reference,
      endSegmentId: reference.optional(),
      excerpt: z.string().min(1).optional(),
      chinese: z.string(),
      category: z.unknown().optional(),
    }),
  ),
  methods: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      segmentId: reference,
    }),
  ),
});

const labels: Record<string, string> = {
  summary: '全片总结',
  topics: '视频主题',
  knowledge: '知识清单',
  prerequisites: '前置知识',
  quotes: '金句',
  methods: '有效方法',
  title: '标题',
  startId: '起始片段',
  endId: '结束片段',
  introduction: '内容介绍',
  problem: '解决问题',
  application: '适用场景',
  clipReason: '切片理由',
  clipVerdict: '切片结论',
  applicationOrigin: '场景来源',
  understanding: '需要理解',
  role: '视频作用',
  segmentIds: '来源片段',
  segmentId: '来源片段',
  endSegmentId: '结束片段',
  excerpt: '原文摘录',
  chinese: '中文译文',
  description: '说明',
  origin: '内容来源',
};
export function parseAnalysisOutput(input: unknown) {
  const result = outputSchema.safeParse(input);
  if (!result.success) {
    // 只显示固定字段名和数组序号，不回显模型文本、未知键名或原始错误。
    const locations = result.error.issues.slice(0, 3).map((issue) =>
      issue.path
        .map((part) =>
          typeof part === 'number'
            ? `第 ${part + 1} 项`
            : (labels[String(part)] ?? '字段'),
        )
        .join('的')
        .replaceAll('的第', '第'),
    );
    throw new Error(
      `AI 梳理返回格式不完整：${locations.join('；') || '顶层结构'}。已有内容未覆盖，请重新整理。`,
    );
  }
  const parsed = result.data;
  let unclassified = 0;
  const quotes = parsed.quotes.map((quote) => {
    const category =
      analysisSchema.shape.quotes.element.shape.category.safeParse(
        typeof quote.category === 'string'
          ? quote.category.trim()
          : quote.category,
      );
    if (!category.success) unclassified += 1;
    return { ...quote, category: category.success ? category.data : undefined };
  });
  return {
    ...parsed,
    quotes,
    warnings: unclassified
      ? [
          `有 ${unclassified} 条金句分类不在约定范围内，已省略分类标签；原文和引用仍按来源校验。`,
        ]
      : [],
  };
}
