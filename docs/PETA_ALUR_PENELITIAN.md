# Peta Alur Penelitian → Kode ExpertGym

Dokumen ini menghubungkan **setiap kotak** pada diagram alur penelitian
(metodologi skripsi) ke lokasi kode yang sesuai di project ini, supaya saat
sidang bisa langsung ditunjukkan: *"tahap ini ada di file ini, baris ini"*.

Enam tahap pada diagram: **Pengumpulan Data → Analisis Kebutuhan Sistem →
Perancangan Sistem → Implementasi Sistem → Pengujian Sistem → Analisis dan
Evaluasi.**

Catatan penting: tiga tahap pertama (Pengumpulan Data, Analisis Kebutuhan
Sistem, sebagian Perancangan Sistem) pada dasarnya adalah tahap **desain**
yang hasilnya dituliskan di dokumen skripsi (BAB III), bukan berupa kode.
Namun beberapa keluarannya *diimplementasikan langsung* menjadi artefak
kode (mis. ERD → `schema.sql`, Desain Antarmuka → `index.html`+`css/`,
Perancangan Basis Pengetahuan → `js/forward-chaining.js`) — hubungan ini
ditandai di bawah dengan **"→ diimplementasikan di:"**.

---

## 1. Pengumpulan Data

| Kotak diagram | Keterangan | Lokasi terkait di kode |
|---|---|---|
| Studi pustaka | Kajian literatur, tidak berbentuk kode | — (BAB II skripsi) |
| Wawancara Personal Trainer | Menghasilkan basis aturan keamanan (KR-01..KR-12) | → diimplementasikan di: `js/forward-chaining.js` fungsi `computeF18()` |
| Pengumpulan Dataset Kaggle | Dataset mentah `megaGymDataset.csv` (2.918 baris) | → hasil akhirnya (setelah pra-pemrosesan) disimpan di `js/dataset.js` |
| Penyusunan Fakta | Menetapkan fakta F1–F19 (variabel input/output sistem pakar) | → direpresentasikan sebagai `state.f1`..`state.f19` di `js/app.js` (bagian STATE, baris ±48) |
| Penyusunan Aturan IF-THEN | Basis aturan R-L01..R-L30 & KR-01..KR-12 | → diimplementasikan di: `js/forward-chaining.js` |
| Perancangan Metode Inferensi Forward Chaining | Strategi pencocokan Tahap 1 (skoring) + Tahap 2 (validasi keamanan) | → diimplementasikan di: `js/forward-chaining.js` (`compute()` + `computeF18()`) |

## 2. Analisis Kebutuhan Sistem

| Kotak diagram | Keterangan | Lokasi terkait di kode |
|---|---|---|
| Identifikasi Kebutuhan Sistem | — | — (BAB III skripsi) |
| Analisis Kebutuhan Fungsional | Login/Register, Asesmen, Rekomendasi, Riwayat, Favorit, Workout Log, Kelola Latihan (Admin), Kelola Trainer (Admin) | → tiap kebutuhan fungsional = 1 modul: lihat tabel *Modul Fitur* di bagian 4 (Implementasi Sistem) di bawah |
| Analisis Kebutuhan Non-fungsional | Keamanan (password hash), performa, kompatibilitas browser | → `bcryptjs` di `backend/db.js`/`backend/routes/*`, CORS+limit body di `backend/server.js` |
| Kebutuhan Perangkat Keras & Perangkat Lunak | Node.js, Express, MySQL, browser | → `backend/package.json`, `backend/.env.example`, `backend/README.md` |

## 3. Perancangan Sistem

