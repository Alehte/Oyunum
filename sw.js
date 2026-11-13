// sw.js — All in Together servis calisani (cevrimdisi calisma + onbellek).
//
// YENI SURUM YAYINLARKEN: asagidaki SURUM sayisini bir artir. Bu dosya
// degistigi icin tarayici yeni calisani arka planda kurar; yeni onbellek
// dolar, eskisi silinir. Baska hicbir yerde surum yazmak gerekmez.
// Yeni dosya eklersen ilgili listeye (CEKIRDEK ya da OYUNLAR) de ekle.
//
// STRATEJI
//   index.html          : once ag (network-first), ag yoksa/yavassa onbellek
//   js / css / gorsel   : once onbellek (cache-first), yoksa ag + onbellege yaz
//   kurulumda (install) : CEKIRDEK on yuklenir (ana menu + market)
//   kurulumdan sonra    : sayfa bosta kalinca OYUNLAR arka planda isitilir,
//                         boylece hic acilmamis oyun da cevrimdisi calisir
//
// GUNCELLEME (zorlamadan): yeni calisan kurulur ve BEKLER; eski sayfa eski
// onbellekle tutarli calismaya devam eder. Uygulama bir sonraki acilista,
// ya da arka plana alindiginda (sayfa 'gec' mesaji yollarsa) yenisine gecer.
//
// Butun yollar GORELI: site bir alt yolda (ornegin /All-in-Together/)
// yayinlansa da calisir.
'use strict';

var SURUM = '5';
var ONBELLEK = 'ait-v' + SURUM;

var CEKIRDEK = [
  'index.html',
  'style.css',
  'manifest.json',
  'js/core.js',
  'js/marketKatalog.js',
  'js/market.js',
  'js/marketEkran.js',
  'fonts/fredoka-latin.woff2',
  'fonts/fredoka-latin-ext.woff2',
  'img/home-bg.webp',
  'img/app-icon.webp',
  'img/jeton.webp',
  'img/hedef2048.webp',
  'img/kacis.webp',
  'img/tempoKup.webp',
  'img/siralaDur.webp',
  'launchericon-192x192.png'
];

var OYUNLAR = [
  'js/hedef2048.js',
  'js/bolumler.js',
  'js/ozel_bolumler.js',
  'js/kacis.js',
  'js/suSirala.js',
  'js/suSiralaBolumler.js',
  'js/suSiralaOzel.js',
  'js/suSiralaJoker.js',
  'js/suSiralaOyun.js',
  'js/suSiralaOzelOyun.js',
  'js/tempoCekirdek.js',
  'js/tempoKup.js',
  'img/susirala-bg.webp',
  'img/joker-bastan-basla.webp',
  'img/joker-gerial.webp',
  'img/joker-perde.webp',
  'img/joker-sise.webp'
];

var GEZINME_SABRI = 3500;   // ms: ag bu kadar surede yanit vermezse onbellekteki sayfa acilir

// HTTP onbellegini atlayarak iste: yeni surumun onbellegine bayat dosya girmesin
function taze(yol) { return new Request(yol, { cache: 'reload' }); }

self.addEventListener('install', function (olay) {
  olay.waitUntil(
    caches.open(ONBELLEK).then(function (kasa) {
      return kasa.addAll(CEKIRDEK.map(taze));
    })
  );
  // skipWaiting YOK: acik sayfa eski surumle tutarli kalsin
});

