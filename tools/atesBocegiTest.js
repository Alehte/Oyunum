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
dene('bozuk ayar: nefes engelsiz suresi < NEFES_SURE', () => { const a = ayarKopya(); a.uretici.NEFES_SURE = 3; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: V_GUVENLI T_IVME icinde kazanilamiyor', () => { const a = ayarKopya(); a.adalet.T_IVME = 0.1; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: rampa uzayinca T_IVME yetmiyor (sayisal cikis suresi)', () => {
  const a = ayarKopya(); a.hareket.T_RAMPA = 0.2;
  assert.ok(AB.ayarDogrula(a).some(h => /T_IVME/.test(h)), JSON.stringify(AB.ayarDogrula(a)));
});
dene('bozuk ayar: T_IVME kapali bicimle yeterli ama rampa dahil yetmiyor', () => {
  // eski denetim V/min(A) = 20/120 = 0,167 <= 0,2 gecerdi; rampa dahil gercek sure ~0,236
  const a = ayarKopya(); a.adalet.T_IVME = 0.2;
  assert.ok(a.adalet.V_GUVENLI / Math.min(a.hareket.A_YUKSEL, a.hareket.G_SUZUL) <= a.adalet.T_IVME);
  assert.ok(AB.ayarDogrula(a).length > 0);
});
dene('bozuk ayar: miknatis AFK yuksekliginden tozu cekebilir', () => {
  const a = ayarKopya(); a.hareket.R_MIKNATIS = 12; assert.ok(AB.ayarDogrula(a).length > 0);
});
dene('bozuk ayar: R_TOPLA > R_MIKNATIS', () => { const a = ayarKopya(); a.hareket.R_TOPLA = 8; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: AFK tavanda kivilcim toplayabilir', () => { const a = ayarKopya(); a.uretici.KIVILCIM_Y_MIN = 8; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: R_GORSEL < R_CARPMA', () => { const a = ayarKopya(); a.hareket.R_GORSEL = 1.5; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: sarmasik uyarisi T_MIN altinda', () => { const a = ayarKopya(); a.uretici.SARMASIK_UYARI = 0.5; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('bozuk ayar: sarmasik kacis degismezi (T_MIN + T_IVME + kacis > ONCE)', () => {
  const a = ayarKopya(); a.uretici.SARMASIK_ONCE = 1.0; a.uretici.SARMASIK_UYARI = 0.65;
  assert.ok(AB.ayarDogrula(a).some(h => /sarmasik/.test(h)), JSON.stringify(AB.ayarDogrula(a)));
});
dene('bozuk ayar: sarmasik zaman cizgisi tutarsiz (uyari + buyume > once)', () => {
  const a = ayarKopya(); a.uretici.SARMASIK_BUYUME = 0.5; assert.ok(AB.ayarDogrula(a).length > 0);
});
dene('bozuk ayar: esik puanlari ayri degil / serbest esik sarmasik altinda', () => {
  const a = ayarKopya(); a.uretici.SARMASIK_PUAN = a.uretici.TOZSUZ_PUAN; assert.ok(AB.ayarDogrula(a).length > 0);
  const b = ayarKopya(); b.uretici.CAKISMA_SERBEST = 1500; assert.ok(AB.ayarDogrula(b).length > 0);
});
dene('bozuk ayar: tozsuz pencere 0 dilim / olasilik tavani asiyor', () => {
  const a = ayarKopya(); a.uretici.TOZSUZ_MIN = 0; assert.ok(AB.ayarDogrula(a).length > 0);
  const b = ayarKopya(); b.uretici.TOZSUZ_OLASILIK = 0.2; assert.ok(AB.ayarDogrula(b).length > 0);
});
dene('bozuk ayar: bomba taban hizda kacilamiyor', () => { const a = ayarKopya(); a.hareket.R_BOMBA = 12; assert.ok(AB.ayarDogrula(a).length > 0); });
// Denetim bulgusu (kucuk 2): var olan ve yeni degismezlerin her biri icin bozuk ayar -> hata
[
  ['T_RAMPA <= 0', a => { a.hareket.T_RAMPA = 0; }],
  ['MIKNATIS_HIZ <= 0', a => { a.hareket.MIKNATIS_HIZ = 0; }],
  ['MIKNATIS_HIZ >= HIZ_TABAN (toz arkadan kovalar)', a => { a.hareket.MIKNATIS_HIZ = a.zorluk.HIZ_TABAN; }],
  ['CAKISMA_ARA < 1', a => { a.uretici.CAKISMA_ARA = 0; }],
  ['sarmasik uyarisi uretim ufkunun otesinde (ONDE)', a => { a.uretici.ONDE = 1; }],
  ['SARMASIK_SUTUN_MAX ic toz sayisini asiyor', a => { a.uretici.SARMASIK_SUTUN_MAX = 4; }],
  ['tozsuz dilimde serit yedegine ulasilamiyor', a => { a.uretici.MERKEZ_MIN = 13; a.uretici.MERKEZ_MAX = 87; }],
  ['tozsuz yedek dal tutma araligina sigmiyor', a => { a.uretici.TOZ_SAPMA = 6; }],
  ['tutma araligi tozsuz bandini asiyor (pencere iptali)', a => { a.uretici.TOZ_SAPMA = 4.5; }],
  ['hasar 0', a => { a.isik.BOMBA_HASAR = 0; }],
  ['hasar > 1', a => { a.isik.DAL_HASAR = 1.2; }],
  ['olasilik > 1', a => { a.uretici.SARMASIK_OLASILIK = 1.5; }],
  ['olasilik < 0', a => { a.uretici.KIVILCIM_OLASILIK = -0.1; }],
  ['tozsuz pencerede isik kaybi sinirin ustunde', a => { a.uretici.TOZSUZ_MAX = 4; }],
  ['PAY_KACIS_SN < 0', a => { a.adalet.PAY_KACIS_SN = -0.01; }]
].forEach(([ad, boz]) => dene('bozuk ayar: ' + ad, () => {
  const a = ayarKopya(); boz(a); assert.ok(AB.ayarDogrula(a).length > 0, 'hata yok');
}));
dene('bozuk ayar: sarmasik sutun tozu miknatisla erken cekilir', () => { const a = ayarKopya(); a.uretici.SARMASIK_BUYUME = 0.05; a.uretici.SARMASIK_UYARI = 1.15; assert.ok(AB.ayarDogrula(a).length > 0); });
dene('kivilcim/toz cizim yaricap orani >= 1,8', () => assert.ok(A.hareket.R_KIVILCIM_GORSEL / A.hareket.R_TOZ_GORSEL >= 1.8));
dene('bozuk AYAR ile modul yuklenirken throw', () => {
  const bozuk = kaynak.replace(/R_TAVAN:\s*40/, 'R_TAVAN: 30');
  assert.notStrictEqual(bozuk, kaynak);
  const m = { exports: {} };
  assert.throws(() => vm.runInNewContext(bozuk, { module: m, Math: Math, Object: Object }), /AYAR gecersiz/);
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

console.log('Yeni sabitler (tasarim 11)');
dene('hareket 11.1: 170 / 120 / 40 / 30, T_RAMPA 0,07, T_IVME 0,24', () => {
  const m = A.hareket;
  assert.deepStrictEqual([m.A_YUKSEL, m.G_SUZUL, m.VY_YUKARI, m.VY_ASAGI, m.T_RAMPA], [170, 120, 40, 30, 0.07]);
  assert.strictEqual(A.adalet.V_GUVENLI, 20); assert.strictEqual(A.adalet.T_IVME, 0.24);
});
dene('toplama 11.2-11.3: R_TOPLA 4,2, miknatis 7,5 / 20 (< HIZ_TABAN), R_GORSEL 3,0, R_CARPMA 1,6', () => {
  const m = A.hareket;
  assert.deepStrictEqual([m.R_TOPLA, m.R_MIKNATIS, m.MIKNATIS_HIZ, m.R_GORSEL, m.R_CARPMA], [4.2, 7.5, 20, 3.0, 1.6]);
  assert.ok(m.MIKNATIS_HIZ < A.zorluk.HIZ_TABAN);
  assert.strictEqual(A.adalet.PAY_KACIS_SN, 0.05);
  assert.ok(m.R_MIKNATIS < A.uretici.MERKEZ_MIN - A.uretici.TOZ_SAPMA - A.dunya.Y_UST);
  assert.ok(Number.isFinite(m.R_BOMBA) && m.R_BOMBA > A.hareket.R_TOZ_GORSEL);
});
dene('hasarlar 11.4: dal 0,50, kus/dusen 0,34, ag 0,17, bomba 0,25, sarmasik 0,20', () => {
  const i = A.isik;
  assert.deepStrictEqual([i.DAL_HASAR, i.HASAR, i.AG_HASAR, i.BOMBA_HASAR, i.SARMASIK_HASAR], [0.5, 0.34, 0.17, 0.25, 0.2]);
});
dene('esikler 11.5-11.8: tozsuz 800, bomba 1200, sarmasik 2000, serbest 5000', () => {
  const u = A.uretici;
  assert.deepStrictEqual([u.TOZSUZ_PUAN, u.BOMBA_PUAN, u.SARMASIK_PUAN, u.CAKISMA_SERBEST, u.CAKISMA_ARA], [800, 1200, 2000, 5000, 2]);
  assert.deepStrictEqual([u.TOZSUZ_MIN, u.TOZSUZ_MAX, u.TOZSUZ_ARA, u.TOZSUZ_TAVAN], [2, 3, 8, 0.1]);
  assert.deepStrictEqual([u.BOMBA_OLASILIK, u.SARMASIK_OLASILIK, u.SARMASIK_SUTUN_MIN, u.SARMASIK_SUTUN_MAX, u.SARMASIK_GEN, u.SARMASIK_TASMA], [0.2, 0.12, 2, 3, 3, 1]);
  assert.ok(u.SARMASIK_UYARI >= A.adalet.T_MIN);
});
dene('cikisSuresi(V_GUVENLI) <= T_IVME (rampa dahil sayisal)', () => {
  const t = AB.cikisSuresi(A.adalet.V_GUVENLI);
  assert.ok(t <= A.adalet.T_IVME, 't ' + t); assert.ok(t > A.adalet.V_GUVENLI / Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL), 'rampa sureyi uzatmali');
});
dene('kacisSuresi: 0 -> 0, monoton, aleyhte baslangic hizi uzatir', () => {
  assert.strictEqual(AB.kacisSuresi(0), 0);
  let o = 0; for (let dy = 0.5; dy < 30; dy += 0.5) { const t = AB.kacisSuresi(dy); assert.ok(t > o); o = t; }
  assert.ok(AB.kacisSuresi(4, -15) > AB.kacisSuresi(4) + 0.05);
  assert.ok(AB.kacisSuresi(-2, -15) > 0, 'zaten acikta ama tehlikeye dogru gidiyor');
  assert.strictEqual(AB.kacisSuresi(-2, 0), 0);
  // ters tam ivmeyle baslamak (ay = -min(A, G)) sureyi uzatir
  const ters = -Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL);
  assert.ok(AB.kacisSuresi(3.1, 0, ters) > AB.kacisSuresi(3.1) + 0.03);
  assert.ok(AB.kacisSuresi(3.1, -10, ters) > AB.kacisSuresi(3.1, 0, ters));
  // kacisMesafesi, kacisSuresi'nin tersi: dy <= kacisMesafesi(t) <=> kacisSuresi(dy) <= t
  [[0, 0], [-10, ters], [5, 60], [-20, 0]].forEach(([v0, ay0]) => {
    for (let t = 0.05; t < 1.2; t += 0.07) {
      const m = AB.kacisMesafesi(t, v0, ay0);
      if (m === -Infinity) { assert.ok(AB.kacisSuresi(0.01, v0, ay0) > t - 1e-9); continue; }
      assert.ok(AB.kacisSuresi(m, v0, ay0) <= t + 1e-9 && AB.kacisSuresi(m + 0.05, v0, ay0) > t - DT, 'v0 ' + v0 + ' t ' + t);
    }
  });
});
dene('kacisSuresi gercek adim butunlemesiyle ayni (zayif yon: birakili, durustan)', () => {
  // G_SUZUL < A_YUKSEL ve VY_ASAGI < VY_YUKARI: zayif yon asagi
  [1, 3.1, 4.6, 7.1, 15].forEach(dy => {
    const d = bosDurum(); d.y = 30; d.vy = 0; d.ay = 0;
    let n = 0; while (d.y - 30 < dy && n < 2000) { AB.adim(d, false); n++; }
    yakin(AB.kacisSuresi(dy), n * DT, 1e-9, 'dy ' + dy);
  });
});

console.log('Hareket');
// Rampa dahil surekli cozum (ayriklastirma hatasi tolerans icinde): a(t) = A(1 - e^(-t/T)).
function rampaYol(Aiv, V, T, sure) {
  const v = t => Aiv * (t - T * (1 - Math.exp(-t / T)));
  const y = t => Aiv * (t * t / 2 - T * t + T * T * (1 - Math.exp(-t / T)));
  let lo = 0, hi = 10; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (v(m) < V) lo = m; else hi = m; }
  return sure <= lo ? y(sure) : y(lo) + V * (sure - lo);
}
dene('basili 1 sn: rampa dahil surekli cozum (zeminden)', () => {
  const d = bosDurum(); d.y = 96; d.vy = 0; d.ay = 0;
  let enHizli = 0;
  for (let i = 0; i < 120; i++) { AB.adim(d, true); enHizli = Math.min(enHizli, d.vy); }
  const V = A.hareket.VY_YUKARI;
  yakin(d.y, 96 - rampaYol(A.hareket.A_YUKSEL, V, A.hareket.T_RAMPA, 1), 0.5, 'y');
  assert.strictEqual(d.vy, -V); assert.ok(enHizli >= -V);
});
dene('birakili 1 sn: rampa dahil surekli cozum (tavandan)', () => {
  const d = bosDurum(); d.y = 4; d.vy = 0; d.ay = 0;
  let enHizli = 0;
  for (let i = 0; i < 120; i++) { AB.adim(d, false); enHizli = Math.max(enHizli, d.vy); }
  const V = A.hareket.VY_ASAGI;
  yakin(d.y, 4 + rampaYol(A.hareket.G_SUZUL, V, A.hareket.T_RAMPA, 1), 0.5, 'y');
  assert.strictEqual(d.vy, V); assert.ok(enHizli <= V);
});
dene('ilk adim: rampa + yari ortuk Euler', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.ay = 0; AB.adim(d, true);
  const k = 1 - Math.exp(-DT / A.hareket.T_RAMPA), ay = -170 * k;
  yakin(d.ay, ay, 1e-12); yakin(d.vy, ay * DT, 1e-12); yakin(d.y, 50 + ay * DT * DT, 1e-12);
});
dene('rampa: basma/birakma gecisinde ivme sicramaz, hedefe yaklasir, hiz sinirlari asilmaz', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.ay = 0;
  const Ay = A.hareket.A_YUKSEL, G = A.hareket.G_SUZUL, k = 1 - Math.exp(-DT / A.hareket.T_RAMPA);
  let enCokSicrama = 0, enCokVyAsagi = 0, enCokVyYukari = 0, ay = d.ay;
  const desen = i => Math.floor(i / 37) % 2 === 0;      // her ~0,31 sn yon degistir
  for (let i = 0; i < 2400; i++) {
    d.isik = 1; d.y = 50;                               // duvara degmesin (kistirma vy'yi sifirlar)
    AB.adim(d, desen(i));
    enCokSicrama = Math.max(enCokSicrama, Math.abs(d.ay - ay)); ay = d.ay;
    enCokVyAsagi = Math.max(enCokVyAsagi, d.vy); enCokVyYukari = Math.max(enCokVyYukari, -d.vy);
  }
  assert.ok(enCokSicrama <= (Ay + G) * k + 1e-9, 'adim basina ivme degisimi ' + enCokSicrama);
  assert.ok(enCokSicrama < 0.15 * (Ay + G), 'sicrama ' + enCokSicrama);
  assert.ok(enCokVyAsagi <= A.hareket.VY_ASAGI && enCokVyYukari <= A.hareket.VY_YUKARI);
  const e = bosDurum(); e.y = 50; e.ay = G;
  for (let i = 0; i < 60; i++) { e.y = 50; AB.adim(e, true); }
  assert.ok(Math.abs(e.ay + Ay) < 0.01 * Ay, '0,5 sn sonra ay ' + e.ay);
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
dene('durum alanlari; durumda islev yok', () => {
  const d = AB.oyunOlustur(5);
  ['t', 'mesafe', 'puan', 'y', 'vy', 'ay', 'isik', 'dokunulmaz', 'zincir', 'zincirSure', 'toz', 'bolge', 'gorunenBolge', 'bitti', 'dilimler', 'tohum', 'uretici']
    .forEach(k => assert.ok(k in d, k));
  assert.ok(Array.isArray(d.dilimler) && d.dilimler.length > 0);
  (function gez(o, yol) {
    assert.notStrictEqual(typeof o, 'function', yol + ' islev');
    if (o && typeof o === 'object') Object.keys(o).forEach(k => gez(o[k], yol + '.' + k));
  })(d, 'durum');
});
dene('JSON gidis-donusu: geri yuklenen durum 8000 adim boyunca ayni', () => {
  const a = AB.oyunOlustur(4242);
  a.puan = 5200;                                  // yeni mekanikler (tozsuz/bomba/sarmasik) devrede
  for (let i = 0; i < 4000; i++) { a.isik = 1; AB.adim(a, girdi(i)); }
  const b = JSON.parse(JSON.stringify(a));
  assert.deepStrictEqual(b, kopya(a));
  const turler = {};
  for (let i = 4000; i < 12000; i++) {
    a.isik = 1; b.isik = 1;
    const ob = AB.adim(b, girdi(i));
    assert.deepStrictEqual(ob, AB.adim(a, girdi(i)));
    ob.forEach(o => { turler[o.tur] = 1; });
    a.dilimler.forEach(s => { if (s.tozsuz) turler.tozsuzDilim = 1; if (s.bomba) turler.bombaDilim = 1; if (s.sarmasik && s.sarmasik.faz) turler.sarmasikFaz = 1; });
  }
  assert.strictEqual(JSON.stringify(b), JSON.stringify(a));
  assert.ok(a.uretici.n > 50);
  ['sarmasikUyari', 'tozsuzDilim', 'bombaDilim', 'sarmasikFaz'].forEach(k => assert.ok(turler[k], k + ' sinanmadi'));
});

console.log('Uretici');
dene('ayni tohum ayni dilim dizisi', () => {
  const a = AB.ureticiOlustur(99), b = AB.ureticiOlustur(99);
  for (let i = 0; i < 300; i++) { const bl = (i >> 5) & 3; assert.deepStrictEqual(a.sonraki(bl), b.sonraki(bl)); }
});
dene('bolge sabitken dilim dizisi girdiden bagimsiz', () => {
  const kayit = g => {
    const d = AB.oyunOlustur(2024), dizi = {};
    // uretim aninda kaydet (miknatis sonradan bocege yakin tozu kaydirir)
    const kaydet = () => d.dilimler.forEach(s => { if (!(s.no in dizi)) dizi[s.no] = JSON.stringify([s.x, s.c, s.ust, s.alt, s.tur, s.engeller.map(e => [e.tur, e.x, e.h, e.w]), s.toz.map(t => [t.x, t.y]), s.kivilcim && [s.kivilcim.x, s.kivilcim.y]]); });
    kaydet();
    for (let i = 0; i < 20000; i++) { d.isik = 1; d.puan = 0; AB.adim(d, g(i)); kaydet(); }
    return dizi;
  };
  const a = kayit(() => false), b = kayit(() => true), c = kayit(girdi);
  assert.ok(Object.keys(a).length > 50);
  assert.deepStrictEqual(a, b); assert.deepStrictEqual(a, c);
});
dene('determinizm (b): bolge + puan sabitken (6200) dilim dizisi girdiden bagimsiz, yeni mekanikler dahil', () => {
  const kayit = g => {
    const d = AB.oyunOlustur(2025), dizi = {};
    const kaydet = () => d.dilimler.forEach(s => {
        if (s.no in dizi) return;
        dizi[s.no] = JSON.stringify([s.x, s.c, s.tur, s.tozsuz, s.engeller.map(e => [e.tur, e.x, e.h, e.w]), s.toz.map(t => [t.x, t.y]),
          s.kivilcim && [s.kivilcim.x, s.kivilcim.y], s.bomba && [s.bomba.x, s.bomba.y],
          s.sarmasik && [s.sarmasik.yon, s.sarmasik.sutunlar.map(c => [c.x, c.y, c.h])]]);
      });
    kaydet();
    for (let i = 0; i < 20000; i++) { d.isik = 1; d.puan = 6200; d.bolge = AB.bolgeNo(6200); AB.adim(d, g(i)); kaydet(); }
    return dizi;
  };
  const a = kayit(() => false), b = kayit(() => true), c = kayit(girdi);
  const v = Object.values(a).map(JSON.parse);
  assert.ok(v.some(x => x[3]) && v.some(x => x[7]) && v.some(x => x[8]), 'tozsuz/bomba/sarmasik uretilmedi');
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
    s.toz.forEach(t => assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y) && t.alindi === 0 && t.yutuldu === 0));
    assert.strictEqual(s.tozsuz, 0); assert.strictEqual(s.bomba, null); assert.strictEqual(s.sarmasik, null);
  }
  assert.deepStrictEqual(Object.keys(tur).sort(), ['ag', 'dal', 'dusen', 'kus']);
});

