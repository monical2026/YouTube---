# 当前实施状态

## 0.6.2 交互修复（2026-10-02）

extension/src/content/index.ts 的 frameHost 在插件宿主显式设置 pointer-events:auto，防止继承 B 站右栏的 none；覆盖 iframe 内容与收起横条，保留原有事件和布局。224 项单元测试及构建通过，真实网页隔离验证鼠标点击和内部滚动通过，用户随后确认基本功能与任务可完成；偶发首次整理失败仅记录，详见 test-feedback.md 的 OBS-20261002-01。

## 0.6.1 当前增量（2026-10-02）

B 站首轮接入已构建，真实页面字幕与元数据脚本验证通过，Chrome 整体交互待人工验收。shared/src/video-source.ts 统一平台键、URL 和来源校验；transcript-language.ts 统一中文原稿展示规则；extension/src/platforms 管 B 站当前分 P、字幕读取和解析，background/captions.ts 按平台分派。详细文件职责、范围及证据见 [多平台适配](multi-platform-adaptation.md)。下方首轮状态为历史记录，最新验收以 test-feedback.md 为准。

更新时间：2026-09-12。首轮开发构建，尚未完成真实 Chrome 交互、外部服务和人工验收。

## 已建立的代码入口

| 位置 | 已写入的实现 |
| --- | --- |
| extension/manifest.json | Chrome Manifest V3、YouTube 页面匹配、快捷键、独立设置页、按需本机组件权限 |
| extension/src/content/ | 播放器元数据桥接、视频下方入口、扩展来源 iframe 面板、快捷笔记弹窗、导航与广告状态 |
| extension/src/background/ | 受限消息路由、视频上下文、已有字幕请求、快捷草稿、本机组件调用 |
| extension/src/segmentation/ | 纯规则断句、向后比较和长度软目标，原文范围映射、旧稿预览及恢复，缓存区间索引定位当前片段 |
| extension/src/storage/ | 扩展后台 IndexedDB、视频隔离、修订号校验、失败保留原记录 |
| extension/src/ui/ | 三个内容入口、模式切换、跟随、高亮、跳转、编辑、划词、草稿、来源变化提示、生成确认 |
| extension/src/translation/ | Chrome 本地 Translator API 适配与下载状态；不自动回退到云端 |
| extension/src/export/ | 逐字稿 TXT/Markdown、笔记 Markdown 与视频时间链接 |
| extension/src/options/ | 独立设置页、服务配置、密钥输入、模型列表与测试、任务路由、生成计价字段 |
| service/src/ | Native Messaging、响应校验、地址限制、LLM/Supadata 适配、生成任务去重、设置文件锁 |
| service/native/keychain/ | Swift 系统钥匙串桥接，密钥通过进程管道传递，不进入命令行 |
| shared/src/ | 统一数据与消息校验结构 |
| tests/unit/ | 分段、定位、保存冲突、视频隔离、导出、地址限制与额度估算的实际业务测试 |
| scripts/build.mjs | 扩展、服务打包和 Swift 编译 |
| scripts/install-native.mjs | 本机组件复制与 Chrome 来源白名单登记，不自动填入凭据 |

## 翻译选择

| 方案 | 当前状态 |
| --- | --- |
| Chrome Translator API | 首轮产品实现使用；首次语言模型准备和面板权限在真实 Chrome 流程中核对 |
| client=gtx | 保留免费云端备选方案，未接为默认，也未自动调用；等待产品体验后的用户指令 |
| LLM | 当前段／全片主动入口，先显示候选，应用检查版本并跳过手改译文；外部调用待真实配置验证 |

停止运行 scripts/probes 中的独立翻译试验。没有足够证据比较两个免费方案的整片速度和质量。

## 工程选择与检查

- pnpm 工作区：扩展、服务、共享结构边界清楚，不为第一版增加云端账号系统。
- React 用于面板与设置的交互状态；Vite 构建 Chrome 可加载文件，不引入另一个扩展框架。
- Zod 校验网页、消息、存储与外部响应；TypeScript 负责编译期检查。
- TypeScript 从初装的 7.0.2 调整为 6.0.3，原因是当前 typescript-eslint 明确不支持 7.0；没有关闭 lint 绕过问题。
- Vitest 执行业务测试；fake-indexeddb 仅在测试环境验证并发写入，不代替 Chrome 数据持久性验收；eslint-plugin-react-hooks 检查 React 生命周期规则。
- 根控制页面与设置页面超过 300 行，已将内容视图、操作面板、笔记编辑、字幕生成和服务动作拆开。剩余根组件集中持有同一视频的界面状态；后续增加行为时继续拆分，不把网络适配放进视图。

