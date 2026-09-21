import { z } from 'zod';

export const modeSchema = z.enum(['original', 'chinese', 'bilingual']);
export type Mode = z.infer<typeof modeSchema>;
export const segmentSchema = z.object({
  sourceCueIds: z.array(z.string()).optional(),
  sourceSpans: z
    .array(
      z
        .object({
          cueId: z.string(),
          startChar: z.number().int().nonnegative(),
          endChar: z.number().int().nonnegative(),
          text: z.string(),
          startMs: z.number().nonnegative(),
          endMs: z.number().nonnegative(),
        })
        .refine(
          (s) =>
            s.endChar - s.startChar === s.text.length && s.endMs >= s.startMs,
          '来源范围无效',
        ),
    )
    .optional(),
  segmentationWarning: z.enum(['inferred', 'unresolved']).optional(),
  segmentationVersion: z.number().int().positive().optional(),
  speaker: z.string().optional(),
  id: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  original: z.string(),
  translated: z.string().default(''),
  revision: z.number().int().default(0),
  manual: z.boolean().default(false),
  engine: z.string().default(''),
});
export type Segment = z.infer<typeof segmentSchema>;
export const contextSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/),
  title: z.string().max(1000),
  durationMs: z.number().nonnegative(),
  currentMs: z.number().nonnegative(),
  live: z.boolean(),
  ad: z.boolean(),
  playing: z.boolean(),
  tracks: z
    .array(
      z.object({
        url: z.string().url(),
        language: z.string(),
        automatic: z.boolean(),
      }),
    )
    .max(100),
});
export type VideoContext = z.infer<typeof contextSchema>;
export const noteSchema = z.object({
  sourceKind: z.enum(['transcript', 'analysis']).optional(),
  aiConversation: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
        createdAt: z.number(),
      }),
    )
    .optional(),
  selectedText: z.string().optional(),
  excerptMarkdown: z.string().optional(),
  excerptFontSize: z.number().min(8).max(32).optional(),
  excerptEdited: z.boolean().optional(),
  excerptTitle: z.string().optional(),
  sourceSegmentIds: z.array(z.string()).optional(),
  selectionLanguage: z.enum(['original', 'translated', 'mixed']).optional(),
  id: z.string(),
  videoId: z.string(),
  title: z.string(),
  startMs: z.number(),
  segmentId: z.string(),
  sourceRevision: z.number(),
  original: z.string(),
  translated: z.string(),
  thought: z.string(),
  question: z.string(),
  revision: z.number().int(),
  draft: z.boolean(),
  updatedAt: z.number(),
});
export type Note = z.infer<typeof noteSchema>;
export const analysisSchema = z.object({
  formatVersion: z.literal(2).optional(),
  clipOverview: z.string().optional(),
  knowledge: z
    .array(
      z.object({
        title: z.string(),
        understanding: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
        role: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
        segmentIds: z.array(z.string()).min(1),
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
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
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
    }),
  ),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const recordSchema = z.object({
  transcriptBackup: z
    .object({
      segments: z.array(segmentSchema),
      savedAt: z.number().nonnegative(),
    })
    .optional(),
  videoId: z.string(),
  title: z.string(),
  revision: z.number().int(),
  segments: z.array(segmentSchema),
  notes: z.array(noteSchema),
  analysis: analysisSchema.nullable(),
  analysisSource: z.string().default(''),
});
export type VideoRecord = z.infer<typeof recordSchema>;
export const profileSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
    name: z.string().min(1).max(100),
    kind: z.enum(['llm', 'supadata']),
    connection: z.enum(['api', 'codex']).optional(),
    baseUrl: z.string(),
    model: z.string().max(200),
    configured: z.boolean().default(false),
    credentialAccount: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,100}$/)
      .optional(),
  })
  .refine(
    (p) =>
      p.connection === 'codex'
        ? p.kind === 'llm' && p.baseUrl === ''
        : z.url().safeParse(p.baseUrl).success,
    { message: 'API 地址或本机 Codex 配置不正确' },
  );
export type Profile = z.infer<typeof profileSchema>;
export const settingsSchema = z.object({
  revision: z.number().int(),
  profiles: z.array(profileSchema).max(20),
  translateProfile: z.string(),
  analyzeProfile: z.string(),
  subtitleProfile: z.string(),
  generationCreditsPerMinute: z.number().positive().nullable(),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  revision: 0,
  profiles: [],
  translateProfile: '',
  analyzeProfile: '',
  subtitleProfile: '',
  generationCreditsPerMinute: null,
};
export const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('context'), context: contextSchema }),
  z.object({ type: z.literal('getContext'), tabId: z.number().optional() }),
  z.object({ type: z.literal('load'), videoId: z.string() }),
  z.object({
    type: z.literal('save'),
    record: recordSchema,
    expectedRevision: z.number(),
  }),
  z.object({
    type: z.literal('captions'),
    videoId: z.string(),
    tabId: z.number().optional(),
  }),
  z.object({
    type: z.literal('seek'),
    tabId: z.number().optional(),
    videoId: z.string(),
    startMs: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal('returnVideo'),
    tabId: z.number().optional(),
    videoId: z.string().regex(/^[\w-]{11}$/),
  }),
  z.object({ type: z.literal('settings') }),
  z.object({ type: z.literal('openSettings') }),
  z.object({ type: z.literal('invalidate') }),
  z.object({
    type: z.literal('openReader'),
    tabId: z.number(),
    videoId: z.string(),
  }),
  z.object({
    type: z.literal('native'),
    operation: z.string(),
    tabId: z.number().optional(),
    payload: z.unknown(),
  }),
]);
export const nativeRequestSchema = z.object({
  id: z.string(),
  operation: z.enum([
    'status',
    'settings',
    'saveSettings',
    'probe',
    'models',
    'generate',
    'transcript',
    'job',
    'confirmGeneration',
    'prepareGeneration',
  ]),
  payload: z.unknown(),
});
export function timestamp(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function sourceVersion(segments: Segment[]): string {
  return segments.map((s) => `${s.id}:${s.revision}`).join('|');
}

// 官方参考值核对于 2026-09-11；仅用于生成字幕，已有字幕另计。
export const SUPADATA_GENERATION_RATE = 2;

export function validateCodexConnections(profiles: Profile[]): void {
  const connections = profiles.filter(
    (profile) => profile.connection === 'codex',
  );
  if (connections.length > 1)
    throw new Error('本机 Codex 连接已存在，请移除重复连接后保存');
  if (connections.some((profile) => !profile.model.trim()))
    throw new Error('请填写具体的 Codex 模型名称，例如 gpt-5.5');
}

export {
  analysisInput,
  analysisBatches,
  mergeAnalyses,
} from './analysis-batches';

export { questionRequestSchema, type QuestionRequest } from './questions';