// Puani yapay ilerleten surucu: ureticiyi dogrudan cagirir. puanF(i) -> i. dilimin uretim puani.
function surucu(tohum, n, puanF) {
  const u = AB.ureticiOlustur(tohum), L = [];
  for (let i = 0; i < n; i++) { const p = puanF(i); const s = u.sonraki(AB.bolgeNo(p), p); s._p = p; L.push(s); }
  return L;
}
const rampaPuan = i => i * 14;                // 600 dilimde 0 -> 8400
dene('esiklerin altinda tozsuz/bomba/sarmasik yok; ustunde hepsi var', () => {
  const say = { tozsuz: 0, bomba: 0, sarmasik: 0 };
  for (let t = 1; t <= 150; t++) {
    surucu(t, 600, rampaPuan).forEach(s => {
      if (s.tozsuz) { say.tozsuz++; assert.ok(s._p >= A.uretici.TOZSUZ_PUAN, 'tozsuz ' + s._p); }
      if (s.bomba) { say.bomba++; assert.ok(s._p >= A.uretici.BOMBA_PUAN, 'bomba ' + s._p); }
      if (s.sarmasik) { say.sarmasik++; assert.ok(s._p >= A.uretici.SARMASIK_PUAN, 'sarmasik ' + s._p); }
    });
  }
  assert.ok(say.tozsuz > 100 && say.bomba > 100 && say.sarmasik > 100, JSON.stringify(say));
});
dene('nefes, acilis, tozsuz, sarmasik dilimlerinde bomba yok; tozsuz/sarmasik/bomba dilimlerinde kivilcim yok; ardisik tehlike yok', () => {
  for (let t = 1; t <= 150; t++) {
    surucu(t, 600, rampaPuan).forEach((s, i, L) => {
      if (i && (s.bomba || s.sarmasik)) assert.ok(!L[i - 1].bomba && !L[i - 1].sarmasik, 'ardisik tehlike ' + s.no);
      if (i && s.tozsuz && !L[i - 1].tozsuz && !L[i - 1].nefes) assert.ok(!L[i - 1].bomba && !L[i - 1].sarmasik, 'tehlike ardindan tozsuz pencere ' + s.no);
      assert.strictEqual(s.puan, s._p, 'dilim uretim puani');
      const ozel = s.nefes || s.no < A.uretici.ACILIS_DILIM;
      if (ozel) assert.ok(!s.tozsuz && !s.bomba && !s.sarmasik, 'nefes/acilis dilimi ' + s.no);
      if (s.bomba) assert.ok(!s.tozsuz && !s.sarmasik);
      if (s.sarmasik) assert.ok(!s.tozsuz);
      if (s.tozsuz) assert.strictEqual(s.toz.length, 0);
      if (s.tozsuz || s.sarmasik || s.bomba) assert.strictEqual(s.kivilcim, null);
    });
  }
});
dene('tozsuz pencere 2-3 dilim (nefes araya girerse sayilmaz), pencereler arasi >= 8 dilim', () => {
  let pencere = 0;
  for (let t = 1; t <= 150; t++) {
    const L = surucu(t, 600, rampaPuan);
    let uz = 0, sonBitis = -1e9;
    L.forEach((s, i) => {
      if (s.nefes && uz) return;                        // pencere duraklar
      if (s.tozsuz) {
        if (uz === 0) { assert.ok(s.no - sonBitis - 1 >= A.uretici.TOZSUZ_ARA, 'pencere arasi ' + (s.no - sonBitis - 1)); pencere++; }
        uz++;
      } else if (uz) {
        assert.ok(uz >= A.uretici.TOZSUZ_MIN && uz <= A.uretici.TOZSUZ_MAX, 'pencere ' + uz);
        sonBitis = L[i - 1].nefes ? L[i - 2].no : L[i - 1].no; uz = 0;
      }
    });
  }
  assert.ok(pencere > 100, pencere + ' pencere');
});
dene('cakisma: puan < 5000 iken sarmasik-tozsuz dilim mesafesi >= 2; 5000+ birlikte gelebilir', () => {
  let alt = 0, ust = 0;
  for (let t = 1; t <= 300; t++) {
    const L = surucu(t, 600, t % 2 ? rampaPuan : (i => 5000 + i * 10));
    const tz = L.filter(s => s.tozsuz).map(s => s.no);
    L.filter(s => s.sarmasik).forEach(s => {
      const yakin = tz.filter(n => Math.abs(n - s.no) < A.uretici.CAKISMA_ARA).length;
      if (s._p < A.uretici.CAKISMA_SERBEST) { alt++; assert.strictEqual(yakin, 0, 'tohum ' + t + ' dilim ' + s.no + ' puan ' + s._p); }
      else if (yakin) ust++;
    });
  }
  assert.ok(alt > 100, alt + ' sarmasik < 5000'); assert.ok(ust >= 1, '5000+ yan yana ornek yok');
});
dene('bomba: ic tozun yerinde, toz + bomba = 3..5, yay uzerinde', () => {
  let n = 0;
  for (let t = 1; t <= 150; t++) {
    surucu(t, 600, rampaPuan).forEach(s => {
      if (!s.bomba) return; n++;
      const k = s.toz.length + 1;
      assert.ok(k >= A.uretici.TOZ_MIN && k <= A.uretici.TOZ_MAX);
      assert.ok(s.toz[0].x < s.bomba.x && s.toz[s.toz.length - 1].x > s.bomba.x, 'bomba ilk/son tozun yerinde');
      assert.ok(Number.isFinite(s.bomba.y) && s.bomba.alindi === 0);
    });
  }
  assert.ok(n > 100);
});
dene('sarmasik: 2-3 sutun, ic tozlarin hizasinda, yakin duvardan, tozu TASMA gecer', () => {
  let n = 0; const U = A.uretici;
  for (let t = 1; t <= 150; t++) {
    surucu(t, 600, rampaPuan).forEach(s => {
      const sa = s.sarmasik; if (!sa) return; n++;
      assert.ok(sa.sutunlar.length >= U.SARMASIK_SUTUN_MIN && sa.sutunlar.length <= U.SARMASIK_SUTUN_MAX);
      assert.strictEqual(sa.faz, 0); assert.strictEqual(sa.sure, 0); assert.strictEqual(sa.ilerleme, 0);
      const ort = sa.sutunlar.reduce((a, c) => a + c.ty, 0) / sa.sutunlar.length;
      assert.strictEqual(sa.yon, ort < A.dunya.H / 2 ? 'ust' : 'alt');
      sa.sutunlar.forEach(c => {
        const i = s.toz.findIndex(tz => tz.x === c.tx && tz.y === c.ty);
        assert.ok(i > 0 && i < s.toz.length - 1, 'ic toz degil');
        yakin(c.x + c.w / 2, c.tx, 1e-9); assert.strictEqual(c.w, U.SARMASIK_GEN);
        if (sa.yon === 'ust') { assert.strictEqual(c.y, 0); yakin(c.y + c.h, c.ty + U.SARMASIK_TASMA, 1e-9); }
        else { yakin(c.y, c.ty - U.SARMASIK_TASMA, 1e-9); yakin(c.y + c.h, A.dunya.H, 1e-9); }
      });
      yakin(sa.x1, sa.sutunlar[0].x, 1e-9); yakin(sa.x2, sa.sutunlar[sa.sutunlar.length - 1].x + U.SARMASIK_GEN, 1e-9);
    });
  }
  assert.ok(n > 100);
});

