// tempoKup.js — Tempo Küp arayüzü: tahta çizimi, sürükle-bırak, animasyonlar.
// Oyun kuralları, parça üretimi ve puanlama js/tempoCekirdek.js içindedir;
// burası yalnızca o durumu ekrana yansıtır ve girdiyi iletir.
//
// Dışarıya açılan arayüz: window.TempoKup.start()
// Kayıt: AppProgress.tempoBest (rekor), AppProgress.tempoOyun (yarım kalan oyun)
(function () {
  'use strict';

  var C = window.TempoCekirdek;
  if (!C) { console.error('tempoKup.js: tempoCekirdek.js yuklenmemis'); return; }

  var N = C.N, SEKILLER = C.SEKILLER;

  // ---------------------------------------------------------------
  // AYAR — arayuzun butun ince ayarlari tek yerde
  // (oyun kurallari ve parca ureteci js/tempoCekirdek.js AYAR'indadir)
  // ---------------------------------------------------------------
  var AYAR = {
    // Rekor esikleri: oyun sonunda (oyun basindaki rekor, bu skor] araligina
    // dusen HER esik bir kez odenir. Esik k = esikTaban * 2^k. Rekorun
    // altindaki esikler gecilmis sayilir (ayri kayit gerekmez).
    esikTaban: 5000,
    esikOdul: [25, 50, 75, 100, 150, 200, 300, 400, 500, 600],   // sonrasi her esikte +esikArtis
    esikArtis: 100,
    temizlikOdul: 25,          // her tam temizlikte biriken jeton (oyun sonunda odenir)
    renkler: ['#5CC8FF', '#B58CFF', '#FFCF5C', '#4FE39A', '#FF7F92', '#FF9F4D', '#7C8FFF', '#52DDC6'],
    surukle: {
      kazanc: 1.08,            // parca parmaktan %8 hizli ilerler (1 = birebir takip)
      kaldirDokunma: 38,       // dokunmada parcanin alt kenari parmagin bu kadar ustunde (px)
      kaldirFare: 14,          // farede parca imlecin biraz ustunde ortalanir (px)
      miknatis: 0.62           // gecerli komsu konuma cekilme esigi (hucre)
    },
    efekt: {
      dalgaGecikme: 26,        // patlama dalgasinda hucre basina gecikme (ms)
      parcacikTavan: 64,       // tek hamlede en fazla parcacik
      parcacikMesafe: [26, 70],// parcacigin ucacagi mesafe araligi (px), komboyla buyur
      kutlamaAdet: 90          // tam temizlikte ekrani dolduran konfeti sayisi
    },
    ovgu: ['', '', 'Harika!', 'Muhteşem!', 'İnanılmaz!', 'Efsane!', 'Efsane!']
  };
  // ESIK-BASI (tools/tempoEsikTest.js bu blogu ayri calistirir)
  function esikOdulu(eskiRekor, skor, ayar) {
    var toplam = 0, adet = 0, k, esik, o;
    for (k = 0, esik = ayar.esikTaban; esik <= skor && k < 60; k++, esik *= 2) {
      if (esik <= eskiRekor) continue;
      o = k < ayar.esikOdul.length ? ayar.esikOdul[k]
        : ayar.esikOdul[ayar.esikOdul.length - 1] + (k - ayar.esikOdul.length + 1) * ayar.esikArtis;
      toplam += o; adet++;
    }
    return { jeton: toplam, adet: adet };
  }
  // ESIK-SONU
  var TEMIZLIK_ODUL = AYAR.temizlikOdul, RENKLER = AYAR.renkler;

  function q(id) { return document.getElementById(id); }
  var ekran = q('screen-tempo'), tahtaEl = q('tpBoard'), tepsiEl = q('tpTray');
  var skorEl = q('tpScore'), rekorEl = q('tpBest'), bittiEl = q('tpOver');
  var bittiBaslik = q('tpOverBig'), bittiAlt = q('tpOverSub');
  var tempoEl = q('tpTempo'), sarmal = q('tpBoardWrap');

  var oyun = null;
  var renk = new Int8Array(N * N);   // hücre -> palet sırası, -1 boş
  var tepsiRenk = [];                // tepsi yuvası -> palet sırası
  var rekor = 0, rekorBasta = 0;
  // Bu oyunda tam temizliklerden biriken, HENUZ ODENMEMIS jeton. Yarim oyunla
  // birlikte kaydedilir (tempoOyun.tb); oyun bitince bir kez odenip sifirlanir.
  var temizlikBirikim = 0;
  var sonKazanc = null;              // oyun sonunda odenen kazanc (bitis ekrani icin)
  var hucreler = [], fxEl = null;
  var sonBoya = new Array(N * N);
  var suruk = null;                  // devam eden sürükleme
  var skorGorunen = 0, skorRaf = 0;

  // ---------------------------------------------------------------
  // YARDIMCILAR
  // ---------------------------------------------------------------
  function fx() { return window.AppFX || null; }
  function ton(a, b, sure, tip, guc) { var f = fx(); if (f) f.tone(a, b, sure, tip, guc); }
  function dizi(notalar, tip) { var f = fx(); if (f) f.seq(notalar, tip); }
  function titre(p) { var f = fx(); if (f) f.vibrate(p); }
  function azHareket() { return !!document.querySelector('.phone.reduced-motion'); }
  function yaz(n) { return n.toLocaleString('tr-TR'); }

  // markette seçili blok temasının paleti; yoksa oyunun kendi renkleri
  function palet() {
    var M = window.AppMarket;
    var p = M && M.blokPaleti && M.blokPaleti();
    return (p && p.length) ? p : RENKLER;
  }
  function hex(sira) { var p = palet(); return p[((sira % p.length) + p.length) % p.length]; }

  function temaUygula(e) {
    var M = window.AppMarket;
    if (M && M.blokTemasiUygula) M.blokTemasiUygula(e);
  }

  // ---------------------------------------------------------------
  // KAYIT
  // ---------------------------------------------------------------
  function rekorOku() { return (window.AppProgress && window.AppProgress.tempoBest) || 0; }
  function rekorYaz() { if (window.AppSaveProgress) window.AppSaveProgress({ tempoBest: rekor }); }

  function oyunKaydet() {
    if (!window.AppSaveProgress) return;
    if (!oyun || oyun.bitti || oyun.hamle === 0) { window.AppSaveProgress({ tempoOyun: null }); return; }
    window.AppSaveProgress({ tempoOyun: { k: oyun.kayit(), r: Array.prototype.slice.call(renk), t: tepsiRenk.slice(), rb: rekorBasta, tb: temizlikBirikim } });
  }

  function oyunYukle() {
    var kayit = window.AppProgress && window.AppProgress.tempoOyun;
    if (!kayit || !kayit.k || !(kayit.r instanceof Array) || kayit.r.length !== N * N) return false;
    var o = new C.Oyun();
    if (!o.yukle(kayit.k)) return false;
    oyun = o;
    for (var i = 0; i < N * N; i++) {
      var dolu = !!(o.b[Math.floor(i / N)] & (1 << (i % N)));
      renk[i] = dolu ? (kayit.r[i] >= 0 ? kayit.r[i] : 0) : -1;
    }
    tepsiRenk = (kayit.t instanceof Array) ? kayit.t.slice(0, 3) : [];
    while (tepsiRenk.length < 3) tepsiRenk.push(tepsiRenk.length);
    if (typeof kayit.rb === 'number') rekorBasta = kayit.rb;   // rekor ödülü oyun başındaki rekora göre
    // biriken temizlik ödülü (bu özellikten önceki kayıtlarda yok: 0)
    temizlikBirikim = (typeof kayit.tb === 'number' && kayit.tb > 0) ? kayit.tb : 0;
    return true;
  }

  // ---------------------------------------------------------------
  // TAHTA
  // ---------------------------------------------------------------
  function tahtaKur() {
    if (hucreler.length) return;
    var parca = document.createDocumentFragment(), i, d;
    for (i = 0; i < N * N; i++) {
      d = document.createElement('div');
      d.className = 'tp-cell';
      hucreler.push(d);
      parca.appendChild(d);
    }
    fxEl = document.createElement('div');
    fxEl.className = 'tp-fx';
    parca.appendChild(fxEl);
    tahtaEl.insertBefore(parca, tahtaEl.firstChild);
  }

  // yalnızca değişen hücrelere dokunur
  function boya() {
    for (var i = 0; i < N * N; i++) {
      var v = renk[i] < 0 ? '' : hex(renk[i]);
      if (sonBoya[i] === v) continue;
      sonBoya[i] = v;
      var e = hucreler[i];
      e.style.backgroundColor = v;          // background DEĞİL: tema deseni (background-image) silinmesin
      e.classList.toggle('filled', !!v);
      e.classList.toggle('tp-blok', !!v);
    }
  }
  function boyaSifirla() { for (var i = 0; i < sonBoya.length; i++) sonBoya[i] = null; }

  function skorYaz(aninda) {
    rekorEl.textContent = yaz(rekor);
    if (aninda || azHareket()) { skorGorunen = oyun.skor; skorEl.textContent = yaz(oyun.skor); return; }
    var bas = skorGorunen, hedef = oyun.skor, t0 = performance.now();
    cancelAnimationFrame(skorRaf);
    (function adim(simdi) {
      var t = Math.min(1, (simdi - t0) / 380);
      skorGorunen = Math.round(bas + (hedef - bas) * (1 - Math.pow(1 - t, 3)));
      skorEl.textContent = yaz(skorGorunen);
      if (t < 1) skorRaf = requestAnimationFrame(adim);
    })(t0);
  }

  function tempoYaz() {
    var c = oyun.carpan(), acik = oyun.seri >= 1;
    tempoEl.classList.toggle('acik', acik);
    tempoEl.querySelector('b').textContent = 'x' + c;
    // nokta sayisi = bu carpandaki toplam hamle hakki (x1-x3: 3, x4: 4, x5: 5)
    var hak = C.sabirHakki(c), nokta = tempoEl.querySelectorAll('i'), i;
    for (i = nokta.length; i < hak; i++) tempoEl.appendChild(document.createElement('i'));
    nokta = tempoEl.querySelectorAll('i');
    for (i = 0; i < nokta.length; i++) {
      nokta[i].style.display = i < hak ? '' : 'none';
      nokta[i].classList.toggle('dolu', i < oyun.sabir);
    }
    ekran.classList.toggle('tempo-on', c >= 2);
    tempoEl.dataset.x = c;
  }

  // ---------------------------------------------------------------
  // PARÇA ÇİZİMİ (tepsi + sürüklenen hayalet aynı kalıbı kullanır)
  // ---------------------------------------------------------------
  function parcaEl(s, renkHex, birim, bosluk) {
    var p = document.createElement('div');
    p.style.display = 'grid';
    p.style.gridTemplateColumns = 'repeat(' + s.w + ',' + birim + 'px)';
    p.style.gridTemplateRows = 'repeat(' + s.h + ',' + birim + 'px)';
    p.style.gap = bosluk + 'px';
    for (var i = 0; i < s.hucreler.length; i++) {
      var b = document.createElement('i');
      b.className = 'tp-blok';
      b.style.gridRow = (s.hucreler[i][0] + 1);
      b.style.gridColumn = (s.hucreler[i][1] + 1);
      b.style.backgroundColor = renkHex;
      p.appendChild(b);
    }
    return p;
  }

  function tepsiBirimi() {
    var g = tepsiEl.clientWidth || 340;
    return Math.max(12, Math.min(22, Math.floor((g / 3 - 14) / 5)));
  }

  function tepsiCiz(canlandir) {
    temaUygula(tepsiEl);
    tepsiEl.innerHTML = '';
    var birim = tepsiBirimi();
    oyun.tepsi.forEach(function (p, i) {
      var yuva = document.createElement('div');
      yuva.className = 'tp-slot';
      yuva.dataset.i = i;
      if (!p.kullanildi) {
        var s = SEKILLER[p.s];
        var pe = parcaEl(s, hex(tepsiRenk[i]), birim, 3);
        pe.className = 'tp-piece';
        if (canlandir && !azHareket()) { pe.classList.add('tp-gir'); pe.style.animationDelay = (i * 70) + 'ms'; }
        yuva.appendChild(pe);
      }
      tepsiEl.appendChild(yuva);
    });
    sigmazIsaretle();
  }

  // tahtada hiçbir yere sığmayan parçalar soluk görünür
  function sigmazIsaretle() {
    var yuvalar = tepsiEl.querySelectorAll('.tp-slot');
    for (var i = 0; i < yuvalar.length; i++) {
      var pe = yuvalar[i].querySelector('.tp-piece'), p = oyun.tepsi[i];
      if (!pe || !p) continue;
      pe.classList.toggle('sigmaz', !C.herhangiSigar(oyun.b, SEKILLER[p.s]));
    }
  }

  function yeniRenkler() {
    var n = palet().length, kullan = [], i, r;
    tepsiRenk = [];
    for (i = 0; i < 3; i++) {
      do { r = Math.floor(Math.random() * n); } while (kullan.indexOf(r) >= 0 && kullan.length < n);
      kullan.push(r);
      tepsiRenk.push(r);
    }
  }

  // ---------------------------------------------------------------
  // EFEKTLER — hepsi transform/opacity; hücrelerin kendisi anında güncellenir,
  // patlama ayrı bir katmandaki kopyalar üzerinde oynar. Böylece oyuncu
  // animasyon bitmeden bir sonraki parçayı koyabilir.
  // ---------------------------------------------------------------
  function patlat(idx, renkHex, gecikme) {
    var h = hucreler[idx], e = document.createElement('i');
    e.className = 'tp-blok tp-patla';
    e.style.left = h.offsetLeft + 'px';
    e.style.top = h.offsetTop + 'px';
    e.style.width = h.offsetWidth + 'px';
    e.style.height = h.offsetHeight + 'px';
    e.style.backgroundColor = renkHex;
    e.style.animationDelay = gecikme + 'ms';
    fxEl.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, gecikme + 460);
  }

  function hatIsigi(yatay, sira) {
    var e = document.createElement('div'), h = hucreler[yatay ? sira * N : sira];
    e.className = 'tp-isik ' + (yatay ? 'yatay' : 'dikey');
    if (yatay) { e.style.top = h.offsetTop + 'px'; e.style.height = h.offsetHeight + 'px'; }
    else { e.style.left = h.offsetLeft + 'px'; e.style.width = h.offsetWidth + 'px'; }
    fxEl.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 520);
  }

  function yazi(sinif, html, omur) {
    var e = document.createElement('div');
    e.className = sinif;
    e.innerHTML = html;
    fxEl.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, omur);
  }

  function sars(guc) {
    if (azHareket()) return;
    sarmal.classList.remove('tp-sars', 'tp-sars-guclu');
    void sarmal.offsetWidth;
    sarmal.classList.add(guc > 1 ? 'tp-sars-guclu' : 'tp-sars');
  }

  // Hat temizliginde hucrelerden sacilan parcaciklar. Sayi ve mesafe komboyla
  // (ayni anda patlayan hat + tempo carpani) buyur.
  function parcacikSac(idxler, renkler, guc) {
    if (azHareket()) return;
    var E = AYAR.efekt, adetHucre = Math.min(3, 1 + Math.floor(guc / 2));
    var atla = Math.max(1, Math.ceil(idxler.length * adetHucre / E.parcacikTavan));
    var uzak = E.parcacikMesafe[0] + Math.min(1, guc / 6) * (E.parcacikMesafe[1] - E.parcacikMesafe[0]);
    idxler.forEach(function (idx, sira) {
      if (sira % atla) return;
      var h = hucreler[idx];
      for (var k = 0; k < adetHucre; k++) {
        var e = document.createElement('i'), aci = Math.random() * Math.PI * 2, m = uzak * (0.55 + Math.random() * 0.75);
        e.className = 'tp-parca';
        e.style.left = (h.offsetLeft + h.offsetWidth / 2) + 'px';
        e.style.top = (h.offsetTop + h.offsetHeight / 2) + 'px';
        e.style.backgroundColor = renkler[idx];
        e.style.setProperty('--dx', (Math.cos(aci) * m).toFixed(0) + 'px');
        e.style.setProperty('--dy', (Math.sin(aci) * m - 8).toFixed(0) + 'px');
        e.style.setProperty('--boy', (0.7 + Math.min(1, guc / 6) * 0.8 + Math.random() * 0.4).toFixed(2));
        e.style.animationDelay = Math.round(60 + Math.random() * 120) + 'ms';
        fxEl.appendChild(e);
        (function (x) { setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 900); })(e);
      }
    });
  }

  // Tam temizlik: butun ekrani dolduran konfeti yagmuru + tahtadan patlama
  function kutlama() {
    if (azHareket()) return;
    var p = palet(), i, e, kat = document.createElement('div');
    kat.className = 'tp-kutlama';
    ekran.appendChild(kat);
    var gen = ekran.clientWidth, yuk = ekran.clientHeight, adet = AYAR.efekt.kutlamaAdet;
    for (i = 0; i < adet; i++) {
      e = document.createElement('i');
      e.style.backgroundColor = p[i % p.length];
      if (i < adet * 0.4) {
        // tahtanin ortasindan disari patlayan parcalar
        var aci = Math.random() * Math.PI * 2, m = 120 + Math.random() * gen * 0.6;
        e.className = 'tp-konfeti patlama';
        e.style.left = '50%'; e.style.top = '46%';
        e.style.setProperty('--dx', (Math.cos(aci) * m).toFixed(0) + 'px');
        e.style.setProperty('--dy', (Math.sin(aci) * m).toFixed(0) + 'px');
        e.style.animationDelay = Math.round(Math.random() * 140) + 'ms';
      } else {
        // yukaridan butun ekrana yagan parcalar
        e.className = 'tp-konfeti yagmur';
        e.style.left = (Math.random() * 100).toFixed(1) + '%'; e.style.top = '-4%';
        e.style.setProperty('--dx', Math.round(Math.random() * 120 - 60) + 'px');
        e.style.setProperty('--dy', Math.round(yuk * (1.02 + Math.random() * 0.1)) + 'px');
        e.style.animationDelay = Math.round(Math.random() * 700) + 'ms';
        e.style.animationDuration = (1.5 + Math.random() * 0.9).toFixed(2) + 's';
      }
      e.style.setProperty('--don', Math.round(Math.random() * 900 - 450) + 'deg');
      if (i % 3 === 0) { e.style.width = '6px'; e.style.height = '13px'; }
      kat.appendChild(e);
    }
    setTimeout(function () { if (kat.parentNode) kat.parentNode.removeChild(kat); }, 3300);
  }

  var OVGU = AYAR.ovgu;

  // ---------------------------------------------------------------
  // HAMLE
  // ---------------------------------------------------------------
  function yerlestir(i, r, c) {
    var p = oyun.tepsi[i], s = SEKILLER[p.s], renkSira = tepsiRenk[i], k, idx;
    var e = oyun.oyna(i, r, c);
    if (!e) return false;

    var konan = [];
    for (k = 0; k < s.hucreler.length; k++) {
      idx = (r + s.hucreler[k][0]) * N + (c + s.hucreler[k][1]);
      renk[idx] = renkSira;
      konan.push(idx);
    }

    if (e.hat) {
      // dalga: yerleşen parçanın merkezinden dışa doğru sırayla patlar
      var mr = r + (s.h - 1) / 2, mc = c + (s.w - 1) / 2, rr, cc, silinen = {};
      for (rr = 0; rr < N; rr++) for (cc = 0; cc < N; cc++) {
        if ((e.satirlar & (1 << rr)) || (e.sutunlar & (1 << cc))) silinen[rr * N + cc] = Math.abs(rr - mr) + Math.abs(cc - mc);
      }
      for (rr = 0; rr < N; rr++) if (e.satirlar & (1 << rr)) hatIsigi(true, rr);
      for (cc = 0; cc < N; cc++) if (e.sutunlar & (1 << cc)) hatIsigi(false, cc);
      var patlayan = [], patlayanRenk = {};
      for (k in silinen) {
        idx = Number(k);
        patlayan.push(idx); patlayanRenk[idx] = hex(renk[idx]);
        patlat(idx, patlayanRenk[idx], azHareket() ? 0 : Math.round(silinen[k] * AYAR.efekt.dalgaGecikme));
        renk[idx] = -1;
      }
      parcacikSac(patlayan, patlayanRenk, (e.hat - 1) * 2 + (e.carpan - 1) + (e.tam ? 3 : 0));
    }
    boya();

    // oturma animasyonu (patlamayan hücrelerde)
    if (!azHareket()) {
      konan.forEach(function (x) {
        if (renk[x] < 0) return;
        var h = hucreler[x];
        h.classList.remove('tp-otur'); void h.offsetWidth; h.classList.add('tp-otur');
      });
    }

    // ses + titreşim + yazılar
    if (e.tam) {
      yazi('tp-fullclear', '<span>TAM TEMİZLİK!</span><b>+' + yaz(e.puanTam + e.puanHat) + '</b>', 1900);
      kutlama(); sars(2);
      dizi([[523, .14, .14, 0], [659, .14, .14, 80], [784, .14, .14, 160], [1047, .16, .15, 240], [1319, .36, .16, 340]], 'triangle');
      titre([20, 50, 20, 50, 30]);
    } else if (e.hat) {
      var soz = OVGU[Math.min(e.hat, OVGU.length - 1)];
      var tempoYazi = e.carpan > 1 ? '<em>TEMPO x' + e.carpan + '</em>' : '';
      yazi('tp-combo', (soz ? '<span>' + soz + '</span>' : '') + tempoYazi + '<b>+' + yaz(e.puanHat) + '</b>', 1050);
      if (e.hat > 1 || e.carpan > 2) sars(e.hat > 2 ? 2 : 1);
      var taban = (500 + e.hat * 70) * Math.pow(1.06, Math.min(e.seri - 1, 8));
      dizi([[taban, .12, .12, 0], [taban * 1.26, .12, .12, 65], [taban * 1.5, .2, .13, 130]], 'triangle');
      titre(e.hat > 1 ? [14, 36, 14] : 16);
    } else {
      ton(300, 250, 0.07, 'sine', 0.08);
      titre(8);
    }

    if (oyun.skor > rekor) { rekor = oyun.skor; rekorYaz(); }
    skorYaz(false);
    tempoYaz();

    if (e.yeniTepsi) { yeniRenkler(); tepsiCiz(true); }
    else {
      var yuva = tepsiEl.querySelector('.tp-slot[data-i="' + i + '"]');
      if (yuva) yuva.innerHTML = '';
      sigmazIsaretle();
    }
    // tam temizlik = cekirdegin tanimi (hamle sonunda tahta tamamen bos)
    if (e.tam) temizlikBirikim += TEMIZLIK_ODUL;
    // Kazanc, oyunun bittigi kayitla AYNI anda odenir: arada uygulama kapanirsa
    // ne kaybolur ne de (yarim oyun kaydi silindigi icin) ikinci kez odenir.
    if (e.bitti) kazanciOde();
    oyunKaydet();
    if (e.bitti) setTimeout(oyunBitti, e.hat ? 760 : 520);
    return true;
  }

  function kazanciOde() {
    var rekorKirildi = oyun.skor > rekorBasta;
    var esik = esikOdulu(rekorBasta, oyun.skor, AYAR);
    sonKazanc = {
      rekorKirildi: rekorKirildi, eskiRekor: rekorBasta,
      rekor: esik.jeton, esikAdet: esik.adet,
      temizlik: temizlikBirikim, adet: TEMIZLIK_ODUL ? Math.round(temizlikBirikim / TEMIZLIK_ODUL) : 0
    };
    sonKazanc.toplam = sonKazanc.rekor + sonKazanc.temizlik;
    if (sonKazanc.toplam > 0 && window.AppGold) window.AppGold.add(sonKazanc.toplam);
    if (rekorKirildi) rekorBasta = oyun.skor;
    temizlikBirikim = 0;
  }

  function kazancSatiri(ad, miktar, sinif) {
    return '<div class="' + sinif + '"><span>' + ad + '</span><b>' + window.CoinSVG(true) + '+' + yaz(miktar) + '</b></div>';
  }

  function oyunBitti() {
    if (!oyun || !oyun.bitti || !sonKazanc) return;
    var kz = sonKazanc, rekorKirildi = kz.rekorKirildi;
    bittiBaslik.innerHTML = rekorKirildi
      ? '<span style="color:#FFE08A">Yeni</span> <span style="color:#8FF0B4">Rekor!</span>'
      : '<span style="color:#FF9A8A">Yer</span> <span style="color:#FFC97A">Kalmadı</span>';
    var alt = 'Skorun: ' + yaz(oyun.skor);
    if (oyun.tamSayisi) alt += '  ·  Tam temizlik: ' + oyun.tamSayisi;
    if (rekorKirildi) alt += '<div class="tp-over-eski">Önceki rekor: ' + yaz(kz.eskiRekor) + '</div>';
    // kazanc dokumu (odeme kazanciOde'de yapildi; burada yalnizca gosterilir)
    if (kz.toplam > 0) {
      alt += '<div class="tp-over-kazanc">' +
        (kz.rekor ? kazancSatiri('Rekor eşiği' + (kz.esikAdet > 1 ? ' ×' + kz.esikAdet : ''), kz.rekor, 'tp-kz-satir') : '') +
        (kz.temizlik ? kazancSatiri('Tam temizlik ×' + kz.adet, kz.temizlik, 'tp-kz-satir') : '') +
        kazancSatiri('Toplam', kz.toplam, 'tp-over-odul') +
        '</div>';
    }
    bittiAlt.innerHTML = alt;
    bittiEl.classList.add('show');
    ekran.classList.remove('tempo-on');
    oyunKaydet();
    if (rekorKirildi) dizi([[523, .15, .13, 0], [659, .15, .13, 90], [784, .15, .13, 180], [1047, .3, .15, 270]], 'triangle');
    else dizi([[440, .16, .13, 0], [349, .16, .13, 170], [262, .5, .15, 340]], 'sine');
  }

  // ---------------------------------------------------------------
  // SÜRÜKLE-BIRAK (pointer: dokunma + fare tek kod)
  // ---------------------------------------------------------------
  function olcu() {
    var a = hucreler[0].getBoundingClientRect(), b = hucreler[1].getBoundingClientRect();
    return { sol: a.left, ust: a.top, adim: b.left - a.left, boy: a.width };
  }

  var onizlenen = [];
  function onizlemeTemizle() {
    for (var i = 0; i < onizlenen.length; i++) {
      var e = hucreler[onizlenen[i]];
      e.classList.remove('tp-oz', 'tp-oz-yok', 'tp-patlar');
      if (renk[onizlenen[i]] < 0) e.style.backgroundColor = '';
    }
    onizlenen = [];
  }

  function onizle(d) {
    onizlemeTemizle();
    var s = d.s, k, idx, rr, cc;
    if (d.hedef) {
      for (k = 0; k < s.hucreler.length; k++) {
        idx = (d.hedef.r + s.hucreler[k][0]) * N + (d.hedef.c + s.hucreler[k][1]);
        hucreler[idx].classList.add('tp-oz');
        hucreler[idx].style.backgroundColor = d.renkHex;
        onizlenen.push(idx);
      }
      // tamamlanacak satır/sütunlar önceden parlar
      var sonuc = C.uygula(oyun.b, s, d.hedef.r, d.hedef.c);
      if (sonuc.hat) {
        for (rr = 0; rr < N; rr++) for (cc = 0; cc < N; cc++) {
          if ((sonuc.satirlar & (1 << rr)) || (sonuc.sutunlar & (1 << cc))) {
            idx = rr * N + cc;
            hucreler[idx].classList.add('tp-patlar');
            if (onizlenen.indexOf(idx) < 0) onizlenen.push(idx);
          }
        }
      }
    } else if (d.ham) {
      // geçersiz konum: tahtanın içinde kalan boş hücreler gri görünür
      for (k = 0; k < s.hucreler.length; k++) {
        rr = d.ham.r + s.hucreler[k][0]; cc = d.ham.c + s.hucreler[k][1];
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        idx = rr * N + cc;
        if (renk[idx] >= 0) continue;
        hucreler[idx].classList.add('tp-oz-yok');
        onizlenen.push(idx);
      }
    }
  }

  // Parmağın gösterdiği yere en yakın GEÇERLİ konum (hafif mıknatıs)
  function hedefBul(d, gx, gy) {
    var m = d.m, fc = (gx - m.sol) / m.adim, fr = (gy - m.ust) / m.adim;
    var r = Math.round(fr), c = Math.round(fc);
    d.ham = (r > -d.s.h && r < N && c > -d.s.w && c < N) ? { r: r, c: c } : null;
    if (oyun.konabilir(d.i, r, c)) return { r: r, c: c };
    var en = null, enU = AYAR.surukle.miknatis, dr, dc, u;
    for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (!oyun.konabilir(d.i, r + dr, c + dc)) continue;
      u = Math.max(Math.abs(r + dr - fr), Math.abs(c + dc - fc));
      if (u < enU) { enU = u; en = { r: r + dr, c: c + dc }; }
    }
    return en;
  }

  // Hayaletin ekrandaki sol-ust kosesi. Parmagin yer degistirmesi `kazanc`
  // ile carpilir: parca parmagin biraz onunde gider, tahtanin ucuna ulasmak
  // icin parmagi o kadar uzatmak gerekmez.
  function hayaletKonumu(d) {
    var S = AYAR.surukle;
    var px = d.x0 + (d.x - d.x0) * S.kazanc, py = d.y0 + (d.y - d.y0) * S.kazanc;
    return { x: px - d.w / 2, y: d.dokunma ? (py - d.h - S.kaldirDokunma) : (py - d.h / 2 - S.kaldirFare) };
  }

  // Hayalet parmagi ANINDA izler (olay geldigi an transform yazilir); pahali
  // olan onizleme hesabi ise kare basina bir kez yapilir.
  function hayaletTasi(d) {
    var k = hayaletKonumu(d);
    d.ghost.style.transform = 'translate3d(' + k.x.toFixed(1) + 'px,' + k.y.toFixed(1) + 'px,0)';
    return k;
  }

  function konumla() {
    var d = suruk;
    if (!d) return;
    d.raf = 0;
    var k = hayaletTasi(d);
    var h = hedefBul(d, k.x, k.y);
    var anahtar = h ? ('v' + h.r + '_' + h.c) : (d.ham ? ('x' + d.ham.r + '_' + d.ham.c) : '-');
    if (anahtar !== d.anahtar) {
      d.anahtar = anahtar;
      if (h && !d.hedef) titre(4);
      d.hedef = h;
      // tahtanin ustunde ama konulamaz bir yerde: parca kirmiziya doner
      d.ghost.classList.toggle('gecersiz', !h && !!d.ham);
      onizle(d);
    }
  }

  function surukBasla(e) {
    if (suruk || !oyun || oyun.bitti) return;
    if (e.button !== undefined && e.button !== 0) return;
    var yuva = e.target.closest('.tp-slot');
    if (!yuva) return;
    var i = Number(yuva.dataset.i), p = oyun.tepsi[i], pe = yuva.querySelector('.tp-piece');
    if (!p || p.kullanildi || !pe) return;
    e.preventDefault();
    hayaletleriSil();

    var m = olcu(), s = SEKILLER[p.s], renkHex = hex(tepsiRenk[i]);
    var ghost = parcaEl(s, renkHex, m.boy, m.adim - m.boy);
    ghost.className = 'tp-ghost';
    temaUygula(ghost);   // body'ye taşındığı için temayı miras alamaz, doğrudan yazılır
    var w = s.w * m.adim - (m.adim - m.boy), h = s.h * m.adim - (m.adim - m.boy);
    var pr = pe.getBoundingClientRect();
    ghost.style.transform = 'translate3d(' + (pr.left + pr.width / 2 - w / 2).toFixed(1) + 'px,' +
      (pr.top + pr.height / 2 - h / 2).toFixed(1) + 'px,0) scale(' + (pr.width / w).toFixed(3) + ')';
    document.body.appendChild(ghost);
    pe.classList.add('used');

    suruk = { i: i, pid: e.pointerId, yuva: yuva, pe: pe, ghost: ghost, s: s, m: m, w: w, h: h,
              renkHex: renkHex, dokunma: e.pointerType !== 'mouse', x: e.clientX, y: e.clientY,
              x0: e.clientX, y0: e.clientY, hedef: null, ham: null, anahtar: '', raf: 0 };
    try { yuva.setPointerCapture(e.pointerId); } catch (err) {}
    konumla();               // gecis animasyonu yok: parca aninda parmagin ustunde
    ton(520, 660, 0.05, 'sine', 0.05);
    window.addEventListener('pointermove', surukTasi, { passive: true });
    window.addEventListener('pointerup', surukBitir);
    window.addEventListener('pointercancel', surukIptal);
    window.addEventListener('blur', surukIptal);
  }

  function surukTasi(e) {
    var d = suruk;
    if (!d || e.pointerId !== d.pid) return;
    d.x = e.clientX; d.y = e.clientY;
    hayaletTasi(d);                                       // aninda takip
    if (!d.raf) d.raf = requestAnimationFrame(konumla);   // onizleme: kare basina tek hesap
  }

  function surukKapat() {
    var d = suruk;
    suruk = null;
    if (!d) return null;
    if (d.raf) cancelAnimationFrame(d.raf);
    window.removeEventListener('pointermove', surukTasi);
    window.removeEventListener('pointerup', surukBitir);
    window.removeEventListener('pointercancel', surukIptal);
    window.removeEventListener('blur', surukIptal);
    try { d.yuva.releasePointerCapture(d.pid); } catch (err) {}
    onizlemeTemizle();
    return d;
  }

  function hayaletleriSil() {
    var g = document.querySelectorAll('.tp-ghost');
    for (var i = 0; i < g.length; i++) g[i].parentNode.removeChild(g[i]);
  }

  function geriGonder(d) {
    // parça tepsideki yerine süzülerek döner
    var pr = d.pe.getBoundingClientRect(), g = d.ghost;
    g.classList.remove('gecersiz');
    g.classList.add('donuyor');
    g.style.transform = 'translate3d(' + (pr.left + pr.width / 2 - d.w / 2).toFixed(1) + 'px,' +
      (pr.top + pr.height / 2 - d.h / 2).toFixed(1) + 'px,0) scale(' + (pr.width / d.w).toFixed(3) + ')';
    setTimeout(function () {
      if (g.parentNode) g.parentNode.removeChild(g);
      d.pe.classList.remove('used');
    }, azHareket() ? 0 : 160);
  }

  function surukBitir(e) {
    if (suruk && e && e.pointerId !== undefined && e.pointerId !== suruk.pid) return;
    if (suruk && suruk.raf) { cancelAnimationFrame(suruk.raf); konumla(); }   // son konumu kesinleştir
    var d = surukKapat();
    if (!d) return;
    if (d.hedef && oyun.konabilir(d.i, d.hedef.r, d.hedef.c)) {
      if (d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
      yerlestir(d.i, d.hedef.r, d.hedef.c);
    } else {
      if (d.ham) ton(210, 160, 0.08, 'sine', 0.05);
      geriGonder(d);
    }
  }

  function surukIptal() {
    var d = surukKapat();
    if (d) geriGonder(d);
  }

  tepsiEl.addEventListener('pointerdown', surukBasla);
  // dokunmatik tarayıcıların uzun basma menüsü / kaydırması araya girmesin
  tepsiEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------
  // OYUN AKIŞI
  // ---------------------------------------------------------------
  function ekranaYaz() {
    tahtaKur();
    temaUygula(tahtaEl);
    boyaSifirla();
    boya();
    skorYaz(true);
    tempoYaz();
    tepsiCiz(false);
  }

  function yeniOyun() {
    surukIptal();
    hayaletleriSil();
    oyun = new C.Oyun().basla();
    for (var i = 0; i < N * N; i++) renk[i] = -1;
    yeniRenkler();
    rekor = rekorOku(); rekorBasta = rekor;
    temizlikBirikim = 0; sonKazanc = null;
    bittiEl.classList.remove('show');
    if (fxEl) fxEl.innerHTML = '';
    ekranaYaz();
    tepsiCiz(true);
    oyunKaydet();
  }

  q('tpAgain').addEventListener('click', yeniOyun);

  window.addEventListener('resize', function () {
    if (!oyun || ekran.classList.contains('offstage')) return;
    tepsiCiz(false);
  });

  if (window.AppReset) {
    window.AppReset.push(function () { rekor = 0; rekorBasta = 0; oyun = null; yeniOyun(); });
  }

  window.TempoKup = {
    // Ekrana her girişte çağrılır: yarım oyun varsa kaldığı yerden sürer.
    start: function () {
      if (!oyun) {
        tahtaKur();
        rekor = rekorOku(); rekorBasta = rekor;
        if (!oyunYukle()) { yeniOyun(); return; }
      }
      rekor = Math.max(rekor, rekorOku());
      ekranaYaz();           // tema değişmiş olabilir: renkler paletten yeniden okunur
    }
  };
})();
