# 多平台适配

2026-10-02：用户同意按可行性分析的顺序推进。沿用当前产品的 extension、service、shared 工作区，不为平台新建独立产品。B 站已有字幕路线完成真实样本验证，0.6.1 首轮接入已构建并同步本机组件，尚未通过 Chrome 人工验收或提交发布。小红书、抖音和通用转写仍待验证接入。

## 推进顺序与边界

1. 验证真实样本：已有字幕、无字幕、长短视频；B 站另测多 P 与播放时间。
2. 接入 B 站普通视频，完成平台记录隔离、原视频链接、按内容语言展示；保护旧 YouTube 记录。
3. 验证并接入通用转写，随后适配小红书／抖音单条视频详情页。
4. 连续信息流、小红书图文、OCR 和本机离线转写后续评估，不作为首轮交付前提。

字幕获取优先读取平台现有数据；读取失败不等于没有字幕，须区分登录、网络、权限与真正无字幕。收费生成先展示预计消耗并逐次确认；不得自动使用 Supadata auto 模式或擅自切换收费服务。

## 产品方向

- 共用逐字稿、脉络、笔记、历史和导出，语言能力按内容语言决定，不按网站决定。
- 中文原稿不重复翻译，不复制成两份双语内容；外语保留原文／中文／双语。语言不确定时保留原稿并允许用户指定。
- 标题、正文、弹幕与视频逐字稿分开，不能用简介冒充完整视频文字；无时间戳资料不伪造时间引用。
- 记录标识须包含平台及必要的分 P 信息。旧 YouTube 数据保持可读，不通过清库迁移。
- 网站登录由浏览器处理，不导出 Cookie；供应商 Key 继续使用现有系统钥匙串。

## 第一阶段完成条件

- 已有字幕路线须取得实际分段文本与时间戳，并检查时间范围和视频归属。
- 多 P 样本须证明同 BV 不同分 P 的 cid 和时间轴可以区分。
- 无字幕样本须明确返回状态，不能误报成功；转写路线须独立验证音频输入能力。
- 记录实际浏览器、登录状态与失败原因；Ego Lite 验证不代替 Chrome 扩展验收。
- 路线受登录或外部服务阻塞时记录具体缺口，继续可独立完成的验证。

## 样本证据

环境：Ego Lite，任务空间 30。先验证未登录状态，再由用户在浏览器完成登录并明确回复“已登录”。只读取元数据与字幕，不调用收费服务。

| 样本 | 已验证 | 状态与限制 |
| --- | --- | --- |
| `BV13x41117TL`，阿滴英文 Closer | 标题、BV、cid=14694589、单 P 时长 554 秒及 video 播放时间；字幕接口 HTTP 200、业务 code=0 | need_login_subtitle=false，字幕列表为空；没有独立字幕，未进行音频转写 |
| `BV1qW411N7FU`，微积分的本质合集 P1 | 共 11 P；P1 cid=40809259，时长 1025 秒；字幕接口 HTTP 200、业务 code=0 | need_login_subtitle=false，字幕列表为空；标题中的“双语”不代表存在独立字幕轨道 |
| 同 BV，`?p=2` | state.cid=40809285，state.p=2，播放器时长 1118 秒，与 pages[1] 一致 | videoData.cid 仍为 P1 的 40809259；不能用它作为当前分 P 标识 |
| `BV1Y7ar69ESN`，压缩即智能视频解读 | BV、标题、cid=42369945232；字幕接口 HTTP 200、业务 code=0 | need_login_subtitle=true、字幕列表为空；明确为登录阻塞，不能标记成无字幕 |

登录后结果：BV1Y7ar69ESN 返回 `zh` 204 条、4,277 字符，时间 0–970.1 秒；`ai-zh` 356 条，时间 0.04–970.14 秒；视频时长 971 秒。所有原始时间非负且结束不早于开始，文字非空。首版优先非 AI 中文轨道，不混合不同轨道。BV1qW411N7FU 的 P2 在登录后仍为空轨道。

实际 `requestBilibiliSubtitles` 源函数在真实页面再次取得 204 条字幕；最终构建的 bilibili-bridge.js 在真实页面发布正确平台键与 971000ms 时长。抓取结果经过生产解析、分段、协议和导出回放，204 条来源文字完整保留，最后时间为 970100ms。真实材料仅在被忽略的 artifacts/platform-probe，未作为公开测试夹具。

一次页面导航出现 ERR_CONNECTION_RESET，随后检查发现目标页面已加载、状态正确，复用当前页面完成验证，没有循环重试。Ego Lite 的扩展加载调试接口返回 Method not available，未换浏览器配置或绕过限制；实际 Chrome 插件、视觉与用户验收仍待完成。

