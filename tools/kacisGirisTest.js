// kacisGirisTest.js — Kacis bolum girisinde intro/ipucu yalnizca ilk giriste gosterilir,
// "Baştan başla" / "Tekrar Dene" ile yeniden baslatmada gosterilmez.
// Calistirma:  node tools/kacisGirisTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const kaynak = fs.readFileSync(path.join(__dirname, '..', 'js', 'kacis.js'), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

const bas = kaynak.indexOf('// GIRIS-BASI'), son = kaynak.indexOf('// GIRIS-SONU');
console.log('Kacis giris yazilari');
dene('GIRIS-BASI / GIRIS-SONU isaretleri var', () => assert.ok(bas >= 0 && son > bas));
if (bas >= 0 && son > bas) {
  const ctx = {};
  vm.runInNewContext(kaynak.slice(bas, son) + '\nthis.f = girisGosterilsinMi;', ctx);
  const g = (mod, bolum, yeniden) => JSON.parse(JSON.stringify(ctx.f(mod, bolum, yeniden)));

  dene('haritadan 1. bolum -> intro var', () => assert.strictEqual(g('normal', 1, false).intro, true));
  dene('yeniden baslatma 1. bolum -> intro yok', () => assert.strictEqual(g('normal', 1, true).intro, false));
  dene('haritadan 10. bolum -> ipucu var', () => assert.ok(g('normal', 10, false).ipucu));
  dene('yeniden baslatma 10. bolum -> ipucu yok', () => assert.ok(!g('normal', 10, true).ipucu));
  dene('ipucsuz bolum (5) hicbir yazi yok', () => {
    assert.deepStrictEqual(g('normal', 5, false), { intro: false, ipucu: null });
  });
  dene('ozel mod haritadan -> ipucu var, intro yok', () => {
    const r = g('ozel', 1, false);
    assert.strictEqual(r.intro, false);
    assert.ok(r.ipucu);
  });
  dene('ozel mod yeniden baslatma -> ipucu yok, intro yok', () => {
    assert.deepStrictEqual(g('ozel', 1, true), { intro: false, ipucu: null });
  });
  dene('art arda iki yeniden baslatma -> yok', () => {
    assert.strictEqual(g('normal', 1, true).intro, false);
    assert.strictEqual(g('normal', 1, true).intro, false);
  });
  dene('yeniden baslatmadan sonra haritadan tekrar giris -> var', () => {
    g('normal', 1, true);
    assert.strictEqual(g('normal', 1, false).intro, true);
  });
}

// ---- Kaynak denetimi: hangi loadLevel cagrilari bayrak geciyor ----
console.log('Kaynak denetimi');
const retry = /getElementById\('kcRetryBtn'\)\.addEventListener\('click',[\s\S]*?\n    \}\);/.exec(kaynak);
const bastan = /getElementById\('kcBastanBtn'\)\.addEventListener\('click',[\s\S]*?\n    \}\);/.exec(kaynak);
dene('kcRetryBtn isleyicisi loadLevel(..., true)', () => assert.ok(retry && /loadLevel\([^)]*,\s*true\)/.test(retry[0])));
dene('kcBastanBtn isleyicisi loadLevel(..., true)', () => assert.ok(bastan && /loadLevel\([^)]*,\s*true\)/.test(bastan[0])));
dene('diger loadLevel cagrilari bayrak gecmiyor', () => {
  let temiz = kaynak.replace(retry ? retry[0] : '', '').replace(bastan ? bastan[0] : '', '');
  temiz = temiz.replace(/function loadLevel\([^)]*\)/, '');
  const cagrilar = temiz.match(/\bloadLevel\([^)]*\)/g) || [];
  assert.ok(cagrilar.length >= 4, 'beklenen cagri sayisi: ' + cagrilar.length);
  cagrilar.forEach(c => assert.ok(!/,/.test(c), 'bayrakli cagri: ' + c));
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
