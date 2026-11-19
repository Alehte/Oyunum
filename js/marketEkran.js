// marketEkran.js — MARKET'in gorunen yuzu.
// Sadece DOM isi yapar; sahiplik/fiyat/secki/kutu sorularini AppMarket'e sorar.
//
// MAGAZA   : reklamsiz -> gunluk hediye -> kutular -> gunun seckisi (4 saatte bir)
// ENVANTER : butun temalar; sahip olunanlar "Kullan", digerleri kilitli
//
// ONIZLEME : kartlarda elle cizilmis resim YOK. Temanin gercek oyun nesneleri
// (2048 karosu, Kacis yilani, Tempo blogu, Sirala Dur sisesi) oyunlardaki
// AYNI siniflarla kucuk olcekte kurulur ve temanin degiskenleri uzerlerine
// yazilir. Kartta ne goruluyorsa oyunda da o cikar.
//
// Dogrudan satin alinabilen TEK yer gunun seckisidir; geri kalani kutudan cikar.

window.MarketEkran = (function () {
  'use strict';

  var M = window.AppMarket;
  if (!M || !M.temalar) { console.error('marketEkran.js: market.js yuklenmemis'); return {}; }

  var mod = 'magaza';                 // 'magaza' | 'envanter'
  var kuruldu = false;
  var sayacId = null;
  var el = {};

  function q(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------
  // IKONLAR
  // ---------------------------------------------------------------
  var KAMERA_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7Z"/>' +
    '<rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
  var KILIT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/>' +
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  function koyulastir(hex) {
    var r = parseInt(hex.substr(1, 2), 16),
        g = parseInt(hex.substr(3, 2), 16),
        b = parseInt(hex.substr(5, 2), 16);
    function d(x) { x = Math.round(x * 0.42); return (x < 16 ? '0' : '') + x.toString(16); }
    return '#' + d(r) + d(g) + d(b);
  }

  function sandikSVG(renk, koyu) {
    return '<svg class="mk-sandik-svg" viewBox="0 0 64 54" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="24" width="52" height="26" rx="3" fill="' + renk + '"/>' +
      '<path d="M6 24V17a26 26 0 0 1 52 0v7Z" fill="' + renk + '"/>' +
      '<path d="M12 21a20 20 0 0 1 21-14" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".4"/>' +
      '<rect x="27" y="17" width="10" height="33" fill="' + koyu + '" opacity=".55"/>' +
      '<rect x="6" y="24" width="52" height="26" rx="3" fill="none" stroke="' + koyu + '" stroke-width="2.4"/>' +
      '<path d="M6 24V17a26 26 0 0 1 52 0v7Z" fill="none" stroke="' + koyu + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<rect x="24" y="28" width="16" height="13" rx="2.5" fill="' + koyu + '"/>' +
      '<circle cx="32" cy="34" r="2.6" fill="' + renk + '"/>' +
      '</svg>';
  }

  // ---------------------------------------------------------------
  // ONIZLEME — gercek oyun nesneleri, kucuk olcekte
  // Varsayilan temada oyunlarin kendi renkleri gerekir; onlar oyun
  // dosyalarinda durdugu icin (ve oyunlar tembel yuklendigi icin) burada
  // yalnizca onizleme amacli birer kopyasi tutulur.
  // ---------------------------------------------------------------
  var OZ = {
    blokRenk: ['#5CC8FF', '#B58CFF', '#FFCF5C', '#4FE39A', '#FF7F92'],   // tempoKup.js RENKLER
    yilanRenk: ['#E0954B', '#8B6FCB'], hedefRenk: '#3FA65C',             // bolumler.js
    sivi: ['#E30A17', '#3AA8E0', '#F2C14E']                              // suSiralaOyun.js RENKLER
  };

  function kutu(sinif, ana) {
    var d = document.createElement('div');
    if (sinif) d.className = sinif;
    if (ana) ana.appendChild(d);
    return d;
  }

  // --- Hedef 2048: 2x2 mini tahta ---
  function karoSahnesi(ana, tema) {
    var sahne = kutu('mo-sahne', ana);
    var tahta = kutu('board mo-board', sahne);
    [['2', 13], ['16', 12], ['256', 9.5], ['2048', 8]].forEach(function (k) {
      var t = kutu('tile', tahta);
      t.setAttribute('data-v', k[0]);
      t.textContent = k[0];
      t.style.fontSize = k[1] + 'px';
    });
    M.karoYaz(tahta, tema.karo);
  }

  // --- Kacis?: iki govde yilani + kahraman. Oyundaki gibi her yilan tek
  //     parca SVG cizgisi; katmanlari oyunla AYNI fonksiyon kurar. ---
  function yilanSahnesi(ana, tema) {
    var sahne = kutu('mo-sahne', ana);
    var alan = kutu('mo-yilan', sahne);
    var ADIM = 15, KAL = 12.5, NS = 'http://www.w3.org/2000/svg';
    var yilanlar = [
      { h: [[0, 0], [0, 1], [0, 2]], yon: 'sag', hedef: false },
      { h: [[1, 3], [2, 3]], yon: 'asagi', hedef: false },
      { h: [[3, 0], [3, 1], [3, 2]], yon: 'sag', hedef: true }
    ];
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'kc-govde');
    svg.setAttribute('viewBox', '0 0 60 60');
    svg.style.cssText = 'left:0; top:0; width:100%; height:100%;';
    alan.appendChild(svg);
    function merkez(v) { return v * ADIM + 7.5; }
    yilanlar.forEach(function (y, si) {
      var noktalar = y.h.map(function (hc) { return merkez(hc[1]) + ',' + merkez(hc[0]); }).join(' ');
      M.deriCizgileriYaz(svg, tema.deri, y.hedef, KAL, si,
        y.hedef ? OZ.hedefRenk : OZ.yilanRenk[si % OZ.yilanRenk.length]
      ).forEach(function (p) { p.setAttribute('points', noktalar); });
      // kafa: iki goz
      var kafa = y.h[y.h.length - 1], kx = merkez(kafa[1]), ky = merkez(kafa[0]);
      for (var g = 0; g < 2; g++) {
        var goz = document.createElement('span');
        goz.className = 'kc-eye';
        goz.style.width = goz.style.height = '3.6px';
        var yan = (g ? 2.6 : -2.6);
        goz.style.left = (y.yon === 'sag' ? kx + 2 : kx + yan) - 1.8 + 'px';
        goz.style.top = (y.yon === 'sag' ? ky + yan : ky + 2) - 1.8 + 'px';
        alan.appendChild(goz);
      }
    });
  }

  // --- Tempo Kup: 3x3 mini tahta, birkac blok ---
  function blokSahnesi(ana, tema) {
    var sahne = kutu('mo-sahne', ana);
    var izgara = kutu('mo-bloklar', sahne);
    var p = (tema.blok && tema.blok.renkler) ? tema.blok.renkler : OZ.blokRenk;
    //  0 0 1
    //  0 . 1
    //  2 2 .
    var desen = [0, 0, 1, 0, -1, 1, 2, 2, -1];
    desen.forEach(function (d) {
      var h = kutu('tp-cell' + (d >= 0 ? ' tp-blok filled' : ''), izgara);
      if (d >= 0) h.style.backgroundColor = p[d % p.length];
    });
    M.blokYaz(izgara, tema.blok);
  }

  // --- Sirala Dur: bir karisik, bir tamamlanmis (kapakli) sise ---
  function siseSahnesi(ana, tema) {
    var sahne = kutu('mo-sahne', ana);
    var tahta = kutu('ss-tahta mo-siseler', sahne);
    var KAT = 12, v = tema.sise || {};
    tahta.style.setProperty('--ss-kat', KAT + 'px');   // siluetli sivi kirpmasi icin
    [[0, 1, 2], [1, 1, 1]].forEach(function (icerik, i) {
      var yuva = kutu('ss-yuva', tahta);
      yuva.style.height = (3 * KAT + 14) + 'px';
      var tup = kutu('ss-tup' + (i === 1 ? ' ss-tamam' : ''), yuva);
      tup.style.height = (3 * KAT + 6) + 'px';
      icerik.forEach(function (renkSira) {
        var s = kutu('ss-sivi', tup);
        s.style.height = KAT + 'px';
        s.style.setProperty('--ss-renk', OZ.sivi[renkSira]);
      });
      var kapak = kutu('ss-kapak' + (i === 1 ? ' oturdu' : ''), yuva);
      kapak.style.bottom = (3 * KAT + 6) + 'px';
      kapak.innerHTML = v.yerlesik ? '' : M.kapakSvgUret(v.kapak, v.kapakRenk);
    });
    M.siseYaz(tahta, tema.sise);
  }

  // --- Ates Bocegi: 58x58 inline SVG (tasarim 7.6). Renk gercek isikCoz
  // ciktisindan gelir; engel (dal) renkleri CSS'te (.mo-ates-dal) sabittir.
  var ATES_SAYAC = 0;
  function hexKaristir(a, b, t) {
    var s = '#', i, x, y, v;
    for (i = 1; i < 7; i += 2) {
      x = parseInt(a.substr(i, 2), 16); y = parseInt(b.substr(i, 2), 16);
      v = Math.round(x + (y - x) * t);
      s += (v < 16 ? '0' : '') + v.toString(16);
    }
    return s;
  }
  function atesIzDamgalari(iz) {
    var s = '', i, x, a, r = iz.renkler || [iz.renk, iz.renk2];
    for (i = 0; i < 4; i++) {
      x = 24 - i * 5.5; a = (0.6 - i * 0.12).toFixed(2);
      if (iz.sekil === 'damla') {
        s += '<path d="M' + x + ' 26.2C' + (x + 1.8) + ' 28.4 ' + (x + 1.8) + ' 30.2 ' + x + ' 30.6C' + (x - 1.8) + ' 30.2 ' + (x - 1.8) + ' 28.4 ' + x + ' 26.2Z" fill="' + iz.renk + '" opacity="' + a + '"/>';
      } else if (iz.sekil === 'baklava') {
        s += '<path d="M' + x + ' 26.6L' + (x + 2.2) + ' 29L' + x + ' 31.4L' + (x - 2.2) + ' 29Z" fill="' + r[i % r.length] + '" stroke="#0E1018" stroke-width=".5" opacity="' + a + '"/>';
      } else if (iz.sekil === 'akkor') {
        s += '<rect x="' + (x - 2.6) + '" y="27.2" width="5.2" height="3.6" rx="1.8" fill="' + iz.renk + '" opacity="' + a + '"/>' +
             '<rect x="' + (x - 2.2) + '" y="28.3" width="4.4" height="1.4" rx=".7" fill="' + iz.renk2 + '" opacity="' + a + '"/>';
      } else {
        s += '<rect x="' + (x - 2.6) + '" y="28.1" width="5.2" height="1.8" rx=".9" fill="' + iz.renk + '" opacity="' + a + '"/>';
      }
    }
    return s;
  }
  function atesSahnesi(ana, tema) {
    var sahne = kutu('mo-sahne mo-ates', ana);
    var p = M.isikCoz(tema.isik), id = 'moAtes' + (++ATES_SAYAC);
    var zemin = hexKaristir('#162A1E', p.isik, 0.06);
    sahne.innerHTML =
      '<svg viewBox="0 0 58 58" aria-hidden="true" focusable="false">' +
      '<defs><radialGradient id="' + id + 'z"><stop offset=".72" stop-color="' + zemin + '"/><stop offset="1" stop-color="' + zemin + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'p"><stop offset="0" stop-color="' + p.isik + '" stop-opacity=".35"/><stop offset="1" stop-color="' + p.isik + '" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="29" cy="29" r="22" fill="url(#' + id + 'z)"/>' +
      '<g class="mo-ates-iz' + (p.animasyon ? ' ' + p.animasyon : '') + '">' + atesIzDamgalari(p.iz) + '</g>' +
      '<circle cx="31" cy="29" r="13" fill="url(#' + id + 'p)"/>' +
      '<circle cx="39.5" cy="21.5" r="1.4" fill="' + p.toz + '"/><circle cx="43" cy="35" r="1.4" fill="' + p.toz + '"/><circle cx="37" cy="41.5" r="1.4" fill="' + p.toz + '"/>' +
      '<ellipse cx="29.5" cy="26" rx="1.6" ry="4" fill="#fff" opacity=".4" transform="rotate(-30 29.5 26)"/>' +
      '<ellipse cx="32.5" cy="25" rx="1.6" ry="4" fill="#fff" opacity=".3" transform="rotate(25 32.5 25)"/>' +
      '<ellipse cx="29.5" cy="29.5" rx="4.6" ry="3" fill="#1A1410" stroke="#fff" stroke-opacity=".35" stroke-width=".4"/>' +
      '<ellipse cx="26.6" cy="29.5" rx="2.2" ry="1.7" fill="' + p.isik + '"/>' +
      '<ellipse cx="31" cy="29.5" rx="3" ry="2.4" fill="#2E2219" stroke="#fff" stroke-opacity=".35" stroke-width=".4"/>' +
      '<circle cx="35" cy="29" r="2" fill="#1A1410" stroke="#fff" stroke-opacity=".35" stroke-width=".4"/>' +
      '<path class="mo-ates-dal" d="M52 10H56V48H52Z M52 20L47.5 17.5L52 16Z M52 35L47.5 32.5L52 31Z"/>' +
      '</svg>';
  }

  function onizlemeKur(kap, tema) {
    kap.innerHTML = '';
    M.tonYaz(kap, tema.ton);
    karoSahnesi(kap, tema);
    yilanSahnesi(kap, tema);
    blokSahnesi(kap, tema);
    siseSahnesi(kap, tema);
    atesSahnesi(kap, tema);
  }

  // HTML metniyle basilan kartlardaki bos onizleme kutularini doldur
  function onizlemeleriDoldur(kok) {
    var kutular = kok.querySelectorAll('.mk-onizleme[data-tema]'), i, t;
    for (i = 0; i < kutular.length; i++) {
      t = M.bul(kutular[i].getAttribute('data-tema'));
      if (t) onizlemeKur(kutular[i], t);
      kutular[i].removeAttribute('data-tema');
    }
  }

  // ---------------------------------------------------------------
  // KURULUM
  // ---------------------------------------------------------------
  function kur() {
    if (kuruldu) return;

    el.govde     = q('mkGovde');
    el.ustSekme  = q('mkUstSekme');
    el.magaza    = q('mkMagaza');
    el.envanter  = q('mkEnvanter');
    el.noads     = q('mkNoAds');
    el.hediye    = q('mkHediye');
    el.sandiklar = q('mkSandiklar');
    el.vitrin    = q('mkVitrin');
    el.sayac     = q('mkVitrinSayac');
    el.koleksiyon = q('mkKoleksiyon');
    el.izgara    = q('mkIzgara');
    el.sonuc     = q('mkSonuc');
    el.toast     = q('mkToast');
    if (!el.govde) { console.error('marketEkran: screen-market HTML bloklari eksik'); return; }

    el.ustSekme.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mod]');
      if (b) modDegistir(b.getAttribute('data-mod'));
    });
    el.govde.addEventListener('click', tikla);
    el.sonuc.addEventListener('click', function (e) {
      if (e.target.closest('[data-eylem]')) { tikla(e); return; }
      if (e.target === el.sonuc) sonucKapat();
    });

    var geri = q('marketBackBtn');
    if (geri) geri.addEventListener('click', kapat);

    var giris = q('marketRow');
    if (giris) {
      giris.addEventListener('click', ac);
      giris.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') ac();
      });
    }
    kuruldu = true;
  }

  function modDegistir(yeni) {
    mod = yeni;
    var b = el.ustSekme.querySelectorAll('[data-mod]'), i;
    for (i = 0; i < b.length; i++) b[i].classList.toggle('aktif', b[i].getAttribute('data-mod') === mod);
    el.magaza.style.display   = (mod === 'magaza') ? '' : 'none';
    el.envanter.style.display = (mod === 'envanter') ? '' : 'none';
    el.govde.scrollTop = 0;
    ciz();
  }

  // ---------------------------------------------------------------
  // TIKLAMA
  // ---------------------------------------------------------------
  function ses(a, b, sure, guc) { if (window.AppFX) window.AppFX.tone(a, b, sure, 'triangle', guc); }
  function titre(p) { if (window.AppFX) window.AppFX.vibrate(p); }   // titresim ayari kapaliysa AppFX susar

  // Yeni tema (satin alma ya da kutu) kutlamasi: karttan sacilan konfeti.
  // Yalnizca transform/opacity canlanir; "hareketi azalt" aciksa hic calismaz.
  var KONFETI_RENK = ['#7FE6DC', '#B78BFF', '#FFD166', '#4FE39A', '#FF7F92', '#6FD3FF'];
  function konfeti(nadirlik) {
    if (document.querySelector('.phone.reduced-motion')) return;
    var adet = { siradan: 28, nadir: 36, ender: 46, efsanevi: 60 }[nadirlik] || 28, i, e, aci, uzak;
    var kat = document.createElement('div');
    kat.className = 'mk-konfeti-kat';
    el.sonuc.appendChild(kat);
    for (i = 0; i < adet; i++) {
      e = document.createElement('i');
      aci = Math.random() * Math.PI * 2; uzak = 90 + Math.random() * 190;
      e.style.backgroundColor = KONFETI_RENK[i % KONFETI_RENK.length];
      e.style.setProperty('--dx', (Math.cos(aci) * uzak).toFixed(0) + 'px');
      e.style.setProperty('--dy', (Math.sin(aci) * uzak + 60).toFixed(0) + 'px');
      e.style.setProperty('--don', Math.round(Math.random() * 720 - 360) + 'deg');
      e.style.animationDelay = Math.round(Math.random() * 160) + 'ms';
      kat.appendChild(e);
    }
    setTimeout(function () { if (kat.parentNode) kat.parentNode.removeChild(kat); }, 1700);
  }

  function tikla(e) {
    var b = e.target.closest('[data-eylem]');
    if (!b || b.disabled) return;
    var eylem = b.getAttribute('data-eylem');
    var id = b.getAttribute('data-id');

    if (eylem === 'sonucKapat') { sonucKapat(); return; }

    if (eylem === 'al') {
      if (M.satinAl(id)) {
        ses(660, 990, .18, .18);
        titre([14, 40, 22]);
        sonucGoster({ tur: 'tema', tema: M.bul(id), satinAlma: true });
        ciz();
      } else {
        if (window.AppFX) window.AppFX.vibrate(28);
        mesaj('Jeton yetmiyor');
      }
      return;
    }

    if (eylem === 'sec') {
      if (M.sec(id)) {            // sec() temayi butun oyunlara kendisi yayar
        ses(520, 780, .14, .14);
        sonucKapat();
        mesaj(M.bul(id).ad + ' teması kullanılıyor');
        ciz();
        if (mod === 'envanter') el.govde.scrollTop = 0;
      }
      return;
    }

    if (eylem === 'indirim') {
      b.disabled = true;
      b.classList.add('bekliyor');
      M.indirimAc(id, function (oldu) {
        if (oldu) { mesaj('İndirim açıldı'); ciz(); }
        else { b.disabled = false; b.classList.remove('bekliyor'); mesaj('Reklam tamamlanmadı'); }
      });
      return;
    }

    if (eylem === 'sandik') {
      var s = M.sandikBul(id);
      if (!s) return;
      if (window.AppGold.get() < s.fiyat) {
        if (window.AppFX) window.AppFX.vibrate(28);
        mesaj('Jeton yetmiyor');
        return;
      }
      var sonuc = M.sandikAc(id);
      if (!sonuc) { mesaj('Kutu açılamadı'); return; }
      if (sonuc.tur === 'kapali') { mesaj(sonuc.durum === 'bos' ? 'Bu kutudan çıkacak tema kalmadı' : 'Koleksiyon tamam'); return; }
      if (window.AppFX) window.AppFX.seq([[520, .12, .16, 0], [720, .12, .16, 110], [980, .22, .18, 220]], 'triangle');
      titre([14, 40, 14, 40, 26]);
      sonucGoster(sonuc);
      ciz();
      return;
    }

    if (eylem === 'hediye') {
      b.disabled = true;
      b.classList.add('bekliyor');
      M.hediyeAl(function (odul) {
        if (odul) {
          ses(700, 1050, .2, .18);
          sonucGoster({ tur: 'jeton', jeton: odul.jeton });
        } else {
          mesaj('Reklam tamamlanmadı');
        }
        ciz();
      });
      return;
    }

    if (eylem === 'noads') {
      // TODO: gercek satin alma akisi. Odeme altyapisi baglaninca burasi degisecek.
      mesaj('Satın alma yakında eklenecek');
      return;
    }
  }

  var toastId = null;
  function mesaj(m) {
    if (!el.toast) return;
    el.toast.textContent = m;
    el.toast.classList.add('gorunur');
    clearTimeout(toastId);
    toastId = setTimeout(function () { el.toast.classList.remove('gorunur'); }, 1800);
  }

  // ---------------------------------------------------------------
  // KUTU / HEDIYE / SATIN ALMA SONUCU
  // ---------------------------------------------------------------
  function sonucGoster(sonuc) {
    var ic, t, n;
    if (sonuc.tur === 'tema') {
      t = sonuc.tema; n = M.nadirlikBilgi(t.nadirlik);
      ic = '<div class="mk-sonuc-kart" data-nadirlik="' + t.nadirlik + '">' +
           '<div class="mk-sonuc-ust">' + (sonuc.satinAlma ? 'Satın alındı' : 'Yeni tema') + ' · ' + n.ad + '</div>' +
           '<div class="mk-onizleme" data-tema="' + t.id + '"></div>' +
           '<div class="mk-sonuc-ad">' + t.ad + '</div>' +
           '<div class="mk-sonuc-kat">Beş oyunda birden geçerli</div>' +
           '<button class="mk-sonuc-btn" data-eylem="sec" data-id="' + t.id + '">Hemen Kullan</button>' +
           '<button class="mk-sonuc-btn ikincil" data-eylem="sonucKapat">Sonra</button></div>';
    } else {
      ic = '<div class="mk-sonuc-kart" data-nadirlik="efsanevi">' +
           '<div class="mk-sonuc-ust">Günlük Hediye</div>' +
           '<div class="mk-sonuc-jeton">' + window.CoinSVG(true) + '<span>+' + sonuc.jeton + '</span></div>' +
           '<div class="mk-sonuc-kat">Yarın yine bekleriz</div>' +
           '<button class="mk-sonuc-btn" data-eylem="sonucKapat">Tamam</button></div>';
    }
    el.sonuc.innerHTML = ic;
    onizlemeleriDoldur(el.sonuc);
    el.sonuc.classList.add('gorunur');
    if (sonuc.tur === 'tema') konfeti(sonuc.tema.nadirlik);
  }

  function sonucKapat() {
    el.sonuc.classList.remove('gorunur');
    el.sonuc.innerHTML = '';
  }

  // ---------------------------------------------------------------
  // KART
  // ---------------------------------------------------------------
  function kart(tema, satilikMi) {
    var n = M.nadirlikBilgi(tema.nadirlik);
    var sahip = M.sahipMi(tema.id);
    var secili = M.seciliId() === tema.id;

    var s = '<div class="mk-kart' + (sahip || satilikMi ? '' : ' kilitli') + (secili ? ' secili' : '') +
            '" data-nadirlik="' + tema.nadirlik + '">';
    s += '<div class="mk-onizleme" data-tema="' + tema.id + '"></div>';
    s += '<div class="mk-kart-alt"><div class="mk-kart-bilgi"><div class="mk-ad">' + tema.ad + '</div>' +
         '<div class="mk-nadirlik">' + (tema.varsayilan ? 'Başlangıç' : n.ad) + '</div></div>';
    s += '<div class="mk-kart-eylem">';

    if (sahip && secili) {
      s += '<button class="mk-btn secili" disabled>Kullanılıyor</button>';
    } else if (sahip) {
      s += '<button class="mk-btn kullan" data-eylem="sec" data-id="' + tema.id + '">Kullan</button>';
    } else if (satilikMi) {
      var f = M.fiyat(tema.id), temel = M.temelFiyat(tema.id);
      var indirimli = M.indirimliMi(tema.id);
      var yeter = window.AppGold.get() >= f;
      s += '<button class="mk-btn fiyat' + (yeter ? '' : ' pasif') + '"' +
           (yeter ? ' data-eylem="al" data-id="' + tema.id + '"' : ' disabled') + '>' +
           window.CoinSVG(true) + (indirimli ? '<s>' + temel + '</s>' : '') + '<span>' + f + '</span></button>';
      if (indirimli) {
        s += '<div class="mk-indirim acik">' + KAMERA_SVG + '%50 indirim aktif</div>';
      } else if (M.reklamVarMi()) {   // reklam yoksa buton hic cikmaz
        s += '<button class="mk-indirim" data-eylem="indirim" data-id="' + tema.id + '">' +
             KAMERA_SVG + 'İzle · %50 indirim</button>';
      }
    } else {
      s += '<div class="mk-kilit">' + KILIT_SVG + '<span>Kutudan ya da seçkiden</span></div>';
    }
    s += '</div></div></div>';
    return s;
  }

  // ---------------------------------------------------------------
  // MAGAZA
  // ---------------------------------------------------------------
  function noAdsCiz() {
    if (M.reklamsizMi()) {
      el.noads.className = 'mk-noads alindi';
      el.noads.innerHTML = '<div class="mk-noads-metin"><b>Reklamsız</b>' +
        '<span>Reklamlar kaldırıldı, iyi oyunlar.</span></div><div class="mk-noads-tik">✓</div>';
      return;
    }
    el.noads.className = 'mk-noads';
    el.noads.innerHTML =
      '<div class="mk-noads-rozet">REKLAMSIZ</div>' +
      '<div class="mk-noads-metin"><b>Reklamları kaldır</b>' +
      '<span>Kesintisiz oyun deneyimi</span></div>' +
      '<button class="mk-noads-btn" data-eylem="noads">$2.99</button>';
  }

  function hediyeCiz() {
    if (M.hediyeHazirMi()) {
      el.hediye.className = 'mk-hediye';
      el.hediye.innerHTML =
        '<span class="mk-hediye-yazi">GÜNLÜK ÜCRETSİZ HEDİYE</span>' +
        '<button class="mk-hediye-btn" data-eylem="hediye">' +
        (M.reklamVarMi() ? KAMERA_SVG + 'REKLAM İZLE &amp; AÇ' : 'AÇ') + '</button>';
    } else {
      el.hediye.className = 'mk-hediye alindi';
      el.hediye.innerHTML =
        '<span class="mk-hediye-yazi">GÜNLÜK HEDİYE ALINDI</span>' +
        '<span class="mk-hediye-sayac" id="mkHediyeSayac">--:--:--</span>';
    }
  }

  function sandiklarCiz() {
    var liste = M.sandiklar(), i, s = '', k, yeter, durum;
    for (i = 0; i < liste.length; i++) {
      k = liste[i];
      durum = M.sandikDurum(k.id);
      yeter = durum === 'aktif' && window.AppGold.get() >= k.fiyat;
      s += '<div class="mk-sandik" style="--sandik-renk:' + k.renk + ';">' +
           sandikSVG(k.renk, koyulastir(k.renk)) +
           '<button class="mk-sandik-btn' + (yeter ? '' : ' pasif') + '"' +
           (yeter ? ' data-eylem="sandik" data-id="' + k.id + '"' : ' disabled') + '>' +
           '<b>' + k.ad.toLocaleUpperCase('tr-TR') + '</b>' +
           (durum === 'aktif' ? '<span>' + window.CoinSVG(true) + k.fiyat + '</span>'
             : '<span>' + (durum === 'tamam' ? 'Koleksiyon tamam' : 'Bu kutudan çıkacak tema kalmadı') + '</span>') +
           '</button></div>';
    }
    el.sandiklar.innerHTML = s;
  }

  function vitrinCiz() {
    // sahip olunan tema seckide gosterilmez (satin alinca / kutudan cikinca duser)
    var v = M.vitrin().filter(function (id) { return !M.sahipMi(id); }), i, h = '';
    if (!v.length) {
      h = '<div class="mk-vitrin-bos">' + (M.kalanVarMi()
        ? 'Bu seçkideki her şey sende. Yeni seçki sayaç bitince gelir; kutuları da deneyebilirsin.'
        : 'Bütün temalar sende. Koleksiyon tamam!') + '</div>';
    } else {
      for (i = 0; i < v.length; i++) h += kart(M.bul(v[i]), true);
    }
    el.vitrin.innerHTML = h;
    onizlemeleriDoldur(el.vitrin);
  }

  // ---------------------------------------------------------------
  // ENVANTER — once sahip olunanlar, sonra kilitliler
  // ---------------------------------------------------------------
  function envanterCiz() {
    var hepsi = M.temalar(), t = M.toplama(), h = '', i;
    var secili = M.seciliId();
    var sahipler = hepsi.filter(function (x) { return M.sahipMi(x.id); })
      .sort(function (a, b) { return (b.id === secili) - (a.id === secili); });   // kullanilan tema en ustte
    var kilitliler = hepsi.filter(function (x) { return !M.sahipMi(x.id); });
    el.koleksiyon.innerHTML = '<span>Koleksiyon</span><em>' + t.sahip + ' / ' + t.toplam + ' tema</em>';
    for (i = 0; i < sahipler.length; i++) h += kart(sahipler[i], false);
    for (i = 0; i < kilitliler.length; i++) h += kart(kilitliler[i], false);
    el.izgara.innerHTML = h;
    onizlemeleriDoldur(el.izgara);
  }

  // ---------------------------------------------------------------
  // CIZ
  // ---------------------------------------------------------------
  function ciz() {
    if (mod === 'magaza') {
      noAdsCiz();
      hediyeCiz();
      sandiklarCiz();
      vitrinCiz();
    } else {
      envanterCiz();
    }
    if (window.AppGold) window.AppGold.render();
  }

  // ---------------------------------------------------------------
  // GERI SAYIMLAR — yalnizca market ekrani acikken calisir
  // ---------------------------------------------------------------
  function sureYaz(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    var sa = Math.floor(t / 3600), dk = Math.floor((t % 3600) / 60), sn = t % 60;
    return (sa < 10 ? '0' : '') + sa + ':' + (dk < 10 ? '0' : '') + dk + ':' + (sn < 10 ? '0' : '') + sn;
  }

  var sonDilimMs = Infinity;
  function sayacYaz() {
    if (mod !== 'magaza') return;
    var ms = M.vitrinKalanMs();
    // sayac sifirlanip basa sardiysa yeni secki gelmistir
    if (ms > sonDilimMs + 1500) vitrinCiz();
    sonDilimMs = ms;
    if (el.sayac) el.sayac.textContent = sureYaz(ms);

    var hs = q('mkHediyeSayac');
    if (hs) {
      if (M.hediyeHazirMi()) hediyeCiz();
      else hs.textContent = sureYaz(M.hediyeKalanMs());
    }
  }

  // ---------------------------------------------------------------
  // AC / KAPAT
  // ---------------------------------------------------------------
  function ac() {
    kur();
    if (!kuruldu) return;
    sonDilimMs = Infinity;
    modDegistir('magaza');
    sayacYaz();
    clearInterval(sayacId);
    sayacId = setInterval(sayacYaz, 1000);
    if (typeof slideForward === 'function') slideForward('home', 'market');
  }

  function sayaciDurdur() { clearInterval(sayacId); sayacId = null; }

  function kapat() {
    sayaciDurdur();
    sonucKapat();
    if (typeof slideBack === 'function') slideBack('market', 'home');
  }

  // telefonun geri tusuyla cikilirsa da sayac dursun
  window.addEventListener('popstate', function () {
    if (sayacId) setTimeout(function () {
      var ekran = q('screen-market');
      if (ekran && ekran.classList.contains('offstage')) { sayaciDurdur(); sonucKapat(); }
    }, 450);
  });

  kur();

  return { ac: ac, kapat: kapat, ciz: ciz };
})();