本轮未增加依赖或读取、导出 Cookie，没有转写费用。执行环境为 Node.js 26.3.1、环境提供的 pnpm shim 11.25.0；项目 packageManager 仍锁定 11.19.0，未改锁文件或升级依赖。

## 接入设计与必要回归

正式接入时将网页差异封装在 extension 的平台适配层：解析 URL、读取当前媒体身份、字幕读取、播放器定位与入口挂载；不把这些网站差异放进笔记组件。

记录保留来源平台、规范视频地址、视频本体标识和分 P 标识。B 站当前身份须同时匹配 URL 的 p、当前 cid、pages 中的分 P 信息及播放器状态；状态不同步期间先撤下旧上下文，避免 P1 结果写入 P2。旧 YouTube 记录采用兼容读取，不无条件改写全部历史。

接入前后必须验证：

- P1→P2→P1，前进／后退，字幕乱序返回，同 BV 两个分 P 同时打开。
- 非视频页、直播和未支持页面不挂入口、不调用服务。
- 登录受限、真正无字幕、接口错误分别提示，均不得自动产生付费请求。
- 当前中文原稿不触发英中翻译，YouTube 英文原有翻译保持可用；旧记录无语言信息时不能一律假定中文。
- 字幕点选与实际播放时间对应，分 P 的时长取当前部分；无可靠时间戳时不开放伪精确跳转。
- 历史、导出、Obsidian 链接返回正确平台和分 P；旧 YouTube 笔记、删除标记及修订保护不丢失。
- 新网站权限和消息来源校验同步，字幕地址限定在已验证的目标主机，不开放任意 URL 请求。

## 0.6.1 实现与文件职责

新增网站权限仅为 `https://www.bilibili.com/*`。已有字幕请求由扩展主动注入当前 B 站页面执行，站内 Cookie 留在浏览器；字幕 CDN 请求不携带 Cookie、拒绝重定向，并限制 HTTPS、字幕主机和 JSON 路径。首页、搜索、直播、番剧及互动视频不挂学习入口。本版尚不处理未验证的播放器广告形式，真实 Chrome 遇到身份／时长无法核对时应停止定位并反馈。

平台键采用 `bilibili-BV编号-cid-p分P`；保留旧 YouTube 11 位键。无需清库或全量改写。新的可选 sourceLanguage 保存在字幕段中；有平台语言时优先使用。旧记录仅对明显中文采用文字检测，其余保留既有英文默认；混合语言精细检测与手动指定语言尚未实现。

| 文件 | 本次职责 |
| --- | --- |
| shared/src/video-source.ts | 平台键、页面范围、原视频链接及匹配规则 |
| shared/src/transcript-language.ts | 中文原稿识别及阅读模式规则 |
| shared/src/index.ts | 扩展消息接受新平台键，字幕增加可选语言字段 |
| shared/src/questions.ts | 笔记提问契约接受新平台键 |
| extension/src/platforms/bilibili.ts | 当前分 P 元数据核对、字幕时间与文本解析 |
| extension/src/platforms/bilibili-request.ts | 网页内受限字幕请求，区分登录、无字幕、网络错误与切换 |
| extension/src/content/bilibili-bridge.ts | B 站页面元数据发布及监听清理 |
| extension/src/content/index.ts | B 站入口／右栏挂载、失效撤下及复用播放器操作 |
| extension/src/background/captions.ts | 从后台入口拆出按平台获取字幕，保留 YouTube 原路径 |
| extension/src/background/index.ts | 来源校验、平台脚本恢复、拦截 B 站付费生成 |
| extension/src/background/shortcuts.ts | 快捷键的视频页面范围 |
| extension/src/background/history.ts | 返回原平台与分 P，复用正确标签 |
| extension/src/segmentation/regroup.ts | 重组字幕保留来源语言 |
| extension/src/translation/local.ts | 使用实际来源语言，不再固定英中 |
| extension/src/ui/App.tsx | 有效阅读模式、关闭消息平台来源、隐藏 B 站生成按钮 |
| extension/src/ui/PanelControls.tsx | 中文原稿、原文／中文／双语与翻译入口展示 |
| extension/src/ui/ContentViews.tsx | B 站无字幕状态说明 |
| extension/src/ui/videoActions.ts | 中文不翻译，外语使用实际语言；分析流程保持原规则 |
| extension/src/ui/SegmentEditor.tsx | 中文原稿隐藏空译文编辑框，已有译文仍可编辑 |
| extension/src/ui/NoteEditor.tsx | 原文标签与中文摘录编辑状态 |
| extension/src/ui/AnalysisDetails.tsx | 中文金句展示和复制原话，外语保留双语 |
| extension/src/history/HistoryPage.tsx | 打开历史时接受 B 站平台键 |
| extension/src/history/HistoryRecordMeta.tsx | 列表平台标识 |
| extension/src/export/index.ts | 中文逐字稿单份导出、笔记时间链接 |
| extension/src/export/document.ts | 导出正确来源平台地址 |
| extension/src/export/analysis.ts | 中文金句导出原话 |
| service/src/providers/index.ts | 翻译提示不假定英文，Supadata 返回保留语言 |
| service/src/obsidian.ts | Obsidian 导出接受安全的 B 站标识并按分 P 判重 |
| extension/manifest.json、scripts/build.mjs | B 站权限与脚本入口、构建合法标识 |
| 根及三个工作区 package.json | 版本统一 0.6.1，与 manifest 一致 |
| tests/unit/bilibili.test.ts | URL／分 P／字幕／语言／目标限制／迟到结果／提问契约 |
| tests/unit/bilibili-storage.test.ts | 新旧平台记录隔离、语言持久化及删除保护 |
| tests/unit/history.test.ts | 同 BV 不同分 P 不复用错误标签 |
| tests/unit/panel-lifecycle.test.ts | 分 P 切换 20 次不累积监听器或旧面板 |
| tests/unit/video-actions.test.ts | 中文不启动本地或 LLM 翻译 |
| tests/unit/analysis-details.test.ts | 中文金句复制与导出不重复或采用改写 |
| tests/unit/obsidian.test.ts | B 站导出判重、原有 YouTube 文件保留及非法标识拒绝 |
| README、AGENTS、PLAN、design、service-settings、implementation、changelog、test-feedback | 当前范围、入口、交付与实测证据；本文件是详细方案来源 |

