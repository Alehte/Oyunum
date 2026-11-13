#!/usr/bin/env node
/* ============================================================
   KAÇIŞ? BÖLÜM PAKETLEYİCİ  (yalnızca geliştirme aracı)

   js/bolumler.js oyunda KOMPAKT biçimde durur (~40 KB). Bölümleri elle
   düzenlemek için açık (okunur) JSON'a çevirip geri paketleyebilirsin.

   Kullanım (proje kökünde):
     node tools/bolumPaketle.js ac  [cikti.json]     kompakt -> açık JSON
     node tools/bolumPaketle.js paketle girdi.json   açık JSON -> js/bolumler.js
     node tools/bolumPaketle.js dogrula eski.js      iki dosyanın ürettiği
                                                     BOLUMLER birebir aynı mı?

   KOMPAKT BİÇİM — her bölüm tek bir metin:
     1. karakter: sütun sayısı, 2. karakter: satır sayısı (36'lık taban)
     ardından boşlukla ayrılmış yılanlar; her yılan bir kelime:
       1. karakter kuyruk satırı, 2. karakter kuyruk sütunu (36'lık taban)
       sonraki harfler gövdenin kuyruktan kafaya yürüyüşü (U/D/L/R)
     İLK kelime kahramandır (id 'green', isHero:true); diğerleri sırayla
     's0','s1',... olur. Renk, yılanın sırasına göre PALET'ten gelir.

   Paketleyici bu varsayımları (kahraman ilk sırada, id düzeni, komşu
   hücreler, renk = sıra) doğrular; uymayan veri görürse yazmadan durur.
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var HEDEF = path.join(__dirname, '..', 'js', 'bolumler.js');

function yukle(dosya) {
  var kutu = { window: {} };
  new Function('window', fs.readFileSync(dosya, 'utf8'))(kutu.window);
  if (!(kutu.window.BOLUMLER instanceof Array)) throw new Error(dosya + ': window.BOLUMLER yok');
  return kutu.window.BOLUMLER;
}

function k36(n) {
  if (!(n >= 0 && n < 36) || n !== Math.floor(n)) throw new Error('36\'lik tabana sigmayan deger: ' + n);
  return n.toString(36);
}

function paketle(bolumler, notlar) {
  var palet = [];
  var satirlar = bolumler.map(function (b, bi) {
    var anahtarlar = Object.keys(b).sort().join(',');
    if (anahtarlar !== 'cols,rows,snakes') throw new Error('Bolum ' + (bi + 1) + ': beklenmeyen alanlar ' + anahtarlar);
    var s36 = k36(b.cols) + k36(b.rows), sayac = 0;
    var kelimeler = b.snakes.map(function (y, yi) {
      var hero = yi === 0;
      var beklenenId = hero ? 'green' : 's' + (sayac++);
      if (y.id !== beklenenId) throw new Error('Bolum ' + (bi + 1) + ': id ' + y.id + ', beklenen ' + beklenenId);
      if (hero ? y.isHero !== true : ('isHero' in y)) throw new Error('Bolum ' + (bi + 1) + ': kahraman ilk sirada olmali');
      var alanlar = Object.keys(y).sort().join(',');
      if (alanlar !== (hero ? 'cells,color,id,isHero' : 'cells,color,id')) throw new Error('Bolum ' + (bi + 1) + ' ' + y.id + ': beklenmeyen alanlar ' + alanlar);
      if (palet[yi] === undefined) palet[yi] = y.color;
      else if (palet[yi] !== y.color) throw new Error('Bolum ' + (bi + 1) + ' ' + y.id + ': renk siraya bagli degil');
      var w = k36(y.cells[0][0]) + k36(y.cells[0][1]);
      for (var i = 1; i < y.cells.length; i++) {
        var dr = y.cells[i][0] - y.cells[i - 1][0], dc = y.cells[i][1] - y.cells[i - 1][1];
        if (dr === -1 && dc === 0) w += 'U';
        else if (dr === 1 && dc === 0) w += 'D';
        else if (dr === 0 && dc === -1) w += 'L';
        else if (dr === 0 && dc === 1) w += 'R';
        else throw new Error('Bolum ' + (bi + 1) + ' ' + y.id + ': komsu olmayan hucre');
        k36(y.cells[i][0]); k36(y.cells[i][1]);
      }
      return w;
    });
    return '    ' + (notlar && notlar[bi] ? '// ' + notlar[bi] + '\n    ' : '') + "'" + s36 + ' ' + kelimeler.join(' ') + "'";
  });

  return (
    '// bolumler.js — Kaçış? normal bölümleri (' + bolumler.length + ' adet), KOMPAKT kodlama.\n' +
    '// Elle düzenleme: node tools/bolumPaketle.js ac  -> açık JSON; düzenle; paketle.\n' +
    '// Biçim: [sütun][satır] yılan yılan ...   (36\'lık taban)\n' +
    '//   yılan = [kuyruk satırı][kuyruk sütunu] + kuyruktan kafaya yürüyüş (U/D/L/R)\n' +
    '//   ilk yılan kahramandır (yeşil); renk yılanın sırasına göre PALET\'ten gelir.\n' +
    '(function(){\n' +
    "  var PALET = '" + palet.map(function (r) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(r)) throw new Error('Beklenmeyen renk: ' + r);
      return r.slice(1);
    }).join('') + "'.match(/.{6}/g).map(function(r){ return '#' + r; });\n" +
    '  var MOV = { U:[-1,0], D:[1,0], L:[0,-1], R:[0,1] };\n' +
    '  function coz(t){\n' +
    "    var p = t.split(' '), snakes = [];\n" +
    '    for(var i = 1; i < p.length; i++){\n' +
    '      var w = p[i], r = parseInt(w[0], 36), c = parseInt(w[1], 36), cells = [[r, c]];\n' +
    '      for(var k = 2; k < w.length; k++){ r += MOV[w[k]][0]; c += MOV[w[k]][1]; cells.push([r, c]); }\n' +
    "      var y = { id: i === 1 ? 'green' : 's' + (i - 2), color: PALET[i - 1], cells: cells };\n" +
    '      if(i === 1) y.isHero = true;\n' +
    '      snakes.push(y);\n' +
    '    }\n' +
    '    return { cols: parseInt(p[0][0], 36), rows: parseInt(p[0][1], 36), snakes: snakes };\n' +
    '  }\n' +
    '  window.BOLUMLER = [\n' + satirlar.join(',\n') + '\n  ].map(coz);\n' +
    '})();\n'
  );
}

// eski açık dosyadaki "// ---- BOLUM n — M:.. D:.. tuzak:.. | tahta AxB ----" notlarını taşı
function notlariOku(dosya) {
  var m, re = /\/\/ ---- BOLUM (\d+) — (.*?) ----/g, out = [], metin = fs.readFileSync(dosya, 'utf8');
  while ((m = re.exec(metin))) out[Number(m[1]) - 1] = m[1] + ' — ' + m[2];
  return out;
}
function kompaktNotlar(dosya) {
  var out = [], satirlar = fs.readFileSync(dosya, 'utf8').split('\n'), i, m;
  for (i = 0; i < satirlar.length; i++) {
    m = /^\s*\/\/ (\d+) — (.*)$/.exec(satirlar[i]);
    if (m) out[Number(m[1]) - 1] = m[1] + ' — ' + m[2];
  }
  return out;
}

var kip = process.argv[2];
if (kip === 'ac') {
  var acik = JSON.stringify({ notlar: kompaktNotlar(HEDEF), bolumler: yukle(HEDEF) });
  if (process.argv[3]) { fs.writeFileSync(process.argv[3], acik); console.error('Yazildi: ' + process.argv[3]); }
  else process.stdout.write(acik);
} else if (kip === 'paketle') {
  var girdi = process.argv[3];
  if (!girdi) { console.error('Kullanim: node tools/bolumPaketle.js paketle girdi.json|eski.js'); process.exit(1); }
  var bolumler, notlar;
  if (/\.json$/.test(girdi)) { var j = JSON.parse(fs.readFileSync(girdi, 'utf8')); bolumler = j.bolumler || j; notlar = j.notlar; }
  else { bolumler = yukle(girdi); notlar = notlariOku(girdi); }
  var cikti = paketle(bolumler, notlar);
  var gecici = HEDEF + '.yeni';
  fs.writeFileSync(gecici, cikti);
  assert.deepStrictEqual(yukle(gecici), bolumler);     // yazmadan once: cozulen veri girdiyle birebir ayni mi?
  fs.renameSync(gecici, HEDEF);
  console.log('Yazildi: js/bolumler.js  (' + bolumler.length + ' bolum, ' + cikti.length + ' bayt) — dogrulandi');
} else if (kip === 'dogrula') {
  var eski = yukle(process.argv[3]), yeni = yukle(HEDEF);
  assert.deepStrictEqual(yeni, eski);
  console.log('AYNI: ' + yeni.length + ' bolum, ' +
    yeni.reduce(function (a, b) { return a + b.snakes.length; }, 0) + ' yilan, ' +
    yeni.reduce(function (a, b) { return a + b.snakes.reduce(function (x, y) { return x + y.cells.length; }, 0); }, 0) +
    ' hucre birebir esit (deepStrictEqual).');
} else {
  console.error('Kullanim: node tools/bolumPaketle.js ac|paketle|dogrula ...');
  process.exit(1);
}