console.log('Carpisma, isik, puan, zincir');
dene('dal: isik -0,50 (DAL_HASAR), zincir 0, dokunulmaz 1 sn, tek hasar', () => {
  const d = bosDurum(); d.y = 50; d.zincir = 7; d.zincirSure = 1.5;
  d.dilimler = [dilim([{ tur: 'dal', x: XB - 2, y: 40, w: 1000, h: 20 }])];
  const once = d.isik;
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'hasar'), 1); assert.strictEqual(d.zincir, 0);
  assert.strictEqual(o.find(x => x.tur === 'hasar').engel, 'dal');
  yakin(d.isik, once - 0.5 - AB.zorluk(0).sizinti * DT, 1e-9); yakin(d.dokunulmaz, 1, 1e-12);
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
  const o2 = AB.adim(d2, false);
  assert.strictEqual(say(o2, 'hasar'), 1); assert.strictEqual(o2[0].engel, 'kus');
  yakin(d2.isik, 1 - A.isik.HASAR - 0.028 * DT, 1e-9, 'kus hasari 0,34');
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
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'hasar'), 1); assert.strictEqual(o[0].engel, 'dusen');
  yakin(d.isik, 1 - 0.34 - 0.028 * DT, 1e-9, 'dusen dal hasari 0,34 (dikenli dal degil)');
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
dene('toplama yaricapi R_TOPLA 4,2 (ilk adimda yalniz ici)', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0;
  d.dilimler = [dilim([], [{ x: XB + 0.1, y: 50 + 4.0, alindi: 0, yutuldu: 0 }, { x: XB + 0.1, y: 50 - 4.8, alindi: 0, yutuldu: 0 }])];
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'toz'), 1); assert.strictEqual(d.dilimler[0].toz[0].alindi, 1);
});
dene('miknatis: R_MIKNATIS icindeki toz bocege kayar ve toplanir; disindaki kipirdamaz', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.ay = 0;
  const yakinT = { x: XB + 5, y: 52, alindi: 0, yutuldu: 0 }, uzakT = { x: XB + 0.5, y: 50 - 7.7, alindi: 0, yutuldu: 0 };
  d.dilimler = [dilim([], [uzakT, yakinT])];
  const once = Math.hypot(yakinT.x - XB, yakinT.y - 50);
  AB.adim(d, false);
  const bx = d.mesafe + XB, sonra = Math.hypot(yakinT.x - bx, yakinT.y - d.y);
  assert.ok(sonra < once - 0.2, 'kaymadi ' + once + ' -> ' + sonra);
  assert.ok(Math.abs(Math.hypot(yakinT.x - (XB + 5), yakinT.y - 52) - A.hareket.MIKNATIS_HIZ * DT) < 1e-9, 'dunya adimi MIKNATIS_HIZ*DT degil');
  assert.strictEqual(uzakT.x, XB + 0.5); assert.strictEqual(uzakT.y, 50 - 7.7);
  let n = 0; while (!yakinT.alindi && n < 60) { d.y = 50; d.vy = 0; AB.adim(d, false); n++; }
  assert.strictEqual(yakinT.alindi, 1); assert.ok(n < 30, n + ' adim');
});
dene('miknatis AFK yuksekliginden (tavan/zemin) tozu cekmez', () => {
  const u = A.uretici, enUst = u.MERKEZ_MIN - u.TOZ_SAPMA, enAlt = u.MERKEZ_MAX + u.TOZ_SAPMA;
  [[A.dunya.Y_UST, true, enUst], [A.dunya.Y_ALT, false, enAlt]].forEach(([yb, bas, ty]) => {
    const d = bosDurum(); d.y = yb; d.vy = 0;
    const t = { x: XB + 3, y: ty, alindi: 0, yutuldu: 0 };
    d.dilimler = [dilim([], [t])];
    const o = adimla(d, 120, bas);
    assert.strictEqual(say(o, 'toz'), 0); assert.strictEqual(t.x, XB + 3); assert.strictEqual(t.y, ty);
  });
});
dene('miknatis: gerideki dilimin cekilen tozu donmaz (dilim atlanmaz)', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0;
  const t = { x: XB - 6, y: 50, alindi: 0, yutuldu: 0 };
  const s = dilim([], [t]); s.x = XB - 8;                   // dilim bx - R_MIKNATIS'in gerisinde
  d.dilimler = [s];
  const x0 = t.x; AB.adim(d, false);
  yakin(t.x - x0, A.hareket.MIKNATIS_HIZ * DT, 1e-6, 'toz cekilmedi');
});
dene('miknatis yutulan ve alinan tozu cekmez', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0;
  const y1 = { x: XB + 3, y: 50, alindi: 0, yutuldu: 1 }, a1 = { x: XB + 5, y: 52, alindi: 1, yutuldu: 0 };
  d.dilimler = [dilim([], [y1, a1])];
  const o = adimla(d, 40, false);
  assert.strictEqual(say(o, 'toz'), 0); assert.strictEqual(y1.x, XB + 3); assert.strictEqual(a1.x, XB + 5);
  assert.strictEqual(y1.alindi, 0, 'yutulan toz toplanmaz');
});

