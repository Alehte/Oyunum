// marketKatalog.js — MARKET tema tablosu. SAF VERI, mantik yok.
//
// TEK URUN = TEK TEMA
// Bir tema satin alininca / kutudan cikinca DORT oyuna birden uygulanir:
//   deri : Kacis? yilan derisi            (ozel bolumlerde uygulanmaz)
//   karo : Hedef 2048 karolari + tahta zemini
//   blok : Tempo Kup bloklari
//   sise : Sirala Dur cam sisesi + kapagi  (sivi renkleri oyunun kendi paleti)
//          siluet (govde bicimi) nadirlikle zenginlesir:
//            siradan  -> standart tup
//            nadir    -> omuzlu (Murekkep), bombeli (Kiraz), damla (Sedef)
//            ender    -> vazo (Cini), iksir (Vitray)
//            efsanevi -> kum saati (Lav)
//          Siluet yalnizca gorseldir; kapasite ve dokme degismez.
//   ton  : ana ekran + market icin renk tonu (yari saydam CSS gradyani)
// Oyunlarin kendi arka planlari temayla DEGISMEZ.
//
// KURAL: 'varsayilan' temanin butun parcalari { yerlesik:true } seklindedir;
// bu "oyun hicbir seyi ezmesin, kendi cizimi aynen kalsin" demektir.
//
// Efsanevi temalarda `animasyon` alani vardir; hareketi style.css yapar.
// Diger kademelerde animasyon YOK.

