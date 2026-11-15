#!/usr/bin/env node
/* ============================================================
   KAÇIŞ? BÖLÜM ÜRETİCİ 101-250  (yalnızca geliştirme aracı)

   Kullanım (proje kökünde):
     node tools/kacisUret.js            js/bolumler.js'in 101-250 kısmını üretir
     node tools/kacisUret.js --kontrol  yazmaz; dosya üreticinin çıktısıyla aynı mı?

   1-100 METİN OLARAK olduğu gibi kopyalanır (üretici onlara dokunmaz); yazmadan
   önce ilk 100 bölümün çözülmüş hali eskiyle deepStrictEqual karşılaştırılır.
   Sabit tohumlu (mulberry32) — her çalıştırma aynı dosyayı üretir.

   ÖLÇÜLER (tools/kacisCozTest.js, 1-100 notlarıyla birebir doğrulandı):
     M = kahramandan önce mutlaka çıkarılması gereken yılan sayısı
     D = bu bağımlılık ağacında en uzun zincir, tuzak = gerekmeyen yılanlar

   1-100'DEN ÇIKARILAN TEMEL (81-100 ortalaması):
     tahta 26x31 -> 27x32, doluluk ~0.38-0.41, yılan boyu 2-5 (2:%18 3:%25
     4:%27 5:%29), kahraman 3-5 hücre, kahramanın önündeki yol 9-16 hücre,
     D 18. bölümden beri 8'de plato, M ve tuzak 95-100'de 44/46 plato,
     tuzakların çoğu başta kapalı (dokununca kalp gider).

   TEMEL EĞRİ (t = (n-100)/150):
     tahta 27x32 -> 30x35 (mobil sınır), M 44 -> 60, D 8 -> 12, tuzak 46 -> 56.
     Zorluk tahtadan çok zincir derinliği + gereken hamle ile artar.

   ÇEŞİTLİLİK (her 5 bölümde bir, n % 5 === 3; sıra siki, uzun, zincir, nefes):
     siki   küçük ama yoğun tahta (temel - 6x7), doluluk ~0.50
     uzun   aynı tahta, 5-8 hücrelik uzun yılanlar, daha az yılan
     zincir D = temel + 3 (en derin bağımlılık zinciri), M temel
     nefes  nefes aldıran kolay bölüm: M ~yarı, D temel - 3, tahta - 3x3
   Yeni kural/mekanik YOK; kacis.js oyun mantığı aynen geçerli.

   YAPIM (çözülebilirlik yapı gereği):
     Yılanlar sırayla konur. "Gereken" yılan Y, gereken bir X'in yoluna en az
     bir hücreyle oturur ve KENDİ yolu o ana kadar konan her şeyden boştur.
     Böylece bağımlılık okları hep önce konandan sonra konana gider (döngü
     yok); ters sırayla çıkarmak kalp kaybetmeden kahramanı kurtarır.
     Tuzak yılanlar gereken hiçbir yılanın yoluna hücre koymaz (yoksa gereken
     olurdu); kendi yolları serbest, çoğu bilerek kapalı seçilir.
     Sonuç kacisCozTest.js'teki cözücüyle (kacis.js simulateExit) ölçülür;
     hedef ölçü tutmazsa aynı bölüm sıradaki alt tohumla yeniden kurulur.
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var coz = require('./kacisCozTest.js');

var HEDEF = path.join(__dirname, '..', 'js', 'bolumler.js');
var ILK = 100, SON = 250;
var TURLER = ['siki', 'uzun', 'zincir', 'nefes'];
var BOY_TEMEL = [[2, 18], [3, 25], [4, 27], [5, 30]];
var BOY_SIKI = [[2, 26], [3, 30], [4, 26], [5, 18]];
var BOY_UZUN = [[5, 25], [6, 30], [7, 25], [8, 20]];
var YON = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- hedef ölçüler ----
function temelHedef(n) {
  var t = (n - ILK) / (SON - ILK);
  return { cols: 27 + Math.round(3 * t), rows: 32 + Math.round(3 * t),
           M: 44 + Math.round(16 * t), D: 8 + Math.round(4 * t), tuzak: 46 + Math.round(10 * t),
           boy: BOY_TEMEL, doluluk: null, tur: null };
}
function hedef(n) {
  var h = temelHedef(n);
  if ((n - ILK) % 5 !== 3) return h;
  var tur = TURLER[((n - ILK - 3) / 5) % 4], N;
  h.tur = tur;
  if (tur === 'siki') {
    h.cols -= 6; h.rows -= 7; h.boy = BOY_SIKI;
    N = Math.round(h.cols * h.rows * 0.50 / 3.35);
    h.M = Math.round(N * 0.55); h.tuzak = N - h.M - 1;
  } else if (tur === 'uzun') {
    h.boy = BOY_UZUN;
    N = Math.round(h.cols * h.rows * 0.40 / 6.4);
    h.M = Math.round(N * 0.5); h.tuzak = N - h.M - 1;
  } else if (tur === 'zincir') {
    h.D += 3; h.tuzak -= 6;
  } else {                                   // nefes
    h.cols -= 3; h.rows -= 3;
    h.M = Math.round(h.M * 0.5); h.D -= 3; h.tuzak = Math.round(h.tuzak * 0.6);
  }
  return h;
}

function agirlikliSec(rnd, tablo) {
  var top = 0, i; for (i = 0; i < tablo.length; i++) top += tablo[i][1];
  var x = rnd() * top;
  for (i = 0; i < tablo.length; i++) { x -= tablo[i][1]; if (x < 0) return tablo[i][0]; }
  return tablo[tablo.length - 1][0];
}

// ---- tek bölüm kurma denemesi ----
function kur(h, rnd) {
  var R = h.rows, C = h.cols, A = R * C;
  var dolu = new Int16Array(A).fill(-1);       // hücre -> yılan sırası
  var maske = new Int16Array(A).fill(-1);      // gereken yolların üstünde: en derin yolun derinliği
  var yilanlar = [], gerekenler = [];           // gerekenler: {i, yol:[hucre], d}
  function ic(r, c) { return r >= 0 && r < R && c >= 0 && c < C; }
  function yol(bas, yon) {                     // kafanın önünden tahta kenarına
    var out = [], r = bas[0] + yon[0], c = bas[1] + yon[1];
    while (ic(r, c)) { out.push(r * C + c); r += yon[0]; c += yon[1]; }
    return out;
  }
  // anchor'dan başlayan rastgele, kendini kesmeyen yürüyüş (L hücre)
  function yuru(bas, L, tuzakMi) {
    var hs = [bas], kume = {}; kume[bas[0] * C + bas[1]] = 1;
    for (var k = 1; k < L; k++) {
      var son = hs[hs.length - 1], aday = [];
      for (var y = 0; y < 4; y++) {
        var r = son[0] + YON[y][0], c = son[1] + YON[y][1], a = r * C + c;
        if (!ic(r, c) || dolu[a] >= 0 || kume[a] || (tuzakMi && maske[a] >= 0)) continue;
        aday.push([r, c]);
      }
      if (!aday.length) return null;
      var s = aday[Math.floor(rnd() * aday.length)];
      hs.push(s); kume[s[0] * C + s[1]] = 1;
    }
    return hs;
  }
  // hücreler (kuyruk->kafa) için yön ve yol; kendi gövdesi yolda ise null
  function yonYol(hs) {
    var a = hs[hs.length - 2], b = hs[hs.length - 1], yon = [b[0] - a[0], b[1] - a[1]];
    var y = yol(b, yon), kendi = {};
    hs.forEach(function (x) { kendi[x[0] * C + x[1]] = 1; });
    for (var i = 0; i < y.length; i++) if (kendi[y[i]]) return null;
    return y;
  }
  function koy(hs, gerekD, y) {
    var i = yilanlar.length;
    yilanlar.push(hs);
    hs.forEach(function (x) { dolu[x[0] * C + x[1]] = i; });
    if (gerekD !== null) {
      gerekenler.push({ i: i, yol: y, d: gerekD });
      y.forEach(function (a) { if (maske[a] < gerekD) maske[a] = gerekD; });
    }
  }
  function yolBos(y) { for (var i = 0; i < y.length; i++) if (dolu[y[i]] >= 0) return false; return true; }

  // kahraman: 3-5 hücre, önünde 9-16 hücrelik yol (küçük tahtada 6+)
  var enAzYol = Math.min(9, Math.floor(Math.min(R, C) / 2)), deneme;
  for (deneme = 0; deneme < 400; deneme++) {
    var hb = [Math.floor(rnd() * R), Math.floor(rnd() * C)];
    var hs0 = yuru(hb, 3 + Math.floor(rnd() * 3), false);
    if (!hs0) continue;
    hs0.reverse();                              // hb kafa
    var y0 = yonYol(hs0);
    if (!y0 || y0.length < enAzYol || y0.length > 16) continue;
    koy(hs0, 0, y0); break;
  }
  if (!yilanlar.length) return null;

  function gerekenKoy(hedefD) {                 // hedefD: hedef alınacak X derinliği (null = < D herhangi)
    var adaylar = gerekenler.filter(function (g) {
      return (hedefD === null ? g.d < h.D : g.d === hedefD) && g.yol.some(function (a) { return dolu[a] < 0; });
    });
    if (!adaylar.length) return false;
    for (var k = 0; k < 60; k++) {
      var X = adaylar[Math.floor(rnd() * adaylar.length)];
      var bos = X.yol.filter(function (a) { return dolu[a] < 0; });
      var an = bos[Math.floor(rnd() * bos.length)];
      var hs = yuru([Math.floor(an / C), an % C], agirlikliSec(rnd, h.boy), false);
      if (!hs) continue;
      if (rnd() < 0.5) hs.reverse();
      for (var yonDene = 0; yonDene < 2; yonDene++, hs.reverse()) {
        var y = yonYol(hs);
        if (!y || !yolBos(y)) continue;
        var d = -1;
        hs.forEach(function (x) { var m = maske[x[0] * C + x[1]]; if (m > d) d = m; });
        d += 1;
        if (d > h.D || (hedefD !== null && d !== hedefD + 1)) continue;
        koy(hs, d, y); return true;
      }
    }
    return false;
  }
  function tuzakKoy() {
    for (var k = 0; k < 80; k++) {
      var r = Math.floor(rnd() * R), c = Math.floor(rnd() * C), a = r * C + c;
      if (dolu[a] >= 0 || maske[a] >= 0) continue;
      var hs = yuru([r, c], agirlikliSec(rnd, h.boy), true);
      if (!hs) continue;
      var kapaliIste = rnd() < 0.85;
      for (var yonDene = 0; yonDene < 2; yonDene++, hs.reverse()) {
        var y = yonYol(hs);
        if (!y) continue;
        if (kapaliIste && yolBos(y)) continue;
        koy(hs, null, y); return true;
      }
    }
    return false;
  }

  // önce D derinliğinde bir zincir, sonra kalan gereken + tuzak karışık
  var enDerin = 0;
  while (enDerin < h.D) { if (!gerekenKoy(enDerin)) return null; enDerin++; }
  var sira = [], i;
  for (i = gerekenler.length - 1; i < h.M; i++) sira.push('g');
  for (i = 0; i < h.tuzak; i++) sira.push('t');
  for (i = sira.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), x = sira[i]; sira[i] = sira[j]; sira[j] = x; }
  for (i = 0; i < sira.length; i++) if (!(sira[i] === 'g' ? gerekenKoy(null) : tuzakKoy())) return null;
  return yilanlar;
}

function bolumUret(n) {
  var h = hedef(n);
  for (var alt = 0; alt < 2000; alt++) {
    var rnd = mulberry32(n * 7919 + alt * 104729 + 12345);
    var ys = kur(h, rnd);
    if (!ys) continue;
    var b = { cols: h.cols, rows: h.rows, snakes: ys.map(function (hs, i) {
      var y = { id: i === 0 ? 'green' : 's' + (i - 1), cells: hs };
      if (i === 0) y.isHero = true;
      return y;
    }) };
    var o = coz.analiz(b);
    if (o.M !== h.M || o.D !== h.D || o.tuzak !== h.tuzak || o.kendiniKeser.length) continue;
    return { b: b, h: h, o: o, alt: alt };
  }
  throw new Error(n + '. bolum uretilemedi');
}

// ---- kompakt biçim ----
function k36(v) { if (!(v >= 0 && v < 36)) throw new Error('36\'lik taban disi: ' + v); return v.toString(36); }
function kompakt(b) {
  return k36(b.cols) + k36(b.rows) + ' ' + b.snakes.map(function (y) {
    var w = k36(y.cells[0][0]) + k36(y.cells[0][1]);
    for (var i = 1; i < y.cells.length; i++) {
      var dr = y.cells[i][0] - y.cells[i - 1][0], dc = y.cells[i][1] - y.cells[i - 1][1];
      w += dr === -1 ? 'U' : dr === 1 ? 'D' : dc === -1 ? 'L' : 'R';
    }
    return w;
  }).join(' ');
}

// ---- palet: ilk renkler aynen; ekler mevcut renklerin doygunluk/açıklığıyla, yeni tonla ----
function hsl(hex) {
  var r = parseInt(hex.substr(0, 2), 16) / 255, g = parseInt(hex.substr(2, 2), 16) / 255, b = parseInt(hex.substr(4, 2), 16) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, hh = 0, d = mx - mn;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  }
  return [(hh * 60 + 360) % 360, s, l];
}
function hex(hh, s, l) {
  var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = l - c / 2, rgb;
  rgb = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map(function (v) { v = Math.round((v + m) * 255); return (v < 16 ? '0' : '') + v.toString(16).toUpperCase(); }).join('');
}
function uzaklik(a, b) {
  var s = 0;
  for (var i = 0; i < 6; i += 2) s += Math.pow(parseInt(a.substr(i, 2), 16) - parseInt(b.substr(i, 2), 16), 2);
  return Math.sqrt(s);
}
function paletUzat(eski, adet) {
  var p = eski.slice();
  for (var k = p.length; k < adet; k++) {
    var orn = hsl(eski[1 + (k * 7) % (eski.length - 1)]);       // kahraman rengi örnek alınmaz
    var ton = (k * 137.508 + 23) % 360, aday = hex(ton, orn[1], orn[2]);
    // kahraman yeşiline eski paletteki en yakın renkten (uzaklık 56) daha yakın olmasın
    while (uzaklik(aday, eski[0]) < 56) { ton = (ton + 30) % 360; aday = hex(ton, orn[1], orn[2]); }
    p.push(aday);
  }
  return p;
}

// ---- dosya ----
function dosyaMetni() {
  var metin = fs.readFileSync(HEDEF, 'utf8');
  var girdiler = metin.match(/^    \/\/ \d+ — [^\n]*\n    '[^']*'/gm);
  var ilk = girdiler.filter(function (g) { return Number(/\/\/ (\d+)/.exec(g)[1]) <= ILK; });
  if (ilk.length !== ILK) throw new Error('1-' + ILK + ' bulunamadi');
  var eskiPalet = /var PALET = '([0-9A-Fa-f]+)'/.exec(metin)[1].match(/.{6}/g);
  var yeni = [], enCok = 0;
  for (var n = ILK + 1; n <= SON; n++) {
    var u = bolumUret(n);
    enCok = Math.max(enCok, u.b.snakes.length);
    yeni.push('    // ' + n + ' — M:' + u.o.M + ' D:' + u.o.D + ' tuzak:' + u.o.tuzak + ' | tahta ' + u.b.cols + 'x' + u.b.rows +
              (u.h.tur ? ' | tur:' + u.h.tur : '') + "\n    '" + kompakt(u.b) + "'");
  }
  // palet önceki çalıştırmada uzatılmış olabilir: yalnızca ilk 91 (1-100'ün kullandığı) taban alınır
  var taban = eskiPalet.slice(0, 91);
  var palet = paletUzat(taban, Math.max(enCok, taban.length));
  var bas = metin.slice(0, metin.indexOf('  window.BOLUMLER = [\n') + '  window.BOLUMLER = [\n'.length)
    .replace(/normal bölümleri \(\d+ adet\)/, 'normal bölümleri (' + SON + ' adet)')
    .replace(/var PALET = '[0-9A-Fa-f]+'/, "var PALET = '" + palet.join('') + "'");
  return bas + ilk.concat(yeni).join(',\n') + '\n  ].map(coz);\n})();\n';
}

module.exports = { dosyaMetni: dosyaMetni, hedef: hedef, bolumUret: bolumUret };

if (require.main === module) {
  var cikti = dosyaMetni();
  if (process.argv[2] === '--kontrol') {
    var ayni = cikti === fs.readFileSync(HEDEF, 'utf8');
    console.log(ayni ? 'GUNCEL: js/bolumler.js uretici ciktisiyla ayni' : 'FARKLI: node tools/kacisUret.js ile yeniden uret');
    process.exit(ayni ? 0 : 1);
  }
  var eski = coz.yukle(HEDEF).slice(0, ILK);
  var gecici = HEDEF + '.yeni';
  fs.writeFileSync(gecici, cikti);
  try { assert.deepStrictEqual(coz.yukle(gecici).slice(0, ILK), eski); }   // 1-100 birebir mi?
  catch (e) { fs.unlinkSync(gecici); throw e; }
  fs.renameSync(gecici, HEDEF);
  console.log('Yazildi: js/bolumler.js  (' + SON + ' bolum, ' + cikti.length + ' bayt) — 1-' + ILK + ' degismedi');
}
