// tempoCekirdek.js — Tempo Küp'ün saf oyun mantığı. DOM'a dokunmaz.
// Tarayıcıda window.TempoCekirdek, Node'da module.exports olarak yüklenir;
// böylece tools/tempoSim.js aynı kodu başsız (headless) çalıştırıp ölçer.
//
// TAHTA   : 8 elemanlı dizi, her eleman bir satırın bit maskesi (bit c = sütun c).
// ŞEKİL   : SEKILLER[i]; döndürme yok, her yön ayrı şekil.
// ÜRETEÇ  : 3'lük seti tahtaya "oynayarak" kurar -> en az bir sırayla
//           hepsinin yerleşeceği yapım gereği garantidir, ayrıca DFS ile doğrulanır.
(function (kok, fabrika) {
  if (typeof module === 'object' && module.exports) module.exports = fabrika();
  else kok.TempoCekirdek = fabrika();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 8, DOLU = 255;

  // 0..255 için bit sayısı tablosu
  var BIT = new Uint8Array(256);
  (function () { for (var i = 1; i < 256; i++) BIT[i] = BIT[i >> 1] + (i & 1); })();

  // ---------------------------------------------------------------
  // ŞEKİLLER — klasik blok seti
  // aile  : çeşitlilik kuralları aynı aileden parçaları birlikte sayar
  // taban : temel gelme sıklığı (aynı ailenin yönleri arasında bölünmüş)
  // ---------------------------------------------------------------
  var SEKILLER = [];
  function sekil(aile, taban, hucreler) {
    var h = 0, w = 0, i;
    for (i = 0; i < hucreler.length; i++) {
      if (hucreler[i][0] + 1 > h) h = hucreler[i][0] + 1;
      if (hucreler[i][1] + 1 > w) w = hucreler[i][1] + 1;
    }
    var satir = [];
    for (i = 0; i < h; i++) satir.push(0);
    for (i = 0; i < hucreler.length; i++) satir[hucreler[i][0]] |= (1 << hucreler[i][1]);
    var n = hucreler.length;
    SEKILLER.push({
      id: SEKILLER.length, aile: aile, taban: taban, hucreler: hucreler,
      h: h, w: w, satir: satir, n: n,
      sinif: n === 1 ? 'tek' : (n <= 3 ? 'kucuk' : (n === 4 ? 'orta' : 'buyuk'))
    });
  }
  sekil('tek', 0.5, [[0, 0]]);
  sekil('cubuk2', 0.45, [[0, 0], [0, 1]]);
  sekil('cubuk2', 0.45, [[0, 0], [1, 0]]);
  sekil('cubuk3', 0.8, [[0, 0], [0, 1], [0, 2]]);
  sekil('cubuk3', 0.8, [[0, 0], [1, 0], [2, 0]]);
  sekil('cubuk4', 1.0, [[0, 0], [0, 1], [0, 2], [0, 3]]);
  sekil('cubuk4', 1.0, [[0, 0], [1, 0], [2, 0], [3, 0]]);
  sekil('cubuk5', 0.9, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]);
  sekil('cubuk5', 0.9, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]);
  sekil('kare', 1.3, [[0, 0], [0, 1], [1, 0], [1, 1]]);
  sekil('kare3', 1.0, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]);
  sekil('dikdortgen', 0.7, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
  sekil('dikdortgen', 0.7, [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]);
  // küçük köşe (3 hücre, 4 yön)
  sekil('kose', 0.55, [[0, 0], [1, 0], [1, 1]]);
  sekil('kose', 0.55, [[0, 0], [0, 1], [1, 0]]);
  sekil('kose', 0.55, [[0, 0], [0, 1], [1, 1]]);
  sekil('kose', 0.55, [[0, 1], [1, 0], [1, 1]]);
  // L / J (4 hücre, 8 yön)
  sekil('L', 0.3, [[0, 0], [1, 0], [2, 0], [2, 1]]);
  sekil('L', 0.3, [[0, 1], [1, 1], [2, 0], [2, 1]]);
  sekil('L', 0.3, [[0, 0], [0, 1], [1, 0], [2, 0]]);
  sekil('L', 0.3, [[0, 0], [0, 1], [1, 1], [2, 1]]);
  sekil('L', 0.3, [[0, 0], [1, 0], [1, 1], [1, 2]]);
  sekil('L', 0.3, [[0, 2], [1, 0], [1, 1], [1, 2]]);
  sekil('L', 0.3, [[0, 0], [0, 1], [0, 2], [1, 0]]);
  sekil('L', 0.3, [[0, 0], [0, 1], [0, 2], [1, 2]]);
  // büyük köşe (5 hücre, 4 yön)
  sekil('buyukKose', 0.5, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]);
  sekil('buyukKose', 0.5, [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]);
  sekil('buyukKose', 0.5, [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]);
  sekil('buyukKose', 0.5, [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]]);
  // T (4 yön)
  sekil('T', 0.4, [[0, 0], [0, 1], [0, 2], [1, 1]]);
  sekil('T', 0.4, [[0, 1], [1, 0], [1, 1], [1, 2]]);
  sekil('T', 0.4, [[0, 0], [1, 0], [1, 1], [2, 0]]);
  sekil('T', 0.4, [[0, 1], [1, 0], [1, 1], [2, 1]]);
  // S / Z (4 yön)
  sekil('Z', 0.35, [[0, 1], [0, 2], [1, 0], [1, 1]]);
  sekil('Z', 0.35, [[0, 0], [0, 1], [1, 1], [1, 2]]);
  sekil('Z', 0.35, [[0, 0], [1, 0], [1, 1], [2, 1]]);
  sekil('Z', 0.35, [[0, 1], [1, 0], [1, 1], [2, 0]]);

  var TEK = 0;   // 1x1'in indeksi

  // ---------------------------------------------------------------
  // TAHTA İŞLEMLERİ
  // ---------------------------------------------------------------
  function bosTahta() { return [0, 0, 0, 0, 0, 0, 0, 0]; }

  function doluSay(b) {
    return BIT[b[0]] + BIT[b[1]] + BIT[b[2]] + BIT[b[3]] + BIT[b[4]] + BIT[b[5]] + BIT[b[6]] + BIT[b[7]];
  }

  function sigar(b, s, r, c) {
    if (r < 0 || c < 0 || r + s.h > N || c + s.w > N) return false;
    for (var i = 0; i < s.h; i++) if (b[r + i] & (s.satir[i] << c)) return false;
    return true;
  }

  function herhangiSigar(b, s) {
    for (var r = 0; r + s.h <= N; r++)
      for (var c = 0; c + s.w <= N; c++)
        if (sigar(b, s, r, c)) return true;
    return false;
  }

  // Parçayı koyar, dolan satır/sütunları siler. Girdi tahtasına dokunmaz.
  // { b, hat, satirlar (bit maskesi), sutunlar (bit maskesi), tam }
  function uygula(b, s, r, c) {
    var nb = b.slice(), i;
    for (i = 0; i < s.h; i++) nb[r + i] |= (s.satir[i] << c);
    var satirlar = 0, sutunlar = DOLU, hat = 0;
    for (i = 0; i < N; i++) {
      if (nb[i] === DOLU) { satirlar |= (1 << i); hat++; }
      sutunlar &= nb[i];
    }
    if (sutunlar) hat += BIT[sutunlar];
    if (hat) {
      var tut = (~sutunlar) & DOLU;
      for (i = 0; i < N; i++) nb[i] = (satirlar & (1 << i)) ? 0 : (nb[i] & tut);
    }
    var tam = false;
    if (hat) {
      tam = true;
      for (i = 0; i < N; i++) if (nb[i]) { tam = false; break; }
    }
    return { b: nb, hat: hat, satirlar: satirlar, sutunlar: sutunlar, tam: tam };
  }

  // Sadece "bu konum kaç hat kapatır?" — bellek ayırmadan (üreteç sıcak döngüsü)
  function hatSay(b, s, r, c) {
    var hat = 0, sut = DOLU, i, v;
    for (i = 0; i < N; i++) {
      v = b[i];
      if (i >= r && i < r + s.h) v |= (s.satir[i - r] << c);
      if (v === DOLU) hat++;
      sut &= v;
    }
    return hat + BIT[sut];
  }

  // ---------------------------------------------------------------
  // TAHTA DEĞERLENDİRMESİ — yüksek = oyuncu için daha iyi tahta.
  // Bot, ipucu ve üretecin "makul hamle" simülasyonu ortak kullanır.
  // ---------------------------------------------------------------
  function tahtaPuani(b) {
    var dolu = 0, gecis = 0, cukur = 0, kapali = 0, i, row, bos, u, d, l, r3;
    var satirKul = 0, sutunKul = 0;
    for (i = 0; i < N; i++) {
      row = b[i];
      dolu += BIT[row];
      if (row) satirKul++;
      sutunKul |= row;
      gecis += BIT[(row ^ (row >> 1)) & 127];
      if (i < N - 1) gecis += BIT[row ^ b[i + 1]];
      bos = (~row) & DOLU;
      if (bos) {
        u = i > 0 ? b[i - 1] : DOLU;
        d = i < N - 1 ? b[i + 1] : DOLU;
        l = ((row << 1) | 1) & DOLU;
        r3 = (row >> 1) | 128;
        kapali += BIT[bos & u & d & l & r3];
        cukur += BIT[bos & ((u & d & l) | (u & d & r3) | (u & l & r3) | (d & l & r3))];
      }
    }
    // hareket alanı: büyük parçalar hâlâ sığıyor mu?
    var f3 = 0, f5y = 0, f5d = 0, f2 = 0, m;
    for (i = 0; i < N; i++) {
      m = (~b[i]) & DOLU;
      f5y += BIT[m & (m >> 1) & (m >> 2) & (m >> 3) & (m >> 4)];
      if (i < N - 1) { m = (~(b[i] | b[i + 1])) & DOLU; f2 += BIT[m & (m >> 1)]; }
      if (i < N - 2) { m = (~(b[i] | b[i + 1] | b[i + 2])) & DOLU; f3 += BIT[m & (m >> 1) & (m >> 2)]; }
      if (i < N - 4) { m = (~(b[i] | b[i + 1] | b[i + 2] | b[i + 3] | b[i + 4])) & DOLU; f5d += BIT[m]; }
    }
    var p = -dolu * 10 - gecis * 5 - (cukur - kapali) * 14 - kapali * 34;
    p += Math.min(f3, 6) * 12 + Math.min(f5y, 6) * 5 + Math.min(f5d, 6) * 5 + Math.min(f2, 12) * 2;
    if (!f3) p -= 30;
    if (!f5y) p -= 14;
    if (!f5d) p -= 14;
    // tahta boşalırken dolu hücreleri az sayıda satır/sütunda topla:
    // tam temizlik (finale) ancak böyle kurulabilir
    if (dolu && dolu <= 22) p -= Math.min(satirKul, BIT[sutunKul]) * 9;
    return p;
  }

  var ODUL_HAT = 46, ODUL_TAM = 900;
  function hamleOdulu(hat, tam) {
    return hat * hat * ODUL_HAT + hat * 20 + (tam ? ODUL_TAM : 0);
  }

  // Bir parçanın bu tahtadaki en iyi konumu (tek hamlelik bakış)
  function enIyiKonum(b, s) {
    var en = null, enV = -Infinity, r, c, sonuc, v;
    for (r = 0; r + s.h <= N; r++) for (c = 0; c + s.w <= N; c++) {
      if (!sigar(b, s, r, c)) continue;
      sonuc = uygula(b, s, r, c);
      v = tahtaPuani(sonuc.b) + hamleOdulu(sonuc.hat, sonuc.tam);
      if (v > enV) { enV = v; en = { r: r, c: c, sonuc: sonuc, deger: v }; }
    }
    return en;
  }

  // ---------------------------------------------------------------
  // OYNANABİLİRLİK — üç parça, EN AZ BİR sırayla arka arkaya konabiliyor mu?
  // ---------------------------------------------------------------
  var SIRALAR3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  function siraDfs(b, liste, sira, k) {
    if (k === sira.length) return true;
    var s = liste[sira[k]], r, c;
    for (r = 0; r + s.h <= N; r++) for (c = 0; c + s.w <= N; c++) {
      if (!sigar(b, s, r, c)) continue;
      if (k === sira.length - 1) return true;
      if (siraDfs(uygula(b, s, r, c).b, liste, sira, k + 1)) return true;
    }
    return false;
  }

  function oynanabilir(b, idler) {
    var liste = idler.map(function (i) { return SEKILLER[i]; });
    if (liste.length === 1) return herhangiSigar(b, liste[0]);
    if (liste.length === 2) return siraDfs(b, liste, [0, 1], 0) || siraDfs(b, liste, [1, 0], 0);
    for (var i = 0; i < SIRALAR3.length; i++) if (siraDfs(b, liste, SIRALAR3[i], 0)) return true;
    return false;
  }

  // ---------------------------------------------------------------
  // FİNALE — tam temizlik planı
  // Tüm dolu hücreler az sayıda PARALEL hatta (yalnız satır ya da yalnız
  // sütun) duruyorsa, o hatların boşluklarını TAM kaplayan 1-3 parça aranır.
  // Paralellik önemli: bir hat erken patlasa bile diğerlerinin planı bozulmaz.
  // ---------------------------------------------------------------
  // yon: 'satir' -> E'nin bir satiri bosalinca tahtada o satir dolmus demektir
  function boslukKumeleri(b, maxHat, maxBosluk) {
    var out = [], i, j, satirlar = [], sutunVar = 0;
    for (i = 0; i < N; i++) { if (b[i]) satirlar.push(i); sutunVar |= b[i]; }
    if (!satirlar.length) return out;
    var E, say;
    if (satirlar.length <= maxHat) {
      E = bosTahta(); say = 0;
      for (j = 0; j < satirlar.length; j++) { i = satirlar[j]; E[i] = (~b[i]) & DOLU; say += BIT[E[i]]; }
      if (say && say <= maxBosluk) out.push({ E: E, say: say, yon: 'satir', hat: satirlar.length });
    }
    if (BIT[sutunVar] <= maxHat) {
      E = bosTahta(); say = 0;
      for (i = 0; i < N; i++) { E[i] = (~b[i]) & sutunVar; say += BIT[E[i]]; }
      if (say && say <= maxBosluk) out.push({ E: E, say: say, yon: 'sutun', hat: BIT[sutunVar] });
    }
    return out;
  }

  // E kümesini (satır maskeleri) `adaylar` içinden en fazla `derinlik`
  // parçayla tam kapla. tekKullan: her aday en çok bir kez (tepsi için).
  // Dönen: [{ s:şekilId, r, c, aday:adayIndeksi }, ...] ya da null
  function tamKapla(E, say, adaylar, derinlik, tekKullan, kullanilan) {
    if (say === 0) return [];
    if (derinlik === 0) return null;
    var tr = 0, tc = 0, i, a, s, h, r0, c0, k, uyar, yeni, alt;
    while (!E[tr]) tr++;
    while (!(E[tr] & (1 << tc))) tc++;
    for (a = 0; a < adaylar.length; a++) {
      if (tekKullan && kullanilan[a]) continue;
      s = SEKILLER[adaylar[a]];
      if (s.n > say) continue;
      if ((say - s.n) > (derinlik - 1) * 9) continue;
      for (h = 0; h < s.n; h++) {
        r0 = tr - s.hucreler[h][0]; c0 = tc - s.hucreler[h][1];
        if (r0 < 0 || c0 < 0 || r0 + s.h > N || c0 + s.w > N) continue;
        uyar = true;
        for (k = 0; k < s.h; k++) {
          if (((s.satir[k] << c0) & E[r0 + k]) !== (s.satir[k] << c0)) { uyar = false; break; }
        }
        if (!uyar) continue;
        yeni = E.slice();
        for (k = 0; k < s.h; k++) yeni[r0 + k] &= ~(s.satir[k] << c0);
        if (tekKullan) kullanilan[a] = true;
        alt = tamKapla(yeni, say - s.n, adaylar, derinlik - 1, tekKullan, kullanilan);
        if (tekKullan) kullanilan[a] = false;
        if (alt) { alt.unshift({ s: s.id, r: r0, c: c0, aday: a }); return alt; }
      }
    }
    return null;
  }

  // Tepsideki parçalarla tam temizlik var mı? (bot + ipucu)
  function finaleCoz(b, idler) {
    var kumeler = boslukKumeleri(b, 4, 27), i, plan;
    for (i = 0; i < kumeler.length; i++) {
      plan = tamKapla(kumeler[i].E, kumeler[i].say, idler, idler.length, true, []);
      if (plan) return plan;
    }
    return null;
  }

  // ---------------------------------------------------------------
  // PLANLAYICI — tepsinin tamamını düşünen açgözlü ışın araması.
  // Bot ve ipucu kullanır. Dönen: [{ i:tepsiIndeksi, r, c }, ...]
  // ---------------------------------------------------------------
  function permutasyonlar(n) {
    if (n === 1) return [[0]];
    if (n === 2) return [[0, 1], [1, 0]];
    return SIRALAR3;
  }

  function planla(b, idler, genislik) {
    genislik = genislik || 4;
    if (!idler.length) return [];

    // 1) tam temizlik görünüyorsa önce onu oyna
    var fin = finaleCoz(b, idler), i;
    if (fin) {
      var hamleler = [], tb = b, kullan = {};
      for (i = 0; i < fin.length; i++) {
        hamleler.push({ i: fin[i].aday, r: fin[i].r, c: fin[i].c });
        tb = uygula(tb, SEKILLER[fin[i].s], fin[i].r, fin[i].c).b;
        kullan[fin[i].aday] = true;
      }
      var kalanIdx = [], kalanId = [];
      for (i = 0; i < idler.length; i++) if (!kullan[i]) { kalanIdx.push(i); kalanId.push(idler[i]); }
      var devam = planla(tb, kalanId, genislik);
      for (i = 0; i < devam.length; i++) hamleler.push({ i: kalanIdx[devam[i].i], r: devam[i].r, c: devam[i].c });
      return hamleler;
    }

    // 2) her sıralama için ışın araması
    var siralar = permutasyonlar(idler.length), gorulen = {}, enIyi = null, p, k;
    for (p = 0; p < siralar.length; p++) {
      var sira = siralar[p];
      var imza = sira.map(function (x) { return idler[x]; }).join(',');
      if (gorulen[imza]) continue;
      gorulen[imza] = true;

      var isin = [{ b: b, odul: 0, v: 0, yol: [] }];
      for (k = 0; k < sira.length; k++) {
        var s = SEKILLER[idler[sira[k]]], sonraki = [], q, r, c, sonuc, odul;
        for (q = 0; q < isin.length; q++) {
          var d = isin[q];
          for (r = 0; r + s.h <= N; r++) for (c = 0; c + s.w <= N; c++) {
            if (!sigar(d.b, s, r, c)) continue;
            sonuc = uygula(d.b, s, r, c);
            odul = d.odul + hamleOdulu(sonuc.hat, sonuc.tam);
            sonraki.push({ b: sonuc.b, odul: odul, v: odul + tahtaPuani(sonuc.b),
                           yol: d.yol.concat([{ i: sira[k], r: r, c: c }]) });
          }
        }
        if (!sonraki.length) break;
        sonraki.sort(function (x, y) { return y.v - x.v; });
        isin = sonraki.length > genislik ? sonraki.slice(0, genislik) : sonraki;
      }
      var aday = isin[0];
      // daha çok parça yerleştiren plan her zaman önde
      var skor = aday.yol.length * 100000 + aday.v;
      if (!enIyi || skor > enIyi.skor) enIyi = { skor: skor, yol: aday.yol };
    }
    return enIyi ? enIyi.yol : [];
  }

  // ---------------------------------------------------------------
  // İKİNCİ ŞANS (reklam) — kayıp anında verilen ÖZEL 3'lü. Normal üreteçten
  // (Uretec) tamamen ayrıdır; onun durumuna dokunmaz.
  // Mevcut ızgarada her şekil ve her konum denenir. Seçilen 3 parça:
  //   - her biri ŞU ANKİ tahtada en az bir yere sığar,
  //   - sırayla yerleşir (1. konunca 2. sığar, sonra 3.),
  //   - sıralama: tamamlanan hat çok > doldurulan hücre çok > farklı şekil
  //     çok > kalan tahtanın puanı yüksek.
  // Arama: 1. parçanın bütün konumları, her biri "bir parça daha konursa en
  // çok kaç hat" bakışıyla sıralanır, en iyi ilkIsin tanesi açılır; 2. parçanın
  // bütün konumları (aynı tahtaya varan yollar birleşir) ve her biri için 3.
  // parça TAM sayılır. Açılım bütçeyi aşarsa 2. adım en iyi ara tahtalara
  // daralır: boş tahtada bile hesap kısa sürer.
  // Plan yoksa (yalnızca dar aday havuzunda olabilir; tam havuzda 1x1 her
  // zaman sığar) yedek: tahtaya sığan EN KÜÇÜK parçalar.
  // Dönen: { set:[3 şekil id], plan:[{s,r,c}] | null, hat, dolum, yedek }
  // secenek (testler için): { ilkIsin, butce, adaylar:[şekil id] }
  // ---------------------------------------------------------------
  var IKINCI_SANS = { ilkIsin: 12, butce: 120000 }, ESIT_TAVAN = 256, ILK_TAVAN = 300;

  // Hızlı konum taraması (yalnızca ikinci şans): GECERLI[(satir << 5) | desen]
  // = desenin o satırda çakışmadan kayabileceği c değerleri (bit c). Şekil
  // satır desenleri en çok 5 bit genişliktedir. ILK_BIT[m] = m'nin en düşük biti.
  var GECERLI = new Uint8Array(256 * 32), ILK_BIT = new Uint8Array(256);
  (function () {
    var satir, desen, c, m;
    for (satir = 0; satir < 256; satir++) for (desen = 1; desen < 32; desen++) {
      for (m = 0, c = 0; c < N; c++) if ((desen << c) <= DOLU && !(satir & (desen << c))) m |= (1 << c);
      GECERLI[(satir << 5) | desen] = m;
    }
    for (m = 1; m < 256; m++) { for (c = 0; !(m & (1 << c)); c++); ILK_BIT[m] = c; }
  })();
  // r satırından başlayınca şeklin sığdığı sütunlar (bit c = sigar(b, s, r, c))
  function konumMaskesi(b, s, r) {
    var m = DOLU;
    for (var i = 0; i < s.h && m; i++) m &= GECERLI[(b[r + i] << 5) | s.satir[i]];
    return m;
  }

  // Tek parçayla en çok kaç hat kapanır (bellek ayırmadan)
  function tekAdimHat(b, adaylar) {
    var en = 0, a, s, r, c, h, m;
    for (a = 0; a < adaylar.length; a++) {
      s = SEKILLER[adaylar[a]];
      for (r = 0; r + s.h <= N; r++) for (m = konumMaskesi(b, s, r); m; m &= m - 1) {
        c = ILK_BIT[m];
        h = hatSay(b, s, r, c);
        if (h > en) en = h;
      }
    }
    return en;
  }

  // Listedeki her tahtaya her adayı her konumda koy; aynı tahtaya varan
  // yollardan (hat, dolum) büyük olan kalır.
  function ikinciSansAc(liste, adaylar) {
    var sonraki = [], gorulen = {}, q, a, s, r, c, m, d, sonuc, hat, dolum, anahtar, e;
    for (q = 0; q < liste.length; q++) {
      d = liste[q];
      for (a = 0; a < adaylar.length; a++) {
        s = SEKILLER[adaylar[a]];
        for (r = 0; r + s.h <= N; r++) for (m = konumMaskesi(d.b, s, r); m; m &= m - 1) {
          c = ILK_BIT[m];
          sonuc = uygula(d.b, s, r, c);
          hat = d.hat + sonuc.hat; dolum = d.dolum + s.n;
          anahtar = String.fromCharCode.apply(null, sonuc.b);
          e = gorulen[anahtar];
          if (e === undefined) {
            gorulen[anahtar] = sonraki.length;
            sonraki.push({ b: sonuc.b, hat: hat, dolum: dolum, ata: d, hamle: { s: s.id, r: r, c: c } });
          } else {
            e = sonraki[e];
            if (hat > e.hat || (hat === e.hat && dolum > e.dolum)) {
              e.hat = hat; e.dolum = dolum; e.ata = d; e.hamle = { s: s.id, r: r, c: c };
            }
          }
        }
      }
    }
    return sonraki;
  }

  // Bütçe aşılınca ara tahtalar: (hat, dolum) büyük olanlar; sınırdaki eşitlikte tahta puanı
  function ikinciSansIsin(liste, genislik) {
    if (liste.length <= genislik) return liste;
    var anahtar = new Float64Array(liste.length), i;
    for (i = 0; i < liste.length; i++) anahtar[i] = liste[i].hat * 100 + liste[i].dolum;
    var sirali = anahtar.slice().sort();
    var esik = sirali[sirali.length - genislik], ust = [], sinir = [];
    for (i = 0; i < liste.length; i++) {
      if (anahtar[i] > esik) ust.push(liste[i]);
      else if (anahtar[i] === esik) sinir.push(liste[i]);
    }
    for (i = 0; i < sinir.length; i++) sinir[i].puan = tahtaPuani(sinir[i].b);
    sinir.sort(function (x, y) { return y.puan - x.puan; });
    return ust.concat(sinir.slice(0, genislik - ust.length));
  }

  function ikinciSansSec(b, secenek) {
    secenek = secenek || {};
    var ilkIsin = secenek.ilkIsin || IKINCI_SANS.ilkIsin, butce = secenek.butce || IKINCI_SANS.butce;
    var havuz = secenek.adaylar || SEKILLER.map(function (s) { return s.id; });
    var adaylar = [], yerSay = 0, i, k, q, a, s, r, c, m, d, adet;
    for (i = 0; i < havuz.length; i++) {
      s = SEKILLER[havuz[i]];
      if (!s || adaylar.indexOf(s.id) >= 0) continue;
      adet = 0;
      for (r = 0; r + s.h <= N; r++) adet += BIT[konumMaskesi(b, s, r)];
      if (adet) { adaylar.push(s.id); yerSay += adet; }
    }

    if (adaylar.length) {
      // 1. parça: bütün konumlar, iki parçalık hat bakışıyla sıralanır
      var bir = ikinciSansAc([{ b: b, hat: 0, dolum: 0, ata: null, hamle: null }], adaylar);
      bir = ikinciSansIsin(bir, ILK_TAVAN);   // seyrek tahtada bakış hesabı sınırlı kalsın
      for (i = 0; i < bir.length; i++) { bir[i].bakis = bir[i].hat + tekAdimHat(bir[i].b, adaylar); bir[i].puan = tahtaPuani(bir[i].b); }
      bir.sort(function (x, y) { return (y.bakis - x.bakis) || (y.hat - x.hat) || (y.dolum - x.dolum) || (y.puan - x.puan); });
      // 2. parça: seçilen ilk konumların bütün devamları (bütçeye göre daraltılır)
      var iki = ikinciSansAc(bir.slice(0, ilkIsin), adaylar);
      iki = ikinciSansIsin(iki, Math.max(8, Math.floor(butce / yerSay)));
      // 3. parça: bellek ayırmadan sayılır. (hat, dolum, farklı) en iyileri
      // biriktirilir; tahta puanı yalnızca ilk ESIT_TAVAN eşit aday için hesaplanır.
      var enHat = -1, enDolum = -1, enFarkli = -1, esit = [], hat, dolum, farkli, p1, p2;
      for (q = 0; q < iki.length; q++) {
        d = iki[q];
        p1 = d.ata.hamle.s; p2 = d.hamle.s;
        for (a = 0; a < adaylar.length; a++) {
          s = SEKILLER[adaylar[a]];
          farkli = 1 + (p1 !== p2 ? 1 : 0) + ((s.id !== p1 && s.id !== p2) ? 1 : 0);
          for (r = 0; r + s.h <= N; r++) for (m = konumMaskesi(d.b, s, r); m; m &= m - 1) {
            c = ILK_BIT[m];
            hat = d.hat + hatSay(d.b, s, r, c); dolum = d.dolum + s.n;
            if (hat !== enHat) { if (hat < enHat) continue; }
            else if (dolum !== enDolum) { if (dolum < enDolum) continue; }
            else if (farkli !== enFarkli) { if (farkli < enFarkli) continue; }
            else { if (esit.length < ESIT_TAVAN) esit.push({ d: d, s: s.id, r: r, c: c }); continue; }
            enHat = hat; enDolum = dolum; enFarkli = farkli;
            esit = [{ d: d, s: s.id, r: r, c: c }];
          }
        }
      }
      var en = null, enPuan = -Infinity, v;
      for (i = 0; i < esit.length; i++) {
        v = esit.length > 1 ? tahtaPuani(uygula(esit[i].d.b, SEKILLER[esit[i].s], esit[i].r, esit[i].c).b) : 0;
        if (v > enPuan) { enPuan = v; en = esit[i]; }
      }
      if (en) {
        en.hat = enHat; en.dolum = enDolum;
        var plan = [{ s: en.s, r: en.r, c: en.c }];
        for (d = en.d; d.hamle; d = d.ata) plan.unshift(d.hamle);
        return { set: plan.map(function (y) { return y.s; }), plan: plan, hat: en.hat, dolum: en.dolum, yedek: false };
      }
    }

    // yedek: tahtaya sığan en küçük parçalar (sırayla yerleşmeye çalışılır)
    var sirali = SEKILLER.slice().sort(function (x, y) { return (x.n - y.n) || (x.id - y.id); });
    var sim = b, set = [], yer, sec;
    for (k = 0; k < 3; k++) {
      sec = null;
      for (i = 0; i < sirali.length && !sec; i++) if (herhangiSigar(sim, sirali[i]) && herhangiSigar(b, sirali[i])) sec = sirali[i];
      if (!sec) for (i = 0; i < sirali.length && !sec; i++) if (herhangiSigar(b, sirali[i])) sec = sirali[i];
      if (!sec) { set.push(TEK); continue; }
      set.push(sec.id);
      yer = enIyiKonum(sim, sec);
      if (yer) sim = yer.sonuc.b;
    }
    return { set: set, plan: null, hat: 0, dolum: 0, yedek: true };
  }

  // ---------------------------------------------------------------
  // RASTGELE
  // ---------------------------------------------------------------
  function rngOlustur(tohum) {
    var t = tohum >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function yumusak(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  // ---------------------------------------------------------------
  // ÜRETEÇ
  // Ayarlar tek yerde; tools/tempoSim.js ile ölçülüp ayarlandı.
  // ---------------------------------------------------------------
  var AYAR = {
    zorlukTur: 70,          // zorluk eğrisinin hızı: d = 1 - e^(-tur/zorlukTur)
    finaleMaxDolu: 32,      // tahtada en fazla bu kadar hücre varken finale/kurulum aranır
    finaleSans: [1.0, 0.80],   // [kolay, zor] finale sunma olasılığı
    kurulumSans: [0.90, 0.62],  // [kolay, zor] finale kurulumu (boşluklara oturan set) olasılığı
    finaleBekleme: 3,       // tam temizlikten sonra kaç tepsi finale/kurulum sunulmaz
    finaleBeklemeArtis: 2,  // her tam temizlikte bekleme bu kadar uzar
    finaleBeklemeMax: 14,
    acilisBekleme: 4,       // oyunun ilk tepsilerinde finale yok (bedava tam temizlik olmasın)
    kapaticiSans: [0.96, 0.55], // dolu tahtada "en az bir hat kapatan parça" olasılığı
    deneme: 8,              // doğrulamadan geçemeyen set için yeniden kurma sayısı
    // zorluk d=1 iken yardımın indiği taban değerler
    zorTek: 1.0, zorKucuk: 1.1, zorBuyuk: 0.6, zorKivrim: 0.6, zorOdul: 0.5,
    sabitZorluk: null       // yalnızca simülasyon deneyleri için
  };

  function Uretec(rng) {
    this.rng = rng || Math.random;
    this.tur = 0;            // üretilen tepsi sayısı
    this.sonSet = [];        // bir önceki tepsinin şekil id'leri
    this.isi = {};           // aile -> yakın geçmişte ne sık geldi
    this.bekleme = AYAR.acilisBekleme;   // finale bekleme sayacı
    this.sonFinale = false;  // son üretilen tepsi bir finale planı mıydı
    this.sonTur = '';        // 'finale' | 'kurulum' | 'normal' | 'guvenli'
  }

  Uretec.prototype.durum = function () {
    return { tur: this.tur, sonSet: this.sonSet.slice(), isi: JSON.parse(JSON.stringify(this.isi)),
             bekleme: this.bekleme, tam: this.tamSayisi || 0 };
  };
  Uretec.prototype.yukle = function (d) {
    if (!d) return;
    this.tur = d.tur || 0;
    this.sonSet = (d.sonSet || []).slice();
    this.isi = d.isi || {};
    this.bekleme = d.bekleme || 0;
    this.tamSayisi = d.tam || 0;
  };

  Uretec.prototype.zorluk = function () {
    if (AYAR.sabitZorluk != null) return AYAR.sabitZorluk;   // yalnizca simulasyon deneyleri icin
    return 1 - Math.exp(-this.tur / AYAR.zorlukTur);
  };

  // Havuzdaki her şeklin bu tahtadaki ölçümü: kaç yere sığıyor, en çok kaç hat kapatıyor
  function olc(b) {
    var out = new Array(SEKILLER.length), i, s, r, c, adet, mh, h;
    for (i = 0; i < SEKILLER.length; i++) {
      s = SEKILLER[i]; adet = 0; mh = 0;
      for (r = 0; r + s.h <= N; r++) for (c = 0; c + s.w <= N; c++) {
        if (!sigar(b, s, r, c)) continue;
        adet++;
        h = hatSay(b, s, r, c);
        if (h > mh) mh = h;
      }
      out[i] = { adet: adet, maxHat: mh };
    }
    return out;
  }

  Uretec.prototype.agirlik = function (s, olcum, t, d, set) {
    var w = s.taban, i;
    // 1) boyut: tahta doldukça büyük parça çekilir, küçük/esnek parça artar.
    //    Zorluk (d) bu yardımı yumuşakça kısar; hiçbir zaman sıfırlamaz.
    if (s.sinif === 'tek')        w *= 0.03 + lerp(2.4, AYAR.zorTek, d) * t * t * t;
    else if (s.sinif === 'kucuk') w *= lerp(0.40, lerp(1.9, AYAR.zorKucuk, d), t);
    else if (s.sinif === 'orta')  w *= lerp(1.0, 1.3, t);
    else                          w *= lerp(2.1, lerp(0.16, AYAR.zorBuyuk, d), Math.min(1, t * 1.4));
    // köşeli/kıvrımlı parçalar ileri turlarda biraz daha sık
    if (s.aile === 'Z' || s.aile === 'T' || s.aile === 'buyukKose' || s.aile === 'dikdortgen') w *= 1 + AYAR.zorKivrim * d;
    // 2) ödül: hat kapatabilen parça öne alınır (asla cezalandırılmaz)
    if (olcum.maxHat > 0) w *= 1 + (0.9 + 0.7 * olcum.maxHat) * lerp(1, AYAR.zorOdul, d) * yumusak(0.12, 0.45, t);
    // 3) sıkışık tahtada tek bir yere sığan parça riskli: biraz geri çek
    if (olcum.adet <= 2 && olcum.maxHat === 0) w *= 0.5;
    // 4) çeşitlilik
    for (i = 0; i < set.length; i++) {
      if (set[i] === s.id) w *= 0.04;
      else if (SEKILLER[set[i]].aile === s.aile) w *= 0.35;
    }
    for (i = 0; i < this.sonSet.length; i++) {
      if (this.sonSet[i] === s.id) w *= 0.22;
      // çirkin küçük parçalar üst üste gelmesin
      else if ((s.aile === 'tek' || s.aile === 'cubuk2') && SEKILLER[this.sonSet[i]].aile === s.aile) w *= 0.3;
    }
    if (s.aile === 'tek') {
      for (i = 0; i < this.sonSet.length; i++) if (this.sonSet[i] === s.id) w *= 0.12;
    }
    w *= 1 / (1 + (this.isi[s.aile] || 0) * 0.55);
    return w;
  };

  Uretec.prototype.sec = function (havuz, agirliklar) {
    var top = 0, i;
    for (i = 0; i < agirliklar.length; i++) top += agirliklar[i];
    if (!(top > 0)) return havuz[Math.floor(this.rng() * havuz.length)];
    var x = this.rng() * top;
    for (i = 0; i < havuz.length; i++) { x -= agirliklar[i]; if (x <= 0) return havuz[i]; }
    return havuz[havuz.length - 1];
  };

  // Seti tahtaya sırayla "oynayarak" kur: her parça, bir öncekinin makul
  // biçimde oynanmış halindeki tahtaya göre seçilir.
  Uretec.prototype.kur = function (b, d, onSet, onSim) {
    var sim = onSim || b, set = onSet ? onSet.slice() : [], slot, i, t, olcum, havuz, kapatici, agir, id, yer;
    var t0 = doluSay(b) / 64;
    var kapaticiIste = this.rng() < lerp(AYAR.kapaticiSans[0], AYAR.kapaticiSans[1], d) * yumusak(0.10, 0.40, t0);
    var kapaticiVar = false;

    for (slot = set.length; slot < 3; slot++) {
      t = doluSay(sim) / 64;
      olcum = olc(sim);
      havuz = [];
      for (i = 0; i < SEKILLER.length; i++) if (olcum[i].adet > 0) havuz.push(i);
      if (!havuz.length) return null;

      // mümkünse sette en az bir hat kapatan parça olsun
      if (kapaticiIste && !kapaticiVar) {
        kapatici = havuz.filter(function (x) { return olcum[x].maxHat > 0; });
        if (kapatici.length && (slot === 2 || this.rng() < 0.55)) havuz = kapatici;
      }

      agir = [];
      for (i = 0; i < havuz.length; i++) agir.push(this.agirlik(SEKILLER[havuz[i]], olcum[havuz[i]], t, d, set));
      id = this.sec(havuz, agir);
      set.push(id);
      if (olcum[id].maxHat > 0) kapaticiVar = true;

      if (slot < 2) {
        yer = enIyiKonum(sim, SEKILLER[id]);
        if (!yer) return null;
        sim = yer.sonuc.b;
      }
    }
    return set;
  };

  // Boş tahta için (finale sonrası boş kalan yuvalar) parça seç
  Uretec.prototype.bosTahtaParcasi = function (set) {
    var bos = bosTahta(), olcum = olc(bos), havuz = [], agir = [], i;
    for (i = 0; i < SEKILLER.length; i++) {
      havuz.push(i);
      agir.push(this.agirlik(SEKILLER[i], olcum[i], 0, this.zorluk(), set));
    }
    return this.sec(havuz, agir);
  };

  Uretec.prototype.karisikAdaylar = function () {
    var adaylar = [], i, j, g;
    for (i = 0; i < SEKILLER.length; i++) adaylar.push(i);
    for (i = adaylar.length - 1; i > 0; i--) {
      j = Math.floor(this.rng() * (i + 1));
      g = adaylar[i]; adaylar[i] = adaylar[j]; adaylar[j] = g;
    }
    // dolgun parçalar öne: plan az ama iri parçayla kurulsun, 1x1 yağmasın
    adaylar.sort(function (x, y) {
      return (SEKILLER[x].n >= 3 ? 0 : 1) - (SEKILLER[y].n >= 3 ? 0 : 1);
    });
    return adaylar;
  };

  // FİNALE: boşlukları TAM kaplayan 1-3 parça. Bulunursa tahta tamamen süpürülebilir.
  Uretec.prototype.finaleDene = function (b) {
    var kumeler = boslukKumeleri(b, 4, 22), i, plan, set;
    if (!kumeler.length) return null;
    var adaylar = this.karisikAdaylar();
    if (this.rng() < 0.5) kumeler.reverse();
    for (i = 0; i < kumeler.length; i++) {
      // her şekil en çok bir kez: finale seti aynı parçanın kopyalarından oluşmasın
      plan = tamKapla(kumeler[i].E, kumeler[i].say, adaylar, 3, true, []);
      if (!plan) continue;
      set = plan.map(function (p) { return p.s; });
      while (set.length < 3) set.push(this.bosTahtaParcasi(set));
      return set;
    }
    return null;
  };

  // KURULUM: tam kaplama yoksa, dolu hatların boşluklarına OTURAN parçalar.
  // Oyuncu bunları yerine koyarsa hatlar patlar, geriye az hücre kalır ve
  // bir sonraki tepside finale kurulabilir. (Setup -> payoff.)
  Uretec.prototype.kurulumDene = function (b, d) {
    var kumeler = boslukKumeleri(b, 5, 64), self = this, enIyi = null, i;
    for (i = 0; i < kumeler.length; i++) {
      var sonuc = this.kismiKapla(kumeler[i]);
      if (!enIyi || sonuc.kapanan > enIyi.kapanan) enIyi = sonuc;
    }
    if (!enIyi || enIyi.set.length < 2 || enIyi.kapanan < 6) return null;
    if (enIyi.set.length === 3) return enIyi.set;
    // kalan yuvalar: kurulum parçaları oynanmış tahtaya göre normal seçim
    var sim = b;
    enIyi.yerler.forEach(function (y) { sim = uygula(sim, SEKILLER[y.s], y.r, y.c).b; });
    return self.kur(b, d, enIyi.set, sim);
  };

  Uretec.prototype.kismiKapla = function (kume) {
    var kalan = kume.E.slice(), set = [], yerler = [], kapanan = 0, k, i, s, r, c, j, uyar;
    for (k = 0; k < 3; k++) {
      var en = null, enV = -Infinity, v, hatTamam, sut, sat;
      for (i = 0; i < SEKILLER.length; i++) {
        s = SEKILLER[i];
        if (s.n < 2 || set.indexOf(s.id) >= 0) continue;
        for (r = 0; r + s.h <= N; r++) for (c = 0; c + s.w <= N; c++) {
          uyar = true;
          for (j = 0; j < s.h; j++) {
            if (((s.satir[j] << c) & kalan[r + j]) !== (s.satir[j] << c)) { uyar = false; break; }
          }
          if (!uyar) continue;
          // bu parça kaç hattı tamamlıyor?
          hatTamam = 0;
          if (kume.yon === 'satir') {
            for (j = 0; j < s.h; j++) if ((kalan[r + j] & ~(s.satir[j] << c)) === 0) hatTamam++;
          } else {
            sut = 0; sat = 0;
            for (j = 0; j < N; j++) {
              sut |= (j >= r && j < r + s.h) ? (kalan[j] & ~(s.satir[j - r] << c)) : kalan[j];
              sat |= kalan[j];
            }
            hatTamam = BIT[sat & ~sut & DOLU];
          }
          v = s.n + hatTamam * 2.5 + this.rng() * 2.2;
          if (this.sonSet.indexOf(s.id) >= 0) v -= 1.2;
          if (v > enV) { enV = v; en = { s: s.id, r: r, c: c }; }
        }
      }
      if (!en) break;
      s = SEKILLER[en.s];
      for (j = 0; j < s.h; j++) kalan[en.r + j] &= ~(s.satir[j] << en.c);
      set.push(en.s); yerler.push(en); kapanan += s.n;
    }
    return { set: set, yerler: yerler, kapanan: kapanan };
  };

  // Son çare: en küçük sığan parçalarla kur (yalnızca tahta gerçekten sıkışıksa)
  Uretec.prototype.guvenli = function (b) {
    var sim = b, set = [], k, i, en, yer;
    var sirali = SEKILLER.slice().sort(function (x, y) { return x.n - y.n; });
    for (k = 0; k < 3; k++) {
      en = null;
      for (i = 0; i < sirali.length; i++) if (herhangiSigar(sim, sirali[i])) { en = sirali[i]; break; }
      if (!en) { set.push(TEK); continue; }
      set.push(en.id);
      yer = enIyiKonum(sim, en);
      if (yer) sim = yer.sonuc.b;
    }
    return set;
  };

  Uretec.prototype.kaydet = function (set, tur) {
    var finale = (tur === 'finale');
    this.sonTur = tur;
    var a;
    for (a in this.isi) this.isi[a] *= 0.55;
    for (var i = 0; i < set.length; i++) {
      a = SEKILLER[set[i]].aile;
      this.isi[a] = (this.isi[a] || 0) + 1;
    }
    this.sonSet = set.slice();
    this.sonFinale = !!finale;
    this.tur++;
    return set;
  };

  // Tam temizlik gerçekleşince oyun bunu bildirir: üst üste finale yağmasın
  // Her tam temizlikten sonra bekleme biraz daha uzar: ilk tam temizlik erken
  // ve ulaşılabilir, sonrakiler giderek daha "özel" olur.
  Uretec.prototype.tamTemizlikOldu = function () {
    this.tamSayisi = (this.tamSayisi || 0) + 1;
    this.bekleme = Math.min(AYAR.finaleBeklemeMax, AYAR.finaleBekleme + AYAR.finaleBeklemeArtis * (this.tamSayisi - 1));
  };

  Uretec.prototype.karistir = function (set) {
    for (var i = set.length - 1; i > 0; i--) {
      var j = Math.floor(this.rng() * (i + 1)), g = set[i];
      set[i] = set[j]; set[j] = g;
    }
    return set;
  };

  // ANA GİRİŞ: tahta -> 3 şekil id'si
  Uretec.prototype.uret = function (b) {
    var d = this.zorluk(), dolu = doluSay(b), set, k;
    if (this.bekleme > 0) this.bekleme--;

    // 1) tahta boşalmaya yakınsa: tam temizlik fırsatı ya da onun kurulumu
    if (dolu > 0 && dolu <= AYAR.finaleMaxDolu && this.bekleme === 0) {
      if (this.rng() < lerp(AYAR.finaleSans[0], AYAR.finaleSans[1], d)) {
        set = this.finaleDene(b);
        if (set && oynanabilir(b, set)) return this.kaydet(this.karistir(set), 'finale');
      }
      if (this.rng() < lerp(AYAR.kurulumSans[0], AYAR.kurulumSans[1], d)) {
        set = this.kurulumDene(b, d);
        if (set && oynanabilir(b, set)) return this.kaydet(this.karistir(set), 'kurulum');
      }
    }

    // 2) normal üretim; doğrulamadan geçmeyen set atılır, yeniden kurulur
    for (k = 0; k < AYAR.deneme; k++) {
      set = this.kur(b, d);
      if (set && oynanabilir(b, set)) return this.kaydet(this.karistir(set), 'normal');
    }

    // 3) güvenlik ağı
    return this.kaydet(this.guvenli(b), 'guvenli');
  };

  // ---------------------------------------------------------------
  // PUANLAMA
  //   yerleştirme : hücre başına 10
  //   hat         : 100 x (1,3,6,10,15,21…) x tempo çarpanı
  //   tam temizlik: 2500 x tempo çarpanı
  // TEMPO (seri): üst üste hat patlattıkça çarpan büyür (x1…x5). Hat
  // patlatmadan sabırHakki(çarpan) hamle yapılırsa sıfırlanır. Hak çarpanla
  // büyür: x1–x3'te 3, x4'te 4, x5'te 5 hamle (yüksek tempo daha zor
  // kazanıldığı için daha kolay kaybedilmesin). Süreye değil
  // hamleye bağlıdır.
  // ---------------------------------------------------------------
  var PUAN_HUCRE = 10, PUAN_HAT = 100, PUAN_TAM = 2500, TEMPO_SABIR = 3, TEMPO_MAX = 5;

  function hatPuani(hat) { return PUAN_HAT * hat * (hat + 1) / 2; }
  function sabirHakki(carpan) { return Math.max(TEMPO_SABIR, Math.min(TEMPO_MAX, carpan)); }

  // ---------------------------------------------------------------
  // OYUN — durum makinesi. Arayüz ve simülasyon aynı nesneyi sürer.
  // ---------------------------------------------------------------
  function Oyun(rng) {
    this.rng = rng || Math.random;
    this.uretec = new Uretec(this.rng);
    this.b = bosTahta();
    this.tepsi = [];         // [{ s:şekilId, kullanildi:bool }]
    this.skor = 0;
    this.seri = 0;           // ardışık temizlik sayısı
    this.sabir = 0;          // seri bozulmadan kalan hamle hakkı
    this.hamle = 0;
    this.tamSayisi = 0;
    this.hatSayisi = 0;
    this.bitti = false;
    this.ikinciSans = false; // bu koşuda reklamlı ikinci şans kullanıldı mı (koşu başına 1)
  }

  Oyun.prototype.basla = function () {
    this.tepsiDoldur();
    return this;
  };

  Oyun.prototype.tepsiDoldur = function () {
    var set = this.uretec.uret(this.b);
    this.tepsi = set.map(function (id) { return { s: id, kullanildi: false }; });
  };

  Oyun.prototype.kalanlar = function () {
    var out = [];
    for (var i = 0; i < this.tepsi.length; i++) if (!this.tepsi[i].kullanildi) out.push(i);
    return out;
  };

  Oyun.prototype.carpan = function () { return Math.max(1, Math.min(TEMPO_MAX, this.seri)); };

  Oyun.prototype.konabilir = function (i, r, c) {
    var p = this.tepsi[i];
    return !this.bitti && !!p && !p.kullanildi && sigar(this.b, SEKILLER[p.s], r, c);
  };

  // Hamleyi uygular; arayüzün canlandıracağı her şeyi döndürür.
  Oyun.prototype.oyna = function (i, r, c) {
    if (!this.konabilir(i, r, c)) return null;
    var p = this.tepsi[i], s = SEKILLER[p.s];
    var sonuc = uygula(this.b, s, r, c);
    this.b = sonuc.b;
    p.kullanildi = true;
    this.hamle++;

    var puanYer = s.n * PUAN_HUCRE, puanHat = 0, puanTam = 0;
    if (sonuc.hat) {
      this.seri++;
      this.sabir = sabirHakki(this.carpan());
      this.hatSayisi += sonuc.hat;
      puanHat = hatPuani(sonuc.hat) * this.carpan();
      if (sonuc.tam) {
        puanTam = PUAN_TAM * this.carpan();
        this.tamSayisi++;
        this.uretec.tamTemizlikOldu();
      }
    } else if (this.seri > 0) {
      this.sabir--;
      if (this.sabir <= 0) { this.seri = 0; this.sabir = 0; }
    }
    this.skor += puanYer + puanHat + puanTam;

    var yeniTepsi = false;
    if (this.kalanlar().length === 0) { this.tepsiDoldur(); yeniTepsi = true; }

    // kalan parçalardan hiçbiri sığmıyorsa oyun biter
    var kalan = this.kalanlar(), yasiyor = false, k;
    for (k = 0; k < kalan.length; k++) {
      if (herhangiSigar(this.b, SEKILLER[this.tepsi[kalan[k]].s])) { yasiyor = true; break; }
    }
    if (!yasiyor) this.bitti = true;

    return {
      sekil: s, r: r, c: c,
      hat: sonuc.hat, satirlar: sonuc.satirlar, sutunlar: sonuc.sutunlar, tam: sonuc.tam,
      puan: puanYer + puanHat + puanTam, puanHat: puanHat, puanTam: puanTam,
      seri: this.seri, carpan: this.carpan(), sabir: this.sabir,
      yeniTepsi: yeniTepsi, bitti: this.bitti
    };
  };

  // İpucu / bot: kalan parçalar için en iyi plan
  Oyun.prototype.oneri = function (genislik) {
    var kalan = this.kalanlar(), self = this;
    var plan = planla(this.b, kalan.map(function (i) { return self.tepsi[i].s; }), genislik);
    return plan.map(function (h) { return { i: kalan[h.i], r: h.r, c: h.c }; });
  };

  // İkinci şans (reklam izlendi): kalan parçalar atılır, tepsiye ikinciSansSec'in
  // 3 parçası konur. Skor, seri, sabır (tempo çarpanı) ve üreteç AYNEN kalır.
  // Koşu başına bir kez; ikinci çağrı null döner.
  Oyun.prototype.ikinciSansUygula = function () {
    if (this.ikinciSans) return null;
    var sec = ikinciSansSec(this.b);
    this.tepsi = sec.set.map(function (id) { return { s: id, kullanildi: false }; });
    this.ikinciSans = true;
    this.bitti = false;
    return sec;
  };

  // Kaydet / yükle (uygulama kapanıp açılınca kaldığı yerden devam)
  // is: ikinci şans kullanıldı (OPSİYONEL alan; yalnızca 1 iken yazılır, eski kayıtta yok = kullanılmadı)
  Oyun.prototype.kayit = function () {
    var k = { b: this.b.slice(), t: this.tepsi.map(function (p) { return [p.s, p.kullanildi ? 1 : 0]; }),
             skor: this.skor, seri: this.seri, sabir: this.sabir, hamle: this.hamle,
             tam: this.tamSayisi, hat: this.hatSayisi, u: this.uretec.durum() };
    if (this.ikinciSans) k.is = 1;
    return k;
  };
  Oyun.prototype.yukle = function (k) {
    if (!k || !(k.b instanceof Array) || k.b.length !== N || !(k.t instanceof Array) || !k.t.length) return false;
    var i;
    for (i = 0; i < k.t.length; i++) if (!SEKILLER[k.t[i][0]]) return false;
    this.b = k.b.map(function (x) { return x & DOLU; });
    this.tepsi = k.t.map(function (x) { return { s: x[0], kullanildi: !!x[1] }; });
    this.skor = k.skor || 0; this.seri = k.seri || 0; this.sabir = k.sabir || 0;
    this.hamle = k.hamle || 0; this.tamSayisi = k.tam || 0; this.hatSayisi = k.hat || 0;
    this.uretec.yukle(k.u);
    this.ikinciSans = k.is === 1;
    var kalan = this.kalanlar(), yasiyor = false;
    for (i = 0; i < kalan.length; i++) if (herhangiSigar(this.b, SEKILLER[this.tepsi[kalan[i]].s])) yasiyor = true;
    // kayıtlı durum kaybedilmiş olabilir (ikinci şans teklifi beklerken kapatıldı):
    // durum yine yüklenir, bitti işaretlenir; dönüş değeri eskisi gibi "oynanabilir mi"
    this.bitti = !yasiyor;
    return yasiyor;
  };

  return {
    N: N, SEKILLER: SEKILLER, TEK: TEK, AYAR: AYAR,
    TEMPO_SABIR: TEMPO_SABIR, TEMPO_MAX: TEMPO_MAX, sabirHakki: sabirHakki,
    bosTahta: bosTahta, doluSay: doluSay, sigar: sigar, herhangiSigar: herhangiSigar,
    uygula: uygula, hatSay: hatSay, tahtaPuani: tahtaPuani, enIyiKonum: enIyiKonum,
    oynanabilir: oynanabilir, finaleCoz: finaleCoz, planla: planla, ikinciSansSec: ikinciSansSec,
    rngOlustur: rngOlustur, Uretec: Uretec, Oyun: Oyun
  };
});
