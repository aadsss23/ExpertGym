# ExpertGym — Backend Login / Register / Logout (MySQL + phpMyAdmin)

Backend ini menyediakan API nyata (Node.js + Express + **MySQL**) untuk fitur
**Login**, **Register**, dan **Logout** pada website ExpertGym, tanpa mengubah
sedikit pun tampilan, struktur folder, atau file HTML/CSS/JS frontend yang
sudah ada. Cocok untuk penggunaan oleh banyak orang karena data tersimpan di
server MySQL yang bisa diakses/dikelola lewat **phpMyAdmin**.

## Struktur proyek

```
expertgym/
├─ index.html            ← frontend (tidak diubah strukturnya)
├─ css/                  ← frontend (tidak diubah)
├─ js/
│   ├─ app.js, admin.js, dataset.js, focus-navigation.js  (tidak diubah)
│   ├─ auth.js            ← file lama (tidak diubah sama sekali, tetap ada)
│   ├─ secure-auth.js     ← BARU. Login Admin & Registrasi/Login User (backend)
│   ├─ exercise.js         ← Kelola Data Latihan (backend, sudah ada sebelumnya)
│   ├─ favorite.js         ← BARU. Favorit (backend), dimuat setelah exercise.js
│   ├─ riwayat.js          ← BARU. Riwayat Rekomendasi (backend)
│   ├─ wlog.js             ← file lama (tidak diubah), Workout Log (UI)
│   └─ workout-log.js      ← BARU. Workout Log (backend), dimuat setelah wlog.js
└─ backend/               ← seluruh kode server (terpisah rapi dari frontend)
    ├─ server.js           Entry point Express (serve API + file statis)
    ├─ db.js                Koneksi pool MySQL + auto-create tabel (admin, user) + seed akun
    ├─ schema.sql            Skema SQL (opsional, bisa diimport via phpMyAdmin)
    ├─ store/sessions.js     Sesi login (in-memory, bukan tabel — lihat catatan di bawah)
    ├─ middleware/auth.js    Verifikasi token sesi & pembatasan role
    ├─ routes/admin.js       Login/Logout/Cek Status Admin
    ├─ routes/user.js        Registrasi/Login/Logout/Cek Session User
    ├─ routes/exercises.js   Kelola Data Latihan (CRUD + search + filter)
    ├─ routes/favorites.js   Favorit (tambah/hapus/daftar/cek)
    ├─ routes/riwayat.js     Riwayat Rekomendasi (simpan/daftar/detail/hapus)
    ├─ routes/wlog.js        Workout Log (simpan/daftar/detail/hapus progres)
    ├─ routes/auth.js        Jembatan kompatibilitas GET /me untuk js/auth.js lama
    ├─ .env.example          Contoh konfigurasi koneksi database
    └─ package.json
```

---

## Langkah 1 — Install MySQL + phpMyAdmin

Cara termudah di Windows: install **XAMPP** (sudah termasuk MySQL/MariaDB
dan phpMyAdmin sekaligus).

1. Unduh XAMPP di https://www.apachefriends.org/ lalu install.
2. Buka **XAMPP Control Panel**, klik **Start** pada modul **MySQL**
   (Apache juga perlu di-Start kalau ingin membuka phpMyAdmin lewat browser).
3. Buka phpMyAdmin di browser: `http://localhost/phpmyadmin`

> Sudah punya MySQL Server + phpMyAdmin terinstal sendiri (bukan XAMPP)?
> Boleh, langkah selanjutnya tetap sama — yang penting MySQL berjalan di
> `localhost:3306` dan phpMyAdmin bisa diakses untuk membuat database.

## Langkah 2 — Buat database lewat phpMyAdmin

