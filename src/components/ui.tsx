import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFilters } from "../hooks/useFilters";
import { useSourceStatus } from "./DataStatus";

const _BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tglID(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${_BULAN_SINGKAT[d.getMonth()]} ${d.getFullYear()}`;
}

export function LangkahLanjut({ teks, aksi, to }: { teks: ReactNode; aksi: string; to: string }) {
  const { carry } = useFilters();
  return (
    <div className="langkah-lanjut">
      <span className="ll-teks">{teks}</span>
      <Link className="btn-cta" to={`${to}${carry}`}>
        {aksi}
      </Link>
    </div>
  );
}

export function InfoTip({ teks }: { teks: string }) {
  return (
    <span className="info-tip" data-tip={teks} aria-label={teks}>
      ⓘ
    </span>
  );
}

export type Freshness = "otomatis" | "berkala" | "ai";

const FRESH_INFO: Record<Freshness, [string, string]> = {
  otomatis: [
    "Diperbarui otomatis",
    "Ditarik otomatis dari sumber data resmi (API BPS atau portal data OJK/DJPK) dan diperbarui terjadwal mengikuti rilis terbaru",
  ],
  berkala: [
    "Rilis berkala",
    "Ditarik otomatis dari BPS, tetapi tabel ini hanya dirilis secara berkala sehingga tahun datanya bisa lama. Yang ditampilkan adalah rilis terbaru yang tersedia",
  ],
  ai: [
    "Dirangkum otomatis (AI)",
    "Diekstraksi otomatis dari dokumen resmi (RPJMD, Bappeda, Indikasi Geografis) lewat GitHub Actions dan model AI, lalu diperbarui terjadwal",
  ],
};

export interface SumberInfo {
  sumber: string;
  periode?: string;
  tipe?: Freshness;
  url?: string;
  urlLabel?: string;
  kunci?: string;
  takResmi?: boolean;
}

export function SumberData({ sumber, periode, tipe = "otomatis", url, urlLabel, kunci, takResmi }: SumberInfo) {
  const ss = useSourceStatus(kunci);
  const stale = ss?.status === "stale";
  const takada = ss?.status === "unavailable";

  let badgeCls: string = tipe;
  let badge: string;
  let tip: string;
  if (takada) {
    badgeCls = "takada";
    badge = "Data tidak tersedia";
    tip =
      "Sumber ini sedang tidak dapat diakses dan belum ada data tersimpan sebelumnya" +
      (ss?.reason ? `. ${ss.reason}` : "");
  } else if (stale) {
    badgeCls = "tertunda";
    badge = "Pembaruan tertunda";
    tip =
      "Pembaruan otomatis sempat terkendala, yang ditampilkan adalah data terakhir yang valid dan tetap sahih sebagai referensi" +
      (ss?.last_ok ? `. Terakhir berhasil ${tglID(ss.last_ok)}` : "");
  } else {
    [badge, tip] = FRESH_INFO[tipe];
  }

  return (
    <div className="sumber-data">
      <span className="sd-src">
        Sumber: <strong>{sumber}</strong>
        {takResmi && (
          <InfoTip teks="Portal data publik tanpa API resmi terdokumentasi (OJK/DJPK), diakses dari antarmuka portalnya. Pembaruan bergantung ketersediaan portal" />
        )}
        {periode ? ` · ${periode}` : ""}
      </span>
      <span className={`sd-fresh ${badgeCls}`} data-tip={tip}>
        {badge}
      </span>
      {url && !stale && !takada && (
        <a className="sd-link" href={url} target="_blank" rel="noopener">
          {urlLabel ?? "Lihat sumber"}
        </a>
      )}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
  sumber,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  sumber?: SumberInfo;
}) {
  return (
    <div className={`card ${className}`}>
      {title != null && <div className="card-title">{title}</div>}
      {subtitle != null && <div className="card-subtitle">{subtitle}</div>}
      {children}
      {sumber && <SumberData {...sumber} />}
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
