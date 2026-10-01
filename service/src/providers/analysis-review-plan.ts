import { z } from 'zod';
import type { reviewMaterial } from './analysis-review';
type Material = ReturnType<typeof reviewMaterial>;
const strings = z.array(z.string().min(1));
const group = {
  indexes: z.array(z.number().int().nonnegative()).min(1),
  title: z.string().optional(),
};
export const planSchema = z.object({
  summary: z.string().min(1).max(200),
  topics: z
    .array(
      z.object({
        startId: z.coerce.string(),
        endId: z.coerce.string(),
        title: z.string().optional(),
        introduction: z.string().optional(),
        problem: strings.optional(),
        application: strings.optional(),
        keyPoints: strings.optional(),
        clipVerdict: z.enum(['高', '中', '低', '需核对画面']).optional(),
        clipReason: strings.optional(),
      }),
    )
    .min(1),
  knowledge: z.array(
    z.object({
      ...group,
      understanding: strings.optional(),
      role: strings.optional(),
    }),
  ),
  methods: z.array(
    z.object({
      ...group,
      applicability: z.string().optional(),
      steps: strings.optional(),
      limitations: strings.optional(),
    }),
  ),
  prerequisites: z.array(z.number().int().nonnegative()),
  quotes: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      excerpt: z.string().min(1).optional(),
      chinese: z.string().min(1).optional(),
    }),
  ),
});
export const reviewPlanInstructions = `本次只返回精简的复核计划，不输出上文完整脉络 JSON，未改文字由程序保留，禁止重复抄写整份材料。
章节先检查是否只是同一完整解释的中间阶段。比如变化率、时间系数、圆周运动若共同回答同一个公式为何成立，就合为完整议题，不把每一步都保留成独立章节。此例不是当前材料的事实。
所有 index/indexes 必须直接引用输入条目上显式标注的 index 字段，不要自行计数或猜数组序号，更不要与字幕 segmentId 混用。每个原条目最多进入一个组；可删除不符合要求的关键点、方法、金句、前置知识，但主题必须完整连续覆盖 1 到 segmentCount。
summary 必须重新写出简短全片总结。
topics：每项只写 startId/endId；需要改的字段才附上。合并或拆分造成范围变化时必须同时写新 title、introduction、keyPoints、clipVerdict、clipReason，并按需更新 problem/application。startId/endId 必须从 allowedBoundaryIds 列表中选择，不能取未列出的中间编号。合并应使用所合并章节的真实首末编号，不猜未知位置。
knowledge：保留条目写 {indexes:[序号]}；语义同义合并时 indexes 列全部原序号，必须写整合后的 understanding/role，标题按需改；来源自动合并，顺序首项为主要讲解来源。不要丢不同条件。优先保留能串起全片主要问题与解法的关键点；同一核心概念的下位细节并入核心含义，不把所有推导小点都升格成全片关键点。
methods：保留写 {indexes:[序号]}；合并时必须写整合后的 applicability/steps/limitations，保留必要条件，来源自动合并。去掉没有具体用法或只是重复要点的项目。
prerequisites：只列保留条目的序号，去除非必要门槛及重复基础。
quotes：只列合格候选的 {index:序号}；如候选开头指代不明，可截取同一原话内独立成立的连续子串，同时写 excerpt 和忠实 chinese。只选一句或两句，宁缺毋滥。“In both cases...”“depending on what you're trying to answer about it...”在没有具体对象时不能独立表达，应删除或取其中完整独立的原句。不要只因句子完整就认作金句。
输出示例结构（序号不是建议选择）：{"summary":"全片总结","topics":[{"startId":"1","endId":"5"}],"knowledge":[{"indexes":[0]}],"methods":[{"indexes":[0]}],"prerequisites":[],"quotes":[{"index":0}]}`;
function select<T>(items: T[], indexes: number[], seen: Set<number>) {
  return indexes.map((index) => {
    if (!items[index] || seen.has(index))
      throw new Error('全片复核返回重复或无效条目，已有结果未覆盖');
    seen.add(index);
    return items[index];
  });
}
export function applyReviewPlan(input: unknown, data: Material) {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    throw new Error('全片复核计划格式不完整，已有结果未覆盖');
  const plan = parsed.data;
  const seenKnowledge = new Set<number>(),
    seenMethods = new Set<number>();
  return {
    formatVersion: 3,
    summary: plan.summary,
    topics: plan.topics.map((patch) => {
      const base = data.topics.find(
        (t) =>
          Number(t.startId) <= Number(patch.startId) &&
          Number(t.endId) >= Number(patch.startId),
      );
      if (!base) throw new Error('全片复核主题没有有效来源，已有结果未覆盖');
      if (patch.startId !== base.startId || patch.endId !== base.endId) {
        const boundaries = new Set([
          ...data.boundaryEvidence.map((s) => s.id),
          ...data.topics.flatMap((t) => [t.startId, t.endId]),
        ]);
        if (
          !boundaries.has(patch.startId) ||
          !boundaries.has(patch.endId) ||
          !patch.title ||
          !patch.introduction ||
          !patch.keyPoints?.length ||
          !patch.clipVerdict ||
          !patch.clipReason?.length
        )
          throw new Error('调整章节边界缺少完整说明，已有结果未覆盖');
      }
      return { ...base, ...patch };
    }),
    knowledge: plan.knowledge.map(({ indexes, ...patch }) => {
      const items = select(data.knowledge, indexes, seenKnowledge);
      if (
        items.length > 1 &&
        (!patch.understanding?.length || !patch.role?.length)
      )
        throw new Error('合并关键点缺少内容，已有结果未覆盖');
      return {
        ...items[0],
        ...patch,
        segmentIds: [...new Set(items.flatMap((k) => k.segmentIds))],
        sources: items.flatMap((k) =>
          k.sources.map((source) => ({
            ...source,
            label: source.label === '主要讲解' ? k.title : source.label,
          })),
        ),
      };
    }),
    methods: plan.methods.map(({ indexes, ...patch }) => {
      const items = select(data.methods, indexes, seenMethods);
      if (
        items.length > 1 &&
        (!patch.applicability || !patch.steps?.length || !patch.limitations)
      )
        throw new Error('合并方法缺少具体做法或条件，已有结果未覆盖');
      return {
        ...items[0],
        ...patch,
        sources: items.flatMap((m) =>
          m.sources.map((source) => ({
            ...source,
            label: source.label === '主要讲解' ? m.title : source.label,
          })),
        ),
      };
    }),
    prerequisites: select(data.prerequisites, plan.prerequisites, new Set()),
    quotes: plan.quotes
      .map((patch) => {
        const quote = data.quotes[patch.index];
        if (
          !quote ||
          (patch.excerpt &&
            (!quote.excerpt.includes(patch.excerpt) || !patch.chinese))
        )
          throw new Error('复核金句不在已核验原话中，已有结果未覆盖');
        return {
          ...quote,
          ...(patch.excerpt
            ? { excerpt: patch.excerpt, chinese: patch.chinese }
            : {}),
        };
      })
      .filter(
        (q, i, all) =>
          all.findIndex((item) => item.excerpt === q.excerpt) === i,
      ),
  };
}