1. Di phpMyAdmin, klik tab **Databases**.
2. Nama database: `expertgym` — Collation: `utf8mb4_unicode_ci` → klik **Create**.
3. *(Opsional)* Kalau ingin tabel langsung tersedia tanpa menunggu server
   dijalankan: klik database `expertgym` → tab **Import** → pilih file
   `backend/schema.sql` → klik **Go**.
   Kalau langkah ini dilewati juga tidak masalah — backend akan otomatis
   membuat tabel `admin` dan `user` sendiri saat pertama kali dijalankan.

## Langkah 3 — Konfigurasi koneksi database

Di dalam folder `backend/`, salin `.env.example` menjadi `.env`:

```bash
cd expertgym/backend
copy .env.example .env      # Windows (PowerShell/CMD)
# atau: cp .env.example .env   (Mac/Linux)
```

Buka file `.env` dan sesuaikan dengan kredensial MySQL Anda:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=expertgym

PORT=3000
```

> Default instalasi XAMPP: user `root` dengan password **kosong**. Kalau
> Anda memakai user MySQL lain (disarankan untuk server produksi yang
> dipakai banyak orang), buat user tersebut lewat phpMyAdmin (tab
> **User accounts**) dan berikan hak akses penuh ke database `expertgym`,
> lalu isi `DB_USER`/`DB_PASSWORD` sesuai itu.

## Langkah 4 — Install dependency & jalankan server

```bash
npm install
npm start
```

Kalau berhasil akan muncul log:

```
[db] Akun admin default dibuat (admin / admin123)
[db] Akun demo user dibuat (user1 / user123)

[ExpertGym] Terhubung ke MySQL database "expertgym"
[ExpertGym] Server berjalan di http://localhost:3000
[ExpertGym] API Admin  di http://localhost:3000/api/admin
[ExpertGym] API User   di http://localhost:3000/api/user
```

Lalu buka `http://localhost:3000` di browser.

**Kalau muncul error "GAGAL terhubung ke MySQL"** → pastikan modul MySQL di
XAMPP Control Panel statusnya sudah **Start** (hijau), dan database
`expertgym` sudah dibuat (Langkah 2), serta kredensial di `.env` sudah benar.

## Akun default

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |
| User  | user1    | user123   |

---

## Melihat / mengelola data lewat phpMyAdmin

Setelah server pernah dijalankan minimal sekali (tabel sudah terbentuk),
buka `http://localhost/phpmyadmin` → pilih database `expertgym` → Anda bisa
melihat isi tabel:

- **`admin`** — `id_admin`, `username`, `password` (ter-hash bcrypt, bukan
  plain text).
- **`user`** — `id_user`, `nama`, `username`, `password` (ter-hash bcrypt).

Kedua tabel ini persis mengikuti ERD skripsi (tidak ada tabel gabungan/role,
dan tidak ada tabel `sessions` — sesi login disimpan sementara di memori
proses backend, hilang otomatis kalau server di-restart).

phpMyAdmin juga bisa dipakai untuk menghapus akun atau reset data kapan saja.

## Cara kerja autentikasi

- Password disimpan dengan **hash bcrypt**, tidak pernah plain text.
- Saat login berhasil (baik admin maupun user), server membuat **token sesi
  acak** yang disimpan di memori server (berlaku 7 hari) dan mengirimkannya
  ke frontend. Frontend menyimpan token itu di `localStorage` (key
  `eg_token`) dan mengirimkannya kembali lewat header
  `Authorization: Bearer <token>`.
- **Logout** menghapus sesi tsb di memori server, jadi token langsung tidak
  berlaku lagi (bukan sekadar dihapus di sisi klien).
- `GET /api/admin/status` dan `GET /api/user/status` dipakai untuk mengecek
  apakah token yang dikirim masih berupa sesi admin/user yang aktif.
- `GET /api/auth/me` tetap ada sebagai jembatan kompatibilitas supaya
  `js/auth.js` (frontend lama, tidak diubah) bisa memulihkan sesi otomatis
  saat halaman di-refresh — endpoint ini menerima token admin maupun user.

## Login Admin vs Login User

