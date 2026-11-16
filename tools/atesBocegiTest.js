// atesBocegiTest.js — Ates Bocegi cekirdegi (8.1) ve ekonomi blogu (8.5).
// Calistirma:  node tools/atesBocegiTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const DOSYA = path.join(__dirname, '..', 'js', 'atesBocegi.js');
const kaynak = fs.readFileSync(DOSYA, 'utf8');
const AB = require(DOSYA);
const A = AB.AYAR, DT = A.dunya.DT, XB = A.dunya.X_BOCEK;

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}
const yakin = (a, b, tol, ad) => assert.ok(Math.abs(a - b) <= tol, (ad || '') + ' beklenen ' + b + ' bulunan ' + a);
const kopya = o => JSON.parse(JSON.stringify(o));
function ayarKopya() { return kopya(A); }

// Engelsiz durum: uretici cok ileri itilir, dilimler elle kurulur.
function bosDurum(tohum) {
  const d = AB.oyunOlustur(tohum || 1);
  d.dilimler = [];
  d.uretici.x = 1e12;
  return d;
}
function dilim(engeller, toz, kivilcim) {
  return { no: 0, x: 1e9, w: 0, tur: 'test', nefes: 0, c: 50, ust: 0, alt: 100,
           engeller: engeller || [], toz: toz || [], kivilcim: kivilcim || null };
}
function adimla(d, n, basili) { const o = []; for (let i = 0; i < n; i++) o.push(...AB.adim(d, basili)); return o; }
const say = (olaylar, tur) => olaylar.filter(o => o.tur === tur).length;

console.log('Ayar');
dene('ayarDogrula(AYAR) bos dizi', () => assert.deepStrictEqual(AB.ayarDogrula(A), []));
dene('AYAR derin dondurulmus', () => {
  assert.ok(Object.isFrozen(A) && Object.isFrozen(A.adalet) && Object.isFrozen(A.adalet.SIS) && Object.isFrozen(A.uretici.AGIRLIK[0]));
});
dene('AYAR gruplari 3.8', () => assert.deepStrictEqual(Object.keys(A).sort(),
  ['adalet', 'dunya', 'ekonomi', 'hareket', 'isik', 'puan', 'uretici', 'zorluk']));
