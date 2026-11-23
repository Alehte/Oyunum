// suSiralaSikistiTest.js — Sirala Dur "Sikistin" tespiti (ilerlemeVarMi) dogrulamasi.
// Calistirma:  node tools/suSiralaSikistiTest.js        (hata varsa cikis kodu 1)
//
// OLCUTLER
// 1) Elle kurulan durumlar: tek bos yere ayni rengi gidip getirme dongusu -> sikisti
//    (hamle VAR ama ilerleme yok); hamle hic yok -> sikisti; kazanilmis -> degil;
//    birlesme / perde acma / kazanmaya giden yol -> degil.
// 2) Hamle kurallari degismedi: dongu hamleleri hala gecerli (engel konmadi).
// 3) Saglamlik: 250 bolumun baslangici ve en kisa cozum yolundaki HER durum "ilerleme
//    var" (cozulebilir durumda yanlis "Sikistin" yok).
// 4) Rastgele oyun: "sikisti" denen her durum cozucuye gore gercekten cozumsuz.
// 5) Ozel mod: ayni kontroller (camur = sikisti; kaba dokum = ilerleme).
// 6) Sure: tek cagri en kotu durumda bile kisa (oyun her dokum sonunda bir kez cagirir).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const U = require('./suSiralaUret');
const { S } = U.yukle();

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}
const D = (tupler, kaplar, gizli) => ({ tupler, kaplar: kaplar || tupler.map(() => 4), gizli: gizli || tupler.map(() => 0) });
const kl = d => ({ tupler: d.tupler.map(t => t.slice()), kaplar: d.kaplar, gizli: d.gizli ? d.gizli.slice() : null });
let enUzunMs = 0;
function olc(fn) { const t = process.hrtime.bigint(); const r = fn(); const ms = Number(process.hrtime.bigint() - t) / 1e6; if (ms > enUzunMs) enUzunMs = ms; return r; }

console.log('Elle kurulan durumlar (normal mod)');
dene('sari dongusu: hamle var, ilerleme yok -> sikisti', () => {
  // 0: [A,Y,Y] dolu (kap 3), 1: [B,Y] tek bos yer sarinin ustunde, digerleri dolu ve eslesmez
  const d = D([[0, 2, 2], [1, 2], [0, 1, 0], [1, 0, 1]], [3, 3, 3, 3]);
  assert.ok(S.gecerliHamleler(d).length > 0, 'hamle olmali');
  assert.strictEqual(S.ilerlemeVarMi(d), false);
  // dongunun iki ucu da ayni karar
  const y = kl(d); S.hamleUygula(y, 0, 1);
  assert.ok(S.gecerliHamleler(y).length > 0);
  assert.strictEqual(S.ilerlemeVarMi(y), false);
});
dene('dongu hamlesi engellenmedi (hamleGecerliMi aynen)', () => {
  const d = D([[0, 2, 2], [1, 2], [0, 1, 0], [1, 0, 1]], [3, 3, 3, 3]);
  assert.ok(S.hamleGecerliMi(d, 0, 1), 'ileri');
  const y = kl(d); S.hamleUygula(y, 0, 1);
  assert.ok(S.hamleGecerliMi(y, 1, 0), 'geri');
  const o = S.OyunOlustur(1);
  o.durum = kl(d);
  assert.ok(o.dok(0, 1) && o.dok(1, 0), 'oyun nesnesi de iki hamleyi kabul eder');
  assert.strictEqual(o.hamleSayisi, 2, 'ilerlemesiz hamleler de sayilir');
});
dene('hic hamle yok -> sikisti', () => {
  const d = D([[0, 1, 0], [1, 0, 1]], [3, 3]);
  assert.strictEqual(S.gecerliHamleler(d).length, 0);
  assert.strictEqual(S.ilerlemeVarMi(d), false);
});
dene('kazanilmis -> ilerleme var (sikisti degil)', () => {
  assert.strictEqual(S.ilerlemeVarMi(D([[0, 0], [1, 1], []], [2, 2, 2])), true);
});
dene('birlesme mumkun -> ilerleme var', () => {
  assert.strictEqual(S.ilerlemeVarMi(D([[0, 1], [1], [0]], [2, 2, 2])), true);
});
dene('birlesme iki adim sonra (once bosa tasi) -> ilerleme var', () => {
  // 0 ustundeki 1'i bos 2'ye tasiyinca 0 ile 3 birlesebilir
  assert.strictEqual(S.ilerlemeVarMi(D([[0, 1], [1, 0, 1], [], [0, 0]], [3, 3, 3, 3])), true);
});
dene('perdeli siseden dokulebiliyor -> ilerleme var (yeni bilgi)', () => {
  // dongu tahtasi, ama 0 yalniz ustu acik: tek sari dokulunce alttaki sari acilir
  const d = D([[0, 2, 2], [1, 2], [0, 1, 0], [1, 0, 1]], [3, 3, 3, 3], [2, 0, 0, 0]);
  assert.strictEqual(S.ilerlemeVarMi(d), true);
});
dene('oyun nesnesi: ilerlemeVarMi metodu durumu okur', () => {
  const o = S.OyunOlustur(1);
  assert.strictEqual(typeof o.ilerlemeVarMi, 'function');
  assert.strictEqual(o.ilerlemeVarMi(), true);
  o.durum = D([[0, 2, 2], [1, 2], [0, 1, 0], [1, 0, 1]], [3, 3, 3, 3]);
  assert.strictEqual(o.ilerlemeVarMi(), false);
  assert.strictEqual(o.oynanabilirMi(), true, 'eski olcut "hamle var" diyordu');
});