Form login di frontend hanya satu (sesuai UI yang sudah ada), dipakai untuk
admin maupun user. Karena kredensial disimpan di dua tabel terpisah,
`js/secure-auth.js` mencoba `POST /api/admin/login` lebih dulu; kalau gagal,
mencoba `POST /api/user/login`. Salah satu berhasil sudah cukup untuk masuk.

- Form **Daftar** di frontend hanya mendaftarkan akun ke tabel `user`.
  Tidak ada pendaftaran admin lewat form publik — akun admin hanya dibuat
  lewat seed default atau ditambahkan manual lewat phpMyAdmin.
- Username harus unik — dicek baik di tabel `user` maupun `admin` saat
  registrasi, supaya tidak ada dua akun berbeda dengan username yang sama.
- Setelah login, `role` (`admin`/`user`) yang dikembalikan backend
  menentukan tampilan: `admin` → `adminScreen`, `user` → `appScreen`
  (logika di `_startSessionLocal`, tidak berubah).

## Endpoint API

| Method | Endpoint                | Auth           | Keterangan |
|--------|--------------------------|----------------|------------|
| POST   | `/api/admin/login`       | -              | `{ username, password }` → `{ token, user }` |
| POST   | `/api/admin/logout`      | Bearer + admin | Menghapus sesi admin aktif |
| GET    | `/api/admin/status`      | Bearer + admin | Cek status login admin |
| POST   | `/api/user/register`     | -              | `{ nama, username, password }` |
| POST   | `/api/user/login`        | -              | `{ username, password }` → `{ token, user }` |
| POST   | `/api/user/logout`       | Bearer + user  | Menghapus sesi user aktif |
| GET    | `/api/user/status`       | Bearer + user  | Cek session login user |
| GET    | `/api/auth/me`           | Bearer token   | Jembatan kompatibilitas (admin/user) untuk js/auth.js lama |

## Kelola Data Latihan

Tabel **`data_latihan`** (sesuai ERD) menyimpan data latihan yang ditambahkan
admin lewat panel "Kelola Data Latihan", di luar 2.611 data bawaan di
`js/dataset.js`. Kolom: `id_latihan`, `title`, `desc`, `type`, `bodyPart`,
`equipment`, `level`.

| Method | Endpoint                  | Auth           | Keterangan |
|--------|----------------------------|----------------|------------|
| GET    | `/api/exercises`           | -              | Menampilkan seluruh latihan (mendukung `?search=`, `?level=`, `?bodyPart=`, `?equipment=`, `?type=`) |
| GET    | `/api/exercises/:id`       | -              | Detail latihan |
| POST   | `/api/exercises`           | Bearer + admin | Tambah latihan |
| PUT    | `/api/exercises/:id`       | Bearer + admin | Edit latihan |
| DELETE | `/api/exercises/:id`       | Bearer + admin | Hapus latihan |

Data dari endpoint ini digabung di sisi frontend (`js/exercise.js`) dengan
dataset bawaan lalu ditampilkan sebagai kartu latihan di halaman
rekomendasi — tidak ada perubahan pada HTML/CSS.

> Catatan: karena ERD `data_latihan` hanya berisi 7 kolom di atas (tidak ada
> `VideoUrl`/`Sets`/`Reps`/`Rest`), field "URL Tutorial/Video" yang masih
> ada di form admin saat ini **tidak lagi disimpan** ke database — kartu
> latihan akan selalu memakai link pencarian YouTube otomatis berdasarkan
> judul latihan. Kalau field tsb ingin diaktifkan kembali sebagai kolom
> tambahan di luar ERD, tinggal minta untuk ditambahkan lagi.



## Favorit

Tabel **`favorit`** (sesuai ERD) menyimpan latihan yang disimpan user lewat
tombol ikon hati. Kolom: `id_favorit`, `id_user`, `id_latihan` — ditambah
kolom `title` (lihat catatan penting di bawah).

