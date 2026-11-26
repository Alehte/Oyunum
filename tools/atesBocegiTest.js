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
// Zemin olumu (12.1) konusu olmayan uzun kosularda: her adim oncesi zemin korumasi acik tutulur (isik = 1 gibi).
const korumali = d => { d.zeminKoruma = 1; return d; };
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
  ['sarmasik uyarisi uretim ufkunun otesinde (UFUK)', a => { a.uretici.UFUK = 50; }],
  ['uretim ufku en genis gorunur alanin icinde (UFUK)', a => { a.uretici.UFUK = 215; }],
  ['uretim ufku en genis gorunur alanin icinde (ORAN_MAX)', a => { a.dunya.ORAN_MAX = 2.4; }],
  ['ORAN_MAX * H < W', a => { a.dunya.ORAN_MAX = 0.4; }],
  ['ESIK_UFUK > UFUK', a => { a.uretici.ESIK_UFUK = a.uretici.UFUK + 1; }],
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
dene('zorluk(9000) ~%63, zorluk(1e7) tavanda (13: rampa dahil)', () => {
  const z = AB.zorluk(9000); yakin(z.z, 1 - Math.exp(-1), 1e-12);
  yakin(z.hiz, Math.min(44, 24 + 18 * z.z + 2 * Math.log2(1 + 9000 / 40000) + A.zorluk.HIZ_EK), 1e-9);
  const y = AB.zorluk(3000), ry = (3000 - 500) / (5000 - 500);      // rampa ortasi
  yakin(y.hiz, 24 + 18 * y.z + 2 * Math.log2(1 + 3000 / 40000) + 10 * ry, 1e-9); yakin(y.sizinti, 0.028 + 0.022 * y.z + 0.012 * ry, 1e-12);
  // 14: 1e7'de derece D_MAX: tAra = min(1,25, max(D_TARA_MIN, 1,25 - D_TARA)), sizinti 0,06 + D_SIZINTI
  // D_MAX 0 (FAZ 3 kapali): derece eki yok, tAra 1,25, sizinti 0,06
  const t = AB.zorluk(1e7), Zd = A.zorluk, dk = Zd.D_MAX > 0 ? 1 : 0; assert.strictEqual(t.hiz, 44);
  yakin(t.tAra, dk ? Math.min(1.25, Math.max(Zd.D_TARA_MIN, 1.25 - Zd.D_TARA)) : 1.25, 1e-9);
  yakin(t.bosluk, 16, 1e-9); yakin(t.sizinti, 0.06 + Zd.D_SIZINTI * dk, 1e-9);
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
dene('tavan kistirmasi sersemletir, zemin (koruma icinde) kistirir; sinirda vy = 0, hasar yok (12.1)', () => {
  const d = bosDurum(); d.y = 50;
  let o = [], n = 0;
  while (!say(o, 'sersem') && n < 400) { o = o.concat(AB.adim(d, true)); n++; }
  assert.strictEqual(say(o, 'sersem'), 1); assert.strictEqual(d.y, A.dunya.Y_UST); assert.strictEqual(d.vy, 0);
  d.sersem = 0;
  for (let i = 0; i < 480; i++) o = o.concat(AB.adim(korumali(d), false));
  assert.strictEqual(d.y, A.dunya.Y_ALT); assert.strictEqual(d.vy, 0); assert.strictEqual(d.bitti, 0);
  assert.strictEqual(say(o, 'hasar'), 0); assert.ok(d.isik > 1 - 0.03 * 6);
});

console.log('Determinizm');
function girdi(i) { return ((i * 7919) % 97) < 45; }
function kos(tohum, n, g) { const d = AB.oyunOlustur(tohum); for (let i = 0; i < n; i++) AB.adim(korumali(d), g(i)); return d; }
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
        AB.adim(korumali(d), girdi(n)); n++; birikim -= DT; adimSay++;
      }
    }
    return JSON.stringify(d);
  };
  const s60 = sonuc([1 / 60]), s144 = sonuc([1 / 144]), sKarisik = sonuc([0.016, 0.033, 0.007, 0.05, 0.02]);
  assert.strictEqual(s60, s144); assert.strictEqual(s60, sKarisik);
});
dene('durum alanlari; durumda islev yok', () => {
  const d = AB.oyunOlustur(5);
  ['t', 'mesafe', 'puan', 'y', 'vy', 'ay', 'isik', 'dokunulmaz', 'zincir', 'zincirSure', 'toz', 'bolge', 'gorunenBolge', 'bitti', 'dilimler', 'tohum', 'uretici',
   'sersem', 'zeminKoruma', 'sebep', 'esikPuan']
    .forEach(k => assert.ok(k in d, k));
  assert.ok(Array.isArray(d.dilimler) && d.dilimler.length > 0);
  (function gez(o, yol) {
    assert.notStrictEqual(typeof o, 'function', yol + ' islev');
    if (o && typeof o === 'object') Object.keys(o).forEach(k => gez(o[k], yol + '.' + k));
  })(d, 'durum');
});
dene('JSON gidis-donusu: geri yuklenen durum 8000 adim boyunca ayni', () => {
  const a = AB.oyunOlustur(4242, { mesafe: 2400, puan: 5200 });   // yeni mekanikler (tozsuz/bomba/sarmasik; 13: salinan, duzensiz isik)
  for (let i = 0; i < 4000; i++) { a.isik = 1; AB.adim(korumali(a), girdi(i)); }
  const b = JSON.parse(JSON.stringify(a));
  assert.deepStrictEqual(b, kopya(a));
  const turler = {};
  for (let i = 4000; i < 12000; i++) {
    a.isik = 1; b.isik = 1; korumali(a); korumali(b);
    const ob = AB.adim(b, girdi(i));
    assert.deepStrictEqual(ob, AB.adim(a, girdi(i)));
    ob.forEach(o => { turler[o.tur] = 1; });
    a.dilimler.forEach(s => { if (s.tozsuz) turler.tozsuzDilim = 1; if (s.bomba) turler.bombaDilim = 1; if (s.sarmasik && s.sarmasik.faz) turler.sarmasikFaz = 1;
      if (s.dag > 0) turler.dagDilim = 1; if (s.engeller.some(e => e.tur === 'salinan')) turler.salinanDilim = 1; });
  }
  assert.strictEqual(JSON.stringify(b), JSON.stringify(a));
  assert.ok(a.uretici.n > 50);
  ['sarmasikUyari', 'tozsuzDilim', 'bombaDilim', 'sarmasikFaz', 'sersem', 'uyandi', 'dagDilim', 'salinanDilim', 'kademe'].forEach(k => assert.ok(turler[k], k + ' sinanmadi'));
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
    for (let i = 0; i < 20000; i++) { d.isik = 1; d.puan = 0; AB.adim(korumali(d), g(i)); kaydet(); }
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
    for (let i = 0; i < 20000; i++) { d.isik = 1; d.puan = 6200; d.bolge = AB.bolgeNo(6200); AB.adim(korumali(d), g(i)); kaydet(); }
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
      if (e.tur === 'salinan') assert.ok(['yc', 'gen', 'om', 'faz'].every(k => Number.isFinite(e[k])) && (e.yon === 'ust' || e.yon === 'alt'));
    });
    s.toz.forEach(t => assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y) && t.alindi === 0 && t.yutuldu === 0));
    assert.strictEqual(s.tozsuz, 0); assert.strictEqual(s.bomba, null); assert.strictEqual(s.sarmasik, null);
  }
  assert.deepStrictEqual(Object.keys(tur).sort(), ['ag', 'dal', 'dusen', 'kus', 'salinan']);
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
  while (e.faz === 0 && n < 1000) { AB.adim(korumali(d), false); n++; }
  assert.strictEqual(e.faz, 1); assert.ok(e.x - (d.mesafe + XB) <= tetik + 1e-9);
  let s = 0; while (e.faz === 1 && s < 1000) { AB.adim(korumali(d), false); s++; }
  yakin(s * DT, A.uretici.DUSEN_UYARI, DT + 1e-9, 'sallanma');
  assert.strictEqual(e.y, 0);
  let f = 0; while (e.faz === 2 && f < 1000) { AB.adim(korumali(d), false); f++; }
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
dene('miknatis duvara degen bocege tozu cekmez: tavanda temas adimi (sersem), zeminde koruma icinde', () => {
  const u = A.uretici, enUst = u.MERKEZ_MIN - u.TOZ_SAPMA, enAlt = u.MERKEZ_MAX + u.TOZ_SAPMA;
  // tavan: temas adiminda sersemleme baslar (miknatis kapali); en yakin toz cekilmez
  const d = bosDurum(); d.y = A.dunya.Y_UST; d.vy = -A.hareket.VY_YUKARI; d.ay = -A.hareket.A_YUKSEL;
  const t = { x: XB + 3, y: enUst, alindi: 0, yutuldu: 0 };
  d.dilimler = [dilim([], [t])];
  const o = AB.adim(d, true);
  assert.strictEqual(say(o, 'sersem'), 1); assert.strictEqual(say(o, 'toz'), 0); assert.strictEqual(t.x, XB + 3); assert.strictEqual(t.y, enUst);
  // zemin: koruma icinde kistirilmis bocek, 120 adim boyunca
  const z = bosDurum(); z.y = A.dunya.Y_ALT; z.vy = 0;
  const tz = { x: XB + 3, y: enAlt, alindi: 0, yutuldu: 0 };
  z.dilimler = [dilim([], [tz])];
  const oz = []; for (let i = 0; i < 120; i++) oz.push(...AB.adim(korumali(z), false));
  assert.strictEqual(say(oz, 'toz'), 0); assert.strictEqual(tz.x, XB + 3); assert.strictEqual(tz.y, enAlt); assert.strictEqual(z.bitti, 0);
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
console.log('Tavan sersemlemesi ve zemin olumu (12.1)');
const MH = A.hareket, Y_UST = A.dunya.Y_UST, Y_ALT = A.dunya.Y_ALT;
const SERSEM_ADIM = Math.round(MH.SERSEM_SURE / DT), KORUMA_ADIM = Math.round(MH.ZEMIN_KORUMA / DT);
// tavana degen (tam hizla yukari) bocek: tek adimda sersemler
function sersemDurum() {
  const d = bosDurum(); d.y = Y_UST + 0.1; d.vy = -MH.VY_YUKARI; d.ay = -MH.A_YUKSEL;
  const o = AB.adim(d, true);
  assert.strictEqual(say(o, 'sersem'), 1, 'sersem olayi');
  return d;
}
dene('bozuk ayar: SERSEM_SURE > DOKUNULMAZ / <= 0', () => {
  let a = ayarKopya(); a.hareket.SERSEM_SURE = 1.2; assert.ok(AB.ayarDogrula(a).some(h => /SERSEM_SURE/.test(h)));
  a = ayarKopya(); a.hareket.SERSEM_SURE = 0; assert.ok(AB.ayarDogrula(a).length > 0);
});
dene('bozuk ayar: uyanma orani 0 / 1, zemine cok yakin uyanma (T_MIN gecikmeli oyuncu zemine deger)', () => {
  [0, 1, 0.02, 0.05].forEach(r => { const a = ayarKopya(); a.hareket.SERSEM_UYANMA_ORAN = r; assert.ok(AB.ayarDogrula(a).length > 0, 'oran ' + r); });
  const a = ayarKopya(); a.hareket.SERSEM_UYANMA_ORAN = 0.12;          // yUyan 84,96: T_MIN gecikmesiyle zemine deger
  assert.ok(AB.ayarDogrula(a).some(h => /T_MIN gecikmeli/.test(h)), JSON.stringify(AB.ayarDogrula(a)));
});
dene('bozuk ayar: ZEMIN_KORUMA 0, kivilcim zemine fren payindan yakin', () => {
  let a = ayarKopya(); a.hareket.ZEMIN_KORUMA = 0; assert.ok(AB.ayarDogrula(a).length > 0);
  a = ayarKopya(); a.uretici.KIVILCIM_Y_MAX = 91; assert.ok(AB.ayarDogrula(a).some(h => /kivilcim frenle/.test(h)), JSON.stringify(AB.ayarDogrula(a)));
});
dene('sabitler: SERSEM_SURE 0,8-1,0 sn, uyanma yuksekligi zeminin %20-30 ustunde, koruma ~0,5 sn', () => {
  assert.ok(MH.SERSEM_SURE >= 0.8 && MH.SERSEM_SURE <= 1.0, 'SERSEM_SURE ' + MH.SERSEM_SURE);
  const alan = Y_ALT - Y_UST, ust = (Y_ALT - AB.uyanmaY) / alan;
  assert.ok(ust >= 0.2 && ust <= 0.3, 'oran ' + ust);
  yakin(AB.uyanmaY, Y_ALT - MH.SERSEM_UYANMA_ORAN * alan, 1e-12);
  assert.ok(MH.ZEMIN_KORUMA >= 0.4 && MH.ZEMIN_KORUMA <= 0.6);
  // uyanan bocek T_MIN gecikmeyle basarsa zemine degmez (koruma olmadan da)
  assert.ok(AB.uyanmaY + AB.uyanmaDususu(A.adalet.T_MIN) < Y_ALT);
});
dene('tavana degme: sersem olayi, hasar yok, isik yalniz sizar, zincir ve dokunulmazlik degismez', () => {
  const d = bosDurum(); d.y = Y_UST + 0.1; d.vy = -MH.VY_YUKARI; d.ay = -MH.A_YUKSEL; d.zincir = 7; d.zincirSure = 5; d.dokunulmaz = 0;
  const once = d.isik, o = AB.adim(d, true);
  assert.deepStrictEqual(o.map(x => x.tur), ['sersem']); assert.ok(Number.isFinite(o[0].x) && o[0].y === Y_UST);
  yakin(d.sersem, MH.SERSEM_SURE, 1e-12); assert.strictEqual(d.y, Y_UST); assert.strictEqual(d.vy, 0); assert.strictEqual(d.ay, 0);
  yakin(d.isik, once - AB.zorluk(0).sizinti * DT, 1e-12, 'ekstra isik cezasi yok');
  assert.strictEqual(d.zincir, 7); assert.strictEqual(d.dokunulmaz, 0);
  const o2 = adimla(d, SERSEM_ADIM + 5, false);
  assert.strictEqual(say(o2, 'hasar') + say(o2, 'ag'), 0); assert.strictEqual(d.zincir, 7, 'zincir korunur');
});
dene('sersemlik suresi SERSEM_SURE (adim olarak), uyanma yuksekligi uyanmaY, yol monoton ve en asagiya inmez', () => {
  const d = sersemDurum();
  let n = 0, o = [], y = d.y, enHizli = 0;
  while (!say(o, 'uyandi') && n < 1000) {
    o = AB.adim(d, false); n++;
    assert.ok(d.y >= y - 1e-12 && d.y <= AB.uyanmaY + 1e-12, 'yol ' + d.y); enHizli = Math.max(enHizli, (d.y - y) / DT); y = d.y;
  }
  assert.strictEqual(n, SERSEM_ADIM, 'sersem adim ' + n);
  yakin(d.y, AB.uyanmaY, 1e-9, 'uyanma y'); assert.ok(d.y < Y_ALT - 0.2 * (Y_ALT - Y_UST));
  assert.strictEqual(d.sersem, 0); assert.strictEqual(d.vy, 0); assert.strictEqual(d.ay, 0); yakin(d.zeminKoruma, MH.ZEMIN_KORUMA, 1e-12);
  const ort = (AB.uyanmaY - Y_UST) / MH.SERSEM_SURE;
  assert.ok(enHizli <= 1.5 * ort + 1, 'en buyuk suzulme hizi ' + enHizli + ' ort ' + ort);
  const u = o.find(x => x.tur === 'uyandi'); assert.ok(Number.isFinite(u.x) && u.y === d.y);
});
dene('sersemken girdi etkisiz: basili / birakili / karisik ayni durum dizisi', () => {
  const izle = g => { const d = sersemDurum(), iz = []; for (let i = 0; i < SERSEM_ADIM; i++) { AB.adim(d, g(i)); iz.push([d.y, d.vy, d.ay, d.sersem]); } return JSON.stringify(iz); };
  const a = izle(() => true), b = izle(() => false), c = izle(girdi);
  assert.strictEqual(a, b); assert.strictEqual(a, c);
  // uyandiktan sonra girdi yeniden calisir
  const d = sersemDurum(); adimla(d, SERSEM_ADIM, true); const y0 = d.y; adimla(d, 30, true); assert.ok(d.y < y0, 'uyaninca basmak yukseltir');
});
dene('hangisi once: sersemlik uyanma yuksekligine erken varilirsa orada biter', () => {
  const d = bosDurum(); d.y = AB.uyanmaY - 2; d.sersem = MH.SERSEM_SURE;       // (yapay) alcakta baslayan sersemlik
  let n = 0, o = []; while (!say(o, 'uyandi') && n < 1000) { o = AB.adim(d, false); n++; }
  assert.ok(n < SERSEM_ADIM, n + ' adim'); yakin(d.y, AB.uyanmaY, 1e-12); assert.strictEqual(d.sersem, 0);
});
dene('sersemken toz dogrudan temasla (R_TOPLA) toplanir, isik artar; miknatis cekmez; uyaninca miknatis yeniden calisir', () => {
  const d = sersemDurum(); d.isik = 0.5;
  for (let i = 0; i < 40; i++) AB.adim(d, false);                         // yolun ortasina in
  const by = d.y, bx = d.mesafe + XB;
  const temas = { x: bx + 0.2, y: by + 1, alindi: 0, yutuldu: 0 };                        // R_TOPLA icinde
  const uzak = { x: bx + 3, y: by - 6, alindi: 0, yutuldu: 0 };                           // R_TOPLA disi, R_MIKNATIS ici
  assert.ok(Math.hypot(3, 6) > MH.R_TOPLA + 1 && Math.hypot(3, 6) < MH.R_MIKNATIS);
  d.dilimler = [dilim([], [temas, uzak])];
  const isik0 = d.isik, o = AB.adim(d, false);
  assert.strictEqual(say(o, 'toz'), 1); assert.strictEqual(temas.alindi, 1); assert.ok(d.sersem > 0);
  yakin(d.isik, isik0 + A.isik.TOZ - AB.zorluk(d.mesafe).sizinti * DT, 1e-6, 'isik artmali');
  assert.strictEqual(uzak.x, bx + 3); assert.strictEqual(uzak.y, by - 6, 'miknatis sersemken cekmemeli');
  assert.strictEqual(uzak.alindi, 0);
  // uyanis: ayni goreli konumdaki toz bu kez cekilir
  const e = sersemDurum(); adimla(e, SERSEM_ADIM, false); assert.strictEqual(e.sersem, 0);
  const ex = e.mesafe + XB, t2 = { x: ex + 3, y: e.y - 6, alindi: 0, yutuldu: 0 };
  e.dilimler = [dilim([], [t2])]; AB.adim(korumali(e), false);
  assert.ok(t2.x !== ex + 3 || t2.y !== e.y - 6, 'uyaninca miknatis calismali');
});
dene('sersemken kivilcim dogrudan temasla alinir; engele carpma normal kuralla hasar verir (sersemlik surer)', () => {
  const d = sersemDurum(); for (let i = 0; i < 40; i++) AB.adim(d, false);
  const bx = d.mesafe + XB;
  d.dilimler = [dilim([], [], { x: bx + 0.3, y: d.y + 1, alindi: 0 })];
  assert.strictEqual(say(AB.adim(d, false), 'kivilcim'), 1);
  const k = sersemDurum(); for (let i = 0; i < 40; i++) AB.adim(k, false);
  k.dilimler = [dilim([{ tur: 'dal', x: k.mesafe + XB - 1, y: 0, w: 4, h: 100 }])]; k.zincir = 5;
  const once = k.isik, o = AB.adim(k, false);
  assert.strictEqual(say(o, 'hasar'), 1); assert.ok(k.isik < once - A.isik.DAL_HASAR + 1e-6); assert.strictEqual(k.zincir, 0); assert.ok(k.sersem > 0, 'sersemlik surer');
});
dene('zemin olumu: temas aninda zemin + bitti (sebep zemin), sonra girdi kilitli (adim bos, durum donuk)', () => {
  const d = bosDurum(); d.y = Y_ALT - 0.1; d.vy = MH.VY_ASAGI; d.ay = MH.G_SUZUL;
  let o = [], n = 0; while (!d.bitti && n < 200) { o = AB.adim(d, false); n++; }
  assert.strictEqual(n, 1, 'ilk temasta');
  assert.deepStrictEqual(o.map(x => x.tur), ['zemin', 'bitti']); assert.strictEqual(o[1].sebep, 'zemin');
  assert.ok(Number.isFinite(o[0].x) && o[0].y === Y_ALT);
  assert.strictEqual(d.bitti, 1); assert.strictEqual(d.sebep, 'zemin'); assert.strictEqual(d.y, Y_ALT);
  const kopyaD = JSON.stringify(d);
  assert.deepStrictEqual(AB.adim(d, true), []); assert.deepStrictEqual(AB.adim(d, false), []); assert.strictEqual(JSON.stringify(d), kopyaD);
  // isikla bitis da sebep tasir
  const e = bosDurum(); e.y = 50; e.isik = 0.0001; const oe = AB.adim(e, false);
  assert.strictEqual(oe.find(x => x.tur === 'bitti').sebep, 'isik'); assert.strictEqual(e.sebep, 'isik');
});
dene('zemin: hic basmayan bocek zeminde bekleyerek yasamaz (baslangictan ~2 sn icinde zemin olumu)', () => {
  const d = AB.oyunOlustur(5); let n = 0;
  while (!d.bitti && n < 2400) { AB.adim(d, false); n++; }
  assert.strictEqual(d.sebep, 'zemin'); assert.ok(n * DT > 1 && n * DT < 2.5, (n * DT) + ' sn');
});
dene('baslangic: anlik olum yok (y = Y_BASLA, sersem/koruma 0); ilk 0,5 sn basili ya da birakili bitmez', () => {
  [true, false].forEach(b => {
    const d = AB.oyunOlustur(9);
    assert.strictEqual(d.y, A.dunya.Y_BASLA); assert.strictEqual(d.sersem, 0); assert.strictEqual(d.zeminKoruma, 0); assert.strictEqual(d.sebep, '');
    const o = adimla(d, 60, b);
    assert.strictEqual(d.bitti, 0); assert.strictEqual(say(o, 'zemin') + say(o, 'sersem'), 0);
  });
});
dene('uyanma korumasi: ZEMIN_KORUMA icinde zemine degmek oldurmez (kistirilir), sure dolunca oldurur', () => {
  const d = sersemDurum(); adimla(d, SERSEM_ADIM, false); assert.strictEqual(d.sersem, 0);
  d.y = Y_ALT - 0.01; d.vy = MH.VY_ASAGI; d.ay = MH.G_SUZUL;      // uyanir uyanmaz zemine (yapay)
  let n = 0, o = [];
  for (; n < KORUMA_ADIM; n++) { o = AB.adim(d, false); assert.strictEqual(d.bitti, 0, 'koruma icinde olum, adim ' + n); assert.strictEqual(d.y, Y_ALT); }
  assert.strictEqual(d.zeminKoruma, 0);
  o = AB.adim(d, false);
  assert.strictEqual(d.bitti, 1); assert.strictEqual(d.sebep, 'zemin'); assert.strictEqual(say(o, 'zemin'), 1);
});
dene('uyanma korumasi: koruma icinde zeminden basarak kalkan bocek yasar; uyanip hic basmayan koruma bitince olur', () => {
  const d = sersemDurum(); adimla(d, SERSEM_ADIM, false);
  d.y = Y_ALT - 0.01; d.vy = MH.VY_ASAGI; d.ay = MH.G_SUZUL;
  adimla(d, 10, false); const o = adimla(d, 120, true);
  assert.strictEqual(d.bitti, 0); assert.ok(d.y < Y_ALT - 5); assert.strictEqual(say(o, 'zemin'), 0);
  // dogal akis: uyandiktan sonra birakili -> koruma (0,5 sn) bittikten sonra zemine varir ve olur
  const e = sersemDurum(); adimla(e, SERSEM_ADIM, false);
  let n = 0; while (!e.bitti && n < 2400) { AB.adim(e, false); n++; }
  assert.strictEqual(e.sebep, 'zemin'); assert.ok(n > KORUMA_ADIM, 'koruma bitmeden zemine vardi: ' + n);
  // T_MIN gecikmeyle basan oyuncu zemine degmez
  const f = sersemDurum(); adimla(f, SERSEM_ADIM, false);
  let enAlt = 0; for (let i = 0; i < 240; i++) { AB.adim(f, i >= Math.round(A.adalet.T_MIN / DT)); enAlt = Math.max(enAlt, f.y); }
  assert.strictEqual(f.bitti, 0); assert.ok(enAlt < Y_ALT, 'en alt ' + enAlt);
  yakin(enAlt, AB.uyanmaY + AB.uyanmaDususu(A.adalet.T_MIN), 0.05, 'uyanmaDususu gercek adimla ayni');
});
dene('fren mesafesi gercek adimla ayni (zemine/tavana dogru tam hizdan ters tam girdi)', () => {
  const d = bosDurum(); d.y = 50; d.vy = MH.VY_ASAGI; d.ay = MH.G_SUZUL;
  let y0 = d.y, n = 0; while (n++ < 600) { AB.adim(d, true); if (d.vy <= 0) break; }
  yakin(d.y - y0, AB.frenMesafesi(1), 0.3, 'asagi');
  const e = bosDurum(); e.y = 50; e.vy = -MH.VY_YUKARI; e.ay = -MH.A_YUKSEL; y0 = e.y; n = 0;
  while (n++ < 600) { AB.adim(e, false); if (e.vy >= 0) break; }
  yakin(y0 - e.y, AB.frenMesafesi(-1), 0.5, 'yukari');
});
dene('JSON gidis-donusu sersemken ve koruma icinde: ayni devam', () => {
  const a = sersemDurum(); adimla(a, 50, false);
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 200; i++) assert.deepStrictEqual(AB.adim(b, girdi(i)), AB.adim(a, girdi(i)));
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
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
  for (let i = 0; i < 1200; i++) AB.adim(korumali(d), false);
  assert.strictEqual(d.bitti, 0); assert.ok(d.mesafe > 230);
  assert.strictEqual(d.puan, Math.floor(d.mesafe / 4));
});
dene('bolge: agirlik bolgesi puanla hemen, gorunenBolge nefes varinca', () => {
  const d = AB.oyunOlustur(77);
  for (let i = 0; i < 1200; i++) { d.isik = 1; AB.adim(korumali(d), girdi(i)); }
  assert.strictEqual(d.gorunenBolge, 0); assert.ok(d.puan < 500);
  d.puan = 500;
  let o = AB.adim(d, false), n = 0;
  assert.strictEqual(d.bolge, 1); assert.strictEqual(d.gorunenBolge, 0); assert.strictEqual(say(o, 'bolge'), 0);
  let nefes = null;
  while (n++ < 4000) {
    d.isik = 1; o = AB.adim(korumali(d), false);
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
dene('isik sifirlanacakken zemin temasi ayni adimda -> tek bitti, sebep zemin, sonraki adim bos', () => {
  const d = bosDurum(); d.y = Y_ALT - 0.1; d.vy = MH.VY_ASAGI; d.ay = MH.G_SUZUL; d.isik = 1e-9;
  const o = AB.adim(d, false);
  assert.strictEqual(say(o, 'bitti'), 1); assert.strictEqual(say(o, 'zemin'), 1);
  assert.strictEqual(o.find(x => x.tur === 'bitti').sebep, 'zemin');
  assert.strictEqual(d.bitti, 1); assert.strictEqual(d.sebep, 'zemin'); assert.strictEqual(d.isik, 1e-9, 'zemin adiminda dunya (isik sizintisi) islemez'); assert.strictEqual(d.y, Y_ALT);
  const kopyaD = JSON.stringify(d);
  assert.deepStrictEqual(AB.adim(d, true), []); assert.deepStrictEqual(AB.adim(d, false), []); assert.strictEqual(JSON.stringify(d), kopyaD);
});
dene('hasar ile bitis tek bitti', () => {
  const d = bosDurum(); d.y = 50; d.isik = 0.2;
  d.dilimler = [dilim([{ tur: 'dal', x: 0, y: 0, w: 1e6, h: 100 }])];
  const o = adimla(d, 300, false);
  assert.strictEqual(say(o, 'bitti'), 1); assert.strictEqual(say(o, 'hasar'), 1);
});
dene('dilimler UFUK ileriye kadar uretilir, arkadakiler atilir', () => {
  const d = AB.oyunOlustur(31);
  for (let i = 0; i < 6000; i++) {
    d.isik = 1; AB.adim(korumali(d), girdi(i));
    const son = d.dilimler[d.dilimler.length - 1], ilk = d.dilimler[0];
    assert.ok(son.x > d.mesafe + XB + A.uretici.UFUK);
    assert.ok(ilk.x + ilk.w >= d.mesafe - 1 - AB.zorluk(d.mesafe).hiz * DT);
  }
  assert.ok(d.dilimler.length < 12);
});
// Gorunen genislik (atesBocegiOyun.js): W .. H * ORAN_MAX. Uretim ufku cihazdan bagimsiz: kosu sirasinda uretilen her
// dilimin her nesnesi (engel, kus, dusen dal, salinan, toz, kivilcim, bomba, sarmasik sutunu; cizim yaricapi/halesi
// dahil) dogdugu adimda en genis gorunur alanin sag kenarinin (ekran x = GW_MAX) otesindedir, dolayisiyla her GW'de.
const GW_MAX = A.dunya.H * A.dunya.ORAN_MAX, GW_LER = [A.dunya.W, 64, 82, 120, 160, GW_MAX];
function dilimSolKenar(s) {        // dilimin en soldaki cizilen noktasi (dunya x'i)
  const MH2 = A.hareket; let x = Infinity;
  s.engeller.forEach(e => { x = Math.min(x, e.x - 0.3); });                      // dal sprite payi 0,3
  s.toz.forEach(t => { x = Math.min(x, t.x - MH2.R_TOZ_GORSEL * 3.2); });          // toz parlamasi
  if (s.kivilcim) x = Math.min(x, s.kivilcim.x - MH2.R_KIVILCIM_GORSEL * 3);
  if (s.bomba) x = Math.min(x, s.bomba.x - MH2.R_BOMBA * 2.2);                       // bomba halesi
  if (s.sarmasik) s.sarmasik.sutunlar.forEach(c => { x = Math.min(x, c.x - 1); });
  return x;
}
dene('hicbir nesne gorunur alanin icinde dogmaz (GW = ' + GW_LER.map(g => g.toFixed(1)).join(', ') + '); puan 0 ve 6200', () => {
  const tur = { kus: 0, dusen: 0, salinan: 0, bomba: 0, sarmasik: 0, kivilcim: 0 };
  let enAz = Infinity, dilim = 0;
  [[7, 0], [8, 6200], [9, 6200]].forEach(([t, puan]) => {
    const d = AB.oyunOlustur(t); let son = d.dilimler[d.dilimler.length - 1].no;
    for (let i = 0; i < 30000; i++) {
      d.isik = 1; if (puan) { d.puan = puan; d.esikPuan = Math.max(d.esikPuan, AB.uretimPuani(puan, AB.ileriTozPuani(d))); d.bolge = AB.bolgeNo(d.esikPuan); }
      AB.adim(korumali(d), girdi(i));
      for (const s of d.dilimler) {
        if (s.no <= son) continue;
        son = s.no; dilim++;
        const sx = dilimSolKenar(s) - d.mesafe; enAz = Math.min(enAz, sx);
        GW_LER.forEach(g => assert.ok(sx >= g, 'dilim ' + s.no + ' ekran x ' + sx.toFixed(2) + ' < GW ' + g.toFixed(1)));
        s.engeller.forEach(e => { if (e.tur === 'kus' || e.tur === 'dusen' || e.tur === 'salinan') tur[e.tur]++; });
        if (s.bomba) tur.bomba++; if (s.sarmasik) tur.sarmasik++; if (s.kivilcim) tur.kivilcim++;
      }
    }
  });
  console.log('       ' + dilim + ' dilim, dogusta en kucuk ekran x ' + enAz.toFixed(2) + ' (GW_MAX ' + GW_MAX.toFixed(2) + '); ' + JSON.stringify(tur));
  Object.keys(tur).forEach(k => assert.ok(tur[k] > 0, k + ' sinanmadi'));
});
dene('kus (hizli yaklasan) ve dusen dal: dogdugu adimda GW_MAX otesinde, sonraki adimlarda da ekrana sagdan girer', () => {
  const d = AB.oyunOlustur(12); let son = d.dilimler[d.dilimler.length - 1].no, kus = 0;
  const izle = [];
  for (let i = 0; i < 30000; i++) {
    d.isik = 1; AB.adim(korumali(d), girdi(i));
    for (const s of d.dilimler) if (s.no > son) { son = s.no; s.engeller.forEach(e => { if (e.tur === 'kus' || e.tur === 'dusen') izle.push({ e, onceki: e.x - d.mesafe }); }); }
    for (const z of izle) {
      const sx = z.e.x - d.mesafe;
      if (z.onceki >= GW_MAX && sx < GW_MAX) { kus++; assert.ok(sx > GW_MAX - AB.zorluk(d.mesafe).hiz * DT * (1 + A.adalet.KUS_EK) - 1e-9, 'ekrana atlayarak girdi'); }
      z.onceki = sx;
    }
  }
  assert.ok(kus > 10, 'yeterli kus/dusen yok ' + kus);
});
dene('ayni tohum ve girdi: iki kosuda ayni dilim dizisi (determinizm; cihaz bagimsizligi burada sinanmaz, yalniz cekirdek API genislik almaz: oyunOlustur(tohum), adim(d, basili))', () => {
  const kayit = () => {
    const d = AB.oyunOlustur(4242), L = {};
    const k = () => d.dilimler.forEach(s => { if (!(s.no in L)) L[s.no] = JSON.stringify([s.x, s.c, s.tur, s.tozsuz, s.puan, s.engeller, s.toz, s.bomba, s.sarmasik && s.sarmasik.sutunlar]); });
    k();
    for (let i = 0; i < 20000; i++) { d.isik = 1; AB.adim(korumali(d), girdi(i)); k(); }
    return L;
  };
  const a = kayit(), b = kayit();
  assert.ok(Object.keys(a).length > 50); assert.deepStrictEqual(a, b);
  // 13: ikinci parametre yalniz test kancasi { mesafe, puan } (genislik degil); verilmezse eski davranis aynen
  assert.strictEqual(AB.oyunOlustur.length, 2); assert.strictEqual(AB.adim.length, 2);
  assert.strictEqual(JSON.stringify(AB.oyunOlustur(4242, {})), JSON.stringify(AB.oyunOlustur(4242)));
});
dene('esik telafisi: uretim puani = en buyuk(puan + L / MESAFE_BIRIM + en kucuk(ileri toz puani, ESIK_TOZ_TAVAN)) (L = UFUK - ESIK_UFUK), azalmaz; dilim.puan ve agirlik bolgesi bununla', () => {
  const L = A.uretici.UFUK - A.uretici.ESIK_UFUK, ek = L / A.puan.MESAFE_BIRIM, TV = A.uretici.ESIK_TOZ_TAVAN;
  assert.strictEqual(L, 130); assert.strictEqual(AB.uretimPuani(800, 0), 800 + ek); assert.strictEqual(ek, 32.5); assert.strictEqual(TV, 100);
  assert.strictEqual(AB.uretimPuani(800, 64), 800 + ek + 64);
  assert.strictEqual(AB.uretimPuani(800, 500), 800 + ek + TV, 'tavan');
  assert.strictEqual(AB.uretimPuani(800, undefined), 800 + ek, 'toz puani yok: 0');
  const d = AB.oyunOlustur(5); let son = d.dilimler[d.dilimler.length - 1].no, n = 0, enCok = 0, dustu = 0, sonP = -1;
  assert.strictEqual(d.esikPuan, AB.uretimPuani(0, AB.ileriTozPuani(d)), 'baslangic: acilis dilimlerinin tozu'); assert.ok(d.esikPuan > ek);
  for (let i = 0; i < 20000; i++) {
    d.isik = 1; const e0 = d.esikPuan, h0 = AB.uretimPuani(d.puan, AB.ileriTozPuani(d)); AB.adim(korumali(d), girdi(i));
    const h1 = AB.uretimPuani(d.puan, AB.ileriTozPuani(d)); enCok = Math.max(enCok, h1 - d.puan - ek);
    if (h1 < h0) dustu++;                                                       // ham tahmin dusebilir (kacan toz, zincir kopmasi)...
    assert.ok(d.esikPuan >= e0 && d.esikPuan >= h1);                             // ...kullanilan deger azalmaz
    assert.ok(d.esikPuan <= d.puan + ek + TV + 1e-9, 'ust sinir');              // sabit ust sinir: puan + ek + tavan
    assert.strictEqual(d.bolge, AB.bolgeNo(d.esikPuan));
    for (const s of d.dilimler) if (s.no > son) {
      son = s.no; n++;
      assert.ok(s.puan >= e0 && s.puan <= d.esikPuan + 1e-9 && s.puan >= sonP, 'dilim ' + s.no + ' puan ' + s.puan);
      sonP = s.puan;
    }
  }
  assert.ok(n > 20 && enCok > 10 && dustu > 0, 'n ' + n + ' toz terimi en cok ' + enCok + ' dusen adim ' + dustu);
});
dene('ileri toz puani (esik telafisi): pencere (bx, bx + L]; alinmis/yutulmus toz ve kivilcim sayilmaz; zincir carpani zincir + k; tozsuz pencere 0', () => {
  const L = A.uretici.UFUK - A.uretici.ESIK_UFUK, T = A.puan.TOZ;
  const d = bosDurum(); d.y = 50;
  assert.strictEqual(AB.ileriTozPuani(d), 0, 'dilim yok');
  const bx = d.mesafe + XB, tz = (x, ek) => Object.assign({ x: bx + x, y: 50, alindi: 0, yutuldu: 0 }, ek || {});
  d.dilimler = [dilim([], [tz(-0.5), tz(0), tz(1), tz(2, { alindi: 1 }), tz(3, { yutuldu: 1 }), tz(5)], { x: bx + 6, y: 50, alindi: 0 }),
                dilim([], [tz(L - 1), tz(L), tz(L + 0.01)], null), dilim([], [tz(L + 5)], null)];
  // sayilan: x = 1, 5, L - 1, L (4 toz); bx'te ya da gerisinde, alinmis, yutulmus, pencere disi, kivilcim sayilmaz
  d.zincir = 0; assert.strictEqual(AB.ileriTozPuani(d), 4 * T);
  d.zincir = 3; assert.strictEqual(AB.ileriTozPuani(d), T * (AB.carpan(3) + AB.carpan(4) + AB.carpan(5) + AB.carpan(6)));
  d.zincir = 100; assert.strictEqual(AB.ileriTozPuani(d), 4 * T * A.puan.CARPAN_TAVAN);
  d.dilimler = [dilim([], [], null), dilim([], [tz(L + 1)], null)];
  assert.strictEqual(AB.ileriTozPuani(d), 0, 'tozsuz pencere');
  // dogal kosu: kacan toz ve hasar (zincir 0) tahmini hemen dusurur; esikPuan yine azalmaz
  const e = AB.oyunOlustur(77); let dus = 0, hasar = 0;
  for (let i = 0; i < 20000; i++) {
    e.isik = 1; const once = AB.ileriTozPuani(e), e0 = e.esikPuan; const o = AB.adim(korumali(e), girdi(i));
    if (o.some(q => q.tur === 'hasar' || q.tur === 'ag')) { hasar++; if (AB.ileriTozPuani(e) < once) dus++; }
    assert.ok(e.esikPuan >= e0);
  }
  assert.ok(hasar > 0 && dus > 0, 'hasar ' + hasar + ' dusus ' + dus);
});

// ---- Ekonomi: blok ayrica kesilip calistirilir ----

// ---------------------------------------------------------------
// FAZ B (tasarim 13): kademe, hiz/sizinti rampasi, salinan engel, duzensiz isik, test kancasi
// ---------------------------------------------------------------
console.log('Kademe ve rampa (13)');
const Z13 = A.zorluk, KAD = Z13.KADEME;
// 14: derece orani d / D_MAX (D_MAX 0 iken 0: FAZ 3 kapali, derece eki yok)
const dOran = m => Z13.D_MAX > 0 ? AB.derece(m) / Z13.D_MAX : 0;
dene('kademeNo: KADEME [0, 500, 1600, 2800, 4000] birim; 5 en cok', () => {
  assert.deepStrictEqual(Array.from(KAD), [0, 500, 1600, 2800, 4000]);
  assert.deepStrictEqual([0, 499.99, 500, 1599, 1600, 2799, 2800, 3999.9, 4000, 1e7].map(AB.kademeNo), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
dene('rampa: kademe 1 (mesafe <= 500) hiz/sizinti eski formulle bit bit ayni; sonra monoton, tavanli (44 / 0,06)', () => {
  for (let d = 0; d <= KAD[1]; d += 3.7) {
    const z = AB.zorluk(d), zz = 1 - Math.exp(-d / 9000);
    assert.strictEqual(z.hiz, Math.min(44, 24 + 18 * zz + 2 * Math.log2(1 + d / 40000)), 'hiz ' + d);
    assert.strictEqual(z.sizinti, 0.028 + 0.022 * zz, 'sizinti ' + d);
  }
  let h = 0, s = 0;
  for (let d = 0; d < 300000; d += 13) {
    const z = AB.zorluk(d);
    assert.ok(z.hiz >= h && z.sizinti >= s - 1e-15 && z.hiz <= Z13.HIZ_TAVAN && z.sizinti <= Z13.SIZINTI_TAVAN + Z13.D_SIZINTI * dOran(d) + 1e-15, 'd ' + d); h = z.hiz; s = z.sizinti;
  }
  const e = AB.zorluk(Z13.RAMPA_SON), ze = 1 - Math.exp(-Z13.RAMPA_SON / 9000);
  yakin(e.hiz, Math.min(44, 24 + 18 * ze + 2 * Math.log2(1 + Z13.RAMPA_SON / 40000) + Z13.HIZ_EK), 1e-12);
  yakin(AB.zorluk(8000).hiz, 44, 1e-12, 'tavan ~8000');
});
dene('oyunOlustur(tohum, {mesafe, puan}): baslangic mesafe/puan/kademe/esik/bolge; ilk 3 dilim acilis; baslangicta kademe olayi yok', () => {
  const d = AB.oyunOlustur(77, { mesafe: 3000, puan: 6000 });
  assert.strictEqual(d.mesafe, 3000); assert.strictEqual(d.puan, 6000); assert.strictEqual(d.kademe, 4);
  assert.ok(d.esikPuan >= AB.uretimPuani(6000, 0)); assert.strictEqual(d.bolge, AB.bolgeNo(AB.uretimPuani(6000, 0))); assert.strictEqual(d.gorunenBolge, d.bolge);
  assert.ok(d.dilimler[0].x > 3000 + XB && d.dilimler.slice(0, 3).every(s => s.engeller.every(e => e.tur === 'dal') && s.alt - s.ust === A.uretici.ACILIS_BOSLUK));
  const o = AB.adim(korumali(d), false);
  assert.strictEqual(o.filter(q => q.tur === 'kademe').length, 0);
  assert.strictEqual(AB.oyunOlustur(5).kademe, 1);
});
dene('kademe olayi: her esikte bir kez, artan sirada, esigi gecen adimda (2, 3, 4, 5; 5ten sonra yok)', () => {
  [[11, 0], [12, 450], [13, 3990]].forEach(([t, m0]) => {
    const d = AB.oyunOlustur(t, { mesafe: m0 }), gor = [];
    for (let i = 0; i < 120 * 400 && d.mesafe < 6000; i++) {
      d.isik = 1; d.dokunulmaz = 1; const once = d.mesafe;
      AB.adim(korumali(d), girdi(i)).forEach(o => { if (o.tur === 'kademe') { gor.push(o.kademe); assert.ok(once < KAD[o.kademe - 1] && d.mesafe >= KAD[o.kademe - 1], 'esik adimi ' + o.kademe); } });
    }
    assert.deepStrictEqual(gor, [2, 3, 4, 5].filter(k => KAD[k - 1] > m0), 'tohum ' + t);
    assert.strictEqual(d.kademe, 5);
  });
});
dene('salinan (13): yalniz kademe 3+; supurulen zarf boslugu kesmez, her fazda gecit >= bosluk; duvardan SAL_KENAR; genlik/periyot kademeyle', () => {
  let n = 0, ust = 0, kd5 = 0, kd3 = 0;
  for (let t = 1; t <= 40; t++) surucu(t, 400, i => i * 25).forEach(s => {
    const m = s.x - XB;
    assert.strictEqual(s.kademe, AB.kademeNo(m));
    s.engeller.filter(e => e.tur === 'salinan').forEach(e => {
      n++; if (e.yon === 'ust') ust++; if (s.kademe === 5) kd5++; if (s.kademe === 3) kd3++;
      assert.ok(s.kademe >= 3, 'kademe ' + s.kademe);
      const f = Math.max(0, Math.min(1, (m - KAD[2]) / (KAD[4] - KAD[2]))), dn = dOran(m);   // 14: derece eki
      yakin(e.gen, Z13.SAL_GENLIK[0] + (Z13.SAL_GENLIK[1] - Z13.SAL_GENLIK[0]) * f + Z13.D_SAL_GENLIK * dn, 1e-9, 'genlik');
      yakin(2 * Math.PI / e.om, Z13.SAL_PERIYOT[0] + (Z13.SAL_PERIYOT[1] - Z13.SAL_PERIYOT[0]) * f - Z13.D_SAL_PERIYOT * dn, 1e-9, 'periyot');
      assert.ok(e.w === Z13.SAL_GEN && e.h >= Z13.SAL_BOY_MIN && e.h <= Z13.SAL_BOY_MAX && e.x === s.x);
      const y1 = e.yc - e.gen, y2 = e.yc + e.gen + e.h;
      assert.ok(y1 >= Z13.SAL_KENAR - 1e-9 && y2 <= A.dunya.H - Z13.SAL_KENAR + 1e-9, 'duvar');
      assert.ok(e.yon === 'ust' ? Math.abs(y2 - s.ust) < 1e-9 : Math.abs(y1 - s.alt) < 1e-9, 'uc noktada bosluk kenarina deger');
      for (let k = 0; k < 64; k++) {                           // her faz: govde boslugu kesmez, gecit = bosluk
        const y = e.yc + e.gen * Math.sin(k * Math.PI / 32);
        assert.ok(y + e.h <= s.ust + 1e-9 || y >= s.alt - 1e-9, 'faz ' + k);
      }
      assert.ok(s.alt - s.ust >= s.bosluk - 1e-9);
    });
  });
  console.log('       ' + n + ' salinan (ust ' + ust + ', kademe 3: ' + kd3 + ', kademe 5: ' + kd5 + ')');
  assert.ok(n > 200 && ust > 20 && n - ust > 20 && kd3 > 10 && kd5 > 50);
});
dene('salinan adimi: y = yc + gen * sin(om * t + faz); carpma isik -HASAR (0,34), dokunulmaz, zincir 0; govde disinda (ip) carpma yok', () => {
  const kur = y0 => { const d = bosDurum(); d.y = y0; d.vy = 0; d.ay = 0; d.zincir = 6; d.isik = 0.9;
    const e = { tur: 'salinan', yon: 'ust', x: d.mesafe + XB - 1, y: 0, w: 5, h: 6, yc: 40, gen: 3, om: 2 * Math.PI / 2, faz: 0.4 };
    d.dilimler = [dilim([e], [])]; return [d, e]; };
  const [d, e] = kur(10);                                     // govdenin ustunde (ip bolgesi): carpma yok
  const o = AB.adim(d, false);
  yakin(e.y, 40 + 3 * Math.sin(Math.PI * d.t + 0.4), 1e-12);
  assert.strictEqual(o.filter(q => q.tur === 'hasar').length, 0);
  const [d2, e2] = kur(43);
  const o2 = AB.adim(d2, false), h = o2.find(q => q.tur === 'hasar');
  assert.ok(h && h.engel === 'salinan', JSON.stringify(o2));
  yakin(d2.isik, 0.9 - A.isik.HASAR - AB.zorluk(0).sizinti * DT, 1e-12); assert.strictEqual(d2.zincir, 0); yakin(d2.dokunulmaz, A.isik.DOKUNULMAZ, 1e-12);
  assert.strictEqual(A.isik.HASAR, 0.34); assert.ok(e2.y > 30);
});
// Ulasilabilirlik bagimsiz benzetimle tools/atesBocegiAdaletTest.js'de (cekirdek kacis islevleri kullanilmaz).
dene('duzensiz isik (13): kademe < 4 dag 0; kademe 5 dag 1; son toz yayda; tozlar x marjinda; dusen toz boslugu sinirli; en az 2 toz', () => {
  let n = 0, kayan = 0, dag1 = 0;
  for (let t = 1; t <= 40; t++) {
    const L = surucu(t, 300, i => i * 25);
    L.forEach((s, i) => {
      const m = s.x - XB, p = L[i - 1];
      if (s.kademe < 4) assert.strictEqual(s.dag, 0);
      if (!s.dag || !p) return; n++; if (s.dag === 1) dag1++;
      yakin(s.dag, Math.min(1, (m - KAD[3]) / (KAD[4] - KAD[3])), 1e-9);
      assert.ok(!s.tozsuz && !s.bomba && !s.sarmasik && !s.nefes && s.toz.length >= 2 && s.toz.length <= A.uretici.TOZ_MAX);
      const a = p.x + p.w, b = s.x, c1 = p.c, c2 = s.c;
      const son = s.toz[s.toz.length - 1], f = (son.x - a) / (b - a);
      const dx = Z13.DAG_X + Z13.D_DAG_X * dOran(m);                               // 14: derece eki
      let once = a; s.toz.forEach(z => { assert.ok(z.x - once <= (Z13.DAG_BOSLUK + 2 * dx / (A.uretici.TOZ_MIN + 1)) * (b - a) + 1e-9, 'toz boslugu'); once = z.x; });
      assert.ok(Math.abs(son.y - (c1 + (c2 - c1) * (1 - Math.cos(Math.PI * f)) / 2)) <= A.uretici.TOZ_SAPMA + 1e-9, 'son toz yayda');
      s.toz.forEach((z, j) => {
        assert.ok(z.x >= a + Z13.ISIK_MARJ - 1e-9 && z.x <= b - Z13.ISIK_MARJ + 1e-9 && (!j || z.x > s.toz[j - 1].x), 'x marji / sira');
        const fj = (z.x - a) / (b - a); if (Math.abs(z.y - (c1 + (c2 - c1) * (1 - Math.cos(Math.PI * fj)) / 2)) > A.uretici.TOZ_SAPMA + 1e-6) kayan++;
      });
    });
  }
  console.log('       ' + n + ' duzensiz dilim (dag 1: ' + dag1 + '), yaydan TOZ_SAPMA otesine kayan toz ' + kayan);
  assert.ok(n > 500 && dag1 > 200 && kayan > 500);
});
dene('bomba sikligi (13, on isaret): mesafe kovasi 5000-8000 / 8000-20000 / 20000-30000 birimde bomba orani > %8 (HEAD: 20000+ %0)', () => {
  // puan ~ 0,75 * mesafe (Bot B gercek isik olcumune yakin); bomba esigi (1200) gecilmis, siradan + ozel dilimler dahil
  const kova = [[5000, 8000], [8000, 20000], [20000, 30000]].map(k => ({ k, d: 0, b: 0 }));
  for (let t = 1; t <= 40; t++) {
    const u = AB.ureticiOlustur(t);
    for (let i = 0; i < 800; i++) {
      const p = Math.round((u.veri.x - XB) * 0.75), s = u.sonraki(AB.bolgeNo(p), p), m = s.x - XB;
      if (m >= 30000) break;
      const q = kova.find(o => m >= o.k[0] && m < o.k[1]);
      if (q && p >= A.uretici.BOMBA_PUAN) { q.d++; if (s.bomba) q.b++; }
    }
  }
  console.log('       bomba orani: ' + kova.map(o => o.k.join('-') + ' %' + (100 * o.b / o.d).toFixed(1) + ' (' + o.d + ' dilim, hiz ' + AB.zorluk(o.k[0]).hiz.toFixed(1) + ')').join(', '));
  kova.forEach(o => assert.ok(o.d > 1000 && o.b / o.d > 0.08, o.k.join('-') + ' %' + (100 * o.b / o.d).toFixed(1)));
});
dene('bozuk ayar (13): KADEME sirasiz, sizinti tavani tozsuz ekonomisini asar, kademe 1-2 salinan, ISIK_MARJ kucuk, salinan hizli', () => {
  const durum = f => { const a = ayarKopya(); f(a); return AB.ayarDogrula(a); };
  assert.ok(durum(a => { a.zorluk.KADEME = [0, 500, 400, 2800, 4000]; }).some(h => /KADEME/.test(h)));
  assert.ok(durum(a => { a.zorluk.SIZINTI_TAVAN = 0.07; a.zorluk.SIZINTI_EK = 0.03; }).some(h => /tozsuz pencerede isik/.test(h)));
  assert.ok(durum(a => { a.zorluk.SAL_AGIRLIK = [0, 1, 2, 3, 5]; }).some(h => /SAL_AGIRLIK/.test(h)));
  assert.ok(durum(a => { a.zorluk.ISIK_MARJ = 1; }).some(h => /ISIK_MARJ/.test(h)));
  assert.ok(durum(a => { a.zorluk.SAL_GENLIK = [2, 12]; }).some(h => /tepe hizi/.test(h)));
  assert.ok(durum(a => { a.zorluk.RAMPA_SON = 100; }).some(h => /rampa/.test(h)));
  assert.ok(durum(a => { a.zorluk.DAG_BOSLUK = 1; }).some(h => /duzensiz isik/.test(h)));
  assert.ok(durum(a => { a.uretici.BOMBA_ON_ISARET = 0; }).some(h => /bomba HIZ_TAVAN/.test(h)), 'on isaretsiz bomba HIZ_TAVAN degismezi');
  // sinir: ay = 0'da yollar toplami 7,382 >= 2 * 3,65 = 7,30 ama ay = -A'da 7,207 < 7,30 (hiz siniri): yalniz ay = 0 denetimi kacirir
  assert.ok(durum(a => { a.uretici.BOMBA_ON_ISARET = 3.2; a.adalet.PAY_KACIS = 0.45; }).some(h => /bomba HIZ_TAVAN/.test(h)), 'bomba degismezi butun ivme izgarasini denetler');
  assert.ok(!durum(a => { a.uretici.BOMBA_ON_ISARET = 4; }).some(h => /bomba HIZ_TAVAN/.test(h)), 'ON 4 yeterli (toplam 8,07 >= 7,40)');
});

// ---------------------------------------------------------------
// FAZ 3 (tasarim 14): Bolge 5 zorluk derecesi
// ---------------------------------------------------------------
console.log('Zorluk derecesi (14)' + (Z13.D_MAX > 0 ? '' : ' - D_MAX 0: FAZ 3 kapali; derece her yerde 0, uretim Bolge 5 ile ayni'));
// D_MAX 0 iken: derece her mesafede 0, zorluk her mesafede eski formul; d = D_MAX siklik ve kanca denetimleri atlanir.
const dAtla = ad => { console.log('  atla ' + ad + ' (D_MAX 0: atlandi)'); };
dene('derece: Bolge 5 oncesi 0; KADEME[4] + D_ADIM * k\'da k; D_MAX\'ta plato; tamsayi', () => {
  const B = KAD[4], S = Z13.D_ADIM;
  if (Z13.D_MAX === 0) { for (let m = 0; m < 1e5; m += 7.3) assert.strictEqual(AB.derece(m), 0); assert.strictEqual(AB.derece(1e7), 0); return; }
  assert.deepStrictEqual([0, 3999.9, B, B + S - 1e-6, B + S, B + 2 * S, B + Z13.D_MAX * S - 1e-6, B + Z13.D_MAX * S, 1e7].map(AB.derece),
                         [0, 0, 0, 0, 1, 2, Z13.D_MAX - 1, Z13.D_MAX, Z13.D_MAX]);
  for (let m = 0; m < 40000; m += 7.3) { const d = AB.derece(m); assert.ok(Number.isInteger(d) && d >= 0 && d <= Z13.D_MAX); }
});
dene('zorluk: d = 0 (mesafe < KADEME[4] + D_ADIM) eski formulle bit bit ayni; d > 0 tAra/bosluk azalir (alt sinirli), sizinti + D_SIZINTI * d / D_MAX', () => {
  const eski = m => { const z = 1 - Math.exp(-m / 9000), r = Math.max(0, Math.min(1, (m - 500) / (5000 - 500)));
    return { tAra: 1.90 - 0.65 * z, bosluk: 24 - 8 * z, sizinti: Math.min(0.06, 0.028 + 0.022 * z + 0.012 * r) }; };
  const dSon = Z13.D_MAX > 0 ? KAD[4] + Z13.D_ADIM : 80000;      // D_MAX 0: her mesafede d = 0
  for (let m = 0; m < dSon; m += 3.1) {
    const z = AB.zorluk(m), e = eski(m);
    assert.strictEqual(z.tAra, e.tAra); assert.strictEqual(z.bosluk, e.bosluk); assert.strictEqual(z.sizinti, e.sizinti);
  }
  for (let m = dSon; m < 80000; m += 11.7) {
    const z = AB.zorluk(m), e = eski(m), dn = dOran(m);
    yakin(z.tAra, Math.min(e.tAra, Math.max(Z13.D_TARA_MIN, e.tAra - Z13.D_TARA * dn)), 1e-12, 'tAra ' + m);
    yakin(z.bosluk, Math.min(e.bosluk, Math.max(16, e.bosluk - Z13.D_BOSLUK * dn)), 1e-12, 'bosluk ' + m);
    yakin(z.sizinti, e.sizinti + Z13.D_SIZINTI * dn, 1e-12, 'sizinti ' + m);
    assert.ok(z.tAra <= e.tAra && z.tAra > A.adalet.T_MIN + A.adalet.T_IVME && z.bosluk >= 16 - 1e-12);
  }
});
if (Z13.D_MAX === 0) dAtla('derece d = D_MAX: bomba, orumcek ve kombinasyon d = 0\'dan sik; tAra kisa');
else dene('derece d = D_MAX: bomba, orumcek ve kombinasyon d = 0\'dan sik; tAra kisa', () => {
  // ayni tohumlar; uretici Bolge 5 basindan (d 0) ve D_MAX basindan (d D_MAX) D_ADIM boyunca; puan ~ 0,75 * mesafe
  const olc = m0 => {
    const o = { n: 0, bomba: 0, sal: 0, kombo: 0, ara: 0 };
    for (let t = 1; t <= 40; t++) {
      const u = AB.ureticiOlustur(t); u.veri.x = m0 + XB; let p = null;
      for (let i = 0; i < 80; i++) {
        const pu = Math.round((u.veri.x - XB) * 0.75), s = u.sonraki(AB.bolgeNo(pu), pu), sal = s.engeller.some(e => e.tur === 'salinan');
        if (s.x - XB >= m0 + Z13.D_ADIM) break;
        if (i >= 3 && !s.nefes) { o.n++; if (s.bomba) o.bomba++; if (sal) o.sal++; if (p && ((s.bomba && p.sal) || (sal && p.teh))) o.kombo++; o.ara += s.tAra; }
        p = { sal: sal, teh: !!(s.bomba || s.sarmasik) };
      }
    }
    return o;
  };
  const a = olc(KAD[4]), b = olc(KAD[4] + Z13.D_ADIM * Z13.D_MAX), y = (o, k) => (100 * o[k] / o.n).toFixed(1);
  console.log('       d 0: ' + a.n + ' dilim, bomba %' + y(a, 'bomba') + ', orumcek %' + y(a, 'sal') + ', kombinasyon %' + y(a, 'kombo') + ', tAra ort ' + (a.ara / a.n).toFixed(3) +
              '; d ' + Z13.D_MAX + ': ' + b.n + ' dilim, bomba %' + y(b, 'bomba') + ', orumcek %' + y(b, 'sal') + ', kombinasyon %' + y(b, 'kombo') + ', tAra ort ' + (b.ara / b.n).toFixed(3));
  assert.ok(b.bomba / b.n > a.bomba / a.n && b.sal / b.n > a.sal / a.n && b.kombo / b.n > a.kombo / a.n && b.ara / b.n < a.ara / a.n);
});
dene('test kancasi mesafe >= 4000 ile: derece dilimin varis mesafesinden (D_MAX basi kancasinda ilk dilimden itibaren D_MAX)', () => {
  const m0 = KAD[4] + Z13.D_ADIM * Z13.D_MAX, d = AB.oyunOlustur(9, { mesafe: m0, puan: 12000 });
  d.dilimler.forEach(s => { assert.strictEqual(AB.derece(s.x - XB), Z13.D_MAX); assert.strictEqual(s.tAra, AB.zorluk(s.x - XB).tAra); });
  const d2 = AB.oyunOlustur(9, { mesafe: KAD[4] + Z13.D_ADIM * 2 + 1 });
  assert.ok(d2.dilimler.every(s => AB.derece(s.x - XB) >= Math.min(2, Z13.D_MAX)));   // D_MAX 0: her dilim d = 0
});
dene('bozuk ayar (14): D_MAX tamsayi degil, negatif ek, tAra alt siniri dusuk, olasilik > 1, orumcek hizli, DAG_X tasar, sizinti ekonomisi', () => {
  const durum = f => { const a = ayarKopya(); f(a); return AB.ayarDogrula(a); };
  assert.deepStrictEqual(AB.ayarDogrula(A), []);
  assert.ok(durum(a => { a.zorluk.D_MAX = 2.5; }).some(h => /derece ayarlari/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_BOMBA = -0.1; }).some(h => /derece ayarlari/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_TARA = 0.5; a.zorluk.D_TARA_MIN = 0.8; }).some(h => /derece: en kucuk tAra/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_TARA = 0.5; a.zorluk.D_TARA_MIN = 1.0; }).some(h => /derece: (serit|nefes)/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_BOMBA = 0.7; }).some(h => /derece: olasilik/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_SAL_GENLIK = 3; }).some(h => /derece: salinan tepe/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_DAG_X = 0.2; }).some(h => /derece: duzensiz/.test(h)));
  assert.ok(durum(a => { a.zorluk.D_SIZINTI = 0.03; }).some(h => /derece: tozsuz pencerede/.test(h)));
  // kivilcim platoda sigmali (FAZ 3 denetim; D_MAX 0 kopyasinda D_MAX >= 1 yapilir, plato tAra'si D_TARA_MIN'e bagli olsun): D_TARA_MIN 1,10 / 1,15'te bacak < KIVILCIM_UZAK_MIN (tek hata bu); 1,19'da sigar
  for (const v of [1.10, 1.15]) assert.deepStrictEqual(durum(a => { a.zorluk.D_MAX = Math.max(1, a.zorluk.D_MAX); a.zorluk.D_TARA = 0.3; a.zorluk.D_TARA_MIN = v; }), ['derece: platoda kivilcim sigmiyor (D_TARA_MIN cok kucuk)'], 'D_TARA_MIN ' + v);
  assert.deepStrictEqual(durum(a => { a.zorluk.D_MAX = Math.max(1, a.zorluk.D_MAX); a.zorluk.D_TARA = 0.3; a.zorluk.D_TARA_MIN = 1.19; }), []);
  // yay tozu derece bolgesinin en dusuk hiziyla (hiz1 = hiz(KADEME[4] + D_ADIM) < HIZ_TAVAN): taD 0,97'de hiz1 * taD yetmez (HIZ_TAVAN * taD yeterdi)
  assert.ok(durum(a => { a.zorluk.D_TARA = 0.4; a.zorluk.D_TARA_MIN = 0.97; }).some(h => /derece: yay tozu/.test(h)));
  assert.deepStrictEqual(durum(a => { a.zorluk.D_MAX = 0; }), [], 'D_MAX 0 (FAZ 3 kapali) gecerli');
});
// D_MAX 0 kopyasi (cekirdek kaynagi AYAR'da yalniz D_MAX 0 yapilip vm'de yuklenir) HEAD (5bb9227, FAZ 3 oncesi) ile birebir:
// (a) uretici 0-40000 birim, 8 tohum x 2 puan rejimi; (b) oyunOlustur + adim (korumali bot, 60 sn) kancasiz / kanca 4000 / kanca
// 16000: her adimin olaylari ve durum JSON'u (FAZ 3'un eklemesi uretici.salOnce haric). Ikinci sans KAPSAM DISI: dogmaSec FAZ 3'te
// bilerek degisti (on kenar, R_CARPMA). Ozetler HEAD cekirdegiyle hesaplandi; yeniden hesap / canli karsilastirma:
//   git show 5bb9227:js/atesBocegi.js > head.js && AB_HEAD=head.js node tools/atesBocegiTest.js
function abYukle(src) { const m = { exports: {} }; vm.runInNewContext(src, { module: m }); return m.exports; }
function abFnv(h, s) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
function d0Ozet(K) {
  const X = K.AYAR.dunya.X_BOCEK, o = {};
  for (const [ad, k] of [['uretim75', 0.75], ['uretim25', 0.25]]) {
    let h = 0x811C9DC5, n = 0;
    for (const t of [1, 2, 3, 7, 42, 1234, 99991, 5760095]) {
      const u = K.ureticiOlustur(t);
      for (;;) { const p = Math.round((u.veri.x - X) * k), s = u.sonraki(K.bolgeNo(p), p); if (s.x - X >= 40000) break; h = abFnv(h, JSON.stringify(s)); n++; }
    }
    o[ad] = h.toString(16) + '/' + n;
  }
  const N = Math.round(60 / K.AYAR.dunya.DT);
  for (const [ad, bas] of [['oyun0', undefined], ['oyun4000', { mesafe: 4000, puan: 3000 }], ['oyun16000', { mesafe: 16000, puan: 12000 }]]) {
    let h = 0x811C9DC5, m = 0;
    for (let t = 1; t <= 6; t++) {
      const d = K.oyunOlustur(t * 31, bas);
      for (let i = 0; i < N && !d.bitti; i++) {
        let c = d.y; const bx = d.mesafe + X; for (const s of d.dilimler) if (s.x + s.w >= bx - 2) { c = s.c; break; }
        d.zeminKoruma = 1; if (d.isik < 0.3) d.isik = 1;        // korumali: kosu 60 sn surer (iki taraf ayni)
        h = abFnv(h, JSON.stringify(K.adim(d, d.y > c)));
        if (i % 600 === 599 || i === N - 1) { const st = JSON.parse(JSON.stringify(d)); delete st.uretici.salOnce; h = abFnv(h, JSON.stringify(st)); }
      }
      m = Math.max(m, d.mesafe);
    }
    o[ad] = h.toString(16) + '/' + Math.floor(m);
  }
  return o;
}
dene('D_MAX 0 kopyasi HEAD (5bb9227) ile birebir: uretici 0-40000, oyunOlustur + adim kancasiz / 4000 / 16000 (ikinci sans haric)', () => {
  const src0 = kaynak.replace(/\bD_MAX: \d+/, 'D_MAX: 0');
  assert.ok(src0 !== kaynak || A.zorluk.D_MAX === 0, 'D_MAX ayari bulunamadi');
  const K0 = abYukle(src0);
  assert.strictEqual(K0.AYAR.zorluk.D_MAX, 0); assert.strictEqual(JSON.stringify(K0.ayarDogrula(K0.AYAR)), '[]');   // vm baglami: dizi prototipi farkli
  const oz = d0Ozet(K0);
  // HEAD 5bb9227 ile hesaplandi (ozet/dilim sayisi; oyun: ozet/en buyuk mesafe)
  const HEAD_OZET = { uretim75: 'c6bfc477/5464', uretim25: '2bb4f863/5464', oyun0: '8540d7b7/1575', oyun4000: 'a10bc91c/6507', oyun16000: 'f483bb0a/18369' };
  // ayirt edicilik: D_MAX > 0 cekirdegin uretimi 5500 sonrasi HEAD'den farkli olmali (ozet derece eklerini goruyor)
  if (A.zorluk.D_MAX > 0) { const g = d0Ozet(AB); assert.ok(g.uretim75 !== HEAD_OZET.uretim75 && g.oyun16000 !== HEAD_OZET.oyun16000, 'ozet derece farkini gormuyor'); }
  if (process.env.AB_HEAD) {
    const H = abYukle(fs.readFileSync(process.env.AB_HEAD, 'utf8')), hz = d0Ozet(H);
    console.log('       HEAD canli: ' + JSON.stringify(hz));
    assert.deepStrictEqual(oz, hz, 'D_MAX 0 kopyasi canli HEAD ile ayni degil');
  }
  console.log('       D_MAX 0: ' + JSON.stringify(oz));
  assert.deepStrictEqual(oz, HEAD_OZET);
});

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
