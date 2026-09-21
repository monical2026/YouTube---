import { useId, useRef, type InputHTMLAttributes } from 'react';
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id'
> & {
  label: string;
  value: string;
  onValue: (value: string) => void;
};
export function ClearableInput({ label, value, onValue, ...props }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-control">
        <input
          {...props}
          ref={input}
          id={id}
          value={value}
          onChange={(event) => onValue(event.target.value)}
        />
        {!!value && !props.disabled && !props.readOnly && (
          <button
            className="clear-input"
            type="button"
            aria-label={`清空${label}`}
            title={`清空${label}`}
            onClick={() => {
              onValue('');
              input.current?.focus();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
