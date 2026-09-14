# Laporan Audit Asesmen dan Forward Chaining

## Ruang lingkup

Audit dilakukan pada pemetaan UI ke fakta, kondisi dinamis F13–F15, inferensi F17, validasi F18/F19, derivasi F20, pemilihan F16, aturan KR-01–KR-12 dan KR-L1–KR-L3, serta resolusi konflik. Backend, database, struktur tabel, desain UI, dan fitur lain tidak diubah.

## Hasil audit sebelum perbaikan

1. **Fakta yang sudah benar:** kode dan urutan F3–F15 tersedia; pilihan F3–F15 pada dasarnya memakai kode `a/b/c/other` yang konsisten; F17 berasal dari `compute()`; rekomendasi memakai F18; daftar 10 alat F16 tersedia; F5 telah dipakai untuk menentukan pola gerakan.
2. **Mapping bermasalah:** teks F1 menyatakan “kurang dari 1 bulan”, F2 memakai 1–3 dan ≥4 kali/minggu, beberapa label memakai variasi garis miring/spasi, F16 belum direpresentasikan sebagai fakta tersendiri, dan F20 hanya dihitung lokal sehingga belum tersimpan sebagai fakta internal.
3. **Kondisi dinamis bermasalah:** F14 hanya muncul untuk F12=Lansia; syarat F8=Kurang bugar belum diterapkan. F13 dan F15 sudah benar. Pembersihan fakta dinamis yang tidak relevan sudah benar.
4. **Rule bermasalah:** KR-02 tidak mencantumkan `good morning`; KR-04 tidak selalu dieksekusi saat intensitas berat karena dibatasi `f9 !== c`; terdapat aksi tambahan untuk F4=Kadang ada keluhan yang tidak terdapat pada tabel; beberapa rule penurun level dapat menurunkan F18 secara kumulatif.
5. **Konflik:** prioritas F19 Tidak Disarankan sudah dijaga, tetapi F18 dapat turun lebih dari satu tingkat apabila beberapa rule penurun aktif.

## Perbaikan

- Menyamakan label F1, F2, F6, F13, F14, dan F15 dengan nilai pada tabel tanpa mengubah tata letak.
- Mengaktifkan F14 jika F8=Kurang bugar **atau** F12=Lansia.
- Menyimpan F16 secara internal; `Body Only` pada dataset dinormalisasi menjadi fakta `Body only` tanpa mengubah dataset/rekomendasi.
- Menyimpan F20 sebagai fakta internal: Fat loss→Circuit Style, Hypertrophy→Compound-First, Strength→Compound-Only.
- Melengkapi KR-02, menjalankan KR-04 sesuai kondisinya, dan menghapus aksi tambahan yang tidak tercantum pada tabel.
- Mengumpulkan seluruh pemicu penurunan dan menerapkan tepat satu penurunan F18 per asesmen.
- Mempertahankan prioritas `Tidak Disarankan` atas `Perlu Modifikasi`.

## Hasil pengujian

| Aturan | Hasil |
|---|---|
| KR-01–KR-03 | Lulus: turun satu tingkat, Perlu Modifikasi, larangan sesuai |
| KR-04 | Lulus: Perlu Modifikasi dan konsultasi dokter |
| KR-05 | Lulus: turun satu tingkat dan low-impact |
| KR-06–KR-08 | Lulus: Perlu Modifikasi dan pembatasan gerakan sesuai |
| KR-09 | Lulus: maksimum Intermediate dan larangan 1RM |
| KR-10 | Lulus: penyesuaian Sedang dan keseimbangan |
| KR-11–KR-12 | Lulus: Tidak Disarankan tidak tertimpa |
| KR-L1–KR-L3 | Lulus: turun satu tingkat dan tindakan sesuai |
| Kombinasi rule | Lulus: F18 hanya turun satu tingkat; F19 terberat dipertahankan |
| F20 | Lulus untuk ketiga nilai F5 |
| Kondisi tanpa rule | Lulus: tidak memicu keamanan secara keliru |
| F1–F16/UI | Lulus pemeriksaan jumlah pilihan, mapping, dan pemicu dinamis |

## Status akhir

Implementasi asesmen dan Forward Chaining yang diaudit telah disesuaikan dengan Tabel 3.2 dan Tabel 3.8 untuk ruang lingkup F1–F20, kondisi dinamis, KR-01–KR-12, KR-L1–KR-L3, dan resolusi konflik. Tes regresi berada di `tests/forward-chaining.test.js`.