console.log('Bomba');
function bombaDurum(dy, dx) {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.ay = 0; d.zincir = 6; d.zincirSure = 1;
  const b = { x: XB + (dx || 0), y: 50 + dy, alindi: 0 };
  d.dilimler = [dilim([], [])]; d.dilimler[0].bomba = b;
  return { d, b };
}
dene('bomba: isik -0,25, zincir 0, dokunulmaz 1, olay bomba (x,y), tek kez', () => {
  const { d, b } = bombaDurum(1);
  const once = d.isik, o = AB.adim(d, false);
  assert.strictEqual(say(o, 'bomba'), 1); assert.strictEqual(say(o, 'hasar'), 0);
  const ob = o.find(x => x.tur === 'bomba'); assert.strictEqual(ob.x, b.x); assert.strictEqual(ob.y, b.y);
  yakin(d.isik, once - A.isik.BOMBA_HASAR - 0.028 * DT, 1e-9);
  assert.strictEqual(d.zincir, 0); yakin(d.dokunulmaz, 1, 1e-12); assert.strictEqual(b.alindi, 1);
  d.dokunulmaz = 0; assert.strictEqual(say(adimla(d, 5, false), 'bomba'), 0);
});
dene('bomba hitbox R_BOMBA + R_CARPMA; R_TOPLA ile buyumez; miknatis cekmez', () => {
  const sinir = A.hareket.R_BOMBA + A.hareket.R_CARPMA;
  assert.ok(sinir + 0.3 < A.hareket.R_TOPLA, 'test anlamsiz');
  const { d, b } = bombaDurum(sinir + 0.3);
  for (let i = 0; i < 30; i++) { d.y = 50; d.vy = 0; d.mesafe = 0; assert.strictEqual(say(AB.adim(d, false), 'bomba'), 0); }
  assert.strictEqual(b.x, XB); assert.strictEqual(b.y, 50 + sinir + 0.3); assert.strictEqual(b.alindi, 0);
  const k = bombaDurum(sinir - 0.05);
  assert.strictEqual(say(AB.adim(k.d, false), 'bomba'), 1);
});
dene('bomba dokunulmazken hasar vermez ve yerinde kalir', () => {
  const { d, b } = bombaDurum(0); d.dokunulmaz = 0.5;
  assert.strictEqual(say(AB.adim(d, false), 'bomba'), 0); assert.strictEqual(b.alindi, 0);
});
dene('ayni adimda hasar onceligi: engel > sarmasik > bomba (tek hasar)', () => {
  const kur = (engel, sar, bom) => {
    const d = bosDurum(); d.y = 50; d.vy = 0; d.ay = 0;
    const s = dilim(engel ? [{ tur: 'kus', x: 0, x0: XB - 1, y: 48, w: 5, h: 4, ek: 0 }] : [], []);
    if (sar) s.sarmasik = { yon: 'ust', x1: XB - 1, x2: XB + 2, sutunlar: [{ x: XB - 1, y: 0, w: 3, h: 60, tx: XB + 0.5, ty: 59 }], faz: 3, sure: 0, ilerleme: 1 };
    if (bom) s.bomba = { x: XB, y: 50, alindi: 0 };
    s.hiz = AB.zorluk(0).hiz; d.dilimler = [s];
    return { d, s };
  };
  let k = kur(true, true, true), o = AB.adim(k.d, false);
  assert.deepStrictEqual(o.map(x => x.tur), ['hasar']); assert.strictEqual(k.s.bomba.alindi, 0);
  yakin(k.d.isik, 1 - A.isik.HASAR - 0.028 * DT, 1e-9);
  k = kur(false, true, true); o = AB.adim(k.d, false);
  assert.deepStrictEqual(o.map(x => x.tur), ['sarmasik']); assert.strictEqual(k.s.bomba.alindi, 0);
  k = kur(false, false, true); o = AB.adim(k.d, false);
  assert.deepStrictEqual(o.map(x => x.tur), ['bomba']);
});
dene('olumcul bomba: bitti tek kez', () => {
  const { d } = bombaDurum(0); d.isik = 0.2;
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'bomba'), 1); assert.strictEqual(say(o, 'bitti'), 1); assert.strictEqual(d.bitti, 1);
});

