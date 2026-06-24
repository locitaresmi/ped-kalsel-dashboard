export function Tentang() {
  return (
    <div>
      <h1 className="page-title">Tentang dasbor ini</h1>
      <p className="page-lede">
        Dibuat untuk pemerintah daerah, lembaga jasa keuangan, akademisi, dan siapa pun yang butuh
        gambaran cepat namun berdasar tentang kekuatan ekonomi tiap kabupaten/kota di Kalimantan
        Selatan. Pendekatannya mengikuti metode Kajian Program Pengembangan Ekonomi Daerah (PED) OJK.
        Semua angka diperbarui otomatis dari sumber resmi seperti BPS dan OJK, jadi yang kamu lihat
        selalu mengikuti rilis data terbaru
      </p>

      <h2 className="section-title">Cara membaca rekomendasi komoditas</h2>
      <p>
        Tiap komoditas dinilai dari tiga hal sederhana: produksinya termasuk besar di Kalsel,
        komoditasnya diekspor, dan sektornya termasuk unggulan di daerah itu. Makin banyak yang
        terpenuhi, makin tinggi posisinya dalam daftar. Komoditas yang tidak memenuhi satu pun tidak
        ditampilkan
      </p>
      <p>Tiap usulan diberi penanda dasar usulan supaya jelas seberapa kuat buktinya:</p>
      <ul className="daftar">
        <li>
          <strong>Data statistik resmi</strong> paling kuat, dari angka produksi dan ekspor BPS
          serta analisis subsektor unggulan
        </li>
        <li>
          <strong>Dokumen pemerintah</strong> berupa indikasi dari RPJMD, Bappeda, portal dinas,
          Indikasi Geografis, atau program KUR, belum ada angka statistik yang menyertainya
        </li>
        <li>
          <strong>Indikasi awal</strong> masih sinyal dari berita atau laporan, perlu dikonfirmasi di
          lapangan sebelum dijadikan dasar keputusan
        </li>
      </ul>
      <p>
        Kartu diurutkan dari bukti paling kuat di atas. Khusus dasar dokumen pemerintah dan indikasi
        awal, sinyalnya dikumpulkan dengan bantuan AI yang menelusuri dokumen pemerintah dan berita,
        lalu menautkan tiap usulan ke sumber aslinya yang bisa kamu buka sendiri. Bagian ini hanya
        melengkapi gambaran, dan tidak pernah mengubah usulan yang bersumber dari angka resmi
      </p>

      <h2 className="section-title">Cakupan metode Kajian PED</h2>
      <p>
        Dasbor ini mengikuti tahapan panduan Kajian PED OJK tahun 2026 (Bab 3.1). Bila panduannya
        diperbarui di kemudian hari, acuan dasbor ini tetap edisi 2026 sampai disesuaikan. Sebagian
        besar tahapan sudah tercakup otomatis, sebagian belum, dan yang belum ditandai apa adanya
      </p>
      <details className="detail-block">
        <summary>Lihat rincian cakupan per tahapan</summary>
        <ul className="daftar">
          <li>
            <strong>3.1.1 Kondisi sosio-ekonomi</strong>: ✓ PDRB dan struktur ekonomi, posisi Kalsel
            dibanding nasional dan se-Kalimantan, kesejahteraan (kemiskinan, Rasio Gini, IPM),
            inflasi, ketenagakerjaan (TPT/TPAK), serta keuangan daerah (rasio Transfer ke Daerah
            terhadap APBD, dari DJPK Kemenkeu)
          </li>
          <li>
            <strong>3.1.2 Sub-sektor unggulan</strong>: ✓ LQ-DLQ dan Shift-Share yang dipetakan ke
            tipologi Klassen, serta keterkaitan antar sektor (Forward dan Backward Linkage) dari
            Tabel Input-Output BPS. ⚠ Tabel Input-Output hanya terbit tahun 2016 dan berlaku selevel
            provinsi, jadi hasil FL-BL bersifat struktural dan sama untuk semua kabupaten/kota
          </li>
          <li>
            <strong>3.1.3 Pemilihan fokus</strong>: ✓ Agrikultur (skoring komoditas dan indikasi
            dari dokumen pemerintah). ⚠ Pariwisata dan ekonomi kreatif menyusul
          </li>
          <li>
            <strong>3.1.4 Kesesuaian inisiatif pemerintah</strong>: ✓ keselarasan komoditas unggulan
            dengan program resmi seperti MBG, hilirisasi RPJMD 2025-2029, dan klaster Banua Enam
          </li>
          <li>
            <strong>3.1.5 Kinerja lembaga jasa keuangan dan pembiayaan</strong>: ✓ kredit Bank Umum
            per sektor beserta kualitas kreditnya (NPL), DPK, rasio kredit terhadap DPK, serta BPR
            dan BPRS dari portal data OJK (halaman Pembiayaan). ⚠ Bank Umum Syariah belum dirinci per
            sektor
          </li>
          <li>
            <strong>3.1.6 Skema ekosistem</strong>: ⚠ bersifat kualitatif (tahap diskusi), di luar
            versi ini
          </li>
        </ul>
      </details>

      <h2 className="section-title">Sumber data</h2>
      <p>Datanya dari sumber resmi dan diperbarui otomatis:</p>
      <ul className="daftar">
        <li>
          <strong>BPS</strong> untuk PDRB dan struktur ekonomi, kesejahteraan, inflasi,
          ketenagakerjaan, ekspor, serta produksi pangan
        </li>
        <li>
          <strong>OJK</strong> (portal data SJKPublic) untuk kredit Bank Umum per sektor, kualitas
          kredit (NPL), DPK, serta BPR dan BPRS
        </li>
        <li>
          <strong>DJPK Kemenkeu</strong> (portal SIKD) untuk postur APBD daerah dan rasio
          ketergantungan pada transfer pusat
        </li>
        <li>
          <strong>KKP, Kementan, dan Ditjenbun</strong> untuk produksi perikanan dan perkebunan
        </li>
        <li>
          <strong>Dokumen pemerintah daerah</strong> (Indikasi Geografis DJKI, RPJMD, program KUR)
          sebagai indikasi dari dokumen pemerintah
        </li>
      </ul>
      <p>
        Hanya data Indikasi Geografis yang dikurasi manual karena registrinya belum
        punya antarmuka data yang bisa ditarik otomatis. Bagian itu diverifikasi per Juni 2026 dan
        diperbarui saat ada penetapan baru. Sisanya berjalan sendiri: saat BPS merilis tahun data
        baru, dasbor ikut terbarui tanpa disentuh
      </p>

      <h2 className="section-title">Keterbatasan</h2>
      <ul className="daftar">
        <li>
          Versi ini fokus pada <strong>agrikultur</strong>. Pariwisata dan ekonomi kreatif menyusul
        </li>
        <li>
          <strong>Kotabaru</strong> belum punya tabel PDRB rinci di BPS, jadi sengaja dikosongkan di
          peta
        </li>
        <li>
          Sebagian data, terutama <strong>ekspor dan sebagian produksi</strong>, hanya tersedia di
          tingkat provinsi, bukan per kabupaten/kota
        </li>
        <li>
          <strong>Produksi per kabupaten/kota di luar padi sering tertinggal</strong> (beberapa
          berhenti sekitar 2017). Tahun tiap angka selalu dicantumkan apa adanya supaya kamu tahu
          seberapa mutakhir datanya
        </li>
        <li>
          Produksi <strong>batu bara</strong> tidak ada di BPS (sumbernya di ESDM), jadi yang dipakai
          datanya ekspor
        </li>
        <li>
          Data <strong>pembiayaan dan kredit per sektor</strong> ditarik dari portal data OJK. Portal
          ini sesekali perlu beberapa kali percobaan, jadi pembaruan dijadwalkan dan bila gagal data
          terakhir tetap dipakai
        </li>
      </ul>

      <h2 className="section-title">Masukan</h2>
      <p>
        Dasbor ini terus disempurnakan, dan koreksi dari pembaca sangat membantu. Kalau menemukan
        data yang keliru, punya pertanyaan, atau ingin memberi masukan, hubungi tim penyusun melalui{" "}
        <a href="mailto:wening.dyah@ojk.go.id">wening.dyah@ojk.go.id</a>
      </p>

      <h2 className="section-title">Atribusi</h2>
      <p>
        Data © Badan Pusat Statistik (BPS) dan kementerian/lembaga terkait. Dasbor ini bukan
        produk resmi BPS atau OJK. Metodenya mengacu pada panduan Kajian PED OJK tahun 2026
      </p>
      <details className="detail-block">
        <summary>Catatan teknis untuk pengembang</summary>
        <div>
          <p>
            Situs statis dibangun dengan React + Vite dan di-host di Netlify. Data ditarik lewat
            loader Python (stdlib), di-commit ke repositori, lalu diperbarui terjadwal melalui GitHub
            Actions yang memicu build ulang Netlify. Kode domain BPS yang dipakai:
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sumber</th>
                <th>Domain BPS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PDRB lapangan usaha</td>
                <td>6300, 6301-6311/6371/6372, nasional 0000, + 5 provinsi Kalimantan</td>
              </tr>
              <tr>
                <td>Kesejahteraan</td>
                <td>6300 per kab/kota + nasional</td>
              </tr>
              <tr>
                <td>Inflasi</td>
                <td>6300 (Banjarmasin, Tanjung, Kotabaru, Tanah Laut, HST)</td>
              </tr>
              <tr>
                <td>Tenaga Kerja</td>
                <td>6300 (Sakernas Februari, Agustus, November)</td>
              </tr>
              <tr>
                <td>Ekspor-impor (nilai provinsi)</td>
                <td>6300 (nilai ekspor, impor, dan neraca bulanan Kalsel)</td>
              </tr>
              <tr>
                <td>Ekspor per komoditas (HS)</td>
                <td>Nasional, difilter pelabuhan muat Kalsel</td>
              </tr>
              <tr>
                <td>Produksi padi</td>
                <td>6300</td>
              </tr>
              <tr>
                <td>Produksi per kab/kota</td>
                <td>6301-6311/6371/6372 (sebagian data lama)</td>
              </tr>
              <tr>
                <td>Produksi tingkat provinsi</td>
                <td>Nasional (peringkat antar-provinsi)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