> **Kenapa ada kolom `title` tambahan?** 2.611 latihan bawaan di
> `js/dataset.js` murni array statis di frontend — TIDAK tersimpan di
> tabel manapun, jadi tidak punya `id_latihan` yang valid. Kolom `title`
> dipakai sebagai kunci pencocokan yang selalu ada untuk SEMUA latihan
> (bawaan maupun kelolaan admin). `id_latihan` tetap diisi otomatis kalau
> latihan yang difavoritkan kebetulan berasal dari tabel `data_latihan`
> (latihan kelolaan admin), dan `NULL` untuk latihan dataset bawaan.

| Method | Endpoint                     | Auth          | Keterangan |
|--------|--------------------------------|---------------|------------|
| POST   | `/api/favorites`               | Bearer + user | `{ Title }` → Menambahkan latihan ke favorit |
| DELETE | `/api/favorites/:title`        | Bearer + user | Menghapus latihan dari favorit |
| GET    | `/api/favorites`               | Bearer + user | Menampilkan seluruh favorit milik user |
| GET    | `/api/favorites/check?title=`  | Bearer + user | Mengecek apakah latihan sudah menjadi favorit |

`id_user` **tidak perlu dikirim dari frontend** — diambil otomatis dari sesi
login (token), supaya user tidak bisa melihat/mengubah favorit user lain.

Tombol ikon hati di kartu latihan (dan panel "Favorit Saya") sudah
terhubung ke Fetch API lewat `js/favorite.js`, yang meng-override
`getUserFavs()`/`setUserFavs()` — dua fungsi yang sudah dipakai seluruh
kode favorit di `app.js` — sehingga **tidak ada satu baris pun kode
tampilan yang diubah**.

## Riwayat Rekomendasi

Tabel **`riwayat_rekomendasi`** (sesuai ERD) menyimpan ringkasan setiap kali
user menyelesaikan asesmen dan mendapat program rekomendasi. Kolom:
`id_riwayat`, `id_user`, `tingkat_kemampuan`, `alat_dipilih`, `label`,
`tanggal` — ditambah kolom `snapshot` (lihat catatan di bawah).

> **Kenapa ada kolom `snapshot` tambahan?** Satu sesi rekomendasi
> sebenarnya berisi jauh lebih banyak data daripada 5 kolom ERD — termasuk
> program latihan 7 hari penuh (`weekPlan`) dan jawaban asesmen — yang
> dipakai untuk menampilkan ulang detail riwayat & fitur "Muat Program dari
> Riwayat" (lanjut latihan tanpa asesmen ulang) di `app.js`. `snapshot`
> menyimpan seluruh data itu sebagai JSON; 5 kolom ERD tetap ada sebagai
> ringkasan/kolom pencarian:
> - `tingkat_kemampuan` = Level akhir hasil Forward Chaining Tahap 2
> - `alat_dipilih` = daftar alat yang dipilih user, dipisah koma
> - `label` = kode aturan Forward Chaining Tahap 1 yang cocok (mis. `R-L07`)

| Method | Endpoint              | Auth          | Keterangan |
|--------|--------------------------|---------------|------------|
| POST   | `/api/riwayat`           | Bearer + user | Menyimpan hasil rekomendasi setelah asesmen selesai |
| GET    | `/api/riwayat`           | Bearer + user | Menampilkan seluruh riwayat milik user, terbaru dulu |
| GET    | `/api/riwayat/:id`       | Bearer + user | Detail satu riwayat rekomendasi |
| DELETE | `/api/riwayat/:id`       | Bearer + user | Menghapus riwayat rekomendasi tertentu |

`id_user` **tidak perlu/tidak bisa dikirim dari frontend** — selalu diambil
dari sesi login (token), sehingga data riwayat dijamin sesuai user yang
sedang login dan tidak bisa dilihat/dihapus oleh user lain.

