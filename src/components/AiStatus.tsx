import { useEffect, useState } from "react";

export interface AiStatus {
  status?: "ok" | "failed" | "partial";
  error_type?: string | null;
  api_provider?: string;
  model?: string;
  generated_at?: string;
  checked_at?: string;
  failed_at?: string | null;
  total?: number;
  ok_count?: number;
  failed_count?: number;
  last_successful_run?: string | null;
  action_required?: string | null;
  topup_url?: string | null;
}

const STALE_HARI = 240;
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function bulanTahun(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function umurHari(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export type AiKeadaan = "ok" | "gagal" | "lama";

export function aiKeadaan(s?: AiStatus | null): AiKeadaan {
  if (s && (s.status === "failed" || s.status === "partial")) return "gagal";
  const umur = umurHari(s?.generated_at);
  if (umur != null && umur > STALE_HARI) return "lama";
  return "ok";
}

export function useAiStatus(): AiStatus | null {
  const [s, setS] = useState<AiStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/ai_status.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setS(d))
      .catch(() => alive && setS(null));
    return () => {
      alive = false;
    };
  }, []);
  return s;
}

export function AiInlinePlaceholder() {
  return (
    <div className="ai-inline">
      <span className="ai-inline-ikon" aria-hidden="true">⚠</span>
      <span className="ai-inline-teks">
        Analisis pasar dan gambaran ekosistem sedang tidak tersedia. Data statistik di atas tetap valid
      </span>
    </div>
  );
}

function DetailTeknis({ status }: { status: AiStatus }) {
  const baris: [string, string | number | null | undefined][] = [
    ["error_type", status.error_type],
    ["api_provider", status.api_provider],
    ["model", status.model],
    ["failed_at", status.failed_at],
    ["terdampak", status.total != null ? `${status.failed_count ?? 0} dari ${status.total} komoditas` : null],
    ["run_sukses_terakhir", status.last_successful_run],
    ["action_required", status.action_required],
  ];
  const url = status.topup_url
    ? status.topup_url.startsWith("http")
      ? status.topup_url
      : `https://${status.topup_url}`
    : null;
  return (
    <details className="ai-detail">
      <summary>Detail teknis (untuk pengelola)</summary>
      <div className="ai-maintainer">
        <div className="ai-mb-head">Pembuatan analisis AI gagal</div>
        {baris
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => (
            <div key={k}>
              <span className="ai-mb-key">{k}:</span> <span className="ai-mb-val">{String(v)}</span>
            </div>
          ))}
        {url && (
          <div>
            <span className="ai-mb-key">topup_url:</span>{" "}
            <a href={url} target="_blank" rel="noopener" className="ai-mb-link">
              {status.topup_url}
            </a>
          </div>
        )}
      </div>
    </details>
  );
}

export function AiStatusBanner({ status }: { status?: AiStatus | null }) {
  const keadaan = aiKeadaan(status);
  if (keadaan === "ok") return null;

  if (keadaan === "lama") {
    return (
      <div className="ai-note">
        Analisis konteks pasar dan gambaran ekosistem terakhir diperbarui{" "}
        <strong>{bulanTahun(status?.generated_at)}</strong>. Data statistik resmi BPS dan OJK tetap
        diperbarui otomatis seperti biasa, pembaruan analisis dijadwalkan berkala
      </div>
    );
  }

  const err = status?.error_type;
  const pesan =
    err === "rate_limit" || err === "timeout"
      ? "Layanan analisis sedang sibuk sehingga sebagian gambaran ekosistem belum dapat dimuat. Data statistik resmi BPS, kriteria OJK, dan data ekspor tetap ditampilkan seperti biasa, dan akan kembali lengkap pada pembaruan berikutnya"
      : "Gambaran ekosistem dan analisis pasar per komoditas sedang dalam pembaruan berkala. Data statistik resmi BPS, kriteria OJK, dan data ekspor tetap ditampilkan seperti biasa";

  return (
    <div className="ai-banner">
      <span className="ai-banner-ikon" aria-hidden="true">⚠</span>
      <div className="ai-banner-isi">
        <div className="ai-banner-judul">Sebagian analisis komoditas belum tersedia</div>
        <p className="ai-banner-teks">{pesan}</p>
        {status && <DetailTeknis status={status} />}
      </div>
    </div>
  );
}
