// kalite.js — grafik kalitesi katmani: 'yuksek' | 'orta' | 'dusuk' (docs/PERFORMANS.md).
// YALNIZ cizim/DOM maliyetini ayarlar; oyun kurallari, skor, uretim, rastgelelik sirasi ve kayitlar hicbir seviyede
// degismez. Efekt kodu parcacik sayisini kisarken Math.random cagri sayisini KORUR (yalniz dugum uretmez).
//
// Seviye ne degistirir (CSS: html[data-kalite="..."], style.css "KALITE KATMANI" bolumu):
//   yuksek : mevcut gorunum (birebir). Canvas DPR tavani 2.
//   orta   : backdrop-filter / filter: blur kapali, buyuk parlama golgeleri sade, parcacik %60, canvas DPR tavani 1,5.
//   dusuk  : ortadakilere ek olarak sonsuz arka plan animasyonlari durur, gecisler kisalir, parcacik %30,
//            titreme (sarsma) yerine tek kare parlama, canvas DPR tavani 1.
//
// Secim: Ayarlar > Grafik kalitesi (Otomatik / Yuksek / Orta / Dusuk). Kayit AYRI anahtarda: localStorage 'ait_kalite'
// = { v:1, secim:'oto'|'yuksek'|'orta'|'dusuk', oto:'yuksek'|'orta'|'dusuk' } (ait_progress / market kaydina girmez;
// bozuk ya da eksik deger yok sayilir, varsayilan 'oto').
// Otomatik: taban seviye ipuclarindan (navigator.deviceMemory <= 1 -> dusuk, <= 2 -> orta; hardwareConcurrency <= 2 -> orta;
// prefers-reduced-motion -> orta). Acilistan ~1 sn sonra 3 sn (en az 20 kare, en cok 10 sn) kare suresi olculur; olcumun ilk
// 500 ms'si atilir (ekran gecisi / kurulum takilmasi sayilmaz). Ortanca > 30 ms -> dusuk, > 22 ms -> tabandan bir alt seviye, yoksa
// taban. Sabit 30 Hz rAF tavani (iOS Dusuk Guc, pil tasarrufu: ortanca 1000/30 +-%10 ve karelerin cogu bu bantta) yavaslik
// sayilmaz: o olcum seviyeyi dusurmez. Olcum seviyeyi hemen dusurebilir; yukselme yalniz ortanca < 18 ms iken ve
// bir adim (bir kez takilan cihaz bir sonraki akici acilista toparlanir). Oyunlar Kalite.olc() ile oyun icinde de
// 3 sn olcturabilir (yalniz dusurur). Acilis olcumu sayfa arka plana alindigi icin yarida kalirsa, sayfa yeniden gorununce
// bir kez tekrar denenir. Otomasyon altinda (navigator.webdriver ya da HeadlessChrome) otomatik olcum yapilmaz: testler belirlenimci.
//
// Gelistirme (YALNIZ yerel adreste; js/reklam.js yerelAdres kurali): ?kalite=dusuk|orta|yuksek seviyeyi bu oturum icin
// zorlar (kaydedilmez); ?kaliteOlc=1 otomasyon altinda da otomatik olcumu calistirir. Yayindaki adreste ikisi de etkisiz.
//
// API: Kalite.seviye(), Kalite.secim(), Kalite.sec('oto'|'yuksek'|'orta'|'dusuk'), Kalite.parcacikSayisi(taban), Kalite.parcacikTut(i, taban),
//      Kalite.efektAcikMi('titreme'|'konfeti'|'blur'), Kalite.dprTavan(), Kalite.dpr(), Kalite.abone(fn) -> birak(),
//      Kalite.olc(); degisimde window 'kalitedegisti' olayi da yayilir (detail: { seviye, onceki }).
(function () {
  'use strict';

  var ANAHTAR = 'ait_kalite';
  var SEVIYE = ['yuksek', 'orta', 'dusuk'];
  var SECIM = ['oto', 'yuksek', 'orta', 'dusuk'];
  var DPR_TAVAN = { yuksek: 2, orta: 1.5, dusuk: 1 };
  var PARCACIK_ORAN = { yuksek: 1, orta: 0.6, dusuk: 0.3 };
  var EFEKT = {
    yuksek: { titreme: true, konfeti: true, blur: true },
    orta:   { titreme: true, konfeti: true, blur: false },
    dusuk:  { titreme: false, konfeti: true, blur: false }
  };
  var OLCUM = { gecikme: 1000, sure: 3000, enUzun: 10000, bosluk: 1000, birAlt: 22, dusuk: 30, yuksel: 18, enAzKare: 20, karar: 5,
                atla: 500, tavanMs: 1000 / 30, tavanPay: 0.1, tavanOran: 0.75, enCokKare: 2048 };

  // js/reklam.js yerelAdres ile ayni kural (kopya; js/fpsGosterge.js ve hedef2048.js de ayni kopyayi tasir)
  function yerelAdres() {
    var l = window.location || {};
    if (l.protocol === 'file:') return true;
    var h = String(l.hostname || '').toLowerCase();
    if (/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(h)) return true;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m) return false;
    var a = Number(m[1]), b = Number(m[2]);
    if (Number(m[3]) > 255 || Number(m[4]) > 255) return false;
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  // otomasyon (WebDriver / headless Chrome testleri): otomatik olcum yapilmaz, seviye ipucundan ya da kayittan gelir
  function otomasyon() {
    var n = window.navigator || {};
    return !!n.webdriver || /HeadlessChrome/.test(String(n.userAgent || ''));
  }
  function sira(s) { var i = SEVIYE.indexOf(s); return i < 0 ? 0 : i; }
  function gecerliSeviye(s) { return SEVIYE.indexOf(s) >= 0; }

  // ---- kayit (ayri anahtar; bozuk/eksik deger yok sayilir) ----
  function oku() {
    var k = null;
    try { k = JSON.parse(window.localStorage.getItem(ANAHTAR)); } catch (e) { k = null; }
    if (!k || typeof k !== 'object') k = {};
    return { secim: SECIM.indexOf(k.secim) >= 0 ? k.secim : 'oto', oto: gecerliSeviye(k.oto) ? k.oto : null };
  }
  function yaz() {
    try { window.localStorage.setItem(ANAHTAR, JSON.stringify({ v: 1, secim: kayit.secim, oto: kayit.oto })); } catch (e) { /* depo yok: oturum boyu bellekte */ }
  }

  // ---- ipuclari ----
  function ipucuSeviye() {
    var n = window.navigator || {}, i = 0, dm = Number(n.deviceMemory), hc = Number(n.hardwareConcurrency), rm = false;
    try { rm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { rm = false; }
    if (dm > 0 && dm <= 1) i = 2; else if (dm > 0 && dm <= 2) i = Math.max(i, 1);
    if (hc > 0 && hc <= 2) i = Math.max(i, 1);
    if (rm) i = Math.max(i, 1);
    return SEVIYE[i];
  }
  // Olcum karari (saf; tools/perfTest.js dener). ort: ortanca kare suresi (ms), taban: ipucu seviyesi, mevcut: su anki oto seviye,
  // yalnizDusur: oyun ici olcum, tavanli: kareler sabit 30 Hz tavaninda (tavanli()); o olcum dusurmez. Donen: yeni oto seviye.
  function karar(ort, taban, mevcut, yalnizDusur, tavanliMi) {
    var hedef = ort > OLCUM.dusuk ? 2 : (ort > OLCUM.birAlt ? Math.min(2, sira(taban) + 1) : sira(taban));
    var m = sira(mevcut || taban);
    if (hedef > m && tavanliMi) return SEVIYE[m];               // 30 Hz tavani yavaslik degil: dusurme yok
    if (hedef >= m) return SEVIYE[hedef];                       // dusurme (ya da ayni)
    if (yalnizDusur || !(ort < OLCUM.yuksel)) return SEVIYE[m];  // yukselme yalniz acikca akiciyken
    return SEVIYE[m - 1];                                       // bir adim
  }
  // Kare araliklari (a[0..n-1]) -> { ortanca, tavanli }. tavanli: ortanca 1000/30 +-%10 bandinda ve karelerin en az %75'i
  // ayni bantta (sabit 30 Hz rAF: iOS Dusuk Guc / pil tasarrufu). Saf; a'yi siralar.
  function ozet(a, n) {
    var b = Array.prototype.slice.call(a, 0, n).sort(function (x, y) { return x - y; }), i, k = 0;
    var ort = n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
    var alt = OLCUM.tavanMs * (1 - OLCUM.tavanPay), ust = OLCUM.tavanMs * (1 + OLCUM.tavanPay);
    for (i = 0; i < n; i++) if (b[i] >= alt && b[i] <= ust) k++;
    return { ortanca: ort, tavanli: ort >= alt && ort <= ust && k >= OLCUM.tavanOran * n };
  }

  // ---- durum ----
  var kayit = oku();
  var zorla = null, olcZorla = false;
  if (yerelAdres()) {
    var arama = (window.location && typeof window.location.search === 'string') ? window.location.search : '';
    var mz = /[?&]kalite=(yuksek|orta|dusuk)(?:&|$)/.exec(arama);
    if (mz) zorla = mz[1];
    olcZorla = /[?&]kaliteOlc=1(?:&|$)/.test(arama);
  }
  var taban = ipucuSeviye();
  var etkin = null, aboneler = [];

  function hesapla() {
    if (zorla) return zorla;
    if (kayit.secim !== 'oto') return kayit.secim;
    return kayit.oto || taban;
  }
  function uygula() {
    var yeni = hesapla(), onceki = etkin;
    if (yeni === etkin) return;
    etkin = yeni;
    if (document.documentElement) document.documentElement.setAttribute('data-kalite', etkin);
    if (onceki === null) return;                                // ilk uygulama: bildirim yok
    for (var i = 0; i < aboneler.length; i++) { try { aboneler[i](etkin, onceki); } catch (e) { if (window.console) console.error(e); } }
    try { window.dispatchEvent(new CustomEvent('kalitedegisti', { detail: { seviye: etkin, onceki: onceki } })); } catch (e) { /* eski tarayici */ }
    arayuzYaz();
  }

  // ---- otomatik olcum (3 sn rAF ornegi; kare basina bellek ayirmaz: ornekler tek seferlik dizide) ----
  var olcuyor = false, ornek = null, acilisTekrar = false;
  function olcumYapilabilir() {
    if (zorla || kayit.secim !== 'oto' || olcuyor || !window.requestAnimationFrame) return false;
    if (otomasyon() && !olcZorla) return false;
    return true;
  }
  function olc(yalnizDusur, acilis) {
    if (!olcumYapilabilir()) return false;
    olcuyor = true;
    if (!ornek) ornek = window.Float64Array ? new Float64Array(OLCUM.enCokKare) : [];
    var bas = 0, son = 0, kare = 0;
    function adim(t) {
      if (document.hidden) { olcuyor = false; if (acilis) acilisTekrarKur(); return; }   // arka plana alindi: bu olcum gecersiz
      if (!bas) bas = t;
      // ilk OLCUM.atla ms atilir: market acilisi / Tempo baslangici / Suzul ilk dokunusu gecis ve kurulum takilmasi
      if (t - bas < OLCUM.atla) { son = t; window.requestAnimationFrame(adim); return; }
      if (son) { var d = t - son; if (d < OLCUM.bosluk && kare < OLCUM.enCokKare) ornek[kare++] = d; }
      son = t;
      // en az 3 sn ve 20 kare; cok yavas cihazda (kare > 150 ms) 20 kareyi en cok 10 sn bekler
      var g = t - bas - OLCUM.atla;
      if ((g < OLCUM.sure || kare < OLCUM.enAzKare) && g < OLCUM.enUzun) { window.requestAnimationFrame(adim); return; }
      olcuyor = false;
      if (kare < OLCUM.karar || kayit.secim !== 'oto' || zorla) return;
      var o = ozet(ornek, kare);
      var yeni = karar(o.ortanca, taban, kayit.oto || taban, !!yalnizDusur, o.tavanli);
      if (yeni !== kayit.oto) { kayit.oto = yeni; yaz(); }
      uygula();
    }
    window.requestAnimationFrame(adim);
    return true;
  }
  // Acilis olcumu sayfa gizlenince iptal olduysa: sayfa yeniden gorununce bir kez (gecikmeyle) tekrar
  function acilisTekrarKur() {
    if (acilisTekrar || !document.addEventListener) return;
    acilisTekrar = true;
    document.addEventListener('visibilitychange', function gorunur() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', gorunur);
      setTimeout(function () { olc(false); }, OLCUM.gecikme);
    });
  }
  function acilisOlcumu() { setTimeout(function () { olc(false, true); }, OLCUM.gecikme); }
  if (document.readyState === 'complete') acilisOlcumu();
  else window.addEventListener('load', acilisOlcumu);

  // ---- Ayarlar ekrani: "Grafik kalitesi" (index.html #kaliteSec) ----
  var AD = { oto: 'Otomatik', yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' };
  function arayuzYaz() {
    var kap = document.getElementById('kaliteSec');
    if (!kap) return;
    var d = kap.querySelectorAll('[data-kalite-sec]'), i, s;
    for (i = 0; i < d.length; i++) {
      s = d[i].getAttribute('data-kalite-sec') === kayit.secim;
      d[i].setAttribute('aria-checked', s ? 'true' : 'false');
      d[i].classList.toggle('secili', s);
    }
    var not = document.getElementById('kaliteNot');
    if (not) not.textContent = (kayit.secim === 'oto' ? 'Cihaza göre seçildi: ' + AD[etkin] + '. ' : '') +
      'Düşük kalite efektleri ve arka plan animasyonlarını sadeleştirir; oyun aynı kalır.';
  }
  function arayuzKur() {
    var kap = document.getElementById('kaliteSec');
    if (!kap) return;
    kap.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-kalite-sec]') : null;
      if (b) Kalite.sec(b.getAttribute('data-kalite-sec'));
    });
    arayuzYaz();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arayuzKur);
  else arayuzKur();

  var Kalite = {
    SEVIYELER: SEVIYE.slice(),
    seviye: function () { return etkin; },
    secim: function () { return kayit.secim; },
    sec: function (s) {
      if (SECIM.indexOf(s) < 0) return false;
      zorla = null;                                             // elle secim gelistirme zorlamasini da kaldirir
      kayit.secim = s; yaz();
      uygula(); arayuzYaz();
      if (s === 'oto') olc(false);
      return true;
    },
    // taban adet -> bu seviyede uretilecek adet (taban > 0 ise en az 1). Cagiran rastgele sayilari yine taban kadar cekmeli.
    parcacikSayisi: function (taban) {
      taban = Number(taban) || 0;
      if (taban <= 0) return 0;
      return Math.max(1, Math.round(taban * PARCACIK_ORAN[etkin]));
    },
    // taban adetlik dongunun i. ogesi uretilsin mi? (parcacikSayisi kadar oge, aralikta esit dagilir; yuksekte hep true).
    // Dongu rastgele sayilari bundan ONCE ceker: Math.random cagri sirasi seviyeden bagimsiz kalir.
    parcacikTut: function (i, taban) {
      var m = Kalite.parcacikSayisi(taban);
      if (m >= taban) return true;
      return Math.floor((i + 1) * m / taban) > Math.floor(i * m / taban);
    },
    efektAcikMi: function (ad) { var e = EFEKT[etkin]; return !!(e && e[ad]); },
    dprTavan: function () { return DPR_TAVAN[etkin]; },
    dpr: function () { return Math.min(window.devicePixelRatio || 1, DPR_TAVAN[etkin]); },
    abone: function (fn) {
      if (typeof fn !== 'function') return function () {};
      aboneler.push(fn);
      return function () { var i = aboneler.indexOf(fn); if (i >= 0) aboneler.splice(i, 1); };
    },
    olc: function () { return olc(true); },
    _karar: karar,
    _ozet: ozet,
    _OLCUM: OLCUM
  };
  window.Kalite = Kalite;
  uygula();
})();