长度审查：App 保留现有页面状态和 JSX 编排，本轮仅接入语言与平台分支；videoActions 的既有分批分析／翻译保留；requestBilibiliSubtitles 需作为自包含函数由 Chrome 序列化注入，内部 URL／超时／错误处理不依赖模块闭包，因此保留超过 60 行。新增平台逻辑已独立于组件，不扩大无关重构。

## 验证与下一步

- `pnpm run check` 通过：类型、lint、格式、36 文件 224 项单元测试和扩展／本机组件构建。
- 真实已保存字幕回放独立 1 项通过；未调用真实 LLM 或收费转写。
- 初次构建发现新增 IIFE 名称含连字符不合法，已在构建脚本转换下划线并完整检查通过。
- 本机组件已向现有 Chrome 扩展 ID 同步，不更改允许来源或 API Key。
- Chrome 中重新加载 extension/dist 并刷新已登录 B 站视频，检查获取、段落跳转、快捷草稿、编辑、历史和导出，再回归一个 YouTube 英文视频；此项仍待用户验收。
- B 站无字幕转写与小红书／抖音详情页进入下一阶段；平台音频可取得性、服务商选择及费用仍需验证，不宣称已完成适配。

## 技术参考

- 当前 YouTube 字幕路径：extension/src/background/index.ts 的 captions；失败后经 service/src/providers/index.ts 调用 Supadata native。
- 当前协议的 YouTube 11 位 ID、固定英中翻译及导出 URL 均需在正式平台接入时调整。
- [Supadata 支持范围](https://docs.supadata.ai/get-transcript)：未列出 B 站、小红书和国内抖音，不把 TikTok 支持等同抖音支持。
- [yt-dlp B 站实现](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/bilibili.py)：用于了解字幕与 cid 关系；真实可用性以本项目样本结果为准。

## 0.6.2：B 站面板交互修复

用户在 Chrome 确认已有字幕加载、自动跟随和高亮正常；手动滚动、字幕点击、笔记、历史和脉络入口全部无响应。真实页面确认 .right-container 的 pointer-events:none 继承至插件宿主与 Shadow DOM 中的 iframe。frameHost 现显式恢复宿主 pointer-events:auto，不改变站点容器。

本轮仅修改该宿主样式及注释、五处版本号（统一 0.6.2）、README/PLAN/changelog/implementation/本文件/test-feedback 的当前状态。保留所有 0.6.1 工作。完整 check 通过（224 项测试）；真实页面使用生产宿主函数和隔离内容，修复前点击事件数为 0，修复后四个按钮均收到可信鼠标事件，内部滚动 320px。该验证不等同完整 Chrome 笔记保存、历史打开或模型调用验收；仍需重新加载扩展并刷新页面复测。

### 用户确认与归档

用户确认 0.6.2 的基本功能和任务均可完成，并授权提交当前版本、推送现有 GitHub 仓库。此前“待复测”保留为当时验证状态；后续出现的一次脉络首次失败、重试成功单独记录于 test-feedback.md 的 OBS-20261002-01，根因未确认，暂不修复。
