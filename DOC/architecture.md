# 项目文件架构

> 状态：目录设计，尚未创建下列源码、安装依赖或生成可运行扩展。当前实际文件仍为需求与设计文档。
> 配套：[实施计划](PLAN.md)、[技术方案](technical-design.md)、[服务设置方案](service-settings.md)。

## 一、组织原则

采用一个仓库、三个工作区：`extension` 管浏览器，`service` 管按需启动的本机凭据组件与受限服务请求，`shared` 管双方共同遵守的数据格式。第一版统一使用 pnpm workspaces 和根 pnpm-lock.yaml，不混用其他包管理器。Node.js/pnpm 版本在实现时验证后锁定；安装、依赖变更和编码检查规则以 [AGENTS.md](../AGENTS.md) 为准。

就像前台、后台和双方共用的表单：前台展示视频与笔记，后台负责连接外部服务，表单规定双方传递什么信息。避免把页面组件、API key 和字幕算法堆在同一个文件里。

根目录保留 `README.md` 作为项目入口，以及 `AGENTS.md` 作为项目级协作说明。需求、计划、设计、技术和测试文档统一放在 `DOC/`，后续新增同类文档也放在此目录。沿用 extension、service、shared 工作区名称；service 不再表示 HTTP 常驻服务。任务编排归 extension，凭据使用归 service。

## 二、完整目录设计

树中目录名、文件名保持英文，右侧说明为中文。文件是职责示例；不要预先创建没有内容的大量空文件。

```text
youtube-note/
├── README.md                       # 项目入口、当前状态和文档导航
├── AGENTS.md                       # 项目级协作约定与工作流程
├── DOC/
│   ├── PLAN.md                     # 需求、范围和实施顺序
│   ├── design.md                   # 界面视觉与交互规范
│   ├── architecture.md             # 目录与模块依赖边界
│   ├── technical-design.md         # 主流程和技术规则
│   ├── service-settings.md         # 独立设置页与 LLM/API 连接规范
│   ├── test-plan.md                # 测试用例和验收门槛
│   └── test-feedback.md            # 实际测试反馈，当前空白模板
├── package.json                    # pnpm workspaces 与统一脚本
├── pnpm-lock.yaml                 # 工作区依赖锁定
├── pnpm-workspace.yaml            # 声明 extension、service、shared
├── tsconfig.base.json              # 共享 TypeScript 严格检查
├── eslint.config.mjs               # 代码检查
├── .prettierrc.json                # 统一格式规则，禁止整库顺手格式化
├── .prettierignore                 # 排除构建与生成文件
├── .gitignore                      # 密钥、构建及个人数据排除
├── .env.example                    # 仅环境变量名和占位符
├── extension/
│   ├── package.json
│   ├── manifest.json               # MV3、权限、快捷键、options_page
│   ├── options.html                # 独立完整设置页入口
│   ├── vite.config.ts              # 打包内容脚本、后台与设置页
│   ├── tsconfig.json
│   ├── public/icons/               # 本地 SVG/扩展图标资源
│   └── src/
│       ├── background/
│       │   ├── index.ts            # 注册后台事件，不堆放业务逻辑
│       │   ├── commands.ts         # 面板关闭仍可接收快捷记录命令
│       │   ├── message-router.ts   # 区分视频消息与设置管理消息
│       │   ├── context-registry.ts # 标签页、视频与导航代次
│       │   └── native-client.ts    # Native Messaging 连接、协议与断开恢复
│       ├── content/
│       │   ├── index.ts            # 轻量引导与生命周期
│       │   ├── navigation/         # 视频切换、回退、上下文协调
│       │   ├── youtube-adapter/    # URL、DOM、播放器、广告适配
│       │   └── mount/              # 入口与 Shadow DOM 挂载/撤下
│       ├── ui/
│       │   ├── panel/              # 主面板与标签页
│       │   ├── transcript/         # 语言模式、跟随、搜索、选词、编辑
│       │   ├── analysis/           # 摘要、视频脉络、金句和方法
│       │   ├── notes/              # 快捷窗、列表、编辑和来源差异
│       │   ├── components/         # 按钮、图标、进度和对话框
│       │   └── styles/             # 主题 token、字体与布局样式
│       ├── options/
│       │   ├── main.tsx            # 设置页独立 React 根
│       │   ├── SettingsApp.tsx
│       │   ├── pages/
│       │   │   ├── GeneralPage.tsx
│       │   │   ├── LlmPage.tsx
│       │   │   ├── SubtitlePage.tsx
│       │   │   ├── TaskRoutingPage.tsx
│       │   │   └── ConnectionPage.tsx
│       │   ├── components/         # 服务表单、密钥输入和连接结果
│       │   └── settings-client.ts  # 只调用专用设置协议
│       ├── storage/
│       │   ├── database.ts         # 扩展来源 IndexedDB
│       │   ├── migrations/         # 数据版本迁移
│       │   └── repositories/       # 笔记、草稿、字幕、AI结果访问
│       ├── jobs/                   # 批次队列、任务进度、恢复与去重
│       ├── translation/            # 本地翻译适配、受限消息、文档执行环境待验证
│       ├── pipelines/              # 翻译批次、分析分块与结果验证
│       ├── prompts/                # 版本化中文指令，不含凭据
│       ├── segmentation/           # 本地字幕分段及原始时间映射
│       ├── export/                 # TXT/Markdown 导出和转义
│       └── state/                  # 页面状态，非持久数据唯一来源
├── service/
│   ├── package.json
│   ├── tsconfig.json
│   ├── native/keychain/            # macOS 原生凭据桥接、签名待验证
│   ├── native/manifest/            # 本机主机登记模板，限定扩展 ID
│   └── src/
│       ├── index.ts                # 标准输入输出入口、装配与退出清理
│       ├── handlers/
│       │   ├── requests.ts         # 受限供应商请求与已有任务查询
│       │   ├── settings.ts         # 非敏感配置管理
│       │   └── connections.ts      # 显式连接/能力测试
│       ├── config/
│       │   ├── profile-store.ts    # 不含密钥的服务配置
│       │   ├── task-routing.ts     # 翻译/分析选择哪个服务与模型
│       │   └── revisions.ts        # 设置版本与并发更新
│       ├── credentials/
│       │   ├── credential-store.ts # 环境变量/系统凭据库统一接口
│       │   ├── env-store.ts
│       │   └── keychain-store.ts
│       ├── providers/
│       │   ├── llm/
│       │   │   ├── provider.ts     # 文本生成、可选列模型、能力测试
│       │   │   └── openai-compatible.ts
│       │   └── transcript/
│       │       ├── provider.ts     # 字幕获取、生成及任务查询
│       │       └── supadata.ts
│       ├── requests/              # 请求去重、提交记录、超时与取消
│       ├── security/              # 调用来源、目的地限制与输入校验
│       └── diagnostics/           # 脱敏状态，不记录个人文本/密钥
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── schemas/               # 消息、配置、任务、笔记验证
│       ├── types/                 # 公开的跨工作区类型
│       ├── errors/                # 统一错误分类及中文映射键
│       └── constants/             # 不含服务密钥或私人配置
├── tests/
│   ├── unit/                      # 分段、版本、导出、配置校验
│   ├── integration/               # 服务契约与跨模块流程
│   ├── e2e/                       # 扩展、设置页、视频页联动
│   ├── fixtures/                  # 人工测试数据与模拟服务
│   └── helpers/                   # 播放器/服务替身，不混入生产代码
├── scripts/                       # 构建、检查、打包与开发启动
└── artifacts/                     # 本地测试截图/报告，默认不提交
```