window.AppMarketKatalog = (function () {
  'use strict';

  // ---------------------------------------------------------------
  // NADIRLIK KADEMELERI
  // fiyat : Gunun Seckisi'ndeki dogrudan satis fiyati (jeton)
  // iade  : tema kutudan TEKRAR cikarsa geri verilen jeton
  // ---------------------------------------------------------------
  var NADIRLIK = {
    siradan:  { ad: 'Sıradan',  renk: '#8A8F98', parlak: '#B9BEC7', fiyat: 800,  iade: 300,  sira: 0 },
    nadir:    { ad: 'Nadir',    renk: '#3B82F6', parlak: '#7DAEFF', fiyat: 1800, iade: 600,  sira: 1 },
    ender:    { ad: 'Ender',    renk: '#A855F7', parlak: '#CB93FF', fiyat: 4000, iade: 1200, sira: 2 },
    efsanevi: { ad: 'Efsanevi', renk: '#FBBF24', parlak: '#FFDA7A', fiyat: 8000, iade: 2500, sira: 3 }
  };

  // ---------------------------------------------------------------
  // KUTULAR — ihtimal toplami 1.00. Once nadirlik cekilir, sonra o
  // nadirlikten bir tema. Tema zaten varsa jeton iadesi yapilir.
  // ---------------------------------------------------------------
  var SANDIKLAR = [
    { id: 'gumus', ad: 'Gümüş Kutu', fiyat: 1000, renk: '#B8C4D4',
      ihtimal: { siradan: 0.50, nadir: 0.30, ender: 0.15, efsanevi: 0.05 } },
    { id: 'altin', ad: 'Altın Kutu', fiyat: 3500, renk: '#F0B93C',
      ihtimal: { siradan: 0.19, nadir: 0.38, ender: 0.28, efsanevi: 0.15 } }
  ];

  var YERLESIK = { yerlesik: true };

  var TEMALAR = [

    // =============================================================
    // VARSAYILAN — ucretsiz, bastan sahip, seckiye/kutuya girmez
    // =============================================================
    { id: 'varsayilan', ad: 'Varsayılan', nadirlik: 'siradan', varsayilan: true,
      ton: YERLESIK, deri: YERLESIK, karo: YERLESIK, blok: YERLESIK, sise: YERLESIK },

    // #############################################################
    // TOPRAK (siradan) — islak kakao toprak, kuru kil, yosun. Mat ve sicak.
    // #############################################################
    {
      id: 'toprak', ad: 'Toprak', nadirlik: 'siradan',
      ton: { css: 'linear-gradient(175deg, rgba(122,84,46,.46) 0%, rgba(58,40,22,.50) 55%, rgba(30,20,12,.62) 100%)' },
      deri: {
        govde: { tip: 'benekli', renkler: ['#9C7A55', '#7E5F3E', '#B69572', '#6A4C30'], kontur: '#3B2A1B' },
        // hedef: topragin altindaki canli kok — kesintili yesil damar
        hedef: { tip: 'benekli', renkler: ['#6B7350'], kontur: '#2F3524', vurgu: '#4E9E5C', vurguTip: 'damar' }
      },
      karo: {
        zemin: '#17120D',
        palet: {
          '2': ['#241A12', '#A8926F'], '4': ['#2C2016', '#B49C77'], '8': ['#35271A', '#C0A67F'],
          '16': ['#3F2E1E', '#CCB088'], '32': ['#4A3722', '#D8BA90'], '64': ['#574026', '#E4C499'],
          '128': ['#654A2A', '#EFCFA3'], '256': ['#75552E', '#FADAAE'], '512': ['#876132', '#FFE6BE'],
          '1024': ['#9B7038', '#0A0704'], '2048': ['#C9A25A', '#241705'],
          'wild': ['#E8C46A', '#3A2A08'], 'kilit': ['#33302B', '#9E998E'], 'duvar': ['#1E1A14', '#453E33']
        }
      },
      blok: { renkler: ['#B4623A', '#7E8C4E', '#D2B78A', '#9C6B45', '#5F8A5C', '#8A6240', '#C99A4E'],
              kenar: 'rgba(40,24,12,.55)', koseYaricap: '24%', parlama: false },
      sise: { cam: 'rgba(196,150,96,.16)', kenar: 'rgba(214,176,128,.66)', parlama: 0.22,
              kapak: 'mantar', kapakRenk: '#B07E48' }
    },

    // #############################################################
    // BUZ (siradan) — donmus gol. Tek soguk siradan tema.
    // #############################################################
    {
      id: 'buz', ad: 'Buz', nadirlik: 'siradan',
      ton: { css: 'linear-gradient(178deg, rgba(110,170,215,.40) 0%, rgba(40,84,128,.40) 55%, rgba(14,30,52,.58) 100%)' },
      deri: {
        govde: { tip: 'duz', renkler: ['#BBD4E4', '#9CBBD0', '#D8E9F2', '#8AA9C0'], kontur: '#3E5C74', parlak: true },
        // hedef: buzun altindan gorunen tek canli renk — parlak yesil kontur
        hedef: { tip: 'duz', renkler: ['#A9CFD4'], kontur: '#2FA97A', vurgu: '#35D98A', vurguTip: 'kontur', parlak: true }
      },
      karo: {
        zemin: '#0E1620',
        palet: {
          '2': ['#17222E', '#7A97AE'], '4': ['#1B2A38', '#86A5BC'], '8': ['#203243', '#92B2C9'],
          '16': ['#253B4E', '#9FC0D6'], '32': ['#2B455A', '#ACCEE3'], '64': ['#325067', '#B9DCEF'],
          '128': ['#395C75', '#C7EAFA'], '256': ['#416984', '#D6F3FF'], '512': ['#4A7894', '#F1FCFF'],
          '1024': ['#5A8FAC', '#141F26'], '2048': ['#A8DFF0', '#0B2230'],
          'wild': ['#E8CE7A', '#2E2408'], 'kilit': ['#2A3038', '#8F9AA5'], 'duvar': ['#161C24', '#3A4550']
        }
      },
      blok: { renkler: ['#BBD4E4', '#7FB4CC', '#D8E9F2', '#8FD0C4', '#9C8FD0', '#5E93B2', '#A6B8D8'],
              kenar: 'rgba(52,88,116,.75)', koseYaricap: '14%', parlama: true },
      sise: { cam: 'rgba(170,215,245,.20)', kenar: 'rgba(210,238,255,.86)', parlama: 0.5,
              kapak: 'duz', kapakRenk: '#5FA4DC' }
    },

    // #############################################################
    // KUMSAL (siradan) — acik kum ve sig deniz.
    // #############################################################
    {
      id: 'kumsal', ad: 'Kumsal', nadirlik: 'siradan',
      ton: { css: 'linear-gradient(180deg, rgba(64,150,144,.42) 0%, rgba(60,104,104,.32) 50%, rgba(196,160,104,.46) 100%)' },
      deri: {
        govde: { tip: 'duz', renkler: ['#E0C79B', '#C9A87A', '#8FC7C2', '#EFDCBC'], kontur: '#6E5B41' },
        // hedef: govdeye sarilmis deniz yosunu seridi
        hedef: { tip: 'duz', renkler: ['#CBBE96'], kontur: '#3E5245', vurgu: '#3FB98C', vurguTip: 'cizgi' }
      },
      karo: {
        zemin: '#141C1E',
        palet: {
          '2': ['#23201A', '#9F9078'], '4': ['#2D291F', '#B0A085'], '8': ['#383124', '#C1B092'],
          '16': ['#443B29', '#D2C0A0'], '32': ['#51462E', '#E3D0AD'], '64': ['#5F5233', '#F0DEBB'],
          '128': ['#6F5F38', '#FBEBC9'], '256': ['#80703E', '#FFF7E1'], '512': ['#2F6E6A', '#BEEDE6'],
          '1024': ['#3A8C84', '#0A1817'], '2048': ['#58C4B4', '#04241F'],
          'wild': ['#F0CE7A', '#3A2C08'], 'kilit': ['#33302A', '#9F998E'], 'duvar': ['#1E1B16', '#464036']
        }
      },
      blok: { renkler: ['#E2C99C', '#E89A78', '#5CC4B4', '#F2D06A', '#A89070', '#7FB8D4', '#2F8E86'],
              kenar: 'rgba(90,70,40,.45)', koseYaricap: '28%', parlama: false },
      sise: { cam: 'rgba(120,205,195,.16)', kenar: 'rgba(238,216,172,.76)', parlama: 0.3,
              kapak: 'mantar', kapakRenk: '#D9B77E' }
    },

    // #############################################################
    // MUREKKEP (nadir) — kagida dagilan indigo murekkep.
    // #############################################################
    {
      id: 'murekkep', ad: 'Mürekkep', nadirlik: 'nadir',
      ton: { css: 'linear-gradient(176deg, rgba(86,96,200,.44) 0%, rgba(52,40,128,.46) 55%, rgba(12,14,36,.66) 100%)' },
      deri: {
        govde: { tip: 'benekli', renkler: ['#4A4A8C', '#38386E', '#5E5EA6', '#2C2C56'], kontur: '#16162E' },
        // hedef: kagida dusen ikinci renk — govde boyunca yesil murekkep cizgisi
        hedef: { tip: 'benekli', renkler: ['#3E4A6E'], kontur: '#1E3A32', vurgu: '#3FD98E', vurguTip: 'cizgi' }
      },
      karo: {
        zemin: '#101226',
        palet: {
          '2': ['#171A2E', '#7A81AF'], '4': ['#1C2038', '#7F87B7'], '8': ['#212643', '#868FC0'],
          '16': ['#272D4E', '#929CCC'], '32': ['#2E345A', '#9EA9D8'], '64': ['#353C66', '#AAB6E4'],
          '128': ['#3D4573', '#B7C3F0'], '256': ['#464F81', '#C5D1FB'], '512': ['#505A90', '#D4DEFF'],
          '1024': ['#5C68A2', '#E8EEFF'], '2048': ['#A0AEEE', '#0E1226'],
          'wild': ['#E0C878', '#2E2608'], 'kilit': ['#26283A', '#8890A8'], 'duvar': ['#14162A', '#363A56']
        }
      },
      blok: { renkler: ['#5E68C4', '#8A5EC4', '#3E7EC4', '#E0DCEE', '#4450A0', '#A0A8F0', '#6E4E9E'],
              kenar: 'rgba(16,20,48,.8)', koseYaricap: '32%', parlama: false },
      sise: { cam: 'rgba(96,104,196,.22)', kenar: 'rgba(164,174,244,.76)', parlama: 0.28,
              kapak: 'duz', kapakRenk: '#4A4AA0', siluet: 'omuzlu' }
    },

    // #############################################################
    // KIRAZ (nadir) — koyu visne ve solgun gul. Yuvarlak formlar.
    // #############################################################
    {
      id: 'kiraz', ad: 'Kiraz', nadirlik: 'nadir',
      ton: { css: 'linear-gradient(174deg, rgba(190,60,92,.42) 0%, rgba(110,24,52,.46) 55%, rgba(26,8,14,.64) 100%)' },
      deri: {
        govde: { tip: 'seritli', renkler: ['#A8324E', '#7E203A', '#C45E76', '#5E1428'], kontur: '#3A0C1C' },
        // hedef: meyvenin sapi ve yapragi — govdeyi saran yesil kontur
        hedef: { tip: 'seritli', renkler: ['#8A3A48'], kontur: '#46C976', vurgu: '#46C976', vurguTip: 'kontur' }
      },
      karo: {
        zemin: '#180C12',
        palet: {
          '2': ['#24101A', '#B16E82'], '4': ['#2C1420', '#B77085'], '8': ['#351826', '#C0768C'],
          '16': ['#3F1C2C', '#CC8298'], '32': ['#4A2032', '#D88EA4'], '64': ['#562539', '#E49AB0'],
          '128': ['#632A40', '#F0A6BC'], '256': ['#713048', '#FBB4C8'], '512': ['#813651', '#FFC4D4'],
          '1024': ['#963E5D', '#FFD6E1'], '2048': ['#E2748F', '#2A0C16'],
          'wild': ['#E8C46A', '#3A2A08'], 'kilit': ['#2E2A2C', '#9A9195'], 'duvar': ['#1C1418', '#45383C']
        }
      },
      blok: { renkler: ['#C4425E', '#8E2440', '#E07E96', '#F0DCD2', '#A85E6E', '#D65A4A', '#7E9E68'],
              kenar: 'rgba(60,10,26,.5)', koseYaricap: '42%', parlama: true },
      sise: { cam: 'rgba(226,116,143,.16)', kenar: 'rgba(244,166,186,.78)', parlama: 0.4,
              kapak: 'halka', kapakRenk: '#C4425E', siluet: 'bombeli' }
    },

    // #############################################################
    // SEDEF (nadir) — inci ici. Acik, yanardoner. Tek acik nadir tema.
    // #############################################################
    {
      id: 'sedef', ad: 'Sedef', nadirlik: 'nadir',
      ton: { css: 'linear-gradient(168deg, rgba(244,190,220,.38) 0%, rgba(190,180,230,.30) 50%, rgba(150,196,236,.36) 100%)' },
      deri: {
        govde: { tip: 'kristal', renkler: ['#F0E3EA', '#E6D8E8', '#DCE7F2', '#F2E6D8'], kontur: '#B596B0', parlak: true },
        // hedef: inci icindeki yesil su — ince yesil cizgi
        hedef: { tip: 'kristal', renkler: ['#DDEEE2'], kontur: '#6FAE8C', vurgu: '#3FB57C', vurguTip: 'cizgi', parlak: true }
      },
      karo: {
        zemin: '#CBB9CE',
        motif: { tip: 'yay', renk: '#FFFFFF', opaklik: .34, boy: '70%', yerlesim: 'merkez' },
        palet: {
          '2': ['#F3D9EA', '#6B4E70'], '4': ['#ECC7E4', '#5D4064'], '8': ['#E2B2DE', '#4E3258'],
          '16': ['#D59CDA', '#3F254C'], '32': ['#C687D2', '#331D42'], '64': ['#B473C8', '#281639'],
          '128': ['#A15FBE', '#100819'], '256': ['#8D4EB0', '#F0E8F5'], '512': ['#7A3FA0', '#F6ECFF'],
          '1024': ['#672F8E', '#FAF2FF'], '2048': ['#4F2076', '#FFF7FF'],
          'wild': ['#E8C46A', '#3A2A08'], 'kilit': ['#C9BBCB', '#554A5A'], 'duvar': ['#AE9DB2', '#3E3444']
        }
      },
      blok: { renkler: ['#E88BB2', '#8FBBE8', '#EAC96E', '#B98FE0', '#7FD1AE', '#E8A06E', '#9CA6D6'],
              kenar: 'rgba(255,255,255,.55)', koseYaricap: '26%', parlama: true,
              motif: { tip: 'yay', renk: '#FFFFFF', opaklik: .38, boy: '70%', yerlesim: 'merkez' } },
      sise: { cam: 'rgba(255,236,248,.24)', kenar: 'rgba(255,238,248,.92)', parlama: 0.62,
              kapak: 'halka', kapakRenk: '#E3A9C8', siluet: 'damla' }
    },

    // #############################################################
    // CINI (ender) — Iznik. Krem zemin, kobalt, turkuaz, mercan vurgu.
    // Acik karolarda sayilar siyaha yakin (okunurluk).
    // #############################################################
    {
      id: 'cini', ad: 'Çini', nadirlik: 'ender',
      ton: { css: 'linear-gradient(172deg, rgba(58,121,198,.50) 0%, rgba(30,74,140,.44) 52%, rgba(46,158,158,.38) 100%)' },
      deri: {
        govde: { tip: 'seritli', renkler: ['#2E5FA8', '#3F79C6', '#2E9E9E', '#25518E'], kontur: '#F4EEDF' },
        // hedef: beyaz cini uzerine yesil firca borduru
        hedef: { tip: 'seritli', renkler: ['#EDE6D2'], kontur: '#2E5FA8', vurgu: '#2E9E63', vurguTip: 'cizgi' }
      },
      karo: {
        zemin: '#E2D7BC',
        motif: { tip: 'cini', renk: '#173B6E', opaklik: .26, boy: '80%', yerlesim: 'merkez' },
        palet: {
          '2': ['#EDE6D2', '#221D12'], '4': ['#E3DCC4', '#221D12'], '8': ['#CFE0E4', '#0F2A30'],
          '16': ['#B4D2DC', '#0C262E'], '32': ['#8FC3CE', '#08222A'], '64': ['#63A9C4', '#041C24'],
          '128': ['#4A8ECB', '#04142A'], '256': ['#3A76BE', '#FBFDFF'], '512': ['#2E5FA8', '#F2F7FF'],
          '1024': ['#24488A', '#F2F7FF'], '2048': ['#C7453A', '#FFF7F1'],
          'wild': ['#E0A83C', '#3A2405'], 'kilit': ['#C9C2AE', '#544F3F'], 'duvar': ['#A79E86', '#4A4436']
        }
      },
      blok: { renkler: ['#2E5FA8', '#2E9E9E', '#C7453A', '#F2EADA', '#5C97D8', '#2E9E63', '#E0A83C'],
              kenar: 'rgba(244,238,223,.9)', koseYaricap: '20%', parlama: true,
              motif: { tip: 'cini', renk: '#173B6E', opaklik: .30, boy: '84%', yerlesim: 'merkez' } },
      sise: { cam: 'rgba(92,151,216,.18)', kenar: 'rgba(244,238,223,.9)', parlama: 0.42,
              kapak: 'duz', kapakRenk: '#2E5FA8', siluet: 'vazo' }
    },

    // #############################################################
    // VITRAY (ender) — kursun konturlu renkli cam, arkadan gelen isik.
    // #############################################################
    {
      id: 'vitray', ad: 'Vitray', nadirlik: 'ender',
      ton: { css: 'linear-gradient(160deg, rgba(196,58,74,.40) 0%, rgba(126,58,180,.38) 48%, rgba(58,110,196,.42) 100%)' },
      deri: {
        govde: { tip: 'kristal', renkler: ['#C43A4A', '#3A6EC4', '#7E3AB4', '#D8A32E'], kontur: '#0E1018', parlak: true },
        // hedef: yesil cam panel, kursun konturun yerini yesil aliyor
        hedef: { tip: 'kristal', renkler: ['#1E6B4A'], kontur: '#0E1018', vurgu: '#37C46B', vurguTip: 'kontur', parlak: true }
      },
      karo: {
        zemin: '#0E1018',
        motif: { tip: 'bolme', renk: '#08090E', opaklik: .30, boy: '50%', yerlesim: 'doseme' },
        palet: {
          '2': ['#1C2233', '#8FA3C8'], '4': ['#23304A', '#9FB6DC'], '8': ['#2A4370', '#B4CBF2'],
          '16': ['#2F5AA0', '#CBE0FF'], '32': ['#3A6EC4', '#EFF5FF'], '64': ['#6A3FA8', '#EDE0FF'],
          '128': ['#8B3FA8', '#F6E2FF'], '256': ['#B03A72', '#FFE2F0'], '512': ['#C43A4A', '#FFEDEA'],
          '1024': ['#D8632E', '#30160A'], '2048': ['#E8C24A', '#2A1E04'],
          'wild': ['#F0D97A', '#332504'], 'kilit': ['#2A2E3A', '#9198A7'], 'duvar': ['#171A22', '#3E4454']
        }
      },
      blok: { renkler: ['#C43A4A', '#3A6EC4', '#7E3AB4', '#E8C24A', '#2FA98A', '#D8632E', '#B03A72'],
              kenar: '#0E1018', koseYaricap: '14%', parlama: true,
              motif: { tip: 'bolme', renk: '#08090E', opaklik: .26, boy: '50%', yerlesim: 'doseme' } },
      sise: { cam: 'rgba(126,58,180,.18)', kenar: 'rgba(232,194,74,.86)', parlama: 0.5,
              kapak: 'halka', kapakRenk: '#7E3AB4', siluet: 'iksir' }
    },

    // #############################################################
    // LAV (efsanevi) — bazalt kabuk, altindan akan akkor.
    // Katalogdaki TEK animasyonlu tema: karolar nabiz gibi parlar, yilan
    // derisinden isik dalgasi gecer, bloklardan kivilcim yukselir.
    // #############################################################
    {
      id: 'lav', ad: 'Lav', nadirlik: 'efsanevi',
      ton: { css: 'linear-gradient(172deg, rgba(190,44,26,.44) 0%, rgba(96,26,12,.48) 50%, rgba(240,110,24,.42) 100%)' },
      deri: {
        animasyon: 'lav',
        govde: { tip: 'seritli', renkler: ['#2A1C16', '#E8622A', '#3A2620', '#FF8A3C'], kontur: '#0A0503', parlak: true },
        // hedef: sogumus lavda yesil alev — kontur olarak yaniyor
        hedef: { tip: 'seritli', renkler: ['#123A22'], kontur: '#06140C', vurgu: '#4FE07A', vurguTip: 'kontur', parlak: true }
      },
      karo: {
        zemin: '#140A06', animasyon: 'lav',
        motif: { tip: 'catlak', renk: '#FFB066', opaklik: .18, boy: '80%', yerlesim: 'merkez' },
        palet: {
          '2': ['#241611', '#B08A72'], '4': ['#2E1B13', '#C29578'], '8': ['#3A2016', '#D6A07E'],
          '16': ['#4C2616', '#EDA878'], '32': ['#642C14', '#FFB584'], '64': ['#7E3312', '#FFC190'],
          '128': ['#9A3B10', '#FFCE9E'], '256': ['#B8460D', '#FFEACE'], '512': ['#D4560A', '#210D02'],
          '1024': ['#EE6A0A', '#3A1602'], '2048': ['#FFA426', '#3A1602'],
          'wild': ['#FFD98A', '#3A2404'], 'kilit': ['#2A231F', '#988A7F'], 'duvar': ['#180F0A', '#4A3A30']
        }
      },
      blok: { renkler: ['#E8622A', '#FF8A3C', '#B8300E', '#FFA426', '#8E3A14', '#FFD07A', '#D4460A'],
              kenar: '#0A0503', koseYaricap: '14%', parlama: true, animasyon: 'lav',
              motif: { tip: 'catlak', renk: '#2A0E04', opaklik: .26, boy: '86%', yerlesim: 'merkez' } },
      sise: { cam: 'rgba(255,120,40,.15)', kenar: 'rgba(255,154,74,.84)', parlama: 0.36,
              kapak: 'halka', kapakRenk: '#E8622A', animasyon: 'lav', siluet: 'kumSaati' }
    }
  ];

  // ---------------------------------------------------------------
  // GOC (v1 -> v2): eski katalogda urunler 'oyun.tur.aile' bicimindeydi ve
  // 15 aile vardi. Yeni katalogda olmayan ailelerin parcalari icin oyuncuya
  // parca basina o gunku fiyati kadar jeton iade edilir.
  // ---------------------------------------------------------------
  var ESKI_AILE_IADE = { pas: 400, duman: 400, lavanta: 900, amber: 900, disli: 2000, bulutsu: 4000 };

  return {
    NADIRLIK: NADIRLIK,
    SANDIKLAR: SANDIKLAR,
    TEMALAR: TEMALAR,
    ESKI_AILE_IADE: ESKI_AILE_IADE
  };
})();
