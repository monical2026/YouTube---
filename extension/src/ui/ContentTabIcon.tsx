export function ContentTabIcon({
  kind,
}: {
  kind: 'transcript' | 'analysis' | 'notes';
}) {
  return (
    <svg
      className="content-tab-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'transcript' ? (
        <path d="M3 9v6M7.5 5v14M12 2v20M16.5 5v14M21 9v6" />
      ) : kind === 'analysis' ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="0.5" />
          <rect x="14" y="3" width="7" height="7" rx="0.5" />
          <rect x="3" y="14" width="7" height="7" rx="0.5" />
          <rect x="14" y="14" width="7" height="7" rx="0.5" />
        </>
      ) : (
        <>
          <path d="M6 2h8l4 4v16H6Z" />
          <path d="M14 2v5h4M9 11h6M9 15h6M9 18h6" />
        </>
      )}
    </svg>
  );
}
