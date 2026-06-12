import type { ReactNode } from "react";

export function InfoTip({ teks }: { teks: string }) {
  return (
    <span className="info-tip" data-tip={teks} aria-label={teks}>
      ⓘ
    </span>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {title != null && <div className="card-title">{title}</div>}
      {subtitle != null && <div className="card-subtitle">{subtitle}</div>}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  info,
  value,
  children,
  context,
}: {
  label: ReactNode;
  info?: string;
  value: ReactNode;
  children?: ReactNode;
  context?: ReactNode;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
        {info ? <InfoTip teks={info} /> : null}
      </div>
      <div className="kpi-value">{value}</div>
      {children}
      {context != null && <div className="kpi-context">{context}</div>}
    </div>
  );
}

export function HeroNote({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "warning";
}) {
  return <div className={variant === "warning" ? "hero-note small" : "hero-note"}>{children}</div>;
}

type TierKey = "A" | "B" | "C";
const TIER_INFO: Record<TierKey, [string, string, string]> = {
  A: ["badge-a", "Tier A", "Data terverifikasi dari BPS. Angka produksi dan ekspor tersedia secara resmi."],
  B: ["badge-b", "Tier B", "Indikasi resmi dari dokumen pemerintah (ST2023, Indikasi Geografis DJKI, RPJMD, atau program KUR). Belum ada data produksi terverifikasi dari BPS."],
  C: ["badge-c", "Tier C", "Sinyal awal dari sumber berita atau laporan. Perlu verifikasi lebih lanjut sebelum dijadikan dasar keputusan."],
};

export function BadgeTier({ tier }: { tier: string }) {
  const [cls, label, tip] = TIER_INFO[(tier as TierKey)] ?? ["badge-na", tier, ""];
  return (
    <span className={`badge ${cls}`} data-tip={tip}>
      {label}
    </span>
  );
}
