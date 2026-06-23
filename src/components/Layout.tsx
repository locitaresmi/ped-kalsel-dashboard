import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useFilters } from "../hooks/useFilters";

const NAV = [
  { to: "/", label: "Ringkasan", end: true },
  { to: "/kondisi-ekonomi", label: "Kondisi Ekonomi" },
  { to: "/subsektor-unggulan", label: "Subsektor Unggulan" },
  { to: "/komoditas-usulan", label: "Komoditas Usulan" },
  { to: "/pembiayaan", label: "Pembiayaan" },
  { to: "/tentang", label: "Tentang" },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { carry } = useFilters();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
            <img
              src={`${import.meta.env.BASE_URL}ojk-logo.png`}
              className="brand-logo"
              alt="Otoritas Jasa Keuangan (OJK)"
            />
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-text">
              <span className="brand-title">PED Kalimantan Selatan</span>
              <span className="brand-sub">Pengembangan Ekonomi Daerah</span>
            </span>
          </NavLink>
          <button
            className="nav-toggle"
            aria-label="Buka menu"
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
          <nav className={`app-nav ${open ? "open" : ""}`}>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={`${n.to}${carry}`}
                end={n.end}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="accent-rule" />
        <Outlet />
      </main>

      <footer className="app-footer">
        Sumber: BPS, Kementan, DJKI · Mengikuti metode Kajian PED OJK ·{" "}
        <NavLink to="/tentang">Metodologi dan atribusi</NavLink>
      </footer>
    </div>
  );
}