dene('bozuk ayar: R_TAVAN < minYaricap(HIZ_TAVAN)', () => { const a = ayarKopya(); a.adalet.R_TAVAN = 30; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: R_TAVAN > W - X_BOCEK - 2', () => { const a = ayarKopya(); a.adalet.R_TAVAN = 41; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: dusen tetik mesafesi >= minYaricap', () => { const a = ayarKopya(); a.uretici.DUSEN_UYARI = 0.25; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: kivilcim/toz cizim orani < 1,8', () => { const a = ayarKopya(); a.hareket.R_KIVILCIM_GORSEL = a.hareket.R_TOZ_GORSEL * 1.7; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: tAra tabani T_MIN + T_IVME altinda', () => { const a = ayarKopya(); a.zorluk.TARA_Z = 1.2; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('kivilcim/toz cizim yaricap orani >= 1,8', () => assert.ok(A.hareket.R_KIVILCIM_GORSEL / A.hareket.R_TOZ_GORSEL >= 1.8));
dene('bozuk AYAR ile modul yuklenirken throw', () => {
  const bozuk = kaynak.replace(/R_TAVAN:\s*40/, 'R_TAVAN: 30');
  assert.notStrictEqual(bozuk, kaynak);
  const m = { exports: {} };
  assert.throws(() => vm.runInNewContext(bozuk, { module: m, Math: Math, Object: Object }));
});
dene('cekirdekte Math.random ve Date yok', () => {
  const kod = kaynak.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/Math\s*\.\s*random/.test(kod), 'Math.random var');
  assert.ok(!/\bDate\b/.test(kod), 'Date var');
  assert.ok(!/\b(document|window)\b/.test(kod), 'DOM erisimi var');
});

console.log('Saf islevler');
dene('rngOlustur: ayni tohum ayni dizi, [0,1)', () => {
  const a = AB.rngOlustur(42), b = AB.rngOlustur(42), c = AB.rngOlustur(43);
  let fark = 0;
  for (let i = 0; i < 1000; i++) { const x = a(); assert.strictEqual(x, b()); assert.ok(x >= 0 && x < 1); if (x !== c()) fark++; }
  assert.ok(fark > 990);
});
dene('zorluk(0) = taban degerleri', () => {
  const z = AB.zorluk(0);
  assert.strictEqual(z.z, 0); assert.strictEqual(z.hiz, 24); assert.strictEqual(z.tAra, 1.9);
  assert.strictEqual(z.bosluk, 24); assert.strictEqual(z.sizinti, 0.028);
});
dene('zorluk(9000) ~%63, zorluk(1e7) tavanda', () => {
  const z = AB.zorluk(9000); yakin(z.z, 1 - Math.exp(-1), 1e-12);
  yakin(z.hiz, 24 + 18 * z.z + 2 * Math.log2(1 + 9000 / 40000), 1e-9);
  const t = AB.zorluk(1e7); assert.strictEqual(t.hiz, 44); yakin(t.tAra, 1.25, 1e-9); yakin(t.bosluk, 16, 1e-9); yakin(t.sizinti, 0.05, 1e-9);
});
dene('zorluk: hiz monoton artar', () => { let o = 0; for (let d = 0; d < 200000; d += 97) { const h = AB.zorluk(d).hiz; assert.ok(h >= o); o = h; } });
dene('minYaricap(24)=20, (44)=35', () => { yakin(AB.minYaricap(24), 20, 1e-9); yakin(AB.minYaricap(44), 35, 1e-9); });
dene('isikYaricapi: taban, tavan, sis', () => {
  yakin(AB.isikYaricapi(0, 24, 0), 20, 1e-9);
  yakin(AB.isikYaricapi(1, 24, 0), 40, 1e-9);
  yakin(AB.isikYaricapi(1, 24, 3), 34, 1e-9);
  yakin(AB.isikYaricapi(0, 44, 3), 35, 1e-9);
  yakin(AB.isikYaricapi(0.5, 24, 1), 29, 1e-9);
});
dene('bolgeNo', () => {
  assert.deepStrictEqual([0, 499, 500, 999, 1000, 1500, 1999, 2000, 2500].map(AB.bolgeNo), [0, 0, 1, 1, 2, 3, 3, 0, 1]);
});
dene('carpan', () => {
  assert.deepStrictEqual([0, 4, 5, 9, 10, 15, 29, 30, 1000].map(AB.carpan), [1, 1, 1.5, 1.5, 2, 2.5, 3.5, 4, 4]);
});

console.log('Hareket');
dene('basili 1 sn: kapali bicim (zeminden)', () => {
  const d = bosDurum(); d.y = 96; d.vy = 0;
  let enHizli = 0;
  for (let i = 0; i < 120; i++) { AB.adim(d, true); enHizli = Math.min(enHizli, d.vy); }
  const Ay = A.hareket.A_YUKSEL, V = A.hareket.VY_YUKARI, tv = V / Ay;
  yakin(d.y, 96 - (V * V / (2 * Ay) + V * (1 - tv)), 0.5, 'y');
  assert.strictEqual(d.vy, -V); assert.ok(enHizli >= -V);
});
dene('birakili 1 sn: kapali bicim (tavandan)', () => {
  const d = bosDurum(); d.y = 4; d.vy = 0;
  let enHizli = 0;
  for (let i = 0; i < 120; i++) { AB.adim(d, false); enHizli = Math.max(enHizli, d.vy); }
  const G = A.hareket.G_SUZUL, V = A.hareket.VY_ASAGI, tv = V / G;
  yakin(d.y, 4 + (V * V / (2 * G) + V * (1 - tv)), 0.5, 'y');
  assert.strictEqual(d.vy, V); assert.ok(enHizli <= V);
});
dene('ilk adim yari ortuk Euler', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; AB.adim(d, true);
  yakin(d.vy, -260 * DT, 1e-12); yakin(d.y, 50 - 260 * DT * DT, 1e-12);
});
dene('tavan/zemin kistirmasi, sinirda vy = 0, hasar yok', () => {
  const d = bosDurum(); d.y = 50;
  let o = adimla(d, 240, true); assert.strictEqual(d.y, 4); assert.strictEqual(d.vy, 0);
  o = o.concat(adimla(d, 480, false)); assert.strictEqual(d.y, 96); assert.strictEqual(d.vy, 0);
  assert.strictEqual(say(o, 'hasar'), 0); assert.ok(d.isik > 1 - 0.03 * 6);
});

console.log('Determinizm');
function girdi(i) { return ((i * 7919) % 97) < 45; }
function kos(tohum, n, g) { const d = AB.oyunOlustur(tohum); for (let i = 0; i < n; i++) AB.adim(d, g(i)); return d; }
dene('ayni tohum + ayni girdi: 10.000 adim JSON esit', () => {
  const a = JSON.stringify(kos(12345, 10000, girdi)), b = JSON.stringify(kos(12345, 10000, girdi));
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, JSON.stringify(kos(12346, 10000, girdi)));
});
dene('farkli kare hizi taklidi (ayni adim sayisi) ayni sonuc', () => {
  const sonuc = kareler => {
    const d = AB.oyunOlustur(777); let birikim = 0, n = 0, k = 0;
    while (n < 6000) {
      birikim += Math.min(kareler[k++ % kareler.length], 0.1);
      let adimSay = 0;
      while (birikim >= DT && n < 6000) {
        if (adimSay === 12) { birikim = 0; break; }
        AB.adim(d, girdi(n)); n++; birikim -= DT; adimSay++;
      }
    }
    return JSON.stringify(d);
  };
  const s60 = sonuc([1 / 60]), s144 = sonuc([1 / 144]), sKarisik = sonuc([0.016, 0.033, 0.007, 0.05, 0.02]);
  assert.strictEqual(s60, s144); assert.strictEqual(s60, sKarisik);
});
dene('durum alanlari ve JSON', () => {
  const d = AB.oyunOlustur(5);
  ['t', 'mesafe', 'puan', 'y', 'vy', 'isik', 'dokunulmaz', 'zincir', 'zincirSure', 'toz', 'bolge', 'bitti', 'dilimler', 'tohum']
    .forEach(k => assert.ok(k in d, k));
  assert.ok(Array.isArray(d.dilimler) && d.dilimler.length > 0);
  assert.deepStrictEqual(kopya(d), JSON.parse(JSON.stringify(d)));
});

console.log('Uretici');
dene('ayni tohum ayni dilim dizisi', () => {
  const a = AB.ureticiOlustur(99), b = AB.ureticiOlustur(99);
  for (let i = 0; i < 300; i++) { const bl = (i >> 5) & 3; assert.deepStrictEqual(a.sonraki(bl), b.sonraki(bl)); }
});
dene('bolge sabitken dilim dizisi girdiden bagimsiz', () => {
  const kayit = g => {
    const d = AB.oyunOlustur(2024), dizi = {};
    for (let i = 0; i < 20000; i++) {
      d.isik = 1; d.puan = 0; AB.adim(d, g(i));
      d.dilimler.forEach(s => { if (!(s.no in dizi)) dizi[s.no] = JSON.stringify([s.x, s.c, s.ust, s.alt, s.tur, s.engeller.map(e => [e.tur, e.x, e.h, e.w]), s.toz.map(t => [t.x, t.y]), s.kivilcim && [s.kivilcim.x, s.kivilcim.y]]); });
    }
    return dizi;
  };
  const a = kayit(() => false), b = kayit(() => true), c = kayit(girdi);
  assert.ok(Object.keys(a).length > 50);
  assert.deepStrictEqual(a, b); assert.deepStrictEqual(a, c);
});
dene('acilis: ilk 3 dilim yalniz dal, bosluk 30, merkez farki <= 10', () => {
  for (let t = 1; t <= 200; t++) {
    const u = AB.ureticiOlustur(t); let c = A.dunya.Y_BASLA;
    for (let i = 0; i < 3; i++) {
      const s = u.sonraki(0), z = AB.dilimZarfi(s);
      assert.strictEqual(s.tur, 'dal'); assert.ok(s.engeller.every(e => e.tur === 'dal'));
      yakin(z.alt - z.ust, 30, 1e-9); assert.ok(Math.abs(s.c - c) <= 10 + 1e-9); c = s.c;
    }
  }
});
dene('bolge degisince nefes dilimi: engel yok, toz var', () => {
  const u = AB.ureticiOlustur(7);
  for (let i = 0; i < 6; i++) u.sonraki(0);
  const n = u.sonraki(1), s = u.sonraki(1);
  assert.strictEqual(n.nefes, 1); assert.strictEqual(n.engeller.length, 0); assert.ok(n.toz.length >= 3);
  assert.strictEqual(s.nefes, 0); assert.ok(s.engeller.length > 0);
});
dene('dilimZarfi {ust, alt}', () => {
  const u = AB.ureticiOlustur(3), s = u.sonraki(0), z = AB.dilimZarfi(s);
  assert.deepStrictEqual(Object.keys(z).sort(), ['alt', 'ust']); assert.ok(z.alt > z.ust);
});
dene('dilim nesnesi cizim alanlari', () => {
  const u = AB.ureticiOlustur(11), tur = {};
  for (let i = 0; i < 600; i++) {
    const s = u.sonraki((i >> 4) & 3);
    s.engeller.forEach(e => {
      tur[e.tur] = 1;
      ['x', 'y', 'w', 'h'].forEach(k => assert.ok(Number.isFinite(e[k]), e.tur + '.' + k));
      if (e.tur === 'kus') assert.ok(Number.isFinite(e.x0) && e.ek === A.adalet.KUS_EK);
      if (e.tur === 'dusen') assert.ok(Number.isFinite(e.sarmasik) && e.faz === 0 && e.sure === 0);
    });
    s.toz.forEach(t => assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y) && t.alindi === 0));
  }
  assert.deepStrictEqual(Object.keys(tur).sort(), ['ag', 'dal', 'dusen', 'kus']);
});

