/**
 * js/forward-chaining.js, Mesin Inferensi Forward Chaining (ExpertGym)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POSISI DALAM ALUR PENELITIAN (lihat PETA_ALUR_PENELITIAN.md di root
 * project untuk peta lengkap semua tahap):
 *
 *   4. IMPLEMENTASI SISTEM
 *      └─ Pengembangan Sistem
 *           └─ Implementasi Forward Chaining   ← FILE INI
 *
 * File ini adalah pemisahan (refactor) dari js/app.js supaya mesin
 * inferensi (basis aturan IF-THEN + proses pencocokan/matching) berdiri
 * sendiri sebagai satu modul yang jelas, terpisah dari kode antarmuka
 * (UI) dan rendering. Tidak ada logika yang diubah, fungsi di bawah ini
 * dipindahkan apa adanya dari js/app.js agar perilaku aplikasi tetap
 * identik.
 *
 * Dimuat lewat <script src="js/forward-chaining.js"> di index.html,
 * SEBELUM js/app.js, sehingga fungsi compute() dan computeF18() di bawah
 * ini otomatis tersedia secara global dan tetap bisa dipanggil dari
 * app.js (mis. di dalam runInference()) persis seperti sebelumnya.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Mesin ini terdiri dari DUA TAHAP forward chaining berurutan:
 *
 *   TAHAP 1, compute()
 *     Klasifikasi level pengguna (Beginner/Intermediate/Expert) memakai
 *     weighted scoring (F1:20% F2:20% F3:30% F8:10% F10:10% F12:10%),
 *     lalu dicocokkan ke basis aturan IF-THEN representatif R-L01–R-L30
 *     (fakta F1,F2,F3,F8,F10,F12 → level) untuk memberi label aturan
 *     yang cocok pada hasil (state.matchedRule).
 *
 *   TAHAP 2, computeF18()
 *     Validasi keamanan atas hasil Tahap 1 memakai aturan IF-THEN
 *     KR-01 s.d. KR-12 (+ KR-L1..KR-L3 untuk jawaban "Lainnya"): bisa
 *     menurunkan level (mis. Expert → Intermediate) dan/atau menandai
 *     status akhir sebagai "Perlu Modifikasi" / "Tidak Disarankan"
 *     berdasarkan fakta cedera (F13), kondisi medis (F14), keterbatasan
 *     mobilitas (F15), usia (F12), dst.
 *
 * Kedua fungsi membaca & menulis ke objek global `state` (didefinisikan
 * di js/app.js), ini konsisten dengan cara seluruh aplikasi menyimpan
 * fakta-fakta hasil asesmen (F1..F19).
 */

