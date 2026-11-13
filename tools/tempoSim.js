#!/usr/bin/env node
/* ============================================================
   TEMPO KÜP — BAŞSIZ SİMÜLASYON  (yalnızca geliştirme aracı)

   Oyunun gerçek çekirdeğini (js/tempoCekirdek.js) bir botla oynatır ve
   parça üretecinin hedeflerini sayılarla ölçer.

   Kullanım (proje kökünde):
       node tools/tempoSim.js                 -> 100 oyun
       node tools/tempoSim.js --oyun 1000     -> 1000 oyun
       node tools/tempoSim.js --oyun 200 --tohum 7 --isci 4 --maxHamle 3000

   Bot: tepsinin üç parçasını birlikte düşünen açgözlü ışın araması
   (çekirdekteki planla). Tam temizlik fırsatını (parçalar boşlukları
   tam dolduruyorsa) görür ve oynar; onun dışında ileriyi görmez.

   Ölçülenler:
     - en az bir tam temizlik görülen oyun oranı
     - oyun başına ve UZUN oyun başına ortalama tam temizlik
     - oynanabilirlik garantisi ihlali (üretilen 3'lü hiçbir sırayla
       yerleşemiyor AMA üç tane 1x1 yerleşebiliyordu) -> 0 olmalı
     - hata / sonsuz döngü (hamle tavanına takılan oyun sayısı ayrıca yazılır)
   ============================================================ */
'use strict';
var path = require('path');
var cp = require('child_process');
var C = require(path.join(__dirname, '..', 'js', 'tempoCekirdek.js'));

function arg(ad, vars) {
  var i = process.argv.indexOf('--' + ad);
  return i >= 0 ? Number(process.argv[i + 1]) : vars;
}
// deney: --ayar '{"sabitZorluk":1}' ile çekirdek ayarlarını geçici olarak ez
(function () {
  var i = process.argv.indexOf('--ayar');
  if (i < 0) return;
  var ez = JSON.parse(process.argv[i + 1]), k;
  for (k in ez) C.AYAR[k] = ez[k];
})();
var OYUN = arg('oyun', 100), TOHUM = arg('tohum', 1), ISCI = arg('isci', 4);
var MAX_HAMLE = arg('maxHamle', 3000), UZUN = arg('uzun', 150), GENISLIK = arg('genislik', 4);
// --bot acgozlu (varsayılan) | guclu | dikkatsiz
var BOT = (function () { var i = process.argv.indexOf('--bot'); return i >= 0 ? process.argv[i + 1] : 'acgozlu'; })();
var GURULTU = arg('gurultu', 45);

/* AÇGÖZLÜ BOT: ileriyi planlamaz. Elindeki parçalardan, o an en iyi
   görünen (parça, konum) ikilisini oynar. Tek ayrıcalığı: tepsideki
   parçalar boşlukları tam dolduruyorsa tam temizliği görür (insan da görür).
   DİKKATSİZ BOT: aynısı, ama değerlendirmesine gürültü eklenir ve çok
   parçalı tam temizliği göremez — acemi oyuncu. */
function acgozluHamle(o, rng, gurultu, finaleGor) {
  var kalan = o.kalanlar(), i, s, r, c, sonuc, v, en = null, enV = -Infinity;
  if (finaleGor) {
    var fin = C.finaleCoz(o.b, kalan.map(function (k) { return o.tepsi[k].s; }));
    if (fin) return { i: kalan[fin[0].aday], r: fin[0].r, c: fin[0].c };
  }
  for (i = 0; i < kalan.length; i++) {
    s = C.SEKILLER[o.tepsi[kalan[i]].s];
    for (r = 0; r + s.h <= C.N; r++) for (c = 0; c + s.w <= C.N; c++) {
      if (!C.sigar(o.b, s, r, c)) continue;
      sonuc = C.uygula(o.b, s, r, c);
      v = C.tahtaPuani(sonuc.b) + sonuc.hat * sonuc.hat * 46 + sonuc.hat * 20 + (sonuc.tam ? 900 : 0);
      if (gurultu) v += (rng() - 0.5) * 2 * gurultu;
      if (v > enV) { enV = v; en = { i: kalan[i], r: r, c: c }; }
    }
  }
  return en;
}