| Kotak diagram | Keterangan | Lokasi terkait di kode |
|---|---|---|
| Flowchart | Alur proses asesmen → rekomendasi | — (BAB III skripsi) |
| DFD | Diagram alir data | — (BAB III skripsi) |
| ERD | Relasi antar tabel (`admin`, `user`, `data_latihan`, `favorit`, `riwayat_rekomendasi`, `workout_log`) | → diimplementasikan di: `backend/schema.sql` dan tiap `backend/routes/*.js` (query SQL mengikuti struktur ERD) |
| Desain Antarmuka | Tampilan/UI seluruh halaman | → diimplementasikan di: `index.html`, `css/style.css`, `css/responsive.css` |
| Perancangan Basis Pengetahuan | Struktur basis aturan sistem pakar | → diimplementasikan di: `js/forward-chaining.js` (array `rules` di `compute()`, kondisi IF-THEN di `computeF18()`) |

## 4. Implementasi Sistem

### 4a. Pra-pemrosesan Data
Seluruh 4 langkah berikut sudah dilakukan pada dataset final, dan
didokumentasikan lengkap di **komentar header `js/dataset.js`** (baris 1–33):

| Kotak diagram | Lokasi kode |
|---|---|
| Data Cleaning | `js/dataset.js` (header: 2.918 → 2.886 data, baris dgn field kosong dibuang) |
| Seleksi Atribut | `js/dataset.js` (header: hanya Title, Desc, Type, BodyPart, Equipment, Level dipakai) |
| Normalisasi Data | `js/dataset.js` (header: casing diseragamkan, duplikat/`Other`/`Foam Roll` dibuang → 2.612 data final) |
| Translasi Deskripsi Latihan | `js/dataset.js` (header: deskripsi Bahasa Indonesia per latihan, field `Desc` tiap objek) |

### 4b. Pengembangan Sistem

| Kotak diagram | Lokasi kode |
|---|---|
| Implementasi Website | `index.html`, `css/*.css`, seluruh `js/*.js` (kecuali `dataset.js` & `forward-chaining.js`), `backend/server.js`, `backend/routes/*.js` |
| Implementasi Forward Chaining | **`js/forward-chaining.js`** — `compute()` (Tahap 1: skoring + R-L01–R-L30) dan `computeF18()` (Tahap 2: validasi keamanan KR-01–KR-12). Dipanggil dari `js/app.js` fungsi `runInference()` (dipicu dari `processAsesmen()`) |

**Modul Fitur (Implementasi Website), per kebutuhan fungsional:**

| Fitur | Frontend | Backend |
|---|---|---|
| Login/Register/Logout | `js/auth.js`, `js/secure-auth.js` | `backend/routes/admin.js`, `backend/routes/user.js`, `backend/routes/auth.js`, `backend/middleware/auth.js`, `backend/store/sessions.js` |
| Asesmen & Rekomendasi (mesin pakar) | `js/app.js` (`processAsesmen()` baris 497, `renderStep2()` baris 624, `generateReco()` baris 1151, `renderResults()` baris 1242) | `backend/routes/exercises.js` (sumber data tambahan admin) |
| Riwayat Rekomendasi | `js/riwayat.js` | `backend/routes/riwayat.js` |
| Favorit | `js/favorite.js` | `backend/routes/favorites.js` |
| Workout Log | `js/wlog.js`, `js/workout-log.js` | `backend/routes/wlog.js` |
| Kelola Data Latihan (Admin) | `js/exercise.js`, `js/admin.js` | `backend/routes/exercises.js` |
| Kelola Personal Trainer (Admin) | `js/trainer.js` | `backend/routes/trainers.js` |
| Navigasi/UX pendukung | `js/focus-navigation.js` | — |
| Dataset latihan bawaan | `js/dataset.js` | — |
| Koneksi & skema database | — | `backend/db.js`, `backend/schema.sql` |
| Entry point server | — | `backend/server.js` |

## 5. Pengujian Sistem