// ══════════════════════════════════════════════════════════
// FORWARD CHAINING TAHAP 1, WEIGHTED SCORING → BASIS ATURAN R-L01..R-L30
// F1:20% F2:20% F3:30% F8:10% F10:10% F12:10%
// 1.00-1.57=Beginner 1.58-2.42=Intermediate 2.43-3.00=Expert
// ══════════════════════════════════════════════════════════
function compute(){
  const vm={a:1,b:2,c:3};
  const N1=vm[state.f1]||1,N2=vm[state.f2]||1,N3=vm[state.f3]||1;
  const N8=vm[state.f8]||1,N10=vm[state.f10]||1;
  const N12=state.f12==='b'?2:1; // remaja/lansia=1, dewasa=2
  const score=(N1*.20)+(N2*.20)+(N3*.30)+(N8*.10)+(N10*.10)+(N12*.10);
  state.score=Math.round(score*2)/2; // dibulatkan ke kelipatan 0,5 agar tampil rapi (mis. 1,10→1,00; 2,90→3,00); level tetap dihitung dari skor mentah di baris bawah, tidak terpengaruh
  const level=score<=1.57?'Beginner':score<=2.42?'Intermediate':'Expert';

  // Cocokkan aturan representatif
  const rules=[
    {id:'R-L01',f1:'a',f2:'a',f3:'a',f8:'a',f10:'a',f12:'b',l:'Beginner'},
    {id:'R-L02',f1:'a',f2:'a',f3:'a',f8:'a',f10:'a',f12:'a',l:'Beginner'},
    {id:'R-L03',f1:'a',f2:'b',f3:'a',f8:'b',f10:'b',f12:'b',l:'Beginner'},
    {id:'R-L04',f1:'a',f2:'a',f3:'b',f8:'a',f10:'a',f12:'b',l:'Beginner'},
    {id:'R-L05',f1:'b',f2:'a',f3:'a',f8:'a',f10:'a',f12:'b',l:'Beginner'},
    {id:'R-L06',f1:'a',f2:'a',f3:'a',f8:'b',f10:'a',f12:'c',l:'Beginner'},
    {id:'R-L07',f1:'a',f2:'a',f3:'a',f8:'a',f10:'b',f12:'b',l:'Beginner'},
    {id:'R-L08',f1:'b',f2:'a',f3:'a',f8:'b',f10:'a',f12:'a',l:'Beginner'},
    {id:'R-L09',f1:'a',f2:'b',f3:'b',f8:'a',f10:'b',f12:'b',l:'Beginner'},
    {id:'R-L10',f1:'b',f2:'b',f3:'a',f8:'b',f10:'b',f12:'c',l:'Beginner'},
    {id:'R-L11',f1:'b',f2:'b',f3:'b',f8:'b',f10:'b',f12:'b',l:'Intermediate'},
    {id:'R-L12',f1:'b',f2:'c',f3:'b',f8:'b',f10:'b',f12:'b',l:'Intermediate'},
    {id:'R-L13',f1:'c',f2:'b',f3:'b',f8:'b',f10:'b',f12:'b',l:'Intermediate'},
    {id:'R-L14',f1:'b',f2:'b',f3:'c',f8:'b',f10:'b',f12:'b',l:'Intermediate'},
    {id:'R-L15',f1:'b',f2:'c',f3:'b',f8:'c',f10:'b',f12:'b',l:'Intermediate'},
    {id:'R-L16',f1:'c',f2:'b',f3:'b',f8:'b',f10:'c',f12:'b',l:'Intermediate'},
    {id:'R-L17',f1:'b',f2:'b',f3:'b',f8:'b',f10:'b',f12:'a',l:'Intermediate'},
    {id:'R-L18',f1:'c',f2:'b',f3:'b',f8:'c',f10:'b',f12:'b',l:'Intermediate'},
    {id:'R-L19',f1:'b',f2:'c',f3:'c',f8:'b',f10:'c',f12:'b',l:'Intermediate'},
    {id:'R-L20',f1:'b',f2:'b',f3:'b',f8:'b',f10:'b',f12:'c',l:'Intermediate'},
    {id:'R-L21',f1:'c',f2:'c',f3:'c',f8:'c',f10:'c',f12:'b',l:'Expert'},
    {id:'R-L22',f1:'c',f2:'c',f3:'c',f8:'c',f10:'b',f12:'b',l:'Expert'},
    {id:'R-L23',f1:'c',f2:'c',f3:'c',f8:'b',f10:'c',f12:'b',l:'Expert'},
    {id:'R-L24',f1:'c',f2:'b',f3:'c',f8:'c',f10:'c',f12:'b',l:'Expert'},
    {id:'R-L25',f1:'c',f2:'c',f3:'b',f8:'c',f10:'c',f12:'b',l:'Expert'},
    {id:'R-L26',f1:'c',f2:'c',f3:'c',f8:'c',f10:'c',f12:'a',l:'Expert'},
    {id:'R-L27',f1:'c',f2:'c',f3:'c',f8:'c',f10:'c',f12:'c',l:'Expert'},
    {id:'R-L28',f1:'b',f2:'c',f3:'c',f8:'c',f10:'c',f12:'b',l:'Expert'},
    {id:'R-L29',f1:'c',f2:'c',f3:'c',f8:'c',f10:'b',f12:'c',l:'Expert'},
    {id:'R-L30',f1:'c',f2:'c',f3:'b',f8:'c',f10:'b',f12:'b',l:'Expert'},
  ];
  const m=rules.find(r=>r.f1===state.f1&&r.f2===state.f2&&r.f3===state.f3&&r.f8===state.f8&&r.f10===state.f10&&r.f12===state.f12);
  state.matchedRule=m?m.id:`(Skor:${state.score}>${level})`;
  state.f17=level;
}

