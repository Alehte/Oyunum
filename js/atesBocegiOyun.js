// atesBocegiOyun.js — Ates Bocegi arayuzu: canvas cizimi, girdi, ses, kayit ve jeton koprusu.
// Oyun kurallari, uretici ve ekonomi hesaplari js/atesBocegi.js icindedir (AYAR orada);
// burasi durumu cizer, girdiyi iletir ve koşu bitince sonucu kayda yazar.
//
// Disariya acilan arayuz: window.AtesBocegiOyun = { start, dur, temaDegisti, sifirla }
// Kayit: AppProgress.atesBocegi = { rekor, kosu, gun, gunJeton }
(function () {
  'use strict';

  var AB = window.AtesBocegi;
  if (!AB) { console.error('atesBocegiOyun.js: atesBocegi.js yuklenmemis'); return; }

  var AYAR = AB.AYAR, D = AYAR.dunya, M = AYAR.hareket, AD = AYAR.adalet;
  var W = D.W, H = D.H, XB = D.X_BOCEK, DT = D.DT;

  // ---------------------------------------------------------------
  // CIZIM SABITLERI (denge degil; gorunum ve dongu)
  // ---------------------------------------------------------------
  var MAKS_ADIM = 12;                 // kare basina en cok adim (tasarim 3.1); asan birikim atilir
  var MAKS_FARK = 0.1;                // bir karenin birikime en cok katkisi (sn)
  var KARANLIK_OPAKLIK = 0.94;        // tasarim 5
  var ENGEL_DOLGU = '#0B0F14', ENGEL_KENAR = '#E9EDF2', KENAR_PX = 1.25;   // tema degistiremez (tasarim 5)
  // Sabit tehlike renkleri (tema degistiremez; tasarim 11.5, 11.7). Kontrast: tools/atesBocegiTemaTest.js
  var BOMBA_KENAR = '#FF9566', BOMBA_CEKIRDEK = '#FF9A1F';       // bomba: koyu kure (ENGEL_DOLGU) + acik kenar + cekirdek
  var UNLEM_RENK = '#FFB02E';                                      // sarmasik uyarisi (unlem, koyu isaret ENGEL_DOLGU)
  var SARMASIK_GOVDE = '#7FBF3F', SARMASIK_YAPRAK = '#B6E26B';     // sarmasik (koyu dis cizgi ENGEL_DOLGU)
  var SILUET_CIZGI = [0.8, 0.8], SILUET_YOK = [];                  // sarmasik hayalet silueti kesik cizgi (onceden kurulu, kare basina dizi uretilmez)
  var BOMBA_DIKEN = 8;                                             // diken sayisi (renk korlugunde sekil ayrimi: toz duz daire)
  var KATMAN = { mantarKap: 0.3, mantarHale: 0.16, ay: 0.12, sis: 0.5, sisAlfa: 0.14, uzak: 0.22, huzme: 0.16, sisBant: 0.16, yakin: 0.42 };   // arka plan katman karisimlari (test okur)
  var UZAK_MAVI = '#7F98C0';                                        // uzak katman soluk mavi tonu (tema testi okur)
  var BOCEK_KOYU = '#1A1410', BOCEK_KIN = '#2E2219', BOCEK_PLAKA = '#3A2C20', BOCEK_KANAT = '#FFFFFF';   // bocek sabit koyu parcalari
  var BOLGE_TON = ['#24402F', '#2E2A44', '#1F3F4C', '#3A4031'];            // orman, magara, nehir, bataklik
  var PARALAKS = [0.2, 0.5, 1];       // uc katmanin hiz carpani
  var ISIK_KARISIM = 0.12;            // zemine isik tonu bindirme (tasarim 5)
  var IZ_SANIYE = 0.5, IZ_ORNEK = 30, IZ_ALFA = 0.6;
  var PARCACIK_TAVAN = 24, PARCACIK_OMUR = 0.6, PARCACIK_HIZ = 40, PATLAMA_YUVA = 8;   // son PATLAMA_YUVA yuva lav izine verilmez (bomba patlamasi icin ayrilir)
  var BOLGE_GECIS = 1.5;              // arka plan capraz gecis suresi (sn)
  var SONME_SN = 0.85;                // isik sonme suresi (sn); sonra sonuc karti
  var SONME_AZ_SN = 0.3;              // azaltilmis hareket: kisa ve sade
  var SONME_YAVAS = 0.5;              // sonerken dunyanin kalan kayma hizi (ilk andaki hizin orani)
  // Zemin olumu (tasarim 12.1, Mario tarzi): dunya donar; bocek kisa yukari sicrar, ters doner, isigi yavasca
  // sonerken asagi, ekran disina duser; sonra normal sonuc karti. Azaltilmis harekette SONME_AZ_SN sade sonme.
  var ZEMIN_OLUM_SN = 1.3, ZEMIN_SICRAMA = 7, ZEMIN_SICRAMA_SN = 0.3;   // toplam sure, sicrama yuksekligi (birim) ve tepeye varis
  // Sersemlik efekti: bocegin ustunde donen yildiz halkasi (renk temadan: pal.vurgu); azaltilmis harekette donmez.
  var SERSEM_YILDIZ = 3, SERSEM_HALKA_RX = 2.6, SERSEM_HALKA_RY = 0.8, SERSEM_YILDIZ_R = 0.75, SERSEM_DONUS = 6;   // rad/sn

  var YERLESIK = {
    isik: '#FFE27A', toz: '#FFF3B0', vurgu: '#9BE86B', karanlik: '#05080D',
    iz: { renk: '#FFD24A', sekil: 'cizgi' }, animasyon: ''
  };
  var IZ_SEKILLER = { cizgi: 1, damla: 1, baklava: 1, akkor: 1 };

  function q(id) { return document.getElementById(id); }
  var ekran = q('screen-ates'), alan = q('abAlan'), tuval = q('abTuval');
  if (!ekran || !alan || !tuval || !tuval.getContext) { console.error('atesBocegiOyun.js: ekran ogeleri yok'); return; }
  var ctx = tuval.getContext('2d');
  var puanEl = q('abPuan'), rekorEl = q('abRekor'), carpanEl = q('abCarpan'), isikEl = q('abIsik');
  var ipucuEl = q('abIpucu'), durEl = q('abDuraklat'), sonEl = q('abSonuc');
  var sonBaslik = q('abSonBaslik'), sonAlt = q('abSonAlt');

  // ---------------------------------------------------------------
  // DURUM
  // ---------------------------------------------------------------
  var durum = null;                   // cekirdek durumu
  var pal = null;                     // etkin palet
  var rafId = 0, sonZaman = 0, birikim = 0, zaman = 0, kare = 0;
  var calisiyor = false, duraklatildi = false, bekle = true, bitisIsleniyor = false;
  var kosuNo = 0;                     // her yeni kosu / durdurma ile artar
  var sonme = -1;                     // isik sonme suresi (sn); -1: baslamadi ya da bitti
  var olumTur = '';                   // '' | 'isik' | 'zemin' (cekirdek bitti olayinin sebebi; zeminde dusus animasyonu)
  var basili = false, isaretciler = 0, tusBasili = false;
  var rekor = 0, sonSonuc = null;
  var hizOnbellek = 24, hizSayac = 0;
  var azHareketOn = false;
  var kanatFaz = 0, adimSayaci = 0;

  // olcu (css px + cihaz px)
  var dpr = 1, cssW = 0, cssH = 0, olcek = 1, ox = 0, oy = 0, S = 1, pxD = 1;   // pxD: 1 cihaz pikseli (dunya birimi)
  var DAL_TAVAN = 24, DAL_PAY = 0.3, dalAnahtar = [], dalTuval = [], dalSira = [], dalSayac = 0;   // dal sprite onbellegi (sinirli LRU)
  // kare basina ayirma olmasin diye hazir nesneler
  var kc = null, kctx = null, karanlikGrad = null, karanlikRenkStr = '';
  var katmanlar = [null, null, null, null];   // bolge -> [tuval, tuval, tuval]
  var sprBocek = null, sprToz = null, sprKivilcim = null, sprBomba = null, sprBombaHale = null;
  var paletAnahtar = '', bocekParlak = '#FFFFFF';
  var gecis = 1, eskiBolge = 0, oncekiBolge = 0;       // arka plan capraz gecisi
  var izM = new Float32Array(IZ_ORNEK + 2), izY = new Float32Array(IZ_ORNEK + 2), izN = 0, izBas = 0;
  var parc = new Float32Array(PARCACIK_TAVAN * 7);   // x, y, vx, vy, yas, omur, bomba(0/1)
  var parcBirikim = 0;
  var sonHud = { puan: -1, rekor: -1, carpan: -1, isik: -1 };

  // ---------------------------------------------------------------
  // YARDIMCILAR
  // ---------------------------------------------------------------
  function fx() { return window.AppFX || null; }
  function ton(a, b, sure, tip, guc) { var f = fx(); if (f) f.tone(a, b, sure, tip, guc); }
  function dizi(notalar, tip) { var f = fx(); if (f) f.seq(notalar, tip); }
  function titret(p) { var f = fx(); if (f) f.vibrate(p); }
  function yaz(n) { return n.toLocaleString('tr-TR'); }
  function azHareket() {
    var p = document.querySelector('.phone');
    if (p) return p.classList.contains('reduced-motion');       // core.js sistem tercihini de icerir
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function bugun() {                  // market.js bugun() ile ayni bicim
    var d = new Date(), a = d.getMonth() + 1, g = d.getDate();
    return d.getFullYear() + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g;
  }
  function hexMi(s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); }
  function hexAyir(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function hexYap(r, g, b) {
    function t(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + t(r) + t(g) + t(b);
  }
  function karistir(a, b, t) {
    var x = hexAyir(a), y = hexAyir(b);
    return hexYap(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function rgba(h, a) { var x = hexAyir(h); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }
  function tohumUret() { return (Date.now() ^ (Math.random() * 4294967296)) >>> 0; }

  // ---------------------------------------------------------------
  // PALET — tek giris noktasi (C asamasinda AppMarket.isikCoz gelir)
  // ---------------------------------------------------------------
  function paletTamamla(p) {
    var o = { iz: {} }, iz = (p && p.iz) || {}, y = YERLESIK;
    ['isik', 'toz', 'vurgu', 'karanlik'].forEach(function (a) { o[a] = p && hexMi(p[a]) ? p[a] : y[a]; });
    o.iz.renk = hexMi(iz.renk) ? iz.renk : y.iz.renk;
    o.iz.renk2 = hexMi(iz.renk2) ? iz.renk2 : o.iz.renk;
    o.iz.sekil = IZ_SEKILLER[iz.sekil] === 1 ? iz.sekil : 'cizgi';
    o.iz.renkler = [o.iz.renk, o.iz.renk2];
    if (Array.isArray(iz.renkler) && iz.renkler.length > 0 && iz.renkler.every(hexMi)) o.iz.renkler = iz.renkler.slice();
    o.animasyon = p && typeof p.animasyon === 'string' ? p.animasyon : '';
    return o;
  }
  function paletOku() {
    var p;
    try {
      p = window.AppMarket && AppMarket.isikCoz ? AppMarket.isikCoz(AppMarket.aktif('ates', 'isik')) : YERLESIK;
    } catch (e) { p = YERLESIK; }
    return paletTamamla(p);
  }

  // ---------------------------------------------------------------
  // ONBELLEKLI GORSELLER (tema ya da boyut degisince yeniden kurulur)
  // ---------------------------------------------------------------
  function yeniTuval(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function parilti(yaricapDunya, renk) {
    var r = Math.max(2, Math.ceil(yaricapDunya * S)), c = yeniTuval(r * 2, r * 2), x = c.getContext('2d');
    var g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(renk, 0.85)); g.addColorStop(0.35, rgba(renk, 0.32)); g.addColorStop(1, rgba(renk, 0));
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  function rastgele(tohum) {
    var s = tohum >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  // tum sekiller 3 kopya (x-W, x, x+W): yatay dikissiz dosenir
  function sarmal(c, fn) {
    for (var k = -1; k <= 1; k++) { c.save(); c.translate(k * W, 0); fn(); c.restore(); }
  }
  function elips(c, x, y, rx, ry, renk, a, rot) {
    c.globalAlpha = a; c.fillStyle = renk; c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); c.fill(); c.globalAlpha = 1;
  }
  function sivri(c, x, gen, boy, yukaridan, renk) {
    c.fillStyle = renk; c.beginPath();
    if (yukaridan) { c.moveTo(x - gen / 2, 0); c.lineTo(x + gen / 2, 0); c.lineTo(x, boy); }
    else { c.moveTo(x - gen / 2, H); c.lineTo(x + gen / 2, H); c.lineTo(x, H - boy); }
    c.fill();
  }

  // Isik huzmesi: tepeden egimli yamuk, alta dogru sonen (gradyan yalniz tuval kurulurken olusur).
  function huzme(c, x, ust, alt, kayma, boy, renk, a) {
    var g = c.createLinearGradient(0, 0, 0, boy);
    g.addColorStop(0, rgba(renk, a)); g.addColorStop(1, rgba(renk, 0));
    c.fillStyle = g; c.beginPath();
    c.moveTo(x - ust / 2, 0); c.lineTo(x + ust / 2, 0); c.lineTo(x + kayma + alt / 2, boy); c.lineTo(x + kayma - alt / 2, boy);
    c.closePath(); c.fill();
  }
  // Yatay sis bandi: tam genislik (dikissiz doser), ortada yogun
  function sisBandi(c, y0, y1, renk, a) {
    var g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, rgba(renk, 0)); g.addColorStop(0.5, rgba(renk, a)); g.addColorStop(1, rgba(renk, 0));
    c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
  }
  // Uzak ates bocegi / isiltili nokta: statik, kucuk ve soluk (toz sanilmasin)
  function uzakNokta(c, x, y, r, renk, a) {
    sarmal(c, function () { elips(c, x, y, r * 3, r * 3, renk, a * 0.22, 0); elips(c, x, y, r, r, renk, a, 0); });
  }

  // Bir bolgenin bir paralaks katmani (dunya birimiyle; c olcekli).
  // Derinlik: kat 0 uzak (soluk mavimsi), kat 1 orta, kat 2 yakin (koyu siluet). Tum renkler acik'tan (zemin + %15 beyaz) koyu kalir.
  function katmanCiz(c, bolge, kat, zemin) {
    var r = rastgele(bolge * 31 + kat * 7 + 11), i, x, y, n, w;
    var koyu = karistir(zemin, '#000000', kat === 0 ? 0.15 : 0.07), acik = karistir(zemin, '#FFFFFF', 0.15);
    var uzak = karistir(zemin, UZAK_MAVI, KATMAN.uzak), yakin = karistir(zemin, '#000000', KATMAN.yakin), nokta = karistir(zemin, pal.vurgu, KATMAN.mantarKap);
    var renk = kat === 2 ? yakin : (kat === 0 ? uzak : koyu);
    if (kat === 0) { c.fillStyle = zemin; c.fillRect(0, 0, W, H); }
    c.lineCap = 'round';
    if (bolge === 0) {                                   // gece ormani
      if (kat < 2) {
        n = kat === 0 ? 9 : 5;
        for (i = 0; i < n; i++) {
          x = (i + r() * 0.6) * W / n; w = (kat === 0 ? 1.8 : 2.2) + r() * 1.5;
          sarmal(c, function () { c.fillStyle = renk; c.fillRect(x - w / 2, 0, w, H); });
          if (kat === 1) {                               // yan dal
            y = 20 + r() * 40; var dy = (r() - 0.5) * 8, dx = (r() < 0.5 ? -1 : 1) * (4 + r() * 4);
            sarmal(c, function () { c.strokeStyle = renk; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, y + dy - 6); c.stroke(); });
          }
        }
        if (kat === 0) {
          for (i = 0; i < 4; i++) huzme(c, 6 + i * 13 + r() * 5, 1 + r(), 3 + r() * 3, 6 + r() * 6, 80, acik, KATMAN.huzme);
          for (i = 0; i < 7; i++) uzakNokta(c, r() * W, 20 + r() * 60, 0.22, nokta, 0.7);
        } else sisBandi(c, 62, 100, acik, KATMAN.sisBant);
      } else {
        for (i = 0; i < 12; i++) {                       // yaprak kumeleri: ustte asili, altta egrelti
          x = r() * W; y = i % 2 ? 1 + r() * 8 : H - 1 - r() * 6; w = 2 + r() * 2; var ry = 1 + r(), rot = r() * 3;
          sarmal(c, function () { elips(c, x, y, w, ry, renk, 0.95, rot); });
        }
        c.strokeStyle = renk; c.lineWidth = 0.55;
        for (i = 0; i < 9; i++) {                        // egrelti kollari
          x = r() * W; var kol = 3 + r() * 5, e0 = r() - 0.5;
          sarmal(c, function () {
            c.beginPath();
            c.moveTo(x, H); c.quadraticCurveTo(x - 2 + e0 * 4, H - kol, x - 4 + e0 * 6, H - kol - 2);
            c.moveTo(x, H); c.quadraticCurveTo(x + 2 + e0 * 4, H - kol, x + 4 + e0 * 6, H - kol - 2);
            c.moveTo(x, H); c.lineTo(x + e0 * 2, H - kol - 3);
            c.stroke();
          });
        }
      }
    } else if (bolge === 1) {                            // mantar magarasi
      if (kat < 2) {
        n = kat === 0 ? 8 : 10;
        for (i = 0; i < n; i++) {
          x = (i + r() * 0.7) * W / n; w = 4 + r() * 5;
          var bo = (kat === 0 ? 16 : 9) + r() * 14, ust = i % 2 === 0;
          sarmal(c, function () { sivri(c, x, w, bo, ust, renk); });
        }
        if (kat === 0) {
          huzme(c, 14 + r() * 8, 1.4, 6, -3, 70, acik, KATMAN.huzme * 0.8);
          huzme(c, 34 + r() * 8, 1, 5, 4, 60, acik, KATMAN.huzme * 0.7);
          for (i = 0; i < 8; i++) uzakNokta(c, r() * W, 4 + r() * 30, 0.2, nokta, 0.8);       // tavan kurtlari
        } else sisBandi(c, 66, 100, acik, KATMAN.sisBant);
      } else {
        var kap = karistir(zemin, pal.vurgu, KATMAN.mantarKap);
        for (i = 0; i < 4; i++) { x = (i + r() * 0.7) * W / 4; w = 3 + r() * 3; var bo2 = 6 + r() * 7; sarmal(c, function () { sivri(c, x, w, bo2, false, renk); }); }
        for (i = 0; i < 3; i++) { x = (i + r() * 0.7) * W / 3; w = 3 + r() * 2; var bo3 = 4 + r() * 4; sarmal(c, function () { sivri(c, x, w, bo3, true, renk); }); }
        for (i = 0; i < 7; i++) {
          x = r() * W; w = 1.4 + r() * 1.6; y = H - 1;
          sarmal(c, function () {
            c.fillStyle = koyu; c.fillRect(x - 0.3, y - w * 1.6, 0.6, w * 1.6);
            elips(c, x, y - w * 1.6, w * 1.6, w * 0.9, rgba(pal.vurgu, KATMAN.mantarHale), 1, 0);
            c.fillStyle = kap; c.beginPath(); c.ellipse(x, y - w * 1.6, w, w * 0.7, 0, Math.PI, 0); c.fill();
          });
        }
      }
    } else if (bolge === 2) {                            // nehir kiyisi
      if (kat === 0) {
        n = 6;                                           // uzak tepeler (soluk mavi siluet), uc uca dikissiz
        var ys = [];
        for (i = 0; i < n; i++) ys.push(46 + r() * 14);
        c.fillStyle = uzak; c.beginPath(); c.moveTo(0, H);
        for (i = 0; i <= n; i++) c.lineTo(i * W / n, ys[i % n]);
        c.lineTo(W, H); c.closePath(); c.fill();
        elips(c, 33, 16, 12, 12, acik, 0.07, 0);
        elips(c, 33, 16, 6, 6, karistir(zemin, '#FFFFFF', KATMAN.ay), 1, 0);
        huzme(c, 33, 3, 10, -4, 70, acik, KATMAN.huzme * 0.6);
      } else if (kat === 1) {
        c.strokeStyle = acik; c.globalAlpha = 0.5; c.lineWidth = 0.35;
        for (i = 0; i < 16; i++) {
          x = r() * W; y = 52 + r() * 40; w = 5 + r() * 8;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); });
        }
        c.globalAlpha = 1;
        sisBandi(c, 44, 66, acik, KATMAN.sisBant);
      } else {
        c.strokeStyle = renk; c.lineWidth = 0.5;
        for (i = 0; i < 22; i++) {
          x = r() * W; y = 8 + r() * 14; w = (r() - 0.5) * 3;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + w * 0.2, H - y * 0.6, x + w, H - y); c.stroke(); });
          if (i % 3 === 0) sarmal(c, function () { elips(c, x + w, H - y, 0.35, 1.1, renk, 1, 0); });   // sazlik basi
        }
      }
    } else {                                             // sisli bataklik
      if (kat === 0) {
        for (i = 0; i < 5; i++) { x = (i + 0.5) * W / 5; y = 8 + r() * 6; sarmal(c, function () { elips(c, x, H, 14, y, renk, 1, 0); }); }
        c.strokeStyle = renk; c.lineWidth = 0.7;
        for (i = 0; i < 6; i++) {                        // uzak olu agaclar
          x = r() * W; y = 30 + r() * 20; w = (r() - 0.5) * 3;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, H - 8); c.lineTo(x + w, y); c.moveTo(x + w * 0.6, y + 8); c.lineTo(x + w + 2.5, y + 3); c.stroke(); });
        }
        huzme(c, 25, 3, 12, 2, 60, acik, KATMAN.huzme * 0.5);
        for (i = 0; i < 5; i++) uzakNokta(c, r() * W, 40 + r() * 40, 0.22, nokta, 0.8);       // bataklik isiklari
      } else if (kat === 1) {
        c.strokeStyle = renk; c.lineWidth = 1.1;
        for (i = 0; i < 7; i++) {
          x = (i + r() * 0.6) * W / 7; y = 24 + r() * 18; w = (r() - 0.5) * 8;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + w, y * 0.3, x - w, y * 0.7, x + w * 0.5, y); c.stroke(); });
        }
        sisBandi(c, 56, 90, acik, KATMAN.sisBant);
      } else {
        var sis = karistir(zemin, '#FFFFFF', KATMAN.sis);
        for (i = 0; i < 6; i++) {
          x = r() * W; y = 12 + r() * 76; w = 10 + r() * 6; var ry2 = 1.6 + r();
          sarmal(c, function () { elips(c, x, y, w, ry2, sis, KATMAN.sisAlfa, 0); });
        }
        c.strokeStyle = renk; c.lineWidth = 0.9;
        for (i = 0; i < 4; i++) {
          x = r() * W; w = (r() - 0.5) * 6; y = 16 + r() * 6;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + w, H - 8, x + w * 0.4, H - y); c.stroke(); });
        }
      }
    }
  }

  var ARKA_DPR = 1.5;                 // arka plan cozunurlugu (bellek icin cihaz DPR'inden dusuk)
  function bolgeKur(b) {              // yalniz ilk gerektiginde; bir kez cizilir
    var zemin = karistir(BOLGE_TON[b], pal.isik, ISIK_KARISIM);
    var d = Math.min(dpr, ARKA_DPR), tw = Math.round(olcek * W * d), th = Math.round(olcek * H * d), k, c, x, set = [];
    for (k = 0; k < 3; k++) {
      c = yeniTuval(tw, th); x = c.getContext('2d');
      x.scale(tw / W, th / H);
      katmanCiz(x, b, k, zemin);
      set.push(c);
    }
    katmanlar[b] = set;
  }

  // Bomba sprite'i: koyu kure + sabit acik kenar + diken; toplam yaricap = R_BOMBA (gorsel = carpisma).
  // Sprite yarisi = R_BOMBA, merkez (R, R). Cekirdek her karede ayri cizilir (nabiz).
  function bombaSprite() {
    var R = M.R_BOMBA, r = Math.max(2, Math.ceil(R * S)), c = yeniTuval(r * 2, r * 2), x = c.getContext('2d'), i, a, k = r / R;
    var bant = Math.max(0.22, pxD), dis = 0.26 + 2 * bant, uc = Math.min(R * 0.74, R - dis / 2 - 0.02);   // koyu dis kontur bandi >= 1 cihaz pikseli; uc kenar kalinligi dahil <= R_BOMBA
    x.scale(k, k); x.translate(R, R);
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.fillStyle = ENGEL_DOLGU; x.strokeStyle = BOMBA_KENAR; x.lineWidth = 0.26;
    x.beginPath();
    for (i = 0; i < BOMBA_DIKEN * 2; i++) {                       // dikenli dis hat: kenar kalinligi dahil en uc <= R_BOMBA
      a = i * Math.PI / BOMBA_DIKEN - Math.PI / 2;
      var rr = i % 2 ? R * 0.55 : uc;
      if (i) x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath(); x.fill();
    x.strokeStyle = ENGEL_DOLGU; x.lineWidth = dis; x.stroke();                                // koyu dis kontur (>= 1 px): acik kenar her zeminde ayrisir
    x.strokeStyle = BOMBA_KENAR; x.lineWidth = 0.26; x.stroke();
    x.lineWidth = 0.14; x.beginPath();                            // catlak cizgileri
    x.moveTo(-R * 0.45, -R * 0.2); x.lineTo(-R * 0.15, -R * 0.05); x.moveTo(R * 0.4, R * 0.25); x.lineTo(R * 0.12, R * 0.12);
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.16)'; x.beginPath(); x.arc(-R * 0.3, -R * 0.3, R * 0.2, 0, 6.2832); x.fill();     // parlak leke (kure hissi)
    return c;
  }
  // Bomba tehlike halesi: disli (sivri) halka + yumusak tehlike isigi. Yalniz gorsel; carpisma degildir. Tozun yuvarlak halesinden sekilce farkli.
  function bombaHaleSprite() {
    var R = M.R_BOMBA, ro = R * 2.2, r = Math.max(2, Math.ceil(ro * S)), c = yeniTuval(r * 2, r * 2), x = c.getContext('2d'), i, a, rr, g, k = r / ro;
    x.scale(k, k); x.translate(ro, ro);
    g = x.createRadialGradient(0, 0, R * 0.8, 0, 0, ro);
    g.addColorStop(0, rgba(BOMBA_CEKIRDEK, 0.4)); g.addColorStop(1, rgba(BOMBA_CEKIRDEK, 0));
    x.fillStyle = g; x.fillRect(-ro, -ro, ro * 2, ro * 2);
    x.strokeStyle = BOMBA_KENAR; x.lineWidth = 0.16; x.lineJoin = 'round'; x.beginPath();
    for (i = 0; i < 24; i++) {                                    // 12 sivri disli halka (en uc < 2,2 R)
      a = i * Math.PI / 12; rr = i % 2 ? R * 1.5 : R * 2.0;
      if (i) x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath(); x.stroke();
    return c;
  }

  function gorselKur() {
    var k;
    if (cssW <= 0 || cssH <= 0) return;
    katmanlar = [null, null, null, null];
    for (k = 0; k < DAL_TAVAN; k++) { dalAnahtar[k] = -1; dalSira[k] = 0; dalTuval[k] = null; }   // olcek / dpr / tema degisti: dal onbellegi temizlenir
    sprBocek = parilti(M.R_GORSEL * 4, pal.isik);
    sprToz = parilti(M.R_TOZ_GORSEL * 3.2, pal.toz);
    sprKivilcim = parilti(M.R_KIVILCIM_GORSEL * 3, pal.vurgu);
    sprBomba = bombaSprite();
    sprBombaHale = bombaHaleSprite();
    bocekParlak = karistir(pal.isik, BOCEK_KANAT, 0.55);
    kc = yeniTuval(W * S, H * S); kctx = kc.getContext('2d');
    karanlikGrad = kctx.createRadialGradient(0, 0, 0, 0, 0, AD.KARARTMA);
    karanlikGrad.addColorStop(0, 'rgba(0,0,0,1)');
    karanlikGrad.addColorStop(1 / AD.KARARTMA, 'rgba(0,0,0,1)');
    karanlikGrad.addColorStop(1, 'rgba(0,0,0,0)');
    karanlikRenkStr = rgba(pal.karanlik, KARANLIK_OPAKLIK);
    for (k = 0; k < katmanlar.length; k++) bolgeKur(k);     // hepsi onceden: bolge gecisinde takilma olmasin
    paletAnahtar = JSON.stringify(pal);
    ekran.style.setProperty('--ab-vurgu', pal.vurgu);
    ekran.style.setProperty('--ab-isik', pal.isik);
    ekran.style.setProperty('--ab-karanlik', pal.karanlik);
  }

  function boyutla() {
    var r = alan.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var yeniDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cssW && r.width === cssW && r.height === cssH && yeniDpr === dpr) return true;   // boyut degismedi: yeniden kurma
    dpr = yeniDpr;
    cssW = r.width; cssH = r.height;
    olcek = Math.min(cssW / W, cssH / H);
    ox = (cssW - W * olcek) / 2; oy = (cssH - H * olcek) / 2;
    S = olcek * dpr; pxD = 1 / S;
    tuval.width = Math.round(cssW * dpr); tuval.height = Math.round(cssH * dpr);
    gorselKur();
    return true;
  }

  // ---------------------------------------------------------------
  // CIZIM
  // ---------------------------------------------------------------
  // Dal sprite'i: sabit (w, h, yon) icin bir kez cizilir; kare basina yol komutu uretilmez. h 0,5 birime yuvarlanir (cizim e.h'ye gerilir).
  function dalSprite(w, h, tavan, v) {
    var hq = Math.max(1, Math.round(h * 2) / 2), key = ((Math.round(hq * 2) * 64 + Math.round(w * 4)) * 2 + (tavan ? 1 : 0)) * 3 + v, i, yer = 0, en = 1e12, c, x, pw, ph, bw = w + 2 * DAL_PAY, bh = hq + 2 * DAL_PAY;
    dalSayac++;
    for (i = 0; i < DAL_TAVAN; i++) if (dalAnahtar[i] === key) { dalSira[i] = dalSayac; return dalTuval[i]; }
    for (i = 0; i < DAL_TAVAN; i++) if (dalSira[i] < en) { en = dalSira[i]; yer = i; }
    pw = Math.max(1, Math.ceil(bw * S)); ph = Math.max(1, Math.ceil(bh * S));
    c = dalTuval[yer]; if (!c) c = dalTuval[yer] = yeniTuval(pw, ph);
    c.width = pw; c.height = ph;                                  // yeniden boyutlama canvas'i temizler
    x = c.getContext('2d');
    x.scale(pw / bw, ph / bh); x.translate(DAL_PAY, DAL_PAY);
    x.lineWidth = KENAR_PX / olcek; x.lineJoin = 'round'; x.lineCap = 'round'; x.fillStyle = ENGEL_DOLGU; x.strokeStyle = ENGEL_KENAR;
    dalCiz(x, 0, 0, w, hq, tavan, v * 2 + 1);                      // v: 3 desen varyanti (kabuk / diken ritmi)
    dalAnahtar[yer] = key; dalSira[yer] = dalSayac;
    return c;
  }
  function dalCizSprite(c, e, tavan) { c.drawImage(dalSprite(e.w, e.h, tavan, Math.floor(e.x) % 3), e.x - DAL_PAY, e.y - DAL_PAY, e.w + 2 * DAL_PAY, e.h + 2 * DAL_PAY); }

  // Dikenli dal: kabuk dokulu, hafif egri govde, egri dikenler, budak. tavan: bagli uc ustte, serbest uc altta.
  // Cizim zarfi = carpma zarfi (x..x+w, y..y+h); dikenler yan sinira (x, x+w) kadar uzanir.
  function dalCiz(c, x, y, w, h, tavan, tohum) {
    var cx = x + w / 2, hw0 = w * 0.21, y0 = tavan ? y : y + h, dir = tavan ? 1 : -1, uz = h - 0.8, s, yan, k, n, t, hw, sd = tohum === undefined ? Math.floor(x * 13) % 7 : tohum, ex, tx, lw = c.lineWidth, uzn;
    n = Math.max(2, Math.ceil(uz / 5));
    c.beginPath();
    c.moveTo(cx - hw0, y0);
    for (k = 1; k <= n; k++) {                               // sol kenar: dalgali, uca dogru incelir
      t = k / n; hw = hw0 * (1 - 0.5 * t) + Math.sin(k * 2.1 + sd) * 0.16;
      c.quadraticCurveTo(cx - hw - 0.25, y0 + dir * uz * (t - 0.5 / n), cx - hw, y0 + dir * uz * t);
    }
    for (k = n; k >= 0; k--) {                               // sag kenar geri
      t = k / n; hw = hw0 * (1 - 0.5 * t) + Math.sin(k * 1.7 + sd + 2) * 0.16;
      c.quadraticCurveTo(cx + hw + 0.25, y0 + dir * uz * (t + 0.5 / n), cx + hw, y0 + dir * uz * t);
    }
    c.closePath();
    for (s = 2.2, yan = 0; s < uz - 1; s += 3.4, yan ^= 1) {  // egri dikenler (yanlari sirayla)
      uzn = 1.6 + ((s * 7 + sd) % 3) * 0.2;
      hw = hw0 * (1 - 0.5 * s / uz); ex = yan ? cx + hw : cx - hw; tx = yan ? x + w : x;
      c.moveTo(ex, y0 + dir * s);
      c.quadraticCurveTo(ex + (yan ? 1 : -1) * w * 0.18, y0 + dir * (s + 0.2), tx, y0 + dir * (s + uzn));
      c.quadraticCurveTo(ex + (yan ? 1 : -1) * w * 0.08, y0 + dir * (s + uzn - 0.2), ex, y0 + dir * (s + 2.5));
      c.closePath();
    }
    c.moveTo(cx + w * 0.26, y0 + dir * (h - w * 0.26));
    c.arc(cx, y0 + dir * (h - w * 0.26), w * 0.26, 0, 6.2832);   // uc budagi
    c.fill(); c.stroke();
    c.globalAlpha = 0.5; c.lineWidth = lw * 0.55; c.beginPath();  // kabuk cizgileri
    for (s = 3; s < uz - 2; s += 3.1) {
      hw = hw0 * (1 - 0.5 * s / uz);
      c.moveTo(cx - hw * 0.6, y0 + dir * s); c.lineTo(cx + hw * 0.2, y0 + dir * (s + 1.1));
    }
    c.stroke();
    c.beginPath(); c.ellipse(cx + hw0 * 0.15, y0 + dir * uz * 0.42, 0.5, 0.34, 0.5, 0, 6.2832); c.stroke();   // budak
    c.globalAlpha = 1; c.lineWidth = lw;
  }

  function agT(hw, hh, a) {           // merkezden a yonunde dikdortgen kenarina uzaklik
    var co = Math.cos(a), si = Math.sin(a);
    return Math.min(Math.abs(co) > 1e-6 ? hw / Math.abs(co) : 1e9, Math.abs(si) > 1e-6 ? hh / Math.abs(si) : 1e9);
  }
  // Orumcek agi: dis cerceve (carpma zarfi) normal kalinlikta, ipler ince ve sarkik, cig damlalari isildar.
  function agCiz(c, e) {
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2, hw = e.w / 2, hh = e.h / 2, i, q, a, am, t, tm, f, lw = c.lineWidth;
    c.globalAlpha = 0.3; c.fillStyle = ENGEL_DOLGU; c.fillRect(e.x, e.y, e.w, e.h); c.globalAlpha = 1;
    c.beginPath(); c.rect(e.x, e.y, e.w, e.h); c.stroke();
    c.lineWidth = lw * 0.55; c.globalAlpha = 0.9; c.beginPath();
    for (i = 0; i < 8; i++) { a = i * Math.PI / 4; t = agT(hw, hh, a); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * t, cy + Math.sin(a) * t); }
    for (q = 1; q <= 3; q++) {                                    // sarkik halkalar
      f = q / 3.4;
      c.moveTo(cx + hw * f, cy);
      for (i = 1; i <= 8; i++) {
        a = i * Math.PI / 4; am = a - Math.PI / 8; t = agT(hw, hh, a) * f; tm = agT(hw, hh, am) * f * 0.86;
        c.quadraticCurveTo(cx + Math.cos(am) * tm, cy + Math.sin(am) * tm, cx + Math.cos(a) * t, cy + Math.sin(a) * t);
      }
    }
    c.stroke();
    c.fillStyle = ENGEL_KENAR; c.globalAlpha = azHareketOn ? 0.75 : 0.55 + 0.35 * Math.sin(zaman * 3 + e.x);
    c.beginPath();
    for (i = 0; i < 8; i += 2) { a = (i + 1) * Math.PI / 4; t = agT(hw, hh, a) * 0.62; c.moveTo(cx + Math.cos(a) * t + 0.3, cy + Math.sin(a) * t); c.arc(cx + Math.cos(a) * t, cy + Math.sin(a) * t, 0.3, 0, 6.2832); }
    c.fill();
    c.fillStyle = ENGEL_DOLGU; c.globalAlpha = 1; c.lineWidth = lw;
  }

  // Kus: govde + bas + gaga + kuyruk; iki kanat (yakin ve uzak) yumusak cirpar (zarf: e.x..e.x+w, e.y..e.y+h).
  function kusCiz(c, e) {
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2, ph = azHareketOn ? 0.6 : Math.sin(zaman * 22), uc = cy - ph * (e.h / 2 - 0.1), uc2 = cy + ph * (e.h / 2 - 0.45), lw = c.lineWidth;
    c.beginPath();                                                           // uzak kanat (arkada, ters fazda)
    c.moveTo(cx - 0.4, cy - 0.1); c.quadraticCurveTo(cx, uc2, cx + 1.2, uc2); c.lineTo(cx + 0.7, cy + (uc2 - cy) * 0.5); c.lineTo(cx + 0.5, cy + 0.1);
    c.globalAlpha = 0.7; c.fill(); c.stroke(); c.globalAlpha = 1;
    c.beginPath();
    c.ellipse(cx + 0.2, cy, 1.6, 0.9, 0, 0, 6.2832);                       // govde
    c.moveTo(cx - 1.2, cy - 0.2); c.arc(cx - 1.5, cy - 0.2, 0.65, 0, 6.2832);   // bas (sola bakar)
    c.moveTo(cx - 2.1, cy - 0.35); c.lineTo(e.x, cy); c.lineTo(cx - 2.1, cy + 0.1);   // gaga
    c.moveTo(cx + 1.6, cy - 0.3); c.lineTo(e.x + e.w, cy - 0.7); c.lineTo(cx + 1.6, cy + 0.4);   // kuyruk
    c.moveTo(cx - 0.7, cy - 0.1); c.quadraticCurveTo(cx - 0.3, uc, cx + 1.7, uc);       // yakin kanat: ucu tuylu
    c.lineTo(cx + 1.1, uc + (cy - uc) * 0.35); c.lineTo(cx + 1.4, uc + (cy - uc) * 0.55); c.lineTo(cx + 0.7, cy + 0.1);
    c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = ENGEL_KENAR; c.beginPath(); c.arc(cx - 1.65, cy - 0.35, 0.16, 0, 6.2832); c.fill();   // goz
    c.fillStyle = ENGEL_DOLGU;
  }

  function yaprakYol(c, x, y, rx, ry, rot) {      // yaprak (elips) alt yolu; onceki noktaya cizgi cekmez
    c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); c.ellipse(x, y, rx, ry, rot, 0, 6.2832);
  }

  function engelCiz(c, e) {
    var a, mx, yy, k, lw;
    if (e.tur === 'dal') dalCizSprite(c, e, e.yon === 'ust');
    else if (e.tur === 'ag') agCiz(c, e);
    else if (e.tur === 'kus') kusCiz(c, e);
    else if (e.tur === 'dusen') {
      mx = e.x + e.w / 2; lw = c.lineWidth;                                                      // sarmasik ipi: dalgali, yapraklarla
      c.beginPath(); c.moveTo(mx, 0);
      for (yy = 2.5; yy < e.y; yy += 2.5) c.lineTo(mx + Math.sin(yy * 0.9 + e.x) * 0.3, yy);
      c.lineTo(mx, e.y);
      c.strokeStyle = ENGEL_DOLGU; c.lineWidth = lw * 2.6; c.stroke();
      c.strokeStyle = ENGEL_KENAR; c.lineWidth = lw * 0.8; c.stroke();
      c.lineWidth = lw * 0.8; c.beginPath();
      for (yy = 3.5, k = 0; yy < e.y - 1; yy += 5, k++) yaprakYol(c, mx + (k & 1 ? 0.7 : -0.7), yy, 0.55, 0.26, (k & 1 ? 1 : -1) * 0.7);
      c.fill(); c.stroke();
      c.lineWidth = lw;
      a = e.faz === 1 && !azHareketOn ? Math.sin(zaman * 60) * 0.052 : 0;                      // +-3 derece
      c.save(); c.translate(e.x + e.w / 2, e.y); c.rotate(a); c.translate(-(e.x + e.w / 2), -e.y);
      dalCizSprite(c, e, true);
      c.restore();
    }
  }

  function yildizCiz(c, x, y, r, rot) {
    var i, a, rr;
    c.beginPath();
    for (i = 0; i < 8; i++) {
      a = rot + i * Math.PI / 4; rr = i % 2 ? r * 0.35 : r;
      if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
  }

  function izNokta(i) { return (izBas + i) % IZ_ORNEK; }
  function izCiz(c) {
    var n = izN, i, j, k, x0, y0, x1, y1, r, iz = pal.iz, mesafe = durum.mesafe;
    if (n < 2) return;
    var px = 1 / olcek;                      // 1 css px = px dunya birimi
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (iz.sekil === 'cizgi' || iz.sekil === 'akkor') {
      var gen = iz.sekil === 'akkor' ? (azHareketOn ? 3 : 3 + Math.sin(zaman * 8)) : 2, tur;
      for (tur = 0; tur < (iz.sekil === 'akkor' ? 2 : 1); tur++) {
        c.strokeStyle = tur === 0 ? iz.renk : iz.renk2;
        c.lineWidth = (tur === 0 ? gen : gen * 0.45) * px;
        for (i = 1; i < n; i++) {
          j = izNokta(i - 1); k = izNokta(i);
          c.globalAlpha = IZ_ALFA * i / n;
          c.beginPath(); c.moveTo(XB - (mesafe - izM[j]), izY[j]); c.lineTo(XB - (mesafe - izM[k]), izY[k]); c.stroke();
        }
      }
      c.globalAlpha = 1;
      return;
    }
    // damga sekilleri: damla 6 px, baklava 7 px arayla
    var arayla = (iz.sekil === 'damla' ? 6 : 7) * px, birikmis = 0, sira = 0, rr = (iz.sekil === 'damla' ? 2.2 : 2.6) * px;
    var renkler = iz.renkler;
    x1 = XB - (mesafe - izM[izNokta(n - 1)]); y1 = izY[izNokta(n - 1)];
    for (i = n - 1; i >= 0; i--) {
      j = izNokta(i);
      x0 = XB - (mesafe - izM[j]); y0 = izY[j];
      birikmis += Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1)); x1 = x0; y1 = y0;
      if (birikmis < arayla) continue;
      birikmis -= arayla;
      c.globalAlpha = IZ_ALFA * (i + 1) / n;
      c.fillStyle = renkler[sira % renkler.length]; sira++;
      c.beginPath();
      if (iz.sekil === 'damla') {
        r = rr;
        c.moveTo(x0, y0 - r * 1.8);
        c.bezierCurveTo(x0 + r * 0.6, y0 - r * 0.8, x0 + r, y0 - r * 0.2, x0 + r, y0 + r * 0.5);
        c.arc(x0, y0 + r * 0.5, r, 0, Math.PI, false);
        c.bezierCurveTo(x0 - r, y0 - r * 0.2, x0 - r * 0.6, y0 - r * 0.8, x0, y0 - r * 1.8);
        c.fill();
      } else {
        r = rr;
        c.moveTo(x0, y0 - r * 1.3); c.lineTo(x0 + r, y0); c.lineTo(x0, y0 + r * 1.3); c.lineTo(x0 - r, y0); c.closePath();
        c.fill();
        c.strokeStyle = '#0E1018'; c.lineWidth = 0.6 * px; c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  function parcacikGuncelle(dt, c) {
    var i, o, a, hiz = hizOnbellek, uret = pal.iz.sekil === 'akkor' && !durum.bitti;   // yuvalar lav izi ve bomba patlamasi icin ortak (toplam <= 24)
    if (azHareketOn || dt <= 0) return;
    if (uret) parcBirikim += dt * PARCACIK_HIZ;
    for (i = 0; i < PARCACIK_TAVAN; i++) {
      o = i * 7;
      if (parc[o + 4] >= parc[o + 5]) {                      // bos yuva: gerekiyorsa doldur
        if (uret && parcBirikim >= 1 && i < PARCACIK_TAVAN - PATLAMA_YUVA) {
          parcBirikim -= 1; parc[o + 6] = 0;
          parc[o] = XB - 1; parc[o + 1] = durum.y + (Math.random() - 0.5) * 1.2;
          parc[o + 2] = -(hiz * 0.4 + Math.random() * 10); parc[o + 3] = (Math.random() - 0.5) * 16;
          parc[o + 4] = 0; parc[o + 5] = PARCACIK_OMUR * (0.5 + Math.random() * 0.5);
        } else continue;
      }
      parc[o] += parc[o + 2] * dt; parc[o + 1] += parc[o + 3] * dt; parc[o + 4] += dt;
      if (parc[o + 4] >= parc[o + 5]) continue;
      a = 1 - parc[o + 4] / parc[o + 5];
      if (parc[o + 6] === 2) {                                // yutulan toz: ~0,25 sn alfa sonmesi
        c.globalAlpha = a * 0.8; c.drawImage(sprToz, parc[o] - M.R_TOZ_GORSEL * 3.2, parc[o + 1] - M.R_TOZ_GORSEL * 3.2, M.R_TOZ_GORSEL * 6.4, M.R_TOZ_GORSEL * 6.4);
        continue;
      }
      c.globalAlpha = a * 0.9;
      c.fillStyle = parc[o + 6] ? (i & 1 ? BOMBA_CEKIRDEK : BOMBA_KENAR) : (i & 1 ? pal.iz.renk : pal.iz.renk2);
      c.fillRect(parc[o] - 0.3, parc[o + 1] - 0.3, 0.6, 0.6);
    }
    c.globalAlpha = 1;
    if (parcBirikim > 2) parcBirikim = 2;
  }

  // Sarmasik tozu yuttu: toz ~0,25 sn solarak kaybolur (havuzun bos yuvasi; yuva yoksa aninda). Azaltilmis harekette yok.
  function tozSon(x, y) {
    var i, o;
    if (azHareketOn) return;
    for (i = 0; i < PARCACIK_TAVAN - PATLAMA_YUVA; i++) {                   // bomba patlamasina ayrilmis son yuvalar alinmaz
      o = i * 7;
      if (parc[o + 4] < parc[o + 5]) continue;
      parc[o] = x; parc[o + 1] = y; parc[o + 2] = -hizOnbellek; parc[o + 3] = 0; parc[o + 4] = 0; parc[o + 5] = 0.25; parc[o + 6] = 2;
      return;
    }
  }

  // Bomba toplandi: bos yuvalara en cok 8 parcacik (sinir 24; yuva yoksa daha az). Azaltilmis harekette yok.
  function bombaPatlat(x, y) {
    var i, o, n = 0, a;
    if (azHareketOn) return;
    for (i = PARCACIK_TAVAN - 1; i >= 0 && n < PATLAMA_YUVA; i--) {          // ayrilmis yuvalar (sondakiler) once
      o = i * 7;
      if (parc[o + 4] < parc[o + 5]) continue;
      a = n * Math.PI / 4 + Math.random() * 0.5; n++;
      parc[o] = x; parc[o + 1] = y;
      parc[o + 2] = Math.cos(a) * (18 + Math.random() * 14) - hizOnbellek;     // dunyayla birlikte kayar
      parc[o + 3] = Math.sin(a) * (18 + Math.random() * 14);
      parc[o + 4] = 0; parc[o + 5] = PARCACIK_OMUR * (0.5 + Math.random() * 0.4); parc[o + 6] = 1;
    }
  }

  // Sarmasik govdesinin j. dugum x'i: dalga + salinim (toplam <= 0,45); yapraklarla birlikte sutun zarfina (w/2 = 1,5) en cok ~0,05 tasar
  function sarmasikX(cx, j, n, i, sal) {
    var u = j / n;
    return cx + (Math.sin(j * 1.1 + i * 2) * 0.3 + Math.sin(j * 1.7 + i + zaman * 2.4) * sal) * u;
  }

  // Sarmasik: koklerinden `ilerleme` oraninda uzar; kivrik govde, yapraklar, ucu kivrik filiz (cizim zarfi ~ carpma zarfi).
  function sarmasikCiz(c, sa, mesafe) {
    var i, j, u, n, cx, kok, yon, len, sut, sal, y, yan, kx, tx, ty;
    yon = sa.yon === 'ust' ? 1 : -1;
    for (i = 0; i < sa.sutunlar.length; i++) {
      sut = sa.sutunlar[i];
      kx = sut.x - mesafe;
      if (kx > W + 2 || kx + sut.w < -2) continue;
      cx = kx + sut.w / 2; kok = yon > 0 ? 0 : H;
      len = sut.h * sa.ilerleme; if (len < 0.3) continue;
      n = Math.max(2, Math.ceil(len / 2.2));
      sal = azHareketOn ? 0 : 0.15;
      for (u = 0; u < 2; u++) {                                       // koyu dis cizgi + yesil govde
        c.strokeStyle = u ? SARMASIK_GOVDE : ENGEL_DOLGU; c.lineWidth = u ? 0.7 : 0.7 + 2 * Math.max(0.3, pxD); c.lineCap = 'round';
        c.beginPath(); c.moveTo(cx, kok);
        for (j = 1; j <= n; j++) c.lineTo(sarmasikX(cx, j, n, i, sal), kok + yon * len * j / n);
        c.stroke();
      }
      c.fillStyle = SARMASIK_YAPRAK; c.strokeStyle = ENGEL_DOLGU; c.lineWidth = 2 * Math.max(0.06, pxD);
      c.beginPath();
      for (j = 1; j < n; j++) {                                       // yapraklar (tek yol, tek dolgu): yanlari sirayla
        yan = j % 2 ? 1 : -1; y = kok + yon * len * j / n;
        yaprakYol(c, sarmasikX(cx, j, n, i, sal) + yan * 0.62, y, 0.5, 0.26, yan * yon * 0.7);
      }
      c.fill(); c.stroke();
      tx = sarmasikX(cx, n, n, i, sal); ty = kok + yon * len;          // ucun kivrik filizi
      for (u = 0; u < 2; u++) {
        c.strokeStyle = u ? SARMASIK_GOVDE : ENGEL_DOLGU; c.lineWidth = u ? 0.3 : 0.3 + 2 * Math.max(0.16, pxD);
        c.beginPath(); c.moveTo(tx, ty); c.arc(tx + 0.42, ty + yon * 0.1, 0.42, Math.PI, Math.PI * 2.75); c.stroke();
      }
    }
  }

  // Kendi isigiyla gorunenler: karanlik katmanin USTUNDE cizilir (bomba, sarmasik uyari unlemi).
  // Yontem: karanlik tuvale basildiktan sonra ayni dunya donusumuyle ikinci gecis; kare basina yeni gradyan yok.
  // Dilim onu sinirlamasi yoktur: ufuktaki (ekran disi) sutunun uyarisi, faz 1'e girdigi ilk karede cizilir.
  function ozIsikCiz(c, p) {
    var d = durum, dl = d.dilimler, i, j, s, t, x, y, nabiz, tit, a, mesafe = d.mesafe, sa, e, k, kx, uc, kok, disarda, en, ust, ha;
    if (p >= 1) return;
    for (i = 0; i < dl.length; i++) {
      s = dl[i];
      t = s.bomba;
      if (t && !t.alindi) {
        x = t.x - mesafe;
        if (x > -4 && x < W + 4) {
          a = azHareketOn ? 1 : 0.55 + 0.45 * (Math.floor(zaman * 7) & 1);                    // ~3,5 Hz; azaltilmis harekette sabit
          tit = azHareketOn ? 0 : 0.12;
          nabiz = azHareketOn ? 1 : 0.8 + 0.2 * Math.sin(zaman * 22);
          ha = M.R_BOMBA * 2.2;
          c.save(); c.translate(x + (tit ? Math.sin(zaman * 61) * tit : 0), t.y + (tit ? Math.cos(zaman * 53) * tit : 0));
          if (!azHareketOn) c.rotate(zaman * 0.9);
          c.globalAlpha = (0.35 + 0.35 * a) * (1 - p); c.drawImage(sprBombaHale, -ha, -ha, ha * 2, ha * 2);   // disli tehlike halesi (carpisma degil)
          if (!azHareketOn) c.rotate(-zaman * 0.9);
          c.globalAlpha = 1 - p; c.drawImage(sprBomba, -M.R_BOMBA, -M.R_BOMBA, M.R_BOMBA * 2, M.R_BOMBA * 2);
          c.globalAlpha = a * (1 - p); c.fillStyle = BOMBA_CEKIRDEK;
          c.beginPath(); c.arc(0, 0, M.R_BOMBA * 0.36 * nabiz, 0, 6.2832); c.fill();
          c.restore();
        }
      }
      sa = s.sarmasik;
      if (sa && sa.faz >= 1) {
        ust = sa.yon === 'ust'; en = -1;
        for (j = 0; j < sa.sutunlar.length; j++) {                    // ekran disi sutunlar arasinda en tehlikeli uc (tek unlem icin)
          e = sa.sutunlar[j];
          if (e.x - mesafe > W && (en < 0 || (ust ? e.y + e.h > sa.sutunlar[en].y + sa.sutunlar[en].h : e.y < sa.sutunlar[en].y))) en = j;
        }
        for (j = 0; j < sa.sutunlar.length; j++) {
          e = sa.sutunlar[j];
          kx = e.x - mesafe; uc = ust ? e.y + e.h : e.y; kok = ust ? 0 : H; disarda = kx > W;
          a = azHareketOn ? 1 : 0.8 + 0.2 * Math.sin(zaman * 14);
          if (disarda) {                                              // kenar isareti: ufuktaki sutunun uc seviyesi (faz 1 ve 2)
            c.globalAlpha = 0.75 * (1 - p); c.beginPath(); c.moveTo(W - 2.4, uc); c.lineTo(W, uc);
            c.strokeStyle = ENGEL_DOLGU; c.lineWidth = 0.5 + 2 * Math.max(0.2, pxD); c.stroke();     // koyu alt cizgi
            c.strokeStyle = UNLEM_RENK; c.lineWidth = 0.5; c.stroke();
          } else if (kx + e.w > -2) {                                 // hayalet silüet: tam boy zarf, faz 1-3 boyunca (carpma zarfi = ciz)
            c.globalAlpha = 0.75 * (1 - p); c.setLineDash(SILUET_CIZGI);
            c.beginPath(); c.rect(kx, Math.min(kok, uc), e.w, Math.abs(uc - kok));
            c.strokeStyle = ENGEL_DOLGU; c.lineWidth = 0.3 + 2 * Math.max(0.2, pxD); c.stroke();    // koyu alt cizgi
            c.strokeStyle = UNLEM_RENK; c.lineWidth = 0.3; c.stroke(); c.setLineDash(SILUET_YOK);
            c.beginPath(); c.moveTo(kx - 0.6, uc); c.lineTo(kx + e.w + 0.6, uc);                  // uc isareti
            c.strokeStyle = ENGEL_DOLGU; c.lineWidth = 0.5 + 2 * Math.max(0.2, pxD); c.stroke();
            c.strokeStyle = UNLEM_RENK; c.lineWidth = 0.5; c.stroke();
          }
          if (sa.faz !== 1) continue;
          if (disarda && j !== en) continue;                          // ekran disi sutunlar tek unlemi paylasir
          x = Math.min(kx + e.w / 2, W - 3.2);                           // ekran disindaysa sag kenara kistir
          y = disarda ? Math.max(4, Math.min(H - 4, uc + (ust ? 1 : -1) * (M.R_CARPMA + AD.PAY_KACIS))) : (ust ? 7 : H - 7);   // disarda: kacis seviyesi (uc + carpma + pay)
          if (x < -3) continue;
          k = azHareketOn ? 1 : 1 + 0.14 * Math.sin(zaman * 14);
          c.save(); c.translate(x, y); c.scale(k, k);
          c.globalAlpha = a * (1 - p); c.fillStyle = UNLEM_RENK; c.strokeStyle = ENGEL_DOLGU; c.lineWidth = 2 * Math.max(0.23, pxD / k); c.lineJoin = 'round';
          c.beginPath(); c.moveTo(0, -2.6); c.lineTo(2.5, 1.7); c.lineTo(-2.5, 1.7); c.closePath(); c.fill(); c.stroke();   // ucgen uyari levhasi
          c.fillStyle = ENGEL_DOLGU; c.fillRect(-0.28, -1.1, 0.56, 1.7); c.beginPath(); c.arc(0, 1.0, 0.33, 0, 6.2832); c.fill();   // unlem
          c.restore();
        }
      }
    }
    c.globalAlpha = 1;
  }

  // Bocek: koyu bas + gogus (pronotum) + segmentli karin; karnin arka yarisi tema isigiyla parlayan fener; iki cift yari saydam kanat;
  // koyu kinlar; kivrik antenler; koyu parcalarda ince acik kontur (arka isik) -> parilti icinde de siluet okunur.
  function kanatCiz(c, px, py, rx, ry, s, ust) {
    var th = ust ? Math.PI + s : Math.PI - s;
    c.beginPath(); c.ellipse(px + Math.cos(th) * rx, py + Math.sin(th) * rx, rx, ry, th, 0, 6.2832); c.fill(); c.stroke();
  }
  var BOCEK_KONTUR = 'rgba(255,255,255,0.35)';
  function bocekCiz(c, dt, p) {
    var d = durum, blink = d.dokunulmaz > 0 && (Math.floor(d.t * 12) & 1) === 0, kanat, kanat2, egim, g = sonmeCarpan(p), nb, sw, ters = 1;
    if (!azHareketOn) kanatFaz += dt * (basili && !(d.sersem > 0) ? 88 : 31);       // azaltilmis harekette kanat cirpmasi donuk; sersemken girdi etkisiz
    if (blink && !d.bitti) return;
    kanat = Math.sin(kanatFaz) * 0.6; kanat2 = Math.sin(kanatFaz + 1.1) * 0.6;
    egim = Math.max(-0.5, Math.min(0.5, d.vy * 0.012));
    nb = azHareketOn ? 1 : 0.5 + 0.5 * Math.sin(zaman * 5);      // fener nabzi (azaltilmis harekette sabit)
    sw = azHareketOn ? 0 : Math.sin(zaman * 3.2) * 0.25;         // anten salinimi
    if (zeminDusus()) {                                          // sicrarken sirt ustu doner (dikey takla), sonra ters duser
      ters = Math.cos(Math.PI * Math.min(1, dususT() / ZEMIN_SICRAMA_SN)); if (Math.abs(ters) < 0.05) ters = ters < 0 ? -0.05 : 0.05;
      egim = 0;
    }
    c.save();
    c.translate(XB, bocekY()); c.rotate(egim); if (ters !== 1) c.scale(1, ters);
    c.globalAlpha = (azHareketOn ? 0.85 : 0.75 + 0.2 * Math.sin(zaman * 5)) * g;
    c.drawImage(sprBocek, -M.R_GORSEL * 4, -M.R_GORSEL * 4, M.R_GORSEL * 8, M.R_GORSEL * 8);
    c.scale(M.R_GORSEL / 2.4, M.R_GORSEL / 2.4);                  // asagidaki sabit olculer 2,4 yaricapina gore; gorsel buyudukce birlikte olceklenir
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = BOCEK_KANAT; c.strokeStyle = BOCEK_KANAT; c.lineWidth = 0.08;          // kanatlar: arka cift, on cift
    c.globalAlpha = 0.26 * g; kanatCiz(c, 0.15, -0.25, 1.5, 0.5, 0.75 + kanat2 * 0.9, 1); kanatCiz(c, 0.15, 0.25, 1.5, 0.5, 0.75 + kanat2 * 0.9, 0);
    c.globalAlpha = 0.4 * g; kanatCiz(c, 0.2, -0.3, 1.7, 0.55, 0.55 + kanat * 0.9, 1); kanatCiz(c, 0.2, 0.3, 1.7, 0.55, 0.55 + kanat * 0.9, 0);
    c.globalAlpha = g; c.strokeStyle = BOCEK_KONTUR; c.lineWidth = 0.1;
    c.fillStyle = BOCEK_KOYU; c.beginPath(); c.ellipse(-1.3, 0, 1.45, 0.9, 0, 0, 6.2832); c.fill(); c.stroke();          // karin
    c.globalAlpha = (0.75 + 0.25 * nb) * g; c.fillStyle = pal.isik;                                                    // fener
    c.beginPath(); c.ellipse(-1.95, 0, 0.8 * (1 + 0.08 * nb), 0.62, 0, 0, 6.2832); c.fill();
    c.globalAlpha = (0.6 + 0.4 * nb) * g; c.fillStyle = bocekParlak;
    c.beginPath(); c.ellipse(-2.05, 0, 0.42, 0.3, 0, 0, 6.2832); c.fill();
    c.globalAlpha = 0.55 * g; c.strokeStyle = BOCEK_KOYU; c.lineWidth = 0.09;                                          // karin segmentleri
    c.beginPath(); c.moveTo(-1.75, -0.55); c.lineTo(-1.75, 0.55); c.moveTo(-2.2, -0.45); c.lineTo(-2.2, 0.45); c.stroke();
    c.globalAlpha = g; c.strokeStyle = BOCEK_KONTUR; c.lineWidth = 0.1; c.fillStyle = BOCEK_KIN;                          // kanat kinlari
    c.beginPath(); c.ellipse(-0.45, -0.4, 1.1, 0.44, -0.12, 0, 6.2832); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-0.45, 0.4, 1.1, 0.44, 0.12, 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = BOCEK_PLAKA; c.beginPath(); c.ellipse(0.5, 0, 0.75, 0.68, 0, 0, 6.2832); c.fill(); c.stroke();          // gogus
    c.strokeStyle = BOCEK_KONTUR; c.lineWidth = 0.2;                                                                  // antenler (kontur + koyu)
    c.beginPath(); c.moveTo(1.6, -0.2); c.quadraticCurveTo(2.4, -0.8 + sw, 3.0, -0.75 + sw); c.moveTo(1.6, 0.2); c.quadraticCurveTo(2.4, 0.8 - sw, 3.0, 0.75 - sw);
    c.stroke(); c.strokeStyle = BOCEK_KOYU; c.lineWidth = 0.08; c.stroke();
    c.strokeStyle = BOCEK_KONTUR; c.lineWidth = 0.1; c.fillStyle = BOCEK_KOYU;
    c.beginPath(); c.arc(1.35, 0, 0.5, 0, 6.2832); c.fill(); c.stroke();                                               // bas
    c.fillStyle = bocekParlak; c.globalAlpha = 0.85 * g;
    c.beginPath(); c.arc(1.55, -0.24, 0.1, 0, 6.2832); c.moveTo(1.65, 0.24); c.arc(1.55, 0.24, 0.1, 0, 6.2832); c.fill();   // gozler
    c.restore();
  }

  // Sersemlik (12.1): bocegin basinin ustunde halka + donen yildizlar (tema vurgu rengi). Azaltilmis harekette
  // yildizlar sabit konumda ve donmeden cizilir.
  function sersemCiz(c) {
    var d = durum, i, a, x, y, yt, taban, on;
    if (!(d.sersem > 0) || d.bitti) return;
    yt = d.y - M.R_GORSEL - 1.2; taban = azHareketOn ? -Math.PI / 2 : zaman * SERSEM_DONUS;
    c.save();
    c.globalAlpha = 0.35; c.strokeStyle = pal.vurgu; c.lineWidth = 0.18;
    c.beginPath(); c.ellipse(XB, yt, SERSEM_HALKA_RX, SERSEM_HALKA_RY, 0, 0, 6.2832); c.stroke();
    c.fillStyle = pal.vurgu;
    for (i = 0; i < SERSEM_YILDIZ; i++) {
      a = taban + i * 6.2832 / SERSEM_YILDIZ; x = XB + Math.cos(a) * SERSEM_HALKA_RX; y = yt + Math.sin(a) * SERSEM_HALKA_RY;
      on = Math.sin(a) >= 0;                                    // halkanin onundeki yildiz parlak, arkadaki soluk
      c.globalAlpha = on ? 0.95 : 0.55;
      yildizCiz(c, x, y, SERSEM_YILDIZ_R * (on ? 1 : 0.8), azHareketOn ? 0 : zaman * 4 + i);
    }
    c.restore();
  }

  function arkaPlanCiz(c) {
    var b = durum.gorunenBolge, set, kat, off;
    if (!katmanlar[b]) bolgeKur(b);
    if (gecis < 1 && !katmanlar[eskiBolge]) bolgeKur(eskiBolge);
    for (kat = 0; kat < 3; kat++) {
      off = (durum.mesafe * PARALAKS[kat]) % W;
      if (gecis < 1) {
        set = katmanlar[eskiBolge][kat];
        c.drawImage(set, -off, 0, W, H); c.drawImage(set, W - off, 0, W, H);
        c.globalAlpha = gecis;
      }
      set = katmanlar[b][kat];
      c.drawImage(set, -off, 0, W, H); c.drawImage(set, W - off, 0, W, H);
      c.globalAlpha = 1;
    }
  }

  function dunyaCiz(c, dt, p) {
    var d = durum, dl = d.dilimler, i, j, s, e, t, x, mesafe = d.mesafe, kenar = KENAR_PX / olcek, mx, my, md, rm2 = M.R_MIKNATIS * M.R_MIKNATIS;
    c.lineWidth = kenar; c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = ENGEL_DOLGU; c.strokeStyle = ENGEL_KENAR;
    for (i = 0; i < dl.length; i++) {                         // engeller
      s = dl[i];
      for (j = 0; j < s.engeller.length; j++) {
        e = s.engeller[j]; x = e.x - mesafe;
        if (x > W + 2 || x + e.w < -2) continue;
        c.save(); c.translate(-mesafe, 0);
        engelCiz(c, e);
        c.restore();
      }
    }
    for (i = 0; i < dl.length; i++) {                         // sarmasik (faz 2 buyur, faz 3 tam boy)
      s = dl[i];
      if (s.sarmasik && s.sarmasik.faz >= 2) sarmasikCiz(c, s.sarmasik, mesafe);
    }
    for (i = 0; i < dl.length; i++) {                         // toz ve kivilcim (dilim-onu siniri yok: her tozun kendi x'i denetlenir)
      s = dl[i];
      for (j = 0; j < s.toz.length; j++) {
        t = s.toz[j]; x = t.x - mesafe;
        if (t.alindi || t.yutuldu || x < -3 || x > W + 3) continue;       // yutulan toz (sarmasik) cizilmez
        c.globalAlpha = 0.8; c.drawImage(sprToz, x - M.R_TOZ_GORSEL * 3.2, t.y - M.R_TOZ_GORSEL * 3.2, M.R_TOZ_GORSEL * 6.4, M.R_TOZ_GORSEL * 6.4);
        c.globalAlpha = 1; c.fillStyle = pal.toz; c.beginPath(); c.arc(x, t.y, M.R_TOZ_GORSEL, 0, 6.2832); c.fill();
        c.globalAlpha = 0.8; c.fillStyle = BOCEK_KANAT; c.beginPath(); c.arc(x, t.y, M.R_TOZ_GORSEL * 0.5, 0, 6.2832); c.fill();      // sicak cekirdek
        mx = x - XB; my = t.y - durum.y; md = mx * mx + my * my;
        if (md < rm2 && md > 1 && !(durum.sersem > 0)) {                                                                                // miknatisla cekiliyor: kisa kuyruk (sersemken miknatis kapali)
          md = Math.sqrt(md); c.globalAlpha = 0.4; c.strokeStyle = pal.toz; c.lineWidth = M.R_TOZ_GORSEL;
          c.beginPath(); c.moveTo(x, t.y); c.lineTo(x + mx / md * 2.4, t.y + my / md * 2.4); c.stroke();
        }
      }
      t = s.kivilcim;
      if (t && !t.alindi) {
        x = t.x - mesafe;
        if (x > -4 && x < W + 4) {
          c.globalAlpha = 0.9; c.drawImage(sprKivilcim, x - M.R_KIVILCIM_GORSEL * 3, t.y - M.R_KIVILCIM_GORSEL * 3, M.R_KIVILCIM_GORSEL * 6, M.R_KIVILCIM_GORSEL * 6);
          c.globalAlpha = 1; c.fillStyle = pal.vurgu; yildizCiz(c, x, t.y, M.R_KIVILCIM_GORSEL, azHareketOn ? 0 : zaman * 3);
        }
      }
    }
    izCiz(c);
    parcacikGuncelle(dt, c);
    bocekCiz(c, dt, p);
    sersemCiz(c);
  }

  // Sonme ilerlemesi 0..1: kosu surerken 0; olumden sonra sure dolunca 1 (karanlik tamamen coker)
  function sonmeIlerleme() {
    if (!durum || !durum.bitti) return 0;
    return sonme < 0 ? 1 : Math.min(1, sonme / sonmeSuresi());
  }
  function sonmeSuresi() { return azHareketOn ? SONME_AZ_SN : (olumTur === 'zemin' ? ZEMIN_OLUM_SN : SONME_SN); }
  function zeminDusus() { return olumTur === 'zemin' && !azHareketOn && !!durum && !!durum.bitti; }
  function dususT() { return sonme < 0 ? sonmeSuresi() : sonme; }
  // Bocegin cizim yuksekligi: kosu surerken cekirdegin y'si; zemin olumunde sicrama + dusus egrisi
  // y(t) = y0 - v0 t + g t^2 / 2 (tepe ZEMIN_SICRAMA_SN'de, ZEMIN_SICRAMA yukarida), ekran disina iner.
  function bocekY() {
    if (!zeminDusus()) return durum.y;
    var t = dususT(), v0 = 2 * ZEMIN_SICRAMA / ZEMIN_SICRAMA_SN, g = v0 / ZEMIN_SICRAMA_SN;
    return durum.y - v0 * t + g * t * t / 2;
  }
  // Isik carpani: yumusakca 1 -> 0; titreme yalniz azaltilmis hareket kapaliyken
  function sonmeCarpan(p) {
    if (p <= 0) return 1;
    if (p >= 1) return 0;
    var f = 1 - p * p * (3 - 2 * p);
    if (!azHareketOn) f *= 1 + 0.16 * Math.sin(p * 46) * (1 - p);
    return Math.max(0, f);
  }

  function karanlikCiz(p) {
    var f = sonmeCarpan(p), R = AB.isikYaricapi(durum.isik, hizOnbellek, durum.gorunenBolge) * f, ks = kc.width / W, by = bocekY();
    kctx.setTransform(1, 0, 0, 1, 0, 0);
    kctx.globalCompositeOperation = 'source-over';
    kctx.fillStyle = p > 0 ? rgba(pal.karanlik, KARANLIK_OPAKLIK + (1 - KARANLIK_OPAKLIK) * p) : karanlikRenkStr;
    kctx.fillRect(0, 0, kc.width, kc.height);
    if (R > 0.01) {
      kctx.globalCompositeOperation = 'destination-out';
      kctx.setTransform(R * ks, 0, 0, R * ks, XB * ks, by * ks);
      kctx.fillStyle = karanlikGrad;
      kctx.fillRect(-AD.KARARTMA, -AD.KARARTMA, 2 * AD.KARARTMA, 2 * AD.KARARTMA);
      kctx.globalCompositeOperation = 'source-over';
    }
  }

  function ciz(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.karanlik;
    ctx.fillRect(0, 0, tuval.width, tuval.height);
    ctx.save();
    ctx.setTransform(S, 0, 0, S, ox * dpr, oy * dpr);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    arkaPlanCiz(ctx);
    var p = sonmeIlerleme();
    dunyaCiz(ctx, dt, p);
    ctx.restore();
    karanlikCiz(p);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(kc, Math.round(ox * dpr), Math.round(oy * dpr));
    ctx.save();                                    // kendi isigiyla gorunenler karanligin ustunde
    ctx.setTransform(S, 0, 0, S, ox * dpr, oy * dpr);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ozIsikCiz(ctx, p);
    ctx.restore();
    hudYaz();
  }

  // ---------------------------------------------------------------
  // HUD (DOM; yalniz deger degisince yazilir)
  // ---------------------------------------------------------------
  function hudYaz() {
    var d = durum, p = Math.floor(d.puan), r = Math.max(rekor, p), c = AB.carpan(d.zincir), isik = Math.round(d.isik * 100);
    if (p !== sonHud.puan) { sonHud.puan = p; puanEl.textContent = yaz(p); }
    if (r !== sonHud.rekor) { sonHud.rekor = r; rekorEl.textContent = yaz(r); }
    if (c !== sonHud.carpan) {
      sonHud.carpan = c; carpanEl.textContent = '×' + String(c).replace('.', ',');
      carpanEl.parentNode.classList.toggle('aktif', c > 1);
    }
    if (isik !== sonHud.isik) { sonHud.isik = isik; isikEl.style.transform = 'scaleX(' + (isik / 100) + ')'; isikEl.parentNode.setAttribute('aria-valuenow', String(isik)); }
  }
  function hudSifirla() {
    sonHud.puan = sonHud.rekor = sonHud.carpan = sonHud.isik = -1;
    puanEl.textContent = '0'; rekorEl.textContent = yaz(rekor); carpanEl.textContent = '×1';
    carpanEl.parentNode.classList.remove('aktif');
    isikEl.style.transform = 'scaleX(1)'; isikEl.parentNode.setAttribute('aria-valuenow', '100');
  }

  // ---------------------------------------------------------------
  // KAYIT — savunmaci okuma
  // ---------------------------------------------------------------
  function AppKayitSurum() { return window.AppKayitGoc && window.AppKayitGoc.surum ? window.AppKayitGoc.surum : 3; }
  function sayi(v) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0; }
  function kayitOku() {
    var P = window.AppProgress, ab;
    if (!P) return { rekor: 0, kosu: 0, gun: '', gunJeton: 0 };
    if (typeof P.surum === 'number' && P.surum > AppKayitSurum()) return null;   // daha yeni kayit: dokunma
    ab = P.atesBocegi;
    if (!ab || typeof ab !== 'object' || Array.isArray(ab)) { ab = { rekor: 0, kosu: 0, gun: '', gunJeton: 0 }; P.atesBocegi = ab; }
    ab.rekor = sayi(ab.rekor); ab.kosu = sayi(ab.kosu); ab.gunJeton = sayi(ab.gunJeton);
    if (typeof ab.gun !== 'string') ab.gun = '';
    return ab;      // AppProgress icindeki AYNI nesne: AppGold.add ile birlikte tek yazimda diske gider
  }

  // ---------------------------------------------------------------
  // KOSU BITISI — tek kez: rekor, esik odulu, kosu jetonu, kayit, sonuc karti
  // ---------------------------------------------------------------
  function kosuBitti() {
    if (bitisIsleniyor) return;
    bitisIsleniyor = true;
    var ab = kayitOku(), bg = bugun(), puan = Math.floor(durum.puan), toz = durum.toz;
    if (!ab) {                       // desteklenmeyen (daha yeni) kayit surumu: yazma, odeme yok
      sonSonuc = { puan: puan, toz: toz, eskiRekor: 0, yeniRekor: false, esik: { jeton: 0, adet: 0 }, kj: { jeton: 0, ham: 0, aktif: true }, toplam: 0, gunJeton: 0, yazilmadi: true };
      return;
    }
    var gunJeton = ab.gun === bg ? ab.gunJeton : 0, eskiRekor = ab.rekor, oncekiKosu = ab.kosu;
    var esik = AB.esikOdulu(eskiRekor, puan, AYAR), kj = AB.kosuJetonu(puan, toz, gunJeton, AYAR);
    var toplam = esik.jeton + kj.jeton;
    ab.rekor = Math.max(eskiRekor, puan);
    ab.kosu += 1; ab.gun = bg; ab.gunJeton = gunJeton + kj.ham;
    // Kayit ve jeton tek yazimda: ab bellekte guncel, AppGold.add tum ilerlemeyi bir kez yazar.
    if (toplam > 0 && window.AppGold) window.AppGold.add(toplam);
    else if (window.AppSaveProgress) window.AppSaveProgress({ atesBocegi: ab });
    rekor = ab.rekor;
    sonSonuc = { puan: puan, toz: toz, eskiRekor: eskiRekor, yeniRekor: puan > eskiRekor && oncekiKosu > 0, esik: esik, kj: kj, toplam: toplam, gunJeton: gunJeton };
  }

  function jetonSatiri(ad, miktar, sinif) {
    return '<div class="' + sinif + '"><span>' + ad + '</span><b>' + window.CoinSVG(true) + '+' + yaz(miktar) + '</b></div>';
  }
  function sonucGoster() {
    var s = sonSonuc, E = AYAR.ekonomi, alt;
    if (!s) return;
    sonBaslik.innerHTML = s.yeniRekor
      ? '<span style="color:#FFE08A">Yeni</span> <span style="color:#8FF0B4">Rekor!</span>'
      : '<span style="color:#FFC97A">Işık</span> <span style="color:#FF9A8A">Söndü</span>';
    alt = '<div class="ab-sonpuan">' + yaz(s.puan) + '</div><div class="ab-sonsatir">Rekor: ' + yaz(Math.max(s.eskiRekor, s.puan)) +
      (s.yeniRekor && s.eskiRekor > 0 ? '  ·  Önceki: ' + yaz(s.eskiRekor) : '') + '  ·  Toz: ' + s.toz + '</div>';
    alt += '<div class="ab-kazanc">';
    if (s.kj.aktif) alt += jetonSatiri('Koşu jetonu', s.kj.jeton, 'ab-kz-satir');
    if (s.esik.jeton > 0) alt += jetonSatiri('Rekor eşiği' + (s.esik.adet > 1 ? ' ×' + s.esik.adet : ''), s.esik.jeton, 'ab-kz-satir');
    if (s.toplam > 0) alt += jetonSatiri('Toplam', s.toplam, 'ab-kz-toplam');
    alt += '</div>';
    if (s.yazilmadi) alt += '<div class="ab-not">Bu kayıt sürümü desteklenmiyor; ödül verilmedi.</div>';
    else if (!s.kj.aktif) alt += '<div class="ab-not">Koşu jetonu için en az ' + E.AKTIF_TOZ + ' toz ve ' + yaz(E.AKTIF_PUAN) + ' puan gerekir.</div>';
    else if (s.kj.ham > s.kj.jeton) alt += '<div class="ab-not">Günlük sınır aşıldı: ' + s.kj.ham + ' jetonun ' + s.kj.jeton + ' kadarı ödendi.</div>';
    sonAlt.innerHTML = alt;
    sonEl.classList.add('show');
    if (s.yeniRekor) dizi([[523, .15, .13, 0], [659, .15, .13, 90], [784, .15, .13, 180], [1047, .3, .15, 270]], 'triangle');
    else dizi([[440, .16, .13, 0], [349, .16, .13, 170], [262, .5, .15, 340]], 'sine');
  }

  // ---------------------------------------------------------------
  // OLAYLAR, DONGU
  // ---------------------------------------------------------------
  function olayIsle(olaylar) {
    var i, o, f;
    for (i = 0; i < olaylar.length; i++) {
      o = olaylar[i];
      if (o.tur === 'toz') { f = 660 + Math.min(durum.zincir, 20) * 28; ton(f, f * 1.5, 0.09, 'sine', 0.07); }
      else if (o.tur === 'kivilcim') { dizi([[784, .1, .1, 0], [1175, .16, .1, 70]], 'triangle'); titret(10); }
      else if (o.tur === 'hasar') {
        if (o.engel === 'dal') { ton(150, 50, 0.34, 'sawtooth', 0.13); ton(90, 40, 0.3, 'square', 0.05); titret([60, 30, 60]); }   // yarim bar: agir
        else { ton(220, 90, 0.2, 'sawtooth', 0.1); titret(35); }
      }
      else if (o.tur === 'bomba') { ton(110, 38, 0.36, 'sine', 0.15); ton(190, 70, 0.14, 'triangle', 0.06); titret([45, 25, 45]); bombaPatlat(o.x - durum.mesafe, o.y); }
      else if (o.tur === 'sarmasikUyari') { dizi([[880, .07, .09, 0], [880, .07, .09, 120]], 'square'); }
      else if (o.tur === 'sarmasik') { ton(280, 150, 0.2, 'triangle', 0.1); ton(120, 80, 0.16, 'sine', 0.08); titret([25, 20, 25]); }
      else if (o.tur === 'yutuldu') tozSon(o.x - durum.mesafe, o.y);     // sessiz (cok toz ayni anda yutulur); gorsel: alfa sonmesi
      else if (o.tur === 'ag') { ton(300, 200, 0.12, 'sine', 0.07); titret(18); }
      else if (o.tur === 'bolge') {
        eskiBolge = oncekiBolge; oncekiBolge = o.bolge;
        gecis = azHareketOn ? 1 : 0;
        dizi([[392, .12, .09, 0], [523, .12, .09, 100], [659, .2, .09, 200]], 'triangle');
      }
      else if (o.tur === 'sersem') { ton(640, 320, 0.12, 'triangle', 0.08); ton(900, 700, 0.18, 'sine', 0.04); titret(20); }   // tavana carpma: hafif "tok"
      else if (o.tur === 'uyandi') { ton(500, 760, 0.08, 'sine', 0.05); }
      else if (o.tur === 'zemin') { ton(330, 660, 0.12, 'square', 0.06); }                 // zemine degme: kisa sicrama sesi (olum sesi bitti'de)
      else if (o.tur === 'bitti') {
        titret([30, 40, 60]);
        olumTur = o.sebep === 'zemin' ? 'zemin' : 'isik';
        basili = false; isaretciler = 0; tusBasili = false;   // girdi kilidi (aktifMi zaten bitti'de girdiyi yutar)
        kosuBitti();                 // odul + kayit tek kez (bitisIsleniyor); sonuc karti sonme bitince dongude gelir
        sonme = 0;
        ton(520, 55, sonmeSuresi() + 0.1, 'sine', 0.09);     // sonme sesi
      }
    }
  }

  function rafDurdur() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

  function dongu(z) {
    var dt, n = 0, olaylar, saniye = z / 1000;
    rafId = requestAnimationFrame(dongu);
    if (ekran.classList.contains('offstage')) { dur(); return; }
    if (!cssW && !boyutla()) return;
    dt = sonZaman ? Math.max(0, saniye - sonZaman) : 0;
    sonZaman = saniye;
    dt = Math.min(dt, MAKS_FARK);
    zaman = saniye;
    if ((kare++ & 31) === 0) azHareketOn = azHareket();
    if (!bekle && !duraklatildi && !durum.bitti) {
      birikim += dt;
      while (birikim >= DT && !durum.bitti) {
        olaylar = AB.adim(durum, basili);
        if (olaylar.length) olayIsle(olaylar);
        izKaydet();
        birikim -= DT;
        if (++n >= MAKS_ADIM) { birikim = 0; break; }
      }
      if (gecis < 1) gecis = Math.min(1, gecis + dt / BOLGE_GECIS);
      if ((hizSayac++ & 7) === 0) hizOnbellek = AB.zorluk(durum.mesafe).hiz;
    }
    if (durum.bitti && sonme >= 0) {                 // isik sonuyor: dunya yavaslayip donar (zemin olumunde hemen donar), sonra sonuc karti
      var sure = sonmeSuresi(), oran = Math.min(1, sonme / sure);
      if (!azHareketOn && olumTur !== 'zemin') durum.mesafe += hizOnbellek * dt * SONME_YAVAS * (1 - oran) * (1 - oran);
      sonme += dt;
      if (sonme >= sure) {
        sonme = -1;
        ciz(0);                                      // tam karanlik kare
        sonucGoster(); rafDurdur();
        return;
      }
    }
    ciz(durum.bitti && sonme < 0 ? 0 : dt);        // sonme sirasinda parcacik/kanat gercek dt ile ilerler (olumcul bomba patlamasi gorunur)
  }

  function izKaydet() {
    if ((adimSayaci++ & 1) !== 0) return;      // 60 Hz ornek
    var i = (izBas + izN) % IZ_ORNEK;
    if (izN < IZ_ORNEK) izN++; else izBas = (izBas + 1) % IZ_ORNEK;
    izM[i] = durum.mesafe; izY[i] = durum.y;
  }

  // ---------------------------------------------------------------
  // KOSU YASAM DONGUSU
  // ---------------------------------------------------------------
  function yeniKosu() {
    rafDurdur();
    kosuNo++;
    durum = AB.oyunOlustur(tohumUret());
    var kk = kayitOku(); rekor = Math.max(rekor, kk ? kk.rekor : 0);
    pal = paletOku();
    birikim = 0; sonZaman = 0; kare = 0; basili = false; isaretciler = 0; tusBasili = false;
    bekle = true; duraklatildi = false; bitisIsleniyor = false; sonSonuc = null;
    gecis = 1; eskiBolge = oncekiBolge = durum.gorunenBolge; izN = 0; izBas = 0; adimSayaci = 0;
    hizOnbellek = AB.zorluk(0).hiz; hizSayac = 0; parcBirikim = 0;
    parc.fill(0); kanatFaz = 0; azHareketOn = azHareket();
    sonme = -1; olumTur = '';
    sonEl.classList.remove('show'); durEl.classList.remove('show');
    ipucuEl.classList.remove('show'); void ipucuEl.offsetWidth; ipucuEl.classList.add('show');     // belirme animasyonu her kosuda yeniden
    hudSifirla();
    if (cssW && JSON.stringify(pal) !== paletAnahtar) gorselKur();
    calisiyor = true;
    rafId = requestAnimationFrame(dongu);
  }

  function duraklat() {
    if (!calisiyor || duraklatildi || !durum) return;
    if (durum.bitti) { basili = false; isaretciler = 0; tusBasili = false; return; }     // sonme / sonuc: akis kesilmez
    rafDurdur();
    basili = false; isaretciler = 0; tusBasili = false;
    if (!durum.bitti && !bekle) {
      duraklatildi = true;
      durEl.classList.add('show');
    }
  }
  function devam() {
    if (!calisiyor || !duraklatildi) return;
    duraklatildi = false; sonZaman = 0; birikim = 0;
    durEl.classList.remove('show');
    if (!rafId) rafId = requestAnimationFrame(dongu);
  }

  function dur() {
    rafDurdur();
    calisiyor = false; duraklatildi = false; basili = false; isaretciler = 0; tusBasili = false;
    kosuNo++; sonme = -1;                       // sonme akisi biter; sonuc karti gelmez
    durEl.classList.remove('show'); sonEl.classList.remove('show');
  }

  // ---------------------------------------------------------------
  // GIRDI
  // ---------------------------------------------------------------
  function basla() {
    if (!bekle) return;
    bekle = false; ipucuEl.classList.remove('show'); sonZaman = 0;
    if (!rafId && calisiyor && !duraklatildi) rafId = requestAnimationFrame(dongu);
  }
  function aktifMi() { return calisiyor && !duraklatildi && durum && !durum.bitti && !ekran.classList.contains('offstage'); }

  tuval.addEventListener('pointerdown', function (e) {
    if (!aktifMi()) return;
    e.preventDefault();
    try { tuval.setPointerCapture(e.pointerId); } catch (x) { /* eski tarayici */ }
    isaretciler++; basili = true; basla();
  });
  function birak() { if (isaretciler > 0) isaretciler--; basili = isaretciler > 0 || tusBasili; }
  tuval.addEventListener('pointerup', birak);
  tuval.addEventListener('pointercancel', birak);
  tuval.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('keydown', function (e) {
    if (!aktifMi()) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) { tusBasili = true; basili = true; basla(); }
    } else if (e.code === 'Escape' || e.code === 'KeyP') { duraklat(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') { tusBasili = false; basili = isaretciler > 0; }
  });
  window.addEventListener('blur', function () { isaretciler = 0; tusBasili = false; basili = false; duraklat(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) duraklat(); });

  q('abDurBtn').addEventListener('click', function () { if (aktifMi() && !bekle) duraklat(); });
  q('abDevam').addEventListener('click', devam);
  q('abYeniden').addEventListener('click', yeniKosu);
  q('abTekrar').addEventListener('click', yeniKosu);
  q('abAna').addEventListener('click', function () { var b = q('atesBackBtn'); if (b) b.click(); });

  function olcuDegisti() {
    if (!calisiyor || ekran.classList.contains('offstage')) return;
    if (boyutla() && (!rafId) && (duraklatildi || (durum && durum.bitti) || bekle)) ciz(0);
  }
  if (window.ResizeObserver) new ResizeObserver(olcuDegisti).observe(alan);
  else window.addEventListener('resize', olcuDegisti);

  // ---------------------------------------------------------------
  // DISARI
  // ---------------------------------------------------------------
  window.AtesBocegiOyun = {
    // Ekran her acildiginda: tuvali olc, temayi oku, yeni kosu baslat.
    start: function () {
      dur();
      cssW = 0;                  // ilk karede yeniden olculur (ekran gecisi sirasinda)
      yeniKosu();
      if (boyutla()) ciz(0);
    },
    dur: dur,
    // market.js temayiYay: palet yeniden okunur, onbellekli katmanlar yeniden kurulur
    temaDegisti: function () {
      pal = paletOku();
      if (cssW && JSON.stringify(pal) !== paletAnahtar) gorselKur();
      if (calisiyor && durum && !rafId && cssW) ciz(0);
    },
    // AppReset: acik kosuyu at, HUD'u sifirla
    sifirla: function () {
      dur();
      durum = null; rekor = 0; sonSonuc = null;
      hudSifirla();
    }
  };
})();
