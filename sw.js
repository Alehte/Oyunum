// sw.js — All in Together servis calisani (cevrimdisi calisma + onbellek).
//
// YENI SURUM YAYINLARKEN: asagidaki SURUM sayisini bir artir. Bu dosya
// degistigi icin tarayici yeni calisani arka planda kurar; yeni onbellek
// dolar, eskisi silinir. Baska hicbir yerde surum yazmak gerekmez.
// DIKKAT: SURUM artirilmazsa degisiklik (index.html, js, css, gorsel) zaten
// kurulu kullanicilara HIC ulasmaz; uygulama eski onbellekten acilmaya devam
// eder. (Eskiden index.html agdan geldigi icin ulasiyordu; artik ulasmaz.)
// Yeni dosya eklersen ilgili listeye (CEKIRDEK ya da OYUNLAR) de ekle.
//
// STRATEJI (uygulama kabugu surumlu onbellekten)
//   index.html          : once onbellek; onbellekte varsa aga hic bakilmaz.
//                         Sayfa ve js/css her zaman AYNI onbellek surumunden
//                         gelir. Onbellekte yoksa (olagandisi) agdan getirilir.
//   js / css / gorsel   : once onbellek (cache-first), yoksa ag + onbellege yaz
//   kurulumda (install) : CEKIRDEK + OYUNLAR on yuklenir (ana menu, market ve
//                         butun oyunlar), boylece hic acilmamis oyun da ilk
//                         kurulumdan itibaren cevrimdisi calisir. Kurulum
//                         atomiktir: tek dosya inemezse kurulum basarisiz olur,
//                         tarayici sonra yeniden dener (yarim onbellekle
//                         etkinlesmez; varsa eski calisan ve onbellegi kalir).
//   kurulumdan sonra    : sayfa bosta kalinca 'isit' mesaji yollar; isit()
//                         yalnizca ONARIM yapar: onbellekten bir sey eksilmisse
//                         (tarayici/kullanici silmis) ve sunucudaki sw.js ayni
//                         SURUM'u tasiyorsa eksikleri tamamlar. Onbellek hicbir
//                         yolda toptan silinmez.
//
// GUNCELLEME (zorlamadan): yeni surum kullaniciya YALNIZCA yeni calisan
// uzerinden ulasir. Tarayici sw.js'in degistigini gorunce (gezinmede) yeni
// calisani kurar; o, tam seti 'ait-v<yeni>' icine atomik indirir ve BEKLER.
// Bu sirada acik sayfa eski onbellekle tutarli calismaya devam eder. Yeni
// calisan, arka plana alininca sayfa 'gec' mesaji yollarsa ya da uygulamanin
// butun sekmeleri/pencereleri kapaninca etkinlesir; activate eski onbellegi
// siler. Sonraki acilis tamamen yeni onbellekten olur.
//
// Butun yollar GORELI: site bir alt yolda (ornegin /All-in-Together/)
// yayinlansa da calisir.
'use strict';

var SURUM = '26';
var ONBELLEK = 'ait-v' + SURUM;

var CEKIRDEK = [
  'index.html',
  'gizlilik.html',
  'style.css',
  'manifest.json',
  'js/kalite.js',
  'js/core.js',
  'js/reklamAyar.js',
  'js/reklam.js',
  'js/marketKatalog.js',
  'js/market.js',
  'js/marketEkran.js',
  'js/fpsGosterge.js',
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
  'js/atesBocegi.js',
  'js/atesBocegiOyun.js',
  'img/susirala-bg.webp',
  'img/joker-bastan-basla.webp',
  'img/joker-gerial.webp',
  'img/joker-perde.webp',
  'img/joker-sise.webp'
];

// HTTP onbellegini atlayarak iste: yeni surumun onbellegine bayat dosya girmesin
function taze(yol) { return new Request(yol, { cache: 'reload' }); }

// cache:'reload' yalnizca tarayicinin HTTP onbellegini atlar; GitHub Pages'in
// CDN'i (max-age=600) yayindan hemen sonra eski dosyayi verebilir. Surum
// sorgusu (?v=SURUM) CDN'de yeni bir anahtar oldugu icin dosya kaynaktan gelir.
// Onbellege ise TEMIZ anahtarla (yol) yazilir: sayfa sorgusuz ister.
function surumlu(yol) { return taze(yol + '?v=' + SURUM); }

// Yonlendirilmis (redirected) yanit gezinmeye verilirse Chrome reddeder;
// onbellek oncelikli modelde bu kalici hata demek. Govde + durum + basliklarla
// temiz bir Response olarak yeniden kurulur.
function temizYanit(yanit) {
  if (!yanit.redirected) return Promise.resolve(yanit);
  return yanit.blob().then(function (govde) {
    return new Response(govde, { status: yanit.status, statusText: yanit.statusText, headers: yanit.headers });
  });
}

// Dosyayi surum sorgusuyla getir; ok degilse reddet.
function surumluGetir(yol) {
  return fetch(surumlu(yol)).then(function (yanit) {
    if (!yanit || !yanit.ok) throw new Error(yol + ': ' + (yanit ? yanit.status : 'yanit yok'));
    return temizYanit(yanit);
  });
}