console.log('250 bolum: baslangic ve en kisa cozum yolu');
dene('her bolumun baslangici ve cozum yolundaki her durum: ilerleme var', () => {
  const hata = [];
  let durumSay = 0;
  for (let n = 1; n <= 250; n++) {
    const B = S.bolumUret(n);
    const c = U.enKisaCozum(B);
    assert.ok(c.yol, n + ': cozum bulunamadi');
    const d = kl(B);
    for (let i = 0; i <= c.yol.length; i++) {
      durumSay++;
      if (!S.kazanildiMi(d) && !olc(() => S.ilerlemeVarMi(d))) { hata.push(n + '@' + i); break; }
      if (i < c.yol.length) S.hamleUygula(d, c.yol[i][0], c.yol[i][1]);
    }
  }
  console.log('       ' + durumSay + ' durum denendi');
  assert.deepStrictEqual(hata, []);
});

console.log('Rastgele oyun: "sikisti" kararlari cozucuyle denetlenir');
dene('sikisti denen her durum gercekten cozumsuz', () => {
  const rng = S.rngOlustur(20261123);
  let sikisti = 0, durum = 0, belirsiz = 0;
  const yanlis = [];
  for (let n = 1; n <= 250; n += 3) {
    for (let tekrar = 0; tekrar < 4; tekrar++) {
      const d = kl(S.bolumUret(n));
      for (let adim = 0; adim < 80; adim++) {
        const h = S.gecerliHamleler(d);
        durum++;
        const ilerler = olc(() => S.ilerlemeVarMi(d));
        if (!ilerler) {
          sikisti++;
          const cz = S.CozucuOlustur(200000);
          const cozulur = cz.cozulurMu(d);
          if (cz.tastiMi()) belirsiz++;
          else if (cozulur) yanlis.push(n + '/' + tekrar + '@' + adim);
          break;
        }
        if (!h.length || S.kazanildiMi(d)) break;
        const m = h[Math.floor(rng() * h.length)];
        S.hamleUygula(d, m[0], m[1]);
      }
    }
  }
  console.log('       ' + durum + ' durum, ' + sikisti + ' sikisti (' + belirsiz + ' cozucu sinirina takildi)');
  assert.ok(sikisti > 0, 'rastgele oyunda hic sikisma gorulmedi: test anlamsiz');
  assert.deepStrictEqual(yanlis, []);
});