console.log('Carpisma, isik, puan, zincir');
dene('dal: isik -0,34, zincir 0, dokunulmaz 1 sn, tek hasar', () => {
  const d = bosDurum(); d.y = 50; d.zincir = 7; d.zincirSure = 1.5;
  d.dilimler = [dilim([{ tur: 'dal', x: XB - 2, y: 40, w: 1000, h: 20 }])];
  const once = d.isik;
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'hasar'), 1); assert.strictEqual(d.zincir, 0);
  yakin(d.isik, once - 0.34 - AB.zorluk(0).sizinti * DT, 1e-9); yakin(d.dokunulmaz, 1, 1e-12);
  const o2 = adimla(d, 100, false);
  assert.strictEqual(say(o2, 'hasar'), 0, 'dokunulmazken hasar');
});
dene('dokunulmazlik bitince yeniden hasar', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0;
  d.dilimler = [dilim([{ tur: 'dal', x: XB - 2, y: 0, w: 1e6, h: 100 }])];
  const o = adimla(d, 125, false);
  assert.strictEqual(say(o, 'hasar'), 2);
});
dene('ag: isik -0,17, olay ag', () => {
  const d = bosDurum(); d.y = 50; d.zincir = 3;
  d.dilimler = [dilim([{ tur: 'ag', x: XB, y: 45, w: 7, h: 14 }])];
  const once = d.isik, o = AB.adim(d, false);
  assert.strictEqual(say(o, 'ag'), 1); assert.strictEqual(say(o, 'hasar'), 0); assert.strictEqual(d.zincir, 0);
  yakin(d.isik, once - 0.17 - 0.028 * DT, 1e-6);
});
dene('kus hareketi: x = x0 - KUS_EK * mesafe, carpar', () => {
  const d = bosDurum(); d.y = 20;
  const k = { tur: 'kus', x: 0, x0: 100, y: 80, w: 5, h: 3.5, ek: A.adalet.KUS_EK };
  d.dilimler = [dilim([k])];
  adimla(d, 60, false);
  yakin(k.x, 100 - A.adalet.KUS_EK * d.mesafe, 1e-9);
  const d2 = bosDurum(); d2.y = 50; d2.vy = 0;
  d2.dilimler = [dilim([{ tur: 'kus', x: 0, x0: XB + 1 + 0, y: 48.25, w: 5, h: 3.5, ek: 0.25 }])];
  assert.strictEqual(say(AB.adim(d2, false), 'hasar'), 1);
});
dene('dusen dal: tetik, sallanma, dusus, durma', () => {
  const d = bosDurum(); d.y = 90;
  const hiz = AB.zorluk(0).hiz, tetik = hiz * (A.adalet.T_MIN + A.uretici.DUSEN_UYARI);
  const e = { tur: 'dusen', x: XB + tetik + 3, y: 0, w: 5, h: 8, sarmasik: 20, faz: 0, sure: 0 };
  d.dilimler = [dilim([e])];
  let n = 0;
  while (e.faz === 0 && n < 1000) { AB.adim(d, false); n++; }
  assert.strictEqual(e.faz, 1); assert.ok(e.x - (d.mesafe + XB) <= tetik + 1e-9);
  let s = 0; while (e.faz === 1) { AB.adim(d, false); s++; }
  yakin(s * DT, A.uretici.DUSEN_UYARI, DT + 1e-9, 'sallanma');
  assert.strictEqual(e.y, 0);
  let f = 0; while (e.faz === 2) { AB.adim(d, false); f++; }
  assert.strictEqual(e.faz, 3); assert.strictEqual(e.y, 20); yakin(f * DT, 20 / 60, DT + 1e-9, 'dusus');
});
dene('dusen dala carpma: hasar 0,34', () => {
  const d = bosDurum(); d.y = 6;
  d.dilimler = [dilim([{ tur: 'dusen', x: XB, y: 0, w: 5, h: 8, sarmasik: 20, faz: 3, sure: 0 }])];
  d.dilimler[0].engeller[0].y = 2;
  assert.strictEqual(say(AB.adim(d, false), 'hasar'), 1);
});
dene('toz: isik +0,035, puan 2*carpan, zincir +1, zincirSure 1,5', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.isik = 0.5; d.zincir = 5;
  d.dilimler = [dilim([], [{ x: XB + 0.2, y: 50, alindi: 0 }])];
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'toz'), 1); assert.strictEqual(d.puan, 3); assert.strictEqual(d.zincir, 6);
  assert.strictEqual(d.zincirSure, 1.5); assert.strictEqual(d.toz, 1); assert.strictEqual(d.dilimler[0].toz[0].alindi, 1);
  yakin(d.isik, 0.5 + 0.035 - 0.028 * DT, 1e-9);
  assert.strictEqual(say(AB.adim(d, false), 'toz'), 0, 'ikinci kez alinmaz');
});
dene('toz isigi 1 ustune cikarmaz', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.isik = 0.99;
  d.dilimler = [dilim([], [{ x: XB, y: 50, alindi: 0 }])];
  AB.adim(d, false); assert.ok(d.isik <= 1);
});
dene('toplama yaricapi R_TOPLA', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0;
  d.dilimler = [dilim([], [{ x: XB + 0.1, y: 50 + 3.4, alindi: 0 }, { x: XB + 0.1, y: 50 - 3.0, alindi: 0 }])];
  assert.strictEqual(say(AB.adim(d, false), 'toz'), 1);
});
dene('kivilcim: isik +0,25, puan 50*carpan', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.isik = 0.4; d.zincir = 10;
  d.dilimler = [dilim([], [], { x: XB, y: 50, alindi: 0 })];
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'kivilcim'), 1); assert.strictEqual(d.puan, 100);
  yakin(d.isik, 0.65 - 0.028 * DT, 1e-9); assert.strictEqual(d.dilimler[0].kivilcim.alindi, 1);
});
dene('zincir zaman asimi 1,5 sn', () => {
  const d = bosDurum(); d.y = 50; d.zincir = 4; d.zincirSure = 1.5;
  adimla(d, 179, false); assert.strictEqual(d.zincir, 4);
  adimla(d, 2, false); assert.strictEqual(d.zincir, 0);
});
dene('mesafe puani: her 4 birimde 1', () => {
  const d = bosDurum(); d.y = 50;
  adimla(d, 1200, false);
  assert.strictEqual(d.puan, Math.floor(d.mesafe / 4));
});
dene('bolge olayi puan 500 gecince', () => {
  const d = bosDurum(); d.puan = 499; d.y = 50;
  let o = []; while (!o.length || say(o, 'bolge') === 0) { o = AB.adim(d, false); if (d.t > 10) break; }
  assert.strictEqual(say(o, 'bolge'), 1); assert.strictEqual(d.bolge, 1);
});
dene('isik <= 0 -> bitti tek kez, sonra adim bos', () => {
  const d = bosDurum(); d.y = 50; d.isik = 0.0005;
  const o = adimla(d, 200, false);
  assert.strictEqual(say(o, 'bitti'), 1); assert.strictEqual(d.bitti, 1);
  const t = d.t; assert.deepStrictEqual(AB.adim(d, true), []); assert.strictEqual(d.t, t);
});
dene('hasar ile bitis tek bitti', () => {
  const d = bosDurum(); d.y = 50; d.isik = 0.2;
  d.dilimler = [dilim([{ tur: 'dal', x: 0, y: 0, w: 1e6, h: 100 }])];
  const o = adimla(d, 300, false);
  assert.strictEqual(say(o, 'bitti'), 1); assert.strictEqual(say(o, 'hasar'), 1);
});
dene('dilimler 2W ileriye kadar uretilir, arkadakiler atilir', () => {
  const d = AB.oyunOlustur(31);
  for (let i = 0; i < 6000; i++) {
    d.isik = 1; AB.adim(d, girdi(i));
    const son = d.dilimler[d.dilimler.length - 1], ilk = d.dilimler[0];
    assert.ok(son.x > d.mesafe + XB + 2 * A.dunya.W);
    assert.ok(ilk.x + ilk.w >= d.mesafe - 1 - 50);
  }
  assert.ok(d.dilimler.length < 12);
});