## 三、依赖方向与职责

| 模块 | 可以依赖 | 不可以承担 |
| --- | --- | --- |
| 内容脚本和视频界面 | shared、页面适配、组件、后台消息客户端 | 获取长期密钥、任意外部网络代理、直接操作服务配置 |
| 独立设置页 | shared、公共样式、设置客户端 | 读取 YouTube DOM、把密钥存浏览器持久数据库 |
| 扩展后台 | shared、扩展存储、本机客户端 | 依赖某个面板始终挂载、保存仅靠内存、导入服务端密钥模块 |
| 本机组件 | shared、供应商适配器、系统凭据库 | 读取个人想法来自动分析、把秘密回传界面 |
| shared | 纯数据类型、校验工具 | React、Chrome API、Node 文件系统、环境变量读取 |
| 测试 | 被测模块和测试夹具 | 让生产模块反向依赖测试脚本 |

设置管理消息单独验证来自 `options.html`；不能因为视频内容脚本也属于本扩展，就允许它修改服务目标或凭据。

## 四、文件与数据存放边界

- `extension/dist/`、`service/dist/` 为构建输出，默认忽略；测试产物与私人样本不提交。
- 笔记、草稿与字幕修订放在扩展来源 IndexedDB，不放到项目目录或 YouTube 网页数据库。
- 本机组件的非敏感配置和请求去重记录放在项目外的应用数据目录。macOS 默认建议 `~/Library/Application Support/youtube-note/`，具体位置实现时确认。
- API key 从系统凭据库或环境变量取用；配置文件只存 `credentialRef`，不含真实密钥。
- `.gitignore` 覆盖 `.env`、`.env.*` 并对 `.env.example` 例外，以及私钥、credentials 文件、node_modules、构建、日志和私人测试产物。
- 核心文档、源码、锁文件、人工合成测试夹具可提交；真实资料不因放进 fixtures 就自动成为可公开内容。

## 五、实施时的脚本约定

根工作区拟提供 `register:native`、`dev:extension`、`build`、`typecheck`、`lint`、`format:check`、`test:unit`、`test:integration`、`test:e2e`、`check`。`check` 汇总类型、lint、格式、单元测试和构建，任一步失败即失败；集成、端到端与人工验收另行执行。register:native 仅为开发登记脚本，最终用户使用安装包；组件与运行时一起交付，签名及升级路径须验证。这些目前是约定名称，package.json 尚未创建，不宣称命令已能运行。

首先验证“安装登记 → 独立设置页 → 按需组件 → 钥匙串保存 → 重启后调用”的小流程，再接字幕与 LLM。按功能创建文件，不先制造空目录。类型和契约先放 shared；实现后用测试检查两个入口的权限差异与模块边界。
