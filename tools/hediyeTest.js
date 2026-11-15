// hediyeTest.js — harita hediye kutusu kurallarini dener (core.js HEDIYE blogu).
// Calistirma:  node tools/hediyeTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const kaynak = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// ---- HEDIYE blogu ve kayit gocu core.js'ten kesilir ----
const hb = kaynak.indexOf('// HEDIYE-BASI'), hs = kaynak.indexOf('// HEDIYE-SONU');
const gb = kaynak.indexOf('const KAYIT_SURUM'), gs = kaynak.indexOf('window.AppKayitGoc');
if (hb < 0 || hs < 0 || gb < 0 || gs < 0) { console.error('core.js icinde HEDIYE / gocEt bolumu bulunamadi'); process.exit(1); }
const ctx = {};
vm.runInNewContext(kaynak.slice(gb, gs) + '\n' + kaynak.slice(hb, hs) +
  '\nthis.gocEt = gocEt; this.varsayilan = varsayilanIlerleme; this.takvim = HEDIYE_TAKVIM;' +
  ' this.durum = hediyeDurum; this.al = hediyeAl;', ctx);
const { gocEt, varsayilan, takvim, durum, al } = ctx;
const kopya = o => JSON.parse(JSON.stringify(o));
const OYUNLAR = ['kacis', 'ss'];
const gecir = (p, oyun, n) => { (oyun === 'kacis' ? p.kacisHearts : p.ssYildiz)[n] = 1; };

console.log('harita hediye kutusu');

dene('takvim: yalniz 8 bolum, oyun basina toplam 5200', () => {
  assert.deepStrictEqual(kopya(takvim), { 20: 300, 40: 300, 60: 300, 80: 300, 100: 1000, 150: 1000, 200: 1000, 250: 1000 });
  const p = varsayilan();
  OYUNLAR.forEach(oyun => {
    let toplam = 0, adet = 0;
    for (let n = 1; n <= 300; n++) { if (durum(p, oyun, n) !== 'yok') { adet++; gecir(p, oyun, n); toplam += al(p, oyun, n); } }
    assert.strictEqual(adet, 8, oyun);
    assert.strictEqual(toplam, 5200, oyun);
  });
});

dene('durum gecisleri: kilitli -> al -> alindi', () => {
  OYUNLAR.forEach(oyun => {
    const p = varsayilan();
    assert.strictEqual(durum(p, oyun, 20), 'kilitli');
    gecir(p, oyun, 20);
    assert.strictEqual(durum(p, oyun, 20), 'al');
    assert.strictEqual(al(p, oyun, 20), 300);
    assert.strictEqual(durum(p, oyun, 20), 'alindi');
    assert.strictEqual(p.hediye[oyun][20], 1);
  });
});

dene('gecilmeden alinamaz (0 doner, isaret yazilmaz)', () => {
  OYUNLAR.forEach(oyun => {
    const p = varsayilan();
    assert.strictEqual(al(p, oyun, 100), 0);
    assert.deepStrictEqual(kopya(p.hediye[oyun]), {});
    assert.strictEqual(durum(p, oyun, 100), 'kilitli');
  });
});

dene('iki kez alinamaz (ikinci 0, coin artmaz)', () => {
  OYUNLAR.forEach(oyun => {
    const p = varsayilan(); gecir(p, oyun, 150);
    let coin = 0;
    coin += al(p, oyun, 150);
    coin += al(p, oyun, 150);
    assert.strictEqual(coin, 1000);
    // kayit diske yazilip geri okunsa da (goc dahil) tekrar alinamaz
    const q = gocEt(kopya(p)).p;
    assert.strictEqual(durum(q, oyun, 150), 'alindi');
    assert.strictEqual(al(q, oyun, 150), 0);
  });
});

dene('geriye donuk: 20-100 gecmis eski kayit -> 5 kutu "al", toplam 2200', () => {
  const kh = {}, sy = {};
  for (let n = 1; n <= 100; n++) { kh[n] = 3; sy[n] = 2; }
  const p = gocEt({ surum: 1, unlocked: 100, kacisHearts: kh, ssAcik: 101, ssYildiz: sy, gold: 50 }).p;
  OYUNLAR.forEach(oyun => {
    const alinabilir = Object.keys(takvim).filter(n => durum(p, oyun, n) === 'al');
    assert.deepStrictEqual(alinabilir, ['20', '40', '60', '80', '100'], oyun);
    ['150', '200', '250'].forEach(n => assert.strictEqual(durum(p, oyun, n), 'kilitli'));
    const toplam = alinabilir.reduce((t, n) => t + al(p, oyun, Number(n)), 0);
    assert.strictEqual(toplam, 2200, oyun);
  });
  assert.strictEqual(p.unlocked, 101);
});