## 已知差距与接下来的顺序

1. 已将本项目 extension/dist 加载到实际 Chrome，扩展 ID 为 fjhphfklnngjhmhmogmembgeogabjfhk，入口、面板和设置页连接本机组件已确认。已有字幕获取首次失败，已补充播放器运行时字幕地址选择；修复后重新加载及浏览器回归待完成，不能用其他已安装扩展的表现作为本项目结果。
2. 走通真实“打开视频 → 取得逐字稿 → 翻译 → 定位播放 → 摘录 → 修改 → 导出”，按测试方案处理 SPA、广告、跨标签及重启数据问题。
3. 在真实设置页面填写服务信息，再验证钥匙串首次写入、重新打开复用和模型响应；当前没有配置真实密钥，不将空钥匙串视为缺陷。
4. 已有字幕、异步生成接口、费用确认、任务恢复需实测。结果未知不自动重新生成；当前生成进度使用用户点击检查，自动退避轮询及失败后再次确认重建任务仍待完善。
5. 面板首次加载目前提供“获取已有字幕”和“本地翻译”明确入口；自动按显示模式启动及快捷摘录自动补齐译文仍待联调完成。快捷草稿优先保存原时间和个人输入。
6. 跨多段划词已保存源段编号与选中文字；多段来源差异逐段审核仍需补全验证。
7. 大量字幕列表的渲染性能、翻译任务取消与恢复、长文本分批 AI 汇总和完整模型配置版本缓存仍需完善。当前超长分析会明确拒绝，不能冒充完整摘要。
8. Native Messaging 注册工具使用本机 Node 路径；独立运行时打包、正式签名与其他电脑安装后续完成。
9. 人工验收通过后，才确认 GitHub 目标、检查暂存区并提交推送；目前未执行。

## 当前验证边界

pnpm check 的通过只表示类型、lint、格式、业务单元测试与构建通过。测试方案中的真实集成、端到端和人工验收仍分别记录，不能由单元测试替代。最新实际结果见 test-feedback.md。

## 设置页本轮补充

服务商预设、可清空输入框、独立费用卡和设置样式分别在 options/providers.ts、ClearableInput.tsx、SubtitleCosts.tsx、settings.css。费用默认值与后台预估共用 SUPADATA_GENERATION_RATE；null 改为采用官方参考值，显式自定义值保留。本机 Codex 仅核实可行性，未接入当前生成流程。

## 本机 Codex 与保存状态

保存快照比较在 options/save-state.ts，导航与模型分工已拆出独立组件。service/src/providers/codex.ts 通过官方 CLI 接入；旧配置默认保持 API 接法，本机连接不要求 URL 或 Key，可共用翻译／分析流程。检查与真实服务测试边界见测试反馈。

## 实际流程反馈修复

自动准备入口位于 ui/usePreparation.ts，加载视图位于 ui/LoadingView.tsx，LLM 应用规则位于 ui/translation-results.ts，分析分批位于 shared/src/analysis-batches.ts。后台保存广播与 ui/useVideo.ts 负责笔记跨窗口刷新。长视频现在分批分析后按时间合并；全局摘要为分批总结顺序合并。实际 Chrome 及真实服务验收仍待完成。


## 0.1.7 逐字稿分段

- extension/src/segmentation/boundaries.ts 识别句末并保护常见缩写、小数、网址与成对引语；regroup.ts 组合完整句并保留原始子串范围，resegment.ts 处理预览、版本冲突、备份与恢复。
- background/caption-cache.ts 在新字幕入库前统一处理供应商结果，YouTube 已整理结果直接复用；GenerateCaptions.tsx 处理新生成及既有任务返回的原始字幕。服务端行为不变，无需为本次规则重新登记本机组件。
- ResegmentDialog.tsx 提供旧视频的显式预览／应用／恢复；PanelControls.tsx 提供重新分段和补齐本地翻译。旧译文不会硬拼成新译文，手改段及笔记快照保留。NoteEditor.tsx 在来源标识改变时也提示差异。
- shared/src/index.ts 新增可选来源范围、分段版本、说话人和逐字稿备份字段，保持旧记录兼容；所有新的结构走现有消息与存储校验。当前供应商适配未提供可靠说话人标签，不声明已具备音频换人识别。
- main.tsx 仍超过 300 行，保留其现有界面状态编排，仅接入独立预览组件，避免连带重构笔记和导出；预览组件长于 60 行的部分主要为同一弹窗的 JSX 与键盘交互，保存逻辑和重组算法已分离。
- SaT、音频识别、自动补标点和逐段人工拆合不在此版。缺标点或无法确认边界时可能保留长段。来源时间重叠时高亮最早仍有效段，不伪造句内精度。


