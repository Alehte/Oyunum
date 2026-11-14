// kayitGocTest.js — core.js icindeki kayit gocunu (gocEt) eski kayit
// bicimleriyle dener. Calistirma:  node tools/kayitGocTest.js
// core.js tarayici kodu oldugu icin yalnizca KAYIT_SURUM..AppKayitGoc arasi
// kesilip ayri bir baglamda calistirilir.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const kaynak = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');
const bas = kaynak.indexOf('const KAYIT_SURUM'), son = kaynak.indexOf('window.AppKayitGoc');
if (bas < 0 || son < 0) { console.error('core.js icinde gocEt bolumu bulunamadi'); process.exit(1); }
const ctx = {};
vm.runInNewContext(kaynak.slice(bas, son) + '\nthis.gocEt = gocEt; this.varsayilan = varsayilanIlerleme; this.SURUM = KAYIT_SURUM;', ctx);
const { gocEt, varsayilan, SURUM } = ctx;
const kopya = o => JSON.parse(JSON.stringify(o));   // diskten okunmus gibi

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('kayit gocu (KAYIT_SURUM=' + SURUM + ')');

dene('kayit yok -> varsayilan, diske yazilir', () => {
  const g = gocEt(null);
  assert.deepStrictEqual(kopya(g.p), kopya(varsayilan()));
  assert.strictEqual(g.degisti, true);
});

dene('bozuk kayit (dizi / sayi / metin) -> varsayilan', () => {
  [[], 5, 'x', true].forEach(b => {
    const g = gocEt(b);
    assert.strictEqual(g.p.surum, SURUM);
    assert.strictEqual(g.p.gold, 0);
  });
});

dene('surumsuz tam eski kayit: hicbir deger kaybolmaz', () => {
  const eski = {
    unlocked: 37, best: 0, gold: 12345, kacisHearts: { 1: 3, 2: 2, o1: 1 },
    ssAcik: 64, ssYildiz: { 1: 3, 2: 1 }, ssJoker: { geri: 4, perde: 1 }, ssoAcik: 5, ssoYildiz: { 1: 2 },
    boards: [5, 6, 7], bests: { b5: 8000, b6: 20000 }, g2048active: { s: 5, t: [[0, 0, 2]] },
    tempoBest: 4100, tempoOyun: null,
    market: { surum: 2, s: ['buz'], a: 'buz', ri: [], v: { g: '', i: [] }, h: '2026-11-13' }
  };
  const g = gocEt(kopya(eski));
  assert.strictEqual(g.degisti, true);
  assert.strictEqual(g.p.surum, SURUM);
  Object.keys(eski).forEach(k => assert.deepStrictEqual(g.p[k], eski[k], 'alan degisti: ' + k));
});

dene('cok eski kayit (yalnizca unlocked+best): eksikler tamamlanir', () => {
  const g = gocEt({ unlocked: 4, best: 512 });
  assert.strictEqual(g.p.unlocked, 4);
  assert.strictEqual(g.p.best, 512);
  assert.strictEqual(g.p.gold, 0);
  assert.deepStrictEqual(kopya(g.p.kacisHearts), {});
  assert.strictEqual(g.p.ssAcik, 1);
  assert.strictEqual(g.p.ssJoker, null);
});

dene('bozuk alanlar onarilir, gecerli olanlar kalir', () => {
  const g = gocEt({ gold: 'abc', kacisHearts: null, ssYildiz: 7, ssAcik: 9 });
  assert.strictEqual(g.p.gold, 0);
  assert.deepStrictEqual(kopya(g.p.kacisHearts), {});
  assert.deepStrictEqual(kopya(g.p.ssYildiz), {});
  assert.strictEqual(g.p.ssAcik, 9);
});

dene('NaN / Infinity altin -> 0', () => {
  assert.strictEqual(gocEt({ gold: NaN }).p.gold, 0);
  assert.strictEqual(gocEt({ gold: Infinity }).p.gold, 0);
});

dene('guncel surumdeki kayit: dokunulmaz, yeniden yazilmaz', () => {
  const k = Object.assign(varsayilan(), { gold: 99, unlocked: 8 });
  const g = gocEt(kopya(k));
  assert.strictEqual(g.degisti, false);
  assert.deepStrictEqual(kopya(g.p), kopya(k));
});

dene('daha yeni surumun kaydi (geri donus): dokunulmaz', () => {
  const k = { surum: SURUM + 5, gold: 7, yeniAlan: { a: 1 } };
  const g = gocEt(kopya(k));
  assert.strictEqual(g.degisti, false);
  assert.deepStrictEqual(kopya(g.p), k);
});

dene('goc iki kez calisinca ayni sonuc (idempotent)', () => {
  const a = gocEt({ unlocked: 3, gold: 50 }).p;
  const b = gocEt(kopya(a));
  assert.strictEqual(b.degisti, false);
  assert.deepStrictEqual(kopya(b.p), kopya(a));
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
