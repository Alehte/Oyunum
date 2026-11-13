#!/usr/bin/env node
/* ============================================================
   KONTRAST DENETİMİ  (yalnızca geliştirme aracı)

   Hedef 2048 karolarındaki sayı / zemin renk çiftlerini WCAG kontrast
   oranına göre denetler: varsayılan palet (style.css) + marketteki bütün
   temalar (js/marketKatalog.js). Eşik 4,5:1.

   Kullanım (proje kökünde):
     node tools/kontrastDenetim.js            -> rapor; eşiğin altı varsa çıkış kodu 1
     node tools/kontrastDenetim.js --duzelt   -> eşiğin altındaki YAZI renklerini
                                                 dosyalarda yerinde düzeltir

   Düzeltme yazı rengini kendi tonunu koruyarak, zeminden uzaklaştığı yöne
   (açık yazıyı beyaza, koyu yazıyı siyaha) eşiği geçene kadar kaydırır.
   Orta parlaklıktaki zeminde bu yetmezse yazı karşı tarafa (zeminin koyu ya
   da açık tonuna) alınır. Zemin rengine dokunmaz. 'duvar' karosunda sayı olmadığı için denetlenmez.
   ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var KOK = path.join(__dirname, '..');
var ESIK = 4.5, DUZELT = process.argv.indexOf('--duzelt') >= 0;

function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); }); }
function hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16).toUpperCase(); }).join(''); }
function parlaklik(c) {
  var k = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}
function oran(a, b) {
  var la = parlaklik(rgb(a)), lb = parlaklik(rgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function kaydir(zemin, bas, hedef) {
  for (var t = 0; t <= 1.0001; t += 0.02) {
    var aday = hex(bas.map(function (v, i) { return v + (hedef[i] - v) * t; }));
    if (oran(zemin, aday) >= ESIK + 0.05) return aday;
  }
  return null;
}
function duzelt(zemin, yazi) {
  var z = rgb(zemin), y = rgb(yazi), BEYAZ = [255, 255, 255], SIYAH = [0, 0, 0];
  var yon = parlaklik(y) >= parlaklik(z) ? BEYAZ : SIYAH;
  var aday = kaydir(zemin, y, yon);
  if (aday) return aday;
  // Orta parlakliktaki zeminde ayni yon esigi hic gecemez (beyaz yazi bile
  // yetmez): yazi karsi tarafa alinir. Ton, zeminin kendi renginden turetilir.
  var ters = yon === BEYAZ ? SIYAH : BEYAZ;
  var bas = z.map(function (v, i) { return v + (ters[i] - v) * 0.78; });
  return kaydir(zemin, bas, ters) || hex(ters);
}

var sorunlar = [], toplam = 0;
function denetle(kaynak, ad, zemin, yazi, yerineKoy) {
  toplam++;
  var o = oran(zemin, yazi);
  if (o >= ESIK) return;
  var yeni = duzelt(zemin, yazi);
  sorunlar.push({ kaynak: kaynak, ad: ad, zemin: zemin, yazi: yazi, oran: +o.toFixed(2), oneri: yeni });
  if (DUZELT) yerineKoy(yeni);
}

// ---- 1) varsayılan palet: style.css içindeki .tile[data-v="…"] kuralları ----
var cssYol = path.join(KOK, 'style.css'), css = fs.readFileSync(cssYol, 'utf8');
var re = /(\.tile(?:\[data-v="([^"]+)"\]|\.locked)\s*\{[^}]*?--t-bg:(#[0-9A-Fa-f]{6});\s*--t-fg:)(#[0-9A-Fa-f]{6})/g, m, cssYeni = css;
while ((m = re.exec(css))) {
  (function (m) {
    var ad = m[2] || 'kilit';
    if (ad === 'wall') return;
    denetle('varsayılan', ad, m[3], m[4], function (yeni) { cssYeni = cssYeni.replace(m[0], m[1] + yeni); });
  })(m);
}

// ---- 2) temalar: js/marketKatalog.js ----
var katYol = path.join(KOK, 'js', 'marketKatalog.js'), kat = fs.readFileSync(katYol, 'utf8'), katYeni = kat;
var kutu = {};
new Function('window', kat)(kutu);
kutu.AppMarketKatalog.TEMALAR.forEach(function (t) {
  if (!t.karo || !t.karo.palet) return;
  Object.keys(t.karo.palet).forEach(function (d) {
    if (d === 'duvar') return;
    var p = t.karo.palet[d];
    denetle(t.ad, d, p[0], p[1], function (yeni) {
      // ayni [zemin, yazi] ikilisi baska temada da gecebilir: yalnizca bu temanin blogunda degistir
      var bas = katYeni.indexOf("id: '" + t.id + "'"), son = katYeni.indexOf("\n    {\n      id:", bas + 1);
      if (son < 0) son = katYeni.length;
      var blok = katYeni.slice(bas, son);
      var eski = "['" + p[0] + "', '" + p[1] + "']";
      if (blok.indexOf(eski) < 0) throw new Error(t.id + ' ' + d + ': kaynakta bulunamadi ' + eski);
      katYeni = katYeni.slice(0, bas) + blok.replace(eski, "['" + p[0] + "', '" + yeni + "']") + katYeni.slice(son);
    });
  });
});

sorunlar.forEach(function (s) {
  console.log((DUZELT ? 'DUZELTILDI ' : 'DUSUK ') + (s.kaynak + ' / ' + s.ad).padEnd(22) + ' zemin ' + s.zemin + '  yazi ' + s.yazi +
              '  ' + s.oran + ':1  ->  ' + s.oneri + '  (' + oran(s.zemin, s.oneri).toFixed(2) + ':1)');
});
console.log('\nDenetlenen çift: ' + toplam + ' | eşiğin (' + ESIK + ':1) altında: ' + sorunlar.length +
            (sorunlar.length ? ' | en düşük ' + Math.min.apply(null, sorunlar.map(function (s) { return s.oran; })) + ':1' : ''));
if (DUZELT && sorunlar.length) {
  fs.writeFileSync(cssYol, cssYeni);
  fs.writeFileSync(katYol, katYeni);
  console.log('Dosyalar güncellendi: style.css, js/marketKatalog.js');
}
process.exit(!DUZELT && sorunlar.length ? 1 : 0);