## 0.1.8 巨段与缺标点修复

新增 candidates.ts 生成句末、分句和会话轮次候选；sources.ts 恢复旧分段来源范围；boundaries.ts 收紧短引用保护。regroup.ts 使用算法版本 2，评分保留软长度目标并禁止跨已确认轮次合并，记录推断与偏长状态。resegment.ts 同时按原文及时间核验边界未变段落，保留标识、译文和修订。

ResegmentDialog.tsx 展示推断说明及偏长数量，ContentViews.tsx 显示仍偏长段落提示；shared/src/index.ts 增加兼容旧数据的可选状态字段，已有协议和持久化共用此校验，不新增迁移。服务端行为未变，本轮无需重新登记本机组件。未改 manifest 权限，只统一版本号。

新增核心规则回归，三份真实原稿与旧版结果放在忽略目录本地回放，详见 [修复记录](segmentation-repair-2026-09-21.md)。纯规则不保证无标点口语每一段都是完整句；仍有 4 个偏长段落需人工验收。现有 JSX 组件及 shared 汇总文件超过行数指导线的部分沿用原结构，仅增加相关提示／字段；算法分别拆为独立文件，不扩展无关业务。


## 0.1.9 快捷键入口

- extension/manifest.json 新增 `_execute_action` 默认组合，复用既有 action.onClicked 打开面板及旧页面接收端恢复流程；保留 capture-note 名称以兼容已有用户绑定。未增加权限。
- background/shortcuts.ts 抽出快捷笔记命令分发及受支持 URL 判断；index.ts 按命令名处理，不再把所有命令都当作记笔记。优先事件自带标签，缺少时才查活动标签；站外、Shorts、无效 URL 不触发笔记，直播和广告继续由原 capture 校验。
- options/ShortcutSettings.tsx 独立读取实际绑定、打开修改入口、返回刷新及错误提示；SettingsNav.tsx 增加分类，main.tsx 接入，不依赖服务连接就可使用。组件超过 60 行主要为生命周期与单一设置区 JSX，职责保持独立；原 main.tsx 未做无关拆分。
- ui/ContentViews.tsx 去掉硬编码快捷键提示，避免用户修改后提示错误；tests/unit/shortcuts.test.ts 新增 5 项分发、范围与失败回归。
- 根及三个工作区 package.json、manifest 版本同步为 0.1.9；README、PLAN、service-settings、changelog、test-feedback 同步用户反馈及实际行为。无服务端逻辑修改，无需重新登记本机组件。


## 0.1.10 AI 脉络改进

生成入口仍为 service/src/providers/analysis.ts；新增场景来源、切片结论、知识与前置知识，校验金句连续原文。shared/src/index.ts 保持字段可选以兼容旧数据；analysis-batches.ts 合并知识引用并生成全片切片初步汇总。AnalysisDetails.tsx 承担知识和金句交互，ContentViews 接入总判断与新版提示；export/document.ts 同步导出。没有增加权限、依赖或自动模型请求。真实验证结果见 test-feedback.md。


## 0.1.11 分析输出校验修复

新增 service/src/providers/analysis-output.ts 集中解析模型结构与可选金句标签；analysis.ts 保留引用还原与原文验证，并给无效 JSON 固定错误。标签异常只产生警告，核心内容字段继续严格校验。真实故障为模型产生“方法洞察”，触发原 quotes[1].category 的 invalid_value，随后 host 的统一错误掩盖具体字段。未修改供应商凭据、请求重试、存储和权限。


## 0.1.12 入口

阅读、知识笔记、问答、剪贴板与测试入口清理已实现，文件职责和实际测试见 [学习工作流记录](learning-workflow-2026-09-21.md)。新字幕始终走版本 2 分段，移除的是界面测试操作；兼容恢复代码与已有备份保留。主面板拆出选区、问答和逐字稿编辑组件。


## 0.2.0 修改文件与职责

