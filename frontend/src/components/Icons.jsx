// Icons drawn to match the rest of the interface (thick rounded outlines,
// currentColor so they follow light/dark mode).

/** The menu button: a rounded square holding three bars. Used to collapse and
 * expand the side menu, and to open it on phones. */
export function MenuSquareIcon({ size = 26, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="7" />
      <path d="M10 12h12M10 16h12M10 20h12" />
    </svg>
  );
}

/** A sheet of paper with an arrow going up — "uploading a file". */
export function UploadFileIcon({ size = 40, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M11 4h13l8 8v21a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
      <path d="M24 4v8h8" />
      <path d="M20 29V18M15.5 22.5 20 18l4.5 4.5" />
    </svg>
  );
}

/** A cross inside the same rounded square as the menu icon: "close the menu". */
export function CloseSquareIcon({ size = 26, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="7" />
      <path d="M11 11l10 10M21 11 11 21" />
    </svg>
  );
}

export const SignInIcon = ({ width = 20, height = 20, ...props }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 17l5-5-5-5M15 12H3M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
  </svg>
);

export const BadgeIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="8" r="5" />
    <path d="M8 12l-2 9 6-3 6 3-2-9" />
  </svg>
);

export const UserIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
  </svg>
);

export const EyeIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
