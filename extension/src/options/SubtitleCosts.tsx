import { SUPADATA_GENERATION_RATE } from '@youtube-note/shared';
import { ClearableInput } from './ClearableInput';
export function SubtitleCosts({
  rate,
  onRate,
}: {
  rate: number | null;
  onRate: (rate: number | null) => void;
}) {
  return (
    <section id="costs">
      <span className="eyebrow">按实际使用方式区分</span>
      <h2>字幕与费用</h2>
      <p>
        优先读取视频已有字幕。只有需要重新生成时，才按视频时长估算，并由你确认。
      </p>
      <div className="cost-table">
        <div>
          <strong>YouTube 已有字幕</strong>
          <span>不消耗服务额度</span>
          <small>插件直接读取；不会调用 Supadata。</small>
        </div>
        <div>
          <strong>Supadata 获取已有字幕</strong>
          <span>1 credit / 次</span>
          <small>
            使用 native 模式。返回字幕不可用（206）也可能扣 1 credit。
          </small>
        </div>
        <div>
          <strong>Supadata 生成字幕</strong>
          <span>{rate ?? SUPADATA_GENERATION_RATE} credits / 分钟</span>
          <small>
            使用 generate 模式。每个视频生成前单独确认；查询生成进度不扣额度。
          </small>
        </div>
      </div>
      <p className="field-help">
        credits
        是服务额度，不是人民币。套餐赠送额度也会被消耗。不会自动切换到生成模式。
      </p>
      <div className="button-group">
        <a
          className="quiet-link"
          href="https://supadata.ai/pricing"
          target="_blank"
          rel="noreferrer"
        >
          官方价格说明 ↗
        </a>
        <a
          className="quiet-link"
          href="https://dash.supadata.ai"
          target="_blank"
          rel="noreferrer"
        >
          查看我的额度 ↗
        </a>
      </div>
      <details>
        <summary>高级：调整生成费率</summary>
        <p className="field-help">
          官方参考值核对于 2026-09-11：{SUPADATA_GENERATION_RATE} credits /
          分钟。仅当套餐规则改变时修改；清空恢复参考值。预估按整分钟向上取整，最终以服务账单为准。
        </p>
        <ClearableInput
          label="自定义生成费率（credits / 分钟）"
          type="number"
          min="0.01"
          step="0.01"
          value={rate === null ? '' : String(rate)}
          placeholder={`默认 ${SUPADATA_GENERATION_RATE}，无需填写`}
          onValue={(value) => onRate(value ? Number(value) : null)}
        />
      </details>
    </section>
  );
}
