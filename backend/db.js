/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * db.js — Koneksi & skema database ExpertGym (MySQL / MariaDB via phpMyAdmin)
 *
 * Menggunakan mysql2/promise (connection pool). Kredensial diambil dari
 * file .env (lihat .env.example). Database "expertgym" HARUS sudah dibuat
 * terlebih dahulu lewat phpMyAdmin (atau lewat perintah SQL manual) sebelum
 * server dijalankan — lihat README.md.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'expertgym',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

// ── SKEMA ──────────────────────────────────────────────────
// Sesuai ERD: hanya 2 tabel akun — `admin` dan `user` — tidak ada tabel
// gabungan/role dan tidak ada tabel `sessions` (sesi login disimpan di
// memori server, lihat store/sessions.js).
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin (
      id_admin      INT AUTO_INCREMENT PRIMARY KEY,
      username      VARCHAR(100)  NOT NULL UNIQUE,
      password      VARCHAR(255)  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user (
      id_user       INT AUTO_INCREMENT PRIMARY KEY,
      nama          VARCHAR(150)  NOT NULL,
      username      VARCHAR(100)  NOT NULL UNIQUE,
      password      VARCHAR(255)  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migrasi: kolom created_at dihapus dari tabel admin/user (tidak dipakai
  // di mana pun oleh frontend, hanya menambah noise di struktur tabel).
  for (const tbl of ['admin', 'user']) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'created_at'`,
      [tbl]
    );
    if (rows[0].c > 0) {
      await pool.query(`ALTER TABLE ${tbl} DROP COLUMN created_at`);
      console.log(`[db] Migrasi: kolom created_at dihapus dari tabel ${tbl}.`);
    }
  }

  // Tabel "trainers" — untuk fitur Kelola Personal Trainer.
  // sertifikasi & kontribusi disimpan sebagai teks JSON (array string).
  // foto & file_sertifikat menyimpan data URI base64 (foto profil / file
  // sertifikat), boleh NULL.
  //
  // Kolom "id_admin" merepresentasikan relasi ERD "Admin — Mengelola (1:N) —
  // trainers": mencatat admin mana yang MENAMBAHKAN profil trainer tsb
  // (diisi otomatis dari sesi login admin yang sedang aktif, lihat
  // routes/trainers.js POST /) — persis pola yang sama dengan
  // data_latihan.id_admin di atas. Nullable + ON DELETE SET NULL supaya
  // 2 profil trainer bawaan (seedTrainers, dibuat tanpa admin aktif) dan
  // penghapusan akun admin tidak menyebabkan data trainer ikut terhapus.
  //
  // Nama kolom memakai Bahasa Indonesia (nama, spesialisasi, pengalaman,
  // kontak, sertifikasi, kontribusi, foto, file_sertifikat) supaya konsisten
  // dengan tabel lain (mis. user.nama) — sebelumnya kolom-kolom ini memakai
  // Bahasa Inggris (name, title, experience, ...). Kolom "spesialisasi"
  // (bukan "jabatan") karena isinya bidang keahlian/gelar profesional
  // trainer (mis. "Strength & Conditioning Coach"), bukan posisi struktural.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainers (
      id_trainers     INT AUTO_INCREMENT PRIMARY KEY,
      nama            VARCHAR(150)  NOT NULL,
      spesialisasi    VARCHAR(200)  NOT NULL,
      pengalaman      VARCHAR(255)  NOT NULL DEFAULT '',
      kontak          VARCHAR(150)  NOT NULL DEFAULT '',
      sertifikasi     TEXT,
      kontribusi      TEXT,
      foto            LONGTEXT,
      file_sertifikat LONGTEXT,
      id_admin        INT NULL,
      CONSTRAINT fk_trainers_admin FOREIGN KEY (id_admin) REFERENCES admin(id_admin) ON DELETE SET NULL,
      INDEX idx_trainers_id_admin (id_admin)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migrasi: database trainers lama masih memakai nama kolom "id" (sebelum
  // direvisi jadi "id_trainers" supaya konsisten dengan pola id_<nama_tabel>
  // di semua tabel lain — id_user, id_admin, id_riwayat, id_log, id_favorit,
  // id_latihan). CHANGE COLUMN dipakai (bukan RENAME COLUMN) supaya tetap
  // kompatibel dengan MySQL 5.7, bukan hanya MySQL 8+.
  const [oldIdColRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainers' AND COLUMN_NAME = 'id'`
  );
  if (oldIdColRows[0].c > 0) {
    await pool.query(`ALTER TABLE trainers CHANGE COLUMN id id_trainers INT AUTO_INCREMENT`);
    console.log('[db] Migrasi: kolom trainers.id diganti nama menjadi id_trainers.');
  }

  // Migrasi untuk database trainers yang sudah ada sebelum kolom id_admin
  // ditambahkan (pola sama dengan migrasi data_latihan di atas).
  const [trainerColRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainers' AND COLUMN_NAME = 'id_admin'`
  );
  if (trainerColRows[0].c === 0) {
    await pool.query(`ALTER TABLE trainers ADD COLUMN id_admin INT NULL AFTER cert_file`);
    await pool.query(
      `ALTER TABLE trainers
         ADD CONSTRAINT fk_trainers_admin FOREIGN KEY (id_admin) REFERENCES admin(id_admin) ON DELETE SET NULL,
         ADD INDEX idx_trainers_id_admin (id_admin)`
    );
    console.log('[db] Migrasi: kolom id_admin ditambahkan ke tabel trainers.');
  }

  // Migrasi: database trainers lama masih memakai nama kolom Bahasa Inggris
  // (name, title, experience, contact, certs, contrib, photo, cert_file)
  // sebelum direvisi ke Bahasa Indonesia supaya konsisten dengan tabel lain
  // (mis. user.nama). CHANGE COLUMN dipakai (bukan RENAME COLUMN) supaya
  // tetap kompatibel dengan MySQL 5.7, bukan hanya MySQL 8+.
  const trainerColumnRenames = [
    ['name', 'nama', 'VARCHAR(150) NOT NULL'],
    ['title', 'spesialisasi', 'VARCHAR(200) NOT NULL'],
    ['jabatan', 'spesialisasi', 'VARCHAR(200) NOT NULL'],
    ['experience', 'pengalaman', "VARCHAR(255) NOT NULL DEFAULT ''"],
    ['contact', 'kontak', "VARCHAR(150) NOT NULL DEFAULT ''"],
    ['certs', 'sertifikasi', 'TEXT'],
    ['contrib', 'kontribusi', 'TEXT'],
    ['photo', 'foto', 'LONGTEXT'],
    ['cert_file', 'file_sertifikat', 'LONGTEXT'],
  ];
  for (const [oldName, newName, colDef] of trainerColumnRenames) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainers' AND COLUMN_NAME = ?`,
      [oldName]
    );
    if (rows[0].c > 0) {
      await pool.query(`ALTER TABLE trainers CHANGE COLUMN ${oldName} ${newName} ${colDef}`);
      console.log(`[db] Migrasi: kolom trainers.${oldName} diganti nama menjadi ${newName}.`);
    }
  }

  // Migrasi: kolom created_at dihapus dari tabel trainers (tidak dipakai
  // di mana pun oleh frontend).
  const [trainerCreatedAtRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainers' AND COLUMN_NAME = 'created_at'`
  );
  if (trainerCreatedAtRows[0].c > 0) {
    await pool.query(`ALTER TABLE trainers DROP COLUMN created_at`);
    console.log('[db] Migrasi: kolom created_at dihapus dari tabel trainers.');
  }

  // Tabel "data_latihan" — untuk fitur Kelola Data Latihan (sesuai ERD).
  // Merepresentasikan data latihan yang dikelola ADMIN (tambahan di luar
  // dataset bawaan js/dataset.js), setara dengan "customExercises" versi
  // localStorage sebelumnya — namun kini tersimpan terpusat di database.
  // Kolom mengikuti ERD persis: id_latihan, title, desc, type, bodyPart,
  // equipment, level (`desc` dibungkus backtick karena kata kunci MySQL).
  //
  // Kolom "id_admin" merepresentasikan relasi ERD "Admin — Mengelola (1:N)
  // — Data Latihan": mencatat admin mana yang MENAMBAHKAN latihan tsb
  // (diisi otomatis dari sesi login admin yang sedang aktif, lihat
  // routes/exercises.js POST /). Nullable karena data lama (sebelum kolom
  // ini ada) tidak memiliki riwayat admin pembuatnya. ON DELETE SET NULL
  // supaya penghapusan akun admin tidak ikut menghapus data latihan yang
  // pernah ia buat.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_latihan (
      id_latihan    INT AUTO_INCREMENT PRIMARY KEY,
      title         VARCHAR(200)  NOT NULL UNIQUE,
      \`desc\`      TEXT,
      type          VARCHAR(100)  NOT NULL DEFAULT '',
      bodyPart      VARCHAR(150)  NOT NULL DEFAULT '',
      equipment     VARCHAR(100)  NOT NULL DEFAULT 'Body Only',
      level         ENUM('Beginner','Intermediate','Expert') NOT NULL DEFAULT 'Beginner',
      id_admin      INT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_data_latihan_admin FOREIGN KEY (id_admin) REFERENCES admin(id_admin) ON DELETE SET NULL,
      INDEX idx_data_latihan_level (level),
      INDEX idx_data_latihan_equipment (equipment),
      INDEX idx_data_latihan_bodyPart (bodyPart),
      INDEX idx_data_latihan_type (type),
      INDEX idx_data_latihan_id_admin (id_admin)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── MIGRASI untuk database yang SUDAH ADA sebelum kolom id_admin
  // ditambahkan (CREATE TABLE IF NOT EXISTS tidak meng-update tabel yang
  // sudah pernah dibuat) — cek dulu apakah kolomnya sudah ada, baru
  // ALTER TABLE kalau belum, supaya aman dijalankan berkali-kali.
  const [colRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_latihan' AND COLUMN_NAME = 'id_admin'`
  );
  if (colRows[0].c === 0) {
    await pool.query(`ALTER TABLE data_latihan ADD COLUMN id_admin INT NULL AFTER level`);
    await pool.query(
      `ALTER TABLE data_latihan
         ADD CONSTRAINT fk_data_latihan_admin FOREIGN KEY (id_admin) REFERENCES admin(id_admin) ON DELETE SET NULL,
         ADD INDEX idx_data_latihan_id_admin (id_admin)`
    );
    console.log('[db] Migrasi: kolom id_admin ditambahkan ke tabel data_latihan.');
  }

  // ── MIGRASI untuk database yang SUDAH ADA sebelum kolom created_at
  // ditambahkan ke tabel data_latihan (dipakai fitur sorting "Terbaru →
  // Terlama" / "Terlama → Terbaru" di panel admin). Tanpa migrasi ini,
  // tabel lama tidak memiliki kolom created_at sama sekali sehingga
  // SELECT dl.* tidak pernah mengembalikan nilainya, CreatedAt di frontend
  // selalu null, dan sorting tidak berpengaruh pada urutan data.
  const [createdAtRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_latihan' AND COLUMN_NAME = 'created_at'`
  );
  if (createdAtRows[0].c === 0) {
    await pool.query(
      `ALTER TABLE data_latihan ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER id_admin`
    );
    console.log('[db] Migrasi: kolom created_at ditambahkan ke tabel data_latihan.');
  }

  // Tabel "favorit" — untuk fitur Favorit (sesuai ERD: id_favorit, id_user,
  // id_latihan). Catatan: 2.611 latihan bawaan (js/dataset.js) TIDAK
  // tersimpan di tabel manapun (murni array statis di frontend), sehingga
  // tidak semua latihan punya id_latihan yang valid. Kolom `title`
  // ditambahkan sebagai kunci pencocokan yang selalu tersedia untuk SEMUA
  // latihan (bawaan maupun kelolaan admin) — persis seperti cara lama
  // (localStorage) mencocokkan favorit berdasarkan judul latihan.
  // id_latihan tetap diisi kalau latihan tsb berasal dari tabel
  // `data_latihan` (latihan kelolaan admin).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorit (
      id_favorit    INT AUTO_INCREMENT PRIMARY KEY,
      id_user       INT NOT NULL,
      id_latihan    INT NULL,
      title         VARCHAR(200) NOT NULL,
      CONSTRAINT fk_favorit_user FOREIGN KEY (id_user) REFERENCES user(id_user) ON DELETE CASCADE,
      UNIQUE KEY uq_favorit_user_title (id_user, title),
      INDEX idx_favorit_id_latihan (id_latihan)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migrasi: kolom created_at dihapus dari tabel favorit (tidak dipakai di
  // mana pun oleh frontend; urutan "favorit terbaru" kini memakai id_favorit
  // DESC, lihat routes/favorites.js, karena id auto_increment tetap
  // merepresentasikan urutan penambahan).
  const [favoritCreatedAtRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'favorit' AND COLUMN_NAME = 'created_at'`
  );
  if (favoritCreatedAtRows[0].c > 0) {
    await pool.query(`ALTER TABLE favorit DROP COLUMN created_at`);
    console.log('[db] Migrasi: kolom created_at dihapus dari tabel favorit.');
  }

  // Tabel "riwayat_rekomendasi" — untuk fitur Riwayat Rekomendasi (sesuai
  // ERD: id_riwayat, id_user, tingkat_kemampuan, alat_dipilih, label,
  // tanggal). Catatan: satu sesi rekomendasi di frontend sebenarnya berisi
  // data yang jauh lebih lengkap (program latihan 7 hari penuh, jawaban
  // asesmen f1-f15, dst) yang dipakai untuk menampilkan ulang detail &
  // fitur "Muat Program dari Riwayat" tanpa asesmen ulang. Kolom `snapshot`
  // ditambahkan untuk menyimpan data lengkap tsb dalam format JSON, supaya
  // frontend (app.js) bisa merender ulang detail riwayat persis seperti
  // sebelumnya — 5 kolom ERD tetap ada sebagai ringkasan/kolom pencarian.
  // id_riwayat memakai id yang sudah dibuat di sisi klien (timestamp,
  // BUKAN auto_increment) supaya konsisten dengan skema id yang sudah
  // dipakai fitur Workout Log (di luar cakupan backend ini).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS riwayat_rekomendasi (
      id_riwayat        BIGINT PRIMARY KEY,
      id_user           INT NOT NULL,
      tingkat_kemampuan VARCHAR(50)  NOT NULL,
      alat_dipilih      VARCHAR(500) NOT NULL,
      label             VARCHAR(100) NOT NULL,
      tanggal           DATETIME NOT NULL,
      snapshot          LONGTEXT NOT NULL,
      CONSTRAINT fk_riwayat_user FOREIGN KEY (id_user) REFERENCES user(id_user) ON DELETE CASCADE,
      INDEX idx_riwayat_user (id_user),
      INDEX idx_riwayat_tanggal (tanggal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Tabel "workout_log" — untuk fitur Workout Log (progres harian latihan).
  // Ditambahkan untuk melengkapi ERD skripsi: satu baris = progres SATU
  // hari latihan (hari_ke) dari SATU riwayat rekomendasi. Kolom inti:
  // id_log, id_riwayat, hari_ke, status_selesai, tanggal_selesai — plus
  // kolom `detail_latihan` (JSON) untuk menyimpan status centang per
  // latihan dalam hari itu (dipakai fitur checklist latihan di UI Workout
  // Log, js/wlog.js), supaya progres tetap sinkron persis seperti versi
  // localStorage sebelumnya.
  //
  // id_riwayat SENGAJA TIDAK diberi FOREIGN KEY ke riwayat_rekomendasi:
  // riwayat baru dikirim ke server secara fire-and-forget tepat setelah
  // asesmen selesai, sehingga ada kemungkinan kecil progres Workout Log
  // pertama (saat user langsung menekan "Mulai Workout") sampai ke server
  // sepersekian detik lebih dulu. Tanpa FK, race condition ini tidak
  // menyebabkan galat — hanya id_user yang diberi FK karena user sudah
  // pasti ada sebelum login.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_log (
      id_log            INT AUTO_INCREMENT PRIMARY KEY,
      id_riwayat        BIGINT NOT NULL,
      id_user           INT NOT NULL,
      hari_ke           INT NOT NULL,
      status_selesai    TINYINT(1) NOT NULL DEFAULT 0,
      tanggal_selesai   DATETIME NULL,
      detail_latihan    LONGTEXT NOT NULL,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_wlog_user FOREIGN KEY (id_user) REFERENCES user(id_user) ON DELETE CASCADE,
      UNIQUE KEY uq_wlog_riwayat_hari (id_riwayat, hari_ke),
      INDEX idx_wlog_user (id_user),
      INDEX idx_wlog_riwayat (id_riwayat)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ── SEED AKUN DEFAULT ──────────────────────────────────────
async function seedDefaults() {
  const [[{ c: adminCount }]] = await pool.query(`SELECT COUNT(*) AS c FROM admin`);
  if (adminCount === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO admin (username, password) VALUES (?, ?)`,
      ['admin', hash]
    );
    console.log('[db] Akun admin default dibuat (admin / admin123)');
  }

  const [demoRows] = await pool.query(`SELECT id_user FROM user WHERE username = 'user1'`);
  if (demoRows.length === 0) {
    const hash = await bcrypt.hash('user123', 10);
    await pool.query(
      `INSERT INTO user (nama, username, password) VALUES (?, ?, ?)`,
      ['Demo User', 'user1', hash]
    );
    console.log('[db] Akun demo user dibuat (user1 / user123)');
  }
}

