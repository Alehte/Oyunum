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

// ---- 1 -> 2: hediye kutulari + Kacis 100. bolum tavani ----
const surum1 = () => ({
  surum: 1, unlocked: 37, best: 2048, gold: 4321, kacisHearts: { 1: 3, 20: 2, o20: 3 },
  ssAcik: 41, ssYildiz: { 1: 3, 20: 1, 40: 2 }, ssJoker: { geri: 2 }, ssoAcik: 3, ssoYildiz: { 1: 1 },
  tempoBest: 9000, market: { surum: 2, s: ['buz'], a: 'buz' }
});

dene('surum 1 kaydi -> 2: hediye eklenir, diger alanlar aynen', () => {
  const eski = surum1();
  const g = gocEt(kopya(eski));
  assert.strictEqual(g.degisti, true);
  assert.strictEqual(g.p.surum, SURUM);
  assert.deepStrictEqual(kopya(g.p.hediye), { kacis: {}, ss: {} });
  Object.keys(eski).filter(k => k !== 'surum').forEach(k => assert.deepStrictEqual(g.p[k], eski[k], 'alan degisti: ' + k));
});

dene('surumsuz cok eski kayit -> guncel surum (hediye dahil)', () => {
  const g = gocEt({ unlocked: 4, best: 512, gold: 10 });
  assert.strictEqual(g.p.surum, SURUM);
  assert.strictEqual(g.p.unlocked, 4);
  assert.strictEqual(g.p.gold, 10);
  assert.deepStrictEqual(kopya(g.p.hediye), { kacis: {}, ss: {} });
});

dene('bozuk hediye alanlari onarilir, gecerli degerler korunur', () => {
  [null, 5, 'x', [], [1, 2]].forEach(b => {
    const k = surum1(); k.hediye = b;
    assert.deepStrictEqual(kopya(gocEt(k).p.hediye), { kacis: {}, ss: {} }, JSON.stringify(b));
  });
  const k1 = surum1(); k1.hediye = { kacis: { 20: 1 }, ss: [3] };
  assert.deepStrictEqual(kopya(gocEt(k1).p.hediye), { kacis: { 20: 1 }, ss: {} });
  const k2 = surum1(); k2.hediye = { kacis: 'bozuk', ss: { 40: 1 } };
  assert.deepStrictEqual(kopya(gocEt(k2).p.hediye), { kacis: {}, ss: { 40: 1 } });
  const k3 = surum1(); k3.hediye = { ss: null };
  assert.deepStrictEqual(kopya(gocEt(k3).p.hediye), { kacis: {}, ss: {} });
});

dene('unlocked 100 + kacisHearts[100] > 0 -> 101', () => {
  const k = surum1(); k.unlocked = 100; k.kacisHearts[100] = 1;
  assert.strictEqual(gocEt(k).p.unlocked, 101);
  const s0 = { unlocked: 100, kacisHearts: { 100: 3 } };   // surumsuz kayitta da
  assert.strictEqual(gocEt(s0).p.unlocked, 101);
});

dene('unlocked 100 ama 100 gecilmemis -> 100 kalir', () => {
  const k = surum1(); k.unlocked = 100; k.kacisHearts[99] = 3;
  assert.strictEqual(gocEt(k).p.unlocked, 100);
  const k2 = surum1(); k2.unlocked = 100; k2.kacisHearts.o100 = 3;   // ozel anahtar sayilmaz
  assert.strictEqual(gocEt(k2).p.unlocked, 100);
});

dene('unlocked 57 -> ayni kalir', () => {
  const k = surum1(); k.unlocked = 57; k.kacisHearts[100] = 3;
  assert.strictEqual(gocEt(k).p.unlocked, 57);
});

dene('surum 3 (guncel) kaydi dokunulmaz', () => {
  const k = { surum: 3, unlocked: 100, kacisHearts: { 100: 3 }, hediye: 'gelecek-bicim' };
  const g = gocEt(kopya(k));
  assert.strictEqual(g.degisti, false);
  assert.deepStrictEqual(kopya(g.p), k);
});

dene('1 -> 2 gocu idempotent (101 bir kez, hediye isaretleri korunur)', () => {
  const k = surum1(); k.unlocked = 100; k.kacisHearts[100] = 2; k.hediye = { kacis: { 20: 1 } };
  const a = gocEt(k).p;
  const b = gocEt(kopya(a));
  assert.strictEqual(b.degisti, false);
  assert.strictEqual(b.p.unlocked, 101);
  assert.deepStrictEqual(kopya(b.p), kopya(a));
  assert.deepStrictEqual(kopya(b.p.hediye), { kacis: { 20: 1 }, ss: {} });
});

