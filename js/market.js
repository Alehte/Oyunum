// market.js — MARKET mantik katmani.
// Sahiplik, satin alma, tema secimi, gunun seckisi, kutular ve oyunlarin
// kullandigi tema uygulayicilari burada. Ekran cizimi marketEkran.js icinde.
//
// Yuklenme sirasi: core.js -> marketKatalog.js -> market.js -> marketEkran.js
//
// KAYIT YERLESIMI (surum 2)
//   AppProgress.market = { surum:2, s:[temaId], a:temaId, ri:[temaId], v:{g,i}, h:'' }
//     s  : sahip olunan temalar        a : secili tema
//     ri : reklamla indirimi acilmis   v : gunun seckisi (dilim anahtari + idler)
//     h  : gunluk hediyenin alindigi gun
//   AppStore 'ait_noads' -> ilerleme ile SIFIRLANMAZ (gercek parayla alinir)
//
// Surum 1'de urunler 'oyun.tur.aile' bicimindeydi (tema basina 4-5 parca).
// kayitKur() eski kaydi bir kez yeni bicime cevirir; jeton/ilerleme silinmez.

window.AppMarket = (function () {
  'use strict';

  var K = window.AppMarketKatalog;
  if (!K) { console.error('market.js: marketKatalog.js yuklenmemis'); return {}; }

  var NOADS_ANAHTAR = 'ait_noads';
  var KAYIT_SURUM = 2;
  var INDIRIM_ORANI = 0.5;        // reklam izleyince fiyat yarilanir
  var VITRIN_SAAT = 4;            // secki kac saatte bir yenilenir
  var HEDIYE_JETON = [150, 400];  // gunluk hediye jeton araligi
  var VARSAYILAN_ID = 'varsayilan';
  var YERLESIK = { yerlesik: true };

  // Secki yuvalari. Her yuvada iki nadirlik var, %50/%50 seciliyor.
  var SLOT_HAVUZLARI = [
    ['siradan', 'nadir'],
    ['nadir', 'ender'],
    ['ender', 'efsanevi']
  ];
  var NADIRLIK_SIRA = ['siradan', 'nadir', 'ender', 'efsanevi'];

  // ---------------------------------------------------------------
  // INDEKS + DOGRULAMA
  // ---------------------------------------------------------------
  var TEMA = {};   // id -> tema

  // Kacis derilerinde hedef (yesil) yilanin vurgu rengi gercekten yesil mi?
  // Yesil yilan her temada digerlerinden ayirt edilebilir kalmali.
  function yesilMi(hex) {
    if (!hex || hex.charAt(0) !== '#' || hex.length !== 7) return false;
    var r = parseInt(hex.substr(1, 2), 16),
        g = parseInt(hex.substr(3, 2), 16),
        b = parseInt(hex.substr(5, 2), 16);
    return g > 90 && g > r + 30 && g > b + 20;
  }

  (function indeksle() {
    var i, t;
    for (i = 0; i < K.TEMALAR.length; i++) {
      t = K.TEMALAR[i];
      if (TEMA[t.id]) { console.warn('market: yinelenen tema, ikincisi atlandi ->', t.id); continue; }
      if (!t.varsayilan && (!t.deri || !t.deri.hedef || !yesilMi(t.deri.hedef.vurgu))) {
        console.warn('market: "' + t.id + '" hedef yilan icin yesil vurgu tanimlamamis, tema devre disi.');
        continue;
      }
      TEMA[t.id] = t;
    }
    if (!TEMA[VARSAYILAN_ID]) console.error('market: varsayilan tema yok.');
  })();

  function satilikTemalar() {
    return K.TEMALAR.filter(function (t) { return TEMA[t.id] === t && !t.varsayilan; });
  }

  // ---------------------------------------------------------------
  // KAYIT + GOC
  // ---------------------------------------------------------------
  var kayit;

  // Surum 1 -> 2. Eski envanterdeki her parca ailesine gore degerlendirilir:
  //   - aile yeni katalogda varsa oyuncu temanin TAMAMINA sahip olur
  //   - aile kaldirildiysa parca basina jeton iadesi yapilir
  // Secili tema: eski secimlerde en cok gecen (hala var olan) aile.
  function goc(eski) {
    var yeni = { surum: KAYIT_SURUM, s: [], a: VARSAYILAN_ID, ri: [], v: { g: '', i: [] }, h: '' };
    var iade = 0, i, aile, ak, oy = {}, en = 0;
    if (!eski || typeof eski !== 'object') return { kayit: yeni, iade: 0 };

    function aileOf(id) { return (typeof id === 'string') ? id.split('.')[2] : null; }

    if (eski.s instanceof Array) {
      for (i = 0; i < eski.s.length; i++) {
        aile = aileOf(eski.s[i]);
        if (!aile || aile === VARSAYILAN_ID) continue;
        if (TEMA[aile]) { if (yeni.s.indexOf(aile) < 0) yeni.s.push(aile); }
        else if (K.ESKI_AILE_IADE[aile]) iade += K.ESKI_AILE_IADE[aile];
      }
    }
    if (eski.ri instanceof Array) {
      for (i = 0; i < eski.ri.length; i++) {
        aile = aileOf(eski.ri[i]);
        if (aile && TEMA[aile] && yeni.s.indexOf(aile) < 0 && yeni.ri.indexOf(aile) < 0) yeni.ri.push(aile);
      }
    }
    if (eski.a && typeof eski.a === 'object') {
      for (ak in eski.a) {
        aile = aileOf(eski.a[ak]);
        if (!aile || aile === VARSAYILAN_ID || yeni.s.indexOf(aile) < 0) continue;
        oy[aile] = (oy[aile] || 0) + 1;
        if (oy[aile] > en) { en = oy[aile]; yeni.a = aile; }
      }
    }
    if (typeof eski.h === 'string') yeni.h = eski.h;
    return { kayit: yeni, iade: iade };
  }

  function kayitKur() {
    var m = window.AppProgress.market, degisti = false;

    if (!m || typeof m !== 'object') { m = { surum: KAYIT_SURUM }; }
    else if (m.surum !== KAYIT_SURUM) {
      var sonuc = goc(m);
      m = sonuc.kayit;
      degisti = true;
      if (sonuc.iade > 0) window.AppProgress.gold = (window.AppProgress.gold || 0) + sonuc.iade;
    }

    if (!(m.s instanceof Array)) m.s = [];
    if (!(m.ri instanceof Array)) m.ri = [];
    if (!m.v || typeof m.v !== 'object' || !(m.v.i instanceof Array)) m.v = { g: '', i: [] };
    if (typeof m.h !== 'string') m.h = '';
    // Katalogdan kalkmis id'leri sessizce temizle.
    m.s = m.s.filter(function (id) { return !!TEMA[id] && id !== VARSAYILAN_ID; });
    m.ri = m.ri.filter(function (id) { return !!TEMA[id]; });
    if (typeof m.a !== 'string' || !TEMA[m.a] || (m.a !== VARSAYILAN_ID && m.s.indexOf(m.a) < 0)) m.a = VARSAYILAN_ID;

    window.AppProgress.market = m;
    kayit = m;
    onbellegiTemizle();
    if (degisti) window.AppSaveProgress({ market: m, gold: window.AppProgress.gold });
  }

  function yaz() { window.AppSaveProgress({ market: kayit }); }

  // ---------------------------------------------------------------
  // REKLAM KATMANI (taslak)
  // Gercek reklam SDK'si geldiginde SADECE window.AppReklam degisecek,
  // market kodu ayni kalacak.
  // ---------------------------------------------------------------
  if (!window.AppReklam) {
    window.AppReklam = {
      gercek: false,
      odulluIzle: function (bitti) {
        // gercek reklam altyapisi yok: kisa bir beklemeden sonra odul verilir
        setTimeout(function () { bitti(true); }, 1200);
      }
    };
  }

  function reklamsizMi() {
    return window.AppStore ? !!window.AppStore.get(NOADS_ANAHTAR, false) : false;
  }
  function reklamsizYap() {
    if (window.AppStore) window.AppStore.set(NOADS_ANAHTAR, true);
  }

  // ---------------------------------------------------------------
  // SAHIPLIK / FIYAT / SECIM
  // ---------------------------------------------------------------
  function bul(id) { return TEMA[id] || null; }

  function sahipMi(id) {
    var t = TEMA[id];
    if (!t) return false;
    return !!t.varsayilan || kayit.s.indexOf(id) >= 0;
  }

  function indirimliMi(id) { return kayit.ri.indexOf(id) >= 0 && !sahipMi(id); }

  function temelFiyat(id) {
    var t = TEMA[id];
    if (!t || t.varsayilan) return 0;
    return (typeof t.fiyat === 'number') ? t.fiyat : K.NADIRLIK[t.nadirlik].fiyat;
  }

  function fiyat(id) {
    var f = temelFiyat(id);
    return indirimliMi(id) ? Math.round(f * INDIRIM_ORANI) : f;
  }

  // Reklam izleyerek bu temaya kalici indirim ac. Satin alinana kadar durur.
  function indirimAc(id, bitti) {
    bitti = bitti || function () {};
    if (!TEMA[id] || sahipMi(id) || indirimliMi(id)) { bitti(false); return; }
    window.AppReklam.odulluIzle(function (basarili) {
      if (!basarili) { bitti(false); return; }
      kayit.ri.push(id);
      yaz();
      bitti(true);
    });
  }

  function sahipYap(id) {
    if (kayit.s.indexOf(id) < 0) kayit.s.push(id);
    var ix = kayit.ri.indexOf(id);
    if (ix >= 0) kayit.ri.splice(ix, 1);   // indirim kullanildi / gereksizlesti
  }

  function satinAl(id) {
    if (!TEMA[id] || sahipMi(id)) return false;
    if (!window.AppGold.harca(fiyat(id))) return false;
    sahipYap(id);
    yaz();
    return true;
  }

  // Temayi sec: dort oyuna birden uygulanir.
  function sec(id) {
    if (!sahipMi(id)) return false;
    kayit.a = id;
    onbellegiTemizle();
    yaz();
    temayiYay();
    return true;
  }

  function seciliId() { return (kayit.a && TEMA[kayit.a]) ? kayit.a : VARSAYILAN_ID; }

  // ---------------------------------------------------------------
  // AKTIF TEMA — oyunlar cizim yaparken bunu okur.
  // aktif('kacis','deri') / ('h2048','karo') / ('tempo','blok') /
  // ('susirala','sise') / ('genel','ton'). Asla null donmez; en kotu
  // ihtimalle { yerlesik:true } doner. Sonuc onbellege alinir: tema
  // degismedikce AYNI nesne doner (uygulayicilar buna guvenip atlar).
  // ---------------------------------------------------------------
  var onbellek = {};
  function onbellegiTemizle() { onbellek = {}; }

  function aktif(oyun, tur) {
    if (onbellek[tur]) return onbellek[tur];
    var t = TEMA[seciliId()];
    var veri = (t && t[tur]) ? t[tur] : YERLESIK;
    onbellek[tur] = veri;
    return veri;
  }

  // ---------------------------------------------------------------
  // ORTAK YARDIMCILAR
  // ---------------------------------------------------------------
  // Zeminin parlakligi. Acik zeminli temalarda bos hucre kuyulari beyaz
  // uzerine beyaz kaliyordu; renk buna gore ters cevrilir.
  function zeminAcikMi(hex) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7) return false;
    var r = parseInt(hex.substr(1, 2), 16),
        g = parseInt(hex.substr(3, 2), 16),
        b = parseInt(hex.substr(5, 2), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
  }

  function rgbUclusu(hex) {
    if (!hex || hex.charAt(0) !== '#' || hex.length !== 7) return '47 224 122';
    return parseInt(hex.substr(1, 2), 16) + ' ' +
           parseInt(hex.substr(3, 2), 16) + ' ' +
           parseInt(hex.substr(5, 2), 16);
  }

  // Tema animasyonu: JS sadece adi yazar, hareketi style.css yapar.
  function animYaz(el, ad) {
    if (!el) return;
    if (ad) el.setAttribute('data-tema-anim', ad);
    else el.removeAttribute('data-tema-anim');
  }

  // MOTIF: JS sadece isaretleri yazar, sekli style.css (mask) cizer.
  function motifYaz(el, m) {
    if (!el) return;
    if (!m || !m.tip) {
      el.removeAttribute('data-motif');
      el.style.removeProperty('--motif-renk');
      el.style.removeProperty('--motif-opaklik');
      el.style.removeProperty('--motif-boy');
      el.style.removeProperty('--motif-tekrar');
      el.style.removeProperty('--motif-konum');
      return;
    }
    el.setAttribute('data-motif', m.tip);
    el.style.setProperty('--motif-renk', m.renk || '#FFFFFF');
    el.style.setProperty('--motif-opaklik', (m.opaklik == null) ? .22 : m.opaklik);
    el.style.setProperty('--motif-boy', m.boy || '22px');
    el.style.setProperty('--motif-tekrar', m.yerlesim === 'merkez' ? 'no-repeat' : 'repeat');
    el.style.setProperty('--motif-konum', m.yerlesim === 'merkez' ? 'center' : '0 0');
  }

  // Her uygulayicinin iki yuzu var:
  //   xYaz(el, veri)      -> VERILEN tema parcasini yazar (market onizlemesi)
  //   xTemasiUygula(el)   -> AKTIF temayi yazar (oyunlar)

  // ---------------------------------------------------------------
  // ANA EKRAN + MARKET RENK TONU
  // Oyun ekranlarinin arka planina dokunulmaz.
  // ---------------------------------------------------------------
  function tonYaz(el, v) {
    if (!el) return;
    if (!v || v.yerlesik || !v.css) {
      el.classList.remove('ton-var');
      el.style.removeProperty('--tema-ton');
      return;
    }
    el.style.setProperty('--tema-ton', v.css);
    el.classList.add('ton-var');
  }

  // ---------------------------------------------------------------
  // HEDEF 2048 KARO TEMASI — degiskenler .board uzerine yazilir.
  // ---------------------------------------------------------------
  var KARO_DEGERLERI = ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', 'wild', 'kilit', 'duvar'];

  function karoYaz(el, v) {
    if (!el) return;
    var i, d, p;
    // varsayilan tema: hicbir seyi ezme, CSS'teki mevcut renkler kalsin
    if (!v || v.yerlesik || !v.palet) {
      el.classList.remove('temali');
      for (i = 0; i < KARO_DEGERLERI.length; i++) {
        d = KARO_DEGERLERI[i];
        el.style.removeProperty('--tv-' + d + 'b');
        el.style.removeProperty('--tv-' + d + 'f');
      }
      el.style.removeProperty('--tema-zemin');
      el.style.removeProperty('--tema-bos');
      el.style.removeProperty('--tema-glow');
      el.removeAttribute('data-koyuluk');
      motifYaz(el, null);
      animYaz(el, null);
      return;
    }
    for (i = 0; i < KARO_DEGERLERI.length; i++) {
      d = KARO_DEGERLERI[i];
      p = v.palet[d];
      if (!p) continue;
      el.style.setProperty('--tv-' + d + 'b', p[0]);
      el.style.setProperty('--tv-' + d + 'f', p[1]);
    }
    var acik = zeminAcikMi(v.zemin);
    el.style.setProperty('--tema-zemin', v.zemin || '#182236');
    // bos hucre: acik zeminde koyu, koyu zeminde acik (tema isterse `bos` ile ezer)
    el.style.setProperty('--tema-bos', v.bos || (acik ? 'rgba(0,0,0,.11)' : 'rgba(255,255,255,.055)'));
    // .tile kendi --t-glow'unu tanimladigi icin parilti rengi --tema-glow ile tasinir
    el.style.setProperty('--tema-glow', rgbUclusu(v.palet['2048'] ? v.palet['2048'][0] : null));
    el.setAttribute('data-koyuluk', acik ? 'acik' : 'koyu');
    motifYaz(el, v.motif);
    animYaz(el, v.animasyon);
    el.classList.add('temali');
  }
  function karoTemasiUygula(el) { karoYaz(el, aktif('h2048', 'karo')); }

  // ---------------------------------------------------------------
  // KACIS YILAN DERISI
  // Her yilan TEK PARCA bir SVG cizgisidir (kacis.js kcGovdeCiz). Burasi o
  // cizginin katmanlarini kurar: kontur -> govde -> desen -> kahramanin
  // sirt seridi. Kontur ve serit govdenin ICINDE kalir; komsu hucreye tasmaz.
  // Kahraman (yesil yilan) her temada sirt seridiyle ayirt edilir; seridin
  // rengi temanin kendi `hedef.vurgu` tonudur.
  // ONEMLI: ozel bolumlerde cagrilmaz — kosul kacis.js icindedir.
  // ---------------------------------------------------------------
  function renkAc(hex, oran) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7) return '#FFFFFF';
    function k(i) { var x = parseInt(hex.substr(i, 2), 16); return Math.round(x + (255 - x) * oran); }
    return 'rgb(' + k(1) + ',' + k(3) + ',' + k(5) + ')';
  }

  // v: temanin `deri` parcasi (yerlesik/null ise oyunun kendi duz gorunumu).
  // Donen: noktalari (points) birlikte guncellenecek polyline listesi.
  function deriCizgileriYaz(svg, v, hedefMi, kalinlik, sira, varsayilanRenk) {
    var NS = 'http://www.w3.org/2000/svg', w = kalinlik, liste = [];
    function ekle(strok, kal, dash, duzUc) {
      var p = document.createElementNS(NS, 'polyline');
      p.setAttribute('stroke', strok);
      p.setAttribute('stroke-width', kal);
      if (dash) p.setAttribute('stroke-dasharray', dash);
      if (duzUc) p.style.strokeLinecap = 'butt';
      svg.appendChild(p);
      liste.push(p);
    }

    if (!v || v.yerlesik) {
      ekle(varsayilanRenk || '#888888', w);
      if (hedefMi) ekle(renkAc(varsayilanRenk, .58), w * 0.3);
      return liste;
    }
    var s = hedefMi ? v.hedef : v.govde;
    if (!s || !s.renkler || !s.renkler.length) { ekle(varsayilanRenk || '#888888', w); return liste; }

    var kenar = Math.max(1.5, w * 0.09), ic = w - kenar * 2;
    ekle(s.kontur || 'rgba(0,0,0,.35)', w);                       // kontur (govdenin dis halkasi)
    ekle(s.renkler[(sira || 0) % s.renkler.length], ic);          // govde
    if (s.tip === 'seritli')      ekle('rgba(0,0,0,.24)', ic, (w * 0.42) + ' ' + (w * 0.72), true);
    else if (s.tip === 'benekli') ekle('rgba(0,0,0,.22)', ic * 0.42, '0 ' + (w * 0.8));
    else if (s.tip === 'kristal') ekle('rgba(255,255,255,.34)', ic * 0.40, (w * 0.5) + ' ' + (w * 0.6));
    if (s.parlak && !hedefMi)     ekle('rgba(255,255,255,.20)', ic * 0.16);
    // kahramanin sirt seridi: 'damar' kesikli, digerleri duz
    if (hedefMi && s.vurgu) {
      if (s.vurguTip === 'damar') ekle(s.vurgu, ic * 0.36, (w * 0.34) + ' ' + (w * 0.5));
      else ekle(s.vurgu, ic * 0.36);
    }
    return liste;
  }

  // Aktif temanin katmanlari; tema secili degilse null (oyun kendi cizer).
  function deriCizgileri(svg, hedefMi, kalinlik, sira) {
    var v = aktif('kacis', 'deri');
    if (!v || v.yerlesik) return null;
    return deriCizgileriYaz(svg, v, hedefMi, kalinlik, sira);
  }

  // ---------------------------------------------------------------
  // TEMPO KUP BLOK TEMASI
  // Oyun hucrede renk SIRASINI tutar; rengi buradaki paletten okur. Kenar,
  // yaricap, motif tahta / tepsi / suruklenen parca kabina yazilir.
  // ---------------------------------------------------------------
  function blokPaleti() {
    var v = aktif('tempo', 'blok');
    if (!v || v.yerlesik || !v.renkler || !v.renkler.length) return null;
    return v.renkler;
  }

  function blokYaz(el, v) {
    if (!el) return;
    if (!v || v.yerlesik || !v.renkler) {
      el.classList.remove('temali', 'blok-parlak');
      el.style.removeProperty('--blok-kenar');
      el.style.removeProperty('--blok-yaricap');
      el.style.removeProperty('--tema-bos');
      motifYaz(el, null);
      animYaz(el, null);
      return;
    }
    el.style.setProperty('--blok-kenar', v.kenar || 'rgba(255,255,255,.14)');
    el.style.setProperty('--blok-yaricap', v.koseYaricap || '22%');
    if (v.bos) el.style.setProperty('--tema-bos', v.bos); else el.style.removeProperty('--tema-bos');
    el.classList.toggle('blok-parlak', !!v.parlama);
    motifYaz(el, v.motif);
    animYaz(el, v.animasyon);
    el.classList.add('temali');
  }

  function blokTemasiUygula(el) {
    if (!el) return;
    var v = aktif('tempo', 'blok');
    // aktif() tema degismedikce ayni nesneyi dondurur; oyun bunu sik cagirdigi
    // icin degismediyse hic dokunma (mirasli degiskenler stil hesabi tetikler)
    if (el._temaRef === v) return;
    el._temaRef = v;
    blokYaz(el, v);
  }

  // ---------------------------------------------------------------
  // SIRALA DUR SISE TEMASI
  // Tek bir cam sablonu var (style.css). Tema yalnizca su degiskenleri verir:
  //   cam tonu, kenar rengi, parlama siddeti, kapak bicimi + rengi.
  // Sivi renkleri HER ZAMAN oyunun kendi paletinden gelir; sise boyu,
  // kapasitesi, dokme animasyonu ve tiklama alani degismez.
  // ---------------------------------------------------------------
  var KAPAK_SEKILLER = {
    // duz vidali kapak
    duz: function (r) {
      return '<rect x="2" y="3" width="20" height="11" rx="2.6" fill="' + r + '"/>' +
             '<rect x="2" y="3" width="20" height="11" rx="2.6" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1"/>' +
             '<rect x="4" y="4.6" width="16" height="1.8" rx=".9" fill="#fff" opacity=".4"/>' +
             '<path d="M6 8.4v4M9 8.4v4M12 8.4v4M15 8.4v4M18 8.4v4" stroke="rgba(0,0,0,.2)" stroke-width="1" stroke-linecap="round"/>';
    },
    // mantar tipa
    mantar: function (r) {
      return '<path d="M5.4 2.6c0-1.3 2.2-1.9 6.6-1.9s6.6.6 6.6 1.9l-1 10.2c-.2 1.2-2.4 2-5.6 2s-5.4-.8-5.6-2z" fill="' + r + '"/>' +
             '<path d="M5.4 2.6c0-1.3 2.2-1.9 6.6-1.9s6.6.6 6.6 1.9l-1 10.2c-.2 1.2-2.4 2-5.6 2s-5.4-.8-5.6-2z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".9"/>' +
             '<ellipse cx="12" cy="2.7" rx="6" ry="1.5" fill="#fff" opacity=".28"/>' +
             '<path d="M8 6.2h.01M13 5.4h.01M16 8h.01M10 9.6h.01M14 11h.01" stroke="rgba(0,0,0,.28)" stroke-width="1.5" stroke-linecap="round"/>';
    },
    // metal halkali kapak
    halka: function (r) {
      return '<circle cx="12" cy="3.6" r="2.3" fill="none" stroke="#D9DEE6" stroke-width="1.5"/>' +
             '<path d="M4 8.2c0-2 3.4-3 8-3s8 1 8 3v3.6H4z" fill="' + r + '"/>' +
             '<path d="M4 8.2c0-2 3.4-3 8-3s8 1 8 3" fill="none" stroke="#fff" stroke-width="1" opacity=".35"/>' +
             '<rect x="2.6" y="10.6" width="18.8" height="4" rx="1.6" fill="#C9CFD9"/>' +
             '<rect x="2.6" y="10.6" width="18.8" height="4" rx="1.6" fill="none" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>' +
             '<rect x="4.4" y="11.4" width="15.2" height="1.1" rx=".55" fill="#fff" opacity=".65"/>';
    }
  };

  // SILUETLER — sise govdesinin dis hatti. Tek sise sablonunun bir parametresi:
  // 100x100'luk bir kutuda SVG yolu; sisenin gercek kutusuna (kapasiteye gore
  // boyu degisir) esnetilerek oturur. YALNIZCA GORSEL: sivilar yine ayni
  // yukseklikte dikdortgen katmanlardir, siluet onlari maskeyle keser;
  // kapasite, katman yuksekligi, dokunma alani ve dokme degismez.
  //   yol  : govdenin kapali dis hatti (agiz ustte)
  //   agiz : [sol, sag] agzin yatay sinirlari (kapak ve dudak buna gore oturur)
  // 'standart' siluetin yolu yoktur: duz tup (varsayilan + siradan temalar).
  var SILUETLER = {
    omuzlu:   { agiz: [22, 78], yol: 'M22 2V9C22 17 3 15 3 27V84C3 94 12 98.5 26 98.5H74C88 98.5 97 94 97 84V27C97 15 78 17 78 9V2Z' },
    bombeli:  { agiz: [18, 82], yol: 'M18 2V7C18 14 3 30 3 56C3 84 14 98.5 34 98.5H66C86 98.5 97 84 97 56C97 30 82 14 82 7V2Z' },
    damla:    { agiz: [25, 75], yol: 'M25 2V5C25 24 3 40 3 68C3 89 20 98.5 50 98.5C80 98.5 97 89 97 68C97 40 75 24 75 5V2Z' },
    vazo:     { agiz: [10, 90], yol: 'M10 2C10 8 26 9 26 16C26 26 3 34 3 54C3 76 18 90 22 98.5H78C82 90 97 76 97 54C97 34 74 26 74 16C74 9 90 8 90 2Z' },
    iksir:    { agiz: [29, 71], yol: 'M29 2V12C9 19 3 40 3 60C3 86 22 98.5 50 98.5C78 98.5 97 86 97 60C97 40 91 19 71 12V2Z' },
    kumSaati: { agiz: [5, 95],  yol: 'M5 2V14C5 34 28 40 28 50C28 60 3 66 3 84C3 94 12 98.5 26 98.5H74C88 98.5 97 94 97 84C97 66 72 60 72 50C72 40 95 34 95 14V2Z' }
  };

  // Siluetin uc katmani (CSS degiskeni olarak yazilir):
  //   maske : sisenin gorunen alani (sivilar + cam bununla kesilir)
  //   dolgu : cam tonu, sivilarin ARKASINDA
  //   cizgi : cam kenari + agiz dudagi, sivilarin USTUNDE
  function siluetKatmani(sl, dolgu, cizgi) {
    var dudak = '<rect x="' + (sl.agiz[0] - 5) + '" y="0.6" width="' + (sl.agiz[1] - sl.agiz[0] + 10) +
                '" height="4.6" rx="2" vector-effect="non-scaling-stroke" ';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<path d="' + sl.yol + '" fill="' + dolgu + '" stroke="' + cizgi + '" stroke-width="2" ' +
      'stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      (cizgi === 'none' ? '' : dudak + 'fill="' + cizgi + '"/>') + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function kapakSvgUret(sekil, renk) {
    var f = KAPAK_SEKILLER[sekil] || KAPAK_SEKILLER.duz;
    return '<svg class="ss-kapak-kapak" viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg">' +
           f(renk || '#D93A3A') + '</svg>';
  }

  // Aktif sise temasinin kapak SVG'si. Varsayilan temada kapak zaten
  // gizlidir (CSS); yine de guvenli bir deger doner.
  function siseKapakSvg() {
    var v = aktif('susirala', 'sise');
    if (!v || v.yerlesik) return kapakSvgUret('duz', '#D93A3A');
    return kapakSvgUret(v.kapak || 'duz', v.kapakRenk || '#D93A3A');
  }

  function siseYaz(el, v) {
    if (!el) return;
    if (!v || v.yerlesik) {
      el.classList.remove('temali');
      el.removeAttribute('data-sise-tema');
      el.removeAttribute('data-kapak');
      el.removeAttribute('data-siluet');
      el.style.removeProperty('--sise-maske');
      el.style.removeProperty('--sise-dolgu');
      el.style.removeProperty('--sise-cizgi');
      el.style.removeProperty('--agiz');
      el.style.removeProperty('--cam-ton');
      el.style.removeProperty('--cam-kenar');
      el.style.removeProperty('--cam-parlama');
      el.style.removeProperty('--kapak-renk');
      animYaz(el, null);
      return;
    }
    el.setAttribute('data-sise-tema', '1');
    el.setAttribute('data-kapak', v.kapak || 'duz');
    el.style.setProperty('--cam-ton', v.cam || 'rgba(226,236,255,.10)');
    el.style.setProperty('--cam-kenar', v.kenar || 'rgba(226,236,255,.42)');
    el.style.setProperty('--cam-parlama', (v.parlama == null) ? .3 : v.parlama);
    el.style.setProperty('--kapak-renk', v.kapakRenk || '#D93A3A');
    var sl = SILUETLER[v.siluet];
    if (sl) {
      el.setAttribute('data-siluet', v.siluet);
      el.style.setProperty('--sise-maske', siluetKatmani(sl, '#000', '#000'));
      el.style.setProperty('--sise-dolgu', siluetKatmani(sl, v.cam || 'rgba(226,236,255,.10)', 'none'));
      el.style.setProperty('--sise-cizgi', siluetKatmani(sl, 'none', v.kenar || 'rgba(226,236,255,.42)'));
      el.style.setProperty('--agiz', ((sl.agiz[1] - sl.agiz[0]) / 100 + 0.16).toFixed(2));   // kapak genisligi
    } else {
      el.removeAttribute('data-siluet');
      el.style.removeProperty('--sise-maske');
      el.style.removeProperty('--sise-dolgu');
      el.style.removeProperty('--sise-cizgi');
      el.style.removeProperty('--agiz');
    }
    animYaz(el, v.animasyon);
    el.classList.add('temali');
  }

  function siseTemasiUygula(el) {
    if (!el) return;
    var v = aktif('susirala', 'sise');
    siseYaz(el, v);
    // ozel modda erlenmayerler ayri kutuda durur; ayni cam stilini paylassinlar
    if (el.id === 'ssoSiseler') siseYaz(document.getElementById('ssoKaplar'), v);
  }

  // ---------------------------------------------------------------
  // TEMAYI CANLI EKRANLARA YAY — secim degisince ve acilista cagrilir.
  // Kacis yilanlari bolum yuklenirken, Tempo bloklari ekrana girerken
  // kendi uygulayicisini cagirir; burada kalici DOM dugumleri guncellenir.
  // ---------------------------------------------------------------
  function temayiYay() {
    tonYaz(document.querySelector('.phone'), aktif('genel', 'ton'));
    karoTemasiUygula(document.getElementById('board'));
    siseTemasiUygula(document.getElementById('ssTahta'));
    siseTemasiUygula(document.getElementById('ssoSiseler'));
    blokTemasiUygula(document.getElementById('tpBoard'));
    blokTemasiUygula(document.getElementById('tpTray'));
  }

  // ---------------------------------------------------------------
  // GUNUN SECKISI
  // Tohum tarihten uretilir -> sayfa yenilense de dilim icinde ayni secki cikar.
  // ---------------------------------------------------------------
  function bugun() {
    var d = new Date();
    var a = d.getMonth() + 1, g = d.getDate();
    return d.getFullYear() + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g;
  }

  // gun + o gunun kacinci dilimi
  function dilimAnahtari() {
    return bugun() + '-' + Math.floor(new Date().getHours() / VITRIN_SAAT);
  }

  function tohumla(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }

  function uretici(tohum) {
    var t = tohum >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Belirli nadirlikten (null = hepsi), sahip olunmayan ve henuz secilmemis temalar
  function havuz(nadirlik, secilmisler) {
    return satilikTemalar().filter(function (t) {
      if (nadirlik && t.nadirlik !== nadirlik) return false;
      return !sahipMi(t.id) && secilmisler.indexOf(t.id) < 0;
    }).map(function (t) { return t.id; });
  }

  function vitrinUret() {
    var rnd = uretici(tohumla('vitrin-' + dilimAnahtari()));
    var secilmisler = [], slot, ikili, n, h;
    for (slot = 0; slot < SLOT_HAVUZLARI.length; slot++) {
      ikili = SLOT_HAVUZLARI[slot];
      n = (rnd() < 0.5) ? ikili[0] : ikili[1];
      h = havuz(n, secilmisler);
      // O nadirlik tukendiyse yuvanin diger nadirligine, o da bossa genel havuza dus.
      if (!h.length) h = havuz(n === ikili[0] ? ikili[1] : ikili[0], secilmisler);
      if (!h.length) h = havuz(null, secilmisler);
      if (!h.length) break;                    // her sey toplanmis
      secilmisler.push(h[Math.floor(rnd() * h.length)]);
    }
    return secilmisler;
  }

  function vitrin() {
    if (kayit.v.g !== dilimAnahtari()) {
      kayit.v = { g: dilimAnahtari(), i: vitrinUret() };
      yaz();
    }
    return kayit.v.i.filter(function (id) { return !!TEMA[id]; });
  }

  // Seckinin yenilenmesine kalan sure (ms)
  function vitrinKalanMs() {
    var d = new Date();
    var sonraki = (Math.floor(d.getHours() / VITRIN_SAAT) + 1) * VITRIN_SAAT;
    var hedef = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    hedef.setHours(sonraki);
    return hedef.getTime() - d.getTime();
  }

  // ---------------------------------------------------------------
  // KUTULAR
  // Cekilis once nadirligi, sonra o nadirlikten bir temayi secer. Tema
  // zaten varsa nadirligine gore jeton iadesi yapilir. Cekilen kademe
  // katalogda bossa en yakin dolu kademeye dusulur. Toplanacak tema
  // kalmadiysa kutu hic acilmaz, jeton harcanmaz.
  // ---------------------------------------------------------------
  function sandikBul(sid) {
    for (var i = 0; i < K.SANDIKLAR.length; i++) if (K.SANDIKLAR[i].id === sid) return K.SANDIKLAR[i];
    return null;
  }

  function nadirlikCek(ihtimal) {
    var r = Math.random(), t = 0, i, n;
    for (i = 0; i < NADIRLIK_SIRA.length; i++) {
      n = NADIRLIK_SIRA[i];
      t += (ihtimal[n] || 0);
      if (r < t) return n;
    }
    return 'siradan';
  }

  function kademeTemalari(n) {
    return satilikTemalar().filter(function (t) { return t.nadirlik === n; });
  }

  function kalanVarMi() {
    return satilikTemalar().some(function (t) { return !sahipMi(t.id); });
  }

  // { tur:'tema', tema }  |  { tur:'iade', tema, jeton }  |  { tur:'kapali' }  |  null (jeton yetmedi)
  function sandikAc(sid) {
    var s = sandikBul(sid);
    if (!s) return null;
    if (!kalanVarMi()) return { tur: 'kapali' };
    if (!window.AppGold.harca(s.fiyat)) return null;

    var kademe = nadirlikCek(s.ihtimal), liste = kademeTemalari(kademe), ix, mesafe, k;
    if (!liste.length) {
      ix = NADIRLIK_SIRA.indexOf(kademe);
      for (mesafe = 1; mesafe < NADIRLIK_SIRA.length && !liste.length; mesafe++) {
        for (k = 0; k < 2 && !liste.length; k++) {
          var aday = NADIRLIK_SIRA[ix + (k === 0 ? -mesafe : mesafe)];
          if (aday) liste = kademeTemalari(aday);
        }
      }
    }
    if (!liste.length) { window.AppGold.add(s.fiyat); return { tur: 'kapali' }; }

    var tema = liste[Math.floor(Math.random() * liste.length)];
    if (sahipMi(tema.id)) {
      var iade = K.NADIRLIK[tema.nadirlik].iade || 0;
      window.AppGold.add(iade);
      return { tur: 'iade', tema: tema, jeton: iade };
    }
    sahipYap(tema.id);
    yaz();
    return { tur: 'tema', tema: tema };
  }

  // ---------------------------------------------------------------
  // GUNLUK HEDIYE — reklam izleyerek gunde bir kez
  // ---------------------------------------------------------------
  function hediyeHazirMi() { return kayit.h !== bugun(); }

  function hediyeAl(bitti) {
    bitti = bitti || function () {};
    if (!hediyeHazirMi()) { bitti(null); return; }
    window.AppReklam.odulluIzle(function (basarili) {
      if (!basarili) { bitti(null); return; }
      var j = HEDIYE_JETON[0] + Math.floor(Math.random() * (HEDIYE_JETON[1] - HEDIYE_JETON[0] + 1));
      j = Math.round(j / 10) * 10;
      window.AppGold.add(j);
      kayit.h = bugun();
      yaz();
      bitti({ jeton: j });
    });
  }

  function hediyeKalanMs() {
    if (hediyeHazirMi()) return 0;
    var d = new Date();
    var yarin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return yarin.getTime() - d.getTime();
  }

  // ---------------------------------------------------------------
  // ACILIS
  // ---------------------------------------------------------------
  kayitKur();
  temayiYay();

  // "Ilerlemeyi Sifirla" sonrasi AppProgress bastan kuruluyor; market kaydini
  // yeniden olustur. (NO ADS ayri anahtarda oldugu icin etkilenmez.)
  if (window.AppReset instanceof Array) {
    window.AppReset.push(function () { kayitKur(); temayiYay(); });
  }

  // ---------------------------------------------------------------
  // DIS API
  // ---------------------------------------------------------------
  return {
    // tema katalogu / sahiplik
    temalar: function () { return K.TEMALAR.filter(function (t) { return TEMA[t.id] === t; }); },
    bul: bul,
    sahipMi: sahipMi,
    satinAl: satinAl,
    sec: sec,
    seciliId: seciliId,
    aktif: aktif,
    nadirlikBilgi: function (n) { return K.NADIRLIK[n]; },
    fiyat: fiyat,
    temelFiyat: temelFiyat,
    indirimliMi: indirimliMi,
    indirimAc: indirimAc,
    toplama: function () {
      var t = satilikTemalar();
      return { sahip: t.filter(function (x) { return sahipMi(x.id); }).length, toplam: t.length };
    },

    // magaza
    vitrin: vitrin,
    vitrinKalanMs: vitrinKalanMs,
    sandiklar: function () { return K.SANDIKLAR; },
    sandikBul: sandikBul,
    sandikAc: sandikAc,
    kalanVarMi: kalanVarMi,
    hediyeHazirMi: hediyeHazirMi,
    hediyeAl: hediyeAl,
    hediyeKalanMs: hediyeKalanMs,
    reklamsizMi: reklamsizMi,
    reklamsizYap: reklamsizYap,

    // oyun baglantilari (aktif tema)
    karoTemasiUygula: karoTemasiUygula,
    deriCizgileri: deriCizgileri,
    blokPaleti: blokPaleti,
    blokTemasiUygula: blokTemasiUygula,
    siseTemasiUygula: siseTemasiUygula,
    siseKapakSvg: siseKapakSvg,
    temayiYay: temayiYay,

    // onizleme (verilen tema parcasi)
    tonYaz: tonYaz,
    karoYaz: karoYaz,
    deriCizgileriYaz: deriCizgileriYaz,
    blokYaz: blokYaz,
    siseYaz: siseYaz,
    kapakSvgUret: kapakSvgUret,

    ekraniAc: function () { if (window.MarketEkran && window.MarketEkran.ac) window.MarketEkran.ac(); }
  };
})();
