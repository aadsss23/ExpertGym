const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const context={state:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../frontend/src/js/forward-chaining.js'),'utf8'),context);
function run(overrides={},level='Expert'){Object.assign(context.state,{f4:'c',f5:'b',f9:'b',f11:'b',f12:'b',f13:null,f14:null,f15:null,f17:level},overrides);context.computeF18();return {...context.state,w:[...context.state.f19Warnings]};}
function check(name,input,level,flag,warning){const r=run(input);assert.equal(r.f18,level,`${name}: F18`);assert.equal(r.f19,flag,`${name}: F19`);assert(r.w.some(x=>x.toLowerCase().includes(warning)),`${name}: warning`);}
check('KR-01',{f4:'a',f13:'c'},'Intermediate','Perlu Modifikasi','leg press');
check('KR-02',{f4:'a',f13:'b'},'Intermediate','Perlu Modifikasi','good morning');
check('KR-03',{f4:'a',f13:'a'},'Intermediate','Perlu Modifikasi','upright row');
check('KR-04',{f14:'a'},'Expert','Perlu Modifikasi','konsultasikan');
check('KR-05',{f14:'b'},'Intermediate','Perlu Modifikasi','low-impact');
check('KR-06',{f11:'a',f15:'a'},'Expert','Perlu Modifikasi','pistol squat');
check('KR-07',{f11:'a',f15:'b'},'Expert','Perlu Modifikasi','pull-up');
check('KR-08',{f11:'a',f15:'c'},'Expert','Perlu Modifikasi','rack pull');
check('KR-09',{f12:'a',f5:'c'},'Intermediate','Perlu Modifikasi','1rm');
check('KR-10',{f12:'c',f9:'c'},'Expert','Perlu Modifikasi','keseimbangan');
check('KR-11',{f4:'a',f9:'c'},'Expert','Tidak Disarankan','cedera aktif');
check('KR-12',{f14:'a',f9:'c'},'Expert','Tidak Disarankan','hiit');
check('KR-L1',{f4:'a',f13:'other'},'Intermediate','Perlu Modifikasi','low-impact');
check('KR-L2',{f14:'other'},'Intermediate','Perlu Modifikasi','dokter');
check('KR-L3',{f15:'other'},'Intermediate','Perlu Modifikasi','berisiko tinggi');

// F4 = "Kadang ada keluhan" (b): F19 = Perlu Modifikasi TAPI F18 tidak turun,
// untuk semua pilihan F13 (Bahu/Leher, Punggung Bawah, Lutut/Engkel, Lainnya).
check('KR-01b (kadang ada keluhan)',{f4:'b',f13:'a'},'Expert','Perlu Modifikasi','bahu/leher');
check('KR-02b (kadang ada keluhan)',{f4:'b',f13:'b'},'Expert','Perlu Modifikasi','punggung bawah');
check('KR-03b (kadang ada keluhan)',{f4:'b',f13:'c'},'Expert','Perlu Modifikasi','lutut/engkel');
check('KR-Lb (kadang ada keluhan + lainnya)',{f4:'b',f13:'other'},'Expert','Perlu Modifikasi','low-impact');

let r=run({f4:'a',f13:'c',f14:'b',f15:'other',f9:'c'});assert.equal(r.f18,'Intermediate');assert.equal(r.f19,'Tidak Disarankan');
assert.equal(run({f5:'a'}).f20,'Circuit Style');assert.equal(run({f5:'b'}).f20,'Compound-First');assert.equal(run({f5:'c'}).f20,'Compound-Only');
// F4 = "Sehat bugar" (c): tidak ada penurunan level, F19 tetap Aman.
assert.equal(run({f4:'c'}).f19,'Aman');
assert.equal(run({f14:'c'}).f19,'Aman');
// F4 = "Kadang ada keluhan" (b) + F13 = Lutut/Engkel: F18 TETAP sama dengan F17 (tidak turun).
{const r2=run({f4:'b',f13:'c'},'Expert');assert.equal(r2.f18,'Expert',"F4=b + F13=c: F18 harus tetap sama dengan F17");assert.equal(r2.f19,'Perlu Modifikasi');}
console.log('PASS: KR-01..KR-12, KR-L1..KR-L3, F4=kadang ada keluhan, konflik, F19 dan F20');
