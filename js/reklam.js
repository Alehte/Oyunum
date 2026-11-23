// reklam.js — REKLAM KATMANI. Oyunlar ve market yalnizca window.Reklam'i cagirir.
// Yuklenme sirasi: core.js -> reklamAyar.js -> reklam.js -> marketKatalog.js -> market.js
//
// SAGLAYICI (reklami gercekten kim gosteriyor) acilista bir kez secilir:
//   sahte : adreste ?reklamTest=1 (hazir) ya da ?reklamTest=2 (hazir degil) VE
//           ReklamAyar.REKLAM_TEST acik VE yerel adres (bkz. yerelAdres). Yalnizca
//           gelistirme: tam ekran "Reklam (test)".
//   yerel : Capacitor yerel uygulamasi (Capacitor.isNativePlatform()). AdMob eklentisi
//           ASAMA 2'de baglanacak; o zamana kadar hicbir birim hazir degil.
//   yok   : normal tarayici / PWA. destekleniyor() false -> butun reklam dugmeleri gizli.
//
// KURALLAR
//   - Odul YALNIZCA odulluGoster {odul:true} donunce verilir (cagiran yazar).
//   - Ayni anda tek reklam: acikken gelen ikinci cagri hemen {odul:false} / {gosterildi:false}.
//   - Gecis reklami: yalnizca Kacis ('kacis') ve Sirala Dur ('ss') bolum tamamlandi
//     ekranindan sonra; tamamlanan bolum no 1-2 ise yok; oturumda en az 4 bolum
//     tamamlamada bir (iki oyun birlikte sayilir); iki gecis arasi ve uygulama
//     acilisindan sonra en az 3 dk; odullu reklamdan sonra 3 dk yok; NO ADS
//     ('ait_noads') aciksa hic yok. NO ADS odullu reklamlari KAPATMAZ.
//   Kurallar gecisKarari() icinde saftir (tools/reklamTest.js dener).

