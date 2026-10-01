# 视频脉络内容规范（0.3.1）

2026-09-30 用户逐项确认，统一实施。本文件是新版内容规则入口；早期文档中的长应用场景、旧切片标签、知识清单和多句摘要规则属于历史版本。

## 内容结构

1. 全片总结：核心问题优先，一句为主、必要时两句。交代主要问题和回答/路径，不列章节或主线，不夸大效果。最多 200 字符为响应上限，不是写满指标。
2. 分段：按完整议题，允许问题回答、观点、案例、学习任务；保留解释、例子、条件和结论，按内容拆分/合并，不改逐字稿分段。
3. 每段：时间与标题同排、小段总结、解决的问题、应用场景、要点、切片价值。困难用陈述句；场景只列具体事情或情境，不写操作长文；不存在的栏目省略。
4. 切片价值：高=独立完整；中=需少量背景；低=高度依赖前后文。仅判断独立完整性，不按深度、稀缺或流量评级。明确依赖未口述画面而无法判断时标“需核对画面”，不因教程类型一概标记。
5. 全片切片判断：按各段等级汇总，没有整部视频的总等级；高等级默认展开，中和画面待核对折叠，具体完整理由留在片段内。
6. 关键点：替代新版“知识清单”，涵盖关键词、概念、判断及具体知识。名称、核心含义、在视频中的作用；分条直接解释。按主线顺序，合并同义条目及新增条件，不按章节凑数。
7. 前置知识：只列缺了会明显跟不上的基础，说明所需程度和用途；视频从头解释的内容不当门槛，无则“无特别前置要求”。
8. 金句：脱离前文和标题独立表达清晰认识。一句为主、最多两句连续紧密相连的原话；不拼接、不补写、不删必要条件。五类保留：反直觉洞察、点透本质、方法与原则、关键事实、案例与经验。不凑数，无则说明未发现合格内容。双语复制交互保留。
9. 有效方法：标题、适用情况、具体做法、必要条件/限制、来源。视频确实讲到可采用的动作才提取；不把口号、目标或分段要点重复抄来凑数。跨段同一做法可合并。

## 来源与呈现

关键点/方法有一个主要连续范围，放标题左边；补充仅保留新增内容，在“补充出处（数量）”中折叠并说明补充什么。重复提及不堆时间；金句保留起始时间。来源由真实字幕 ID 解析，模型不得猜时间。

切片标识采用 SVG：红色手柄朝左侧外部、刀刃朝右侧文字。沿用既定字体栈、标题 16px/600/26.72px、小标题 15px/600/22.5px，其余文字不改，见 design.md。

Markdown 导出采用加粗标签、真实列表及折叠补充出处；TXT/Word/PDF 以文本保留全部出处。面板和历史页复用同一展示组件。

## 生成、兼容与失败边界

- formatVersion=3；旧 v2/无版本可读，不自动重标等级或改写内容，主动重新整理才采用新版。
- 分批请求仅携带原文及来源，不携带翻译、笔记或个人疑问。新版结构输出字段增多，批次按约 12000 字符预算（原 24000）生成章节、关键点、方法、候选金句。
- 最后一次全片复核使用结构化章节及边界原话，检查章节完整性、跨批合并、语义去重、金句独立性和简短总结；单批也复核。复核只返回筛选、分组和必要字段修订，程序保留其他已核验正文，避免整份重复输出触发超时；不是只把压缩摘要再压缩。
- 全片复核材料上限 160000 字符，超出明确失败，保留原结果。短视频增加一次全片计划复核；超过 24 个候选主题或复核材料超过 60000 字符时，拆成章节/总结与提炼条目两次复核；有候选金句时再增加一次不带视频上下文的独立性筛选，沿用当前配置；不自动重试可能已计费的请求。
- 主题必须按编号顺序连续覆盖输入，无遗漏/重叠；新增结构必须完整；来源校验失败按严重程度拒绝保存或省略无效摘录并提示。金句还核验连续原文及最多两句。
- 全片复核成功后才保存，逐字稿来源版本和视频导航代次仍需一致；失败保留旧结果，不修改笔记。既有 IndexedDB 不清空、不重写历史迁移。
- 模型内容质量仍需真实案例和用户验收，语义独立性不能仅靠结构校验保证。仅依据逐字稿，不声称检查了视频画面。

