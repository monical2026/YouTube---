// 原生浏览器验证夹具，直接运行，不依赖产品构建或第三方脚本。
const result = document.querySelector('#result');
const button = document.querySelector('#translate');
const samples = [
  { id: 'T01', category: '否定和操作顺序', text: 'Do not delete the original notes. Save the translation before switching videos.' },
  { id: 'T02', category: '数字与百分比', text: 'Revenue rose from 2.5 million dollars to 3 million dollars, an increase of 20 percent, not 50 percent.' },
  { id: 'T03', category: '访谈口语', text: "I mean, we were kind of winging it at first. But that does not mean we had no plan; we just kept changing it as we learned." },
  { id: 'T04', category: '否定范围', text: 'Not everyone who works hard succeeds, but that does not mean hard work is useless.' },
  { id: 'T05', category: '技术术语', text: 'A closure lets a function retain access to variables from its lexical scope, even after the outer function has returned.' },
  { id: 'T06', category: '条件与步骤', text: 'If the upload fails, retry only the failed part. Do not start over unless the saved progress is corrupted.' },
  { id: 'T07', category: '指代与上下文', text: 'Maya gave the proposal to Alex. He rejected it because its budget was too high, not because he disliked her idea.' },
  { id: 'T08', category: '习语与因果', text: 'We pulled the plug on the project. It was not a lack of demand; we had bitten off more than we could chew.' },
];
const report = {
  browser: navigator.userAgent,
  origin: location.origin,
  secureContext: isSecureContext,
  translatorAvailable: 'Translator' in globalThis,
  state: '等待用户点击',
};
function render() {
  const { samples: translations, ...status } = report;
  result.replaceChildren();
  const state = document.createElement('p');
  state.textContent = JSON.stringify(status, null, 2);
  result.append(state);
  for (const sample of translations ?? []) {
    const entry = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = `${sample.id}：${sample.category}`;
    const source = document.createElement('p');
    source.textContent = sample.text;
    const translation = document.createElement('p');
    translation.textContent = sample.translation;
    const timing = document.createElement('p');
    timing.textContent = `耗时：${sample.elapsedMs} ms`;
    entry.append(heading, source, translation, timing);
    result.append(entry);
  }
}
render();
button.addEventListener('click', async () => {
  button.disabled = true;
  let translator;
  try {
    if (!report.translatorAvailable) throw new Error('当前扩展文档没有 Translator API');
    const languages = { sourceLanguage: 'en', targetLanguage: 'zh' };
    report.state = '检测语言对';
    report.availability = await Translator.availability(languages);
    render();
    if (report.availability === 'unavailable') throw new Error('英中语言对不可用');
    translator = await Translator.create({
      ...languages,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          report.state = '下载翻译模型';
          report.downloadProgress = event.loaded;
          render();
        });
      },
    });
    report.state = '翻译中';
    render();
    const startedAt = performance.now();
    report.samples = [];
    for (const sample of samples) {
      const sampleStartedAt = performance.now();
      const translation = await translator.translate(sample.text);
      report.samples.push({ ...sample, translation, elapsedMs: Math.round(performance.now() - sampleStartedAt) });
      render();
    }
    report.elapsedMs = Math.round(performance.now() - startedAt);
    report.state = '调用完成；译文质量仍需人工核对';
  } catch (error) {
    report.state = '失败';
    report.error = error instanceof Error ? error.message : '未知错误';
  } finally {
    translator?.destroy();
    button.disabled = false;
    render();
  }
});