/** Seed 2 profil trainer bawaan (hanya jika tabel trainers masih kosong). */
async function seedTrainers() {
  const [[{ c: trainerCount }]] = await pool.query(`SELECT COUNT(*) AS c FROM trainers`);
  if (trainerCount > 0) return;

  const defaults = [
    {
      name: 'David Pratama, S.Or.',
      title: 'Certified Personal Trainer — Bodybuilding Specialist',
      experience: '8 tahun melatih bodybuilding & strength training',
      contact: '0812-3456-7890',
      certs: ['IFBA Certified Personal Trainer', 'Specialized in Bodybuilding', 'Strength & Muscle Hypertrophy Certified'],
      contrib: [
        'Memvalidasi dataset latihan Compound → Isolation',
        'Memvalidasi aturan inferensi forward chaining',
        'Memvalidasi parameter Set/Rep/Rest sesuai tujuan Hypertrophy & Strength',
        'Memvalidasi program split Push/Pull/Legs dan rekomendasi alat gym',
      ],
    },
    {
      name: 'Annisa Dewanti, S.Pd.',
      title: 'Strength & Conditioning Coach',
      experience: '5 tahun sebagai strength & conditioning coach',
      contact: 'annisa.dewanti@expertgym.id',
      certs: ['ISSA Certified Fitness Coach', 'NSCA Certified Personal Trainer', 'CrossFit Level 1 Trainer'],
      contrib: [
        'Memvalidasi urutan latihan Compound → Isolation',
        'Memvalidasi protokol warm-up per sesi latihan',
        'Memvalidasi Set/Rep/Rest sesuai tujuan Fat Loss & Hypertrophy',
        'Memvalidasi rekomendasi program latihan dari dataset Kaggle',
      ],
    },
  ];

  for (const t of defaults) {
    await pool.query(
      `INSERT INTO trainers (nama, spesialisasi, pengalaman, kontak, sertifikasi, kontribusi) VALUES (?, ?, ?, ?, ?, ?)`,
      [t.name, t.title, t.experience, t.contact, JSON.stringify(t.certs), JSON.stringify(t.contrib)]
    );
  }
  console.log('[db] 2 profil trainer bawaan dibuat (David Pratama & Annisa Dewanti).');
}

/** Dipanggil sekali saat server start: pastikan koneksi, skema, dan seed siap. */
async function initDb() {
  // Tes koneksi lebih dulu supaya pesan error jelas kalau MySQL belum jalan
  // atau database "expertgym" belum dibuat di phpMyAdmin.
  try {
    const conn = await pool.getConnection();
    conn.release();
  } catch (e) {
    console.error('\n[db] GAGAL terhubung ke MySQL.');
    console.error('[db] Pastikan MySQL/MariaDB sudah berjalan dan database "' +
      (process.env.DB_NAME || 'expertgym') + '" sudah dibuat lewat phpMyAdmin.');
    console.error('[db] Detail error:', e.message, '\n');
    throw e;
  }

  await ensureSchema();
  await seedDefaults();
  await seedTrainers();
}

module.exports = { pool, initDb };
