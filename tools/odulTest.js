// odulTest.js — Tempo esik odulu ve Sirala Dur yildiz farki kurallarini dener.
// Calistirma:  node tools/odulTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const oku = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// ---- Tempo: esikOdulu + AYAR esik alanlari tempoKup.js'ten kesilir ----
const tk = oku('tempoKup.js');
const blok = tk.slice(tk.indexOf('// ESIK-BASI'), tk.indexOf('// ESIK-SONU'));
const ayarMetni = ['esikTaban', 'esikOdul', 'esikArtis']
  .map(k => { const m = new RegExp('\\b' + k + ':\\s*([^\\n]*?),\\s*(//.*)?\\n').exec(tk); return k + ':' + m[1]; }).join(',');
const ctx = {};
vm.runInNewContext(blok + '\nthis.f = esikOdulu; this.AYAR = {' + ayarMetni + '};', ctx);
const esik = (eski, skor) => ctx.f(eski, skor, ctx.AYAR).jeton;

console.log('Tempo esik odulu');
dene('onaylanan tablo (8 oyun = 900)', () => {
  const oyunlar = [8000, 25000, 22000, 47000, 90000, 85000, 170000, 400000];
  const bekle = [25, 125, 0, 100, 150, 0, 200, 300];
  let rekor = 0, toplam = 0;
  oyunlar.forEach((s, i) => {
    const j = esik(rekor, s);
    assert.strictEqual(j, bekle[i], 'oyun ' + (i + 1) + ' skor ' + s);
    toplam += j; rekor = Math.max(rekor, s);
  });
  assert.strictEqual(toplam, 900);
});
dene('640k\'ya kadar toplam 1300', () => assert.strictEqual(esik(0, 640000), 1300));
dene('esigin tam ustu sayilir, alti sayilmaz', () => {
  assert.strictEqual(esik(0, 4999), 0);
  assert.strictEqual(esik(0, 5000), 25);
  assert.strictEqual(esik(5000, 9999), 0);
});
dene('rekoru 1 puanla kirmak esik gecmiyorsa 0', () => assert.strictEqual(esik(30000, 30001), 0));
dene('listenin sonrasi +100: 1,28M=500, 2,56M=600, 5,12M=700', () => {
  assert.strictEqual(esik(640000, 1280000), 500);
  assert.strictEqual(esik(1280000, 2560000), 600);
  assert.strictEqual(esik(2560000, 5120000), 700);
});
dene('rekorun altindaki esikler geriye donuk odenmez', () => assert.strictEqual(esik(240000, 250000), 0));
dene('adet dogru', () => assert.strictEqual(ctx.f(0, 25000, ctx.AYAR).adet, 3));

// ---- Sirala Dur: YILDIZ_ODUL tablosu ve fark kurali ----
console.log('Sirala Dur yildiz farki');
[['suSiralaOyun.js', [0, 10, 20, 30]], ['suSiralaOzelOyun.js', [0, 15, 30, 45]]].forEach(([dosya, beklenen]) => {
  const s = oku(dosya);
  const m = /var YILDIZ_ODUL = (\[[^\]]*\]);/.exec(s);
  dene(dosya + ': tablo ' + JSON.stringify(beklenen), () => assert.deepStrictEqual(JSON.parse(m[1]), beklenen));
  dene(dosya + ': fark formulu kodda', () => assert.ok(/var odul = YILDIZ_ODUL\[yildiz\] - YILDIZ_ODUL\[oncekiYildiz\];/.test(s)));
  const T = beklenen;
  const fark = (once, simdi) => Math.max(0, T[simdi] - T[once]);
  dene(dosya + ': ornekler', () => {
    assert.strictEqual(fark(0, 3), T[3]);
    assert.strictEqual(fark(0, 1) + fark(1, 3), T[3]);
    assert.strictEqual(fark(0, 2) + fark(2, 3), T[3]);
    assert.strictEqual(fark(3, 3), 0);
    assert.strictEqual(fark(3, 1), 0);
  });
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
