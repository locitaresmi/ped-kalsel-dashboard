import { Link, useLocation } from "react-router-dom";

const TAUTAN = [
  { to: "/", label: "Ringkasan" },
  { to: "/kondisi-ekonomi", label: "Kondisi Ekonomi" },
  { to: "/subsektor-unggulan", label: "Subsektor Unggulan" },
  { to: "/komoditas-usulan", label: "Komoditas Usulan" },
  { to: "/pembiayaan", label: "Pembiayaan" },
];

export function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="notfound">
      <span className="notfound-kode">404</span>
      <h1 className="page-title">Halaman tidak ditemukan</h1>
      <p className="page-lede">
        Alamat <code>{pathname}</code> tidak ada di dasbor ini. Mungkin tautannya salah ketik, sudah
        berubah, atau halamannya belum tersedia
      </p>
      <Link className="btn-cta" to="/">
        Kembali ke Ringkasan
      </Link>
      <div className="notfound-tautan">
        <span className="muted">Atau buka halaman lain:</span>
        <ul>
          {TAUTAN.map((t) => (
            <li key={t.to}>
              <Link to={t.to}>{t.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