- shared/src/index.ts：兼容旧金句标签并输出五类，笔记新增可选知识标题；shared/src/questions.ts：问答增加可选标题与来源性质，兼容旧请求。
- service/src/providers/analysis.ts：五类筛选定义；questions.ts：区分 AI 摘录和讲者原文，不把空来源内容当作已获得逐字稿。
- extension/src/ui/learning-notes.ts：划词只保存选中内容，提问不再带原始上下文；useTextSelection.tsx：取得知识卡标题。
- AnalysisDetails.tsx、ContentViews.tsx、main.tsx：知识标签加粗、移除常驻操作及不再使用的回调。
- NoteEditor.tsx：精简选区表单、取消保存草稿、四按钮同排；NoteCard.tsx 和 AskDialog.tsx：移除重复上下文及同步提示。
- extension/src/export/document.ts 和 index.ts：两种导出入口均只输出一份选区内容；style.css：模块标题、知识段落和表单排版。
- tests/unit/learning-tools.test.ts、analysis-details.test.ts：精简摘录、旧笔记保护、发送及导出边界、五类及旧标签兼容。
- 根与三个工作区 package.json、extension/manifest.json：统一 0.2.0；README、PLAN、design、technical-design、test-plan、test-feedback、changelog：记录确认规则和验证。
- 延续现有 JSX 组件和 shared 汇总结构，不作无关拆分；NoteEditor 的长函数仍仅负责单一编辑表单及交互。


## 0.2.1 修改文件与职责

- shared/src/index.ts、questions.ts、analysis-batches.ts：知识数组兼容与合并，笔记受限格式和手改标志。
- service/src/providers/analysis.ts、analysis-output.ts、questions.ts：要求知识逐条输出、兼容校验、区分手改摘录。
- ui/AnalysisDetails.tsx：知识两栏目列表；excerpt-format.ts：受限结构提取；ExcerptEditor.tsx：直接编辑与四种排版工具；AnswerText.tsx：可选标题呈现。
- ui/useTextSelection.tsx、learning-notes.ts：保存选区结构和来源字号；NoteEditor.tsx、NoteCard.tsx、AskDialog.tsx：编辑、展示和空摘录保护；export/document.ts、index.ts：结构化知识和笔记导出。
- ui/style.css：显式固定实际正文字号、长标题网格和摘录编辑样式。五处版本同步 0.2.1，文档记录字体核查纠正、实际测试与待验收范围。无新增依赖或权限。


## 0.2.2 字号与标题标识

ContentViews.tsx 与 AnalysisDetails.tsx 为五个大标题加 analysis-section-title，为片段、知识点和方法标题加 analysis-item-title；style.css 统一相应参数并用空内容伪元素显示竖条，不污染复制文字。逐字稿采用 .segment p[data-language] 同时覆盖单语和双语字号及行高。版本文件与 README、PLAN、design、changelog、test-feedback 同步。实际 Chrome 测量见测试反馈。


## 0.2.3 修改范围

NoteCard.tsx 增加图标与统一问答类，取消来源字号的内联覆盖；NoteEditor.tsx、ExcerptEditor.tsx 同步摘录显示与标签；style.css 统一卡片／编辑／回答文字层级及按钮。五处版本一致，设计样式、README、PLAN 和更新记录同步。未修改模型、存储协议、权限或依赖。


## 0.2.4 修改文件与职责

ExcerptEditor.tsx、NoteEditor.tsx 调整状态、图标、选填；AnswerText.tsx 与 answer-sections.ts 识别常见回答标题但不插入 HTML；style.css 定义视觉层级。AnswerSettings.tsx 读取和保存本机默认要求；AskDialog.tsx 等待加载并传入本次要求；answer-note.ts、shared/questions.ts、service/providers/questions.ts 同步可选协议及模型规则。新增章节解析和请求契约回归，五处版本、README 与文档同步。


## 0.2.5 笔记内层装饰精简

将 AI 提问的圆角边框、左侧强调线与内边距限定为编辑表单样式。笔记展示卡片不再显示内层框线；外层笔记卡片、编辑表单、折叠交互和文字参数保持原样。仅 style.css 选择器范围、五处版本与说明文档更新。

## 0.3.0 历史记录实现

