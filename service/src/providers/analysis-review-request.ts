import { analysisRules } from './analysis-prompt';
import { planSchema, reviewPlanInstructions } from './analysis-review-plan';
import type { reviewMaterial } from './analysis-review';
type Material = ReturnType<typeof reviewMaterial>;
const chapterPlan = planSchema.pick({ summary: true, topics: true });
const detailPlan = planSchema.pick({
  knowledge: true,
  methods: true,
  prerequisites: true,
  quotes: true,
});
const reviewGoal =
  '这是最后一次全片复核，不是重新分析局部。综合结构化内容写核心问题总结；修正批次边界割裂，完整覆盖来源；合并同义关键点、方法、前置知识，保留不同条件。严格筛选独立金句，只能保留或截取候选的连续原话。';
async function request(
  data: unknown,
  generate: (prompt: string) => Promise<string>,
  focus = '',
) {
  const text = await generate(
    `${analysisRules}\n${reviewGoal}\n${reviewPlanInstructions}\n${focus}\n全片材料：${JSON.stringify(data)}`,
  );
  try {
    return JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, ''),
    ) as unknown;
  } catch {
    throw new Error('全片复核未返回有效 JSON，已有结果未覆盖');
  }
}
export async function requestReviewPlan(
  material: Material,
  generate: (prompt: string) => Promise<string>,
): Promise<unknown> {
  if (JSON.stringify(material).length > 160000)
    throw new Error('全片复核材料超出本版处理范围，已有结果未覆盖');
  if (material.topics.length <= 24 && JSON.stringify(material).length <= 60000)
    return request(material, generate);
  // 长片按职责拆分，避免一个请求同时改写章节及大量提炼条目。任一步失败不保存。
  const chapters = chapterPlan.safeParse(
    await request(
      {
        ...material,
        knowledge: [],
        methods: [],
        quotes: [],
        prerequisites: [],
      },
      generate,
      '本轮只复核章节与总结，不处理其他栏目。只输出 {"summary":"简短总结","topics":[章节修订计划]}，不要输出其他字段。',
    ),
  );
  if (!chapters.success)
    throw new Error('全片章节复核计划格式不完整，已有结果未覆盖');
  const details = detailPlan.safeParse(
    await request(
      {
        ...material,
        summary: chapters.data.summary,
        topics: material.topics.map((t) => ({
          title: t.title,
          introduction: t.introduction,
          keyPoints: t.keyPoints,
        })),
        allowedBoundaryIds: [],
        boundaryEvidence: [],
      },
      generate,
      '本轮只复核关键点、方法、前置知识、金句。章节仅供理解主线，不得输出或修改章节。只输出 {"knowledge":[分组修订计划],"methods":[分组修订计划],"prerequisites":[保留序号],"quotes":[保留或截取计划]} 四个字段。序号仍对应本轮材料各自原数组。',
    ),
  );
  if (!details.success)
    throw new Error('全片提炼条目复核计划格式不完整，已有结果未覆盖');
  return { ...chapters.data, ...details.data };
}
