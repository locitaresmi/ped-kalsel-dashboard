import { HashRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Ringkasan } from "./pages/Ringkasan";
import { KondisiEkonomi } from "./pages/KondisiEkonomi";
import { SubsektorUnggulan } from "./pages/SubsektorUnggulan";
import { KomoditasUsulan } from "./pages/KomoditasUsulan";
import { Pembiayaan } from "./pages/Pembiayaan";
import { Tentang } from "./pages/Tentang";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Ringkasan />} />
          <Route path="kondisi-ekonomi" element={<KondisiEkonomi />} />
          <Route path="subsektor-unggulan" element={<SubsektorUnggulan />} />
          <Route path="komoditas-usulan" element={<KomoditasUsulan />} />
          <Route path="pembiayaan" element={<Pembiayaan />} />
          <Route path="tentang" element={<Tentang />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