window.Reklam = (function () {
  'use strict';

  var AYAR = window.ReklamAyar || { REKLAM_TEST: false, birimId: function () { return null; }, tur: function () { return null; } };
  var NOADS_ANAHTAR = 'ait_noads';

  var KURAL = {
    oyunlar: { kacis: 1, ss: 1 },   // gecis reklami gosterilebilen oyunlar
    ilkBolumler: 2,                 // tamamlanan bolum no <= 2 ise gecis yok
    enAzBolum: 4,                   // son gecisten (oturum basindan) beri en az bu kadar bolum
    gecisAraMs: 3 * 60 * 1000,      // iki gecis arasi (ve acilistan sonra ilk gecis)
    odulluSonrasiMs: 3 * 60 * 1000, // odullu reklamdan sonra gecis yok
    sahteOdulluSn: 3,
    sahteGecisSn: 2
  };

  // ---------------------------------------------------------------
  // SAF KURAL: gecis reklami gosterilebilir mi?
  // d      : { sonGecis, sonOdullu, sayac }   (ms, ms, adet)
  // baglam : { oyun, bolum }                   (bolum = tamamlanan bolumun numarasi)
  // Donus  : '' (uygun) ya da engelin adi.
  // ---------------------------------------------------------------
  function gecisKarari(d, baglam, simdi, noads) {
    if (noads) return 'noads';
    if (!baglam || !KURAL.oyunlar[baglam.oyun]) return 'oyun';
    var b = baglam.bolum;
    if (typeof b !== 'number' || !isFinite(b) || b <= KURAL.ilkBolumler) return 'ilkBolum';
    if (!(d.sayac >= KURAL.enAzBolum)) return 'sayac';
    if (simdi - d.sonOdullu < KURAL.odulluSonrasiMs) return 'odullu';
    if (simdi - d.sonGecis < KURAL.gecisAraMs) return 'aralik';
    return '';
  }

  // Oturum durumu (kaydedilmez: yeni oturum = sayac 0, acilis ani = son gecis)
  var durum = { sonGecis: Date.now(), sonOdullu: -Infinity, sayac: 0 };
  var mesgul = false;

  function noAdsMi() {
    try { return !!(window.AppStore && window.AppStore.get(NOADS_ANAHTAR, false)); } catch (e) { return false; }
  }

  // ---------------------------------------------------------------
  // SAGLAYICILAR — hepsi ayni yuz:
  //   hazirMi(id) -> bool, odullu(id) -> Promise<bool (sonuna kadar izlendi)>,
  //   gecis(id) -> Promise<bool (gosterildi)>
  // ---------------------------------------------------------------
  // Sahte mod YALNIZCA yerel adreste: file://, localhost, 127.0.0.1, [::1] ve ozel ag
  // IP'leri (10.x, 192.168.x, 172.16-31.x; telefondan yerel agla test icin). Yayindaki
  // adreste ?reklamTest sorgusu etkisizdir (bedava odul alinmasin).
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

  function sahteMod() {
    if (AYAR.REKLAM_TEST !== true || !yerelAdres()) return 0;
    var s = (window.location && typeof window.location.search === 'string') ? window.location.search : '';
    var m = /[?&]reklamTest=([12])(?:&|$)/.exec(s);
    return m ? Number(m[1]) : 0;
  }

  function yerelMi() {
    try { return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }

  // Sahte reklam katmani (yalnizca gelistirme). odulluMu: geri sayim biterse true,
  // "Kapat (odulsuz)" false. Gecis katmani her durumda true (gosterildi).
  function sahteKatman(odulluMu) {
    return new Promise(function (bitir) {
      var kok = document.querySelector('.phone') || document.body;
      var kat = document.createElement('div');
      kat.className = 'rk-test' + (odulluMu ? '' : ' gecis');
      kat.setAttribute('role', 'dialog');
      kat.setAttribute('aria-modal', 'true');
      var etiket = document.createElement('div');
      etiket.className = 'rk-test-etiket';
      etiket.textContent = odulluMu ? 'Reklam (test)' : 'Geçiş reklamı (test)';
      var alt = document.createElement('div');
      alt.className = 'rk-test-alt';
      alt.textContent = odulluMu ? 'Sonuna kadar izlersen ödül verilir' : 'Birazdan kapanacak';
      var sayac = document.createElement('div');
      sayac.className = 'rk-test-sayac';
      var kapat = document.createElement('button');
      kapat.className = 'rk-test-kapat';
      kapat.type = 'button';
      kapat.textContent = odulluMu ? 'Kapat (ödülsüz)' : 'Kapat';
      kat.appendChild(etiket); kat.appendChild(alt); kat.appendChild(sayac); kat.appendChild(kapat);
      kok.appendChild(kat);

      var kalan = odulluMu ? KURAL.sahteOdulluSn : KURAL.sahteGecisSn, bitti = false;
      sayac.textContent = kalan;
      var zaman = setInterval(function () {
        kalan--;
        if (kalan > 0) { sayac.textContent = kalan; return; }
        son(true);
      }, 1000);
      function son(tamam) {
        if (bitti) return;
        bitti = true;
        clearInterval(zaman);
        if (kat.parentNode) kat.parentNode.removeChild(kat);
        bitir(odulluMu ? tamam : true);
      }
      kapat.addEventListener('click', function () { son(false); });
    });
  }

  var SAHTE = {
    ad: 'sahte',
    hazirMi: function () { return sahteMod() === 1; },
    odullu: function () { return sahteKatman(true); },
    gecis: function () { return sahteKatman(false); }
  };

  // ASAMA 2 BAGLANTI NOKTASI (tek yer): @capacitor-community/admob burada baglanacak.
  //   hazirMi : eklentide o birim icin yuklu reklam var mi (prepareRewardVideoAd /
  //             prepareInterstitial sonucunu tutan bayrak)
  //   odullu  : showRewardVideoAd; 'Rewarded' olayi geldiyse true, kapatildi/yuklenemedi false.
  //             Gosterimden sonra ayni birim icin yeni reklam on yuklenmeli.
  //   gecis   : showInterstitial; gosterildiyse true.
  // Eklenti henuz yok: hicbir birim hazir degil, hicbir sey patlamaz.
  var YEREL = {
    ad: 'yerel',
    hazirMi: function () { return false; },
    odullu: function () { return Promise.resolve(false); },
    gecis: function () { return Promise.resolve(false); }
  };

  var YOK = {
    ad: 'yok',
    hazirMi: function () { return false; },
    odullu: function () { return Promise.resolve(false); },
    gecis: function () { return Promise.resolve(false); }
  };

  var saglayici = sahteMod() ? SAHTE : (yerelMi() ? YEREL : YOK);

  // ---------------------------------------------------------------
  // TEMEL API
  // ---------------------------------------------------------------
  function destekleniyor() { return saglayici !== YOK; }

  function hazirMi(birim) {
    if (!destekleniyor()) return false;
    var id = AYAR.birimId(birim);
    if (!id) return false;                 // bilinmeyen birim / release'te yer tutucu
    try { return !!saglayici.hazirMi(id, birim); } catch (e) { return false; }
  }

  function acikMi() { return mesgul; }

  // Promise<{odul:boolean}>. Odulu CAGIRAN verir, yalnizca odul:true ise.
  function odulluGoster(birim) {
    if (mesgul || AYAR.tur(birim) !== 'odullu' || !hazirMi(birim)) return Promise.resolve({ odul: false });
    mesgul = true;
    var p;
    try { p = Promise.resolve(saglayici.odullu(AYAR.birimId(birim), birim)); }
    catch (e) { p = Promise.resolve(false); }
    return p.then(function (r) { return r === true; }, function () { return false; })
      .then(function (odul) {
        mesgul = false;
        durum.sonOdullu = Date.now();     // izlendi ya da kapatildi: 3 dk gecis yok
        return { odul: odul };
      });
  }

  // Bolum tamamlandi ANINDA (kazanma ekrani acilirken) cagrilir. Yalnizca
  // 'kacis' ve 'ss' sayilir; diger oyunlarda bir sey yapmaz. Donus: sayac.
  function bolumTamamlandi(baglam) {
    if (baglam && KURAL.oyunlar[baglam.oyun]) durum.sayac++;
    return durum.sayac;
  }

  // Bolum tamamlandi ekranindan CIKARKEN (Sonraki / Haritaya) cagrilir; kurallar
  // burada uygulanir. Promise<{gosterildi:boolean, neden:string}>. Oyun bunu
  // beklemeden de devam edebilir ama beklemesi onerilir (reklam kapaninca devam).
  function gecisGoster(baglam) {
    if (mesgul) return Promise.resolve({ gosterildi: false, neden: 'mesgul' });
    var neden = gecisKarari(durum, baglam, Date.now(), noAdsMi());
    if (!neden && !hazirMi('gecis')) neden = 'hazirDegil';     // sayac korunur, sonra yine denenir
    if (neden) return Promise.resolve({ gosterildi: false, neden: neden });
    mesgul = true;
    var p;
    try { p = Promise.resolve(saglayici.gecis(AYAR.birimId('gecis'))); }
    catch (e) { p = Promise.resolve(false); }
    return p.then(function (r) { return r === true; }, function () { return false; })
      .then(function (oldu) {
        mesgul = false;
        if (oldu) { durum.sonGecis = Date.now(); durum.sayac = 0; }
        return { gosterildi: oldu, neden: oldu ? '' : 'hata' };
      });
  }

  // 'gizli' (destek yok: dugmeyi hic gosterme) | 'pasif' (hazir degil: pasif +
  // "Reklam hazır değil") | 'hazir'
  function dugmeDurumu(birim) {
    if (!destekleniyor()) return 'gizli';
    return hazirMi(birim) ? 'hazir' : 'pasif';
  }

  // ---------------------------------------------------------------
  // ORTAK PENCERE (secim + ikinci sans). Siniflar style.css "REKLAM" bolumunde.
  // ---------------------------------------------------------------
  var KAMERA_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 7l-7 5 7 5V7Z"/>' +
    '<rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
  var HAZIR_DEGIL = 'Reklam hazır değil';

  var acikPencere = null;   // { kapat(deger) }

  // o: { baslik, metin, secenekler:[{deger, etiket, alt, birim, pasif}], iptal, esit }
  // Donus: Promise<deger | null>. Reklamli secenek (birim verilmis) tiklaninca reklam
  // burada oynatilir; deger YALNIZCA odul:true ise doner, degilse null.
  function pencere(o) {
    return new Promise(function (bitir) {
      // reklam oynarken yeni pencere acilmaz; oynayan reklama ve onun odulune dokunulmaz
      if (mesgul || (acikPencere && acikPencere.bekliyorMu())) { bitir(null); return; }
      if (acikPencere) acikPencere.kapat(null);
      var gorunen = (o.secenekler || []).filter(function (s) { return !s.birim || dugmeDurumu(s.birim) !== 'gizli'; });
      if (!gorunen.length) { bitir(null); return; }

      var kok = document.querySelector('.phone') || document.body;
      var ortu = document.createElement('div');
      ortu.className = 'rk-ortu';
      ortu.setAttribute('role', 'dialog');
      ortu.setAttribute('aria-modal', 'true');
      var kart = document.createElement('div');
      kart.className = 'rk-kart';
      if (o.baslik) {
        var b = document.createElement('div');
        b.className = 'rk-baslik';
        b.textContent = o.baslik;
        kart.appendChild(b);
      }
      if (o.metin) {
        var m = document.createElement('div');
        m.className = 'rk-metin';
        m.textContent = o.metin;
        kart.appendChild(m);
      }
      var liste = document.createElement('div');
      liste.className = 'rk-dugmeler' + (o.esit ? ' esit' : '');
      kart.appendChild(liste);

      var dugmeler = [], bekliyor = false, bitti = false, yoklama = null;

      function dugmeYaz(k) {
        var s = k.s, d = k.el, reklamli = !!s.birim;
        var st = reklamli ? dugmeDurumu(s.birim) : 'hazir';
        var pasif = !!s.pasif || st === 'pasif';
        d.disabled = pasif || bekliyor;
        d.classList.toggle('pasif', pasif);
        d.innerHTML = '';
        var ana = document.createElement('span');
        ana.className = 'rk-btn-ana';
        if (reklamli) ana.innerHTML = KAMERA_SVG;
        ana.appendChild(document.createTextNode(reklamli && st === 'pasif' ? HAZIR_DEGIL : s.etiket));
        d.appendChild(ana);
        if (s.alt && !(reklamli && st === 'pasif')) {
          var alt = document.createElement('span');
          alt.className = 'rk-btn-alt';
          alt.textContent = s.alt;
          d.appendChild(alt);
        }
      }

      gorunen.forEach(function (s) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'rk-btn ' + (s.birim ? 'rk-reklam' : 'rk-normal');
        var k = { s: s, el: d };
        dugmeYaz(k);
        d.addEventListener('click', function () {
          if (bekliyor || d.disabled) return;
          if (!s.birim) { kapat(s.deger); return; }
          bekliyor = true;
          dugmeler.forEach(dugmeYaz);
          odulluGoster(s.birim).then(function (r) { kapat(r.odul ? s.deger : null); });
        });
        dugmeler.push(k);
        liste.appendChild(d);
      });

      if (o.iptal) {
        var ip = document.createElement('button');
        ip.type = 'button';
        ip.className = 'rk-iptal';
        ip.textContent = o.iptal;
        ip.addEventListener('click', function () { if (!bekliyor) kapat(null); });
        kart.appendChild(ip);
      }

      ortu.appendChild(kart);
      kok.appendChild(ortu);

      // hazir olmayan reklam sonradan yuklenirse dugme kendiliginden acilsin
      if (gorunen.some(function (s) { return !!s.birim; })) {
        yoklama = setInterval(function () { if (!bekliyor) dugmeler.forEach(dugmeYaz); }, 1000);
      }

      function kapat(deger) {
        if (bitti) return;
        bitti = true;
        clearInterval(yoklama);
        if (ortu.parentNode) ortu.parentNode.removeChild(ortu);
        if (acikPencere === kayit) acikPencere = null;
        bitir(deger === undefined ? null : deger);
      }
      var kayit = { kapat: kapat, bekliyorMu: function () { return bekliyor; } };
      acikPencere = kayit;
    });
  }

  // Acik pencereyi "vazgec / hayir" (null) ile kapatir; reklam oynarken kapatmaz.
  // Donus: pencere kapatildiysa true.
  function pencereKapat() {
    if (!acikPencere || acikPencere.bekliyorMu()) return false;
    acikPencere.kapat(null);
    return true;
  }

  // Telefonun geri tusu kancasi: core.js popstate isleyicisi EN BASTA cagirir.
  // Donus true ise geri tusu burada tuketildi; core.js ekrani degistirmez, gecmis
  // kaydini yeniden iter. Acik pencere "vazgec / hayir" sayilir; reklam oynarken
  // (sahte katman ya da pencerede bekleyen reklam) geri tusu yok sayilir.
  function geriTusu() {
    if (mesgul) return true;
    if (acikPencere) { pencereKapat(); return true; }
    return false;
  }

  // Genel secim penceresi. Ornek (Kacis ipucu):
  //   Reklam.secim({ baslik:'İpucu', secenekler:[
  //     { deger:'altin',  etiket:'20 altın', alt:'Tek hamle', pasif: AppGold.get() < 20 },
  //     { deger:'reklam', etiket:'Reklam izle', alt:'10 hamleye kadar', birim:'ipucu_joker' } ],
  //     iptal:'Vazgeç' }).then(function (d) { ... d: 'altin' | 'reklam' (odul alindi) | null });
  // Reklam desteklenmiyorsa reklamli secenek hic cizilmez; gorunen secenek kalmazsa
  // pencere acilmadan null doner.
  function secim(o) { return pencere(o || {}); }

  // Ikinci sans penceresi. Promise<boolean>: true YALNIZCA reklam sonuna kadar
  // izlendiyse. Destek yoksa pencere hic acilmaz, hemen false. Iki dugme esit belirginlikte.
  function ikinciSans(o) {
    o = o || {};
    if (!destekleniyor()) return Promise.resolve(false);
    return pencere({
      baslik: o.baslik || 'Devam etmek ister misin?',
      metin: o.metin || '',
      esit: true,
      secenekler: [
        { deger: true, etiket: o.evet || 'Reklam izle, devam et', birim: 'ikinci_sans' },
        { deger: false, etiket: o.hayir || 'Hayır, bitir' }
      ]
    }).then(function (d) { return d === true; });
  }

  return {
    destekleniyor: destekleniyor,
    hazirMi: hazirMi,
    odulluGoster: odulluGoster,
    gecisGoster: gecisGoster,
    bolumTamamlandi: bolumTamamlandi,
    dugmeDurumu: dugmeDurumu,
    acikMi: acikMi,
    secim: secim,
    ikinciSans: ikinciSans,
    pencereKapat: pencereKapat,
    geriTusu: geriTusu,
    noAdsMi: noAdsMi,
    HAZIR_DEGIL: HAZIR_DEGIL,
    KAMERA_SVG: KAMERA_SVG,
    // saf kural + test kancalari (oyunlar kullanmaz)
    gecisKarari: gecisKarari,
    KURAL: KURAL,
    _durum: function () { return { sonGecis: durum.sonGecis, sonOdullu: durum.sonOdullu, sayac: durum.sayac }; },
    _saglayici: function () { return saglayici.ad; },
    _saglayiciAyarla: function (s) { saglayici = s; }
  };
})();