// Atomik kurulum (addAll yerine elle, cunku istek adresi ile onbellek anahtari
// farkli): ONCE butun dosyalar getirilir; biri ok degilse ya da ag koparsa
// hicbir sey yazilmadan reddedilir. Hepsi geldiyse yazilir. Yazma sirasinda
// hata olursa (kota vb.) yarim set kalabilir, ama waitUntil reddedildigi icin
// bu calisan hic etkinlesmez; bir sonraki deneme ayni anahtarlarin hepsini
// yeniden yazar. Onbellek bu yuzden silinmez: ayni SURUM'la kurulmus etkin
// bir calisan varsa onun onbellegi de budur.
self.addEventListener('install', function (olay) {
  var liste = CEKIRDEK.concat(OYUNLAR);
  olay.waitUntil(
    Promise.all(liste.map(surumluGetir)).then(function (yanitlar) {
      return caches.open(ONBELLEK).then(function (kasa) {
        return Promise.all(yanitlar.map(function (yanit, i) { return kasa.put(liste[i], yanit); }));
      });
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

// ONARIM: onbellekten eksilen cekirdek + oyun dosyalarini arka planda tamamla
// (zaten olanlara dokunmaz). Kurulum tam seti yazdigi icin normalde eksik yoktur;
// eksik ancak tarayici ya da kullanici onbellegi kismen sildiyse olur.
// Surum karismasin diye: eksik varsa once sunucudaki sw.js okunur; SURUM'u
// bizimkiyle ayni degilse sunucuda baska bir yayin var demektir, onun
// dosyalari bu onbellege YAZILMAZ (o yayini yeni calisan kendi onbellegine
// tam set olarak getirecek).
// sw.js'e bizim SURUM'umuz degil, her seferinde degisen bir sorgu eklenir:
// amac CDN'deki bayat kopyayi degil sunucudaki GUNCEL sw.js'i gormek.
// Eksik dosyalar install gibi surumlu (?v=SURUM) istenir, temiz anahtarla yazilir.
function sunucuSurumu() {
  return fetch(taze('sw.js?t=' + Date.now())).then(function (yanit) {
    if (!yanit || !yanit.ok) return null;
    return yanit.text().then(function (metin) {
      var m = /var SURUM = '([^']*)'/.exec(metin);
      return m ? m[1] : null;
    });
  }).catch(function () { return null; });
}

function isit() {
  return caches.open(ONBELLEK).then(function (kasa) {
    var eksik = [];
    return CEKIRDEK.concat(OYUNLAR).reduce(function (zincir, yol) {
      return zincir.then(function () {
        return kasa.match(yol).then(function (var_) { if (!var_) eksik.push(yol); });
      });
    }, Promise.resolve()).then(function () {
      if (!eksik.length) return;
      return sunucuSurumu().then(function (surum) {
        if (surum !== SURUM) return;   // cevrimdisi ya da baska yayin: dokunma
        return eksik.reduce(function (zincir, yol) {
          return zincir.then(function () {
            return surumluGetir(yol).then(function (yanit) {
              return kasa.put(yol, yanit);
            }).catch(function () { /* cevrimdisi ya da hata: sonraki acilista yeniden denenir */ });
          });
        }, Promise.resolve());
      });
    });
  });
}

self.addEventListener('message', function (olay) {
  var tur = olay.data && olay.data.tur;
  if (tur === 'gec') self.skipWaiting();
  else if (tur === 'isit') olay.waitUntil(isit());
});

// --- index.html: once onbellek ---
// Onbellekteki sayfa, ayni onbellekteki js/css ile ayni yayindandir; aga hic
// bakilmaz (yeni yayin yeni calisanla gelir). Anahtar sabit 'index.html':
// kapsam koku, 'index.html' ve sorgu dizgili (?utm_source=...) gezinmeler
// hep ayni sayfayi bulur.
// Onbellekte sayfa yoksa (olagandisi: tarayici onbellegi silmis) agdan
// getirilir ama onbellege YAZILMAZ: agdaki sayfa onbellekte kalmis js/css ile
// ayni yayindan olmayabilir. Eksikleri, surum denetimiyle, isit() tamamlar
// (sayfa acilinca 'isit' yollar). Ag da yoksa kisa bir cevrimdisi sayfasi doner.
function cevrimdisiSayfa() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<title>All in Together</title><p style="font-family:sans-serif;text-align:center;margin-top:40vh">' +
    'Ba&#287;lant&#305; yok. &#304;nternete ba&#287;lan&#305;p yeniden dene.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function gezinme(olay) {
  var agdan = function () { return fetch(olay.request).catch(cevrimdisiSayfa); };
  return caches.open(ONBELLEK).then(function (kasa) {
    return kasa.match('index.html');
  }).then(function (bulunan) {
    return bulunan || agdan();
  }, agdan);
}

// --- uygulama disi sayfalar (gizlilik.html): once ag, yoksa onbellek ---
// index.html'in yolundan (gezinme) GECMEZ: o yol her gezinmeye onbellekteki
// 'index.html'i dondurur, gizlilik sayfasi hic acilmazdi.
function digerSayfa(istek) {
  return fetch(istek).then(function (yanit) {
    if (yanit && yanit.ok && yanit.type === 'basic') {
      var kopya = yanit.clone();
      caches.open(ONBELLEK).then(function (kasa) { return kasa.put(istek, kopya); });
    }
    return yanit;
  }).catch(function () {
    return caches.open(ONBELLEK).then(function (kasa) {
      return kasa.match(istek, { ignoreSearch: true }).then(function (b) { return b || kasa.match('index.html'); });
    });
  });
}

// Gezinme uygulamanin kendisine mi (kapsam koku ya da index.html)?
function uygulamaMi(url) {
  var kok = new URL(self.registration.scope).pathname;
  if (url.pathname.indexOf(kok) !== 0) return false;
  var goreli = url.pathname.slice(kok.length);
  return goreli === '' || goreli === 'index.html';
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
  if (istek.mode === 'navigate') {
    olay.respondWith(uygulamaMi(url) ? gezinme(olay) : digerSayfa(istek));
    return;
  }
  olay.respondWith(statik(istek));
});
