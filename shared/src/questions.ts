import { z } from 'zod';
export const questionRequestSchema = z
  .object({
    task: z.literal('ask'),
    videoId: z.string().regex(/^[\w-]{11}$/),
    question: z.string().trim().min(1).max(4000),
    excerpt: z.string().max(12000),
    answerInstructions: z.string().trim().max(2000).optional(),
    excerptEdited: z.boolean().optional(),
    excerptTitle: z.string().max(1000).optional(),
    sourceKind: z.enum(['transcript', 'analysis']).optional(),
    sources: z
      .array(
        z.object({
          id: z.string(),
          startMs: z.number().nonnegative(),
          original: z.string().max(20000),
        }),
      )
      .min(1)
      .max(80),
    history: z
      .array(
        z.object({
          question: z.string().max(4000),
          answer: z.string().max(20000),
        }),
      )
      .max(4),
  })
  .refine(
    (p) => JSON.stringify(p).length <= 50000,
    '问答上下文过长，请缩小选区',
  );
export type QuestionRequest = z.infer<typeof questionRequestSchema>;
