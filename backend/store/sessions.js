/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * store/sessions.js — Penyimpanan sesi login (in-memory, BUKAN tabel database)
 *
 * Sesuai ketentuan ERD, database hanya berisi tabel `admin` dan `user`
 * (tidak boleh ada tabel baru). Karena itu, token sesi login/logout TIDAK
 * disimpan di tabel database, melainkan disimpan sementara di memori server
 * (Map). Ini cukup untuk kebutuhan Login/Logout/Cek Status Login pada
 * skripsi ini.
 *
 * Catatan: karena disimpan di memori, seluruh sesi akan hilang jika proses
 * Node.js di-restart (semua orang otomatis logout). Ini adalah trade-off
 * yang wajar supaya tidak perlu membuat tabel tambahan di luar ERD.
 */

const crypto = require('crypto');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

/** token -> { type: 'admin' | 'user', id, username, nama?, expiresAt } */
const sessions = new Map();

function create(type, payload) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  sessions.set(token, { type, ...payload, expiresAt });
  return { token, expiresAt: expiresAt.toISOString() };
}

function get(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < new Date()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function destroy(token) {
  if (token) sessions.delete(token);
}

module.exports = { create, get, destroy };