dene('iki oyun birbirinden bagimsiz', () => {
  const p = varsayilan();
  gecir(p, 'kacis', 40);
  assert.strictEqual(durum(p, 'ss', 40), 'kilitli');
  assert.strictEqual(al(p, 'ss', 40), 0);
  assert.strictEqual(al(p, 'kacis', 40), 300);
  gecir(p, 'ss', 40);
  assert.strictEqual(durum(p, 'ss', 40), 'al');
  assert.strictEqual(al(p, 'ss', 40), 300);
  assert.deepStrictEqual(kopya(p.hediye), { kacis: { 40: 1 }, ss: { 40: 1 } });
});

dene('takvim disi bolum / bilinmeyen oyun -> "yok", odul 0', () => {
  const p = varsayilan();
  [1, 19, 21, 99, 101, 120, 251, 0, -20, 'constructor', 'toString', '__proto__'].forEach(n => {
    gecir(p, 'kacis', n); gecir(p, 'ss', n);
    OYUNLAR.forEach(oyun => {
      assert.strictEqual(durum(p, oyun, n), 'yok', oyun + ' ' + n);
      assert.strictEqual(al(p, oyun, n), 0, oyun + ' ' + n);
    });
  });
  gecir(p, 'kacis', 20);
  assert.strictEqual(durum(p, 'sso', 20), 'yok');
  assert.strictEqual(al(p, 'ozel', 20), 0);
});

dene('Kacis "o20" ozel anahtari normal 20. bolumu acmaz', () => {
  const p = varsayilan();
  p.kacisHearts.o20 = 3; p.kacisHearts.o100 = 3;
  assert.strictEqual(durum(p, 'kacis', 20), 'kilitli');
  assert.strictEqual(al(p, 'kacis', 20), 0);
  assert.strictEqual(durum(p, 'kacis', 'o20'), 'yok');
  assert.strictEqual(al(p, 'kacis', 'o20'), 0);
  assert.strictEqual(durum(p, 'kacis', 100), 'kilitli');
});

dene('Su Sirala ozel yildizlari (ssoYildiz) sayilmaz', () => {
  const p = varsayilan(); p.ssoYildiz[20] = 3;
  assert.strictEqual(durum(p, 'ss', 20), 'kilitli');
});

dene('Kacis: 0 kalple bitirilen bolum (kacisHearts yok, unlocked ilerde) gecilmis sayilir', () => {
  const p = varsayilan(); p.unlocked = 21;
  assert.strictEqual(durum(p, 'kacis', 20), 'al');
  assert.strictEqual(durum(p, 'kacis', 40), 'kilitli');
  assert.strictEqual(al(p, 'kacis', 20), 300);
  assert.strictEqual(durum(p, 'ss', 20), 'kilitli');   // Su Sirala tanimi degismez
});

dene('Kacis: unlocked 20 + kayit yok -> kilitli', () => {
  const p = varsayilan(); p.unlocked = 20;
  assert.strictEqual(durum(p, 'kacis', 20), 'kilitli');
  assert.strictEqual(al(p, 'kacis', 20), 0);
});

dene('Kacis: unlocked 20 iken "o20" yine acmaz', () => {
  const p = varsayilan(); p.unlocked = 20; p.kacisHearts.o20 = 3;
  assert.strictEqual(durum(p, 'kacis', 20), 'kilitli');
});

dene('Kacis: bozuk unlocked (metin / NaN / Infinity / null) cokmeden kilitli', () => {
  ['300', 'abc', NaN, Infinity, null, undefined, {}, [300]].forEach(u => {
    const p = varsayilan(); p.unlocked = u;
    assert.strictEqual(durum(p, 'kacis', 20), 'kilitli', String(u));
    assert.strictEqual(al(p, 'kacis', 20), 0, String(u));
  });
});

dene('sifirlama akisi (AppProgress = varsayilanIlerleme()): tum kutular kilitli, al 0', () => {
  // "Ilerlemeyi Sifirla" oncesi: her sey gecilmis, bir kismi alinmis
  let p = varsayilan(); p.unlocked = 251;
  Object.keys(takvim).forEach(n => { gecir(p, 'kacis', n); gecir(p, 'ss', n); });
  al(p, 'kacis', 20); al(p, 'ss', 100);
  p.gold = 9999;
  // resetBtn: Store.del + window.AppProgress = varsayilanIlerleme()
  p = varsayilan();
  OYUNLAR.forEach(oyun => Object.keys(takvim).forEach(n => {
    assert.strictEqual(durum(p, oyun, n), 'kilitli', oyun + ' ' + n);
    assert.strictEqual(al(p, oyun, n), 0, oyun + ' ' + n);
  }));
  assert.deepStrictEqual(kopya(p.hediye), { kacis: {}, ss: {} });
  assert.strictEqual(p.gold, 0);
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