dene('surum 1 kaydinda bozuk kacisHearts / ssYildiz / ssoYildiz -> {} (gecerliler korunur)', () => {
  [null, 5, 'x', [], [3, 2]].forEach(b => {
    const k = surum1(); k.kacisHearts = b; k.ssYildiz = b; k.ssoYildiz = b;
    const g = gocEt(k);
    ['kacisHearts', 'ssYildiz', 'ssoYildiz'].forEach(a => assert.deepStrictEqual(kopya(g.p[a]), {}, a + ' ' + JSON.stringify(b)));
    const b2 = gocEt(kopya(g.p));
    assert.strictEqual(b2.degisti, false);
    assert.deepStrictEqual(kopya(b2.p), kopya(g.p));
  });
  const k = surum1(); k.ssYildiz = [1];
  const g = gocEt(k).p;
  assert.deepStrictEqual(kopya(g.kacisHearts), { 1: 3, 20: 2, o20: 3 });
  assert.deepStrictEqual(kopya(g.ssoYildiz), { 1: 1 });
  assert.deepStrictEqual(kopya(g.ssYildiz), {});
});

dene('surumsuz kayitta dizi kacisHearts da onarilir', () => {
  assert.deepStrictEqual(kopya(gocEt({ kacisHearts: [1, 2] }).p.kacisHearts), {});
});

dene('varsayilan kayitta hediye bos ve surum 3', () => {
  const v = varsayilan();
  assert.strictEqual(v.surum, 3);
  assert.deepStrictEqual(kopya(v.hediye), { kacis: {}, ss: {} });
  assert.notStrictEqual(varsayilan().hediye, varsayilan().hediye);   // her cagrida yeni nesne
});

// ---- 2 -> 3: Ates Bocegi (rekor, kosu, gunluk jeton sayaci) ----
const AB_VARS = { rekor: 0, kosu: 0, gun: '', gunJeton: 0 };
const surum2 = () => ({
  surum: 2, unlocked: 57, best: 2048, gold: 4321, kacisHearts: { 1: 3, 20: 2, o20: 3 },
  ssAcik: 41, ssYildiz: { 1: 3, 20: 1 }, ssJoker: { geri: 2 }, ssoAcik: 3, ssoYildiz: { 1: 1 },
  hediye: { kacis: { 20: 1 }, ss: {} }, boards: [5, 6], bests: { b5: 8000 }, g2048active: { s: 5, t: [[0, 2]] },
  tempoBest: 9000, tempoOyun: null, market: { surum: 2, s: ['buz'], a: 'buz', h: '2026-11-13' }
});

dene('surum 2 kaydi -> 3: atesBocegi eklenir, diger alanlar aynen', () => {
  const eski = surum2();
  const g = gocEt(kopya(eski));
  assert.strictEqual(g.degisti, true);
  assert.strictEqual(g.p.surum, 3);
  assert.deepStrictEqual(kopya(g.p.atesBocegi), AB_VARS);
  Object.keys(eski).filter(k => k !== 'surum').forEach(k => assert.deepStrictEqual(g.p[k], eski[k], 'alan degisti: ' + k));
  assert.deepStrictEqual(Object.keys(g.p).sort(), Object.keys(eski).concat('atesBocegi').sort());
});

dene('surum 2 kaydinda unlocked 100 + kacisHearts[100] -> 100 kalir (1->2 adimi tekrar calismaz)', () => {
  const k = surum2(); k.unlocked = 100; k.kacisHearts[100] = 3;
  assert.strictEqual(gocEt(k).p.unlocked, 100);
});

dene('surumsuz kayit -> 3 (atesBocegi dahil)', () => {
  const g = gocEt({ unlocked: 4, gold: 10 });
  assert.strictEqual(g.p.surum, 3);
  assert.strictEqual(g.p.gold, 10);
  assert.deepStrictEqual(kopya(g.p.atesBocegi), AB_VARS);
});

dene('surum 1 kaydi -> 3 (hediye + atesBocegi)', () => {
  const g = gocEt(surum1());
  assert.strictEqual(g.p.surum, 3);
  assert.deepStrictEqual(kopya(g.p.hediye), { kacis: {}, ss: {} });
  assert.deepStrictEqual(kopya(g.p.atesBocegi), AB_VARS);
});

