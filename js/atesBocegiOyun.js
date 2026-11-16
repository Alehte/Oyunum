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
  var BOLGE_TON = ['#24402F', '#2E2A44', '#1F3F4C', '#3A4031'];            // orman, magara, nehir, bataklik
  var PARALAKS = [0.2, 0.5, 1];       // uc katmanin hiz carpani
  var ISIK_KARISIM = 0.12;            // zemine isik tonu bindirme (tasarim 5)
  var IZ_SANIYE = 0.5, IZ_ORNEK = 30, IZ_ALFA = 0.6;
  var PARCACIK_TAVAN = 24, PARCACIK_OMUR = 0.6, PARCACIK_HIZ = 40;
  var BOLGE_GECIS = 1.5;              // arka plan capraz gecis suresi (sn)
  var DUR_ONCE_MS = 650;              // olum ile sonuc karti arasi

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
  var kosuNo = 0;                     // sonuc zamanlayicisi eski kosuya ait mi
  var basili = false, isaretciler = 0, tusBasili = false;
  var rekor = 0, sonSonuc = null;
  var hizOnbellek = 24, hizSayac = 0;
  var azHareketOn = false;
  var kanatFaz = 0, adimSayaci = 0;

  // olcu (css px + cihaz px)
  var dpr = 1, cssW = 0, cssH = 0, olcek = 1, ox = 0, oy = 0, S = 1;
  // kare basina ayirma olmasin diye hazir nesneler
  var kc = null, kctx = null, karanlikGrad = null, karanlikRenkStr = '';
  var katmanlar = [null, null, null, null];   // bolge -> [tuval, tuval, tuval]
  var sprBocek = null, sprToz = null, sprKivilcim = null;
  var gecis = 1, eskiBolge = 0, oncekiBolge = 0;       // arka plan capraz gecisi
  var izM = new Float32Array(IZ_ORNEK + 2), izY = new Float32Array(IZ_ORNEK + 2), izN = 0, izBas = 0;
  var parc = new Float32Array(PARCACIK_TAVAN * 6);   // x, y, vx, vy, yas, omur
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

  // Bir bolgenin bir paralaks katmani (dunya birimiyle; c olcekli).
  function katmanCiz(c, bolge, kat, zemin) {
    var r = rastgele(bolge * 31 + kat * 7 + 11), i, x, y, n, w;
    var koyu = karistir(zemin, '#000000', kat === 0 ? 0.15 : 0.07), acik = karistir(zemin, '#FFFFFF', 0.15);
    var renk = kat === 2 ? acik : koyu;
    if (kat === 0) { c.fillStyle = zemin; c.fillRect(0, 0, W, H); }
    c.lineCap = 'round';
    if (bolge === 0) {                                   // gece ormani
      if (kat < 2) {
        n = kat === 0 ? 7 : 5;
        for (i = 0; i < n; i++) {
          x = (i + r() * 0.6) * W / n; w = (kat === 0 ? 3.5 : 2) + r() * 1.5;
          sarmal(c, function () { c.fillStyle = renk; c.fillRect(x - w / 2, 0, w, H); });
        }
      } else {
        for (i = 0; i < 16; i++) {
          x = r() * W; y = i % 2 ? 2 + r() * 10 : H - 2 - r() * 8; w = 2 + r() * 2; var ry = 1 + r(), rot = r() * 3;
          sarmal(c, function () { elips(c, x, y, w, ry, renk, 0.9, rot); });
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
      } else {
        var kap = karistir(zemin, pal.vurgu, 0.4);
        for (i = 0; i < 7; i++) {
          x = r() * W; w = 1.4 + r() * 1.6; y = H - 1;
          sarmal(c, function () {
            c.fillStyle = koyu; c.fillRect(x - 0.3, y - w * 1.6, 0.6, w * 1.6);
            elips(c, x, y - w * 1.6, w * 1.6, w * 0.9, rgba(pal.vurgu, 0.16), 1, 0);
            c.fillStyle = kap; c.beginPath(); c.ellipse(x, y - w * 1.6, w, w * 0.7, 0, Math.PI, 0); c.fill();
          });
        }
      }
    } else if (bolge === 2) {                            // nehir kiyisi
      if (kat === 0) {
        elips(c, 33, 16, 6, 6, karistir(zemin, '#FFFFFF', 0.12), 1, 0);
      } else if (kat === 1) {
        c.strokeStyle = acik; c.globalAlpha = 0.5; c.lineWidth = 0.35;
        for (i = 0; i < 16; i++) {
          x = r() * W; y = 52 + r() * 40; w = 5 + r() * 8;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); });
        }
        c.globalAlpha = 1;
      } else {
        c.strokeStyle = renk; c.lineWidth = 0.5;
        for (i = 0; i < 22; i++) {
          x = r() * W; y = 8 + r() * 14; w = (r() - 0.5) * 3;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + w * 0.2, H - y * 0.6, x + w, H - y); c.stroke(); });
        }
      }
    } else {                                             // sisli bataklik
      if (kat === 0) {
        for (i = 0; i < 5; i++) { x = (i + 0.5) * W / 5; y = 8 + r() * 6; sarmal(c, function () { elips(c, x, H, 14, y, renk, 1, 0); }); }
      } else if (kat === 1) {
        c.strokeStyle = renk; c.lineWidth = 1.1;
        for (i = 0; i < 7; i++) {
          x = (i + r() * 0.6) * W / 7; y = 24 + r() * 18; w = (r() - 0.5) * 8;
          sarmal(c, function () { c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + w, y * 0.3, x - w, y * 0.7, x + w * 0.5, y); c.stroke(); });
        }
      } else {
        var sis = karistir(zemin, '#FFFFFF', 0.5);
        for (i = 0; i < 6; i++) {
          x = r() * W; y = 12 + r() * 76; w = 10 + r() * 6; var ry2 = 1.6 + r();
          sarmal(c, function () { elips(c, x, y, w, ry2, sis, 0.14, 0); });
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

  function gorselKur() {
    var k;
    if (cssW <= 0 || cssH <= 0) return;
    katmanlar = [null, null, null, null];
    sprBocek = parilti(M.R_GORSEL * 4, pal.isik);
    sprToz = parilti(M.R_TOZ_GORSEL * 3.2, pal.toz);
    sprKivilcim = parilti(M.R_KIVILCIM_GORSEL * 3, pal.vurgu);
    kc = yeniTuval(W * S, H * S); kctx = kc.getContext('2d');
    karanlikGrad = kctx.createRadialGradient(0, 0, 0, 0, 0, AD.KARARTMA);
    karanlikGrad.addColorStop(0, 'rgba(0,0,0,1)');
    karanlikGrad.addColorStop(1 / AD.KARARTMA, 'rgba(0,0,0,1)');
    karanlikGrad.addColorStop(1, 'rgba(0,0,0,0)');
    karanlikRenkStr = rgba(pal.karanlik, KARANLIK_OPAKLIK);
    k = durum ? durum.gorunenBolge : 0;
    bolgeKur(k);
    ekran.style.setProperty('--ab-vurgu', pal.vurgu);
    ekran.style.setProperty('--ab-isik', pal.isik);
    ekran.style.setProperty('--ab-karanlik', pal.karanlik);
  }

  function boyutla() {
    var r = alan.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = r.width; cssH = r.height;
    olcek = Math.min(cssW / W, cssH / H);
    ox = (cssW - W * olcek) / 2; oy = (cssH - H * olcek) / 2;
    S = olcek * dpr;
    tuval.width = Math.round(cssW * dpr); tuval.height = Math.round(cssH * dpr);
    gorselKur();
    return true;
  }

  // ---------------------------------------------------------------
  // CIZIM
  // ---------------------------------------------------------------
  function dalCiz(c, x, y, w, h, tavan) {      // tavan: bagli uc ustte, serbest uc altta
    var cx = x + w / 2, bw = w * 0.42, y0 = tavan ? y : y + h, dir = tavan ? 1 : -1, uz = h - 0.8, s, yan;
    c.beginPath();
    c.moveTo(cx - bw / 2, y0);
    c.quadraticCurveTo(cx - bw / 2 - 0.5, y0 + dir * uz * 0.5, cx - bw * 0.25, y0 + dir * uz);
    c.lineTo(cx + bw * 0.25, y0 + dir * uz);
    c.quadraticCurveTo(cx + bw / 2 + 0.5, y0 + dir * uz * 0.5, cx + bw / 2, y0);
    c.closePath();
    for (s = 2.2, yan = 0; s < uz - 1; s += 3.4, yan ^= 1) {
      if (yan) { c.moveTo(cx + bw / 2, y0 + dir * s); c.lineTo(x + w, y0 + dir * (s + 1.7)); c.lineTo(cx + bw / 2, y0 + dir * (s + 2.4)); }
      else { c.moveTo(cx - bw / 2, y0 + dir * s); c.lineTo(x, y0 + dir * (s + 1.7)); c.lineTo(cx - bw / 2, y0 + dir * (s + 2.4)); }
      c.closePath();
    }
    c.moveTo(cx + w * 0.26, y0 + dir * (h - w * 0.26));
    c.arc(cx, y0 + dir * (h - w * 0.26), w * 0.26, 0, 6.2832);
    c.fill(); c.stroke();
  }

  function agCiz(c, e) {
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2, hw = e.w / 2, hh = e.h / 2, i, a, co, si, t;
    c.globalAlpha = 0.35; c.fillStyle = ENGEL_DOLGU; c.fillRect(e.x, e.y, e.w, e.h); c.globalAlpha = 1;
    c.beginPath(); c.rect(e.x, e.y, e.w, e.h);
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4; co = Math.cos(a); si = Math.sin(a);
      t = Math.min(co ? hw / Math.abs(co) : 1e9, si ? hh / Math.abs(si) : 1e9);
      c.moveTo(cx, cy); c.lineTo(cx + co * t, cy + si * t);
    }
    for (i = 1; i <= 3; i++) { c.moveTo(cx + hw * i / 3.4, cy); c.ellipse(cx, cy, hw * i / 3.4, hh * i / 3.4, 0, 0, 6.2832); }
    c.stroke();
  }

  function kusCiz(c, e) {
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2, yukari = (Math.floor(zaman * 8) & 1) === 0, uc = yukari ? e.y : e.y + e.h;
    c.beginPath();
    c.ellipse(cx + 0.2, cy, 1.6, 0.9, 0, 0, 6.2832);                       // govde
    c.moveTo(cx - 1.2, cy - 0.2); c.arc(cx - 1.5, cy - 0.2, 0.65, 0, 6.2832);   // bas (sola bakar)
    c.moveTo(cx - 2.1, cy - 0.35); c.lineTo(e.x, cy); c.lineTo(cx - 2.1, cy + 0.1);   // gaga
    c.moveTo(cx + 1.6, cy - 0.3); c.lineTo(e.x + e.w, cy - 0.7); c.lineTo(cx + 1.6, cy + 0.4);   // kuyruk
    c.moveTo(cx - 0.6, cy - 0.1); c.quadraticCurveTo(cx - 0.1, uc, cx + 1.3, uc); c.quadraticCurveTo(cx + 1.2, cy, cx + 1, cy + 0.1);   // kanat
    c.fill(); c.stroke();
  }

  function engelCiz(c, e) {
    var a;
    if (e.tur === 'dal') dalCiz(c, e.x, e.y, e.w, e.h, e.yon === 'ust');
    else if (e.tur === 'ag') agCiz(c, e);
    else if (e.tur === 'kus') kusCiz(c, e);
    else if (e.tur === 'dusen') {
      c.beginPath(); c.moveTo(e.x + e.w / 2, 0); c.lineTo(e.x + e.w / 2, e.y); c.stroke();     // sarmasik
      a = e.faz === 1 && !azHareketOn ? Math.sin(zaman * 60) * 0.052 : 0;                      // +-3 derece
      c.save(); c.translate(e.x + e.w / 2, e.y); c.rotate(a); c.translate(-(e.x + e.w / 2), -e.y);
      dalCiz(c, e.x, e.y, e.w, e.h, true);
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
    var i, o, a, hiz = hizOnbellek;
    if (azHareketOn || pal.iz.sekil !== 'akkor' || dt <= 0) return;
    parcBirikim += dt * PARCACIK_HIZ;
    for (i = 0; i < PARCACIK_TAVAN; i++) {
      o = i * 6;
      if (parc[o + 4] >= parc[o + 5]) {                      // bos yuva: gerekiyorsa doldur
        if (parcBirikim >= 1) {
          parcBirikim -= 1;
          parc[o] = XB - 1; parc[o + 1] = durum.y + (Math.random() - 0.5) * 1.2;
          parc[o + 2] = -(hiz * 0.4 + Math.random() * 10); parc[o + 3] = (Math.random() - 0.5) * 16;
          parc[o + 4] = 0; parc[o + 5] = PARCACIK_OMUR * (0.5 + Math.random() * 0.5);
        } else continue;
      }
      parc[o] += parc[o + 2] * dt; parc[o + 1] += parc[o + 3] * dt; parc[o + 4] += dt;
      if (parc[o + 4] >= parc[o + 5]) continue;
      a = 1 - parc[o + 4] / parc[o + 5];
      c.globalAlpha = a * 0.9;
      c.fillStyle = i & 1 ? pal.iz.renk : pal.iz.renk2;
      c.fillRect(parc[o] - 0.3, parc[o + 1] - 0.3, 0.6, 0.6);
    }
    c.globalAlpha = 1;
    if (parcBirikim > 2) parcBirikim = 2;
  }

  function bocekCiz(c, dt) {
    var d = durum, blink = d.dokunulmaz > 0 && (Math.floor(d.t * 12) & 1) === 0, kanat, egim;
    kanatFaz += dt * (basili ? 88 : 31);
    if (blink && !d.bitti) return;
    kanat = Math.sin(kanatFaz) * 0.6;
    egim = Math.max(-0.5, Math.min(0.5, d.vy * 0.012));
    c.save();
    c.translate(XB, d.y); c.rotate(egim);
    c.globalAlpha = 0.75 + 0.2 * Math.sin(zaman * 5);
    c.drawImage(sprBocek, -M.R_GORSEL * 4, -M.R_GORSEL * 4, M.R_GORSEL * 8, M.R_GORSEL * 8);
    c.globalAlpha = 0.55; c.fillStyle = '#FFFFFF';                 // kanatlar
    c.beginPath(); c.ellipse(-0.5, -0.5, 0.45, 1.5, -0.5 - kanat, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(-0.5, 0.5, 0.45, 1.5, 0.5 + kanat, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = pal.isik; c.beginPath(); c.ellipse(-0.9, 0, 1.5, 1.1, 0, 0, 6.2832); c.fill();   // karin
    c.fillStyle = '#1A1410'; c.beginPath(); c.arc(0.9, 0, 0.8, 0, 6.2832); c.fill();               // bas
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

  function dunyaCiz(c, dt) {
    var d = durum, dl = d.dilimler, i, j, s, e, t, x, mesafe = d.mesafe, kenar = KENAR_PX / olcek;
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
    for (i = 0; i < dl.length; i++) {                         // toz ve kivilcim
      s = dl[i];
      if (s.x - mesafe > W + 12) break;
      for (j = 0; j < s.toz.length; j++) {
        t = s.toz[j]; x = t.x - mesafe;
        if (t.alindi || x < -3 || x > W + 3) continue;
        c.globalAlpha = 0.8; c.drawImage(sprToz, x - M.R_TOZ_GORSEL * 3.2, t.y - M.R_TOZ_GORSEL * 3.2, M.R_TOZ_GORSEL * 6.4, M.R_TOZ_GORSEL * 6.4);
        c.globalAlpha = 1; c.fillStyle = pal.toz; c.beginPath(); c.arc(x, t.y, M.R_TOZ_GORSEL, 0, 6.2832); c.fill();
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
    bocekCiz(c, dt);
  }

  function karanlikCiz() {
    var R = AB.isikYaricapi(durum.isik, hizOnbellek, durum.gorunenBolge), ks = kc.width / W;
    kctx.setTransform(1, 0, 0, 1, 0, 0);
    kctx.globalCompositeOperation = 'source-over';
    kctx.fillStyle = karanlikRenkStr;
    kctx.fillRect(0, 0, kc.width, kc.height);
    kctx.globalCompositeOperation = 'destination-out';
    kctx.setTransform(R * ks, 0, 0, R * ks, XB * ks, durum.y * ks);
    kctx.fillStyle = karanlikGrad;
    kctx.fillRect(-AD.KARARTMA, -AD.KARARTMA, 2 * AD.KARARTMA, 2 * AD.KARARTMA);
    kctx.globalCompositeOperation = 'source-over';
  }

  function ciz(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.karanlik;
    ctx.fillRect(0, 0, tuval.width, tuval.height);
    ctx.save();
    ctx.setTransform(S, 0, 0, S, ox * dpr, oy * dpr);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    arkaPlanCiz(ctx);
    dunyaCiz(ctx, dt);
    ctx.restore();
    karanlikCiz();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(kc, Math.round(ox * dpr), Math.round(oy * dpr));
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
    isikEl.style.transform = 'scaleX(1)';
  }

  // ---------------------------------------------------------------
  // KAYIT — savunmaci okuma
  // ---------------------------------------------------------------
  function sayi(v) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0; }
  function kayitOku() {
    var P = window.AppProgress, ab;
    if (!P) return { rekor: 0, kosu: 0, gun: '', gunJeton: 0 };
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
    var ab = kayitOku(), bg = bugun(), gunJeton = ab.gun === bg ? ab.gunJeton : 0;
    var puan = Math.floor(durum.puan), toz = durum.toz, eskiRekor = ab.rekor;
    var esik = AB.esikOdulu(eskiRekor, puan, AYAR), kj = AB.kosuJetonu(puan, toz, gunJeton, AYAR);
    var toplam = esik.jeton + kj.jeton;
    ab.rekor = Math.max(eskiRekor, puan);
    ab.kosu += 1; ab.gun = bg; ab.gunJeton = gunJeton + kj.ham;
    // Kayit ve jeton tek yazimda: ab bellekte guncel, AppGold.add tum ilerlemeyi bir kez yazar.
    if (toplam > 0 && window.AppGold) window.AppGold.add(toplam);
    else if (window.AppSaveProgress) window.AppSaveProgress({ atesBocegi: ab });
    rekor = ab.rekor;
    sonSonuc = { puan: puan, toz: toz, eskiRekor: eskiRekor, yeniRekor: puan > eskiRekor, esik: esik, kj: kj, toplam: toplam, gunJeton: gunJeton };
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
    if (!s.kj.aktif) alt += '<div class="ab-not">Koşu jetonu için en az ' + E.AKTIF_TOZ + ' toz ve ' + yaz(E.AKTIF_PUAN) + ' puan gerekir.</div>';
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
      else if (o.tur === 'hasar') { ton(220, 90, 0.2, 'sawtooth', 0.1); titret(35); }
      else if (o.tur === 'ag') { ton(300, 200, 0.12, 'sine', 0.07); titret(18); }
      else if (o.tur === 'bolge') {
        eskiBolge = oncekiBolge; oncekiBolge = o.bolge;
        gecis = azHareketOn ? 1 : 0;
        dizi([[392, .12, .09, 0], [523, .12, .09, 100], [659, .2, .09, 200]], 'triangle');
      }
      else if (o.tur === 'bitti') {
        titret([30, 40, 60]);
        kosuBitti();
        var no = kosuNo;
        setTimeout(function () { if (no === kosuNo && calisiyor) { sonucGoster(); rafDurdur(); } }, DUR_ONCE_MS);
      }
    }
  }

  function rafDurdur() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

  function dongu(z) {
    var dt, n = 0, olaylar, saniye = z / 1000;
    rafId = requestAnimationFrame(dongu);
    if (ekran.classList.contains('offstage')) { duraklat(); return; }
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
    ciz(durum.bitti ? 0 : dt);
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
    rekor = Math.max(rekor, kayitOku().rekor);
    pal = paletOku();
    birikim = 0; sonZaman = 0; kare = 0; basili = false; isaretciler = 0; tusBasili = false;
    bekle = true; duraklatildi = false; bitisIsleniyor = false; sonSonuc = null;
    gecis = 1; eskiBolge = oncekiBolge = durum.gorunenBolge; izN = 0; izBas = 0; adimSayaci = 0;
    hizOnbellek = AB.zorluk(0).hiz; hizSayac = 0; parcBirikim = 0;
    parc.fill(0); kanatFaz = 0; azHareketOn = azHareket();
    sonEl.classList.remove('show'); durEl.classList.remove('show');
    ipucuEl.classList.add('show');
    hudSifirla();
    if (cssW) gorselKur();
    calisiyor = true;
    rafId = requestAnimationFrame(dongu);
  }

  function duraklat() {
    if (!calisiyor || duraklatildi || !durum) return;
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
    kosuNo++;                                   // bekleyen sonuc zamanlayicisini gecersiz kil
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
      if (cssW) gorselKur();
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