| Kotak diagram | Keterangan | Lokasi terkait |
|---|---|---|
| Black Box Testing | Uji fungsional tiap fitur (lihat tabel Modul Fitur di atas) berdasarkan input/output, tanpa melihat kode internal | — (hasil uji dituliskan di BAB IV skripsi sebagai tabel kasus uji) |
| Pengujian Logika Forward Chaining | Verifikasi `compute()`/`computeF18()` menghasilkan level & status yang benar untuk tiap kombinasi fakta F1–F19 | Basis aturan yang diuji: `js/forward-chaining.js` (array `rules` R-L01–R-L30, kondisi KR-01–KR-12) |
| Validasi Hasil Rekomendasi oleh Personal Trainer | Validasi manual/lapangan, tidak berbentuk kode | — (hasil dituliskan di BAB IV skripsi) |

> Catatan: project ini belum memiliki folder `tests/` otomatis (unit test).
> Kalau dosen meminta bukti pengujian logika Forward Chaining yang lebih
> konkret di kode (bukan hanya tabel di BAB IV), beri tahu saya — saya bisa
> buatkan skrip pengujian sederhana yang menjalankan `compute()`/
> `computeF18()` dengan berbagai kombinasi F1–F19 dan mencocokkan hasilnya
> ke tabel kasus uji.

## 6. Analisis dan Evaluasi

Seluruhnya berupa analisis naratif hasil pengujian pada BAB IV/V skripsi —
tidak berbentuk kode:

- Analisis Hasil Pengujian
- Analisis Validasi Personal Trainer
- Evaluasi Sistem
- Kelebihan dan Keterbatasan Sistem

---

## Ringkasan Struktur Folder Setelah Dirapikan

```
expertgym/
├─ PETA_ALUR_PENELITIAN.md   ← dokumen ini
├─ index.html                 ← Desain Antarmuka → Implementasi Website
├─ css/
│   ├─ style.css               Desain Antarmuka → Implementasi Website
│   └─ responsive.css          Desain Antarmuka → Implementasi Website
├─ js/
│   ├─ dataset.js              Pengumpulan Data + Pra-pemrosesan Data
│   ├─ forward-chaining.js     Perancangan Basis Pengetahuan → Implementasi Forward Chaining  ★ BARU (dipisah dari app.js)
│   ├─ app.js                  Implementasi Website (state, UI, orkestrasi; MEMANGGIL forward-chaining.js)
│   ├─ auth.js / secure-auth.js   Implementasi Website — Login/Register/Logout
│   ├─ exercise.js / admin.js     Implementasi Website — Kelola Data Latihan
│   ├─ trainer.js                 Implementasi Website — Kelola Personal Trainer
│   ├─ favorite.js                Implementasi Website — Favorit
│   ├─ riwayat.js                 Implementasi Website — Riwayat Rekomendasi
│   ├─ wlog.js / workout-log.js   Implementasi Website — Workout Log
│   └─ focus-navigation.js        Implementasi Website — UX pendukung
└─ backend/
    ├─ server.js                Implementasi Website (entry point API)
    ├─ db.js                     Implementasi Website (koneksi DB) ← ERD
    ├─ schema.sql                 ERD (Perancangan Sistem) → Implementasi Website
    ├─ middleware/auth.js         Implementasi Website (autentikasi)
    ├─ store/sessions.js          Implementasi Website (sesi login)
    └─ routes/*.js                Implementasi Website (satu file = satu fitur, lihat tabel Modul Fitur)
```

**Perubahan kode yang dilakukan saat merapikan (selain menambah komentar):**
Fungsi `compute()` dan `computeF18()` — basis aturan Forward Chaining —
dipindahkan **apa adanya** (tanpa mengubah logika) dari `js/app.js` ke file
baru `js/forward-chaining.js`, supaya mesin inferensi berdiri sebagai satu
modul terpisah yang persis mencerminkan kotak *"Implementasi Forward
Chaining"* di diagram alur penelitian. File baru ini dimuat di `index.html`
sebelum `app.js`, sehingga seluruh pemanggilan fungsi tetap berjalan sama
seperti sebelumnya.
