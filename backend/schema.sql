-- ============================================================
-- schema.sql — Skema database ExpertGym (MySQL / MariaDB)
--
-- 📍 Tahap Alur Penelitian: Perancangan Sistem → ERD, diimplementasikan
--    pada tahap Implementasi Sistem → Pengembangan Sistem → Implementasi
--    Website (Backend/API). Lihat PETA_ALUR_PENELITIAN.md di root project.
--
-- Cara pakai lewat phpMyAdmin:
--   1. Buat database baru bernama "expertgym" (Collation: utf8mb4_unicode_ci)
--   2. Klik database "expertgym" tsb → tab "Import" → pilih file ini → Go
--
-- Catatan: backend juga otomatis membuat tabel ini sendiri saat pertama
-- kali dijalankan (CREATE TABLE IF NOT EXISTS), jadi mengimpor file ini
-- bersifat OPSIONAL — berguna kalau Anda ingin menyiapkan skema terlebih
-- dahulu lewat phpMyAdmin sebelum server dijalankan.
--
-- Struktur tabel `admin` dan `user` mengikuti ERD:
--   admin(id_admin, username, password)
--   user(id_user, nama, username, password)
-- Sesi login (token) TIDAK disimpan di tabel database — hanya di memori
-- server selama proses backend berjalan — jadi tidak ada tabel `sessions`.
-- ============================================================

CREATE DATABASE IF NOT EXISTS expertgym
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE expertgym;

CREATE TABLE IF NOT EXISTS admin (
  id_admin      INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL   -- disimpan ter-hash (bcrypt), bukan plain text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user (
  id_user       INT AUTO_INCREMENT PRIMARY KEY,
  nama          VARCHAR(150)  NOT NULL,
  username      VARCHAR(100)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL   -- disimpan ter-hash (bcrypt), bukan plain text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Akun default (dibuat otomatis oleh backend saat pertama kali dijalankan
-- jika belum ada baris di tabel admin/user — lihat backend/db.js):
--   admin / admin123   (tabel admin)
--   user1 / user123    (tabel user)

-- ── Kelola Data Latihan ──────────────────────────────────────
-- Tabel `data_latihan` mengikuti ERD persis:
--   data_latihan(id_latihan, title, desc, type, bodyPart, equipment, level, id_admin)
-- (`desc` dibungkus backtick karena merupakan kata kunci di MySQL/SQL)
-- Kolom `id_admin` mencatat admin yang menambahkan latihan tsb (relasi ERD
-- "Admin — Mengelola (1:N) — Data Latihan"), nullable untuk data lama.
CREATE TABLE IF NOT EXISTS data_latihan (
  id_latihan    INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200)  NOT NULL UNIQUE,
  `desc`        TEXT,
  type          VARCHAR(100)  NOT NULL DEFAULT '',
  bodyPart      VARCHAR(150)  NOT NULL DEFAULT '',
  equipment     VARCHAR(100)  NOT NULL DEFAULT 'Body Only',
  level         ENUM('Beginner','Intermediate','Expert') NOT NULL DEFAULT 'Beginner',
  id_admin      INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_data_latihan_admin FOREIGN KEY (id_admin) REFERENCES admin(id_admin) ON DELETE SET NULL,
  INDEX idx_data_latihan_id_admin (id_admin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
