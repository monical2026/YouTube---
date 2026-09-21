export function LoadingView({
  label,
  progress,
}: {
  label: string;
  progress: number | null;
}) {
  const value = progress === null ? null : Math.max(0, Math.min(1, progress));
  return (
    <section
      className="loading-stage"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-content">
        <div className="loading-mark" aria-hidden="true">
          ▶
        </div>
        <h2>{label}</h2>
        <p>正在为你准备这段视频的学习内容</p>
        <div
          className="loading-track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value === null ? undefined : Math.round(value * 100)}
        >
          <span
            className={value === null ? 'indeterminate' : ''}
            style={value === null ? undefined : { width: `${value * 100}%` }}
          />
        </div>
        <small>
          {value === null
            ? '处理中，请稍候'
            : `已完成 ${Math.round(value * 100)}%`}
        </small>
        <div className="loading-skeleton" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
  );
}