dene('bozuk atesBocegi (null / sayi / metin / dizi / true) -> varsayilan', () => {
  [null, 5, 'x', [], [1, 2], true].forEach(b => {
    const k = surum2(); k.atesBocegi = b;
    assert.deepStrictEqual(kopya(gocEt(k).p.atesBocegi), AB_VARS, JSON.stringify(b));
  });
  const s0 = { gold: 3, atesBocegi: 7 };   // surumsuz kayitta da
  assert.deepStrictEqual(kopya(gocEt(s0).p.atesBocegi), AB_VARS);
});

dene('bozuk alt alanlar tek tek onarilir, gecerliler korunur', () => {
  const k = surum2();
  k.atesBocegi = { rekor: 1234, kosu: -1, gun: 20261116, gunJeton: 'on' };
  assert.deepStrictEqual(kopya(gocEt(k).p.atesBocegi), { rekor: 1234, kosu: 0, gun: '', gunJeton: 0 });
  const k2 = surum2();
  k2.atesBocegi = { rekor: NaN, kosu: 12, gun: '2026-11-16', gunJeton: Infinity };
  assert.deepStrictEqual(kopya(gocEt(k2).p.atesBocegi), { rekor: 0, kosu: 12, gun: '2026-11-16', gunJeton: 0 });
  const k3 = surum2();
  k3.atesBocegi = { kosu: '5', gun: null };   // eksik + metin sayi
  assert.deepStrictEqual(kopya(gocEt(k3).p.atesBocegi), AB_VARS);
  const k4 = surum2();
  k4.atesBocegi = { rekor: 16000, kosu: 3, gun: '2026-11-15', gunJeton: 190 };
  assert.deepStrictEqual(kopya(gocEt(k4).p.atesBocegi), { rekor: 16000, kosu: 3, gun: '2026-11-15', gunJeton: 190 });
});

dene('taninmayan ek alt alan korunur', () => {
  const k = surum2(); k.atesBocegi = { rekor: 5, ek: { a: 1 } };
  assert.deepStrictEqual(kopya(gocEt(k).p.atesBocegi), { rekor: 5, ek: { a: 1 }, kosu: 0, gun: '', gunJeton: 0 });
});

dene('surum 3 kaydinda bozuk atesBocegi: dokunulmaz (goc yalniz eski surumde calisir)', () => {
  const k = Object.assign(varsayilan(), { atesBocegi: null });
  const g = gocEt(kopya(k));
  assert.strictEqual(g.degisti, false);
  assert.strictEqual(g.p.atesBocegi, null);
});

dene('surum 4 kaydi dokunulmaz', () => {
  const k = { surum: 4, gold: 7, atesBocegi: 'gelecek-bicim', hediye: null };
  const g = gocEt(kopya(k));
  assert.strictEqual(g.degisti, false);
  assert.deepStrictEqual(kopya(g.p), k);
});

dene('2 -> 3 gocu idempotent (bozuk ve gecerli girdilerde)', () => {
  [undefined, null, 5, [], { rekor: -3, gun: 1 }, { rekor: 900, kosu: 4, gun: '2026-11-16', gunJeton: 40 }].forEach(b => {
    const k = surum2(); if (b !== undefined) k.atesBocegi = b;
    const a = gocEt(k).p;
    const c = gocEt(kopya(a));
    assert.strictEqual(c.degisti, false, JSON.stringify(b));
    assert.deepStrictEqual(kopya(c.p), kopya(a), JSON.stringify(b));
  });
});

dene('sifirlama sonrasi varsayilan: atesBocegi sifir, her cagrida yeni nesne', () => {
  const v = varsayilan();
  assert.deepStrictEqual(kopya(v.atesBocegi), AB_VARS);
  assert.notStrictEqual(varsayilan().atesBocegi, varsayilan().atesBocegi);
  const g = gocEt(null);                    // AppReset: Store.del + varsayilan; yeniden acilis gocEt(null)
  assert.deepStrictEqual(kopya(g.p.atesBocegi), AB_VARS);
  v.atesBocegi.rekor = 99;                  // bir nesneyi degistirmek digerini etkilemez
  assert.strictEqual(varsayilan().atesBocegi.rekor, 0);
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