- 新增 `extension/src/history/HistoryPage.tsx`、`records.ts`、`history.css`：独立目录、标题及个人笔记搜索、命中定位、响应式两栏。
- 新增 `extension/src/background/history.ts`：历史页打开、原视频时间跳转；后台入口新增受扩展页面来源校验保护的消息。
- `storage/database.ts` 游标生成轻量目录，保存时增加可选更新时间；`shared/src/index.ts` 同步消息与兼容字段。未改数据库版本或旧记录。
- 原 `ui/main.tsx` 的阅读组件移动为 `ui/App.tsx`，入口按查询参数选择历史页或视频面板；`useVideo.ts` 增加脱离播放器的记录模式。
- `PanelControls.tsx` 合并独立阅读入口；`ContentViews.tsx` 提供缓存空态和显式时间跳转；`NoteCard.tsx` 提供命中定位；`NoteEditor.tsx` 提供切换前保存保护。
- `App.tsx` 仍超过 300 行，保留理由：本次只抽出入口并接入历史模式，保留原有字幕任务与弹窗生命周期，避免将存储与历史功能变更同时扩大成整套面板重构；目录、搜索、跳转已分别独立。后续如继续增加面板功能，应拆出弹窗和页脚组件。
- 新增单元回归及 `tests/browser/history.html`、`history.tsx` 隔离交互夹具；不把模拟回答当作真实服务验收。
- 检查状态：157 项单元测试以及类型、lint、格式、构建通过；Chrome 真实记录阅读与搜索、非视频图标入口已实测。2026-09-23 用户确认历史记录功能已完善，授权本地提交与 GitHub 推送；样式保留后续优化。


## 0.3.1 脉络内容优化（2026-09-30）

已实现 formatVersion=3、完整议题校验、全片结构化复核、连续原文金句筛选、关键点与结构化方法、主要与补充出处、新版展示及导出。源文件分工、限制和长函数保留理由见 [内容规范](analysis-content-design.md)。旧版结果可读，失败不覆盖，真实 Chrome 最终验收由用户完成。

## 0.3.2 请求契约修复

shared 的 analysisInput 使用 original；parseAnalysisRequest 统一 analyze/reviewAnalysis 接收校验，host 与 UI 契约回归共用。真实模型测试与真实 Chrome 端到端验收分别记录，不能互相替代。

## 0.3.4 跳转高亮同步（待验收）

点击逐字稿后立即发布播放器实际时间，不等待原有 400ms 轮询或 play() 完成；捕获 seeking/seeked 再次同步，兼容视频节点替换，监听器随会话清理。保留正常播放轮询以及视频归属、广告和范围校验。

## 0.3.5 点击目标优先高亮（待验收）

修正逐字稿时间索引为左闭右开区间，交界时刻不再属于上一段。App 接入 usePlaybackHighlight：点击立即选择目标段，播放器尚未到达时忽略旧进度对高亮的影响；到达后在该段内保持用户选择（兼容来源时间重叠），离开则恢复播放跟随。失败、视频切换或 5 秒未收到到达进度时撤销临时状态；较早请求的失败不得清除新目标。历史阅读不建立播放高亮。

文件职责：segmentation/index.ts 修复索引边界；ui/playback-highlight.ts 管理目标状态转换；ui/usePlaybackHighlight.ts 管理交互状态及定时器清理；ui/App.tsx 接入点击和失败；tests/unit/playback-highlight.test.ts 覆盖边界/旧进度/重叠/乱序失败；tests/browser/playback.* 用实际组件验证显示。App 已超过 300 行，本轮将新增状态管理独立拆出，保留原有界面编排，避免无关重构。

## 0.3.6 历史侧栏视觉优化（待验收）

去除蓝色选中竖条，使用中性底色/细边区分选择；标题 14px/600/21px、最多三行，内容类型浅灰标签，笔记数量及最近学习时间分层展示。左栏仍为 280px，右侧阅读和搜索范围、排序、日期取值、存储行为不变；保留深色、窄屏和键盘焦点样式。

HistoryRecordMeta.tsx 提取只读元信息展示，HistoryPage.tsx 接入该组件；history.css 仅调整历史侧栏样式，design.md 更新字段参数。原型位于已忽略 artifacts/history-style，生产构建不含方案切换器；未提交或推送。

## 0.3.7 历史页选定样式落地

新增 HistorySidebar、HistoryReaderHeader 展示组件及 history-reader.css；HistoryPage 保留已有读取/切换/草稿离开保护逻辑，App 与 PanelControls 提供历史页顶部导出入口。外壳和左右内容统一采用用户指定色值，日期分组只使用已有数据，缺日期明确显示。共享 App 原本超过 300 行，本轮保留已有生命周期编排，避免样式任务扩大为业务重构；新增展示结构放独立组件。