`id_riwayat` memakai id yang sudah dibuat di sisi klien (timestamp) alih-alih
auto-increment, supaya konsisten dengan skema id yang sudah dipakai fitur
Workout Log (di luar cakupan backend ini, tetap berjalan di localStorage).

Riwayat tersinkron otomatis ke backend lewat `js/riwayat.js`, yang
membungkus (bukan mengganti) `saveHistory()`/`deleteHistory()`/`clearHistory()`
yang sudah ada — localStorage tetap dipakai sebagai cermin baca cepat
(beberapa kode di `app.js` membacanya langsung), sementara backend jadi
sumber kebenaran yang disinkronkan setiap kali sesi login dimulai.

## Workout Log

Tabel **`workout_log`** melengkapi ERD skripsi (entitas ini sebelumnya
belum tergambar). Satu baris = progres **satu hari latihan** (`hari_ke`)
dari satu riwayat rekomendasi. Kolom inti: `id_log`, `id_riwayat`,
`hari_ke`, `status_selesai`, `tanggal_selesai` — ditambah kolom
`detail_latihan` (lihat catatan di bawah).

> **Kenapa ada kolom `detail_latihan` tambahan?** UI Workout Log punya
> checklist per latihan dalam satu hari (bukan cuma status selesai/belum
> per hari) — user bisa centang satu-satu latihan sebelum menandai
> keseluruhan hari selesai. `detail_latihan` menyimpan status centang tiap
> latihan tsb sebagai JSON, supaya perilaku checklist ini tetap identik
> dengan versi localStorage sebelumnya.
>
> **Kenapa `id_riwayat` tidak diberi FOREIGN KEY?** Saat asesmen selesai,
> `js/riwayat.js` mengirim data riwayat ke server secara *fire-and-forget*
> (tidak ditunggu). Ada kemungkinan kecil user langsung menekan "Mulai
> Workout" sebelum riwayat itu selesai tersimpan di server. Tanpa FK,
> race condition ini tidak menyebabkan galat — kolom tetap terisi benar,
> hanya tidak divalidasi keberadaannya di level database.

| Method | Endpoint                  | Auth          | Keterangan |
|--------|------------------------------|---------------|------------|
| PUT    | `/api/wlog/:idRiwayat`        | Bearer + user | Menyimpan/memperbarui progres satu riwayat (upsert penuh) |
| GET    | `/api/wlog`                    | Bearer + user | Menampilkan seluruh progres milik user (semua riwayat) |
| GET    | `/api/wlog/:idRiwayat`         | Bearer + user | Detail progres satu riwayat |
| DELETE | `/api/wlog/:idRiwayat`         | Bearer + user | Menghapus progres satu riwayat (reset/hapus program aktif) |

`id_user` selalu diambil dari sesi login (token), sama seperti fitur Favorit
dan Riwayat Rekomendasi. Tersinkron otomatis lewat `js/workout-log.js`, yang
membungkus fungsi-fungsi `wlog.js` yang sudah ada (`startWorkoutSession`,
`wlogToggleEx`, `wlogFinishDay`, `wlogResetProgram`, `wlogDeleteProgram`) —
localStorage tetap dipakai sebagai cermin baca cepat, backend jadi sumber
kebenaran yang disinkronkan setiap kali sesi login dimulai.

## Catatan untuk penggunaan oleh banyak orang (produksi)

- Ganti `DB_PASSWORD` di `.env` dengan password yang kuat, dan jangan pakai
  user `root` tanpa password di server produksi — buat user MySQL khusus
  lewat phpMyAdmin dengan hak akses terbatas ke database `expertgym` saja.
- Jangan commit file `.env` ke Git (sudah termasuk di `.gitignore`).
- Riwayat sesi latihan (history) tetap disimpan di `localStorage` browser
  masing-masing pengguna (di luar cakupan backend saat ini).
- Mode **Tamu** (`doGuest`) tetap berjalan lokal tanpa backend.