## 验证与维护入口

生成规范唯一代码来源：service/src/providers/analysis-prompt.ts。结构：shared/src/analysis-schema.ts；模型输入校验：analysis-output.ts；来源/完整性校验：analysis.ts、analysis-validation.ts；全片复核：analysis-review.ts、analysis-review-request.ts、analysis-review-plan.ts；金句无上下文复核：quote-review.ts。

展示：ContentViews.tsx、AnalysisDetails.tsx、AnalysisFields.tsx；来源范围：analysis-format.ts；新版导出：extension/src/export/analysis.ts。验证结果追加至 test-feedback.md。

analysis.ts 的 resolveAnalysis、AnalysisDetails、ContentViews 为同一输入/渲染流程，函数较长但已把规范、校验、来源和字段组件拆出，保留线性解析与展示以减少跨文件跳转。未顺带重构其他功能。

## 本次文件职责

| 文件 | 修改用途 |
| --- | --- |
| shared/src/analysis-schema.ts | 新旧脉络数据结构、结构化方法、来源范围和新等级 |
| shared/src/index.ts | 引用拆出的脉络结构，维持原有公共导出 |
| shared/src/analysis-batches.ts | 新版分批材料保留完整来源，交给全片语义复核 |
| service/src/providers/analysis-prompt.ts | 统一已确认的提取规则与示例 |
| service/src/providers/analysis-output.ts | 模型输出字段校验及脱敏错误名称 |
| service/src/providers/analysis.ts | 原文引用、字段解析、真实时间及新版结果解析 |
| service/src/providers/analysis-validation.ts | 章节完整性、句数与连续来源合并 |
| service/src/providers/analysis-review.ts | 全片结构化材料及复核编排 |
| service/src/providers/analysis-review-request.ts | 按长片材料量拆分复核请求，控制单次负载 |
| service/src/providers/analysis-review-plan.ts | 精简筛选/合并/修订计划，避免重复全文输出 |
| service/src/providers/quote-review.ts | 无视频上下文的独立金句筛选 |
| service/src/host.ts | 新增全片复核任务，沿用当前分析模型与凭据路径 |
| extension/src/ui/videoActions.ts | 分批后复核，成功才保存；保持导航与来源版本保护 |
| extension/src/ui/ContentViews.tsx | 新版段落要点、空栏目、切片等级与旧版提示 |
| extension/src/ui/AnalysisDetails.tsx | 关键点、结构化方法及主要/补充来源 |
| extension/src/ui/AnalysisFields.tsx | 共用列表、剪刀图标、切片汇总和来源标题 |
| extension/src/ui/analysis-format.ts | 共享主要/补充时间范围，供界面和导出使用 |
| extension/src/ui/style.css | 剪刀与切片汇总的最小样式增量 |
| extension/src/export/analysis.ts | 新版 Markdown/TXT/Word/PDF 文本内容 |
| extension/src/export/document.ts | 按格式版本路由，旧版导出保留 |
| tests/unit/analysis-v3.test.ts | 新结构、引用、复核、界面与导出回归 |
| tests/unit/quote-review.test.ts | 无上下文金句筛选与失败边界 |
| tests/unit/video-actions.test.ts | 更新流程预期，复核失败/切换/来源修改保护 |
| tests/browser/analysis.html、analysis.tsx | 无个人数据的真实组件布局与折叠验证入口 |
| 根及三个工作区 package.json、extension/manifest.json | 版本统一 0.3.1，不新增依赖或权限 |
| README.md、AGENTS.md、DOC/PLAN.md | 当前状态与新规范入口 |
| DOC/design.md、technical-design.md、implementation.md | 设计增量、协议与实现记录 |
| DOC/changelog.md、test-plan.md、test-feedback.md | 版本、回归要求与实际验证证据 |

生成材料、用户案例内容和截图只放已忽略的 artifacts/analysis-v3，不进入提交。