构建与自动检查通过。真实 Chrome 加载 `extension/dist` 后重新打开历史页进行最终视觉验收；此次尚未提交或推送。

## 0.3.8 历史页滚动与排序

`list-order.ts` 保存本次浏览的排序时间快照；HistoryPage 与 HistorySidebar 共用该快照排序和分组，实际阅读时间仍持久化。新增记录可加入列表。App 增加阅读流容器供历史页统一滚动，嵌入面板采用 display: contents；弹层不进入阅读流。样式修订见 design.md，版本统一到 0.3.8。


### 0.3.9 历史页内容切换按钮收紧

逐字稿／视频脉络／笔记：桌面按钮内边距改为上下 8px、左右 14px，行高 21px，实际高度 37px；整组高度由 47px 改为 45px。字号仍为 13px、字重选中 600/未选中 400。窄屏原本即 37px，保留左右 10px 内边距。中文／英文／中英按钮不变。

## 0.4.1 历史记录删除

HistorySidebar 增加图标入口，HistoryPage 负责确认和成功/失败状态；shared requestSchema 与后台同步新增 deleteHistory；database 事务清除内容并保留空版本标记。useVideo 和 caption-cache 使用 deletionEpoch 阻止旧任务回写。无需新依赖或数据库升级。源码版本统一 0.4.1，待用户验收，未提交推送。

## 0.5.1 Obsidian 与保存位置窗口

新增本机导出模块与前端适配，沿用统一文档生成，不拆成三个文件。新增 downloads 权限，下载请求限制 MIME、后缀、文件名和内容大小，不接受任意网络 URL。已有本机组件更新到本次构建；实际个人知识库目录尚未选择，不写入真实笔记。详见 obsidian-export.md。

## 0.5.2 导出修复

新增 createDownloadBlob 独立生成格式对应的 Blob，Markdown 使用 text/markdown 而非 TXT MIME；下载请求同步校验新类型。新增 DuplicateExportDialog，使用浏览器原生模态层实现遮罩、焦点与取消交互。既有 Obsidian 防覆盖存储逻辑不变。

## 0.5.3 下载文件名与提示修订

新增 background/download-filename.ts，通过 onDeterminingFilename 对本扩展 Markdown 下载确定 .md 后缀；其他下载原样交还。成功提示精简；203 项测试通过。尚未在用户实际 Chrome 更新插件后执行保存端到端验收。

## 0.5.4 本机保存窗口

新增 service/src/save-export.ts，downloadExport 后台请求改发 Native saveExport。输入沿用严格文件名/data URL 校验，大小限制 7MB；选择路径只能由系统窗口返回。先写同目录临时文件并同步，再 rename，失败清理本次临时文件。扩展移除 downloads 权限及旧文件名监听。默认视频名在 UI 生成，原样传给系统窗口；保存成功才显示成功。本机组件已更新。

## 0.5.5 浏览器下载恢复

撤回 Native saveExport 路由与实现，下载重新经 Chrome downloads API；新增 download-export.ts 保存并解析原始名称供最终命名监听使用。仅本扩展且携带合法名称参数的请求会建议文件名。downloads 权限恢复，Obsidian 模块不变。

## 0.6.3 · A 方案配色统一（2026-10-03）

新增 `extension/src/ui/theme.css` 作为三页共用配色来源，由 `ui/style.css` 导入；历史固定浅色变量引用同一组浅色值，设置不再覆写灰绿配色。保留现有组件结构、内容排版及业务流程。完整自动检查与隔离样式对照通过，后续随 0.6.4 获用户验收，详情见 [测试反馈](test-feedback.md)。

## 0.6.5 · 笔记卡片与重复提问

NoteCard 顶部使用 DeleteNoteButton 的 iconOnly 直接删除模式，移除底部跳转；编辑器的删除确认不变。answer-note 统一判定最后一轮与当前问题的连续重复，AskDialog 成功保存后清空输入并避免关闭时覆盖疑问。新增 tests/unit/answer-repeat.test.ts，自动检查与隔离界面验证通过；尚未复现的真实保存不一致保留为待核对，见测试反馈。

## 0.6.6 · 删除确认

DeleteNoteButton 不再为 iconOnly 绕过确认；卡片垃圾桶与编辑器文字按钮共享确认及防重复逻辑。0.6.5 直接删除说明由本节取代。取消、确认和处理中重复点击回归通过，完整检查通过，待 Chrome 人工验收。
