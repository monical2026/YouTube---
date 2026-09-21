import { useEffect, useState } from 'react';
import { errorText } from '../lib/rpc';
export const defaultAnswerInstructions =
  '先结合摘录直接回答问题，再按需要分成“摘录内容、通俗解释、准确概念、具体例子、适用边界”。解释关键术语，例子尽量具体；说明结论成立的条件和常见误区。区分摘录依据与补充知识，资料不足就说明缺少什么，不重复大段摘录，不为凑栏目添加无关内容。';
const storageKey = 'answerInstructions';
export function AnswerSettings({
  value,
  onChange,
  disabled,
  onReady,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onReady: (ready: boolean) => void;
}) {
  const [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void chrome.storage.local
      .get(storageKey)
      .then((stored) => {
        if (!active) return;
        const text: unknown = stored[storageKey];
        if (typeof text === 'string' && text.length <= 2000) onChange(text);
        else if (text !== undefined)
          setStatus('已保存的设定格式异常，本次使用内置要求。');
      })
      .catch((e) => {
        if (active) setStatus(errorText(e));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          onReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [onChange, onReady]);
  async function saveDefault() {
    try {
      await chrome.storage.local.set({ [storageKey]: value });
      setStatus('已保存为默认回答要求');
    } catch (e) {
      setStatus(errorText(e));
    }
  }
  return (
    <details className="answer-settings">
      <summary>回答设定</summary>
      <p className="muted">
        编辑后用于本次提问；保存为默认后供之后的提问使用，不改变已有回答。
      </p>
      <label>
        希望 AI 怎样回答
        <textarea
          aria-label="回答要求"
          maxLength={2000}
          value={value}
          disabled={disabled || loading}
          onChange={(e) => {
            onChange(e.target.value);
            setStatus('本次提问将使用当前要求');
          }}
        />
      </label>
      <div className="row">
        <button
          disabled={disabled || loading}
          onClick={() => void saveDefault()}
        >
          保存为默认
        </button>
        <button
          disabled={disabled || loading}
          onClick={() => {
            onChange(defaultAnswerInstructions);
            setStatus('已恢复内置要求；保存为默认后才会替换已保存的设定');
          }}
        >
          恢复内置要求
        </button>
      </div>
      <small role="status">
        {status ||
          (loading
            ? '正在读取默认设定…'
            : '设定只保存在本机，发送问题时附给当前模型。')}
      </small>
    </details>
  );
}
