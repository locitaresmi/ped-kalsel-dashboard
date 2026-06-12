import type { ReactNode } from "react";

const wrap = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const ECO_ICONS: Record<string, ReactNode> = {

  hulu: wrap(<>
    <path d="M12 21v-7" />
    <path d="M12 14c0-3 2.5-5 6-5 0 3-2.5 5-6 5z" />
    <path d="M12 14c0-2.5-2-4.5-5-4.5 0 2.5 2 4.5 5 4.5z" />
  </>),

  offtaker: wrap(<>
    <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
    <path d="M3 7l1.5-3h15L21 7a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0z" />
    <path d="M10 20v-5h4v5" />
  </>),

  pembiayaan: wrap(<>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.4-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5" />
  </>),

  asistensi: wrap(<>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.2-2.2 2.6-2.6z" />
  </>),

  program: wrap(<>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
    <path d="M15 8a4 4 0 0 1 0 8" />
  </>),

  gap: wrap(<>
    <path d="M12 4l9 16H3L12 4z" />
    <path d="M12 10v4M12 17.5v.5" />
  </>),
};

export function EcoIcon({ name }: { name: string }) {
  return <>{ECO_ICONS[name] ?? null}</>;
}
