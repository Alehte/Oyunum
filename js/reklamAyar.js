// reklamAyar.js — reklam birim kimlikleri TEK yerde.
// Yuklenme sirasi: core.js -> reklamAyar.js -> reklam.js -> marketKatalog.js -> market.js
//
// REKLAM_TEST = true  : Google'in TEST kimlikleri kullanilir (gelistirme, varsayilan).
//                       Tarayicidaki sahte reklam modu (?reklamTest=1 / =2) yalnizca bu
//                       bayrak acikken calisir.
// REKLAM_TEST = false : gercek (release) kimlikler. Yer tutucu ('YAPISTIR_ID') kalan
//                       birim "hazir degil" sayilir: reklam gosterilmez, hata verilmez.
//
// UYARI: gercek kimliklerle gelistirirken / denerken KENDI REKLAMINA ASLA TIKLAMA.
// AdMob bunu gecersiz trafik sayar, hesap askiya alinabilir. Gelistirme hep TEST
// kimlikleriyle (REKLAM_TEST = true) yapilir.
//
// Birim adlari (oyunlar yalnizca bunlari bilir):
//   ipucu_joker : Kacis ipucu, Sirala Dur jokerleri   (odullu)
//   ikinci_sans : kayip aninda "devam et"             (odullu)
//   altin_x2    : market +200 altin ve %20 indirim    (odullu; adi tarihsel)
//   gecis       : bolum arasi gecis reklami           (gecis)

window.ReklamAyar = (function () {
  'use strict';

  var REKLAM_TEST = true;

  var YER_TUTUCU = 'YAPISTIR_ID';

  // Google'in herkese acik TEST kimlikleri
  var TEST = {
    uygulama: 'ca-app-pub-3940256099942544~3347511713',
    odullu:   'ca-app-pub-3940256099942544/5224354917',
    gecis:    'ca-app-pub-3940256099942544/1033173712'
  };

  // Gercek kimlikler (release)
  var GERCEK = {
    uygulama: 'ca-app-pub-2250901316269310~9912780818',
    birimler: {
      ipucu_joker: YER_TUTUCU,     // kullanici verecek
      ikinci_sans: YER_TUTUCU,     // kullanici verecek
      altin_x2:    YER_TUTUCU,     // kullanici verecek
      gecis:       'ca-app-pub-2250901316269310/5223687222'   // gecis_bolum_arasi
    }
  };

  var TUR = { ipucu_joker: 'odullu', ikinci_sans: 'odullu', altin_x2: 'odullu', gecis: 'gecis' };

  function gecerliId(id) { return typeof id === 'string' && id !== '' && id.indexOf(YER_TUTUCU) < 0; }

  // Birimin kimligi; bilinmeyen birim ya da yer tutucu ise null.
  function birimId(birim) {
    if (!Object.prototype.hasOwnProperty.call(TUR, birim)) return null;
    var id = REKLAM_TEST ? TEST[TUR[birim]] : GERCEK.birimler[birim];
    return gecerliId(id) ? id : null;
  }

  return {
    REKLAM_TEST: REKLAM_TEST,
    YER_TUTUCU: YER_TUTUCU,
    BIRIMLER: Object.keys(TUR),
    tur: function (birim) { return Object.prototype.hasOwnProperty.call(TUR, birim) ? TUR[birim] : null; },
    uygulamaId: function () { return REKLAM_TEST ? TEST.uygulama : GERCEK.uygulama; },
    birimId: birimId
  };
})();
