# Chrome 本地翻译样本评估

## 结论与适用范围

2026-09-11 在实际 Chrome 扩展文档中成功调用 Translator API，语言为 en→zh。8 组人工编写短文本全部返回译文，但访谈口语和习语存在明显意义错误，技术术语也有错译。当前不将本地引擎确认为默认，不接入 client=gtx；等待用户根据结果决定下一步。

这些是定向探针，不是真实长视频逐字稿、随机样本或统计质量基准；没有测试云端对照，不能断言云端一定更好，也不能把本轮结果概括成所有本地翻译都不可用。下列评语由助手对照原文检查，用户尚未人工验收。

## 环境与调用证据

- Chrome 安装版本：152.0.7977.84；运行页面 UA 显示 Chrome/152.0.0.0。
- 扩展来源：chrome-extension://cpjemlokndjkmjlimjdgdgdfekcaojpj/probe.html。
- secureContext=true；translatorAvailable=true。
- 首次 availability=downloadable，随后进度事件 loaded=1，全部翻译完成；这不提供实际下载字节量，不能推断下载大小或是否复用了既有组件。
- 首次页面把完整 JSON 放在单个文本节点，可访问性输出截断。修复为逐条展示后重跑；下面保留的是第二次可完整读取的结果。
- 第二次 availability=available；8 组样本循环总耗时显示 70 ms，单组 6–14 ms。此为已准备模型的短文本调用，不包含首次准备和下载，不能外推整部视频速度。
- 未配置或调用云端 LLM、client=gtx；没有读取私人笔记、现有字幕或钥匙串。验证扩展没有网站访问权限。

## 逐条原文与结果

### T01：否定和操作顺序

原文：Do not delete the original notes. Save the translation before switching videos.

实测译文：不要删除原始注释。 在切换视频之前保存翻译。

核对：主要意思保留；notes 译为“注释”，本项目语境应为“笔记”。

页面记录耗时：14 ms。

### T02：数字与百分比

原文：Revenue rose from 2.5 million dollars to 3 million dollars, an increase of 20 percent, not 50 percent.

实测译文：收入从 250 万美元上升到 300 万美元，增长了 20%，而不是 50%。

核对：本样本数字、百分比及否定正确。

页面记录耗时：9 ms。

### T03：访谈口语

原文：I mean, we were kind of winging it at first. But that does not mean we had no plan; we just kept changing it as we learned.

实测译文：我的意思是，我们一开始有点想。 但这并不意味着我们没有计划。 正如我们所学，我们只是不断地改变它。

核对：明显意义损失：winging it 是临场应变／边做边想；as we learned 表示随学习和经验调整，不是“正如我们所学”。

页面记录耗时：9 ms。

### T04：否定范围

原文：Not everyone who works hard succeeds, but that does not mean hard work is useless.

实测译文：不是每个努力工作的人都会成功，但这并不意味着努力工作是无用的。

核对：本样本否定范围正确，表达略生硬。

页面记录耗时：6 ms。

### T05：技术术语

原文：A closure lets a function retain access to variables from its lexical scope, even after the outer function has returned.

实测译文：闭包允许函数从其词汇范围内保留对变量的访问权限，即使在外部函数返回之后也是如此。

核对：lexical scope 应为“词法作用域”，译为“词汇范围”不符合编程术语。

页面记录耗时：7 ms。

### T06：条件与步骤

原文：If the upload fails, retry only the failed part. Do not start over unless the saved progress is corrupted.

实测译文：如果上传失败，请仅重试失败的部分。 除非保存的进度已损坏，否则不要重新开始。

核对：本样本条件、范围和操作逻辑正确。

页面记录耗时：8 ms。

### T07：指代与上下文

原文：Maya gave the proposal to Alex. He rejected it because its budget was too high, not because he disliked her idea.

实测译文：玛雅向亚历克斯提出了这个提议。 他拒绝了它，因为它的预算太高，而不是因为他不喜欢她的想法。

核对：主要因果与指代保留，措辞略生硬。

页面记录耗时：10 ms。

### T08：习语与因果

原文：We pulled the plug on the project. It was not a lack of demand; we had bitten off more than we could chew.

实测译文：我们拔掉了项目的插头。 这不是缺乏需求。 我们咬得比我们咀嚼的还要多。

核对：明显习语直译；原意为终止项目，原因是承担超出能力的工作，而非缺少需求。

页面记录耗时：8 ms。

## 下一步与当前状态

- 接口可调用：已验证，限此独立扩展文档；后台及快捷摘录执行环境尚未验证。
- 翻译质量：发现足以影响英文访谈理解的具体错误，默认引擎尚未确定。
- 不盲目重复相同样本；只有新方案、不同输入边界或用户指定真实样本时再做针对性验证。
- 保留翻译引擎切换设计；接入 client=gtx 必须等用户明确指令，不能自动切换。
- 钥匙串不再重复做空查询，待产品设置页完成后按用户输入凭据、保存、后续复用的流程测试。
- 验证页面保留给用户查看，本地验证扩展仍已加载；它不是产品插件。没有提交或推送 Git。