console.log('Ozel mod');
const ctxO = { window: {} };
vm.createContext(ctxO);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'suSirala.js'), 'utf8'), ctxO);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'suSiralaOzel.js'), 'utf8'), ctxO);
const O = ctxO.window.SuSiralaOzel;
const DO = (tupler, kaplar, kapMi, hedefler) => ({ tupler, kaplar, kapMi, hedefler });
const klO = d => ({ tupler: d.tupler.map(t => t.slice()), kaplar: d.kaplar, kapMi: d.kapMi, hedefler: d.hedefler });
dene('sise dongusu, kap dolu -> sikisti', () => {
  const d = DO([[0, 2, 2], [1, 2], [7, 1, 7], [1, 7, 1], [3, 3]], [3, 3, 3, 3, 2], [false, false, false, false, true], [{ renk: 3, adet: 2 }]);
  assert.ok(O.gecerliHamleler(d).length > 0);
  assert.strictEqual(O.ilerlemeVarMi(d), false);
});
dene('kaba dokum mumkun -> ilerleme var', () => {
  const d = DO([[0, 2, 2], [1, 2], [7, 1, 7], [1, 7, 1], [3]], [3, 3, 3, 3, 2], [false, false, false, false, true], [{ renk: 3, adet: 2 }]);
  assert.strictEqual(O.ilerlemeVarMi(d), true);
});
dene('camur -> sikisti', () => {
  const d = DO([[0, 0], [], [6, 6]], [2, 2, 2], [false, false, true], [{ renk: 3, adet: 2 }]);
  assert.strictEqual(O.ilerlemeVarMi(d), false);
});
// Ozel cozucu (cozumYolu) buyuk bolumlerde sinira takiliyor; cozum yolu uretecin
// kendi kurulumundan alinir: bozma hamleleri ters sirada geri dokulur (oyun kurallariyla
// dogrulanir), sonra her hedefin iki bileseni kaba dokulup karistirilir.
function ozelCozumYolu(n) {
  const T = O.ozelTahtaKur(n, (n * 2246822519 + 7919) >>> 0);
  const d = klO(T), yol = [];
  for (let i = T.bozmaHamleleri.length - 1; i >= 0; i--) yol.push([T.bozmaHamleleri[i][0], T.bozmaHamleleri[i][1]]);
  for (let g = 0; g < T.hedefler.length; g++) {
    const kap = T.normalSayisi + g;
    yol.push([2 * g, kap], [2 * g + 1, kap], [kap, -1]);
  }
  return { d, yol };
}
dene('100 ozel bolum: kurulum yolu kazandirir ve yoldaki her durumda ilerleme var', () => {
  const hata = [];
  for (let n = 1; n <= 100; n++) {
    const { d, yol } = ozelCozumYolu(n);
    const B = O.ozelBolumUret(n);
    assert.deepStrictEqual(d.tupler, B.tupler, n + ': kurulum bolumle ayni degil');
    let tamam = true;
    for (let i = 0; i <= yol.length; i++) {
      if (!O.kazanildiMi(d) && !olc(() => O.ilerlemeVarMi(d))) { hata.push(n + '@' + i); tamam = false; break; }
      if (i === yol.length) break;
      const m = yol[i];
      if (m[1] !== -1 && !O.hamleGecerliMi(d, m[0], m[1])) { hata.push(n + ':gecersiz@' + i); tamam = false; break; }
      O.hamleIsle(d, m[0], m[1]);
    }
    if (tamam && !O.kazanildiMi(d)) hata.push(n + ':kazanmadi');
  }
  assert.deepStrictEqual(hata, []);
});
dene('ozel rastgele oyun: sikisti denen her durum cozumsuz', () => {
  const rng = S.rngOlustur(77);
  let sikisti = 0, camur = 0, belirsiz = 0;
  const yanlis = [];
  for (let n = 1; n <= 100; n += 2) {
    const d = klO(O.ozelBolumUret(n));
    for (let adim = 0; adim < 60; adim++) {
      if (!olc(() => O.ilerlemeVarMi(d))) {
        sikisti++;
        if (O.camurVarMi(d)) { camur++; break; }   // camur kabi bosaltilamaz: tanim geregi olu
        const yol = O.cozumYolu(klO(d), 50000);
        if (yol) yanlis.push(n + '@' + adim);
        else if (O.cozumYolu.tastiMi) belirsiz++;
        break;
      }
      const h = O.gecerliHamleler(d);
      if (!h.length || O.kazanildiMi(d)) break;
      const m = h[Math.floor(rng() * h.length)];
      O.hamleIsle(d, m[0], m[1]);
    }
  }
  console.log('       ' + sikisti + ' sikisti durumu (' + camur + ' camur, ' + belirsiz + ' cozucu sinirina takildi)');
  assert.ok(sikisti > 0, 'hic sikisma gorulmedi: test anlamsiz');
  assert.deepStrictEqual(yanlis, []);
});

dene('tek cagri suresi < 150 ms (en uzun olculen)', () => {
  console.log('       en uzun ' + enUzunMs.toFixed(1) + ' ms');
  assert.ok(enUzunMs < 150);
});

console.log('\n' + gecti + ' kontrol gecti');