// ══════════════════════════════════════════════════════════
// FORWARD CHAINING TAHAP 2, VALIDASI KEAMANAN → BASIS ATURAN KR-01..KR-12
// KR-01 s.d. KR-12
// ══════════════════════════════════════════════════════════
function computeF18(){
  let f18=state.f17,f19='Aman';
  const w=[];
  const lo=['Beginner','Intermediate','Expert'];
  const dg=cur=>lo[Math.max(0,lo.indexOf(cur)-1)];
  const {f4,f5,f9,f11,f12,f13,f14,f15}=state;
  let mustDowngrade=false;

  // KR-11 & KR-12, Tidak Disarankan (prioritas tertinggi)
  if(f4==='a'&&f9==='c'){f19='Tidak Disarankan';w.push('Latihan intensitas berat tidak disarankan karena Anda memiliki cedera aktif.');}
  if(f14==='a'&&f9==='c'){f19='Tidak Disarankan';w.push('Latihan HIIT/intensitas tinggi tidak disarankan untuk kondisi kardiovaskular Anda.');}

  // KR-01 s.d. KR-03, F13 = area cedera/keluhan spesifik
  // F4 = "Ada riwayat cedera" → F18 turun 1 level + F19 = Perlu Modifikasi
  // F4 = "Kadang ada keluhan" → F18 TETAP (tidak turun) + F19 = Perlu Modifikasi
  // F4 = "Sehat bugar" → tidak ada aturan ini yang berlaku (F19 tetap Aman)
  if(f13==='c'){ // Lutut/Engkel
    if(f4==='a'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari squat, leg press, dan lunge karena cedera lutut/engkel Anda.');}
    else if(f4==='b'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari squat, leg press, dan lunge karena keluhan lutut/engkel Anda.');}
  }
  if(f13==='b'){ // Punggung Bawah
    if(f4==='a'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari deadlift, good morning, dan barbell row karena cedera punggung bawah Anda.');}
    else if(f4==='b'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari deadlift, good morning, dan barbell row karena keluhan punggung bawah Anda.');}
  }
  if(f13==='a'){ // Bahu/Leher
    if(f4==='a'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari overhead press dan upright row karena cedera bahu/leher Anda.');}
    else if(f4==='b'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari overhead press dan upright row karena keluhan bahu/leher Anda.');}
  }
  if(f14==='a'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Konsultasikan dengan dokter sebelum latihan intensitas tinggi karena kondisi kardiovaskular Anda.');}
  if(f14==='b'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Prioritaskan gerakan low-impact karena kondisi tulang/sendi Anda.');}
  if(f11==='a'&&f15==='a'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari squat dalam dan pistol squat karena mobilitas Anda yang terbatas.');}
  if(f11==='a'&&f15==='b'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Hindari overhead press dan pull-up karena Anda sulit mengangkat tangan.');}
  if(f11==='a'&&f15==='c'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Ganti deadlift dengan rack pull atau seated row karena Anda sulit membungkuk.');}
  if(f12==='a'&&f5==='c'){if(f18==='Expert')f18='Intermediate';if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Latihan 1RM testing tidak disarankan untuk usia remaja dengan tujuan Strength.');}
  if(f12==='c'&&f9==='c'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Sesuaikan intensitas ke tingkat Sedang dan prioritaskan keseimbangan, mengingat usia Anda.');}

  // KR-Lainnya, pilihan "Lainnya" pada F13/F14/F15
  // F13 = "Lainnya" mengikuti aturan F4 yang sama seperti KR-01 s.d. KR-03:
  // F4 = "Ada riwayat cedera" → F18 turun 1 level. F4 = "Kadang ada keluhan" → F18 TETAP.
  if(f13==='other'){
    if(f4==='a'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Karena cedera Anda tidak spesifik, intensitas diturunkan satu tingkat, prioritaskan latihan low-impact, dan hindari gerakan berisiko tinggi.');}
    else if(f4==='b'){if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Karena keluhan Anda tidak spesifik, prioritaskan latihan low-impact dan hindari gerakan berisiko tinggi.');}
  }
  if(f14==='other'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Karena kondisi medis Anda tidak spesifik, intensitas diturunkan satu tingkat, prioritaskan latihan low-impact, dan konsultasikan dengan dokter.');}
  if(f15==='other'){mustDowngrade=true;if(f19!=='Tidak Disarankan')f19='Perlu Modifikasi';w.push('Karena batasan mobilitas Anda tidak spesifik, intensitas diturunkan satu tingkat, prioritaskan latihan low-impact, dan hindari gerakan berisiko tinggi.');}

  // Resolusi konflik Tabel 3.8: semua rule penurun level dalam satu asesmen
  // menghasilkan tepat satu penurunan, bukan penurunan kumulatif.
  if(mustDowngrade)f18=dg(f18);

  state.f18=f18;state.f19=f19;state.f19Warnings=w;
  state.f20={a:'Circuit Style',b:'Compound-First',c:'Compound-Only'}[f5]||null;
}