// ---- Ekonomi: blok ayrica kesilip calistirilir ----
console.log('Ekonomi (EKONOMI blogu)');
const bas = kaynak.indexOf('// EKONOMI-BASI'), son = kaynak.indexOf('// EKONOMI-SONU');
const ctx = {};
vm.runInNewContext(kaynak.slice(bas, son) + '\nthis.esik = esikOdulu; this.kosu = kosuJetonu;', ctx);
const AY = kopya(A);
const esik = (e, p) => kopya(ctx.esik(e, p, AY)), kosu = (p, t, g) => kopya(ctx.kosu(p, t, g, AY));
dene('blok isaretleri var, kesilen blok modulle ayni', () => {
  assert.ok(bas > 0 && son > bas);
  [[0, 16000], [3000, 3001], [999, 70000]].forEach(([e, p]) => assert.deepStrictEqual(esik(e, p), AB.esikOdulu(e, p, A)));
  [[3600, 20, 190], [300, 10, 0], [299, 10, 0]].forEach(([p, t, g]) => assert.deepStrictEqual(kosu(p, t, g), AB.kosuJetonu(p, t, g, A)));
});
dene('aktif sinirlari: puan 299/300, toz 9/10', () => {
  assert.deepStrictEqual(kosu(299, 10, 0), { jeton: 0, ham: 0, aktif: false });
  assert.deepStrictEqual(kosu(300, 9, 0), { jeton: 0, ham: 0, aktif: false });
  assert.deepStrictEqual(kosu(300, 10, 0), { jeton: 2, ham: 2, aktif: true });
});
dene('ham = floor(puan / 150), kosu tavani 40', () => {
  assert.strictEqual(kosu(800, 30, 0).jeton, 5);
  assert.strictEqual(kosu(3600, 30, 0).jeton, 24);
  assert.strictEqual(kosu(5999, 30, 0).ham, 39);
  assert.strictEqual(kosu(6000, 30, 0).ham, 40);
  assert.strictEqual(kosu(1e7, 30, 0).ham, 40);
});
dene('gunluk sinir: gunJeton 190 + ham 24 -> 10 + 3', () => assert.deepStrictEqual(kosu(3600, 20, 190), { jeton: 13, ham: 24, aktif: true }));
dene('gunluk sinirin iki yani: 176 tam, 177 bolunur', () => {
  assert.strictEqual(kosu(3600, 20, 176).jeton, 24);
  assert.strictEqual(kosu(3600, 20, 177).jeton, 23);
  assert.strictEqual(kosu(3600, 20, 200).jeton, 6);
  assert.strictEqual(kosu(3600, 20, 1000).jeton, 6);
});
dene('gun degisimi: gunJeton 0 ile yeniden tam odenir', () => {
  let g = 0, top = 0;
  for (let i = 0; i < 12; i++) { const r = kosu(3600, 20, g); top += r.jeton; g += r.ham; }
  assert.strictEqual(g, 288); assert.strictEqual(top, 8 * 24 + (8 + 4) + 3 * 6);
  const yeniGun = kosu(3600, 20, 0); assert.strictEqual(yeniGun.jeton, 24);
});
dene('esikOdulu: 0 -> 16.000 = 400 (5 esik)', () => assert.deepStrictEqual(esik(0, 16000), { jeton: 400, adet: 5 }));
dene('esik tam ustu sayilir, alti sayilmaz', () => {
  assert.strictEqual(esik(0, 999).jeton, 0); assert.strictEqual(esik(0, 1000).jeton, 25); assert.strictEqual(esik(1000, 1999).jeton, 0);
});
dene('rekoru 1 puan gecmek 0, rekorun alti odenmez', () => {
  assert.strictEqual(esik(3000, 3001).jeton, 0);
  assert.strictEqual(esik(20000, 10000).jeton, 0);
  assert.strictEqual(esik(16000, 16000).jeton, 0);
});
dene('liste sonrasi +100: 128k=400, 256k=500', () => {
  assert.strictEqual(esik(64000, 128000).jeton, 400);
  assert.strictEqual(esik(128000, 256000).jeton, 500);
  assert.strictEqual(esik(0, 64000).jeton, 25 + 50 + 75 + 100 + 150 + 200 + 300);
});
dene('esikler bir kez: parca parca toplam = tek seferde', () => {
  const r = [0, 1500, 4100, 4200, 9000, 70000, 300000];
  let top = 0; for (let i = 1; i < r.length; i++) top += esik(r[i - 1], r[i]).jeton;
  assert.strictEqual(top, esik(0, 300000).jeton);
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