self.addEventListener('activate', function (olay) {
  olay.waitUntil(
    caches.keys().then(function (adlar) {
      return Promise.all(adlar.map(function (ad) {
        if (ad.indexOf('ait-') === 0 && ad !== ONBELLEK) return caches.delete(ad);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Cekirdek + oyun dosyalarini arka planda onbellege al (zaten olanlara dokunmaz).
// Cekirdek de listede: sayfa degisip onbellek bosaldiysa o da yeniden dolsun.
function isit() {
  return caches.open(ONBELLEK).then(function (kasa) {
    return CEKIRDEK.concat(OYUNLAR).reduce(function (zincir, yol) {
      return zincir.then(function () {
        return kasa.match(yol).then(function (var_) {
          if (var_) return;
          return fetch(taze(yol)).then(function (yanit) {
            if (yanit && yanit.ok) return kasa.put(yol, yanit);
          }).catch(function () { /* cevrimdisi: sonraki acilista yeniden denenir */ });
        });
      });
    }, Promise.resolve());
  });
}

self.addEventListener('message', function (olay) {
  var tur = olay.data && olay.data.tur;
  if (tur === 'gec') self.skipWaiting();
  else if (tur === 'isit') olay.waitUntil(isit());
});

// --- index.html: once ag ---
// Sayfa degismisse onbellekteki eski js/css ile karismasin diye onbellek
// bosaltilir; dosyalar agdan yeniden gelir ve yeniden yazilir. Bu YALNIZCA
// yeni sayfa gercekten acilacaksa yapilir: onbellekteki eski sayfa acildiysa
// ona dokunulmaz, yoksa eski sayfa sonradan yeni oyun dosyalarini cekerdi.
function sayfayiYaz(yanit) {
  var kopya = yanit.clone();
  return caches.open(ONBELLEK).then(function (kasa) {
    return Promise.all([kasa.match('index.html'), kopya.clone().text()]).then(function (ikili) {
      var eski = ikili[0], yeniMetin = ikili[1];
      var eskiMetin = eski ? eski.text() : Promise.resolve(null);
      return eskiMetin.then(function (metin) {
        if (metin === null || metin === yeniMetin) return false;
        return kasa.keys().then(function (anahtarlar) {
          return Promise.all(anahtarlar.map(function (k) { return kasa.delete(k); }));
        }).then(function () { return true; });
      }).then(function (bosaldi) {
        return kasa.put('index.html', kopya).then(function () { return bosaldi; });
      });
    });
  });
}

function gezinme(olay) {
  var agdan = fetch(olay.request).then(function (yanit) {
    if (!yanit || !yanit.ok) throw new Error('sayfa alinamadi');
    return yanit;
  });
  var onbellekten = function () {
    return caches.open(ONBELLEK).then(function (kasa) { return kasa.match('index.html'); });
  };
  // yeni sayfa acilacak: onbellegi ona gore yaz; bosaldiysa dosyalari arkada yeniden doldur
  var yeniSayfa = function (yanit) {
    return sayfayiYaz(yanit).then(function (bosaldi) {
      if (bosaldi) { try { olay.waitUntil(isit()); } catch (e) { isit(); } }
      return yanit;
    }, function () { return yanit; });
  };
  var sabir = new Promise(function (coz) { setTimeout(coz, GEZINME_SABRI, null); });
  return Promise.race([agdan.catch(function () { return null; }), sabir]).then(function (yanit) {
    if (yanit) return yeniSayfa(yanit);
    // ag yavas ya da yok: onbellekteki sayfa onbellekteki dosyalarla tutarli acilir
    return onbellekten().then(function (yedek) {
      return yedek || agdan.then(yeniSayfa);   // onbellek de yoksa agi beklemekten baska care yok
    });
  });
}

// --- statik dosyalar: once onbellek ---
function statik(istek) {
  return caches.open(ONBELLEK).then(function (kasa) {
    return kasa.match(istek).then(function (bulunan) {
      if (bulunan) return bulunan;
      return fetch(istek).then(function (yanit) {
        if (yanit && yanit.ok && yanit.type === 'basic') kasa.put(istek, yanit.clone());
        return yanit;
      });
    });
  });
}

self.addEventListener('fetch', function (olay) {
  var istek = olay.request;
  if (istek.method !== 'GET') return;
  var url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;                 // baska kaynaklara karisma
  if (url.pathname.indexOf('/.well-known/') >= 0) return;          // assetlinks hep agdan
  if (istek.mode === 'navigate') { olay.respondWith(gezinme(olay)); return; }
  olay.respondWith(statik(istek));
});