function birOyun(tohum) {
  var o = new C.Oyun(C.rngOlustur(tohum)).basla();
  var ihlal = 0, doluTop = 0, tepsiSay = 0, finaleSunum = 0;

  function tepsiDenetle() {
    var idler = o.tepsi.map(function (p) { return p.s; });
    tepsiSay++;
    if (o.uretec.sonFinale) finaleSunum++;
    if (!C.oynanabilir(o.b, idler) && C.oynanabilir(o.b, [C.TEK, C.TEK, C.TEK])) ihlal++;
  }
  tepsiDenetle();

  var botRng = C.rngOlustur(tohum * 7919 + 13), ilkTam = 0;
  while (!o.bitti && o.hamle < MAX_HAMLE) {
    var plan = BOT === 'guclu' ? o.oneri(GENISLIK)
             : [acgozluHamle(o, botRng, BOT === 'dikkatsiz' ? GURULTU : 0, BOT !== 'dikkatsiz')];
    if (!plan.length || !plan[0]) break;
    for (var k = 0; k < plan.length && !o.bitti; k++) {
      var e = o.oyna(plan[k].i, plan[k].r, plan[k].c);
      if (!e) throw new Error('bot gecersiz hamle onerdi, tohum ' + tohum);
      doluTop += C.doluSay(o.b);
      if (e.tam && !ilkTam) ilkTam = o.hamle;
      if (e.yeniTepsi) { tepsiDenetle(); break; }
    }
  }
  return { tohum: tohum, hamle: o.hamle, skor: o.skor, tam: o.tamSayisi, hat: o.hatSayisi,
           tavan: !o.bitti, ihlal: ihlal, dolu: doluTop / Math.max(1, o.hamle) / 64,
           tepsi: tepsiSay, finale: finaleSunum, ilkTam: ilkTam };
}

// ---- işçi kipi ----
if (process.argv[2] === '--isciKipi') {
  var bas = Number(process.argv[3]), son = Number(process.argv[4]), out = [];
  for (var t = bas; t < son; t++) {
    try { out.push(birOyun(t)); }
    catch (err) { out.push({ tohum: t, hata: String(err && err.stack || err) }); }
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

// ---- ana süreç ----
function yuzdelik(dizi, p) {
  var s = dizi.slice().sort(function (a, b) { return a - b; });
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
function ort(dizi) { return dizi.length ? dizi.reduce(function (a, b) { return a + b; }, 0) / dizi.length : 0; }

var basladi = Date.now(), parca = Math.ceil(OYUN / ISCI), biten = 0, hepsi = [];
for (var w = 0; w < ISCI; w++) {
  (function (bas, son) {
    if (bas >= son) { biten++; return; }
    cp.execFile(process.execPath, [__filename, '--isciKipi', String(bas), String(son),
      '--maxHamle', String(MAX_HAMLE), '--genislik', String(GENISLIK), '--bot', BOT, '--gurultu', String(GURULTU)].concat(
        process.argv.indexOf('--ayar') >= 0 ? ['--ayar', process.argv[process.argv.indexOf('--ayar') + 1]] : []),
      { maxBuffer: 1 << 28 }, function (err, stdout) {
        if (err) { console.error('isci hatasi:', err.message); process.exit(1); }
        hepsi = hepsi.concat(JSON.parse(stdout));
        if (++biten === ISCI) rapor();
      });
  })(TOHUM + w * parca, Math.min(TOHUM + OYUN, TOHUM + (w + 1) * parca));
}

function rapor() {
  var hatalar = hepsi.filter(function (r) { return r.hata; });
  var r = hepsi.filter(function (x) { return !x.hata; });
  var uzun = r.filter(function (x) { return x.hamle >= UZUN; });
  var hamle = r.map(function (x) { return x.hamle; });
  var sonuc = {
    bot: BOT, oyun: r.length,
    hata: hatalar.length,
    garantiIhlali: r.reduce(function (a, x) { return a + x.ihlal; }, 0),
    tavanaTakilan: r.filter(function (x) { return x.tavan; }).length,
    enAzBirTamTemizlikYuzde: +(100 * r.filter(function (x) { return x.tam > 0; }).length / r.length).toFixed(1),
    ortTamTemizlik: +ort(r.map(function (x) { return x.tam; })).toFixed(2),
    uzunOyun: { esikHamle: UZUN, adet: uzun.length,
                ortTamTemizlik: +ort(uzun.map(function (x) { return x.tam; })).toFixed(2),
                ortHamle: Math.round(ort(uzun.map(function (x) { return x.hamle; }))) },
    hamle: { ort: Math.round(ort(hamle)), p10: yuzdelik(hamle, .1), p50: yuzdelik(hamle, .5), p90: yuzdelik(hamle, .9) },
    ilkTamTemizlikHamlesiP50: yuzdelik(r.filter(function (x) { return x.ilkTam; }).map(function (x) { return x.ilkTam; }).concat([0]), .5),
    ortSkor: Math.round(ort(r.map(function (x) { return x.skor; }))),
    hamleBasinaHat: +(ort(r.map(function (x) { return x.hat / Math.max(1, x.hamle); }))).toFixed(3),
    ortDoluluk: +ort(r.map(function (x) { return x.dolu; })).toFixed(3),
    yuzHamledeTam: +(100 * r.reduce(function (a, x) { return a + x.tam; }, 0) /
                     Math.max(1, r.reduce(function (a, x) { return a + x.hamle; }, 0))).toFixed(2),
    finaleSunumOrani: +(r.reduce(function (a, x) { return a + x.finale; }, 0) /
                        Math.max(1, r.reduce(function (a, x) { return a + x.tepsi; }, 0))).toFixed(3),
    sureSn: +((Date.now() - basladi) / 1000).toFixed(1)
  };
  console.log(JSON.stringify(sonuc, null, 1));
  if (hatalar.length) console.log('ILK HATA:\n' + hatalar[0].hata);
}
