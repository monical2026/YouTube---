import { expect, it } from 'vitest';
import { answerHeading, answerSections } from '../../extension/src/ui/answer-sections';

it('回答小标题支持 Markdown、加粗、编号和同一行内容，正文不丢失', () => {
  const blocks = answerSections('### 摘录内容\n原文依据\n**通俗解释：** 像搭积木\n3. 准确概念：\n严格定义');
  expect(blocks.map(answerHeading).filter(Boolean)).toEqual(['摘录内容', '通俗解释', '准确概念']);
  expect(blocks.join('\n')).toContain('原文依据');
  expect(blocks.join('\n')).toContain('像搭积木');
  expect(blocks.join('\n')).toContain('严格定义');
});
it('普通句子和代码样式文字不冒充章节标题', () => {
  expect(answerHeading(answerSections('准确概念有助于理解问题。')[0])).toBeUndefined();
  expect(answerSections('<script>alert(1)</script>')).toEqual(['<script>alert(1)</script>']);
});