console.log('Sarmasik');
// Tek sutunlu elle kurulmus sarmasik: tavandan toz.y + TASMA'ya kadar.
function sarmasikDurum(uzak, tozY) {
  const U = A.uretici, d = bosDurum(); d.y = 50; d.vy = 0; d.ay = 0;
  const tx = XB + A.hareket.R_CARPMA + uzak + U.SARMASIK_GEN / 2, t = { x: tx, y: tozY, alindi: 0, yutuldu: 0 };
  const sut = { x: tx - U.SARMASIK_GEN / 2, y: 0, w: U.SARMASIK_GEN, h: tozY + U.SARMASIK_TASMA, tx: tx, ty: tozY };
  const s = dilim([], [t]);
  s.sarmasik = { yon: 'ust', x1: sut.x, x2: sut.x + sut.w, sutunlar: [sut], faz: 0, sure: 0, ilerleme: 0 };
  s.hiz = AB.zorluk(0).hiz;                                 // uyari tetigi dilimin hiziyla (adim basina zorluk yok)
  d.dilimler = [s];
  return { d, s, t, sa: s.sarmasik };
}
dene('sarmasik zaman cizgisi: uyari varistan SARMASIK_ONCE once, UYARI sn, sonra BUYUME sn', () => {
  const U = A.uretici, hiz = AB.zorluk(0).hiz;
  const { d, sa } = sarmasikDurum(hiz * 2, 10);
  let n = 0, o = [], uyari = null;
  while (sa.faz === 0 && n < 1000) { o = AB.adim(d, false); d.y = 50; n++; }
  assert.strictEqual(sa.faz, 1); assert.strictEqual(say(o, 'sarmasikUyari'), 1);
  uyari = o.find(x => x.tur === 'sarmasikUyari'); assert.ok(Number.isFinite(uyari.x) && Number.isFinite(uyari.y));
  const kalan = sa.x1 - (d.mesafe + XB + A.hareket.R_CARPMA);
  assert.ok(kalan <= hiz * U.SARMASIK_ONCE + 1e-9 && kalan > hiz * (U.SARMASIK_ONCE - DT) - 1e-9, 'kalan ' + kalan);
  let s1 = 0; while (sa.faz === 1) { AB.adim(d, false); d.y = 50; s1++; }
  yakin(s1 * DT, U.SARMASIK_UYARI, DT + 1e-9, 'uyari');
  let s2 = 0; while (sa.faz === 2) { assert.ok(sa.ilerleme >= 0 && sa.ilerleme <= 1); AB.adim(d, false); d.y = 50; s2++; }
  yakin(s2 * DT, U.SARMASIK_BUYUME, DT + 1e-9, 'buyume'); assert.strictEqual(sa.faz, 3); assert.strictEqual(sa.ilerleme, 1);
});
dene('sarmasik: buyume baslayinca hizasindaki toz yutulur (olay), toplanamaz', () => {
  const hiz = AB.zorluk(0).hiz;
  const { d, sa, t } = sarmasikDurum(hiz * 1.5, 50);
  let o = [], yut = 0, tozO = 0;
  for (let i = 0; i < 400; i++) {
    d.isik = 1; d.dokunulmaz = 1; d.y = 50; d.vy = 0;           // dokunulmaz: sarmasiga carpmadan icinden gecer
    o = AB.adim(d, false); yut += say(o, 'yutuldu'); tozO += say(o, 'toz');
    if (sa.faz >= 2) assert.strictEqual(t.yutuldu, 1);
  }
  assert.strictEqual(yut, 1); assert.strictEqual(tozO, 0); assert.strictEqual(t.alindi, 0);
});
dene('sarmasik hasari: yalniz buyume basladiktan sonra, tam boy zarf, isik -0,20, olay sarmasik', () => {
  const hiz = AB.zorluk(0).hiz;
  // uyari bitmeden (faz 1) bocek sutunun icinde: hasar yok
  const a = sarmasikDurum(hiz * 0.9, 50); a.sa.faz = 1; a.sa.sure = 0;
  a.d.mesafe = a.sa.x1 - XB + 0.5; a.d.dilimler[0].toz = [];
  assert.strictEqual(say(AB.adim(a.d, false), 'sarmasik'), 0);
  // buyume yeni basladi (ilerleme ~0) ama carpma tam boy
  const b = sarmasikDurum(hiz, 50); b.sa.faz = 2; b.sa.sure = 0; b.d.dilimler[0].toz = [];
  b.d.mesafe = b.sa.x1 - XB + 0.5; b.d.y = 40;
  const once = b.d.isik, o = AB.adim(b.d, false);
  assert.strictEqual(say(o, 'sarmasik'), 1); assert.strictEqual(say(o, 'hasar'), 0);
  const os = o.find(x => x.tur === 'sarmasik'); assert.ok(Number.isFinite(os.x) && Number.isFinite(os.y));
  yakin(b.d.isik, once - A.isik.SARMASIK_HASAR - AB.zorluk(b.d.mesafe).sizinti * DT, 1e-6); yakin(b.d.dokunulmaz, 1, 1e-12); assert.strictEqual(b.d.zincir, 0);
  // ucun altindan gecen carpmaz
  const c = sarmasikDurum(hiz, 50); c.sa.faz = 3; c.d.dilimler[0].toz = [];
  c.d.mesafe = c.sa.x1 - XB + 0.5; c.d.y = 50 + A.uretici.SARMASIK_TASMA + A.hareket.R_CARPMA + 0.1;
  assert.strictEqual(say(AB.adim(c.d, false), 'sarmasik'), 0);
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
dene('bolge: agirlik bolgesi puanla hemen, gorunenBolge nefes varinca', () => {
  const d = AB.oyunOlustur(77);
  for (let i = 0; i < 1200; i++) { d.isik = 1; AB.adim(d, girdi(i)); }
  assert.strictEqual(d.gorunenBolge, 0); assert.ok(d.puan < 500);
  d.puan = 500;
  let o = AB.adim(d, false), n = 0;
  assert.strictEqual(d.bolge, 1); assert.strictEqual(d.gorunenBolge, 0); assert.strictEqual(say(o, 'bolge'), 0);
  let nefes = null;
  while (n++ < 4000) {
    d.isik = 1; o = AB.adim(d, false);
    if (!nefes) nefes = d.dilimler.find(s => s.nefes) || null;
    if (say(o, 'bolge')) break;
  }
  assert.ok(nefes, 'nefes uretilmedi'); assert.strictEqual(nefes.bolge, 1);
  assert.strictEqual(say(o, 'bolge'), 1); assert.strictEqual(o.find(x => x.tur === 'bolge').bolge, 1);
  assert.strictEqual(d.gorunenBolge, 1);
  const bx = d.mesafe + XB;
  assert.ok(nefes.x <= bx && nefes.x > bx - AB.zorluk(d.mesafe).hiz * DT - 1e-9, 'olay nefes varisinda degil');
  for (let i = 0; i < 600; i++) assert.strictEqual(say(AB.adim(d, false), 'bolge'), 0);
});
dene('isikYaricapi gorunenBolge ile: bataklik nefesten sonra daralir', () => {
  const d = { isik: 1, hiz: 24 };
  assert.ok(AB.isikYaricapi(d.isik, d.hiz, 3) < AB.isikYaricapi(d.isik, d.hiz, 2));
});
dene('olumcul hasar ayni adimdaki tozla iptal olmaz', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0; d.isik = 0.33;
  d.dilimler = [dilim([{ tur: 'dal', x: XB - 1, y: 0, w: 3, h: 100 }], [{ x: XB, y: 50, alindi: 0 }])];
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'hasar'), 1); assert.strictEqual(say(o, 'bitti'), 1); assert.strictEqual(say(o, 'toz'), 0);
  assert.strictEqual(d.bitti, 1); assert.strictEqual(d.isik, 0); assert.strictEqual(d.zincir, 0);
});
dene('olaylarda konum', () => {
  const d = bosDurum(); d.y = 50; d.vy = 0;
  d.dilimler = [dilim([], [{ x: XB + 0.5, y: 50.5, alindi: 0 }])];
  const t = AB.adim(d, false).find(o => o.tur === 'toz');
  assert.strictEqual(t.x, XB + 0.5); assert.strictEqual(t.y, 50.5);
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
    assert.ok(ilk.x + ilk.w >= d.mesafe - 1 - AB.zorluk(d.mesafe).hiz * DT);
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
