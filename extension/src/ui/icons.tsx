export function Icon({ kind }: { kind: 'thought' | 'question' | 'settings' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {kind === 'thought' ? (
        <>
          <g strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M8 17c0-2-3-3.2-3-7a7 7 0 0 1 14 0c0 3.8-3 5-3 7Z"
              fill="#FFE77A"
              stroke="#E5A51C"
            />
            <path
              d="M8 17h8v2H8Zm1 2h6v1a3 2 0 0 1-6 0Z"
              fill="#C8CFD1"
              stroke="#68747B"
            />
            <path d="M2 7 1 6m1 6H.8M22 7l1-1m-1 6h1.2" stroke="#FFC83D" />
            <path d="M9.3 8.6v1.2m5.4-1.2v1.2" stroke="#72501A" />
            <path d="M10 12q2 2.4 4 0" stroke="#72501A" strokeWidth="1.5" />
          </g>
        </>
      ) : kind === 'question' ? (
        <>
          <g strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M12 2C5.5 2 2 5.6 2 11c0 2.5.7 4.1 2 5.7L2.5 21l5-1.7c1.4.5 2.9.7 4.5.7 6.5 0 10-3.4 10-9S18.5 2 12 2Z"
              fill="#FFD1DC"
              stroke="none"
            />
            <path
              d="M9.2 7.5c.5-2.5 5.8-2.5 5.8.5 0 2-3 2.1-3 4.4"
              stroke="#F34F65"
              strokeWidth="2.6"
            />
            <circle cx="12" cy="16" r="1.35" fill="#F34F65" stroke="none" />
            <path
              d="m5.5 13-.6 1.4m2.3-1.4-.6 1.4m11.2-1.4-.6 1.4m2.3-1.4-.6 1.4"
              stroke="#F48DA4"
              strokeWidth="1.2"
            />
          </g>
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="3" />
          <path
            strokeLinejoin="round"
            d="M18.744 9.206L19.140 10.482L21.356 10.350L21.356 13.650L19.140 13.518L18.744 14.794L18.744 14.794L18.122 15.976L19.782 17.449L17.449 19.782L15.976 18.122L14.794 18.744L14.794 18.744L13.518 19.140L13.650 21.356L10.350 21.356L10.482 19.140L9.206 18.744L9.206 18.744L8.024 18.122L6.551 19.782L4.218 17.449L5.878 15.976L5.256 14.794L5.256 14.794L4.860 13.518L2.644 13.650L2.644 10.350L4.860 10.482L5.256 9.206L5.256 9.206L5.878 8.024L4.218 6.551L6.551 4.218L8.024 5.878L9.206 5.256L9.206 5.256L10.482 4.860L10.350 2.644L13.650 2.644L13.518 4.860L14.794 5.256L14.794 5.256L15.976 5.878L17.449 4.218L19.782 6.551L18.122 8.024L18.744 9.206Z"
          />
        </>
      )}
    </svg>
  );
}
