import { z } from 'zod';
export const analysisSourceSchema = z.object({
  segmentId: z.string(),
  endSegmentId: z.string(),
  label: z.string(),
});
export const analysisSchema = z.object({
  formatVersion: z.union([z.literal(2), z.literal(3)]).optional(),
  clipOverview: z.string().optional(),
  knowledge: z
    .array(
      z.object({
        title: z.string(),
        understanding: z.union([z.string(), z.array(z.string().min(1))]),
        role: z.union([z.string(), z.array(z.string().min(1))]),
        segmentIds: z.array(z.string()).min(1),
        sources: z.array(analysisSourceSchema).min(1).optional(),
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
  warnings: z.array(z.string()).optional(),
  summary: z.string(),
  topics: z.array(
    z.object({
      title: z.string(),
      startSegmentId: z.string().optional(),
      endSegmentId: z.string().optional(),
      keyPoints: z.array(z.string().min(1)).optional(),
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
      introduction: z.string(),
      problem: z.union([z.string(), z.array(z.string().min(1))]),
      application: z.union([z.string(), z.array(z.string().min(1))]),
      clipReason: z.union([z.string(), z.array(z.string().min(1))]),
      clipVerdict: z
        .enum([
          '建议切片',
          '有条件建议',
          '不建议单独切片',
          '高',
          '中',
          '低',
          '需核对画面',
        ])
        .optional(),
      applicationOrigin: z.enum(['讲者明确', 'AI 延伸']).optional(),
    }),
  ),
  quotes: z.array(
    z.object({
      segmentId: z.string(),
      original: z.string(),
      chinese: z.string(),
      endSegmentId: z.string().optional(),
      category: z
        .enum([
          '反直觉洞察',
          '点透本质',
          '方法与原则',
          '关键事实',
          '案例与经验',
          '惊人事实',
          '轶事',
        ])
        .transform((value) =>
          value === '惊人事实'
            ? ('关键事实' as const)
            : value === '轶事'
              ? ('案例与经验' as const)
              : value,
        )
        .optional(),
    }),
  ),
  methods: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      segmentId: z.string(),
      applicability: z.string().optional(),
      steps: z.array(z.string().min(1)).optional(),
      limitations: z.array(z.string().min(1)).optional(),
      sources: z.array(analysisSourceSchema).min(1).optional(),
    }),
  ),
});
export type Analysis = z.infer<typeof analysisSchema>;
