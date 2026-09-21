import { useState } from 'react';
export function SettingsNav() {
  const [active, setActive] = useState('connections');
  return (
    <nav aria-label="设置分类">
      <span className="nav-caption">偏好与连接</span>
      {(
        [
          ['connections', '服务连接', '01'],
          ['routing', '模型分工', '02'],
          ['costs', '字幕与费用', '03'],
          ['translation', '普通翻译', '04'],
          ['shortcuts', '快捷键', '05'],
          ['component', '本机组件', '06'],
        ] as const
      ).map(([id, label, number]) => (
        <button
          key={id}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => {
            setActive(id);
            document
              .getElementById(id)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <span aria-hidden="true">{number}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
