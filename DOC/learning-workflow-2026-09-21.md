# 0.1.12 阅读、知识笔记与 AI 提问

## 用户确认与本次实现

- 解决问题、适用场景、切片建议加粗并列条目。新模型输出数组；旧文本本地按句末／换行显示条目，不自动计费重生成。切片条目明确片段价值、独立性和建议，不虚构精细切片规划。
- 主题卡片为左侧时间、右侧标题；“脉络”操作放在底部“跟随”左侧。
- 知识清单是按概念归纳的学习项；一个知识点可引用多个字幕片段，不是每个时间代表一个子知识点。显示前按视频顺序整理来源，合并相邻／重叠区间，首处直接显示，其余折叠为“另 N 处”。
- 金句仍为用户再次确认的四类：反直觉洞察、惊人事实、轶事、点透本质。不新增“其他”或“方法洞察”；操作方法已有独立栏目。
- 知识卡片可 note / AI提问。逐字稿与视频脉络均支持划词，选区下方显示淡色 note / AI提问，滚动或切换栏目时关闭，避免位置漂移。
- 选区或知识点加入笔记后，保存摘录性质、对应原文／译文、来源片段和视频时间，个人理解保持空白。
- 笔记卡片和编辑器也可发起 AI 提问。使用已配置的分析模型，问题先保存到笔记，再调用；AI 回答单独保存，支持继续提问，最近四轮作为上下文。个人理解不自动发送，未选择的其他笔记不发送。发送前显示上下文和模型额度提示。
- 导出包含知识摘录、用户问题和独立标记的 AI 回答，便于用户另交 Agent 处理；没有自动连接或发送到外部 Agent 应用。
- 问题草稿持久化失败时不调用模型；模型失败保留问题；回答保存失败时保留当前答案并可重新保存；切换视频后不应用迟到回答。
- 新增可选笔记字段，旧记录兼容，不重写数据库版本或清库。

## 一键复制

此前只有 navigator.clipboard，没有 clipboardWrite 权限，嵌入 iframe 也未声明 clipboard-write 授权。现增加这两处授权，并在点击内同步执行浏览器复制命令，自动回退至现代接口。复制临时元素自动清理，恢复焦点和选区，不要求用户手动选择文字。只有浏览器实际报告写入成功才显示已复制；双路径都拒绝时提示重新加载权限，不虚报成功。

权限只增加写剪贴板，不增加读剪贴板。真实 YouTube 页面必须在扩展重载后刷新，使新 iframe 授权生效。

## 分段入口清理

正式字幕流程原本已只使用 SEGMENTATION_VERSION=2，不存在仍参与正式执行的旧算法。移除主面板“重新分段”“补齐本地翻译”操作行和失去调用方的 ResegmentDialog.tsx。新版自动分段和自动本地翻译继续工作，首次语言模型准备时的继续准备入口保留。历史记录、备份、来源恢复辅助函数和回归证据不删除，不把移除测试按钮变成清理用户数据。

## 主要文件用途

| 文件 | 用途 |
| --- | --- |
| shared/src/index.ts | 分析字段兼容字符串／条目数组；新增可选 AI 笔记字段 |
| shared/src/questions.ts | 提问、摘录、来源和历史的共同输入约束 |
| service/src/host.ts、providers/questions.ts | 使用当前分析模型执行有来源的问答 |
| service/src/providers/analysis.ts、analysis-output.ts | 生成并解析条目式内容与切片价值 |
| extension/src/lib/clipboard.ts | 点击内同步复制、自动回退和焦点选区恢复 |
| extension/manifest.json、content/index.ts | 写剪贴板权限与 iframe 授权 |
| extension/src/ui/main.tsx、PanelControls.tsx | 调整工具栏、删除测试入口、装配笔记与问答 |
| extension/src/ui/ContentViews.tsx、AnalysisDetails.tsx、analysis-format.ts | 横向标题、条目、知识来源折叠和动作 |
| extension/src/ui/useTextSelection.tsx | 跨栏目选区定位与浮动操作 |
| extension/src/ui/learning-notes.ts、answer-note.ts | 可追溯笔记、显式上下文、先存后问及迟到响应隔离 |
| extension/src/ui/AskDialog.tsx、AnswerText.tsx | 问答界面、自动保存、只呈现安全文本格式 |
| extension/src/ui/NoteCard.tsx、NoteEditor.tsx | 展示摘录和 AI 回答、笔记提问入口 |
| extension/src/ui/SegmentEditor.tsx | 从主面板拆出的原有逐字稿编辑职责 |
| extension/src/ui/ResegmentDialog.tsx | 已移除无调用方的测试弹窗 |
| extension/src/ui/style.css、export/document.ts | 轻量操作样式及包含问题／回答的导出 |
| tests/unit/learning-tools.test.ts、clipboard.test.ts、storage.test.ts | 问答失败边界、复制、来源合并和持久化回归 |
| 根及三个工作区 package.json、extension/manifest.json | 版本统一 0.1.12，无新增依赖 |

main.tsx 仍约 340 行，保留状态清理与组件装配；已拆出选择、问答流程和逐字稿编辑，不把业务实现继续放进主面板。其余新增源码均在 300 行内；多个 React 组件超过 60 行主要为界面声明，已按职责拆分，不为行数压缩 JSX。

## 验证与限制

- 136 项单元测试通过，覆盖存储重新读取、旧数据兼容、草稿保存失败不调用模型、模型失败保留问题、迟到响应不保存、答案写入失败保留可重存内容、上下文不携带个人理解、导出和复制回退。
- 实际已配置的 Codex / gpt-5.5，通过安装后的 Native Messaging 服务，回答用户此前测试视频 bRBLPJguU-0 的职业选择问题；生成约 664 字回答并区分视频依据与补充解释。另真实分析前 14 段，三个字段均生成条目数组，切片条目含价值、独立性、建议；总测试约 94 秒。
- Ego Lite 产品组件页：主题标题 flex 布局、三个字段列表、知识点提问入口、选中文字加入笔记验证通过。选区浮动操作实测位于末行下方 6px。
- 实际点击双语复制后，用系统剪贴板逐字比对，完全一致；中文选项显示已复制中文。不同端口的跨源 iframe 内实际点击复制，状态和剪贴板内容均正确。
- 跨站 localhost／127.0.0.1 的 OOP iframe 自动输入未取得成功反馈；截图工具超时。未把这些计为通过，也未冒充真实 Chrome／YouTube 全链路验收。浏览器问答预览页不发送模型请求，真实服务测试单独执行。
- 最终 Chrome：需重载 0.1.12、刷新 YouTube 使 iframe 权限更新，再检查复制、划词位置、笔记提问和视觉效果。旧结果即时按句显示；新条目和切片价值需主动点击“脉络”重新生成。

没有 Git 提交或推送。私人测试结果放在忽略目录 artifacts/learning-review/。
