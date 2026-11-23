/* ============================================================
   SU SIRALAMA - OYUN KATMANI (projeye entegre)
   Ekranlar: mod secimi -> bolum haritasi -> oyun
   Bagimliliklar: core.js (AppProgress, AppGold, AppFX, slideForward)
                  suSirala.js, suSiralaBolumler.js, suSiralaJoker.js
   ============================================================ */

(function (global) {
  'use strict';

  /* Palet CIE dE ile ayrildi: iki yesil arasi 23.8 -> 64.1,
     acik yesil ile turkuaz arasi 22.1 -> 52.0 */
  var RENKLER = [
    '#E30A17', '#3AA8E0', '#F2C14E', '#86DD6B',
    '#A05AD6', '#EF7FB0', '#1E6B5C', '#D94F70',
    '#7F8FD6', '#C98B3A', '#4FD6C8', '#9C9C5A'
  ];

  var TOPLAM_BOLUM = 250;
  var OZEL_ACILIS = 20;      /* ozel bolumler bu bolum gecilince acilir */

  // DOKUM-BASI  (saf: DOM'a dokunmaz; tools/dokumAnimTest.js bu blogu keser)
  /* Dokme animasyon sureleri (ms), aktarilan blok sayisina gore */
  var SURE = { 1: 600, 2: 800, 3: 1000, 4: 1000, 5: 1200 };

  /* Dokum zamanlamasi ve bicimi: tum sabitler burada.
     Evreler: git (kalkar, hedefin agzina yaklasir, egilir) -> [bekle]
     -> akis (serit uzar; hedef dolar, kaynak bosalir, sise biraz daha egilir)
     -> don (sise dogrulup yerine doner; serit bu sirada incelip biter).
     git + akis + don = SURE[adet] (bekleme yoksa). */
  var DOKUM = {
    GIT: 200, DON: 200,
    AC: 80,           /* akis seridinin agizdan asagi uzama suresi */
    KAPA: 140,        /* seridin incelip bitme suresi (DON'dan uzun olamaz) */
    ACI_ILK: 50,      /* yaklasinca egim (derece) */
    ACI_SON: 62,      /* akis sonunda egim ... */
    ACI_ARTIS: 26,    /* ... kaynak bosaldikca bu kadar artar (en fazla 88) */
    DUDAK_BOSLUK: 38, /* dokme dudagi hedefin agzinin bu kadar ustunde durur (px) */
    AZALT: 180        /* hareket azaltilmis: yalniz kisa solma (ms) */
  };

  /* Zaman plani (ms, dokum basindan). s: { azalt, kalan, kap, hedefSerbest }
     kalan/kap: dokumden sonra kaynakta kalan katman / kaynagin kapasitesi.
     hedefSerbest: hedefe suren onceki dolumun bitmesine kalan sure; yeni
     dolum ondan once baslamaz (katmanlar arasinda bosluk gorunmesin). */
  function dokumPlani(adet, s) {
    if (s.azalt) {
      return { azalt: true, toplam: DOKUM.AZALT, dolumBas: 0, dolumSure: DOKUM.AZALT, dolumBitis: DOKUM.AZALT };
    }
    var toplam = SURE[adet] || SURE[5];
    var akis = Math.max(DOKUM.AC + 100, toplam - DOKUM.GIT - DOKUM.DON);
    var bekle = Math.max(0, (s.hedefSerbest || 0) - (DOKUM.GIT + DOKUM.AC));
    var akisBas = DOKUM.GIT + bekle;
    var dolumBas = akisBas + DOKUM.AC;
    var akisBitis = akisBas + akis;
    var dolumSure = akisBitis - dolumBas;
    var doluluk = s.kap > 0 ? s.kalan / s.kap : 0;
    return {
      azalt: false, git: DOKUM.GIT, bekle: bekle,
      akisBas: akisBas, akisBitis: akisBitis,
      dolumBas: dolumBas, dolumSure: dolumSure, dolumBitis: dolumBas + dolumSure,
      birim: dolumSure / adet,
      kapa: DOKUM.KAPA, don: DOKUM.DON, toplam: akisBitis + DOKUM.DON,
      aciIlk: DOKUM.ACI_ILK, aciSon: DOKUM.ACI_SON + DOKUM.ACI_ARTIS * (1 - doluluk)
    };
  }

  /* Konum hesabi. k, h: kaynak ve hedef sisenin tahtaya gore YERLESIM kutusu
     ({left, top, width, height}; transform haric). Sise, dokme dudagi (hedefe
     bakan ust kose) etrafinda doner; dudak hedefin agzinin tam ustune gider.
     Akis seridi dudaktan camin tabanina iner: sivi katmanlari opak oldugu
     ve hedef seridin onunde durdugu icin serit sivi yuzeyinde biter. */
  function dokumGeometri(k, h, kat, oncekiUzunluk, adet) {
    var sagaMi = (h.left + h.width / 2) > (k.left + k.width / 2);
    var hedefX = h.left + h.width / 2;
    var hedefY = h.top - DOKUM.DUDAK_BOSLUK;
    var taban = h.top + h.height - 3;          /* camin ic tabani (kenarlik + pay) */
    return {
      yon: sagaMi ? 1 : -1,
      origin: sagaMi ? '100% 0' : '0 0',
      dx: hedefX - (sagaMi ? k.left + k.width : k.left),
      dy: hedefY - k.top,
      akisX: hedefX, akisY: hedefY, akisBoy: taban - hedefY,
      yuzeyY: taban - oncekiUzunluk * kat,     /* dolum basinda sivi yuzeyi */
      yuksel: adet * kat                       /* yuzeyin yukselecegi mesafe */
    };
  }
  // DOKUM-SONU

  var oyun = null;
  var secili = -1;
  var perdeModu = false;
  var KONFETI = ['#A78BFA', '#7F6BE8', '#C9A6FF', '#7FD8E6', '#E9D8FF', '#8B5FD6', '#FBE7AE'];
  var kutlanan = {};         /* konfetisi patlamis siseler */
  var sonKazanilan = 0;      /* haritaya donuste parlatilacak bolum */
  var doken = {};            /* o an egilmis, dokmekte olan siseler */
  var dolan = {};            /* o an dolmakta olan siseler */
  var akanSayisi = 0;        /* devam eden animasyon sayisi */
  var katmanYuksekligi = 30;
  /* Reklam / Sikistin durumu */
  var gorunum = 0;           /* bolum acilinca ve haritaya donunce artar: gec gelen reklam sonucu eski bolume islenmez */
  var jokerBekliyor = false; /* joker satin alma / reklam penceresi acik */
  var gecisBekliyor = false; /* tamamlandi ekranindan cikarken gecis reklami bekleniyor */
  var sikistiKapali = false; /* oyuncu Sikistin bilgisini kapatti; ilerleme olana kadar yeniden acilmaz */

  /* ---------- Kisayollar ---------- */

  function $(id) { return document.getElementById(id); }

  function el(etiket, sinif, ana) {
    var d = document.createElement(etiket);
    if (sinif) d.className = sinif;
    if (ana) ana.appendChild(d);
    return d;
  }

  /* Konfeti: kapsayiciya gore (x, y) noktasindan sacilir */
  function konfetiPatlat(kapsayici, x, y, adet, gucCarpani) {
    if (!kapsayici) return;
    var kisik = document.querySelector('.phone.reduced-motion');
    adet = kisik ? Math.round((adet || 18) / 3) : (adet || 18);
    var guc = gucCarpani || 1;

    for (var i = 0; i < adet; i++) {
      var p = el('i', 'ss-konfeti', kapsayici);
      var aci = Math.random() * Math.PI * 2;
      var mesafe = (36 + Math.random() * 74) * guc;
      p.style.background = KONFETI[Math.floor(Math.random() * KONFETI.length)];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = (4 + Math.random() * 5).toFixed(1) + 'px';
      p.style.height = (6 + Math.random() * 7).toFixed(1) + 'px';
      p.style.setProperty('--dx', (Math.cos(aci) * mesafe).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(aci) * mesafe + 70 * guc).toFixed(1) + 'px');
      p.style.setProperty('--spin', Math.round(Math.random() * 900 - 450) + 'deg');
      p.style.animationDelay = Math.round(Math.random() * 90) + 'ms';
      (function (nokta) {
        setTimeout(function () { if (nokta.parentNode) nokta.parentNode.removeChild(nokta); }, 1500);
      })(p);
    }
  }

  /* Bir sisede renk tamamlandiysa etrafinda konfeti patlat */
  function tamamlanmaKontrol(i) {
    var d = oyun.durum;
    var bitti = d.tupler[i].length > 0 && d.gizli[i] === 0 &&
                global.SuSirala.renkTamamlandiMi(d, i);
    if (!bitti) { delete kutlanan[i]; return; }
    if (kutlanan[i]) return;
    kutlanan[i] = true;

    var tup = tupElemani(i), tahta = $('ssTahta');
    if (!tup || !tahta) return;
    var r = tup.getBoundingClientRect(), tr = tahta.getBoundingClientRect();
    konfetiPatlat(tahta, r.left - tr.left + r.width / 2, r.top - tr.top + r.height / 2, 20, .85);
    tup.classList.remove('ss-tamamlandi');
    void tup.offsetWidth;
    tup.classList.add('ss-tamamlandi');
    kapakIndir(tup);
    ses('tamam');
  }

  function ilerleme() {
    var p = global.AppProgress || {};
    if (typeof p.ssAcik !== 'number') p.ssAcik = 1;
    if (!p.ssYildiz) p.ssYildiz = {};
    return p;
  }

  function ilerlemeKaydet(yama) {
    if (typeof global.AppSaveProgress === 'function') global.AppSaveProgress(yama);
  }

  function ses(tur) {
    if (!global.AppFX) return;
    if (tur === 'dok') global.AppFX.tone(320, 500, 0.16, 'sine', 0.16);
    else if (tur === 'tamam') global.AppFX.tone(660, 990, 0.22, 'triangle', 0.2);
    else if (tur === 'hata') { global.AppFX.tone(200, 130, 0.16, 'sawtooth', 0.14); global.AppFX.vibrate(28); }
    else if (tur === 'kazan') global.AppFX.seq([[523, .16, .2, 0], [659, .16, .2, 130], [784, .3, .22, 260]], 'triangle');
  }

  /* ============================================================
     1) MOD SECIM EKRANI
     ============================================================ */

  function modYenile() {
    var p = ilerleme();
    var gecilen = Math.max(0, (p.ssAcik || 1) - 1);

    var meta = $('ssModNormalMeta');
    if (meta) meta.textContent = gecilen > 0 ? (gecilen + ' bölüm tamamlandı') : 'Yeni başlıyorsun';

    var kart = $('ssModeOzel');
    var ozelMeta = $('ssModOzelMeta');
    if (kart) {
      var acik = gecilen >= OZEL_ACILIS;
      kart.classList.toggle('locked', !acik);
      if (ozelMeta) {
        /* acikken rozet hic gorunmesin; kilitliyse ne gerektigini yazsin */
        ozelMeta.style.display = acik ? 'none' : 'inline-flex';
        ozelMeta.textContent = acik ? '' : (OZEL_ACILIS + '. bölümü geç');
      }
    }
    if (global.AppGold) global.AppGold.render();
  }

  /* ============================================================
     2) BOLUM HARITASI - virajli yol
     ============================================================ */

  function haritaCiz() {
    oyundanCikis();   /* oyun ekranindan donuluyorsa yarim dokumleri kapat */
    gorunum++;
    sikistiGizle();
    var ic = $('ssPathInner');
    if (!ic) return;
    var p = ilerleme();
    var acik = p.ssAcik || 1;

    ic.innerHTML = '';

    var genislik = ic.clientWidth || 320;
    var aralik = 96;                     /* dugumler arasi dikey mesafe */
    var genlik = Math.min(genislik * 0.3, 96);
    var orta = genislik / 2;
    var ustBosluk = 60;
    var yukseklik = ustBosluk * 2 + (TOPLAM_BOLUM - 1) * aralik;
    ic.style.height = yukseklik + 'px';

    var noktalar = [];
    for (var i = 0; i < TOPLAM_BOLUM; i++) {
      var t = i * 0.62;
      var x = orta + Math.sin(t) * genlik + Math.sin(t * 0.37) * (genlik * 0.35);
      var y = yukseklik - ustBosluk - i * aralik;
      noktalar.push([x, y]);
    }

    /* Yol: noktalardan gecen yumusak egri */
    var d = 'M ' + noktalar[0][0].toFixed(1) + ' ' + noktalar[0][1].toFixed(1);
    for (var k = 1; k < noktalar.length; k++) {
      var onceki = noktalar[k - 1], simdi = noktalar[k];
      var ortaY = (onceki[1] + simdi[1]) / 2;
      d += ' C ' + onceki[0].toFixed(1) + ' ' + ortaY.toFixed(1) +
           ', ' + simdi[0].toFixed(1) + ' ' + ortaY.toFixed(1) +
           ', ' + simdi[0].toFixed(1) + ' ' + simdi[1].toFixed(1);
    }

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ss-path-svg');
    svg.setAttribute('width', genislik);
    svg.setAttribute('height', yukseklik);

    var asfalt = document.createElementNS(ns, 'path');
    asfalt.setAttribute('class', 'ss-yol-asfalt');
    asfalt.setAttribute('d', d);
    svg.appendChild(asfalt);

    var kenar = document.createElementNS(ns, 'path');
    kenar.setAttribute('class', 'ss-yol-kenar');
    kenar.setAttribute('d', d);
    svg.appendChild(kenar);

    var serit = document.createElementNS(ns, 'path');
    serit.setAttribute('class', 'ss-yol-serit');
    serit.setAttribute('d', d);
    svg.appendChild(serit);

    ic.appendChild(svg);

    /* Dugumler */
    for (var n = 0; n < TOPLAM_BOLUM; n++) {
      var bolumNo = n + 1;
      var nokta = noktalar[n];
      var acikMi = bolumNo <= acik;
      var yildiz = p.ssYildiz[bolumNo] || 0;

      var dugum = el('div', 'ss-node' + (acikMi ? ' ss-node-acik' : ' ss-node-kilitli'), ic);
      dugum.style.left = nokta[0] + 'px';
      dugum.style.top = nokta[1] + 'px';
      dugum.textContent = acikMi ? bolumNo : '';

      if (!acikMi) {
        dugum.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
          'stroke-linecap="round" stroke-linejoin="round" class="ss-kilit-ikon">' +
          '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      } else {
        (function (no) {
          dugum.addEventListener('click', function () { bolumBaslat(no); });
        })(bolumNo);
      }

      if (bolumNo === sonKazanilan && acikMi) dugum.classList.add('ss-node-yeni');

      if (yildiz > 0) {
        var ys = el('div', 'ss-node-yildiz', ic);
        ys.style.left = nokta[0] + 'px';
        ys.style.top = (nokta[1] + 30) + 'px';
        var metin = '';
        for (var z = 0; z < 3; z++) metin += (z < yildiz ? '★' : '☆');
        ys.textContent = metin;
      }

      /* Hediye kutusu: yol dugumden dikey cikar, kutu yaninda durur. Once
         virajin dis tarafi; ekrana sigmiyorsa ic taraf. */
      var kutu = global.AppHediye ? global.AppHediye.kutu('ss', bolumNo) : null;
      if (kutu) {
        var yon = nokta[0] >= orta ? 1 : -1;
        var kx = nokta[0] + yon * 54;
        if (kx < 22 || kx > genislik - 22) kx = nokta[0] - yon * 54;
        kutu.style.left = kx + 'px';
        kutu.style.top = nokta[1] + 'px';
        ic.appendChild(kutu);
      }
    }

    /* Acik olan en ust bolume kaydir */
    var sarma = $('ssPathWrap');
    if (sarma) {
      var hedef = noktalar[Math.min(acik, TOPLAM_BOLUM) - 1];
      sarma.scrollTop = Math.max(0, hedef[1] - sarma.clientHeight * 0.55);
    }

    /* Yeni acilan bolum: dugum yerine oturur ve konfeti patlar */
    if (sonKazanilan) {
      var yeniNokta = noktalar[sonKazanilan - 1];
      if (yeniNokta) {
        setTimeout(function () {
          konfetiPatlat(ic, yeniNokta[0], yeniNokta[1], 26, 1.15);
        }, 420);
      }
      sonKazanilan = 0;
    }
    if (global.AppGold) global.AppGold.render();
  }

  /* ============================================================
     3) OYUN EKRANI
     ============================================================ */

  /* 1. bolum ogreticisi: Kacis'in kisa bilgilendirme yazisi (kcShowTip) ile ayni mantik ve
     ayni .kc-tip sinifi: ekran hafif kararir, yazi ortada; pointer-events yok, oyuncu altta oynayabilir. */
  var ogrEl = null, ogrZ = 0;
  function ogreticiGizle() {
    clearTimeout(ogrZ);
    if (!ogrEl) return;
    var e = ogrEl; ogrEl = null;
    e.classList.remove('show');
    setTimeout(function () { e.remove(); }, 300);
  }
  function ogreticiGoster(baslik, alt, ms) {
    ogreticiGizle();
    var tahta = $('ssTahta'), wrap = tahta && tahta.parentNode;     /* .ss-board-wrap */
    if (!wrap || !wrap.appendChild) return;
    var e = document.createElement('div');
    e.className = 'kc-tip';
    var t = document.createElement('div');
    t.className = 'kc-tip-text';
    t.style.color = '#9CC4FF';
    t.textContent = baslik;
    var a = document.createElement('div');
    a.className = 'kc-tip-alt';
    a.textContent = alt;
    e.appendChild(t); e.appendChild(a);
    wrap.appendChild(e);
    ogrEl = e;
    requestAnimationFrame(function () { e.classList.add('show'); });
    ogrZ = setTimeout(ogreticiGizle, (ms || 1500) + 280);
  }

  function bolumBaslat(bolumNo) {
    oyun = global.SuSirala.OyunOlustur(bolumNo);
    secili = -1;
    perdeModu = false;
    doken = {}; dolan = {}; akanSayisi = 0;
    gorunum++; sikistiKapali = false; sikistiGizle();

    var baslik = $('ssLevelTitle');
    if (baslik) baslik.textContent = 'Bölüm ' + bolumNo;

    var sonuc = $('ssSonuc');
    if (sonuc) sonuc.classList.remove('show');

    tahtaKur();
    barYenile();

    if (global.slideForward) global.slideForward('ssHarita', 'ssOyun');
    if (global.AppGold) global.AppGold.render();
    /* 1. bolum her acilista: baslik + tek satir */
    if (bolumNo === 1) ogreticiGoster('Her renk kendi şişesine', 'Bir şişeye, sonra dökeceğin şişeye dokun.', 3200);
    else ogreticiGizle();
  }

  function tahtaKur() {
    dokumIptal();     /* tahta yeniden kuruluyor: suren dokumlerin geri cagrilari gecersiz */
    var tahta = $('ssTahta');
    if (!tahta) return;
    tahta.innerHTML = '';
    kutlanan = {};

    var d = oyun.durum;
    var enBuyuk = Math.max.apply(null, d.kaplar);
    var sise = d.tupler.length;

    /* Sise sayisina gore olcek: hepsi ekrana sigsin */
    katmanYuksekligi = sise > 10 ? 24 : (sise > 8 ? 27 : 30);
    var genislik = sise > 10 ? 36 : (sise > 8 ? 40 : 44);
    tahta.style.setProperty('--ss-tup-w', genislik + 'px');
    tahta.style.setProperty('--ss-kat', katmanYuksekligi + 'px');   /* siluetli sivi kirpmasi icin */
    if (global.AppMarket && global.AppMarket.siseTemasiUygula) global.AppMarket.siseTemasiUygula(tahta);

    for (var i = 0; i < d.tupler.length; i++) {
      var yuva = el('div', 'ss-yuva', tahta);
      yuva.style.height = (enBuyuk * katmanYuksekligi + 12) + 'px';

      var tup = el('div', 'ss-tup', yuva);
      tup.dataset.i = i;
      tup.style.height = (d.kaplar[i] * katmanYuksekligi + 6) + 'px';

      (function (indeks) {
        tup.addEventListener('click', function () { tupTiklandi(indeks); });
      })(i);

      yuva.appendChild(tup);
      var kapak = el('div', 'ss-kapak', yuva);
kapak.style.bottom = tup.offsetHeight + 'px';
kapak.innerHTML = (global.AppMarket && global.AppMarket.siseKapakSvg ? global.AppMarket.siseKapakSvg() : '');
      sivilariCiz(tup, i);
    }
    isaretleriYenile();
  }

  function sivilariCiz(tup, i) {
    var d = oyun.durum;
    tup.innerHTML = '';
    for (var k = 0; k < d.tupler[i].length; k++) {
      var s = el('div', 'ss-sivi', tup);
      s.style.height = katmanYuksekligi + 'px';
      if (k < d.gizli[i]) {
        s.className += ' ss-perde';
        s.textContent = '?';
      } else {
        s.style.setProperty('--ss-renk', RENKLER[d.tupler[i][k] % RENKLER.length]);
      }
    }
  }

  function tupElemani(i) {
    return document.querySelector('#ssTahta .ss-tup[data-i="' + i + '"]');
  }

  function isaretleriYenile() {
    var d = oyun.durum;
    for (var i = 0; i < d.tupler.length; i++) {
      var t = tupElemani(i);
      if (!t) continue;
      t.classList.toggle('ss-secili', i === secili);
      var bitti = d.tupler[i].length > 0 && d.gizli[i] === 0 &&
                  global.SuSirala.renkTamamlandiMi(d, i);
      t.classList.toggle('ss-tamam', bitti);
      kapakYerinde(t, bitti, !!dolan[i]);
    }
  }

  /* Kapak: sise doluyken gorunmez (dokum bitince tamamlanmaKontrol indirir);
     dolu ve sakin siseye animasyonsuz oturur; bozulan siseden kalkar. */
  function kapakYerinde(tup, bitti, doluyor) {
    var k = tup.nextElementSibling;
    if (!k || !k.classList.contains('ss-kapak')) return;
    if (!bitti) { k.classList.remove('oturdu', 'iniyor'); return; }
    if (!doluyor && !k.classList.contains('iniyor')) k.classList.add('oturdu');
  }
  function kapakIndir(tup) {
    var k = tup.nextElementSibling;
    if (!k || !k.classList.contains('ss-kapak')) return;
    k.classList.remove('oturdu', 'iniyor');
    void k.offsetWidth;
    k.classList.add('iniyor');
  }

  /* ---------- Ust bar ve jokerler ---------- */

  function barYenile() {
    var hamle = $('ssHamle');
    if (hamle) hamle.textContent = oyun.hamleSayisi;
    var hedef = $('ssHedef');
    if (hedef) hedef.textContent = oyun.bolum.yildizButce.uc;

    var J = global.SuSiralaJoker;
    if (!J) return;
    var kutu = $('ssJokerBar');
    if (!kutu) return;
    kutu.innerHTML = '';

    J.TURLER.forEach(function (tur) {
      var t = J.TANIM[tur];
      var sayi = J.adet(tur);
      var b = el('button', 'ss-joker', kutu);

      var ikon = el('span', 'ss-joker-ikon', b);
      jokerIkonuYerlestir(ikon, tur);

      var ad = el('span', 'ss-joker-ad', b);
      ad.textContent = t.ad;

      var rozet = el('span', 'ss-joker-sayi', b);
      if (sayi > 0) {
        rozet.textContent = sayi;
      } else {
        rozet.className += ' ss-joker-fiyat';
        rozet.innerHTML = (global.CoinSVG ? global.CoinSVG(true) : '') + t.fiyat;
      }

      if (akanSayisi > 0 || oyun.kazandiMi()) b.disabled = true;
      if (tur === 'geriAl' && oyun.gecmis.length === 0) b.disabled = true;
      if (tur === 'perdeAc' && oyun.perdeliTupler().length === 0) b.disabled = true;
      if (tur === 'siseEkle' && oyun.eklenenSise >= (t.bolumSiniri || 2)) b.disabled = true;
      if (tur === 'perdeAc' && perdeModu) b.className += ' ss-joker-aktif';

      b.addEventListener('click', function () { jokerTiklandi(tur); });
    });
  }

  /* Ikon dosyalari img/ klasorunde beklenir; bulunamazsa SVG devreye girer. */
  var JOKER_IKON = {
    geriAl:   'img/joker-gerial.webp',
    perdeAc:  'img/joker-perde.webp',
    siseEkle: 'img/joker-sise.webp'
  };

  function jokerIkonuYerlestir(kutu, tur) {
    var img = document.createElement('img');
    img.alt = '';
    img.onerror = function () { kutu.innerHTML = jokerSvg(tur); };
    img.src = JOKER_IKON[tur];
    kutu.appendChild(img);
  }

  function jokerSvg(tur) {
    if (tur === 'geriAl') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8 8 0 1 0 18 17"/><path d="M20 5v6h-6"/></svg>';
    }
    if (tur === 'perdeAc') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v5L6 19a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3L14 8V3"/><path d="M19 6h4M21 4v4"/></svg>';
  }

  function mesajGoster(metin) {
    var m = $('ssMesaj');
    if (!m) return;
    m.textContent = metin || '';
    m.classList.toggle('show', !!metin);
    if (metin) {
      clearTimeout(mesajGoster._z);
      mesajGoster._z = setTimeout(function () { m.classList.remove('show'); }, 2200);
    }
  }

  /* ---------- Sikistin ----------
     Kayip yok: ilerleten hamle kalmayinca (hic hamle yok ya da yalniz
     ilerlemesiz gidip gelme kaldi; SuSirala.ilerlemeVarMi) kapatilabilir
     bir bilgi cikar. Tahtayi kilitlemez, hamleleri engellemez.
     Secenekler: Geri Al, Sise Ekle, Yeniden baslat. */

  function sikistiGizle() {
    var p = $('ssSikisti');
    if (p) p.hidden = true;
  }

  function sikistiAltYazi(id, tur) {
    var a = $(id), J = global.SuSiralaJoker;
    if (!a || !J || !J.TANIM[tur]) return;
    var sayi = J.adet(tur);
    a.textContent = sayi > 0 ? (sayi + ' hak') : (J.TANIM[tur].fiyat + ' altın');
  }

  function sikistiGoster() {
    var p = $('ssSikisti');
    if (!p) { mesajGoster('Sıkıştın — geri al, şişe ekle ya da baştan başla'); return; }
    var J = global.SuSiralaJoker;
    var sinir = (J && J.TANIM.siseEkle && J.TANIM.siseEkle.bolumSiniri) || 2;
    var geri = $('ssSikistiGeri'), sise = $('ssSikistiSise');
    if (geri) geri.disabled = oyun.gecmis.length === 0;
    if (sise) sise.disabled = oyun.eklenenSise >= sinir;
    sikistiAltYazi('ssSikistiGeriAlt', 'geriAl');
    var siseAlt = $('ssSikistiSiseAlt');
    if (siseAlt && oyun.eklenenSise >= sinir) siseAlt.textContent = 'Bölüm sınırı';
    else sikistiAltYazi('ssSikistiSiseAlt', 'siseEkle');
    p.hidden = false;
  }

  /* Her dokum bitince (baska dokum yoksa) bir kez: karar ilerleme olan hamleye gore */
  function sikistiKontrol() {
    if (!oyun || oyun.kazandiMi()) { sikistiGizle(); return; }
    var ilerler = typeof oyun.ilerlemeVarMi === 'function' ? oyun.ilerlemeVarMi() : oyun.oynanabilirMi();
    if (ilerler) { sikistiKapali = false; sikistiGizle(); return; }
    if (sikistiKapali) return;
    sikistiGoster();
  }

  /* Reklam odulu (hak bitince altin satin almaya EK secenek; yalniz reklam
     destegi varken gorunur, tarayicida eski davranis aynen). Odul ssJoker
     envanterine yazilir (altinla alinan hak gibi), biri hemen kullanilir.
     Sise Ekle'de bolum siniri (bolumSiniri) reklamla da asilmaz: sinirda
     dugme kapali, secenek hic acilmaz. */
  var REKLAM_ODUL = { geriAl: 5, siseEkle: 1, perdeAc: 3 };
  var REKLAM_BIRIM = 'ipucu_joker';

  function reklamVarMi() {
    var R = global.Reklam;
    return !!(R && typeof R.destekleniyor === 'function' && R.destekleniyor() && typeof R.secim === 'function');
  }

  function jokerSecim(tur) {
    var J = global.SuSiralaJoker, t = J.TANIM[tur], n = REKLAM_ODUL[tur] || 1;
    var kasa = J.altin.oku(), yeter = kasa >= t.fiyat;
    var oyunOnce = oyun, gorunumOnce = gorunum;
    jokerBekliyor = true;
    global.Reklam.secim({
      baslik: t.ad,
      metin: t.aciklama + ' Hakkın kalmadı.',
      secenekler: [
        { deger: 'altin', etiket: t.fiyat + ' altın', alt: yeter ? '1 hak' : ('Yetersiz altın — ' + (t.fiyat - kasa) + ' eksik'), pasif: !yeter },
        { deger: 'reklam', etiket: 'Reklam izle', alt: '+' + n + ' hak', birim: REKLAM_BIRIM }
      ],
      iptal: 'Vazgeç'
    }).then(function (d) {
      jokerBekliyor = false;
      if (d === 'reklam') {
        J.ekle(tur, n);                /* odul YALNIZ odul:true ise buraya gelir */
      } else if (d === 'altin') {
        var s = J.satinAl(tur);
        if (!s.ok) {
          mesajGoster(s.sebep === 'yetersizAltin' ? ('Yetersiz altın — ' + s.eksik + ' eksik') : 'Satın alınamadı');
          ses('hata'); barYenile();
          return;
        }
      } else { barYenile(); return; }
      /* Sonuc gelene kadar bolum degistiyse (geri tusu vb.) hak envanterde kalir, kullanilmaz */
      if (!oyun || oyun !== oyunOnce || gorunum !== gorunumOnce || akanSayisi > 0 || oyun.kazandiMi()) {
        if (oyun) barYenile();
        return;
      }
      mesajGoster(d === 'reklam' ? (t.ad + ' +' + n) : (t.ad + ' alındı'));
      jokerUygula(tur);
    }, function () { jokerBekliyor = false; if (oyun) barYenile(); });
  }

  function jokerTiklandi(tur) {
    if (akanSayisi > 0 || jokerBekliyor) return;
    var J = global.SuSiralaJoker;

    if (J.adet(tur) < 1) {
      if (reklamVarMi()) { jokerSecim(tur); return; }
      var s = J.satinAl(tur);
      if (!s.ok) {
        mesajGoster(s.sebep === 'yetersizAltin' ? ('Yetersiz altın — ' + s.eksik + ' eksik') : 'Satın alınamadı');
        ses('hata');
        barYenile();
        return;
      }
      mesajGoster(J.TANIM[tur].ad + ' alındı');
    }
    jokerUygula(tur);
  }

  /* Hak hazir: jokeri tahtaya uygula (envanterden biri dusulur) */
  function jokerUygula(tur) {
    var J = global.SuSiralaJoker;
    if (tur === 'geriAl') {
      var g = J.geriAl(oyun);
      if (!g.ok) { mesajGoster('Geri alınacak hamle yok'); return; }
      secili = -1; perdeModu = false;
      sikistiGizle();
      tahtaKur(); barYenile();
    } else if (tur === 'siseEkle') {
      var e = J.siseEkle(oyun);
      if (!e.ok) {
        mesajGoster(e.sebep === 'bolumSiniri' ? ('Bu bölümde en fazla ' + e.sinir + ' şişe') : 'Şişe eklenemedi');
        return;
      }
      secili = -1; perdeModu = false;
      sikistiGizle();
      tahtaKur(); barYenile();
      ses('dok');
    } else if (tur === 'perdeAc') {
      perdeModu = !perdeModu;
      secili = -1;
      if (perdeModu) mesajGoster('Perdesini açmak istediğin şişeye dokun');
      isaretleriYenile();
      barYenile();
    }
  }

  /* ---------- Etkilesim ---------- */

  function tupTiklandi(i) {
    ogreticiGizle();
    if (!oyun || oyun.kazandiMi()) return;
    /* Egilmis sise ne kaynak ne hedef olabilir */
    if (doken[i]) return;
    /* Dolmakta olan sise HEDEF olabilir ama kaynak olamaz */
    if (dolan[i] && secili === -1) return;

    if (perdeModu) {
      if (akanSayisi > 0) return;
      var s = global.SuSiralaJoker.perdeAc(oyun, i);
      perdeModu = false;
      if (!s.ok) { mesajGoster('Bu şişede perde yok'); ses('hata'); }
      else { var t = tupElemani(i); if (t) { sivilariCiz(t, i); t.classList.add('ss-acildi'); } }
      isaretleriYenile();
      barYenile();
      /* Perde acildi: yeni bilgi ilerleme getirebilir, Geri Al da acilir. "Sikistin"
         karti guncel durumla yeniden degerlendirilir (ilerleme varsa kapanir). */
      if (s.ok) sikistiKontrol();
      return;
    }

    if (secili === -1) {
      if (oyun.durum.tupler[i].length === 0) return;
      secili = i;
      isaretleriYenile();
      return;
    }
    if (secili === i) { secili = -1; isaretleriYenile(); return; }

    var kaynak = secili;
    if (!global.SuSirala.hamleGecerliMi(oyun.durum, kaynak, i)) {
      var hedefEl = tupElemani(i);
      if (hedefEl) {
        hedefEl.classList.add('ss-hatali');
        setTimeout(function () { hedefEl.classList.remove('ss-hatali'); }, 300);
      }
      ses('hata');
      secili = -1;
      isaretleriYenile();
      return;
    }

    dokmeAnimasyonu(kaynak, i);
  }

  /* ============================================================
     4) DOKME ANIMASYONU
     Sise, DOKME DUDAGI etrafinda donerek egilir; dudak hedefin
     agzinin tam ustune tasinir, sivi oradan akar.
     Hamle modele ANINDA islenir, animasyon ayri yurur; boylece
     oyuncu ayni anda baska siselere de dokunabilir.
     Zaman plani ve konum hesabi en ustteki DOKUM blogunda (saf).
     Yalniz transform/opacity canlanir; olcum dokum basinda bir kez.
     ============================================================ */

  var dokumNesli = 0;          /* tahta kurulunca / oyundan cikinca artar */
  var dokumZamanlari = {};     /* bekleyen zamanlayicilar (iptalde temizlenir) */
  var dolumSonu = {};          /* hedef sise -> suren son dolumunun bitecegi an (ms) */
  var kazanmaBekliyor = false; /* son dokum bitti, bolumBitti kisa beklemede */

  /* kacis.js ile ayni desen: ayar sinifi ya da sistem tercihi */
  function hareketAzMi() {
    return !!(document.querySelector('.phone.reduced-motion') ||
      (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }

  /* Bu tahtaya ait zamanlayici: arada tahta yeniden kurulduysa hic calismaz,
     boylece gec gelen geri cagri yeni bolumun DOM'una dokunmaz. */
  function dokumZamanla(fn, ms) {
    var nesil = dokumNesli;
    var id = setTimeout(function () {
      delete dokumZamanlari[id];
      if (nesil === dokumNesli) fn();
    }, ms);
    dokumZamanlari[id] = true;
  }

  /* Suren dokumleri birakir; DOM'u cagiran (tahtaKur) modele gore yeniden kurar */
  function dokumIptal() {
    dokumNesli++;
    for (var id in dokumZamanlari) clearTimeout(+id);
    dokumZamanlari = {};
    doken = {}; dolan = {}; dolumSonu = {}; akanSayisi = 0;
    kazanmaBekliyor = false;
  }

  /* Oyun ekranindan cikis (geri dugmesi / telefon geri tusu haritaCiz'dan
     gecer): yarim dokum varsa iptal et, tahtayi modele gore ciz. Model zaten
     kazanilmissa zafer kaybolmasin: sonucu simdi isle (tam bir kez).
     Yalniz kayit: cikilan ekranda kart, ses, konfeti yok. */
  function oyundanCikis() {
    if (!oyun || (akanSayisi === 0 && !kazanmaBekliyor)) return;
    secili = -1; perdeModu = false;
    tahtaKur(); barYenile();
    if (oyun.kazandiMi()) bolumKaydet();
  }

  /* Sisenin tahtaya gore yerlesim kutusu. offset* transform'u saymaz:
     secim kalkisi (translateY) olcumu kaydirmaz. yuva ve tahta konumlu. */
  function yerlesim(tup) {
    var yuva = tup.parentNode;
    return { left: yuva.offsetLeft + tup.offsetLeft, top: yuva.offsetTop + tup.offsetTop,
             width: tup.offsetWidth, height: tup.offsetHeight };
  }

  function dokmeAnimasyonu(a, b) {
    var d = oyun.durum;
    var oncekiHedefUzunluk = d.tupler[b].length;
    var oncekiKaynakUzunluk = d.tupler[a].length;
    var renk = d.tupler[a][d.tupler[a].length - 1];

    /* Hamleyi once modele isle: es zamanli hamleler cakismasin */
    var sonuc = oyun.dok(a, b);
    if (!sonuc) return;
    kaydedilenOyun = null;   /* yeni hamle: bu oyunun sonraki zaferi yeniden yazilabilir */
    var adet = sonuc.adet;

    var an = Date.now();
    var plan = dokumPlani(adet, {
      azalt: hareketAzMi(), kalan: d.tupler[a].length, kap: d.kaplar[a],
      hedefSerbest: (dolumSonu[b] || 0) - an
    });
    dolumSonu[b] = an + plan.dolumBitis;

    doken[a] = true;
    dolan[b] = (dolan[b] || 0) + 1;
    akanSayisi++;
    secili = -1;
    isaretleriYenile();
    barYenile();

    var kaynakEl = tupElemani(a), hedefEl = tupElemani(b), tahta = $('ssTahta');
    if (!kaynakEl || !hedefEl || !tahta) { animasyonBitti(a, b, sonuc); return; }

    var renkKodu = RENKLER[renk % RENKLER.length];

    /* Katmanlar: hedefe gelecekler simdi eklenir ve sirayla alttan buyur,
       kaynaktan gidecekler ustten baslayip sirayla kuculur. Ikisi ayni
       cizelgeyi (CSS gecikmesi) paylasir: yuzey surekli yukselir / iner. */
    hedefEl.classList.add('ss-dk-hedef');
    for (var j = 0; j < adet; j++) {
      var gecikme = plan.azalt ? 0 : plan.dolumBas + j * plan.birim;
      var sure = plan.azalt ? plan.toplam : plan.birim;
      var gelen = el('div', 'ss-sivi ss-dk-gelen', hedefEl);
      gelen.style.height = katmanYuksekligi + 'px';
      gelen.style.setProperty('--ss-renk', renkKodu);
      gelen.style.setProperty('--dk-gec', gecikme + 'ms');
      gelen.style.setProperty('--dk-sure', sure + 'ms');
      var giden = kaynakEl.children[oncekiKaynakUzunluk - 1 - j];
      if (giden) {
        giden.classList.add('ss-dk-giden');
        giden.style.setProperty('--dk-gec', gecikme + 'ms');
        giden.style.setProperty('--dk-sure', sure + 'ms');
      }
      if (!plan.azalt) dokumZamanla(function () { ses('dok'); }, gecikme);
    }

    /* Hareket azaltma: sise yerinde kalir, katmanlar kisaca solar */
    if (plan.azalt) {
      ses('dok');
      dokumZamanla(function () { animasyonBitti(a, b, sonuc); }, plan.toplam);
      return;
    }

    var g = dokumGeometri(yerlesim(kaynakEl), yerlesim(hedefEl), katmanYuksekligi, oncekiHedefUzunluk, adet);

    /* 1) git: kalkar, dudak hedefin agzina yaklasir, sise egilir */
    kaynakEl.style.transformOrigin = g.origin;
    kaynakEl.style.setProperty('--dk-x', g.dx.toFixed(1) + 'px');
    kaynakEl.style.setProperty('--dk-y', g.dy.toFixed(1) + 'px');
    kaynakEl.style.setProperty('--dk-aci', (plan.aciIlk * g.yon) + 'deg');
    kaynakEl.style.setProperty('--dk-sure', plan.git + 'ms');
    kaynakEl.classList.add('ss-dokuyor', 'ss-dk-git');

    /* Akis seridi ve yuzeydeki sicrama: dokum basina bir kez olusur, sonda silinir */
    var akisEl = el('div', 'ss-dk-akis', tahta);
    akisEl.style.backgroundColor = renkKodu;
    akisEl.style.left = g.akisX + 'px';
    akisEl.style.top = g.akisY + 'px';
    akisEl.style.height = g.akisBoy + 'px';
    akisEl.style.setProperty('--dk-ac', DOKUM.AC + 'ms');
    akisEl.style.setProperty('--dk-kapa', plan.kapa + 'ms');

    var sicEl = el('div', 'ss-dk-sicrama', tahta);
    el('i', '', sicEl).style.background = renkKodu;
    sicEl.style.left = g.akisX + 'px';
    sicEl.style.top = g.yuzeyY + 'px';
    sicEl.style.setProperty('--dk-gec', plan.dolumBas + 'ms');
    sicEl.style.setProperty('--dk-sure', plan.dolumSure + 'ms');
    sicEl.style.setProperty('--dk-yuksel', (-g.yuksel) + 'px');

    /* 2) akis: serit uzar, sise bosaldikca biraz daha egilir */
    dokumZamanla(function () {
      kaynakEl.style.setProperty('--dk-aci', (plan.aciSon * g.yon).toFixed(1) + 'deg');
      kaynakEl.style.setProperty('--dk-sure', (plan.akisBitis - plan.akisBas) + 'ms');
      kaynakEl.classList.add('ss-dk-dok');
      akisEl.classList.add('show');
      sicEl.classList.add('show');
    }, plan.akisBas);

    /* 3) don: serit incelip biter, sise dogrulup yerine doner */
    dokumZamanla(function () {
      akisEl.classList.add('bitis');
      sicEl.classList.remove('show');
      kaynakEl.style.setProperty('--dk-sure', plan.don + 'ms');
      kaynakEl.classList.add('ss-dk-don');
    }, plan.akisBitis);

    dokumZamanla(function () {
      if (akisEl.parentNode) akisEl.parentNode.removeChild(akisEl);
      if (sicEl.parentNode) sicEl.parentNode.removeChild(sicEl);
      kaynakEl.classList.remove('ss-dokuyor', 'ss-dk-git', 'ss-dk-dok', 'ss-dk-don');
      kaynakEl.style.transformOrigin = '';
      ['--dk-x', '--dk-y', '--dk-aci', '--dk-sure'].forEach(function (p) { kaynakEl.style.removeProperty(p); });
      animasyonBitti(a, b, sonuc);
    }, plan.toplam);
  }

  function animasyonBitti(a, b, sonuc) {
    delete doken[a];
    dolan[b] = (dolan[b] || 1) - 1;
    if (dolan[b] <= 0) { delete dolan[b]; delete dolumSonu[b]; }
    akanSayisi = Math.max(0, akanSayisi - 1);

    /* Perde acilmis olabilir; kaynagi modele gore yeniden ciz.
       Hedefi ancak baska bir dokum ona akmiyorsa yeniden ciziyoruz. */
    var ka = tupElemani(a);
    if (ka) sivilariCiz(ka, a);
    if (!dolan[b]) {
      var hb = tupElemani(b);
      if (hb) { hb.classList.remove('ss-dk-hedef'); sivilariCiz(hb, b); }
    }

    isaretleriYenile();
    tamamlanmaKontrol(a);
    if (!dolan[b]) tamamlanmaKontrol(b);
    barYenile();

    if (akanSayisi > 0) return;   /* baska dokum suruyorsa sonu bekle */

    if (oyun.kazandiMi()) {
      if (kazanmaBekliyor) return;
      kazanmaBekliyor = true;
      dokumZamanla(function () { kazanmaBekliyor = false; bolumBitti(); }, 220);
    }
    else sikistiKontrol();
  }

  /* ============================================================
     5) BOLUM SONU
     ============================================================ */

  /* yildiz sayisina gore toplam altin (0..3 yildiz) */
  var YILDIZ_ODUL = [0, 10, 20, 30];

  /* Sonucu yazilmis oyun ornegi: ayni zafer ikinci kez yazilmaz / odenmez.
     Bastan Basla ayni nesneyi sifirlar; o yuzden her yeni hamle bunu temizler. */
  var kaydedilenOyun = null;

  /* Kayit / odul kismi (sunum yok): yildiz, ssAcik, coin, harita vurgusu.
     Bu oyun ornegi icin zaten yazildiysa ya da kazanilmadiysa null doner. */
  function bolumKaydet() {
    if (!oyun || !oyun.kazandiMi() || kaydedilenOyun === oyun) return null;
    kaydedilenOyun = oyun;
    var p = ilerleme();
    var no = oyun.bolum.bolumNo;
    var yildiz = oyun.yildiz();
    var oncekiYildiz = Math.max(0, Math.min(3, p.ssYildiz[no] || 0));

    if (yildiz > oncekiYildiz) p.ssYildiz[no] = yildiz;
    if (no + 1 > (p.ssAcik || 1)) p.ssAcik = Math.min(TOPLAM_BOLUM, no + 1);
    ilerlemeKaydet({ ssAcik: p.ssAcik, ssYildiz: p.ssYildiz });

    /* Altin odulu: yildiz artinca aradaki fark odenir (ilk gecis = 0'dan fark).
       Ayni ya da daha az yildizla tekrar oynamak 0 verir. */
    var odul = YILDIZ_ODUL[yildiz] - YILDIZ_ODUL[oncekiYildiz];
    if (odul > 0) { if (global.AppGold) global.AppGold.add(odul); }
    else odul = 0;

    sonKazanilan = Math.min(TOPLAM_BOLUM, no + 1);
    return { no: no, yildiz: yildiz, odul: odul };
  }

  /* Normal bitis: once kayit, sonra sunum (ses, kart, konfeti) */
  function bolumBitti() {
    var k = bolumKaydet();
    if (!k) return;
    var no = k.no, yildiz = k.yildiz, odul = k.odul;

    ses('kazan');

    var kutu = $('ssSonuc');
    if (!kutu) return;
    $('ssSonucYildiz').innerHTML =
      '<span class="' + (yildiz >= 1 ? 'dolu' : '') + '">★</span>' +
      '<span class="' + (yildiz >= 2 ? 'dolu' : '') + '">★</span>' +
      '<span class="' + (yildiz >= 3 ? 'dolu' : '') + '">★</span>';
    $('ssSonucMetin').textContent = oyun.hamleSayisi + ' hamlede tamamladın';
    var odulEl = $('ssSonucOdul');
    if (odul > 0) {
      odulEl.style.display = 'flex';
      odulEl.innerHTML = (global.CoinSVG ? global.CoinSVG(true) : '') + '<span>+' + odul + '</span>';
    } else {
      odulEl.style.display = 'none';
    }
    var sonrakiBtn = $('ssSonrakiBtn');
    if (sonrakiBtn) sonrakiBtn.style.display = no < TOPLAM_BOLUM ? 'block' : 'none';
    sikistiGizle();
    kutu.classList.add('show');
    /* Gecis reklami sayaci: tamamlandi ekrani acilirken bir kez (bolumKaydet bu oyun icin tek sefer doner) */
    if (global.Reklam && typeof global.Reklam.bolumTamamlandi === 'function') {
      try { global.Reklam.bolumTamamlandi({ oyun: 'ss', bolum: no }); } catch (e) {}
    }

    /* Kart acilirken konfeti: once merkezden, sonra iki yandan */
    setTimeout(function () {
      var r = kutu.getBoundingClientRect();
      konfetiPatlat(kutu, r.width / 2, r.height * 0.38, 34, 1.5);
    }, 120);
    setTimeout(function () {
      var r = kutu.getBoundingClientRect();
      konfetiPatlat(kutu, r.width * 0.2, r.height * 0.45, 16, 1.2);
      konfetiPatlat(kutu, r.width * 0.8, r.height * 0.45, 16, 1.2);
    }, 380);
  }

  /* ============================================================
     6) BAGLANTILAR
     ============================================================ */

  function baglan() {
    var normal = $('ssModeNormal');
    if (normal) normal.addEventListener('click', function () {
      haritaCiz();
      if (global.slideForward) global.slideForward('ssMod', 'ssHarita');
    });

    var ozel = $('ssModeOzel');
    if (ozel) ozel.addEventListener('click', function () {
      if (ozel.classList.contains('locked')) {
        ozel.classList.remove('ss-shake');
        void ozel.offsetWidth;
        ozel.classList.add('ss-shake');
        ses('hata');
      }
      /* acik kartta gecisi suSiralaOzelOyun.js yapar */
    });

    function bastanBasla() {
      if (akanSayisi > 0 || !oyun) return;
      oyun.bastanBasla();
      secili = -1; perdeModu = false; doken = {}; dolan = {}; akanSayisi = 0;
      sikistiKapali = false; sikistiGizle();
      tahtaKur(); barYenile();
      var s = $('ssSonuc'); if (s) s.classList.remove('show');
    }
    var bastan = $('ssBastanBtn');
    if (bastan) bastan.addEventListener('click', bastanBasla);

    /* Tamamlandi ekranindan cikis: once gecis reklami (kurallar Reklam icinde;
       uygun degilse hemen doner), kapaninca devam. Reklam yoksa eskisi gibi esza.
       Beklerken bolum/ekran degistiyse (geri tusu) devam edilmez. */
    function gecisSonra(devam) {
      if (gecisBekliyor || !oyun) return;
      var R = global.Reklam;
      if (!R || typeof R.gecisGoster !== 'function') { devam(); return; }
      gecisBekliyor = true;
      var once = gorunum;
      var bitti = function () {
        gecisBekliyor = false;
        if (gorunum === once) devam();
      };
      var p;
      try { p = R.gecisGoster({ oyun: 'ss', bolum: oyun.bolum.bolumNo }); } catch (e) { p = null; }
      if (p && typeof p.then === 'function') p.then(bitti, bitti); else bitti();
    }

    var sonraki = $('ssSonrakiBtn');
    if (sonraki) sonraki.addEventListener('click', function () {
      if (!oyun) return;
      gecisSonra(function () {
        var no = oyun.bolum.bolumNo + 1;
        var s = $('ssSonuc'); if (s) s.classList.remove('show');
        if (no <= TOPLAM_BOLUM) bolumBaslat2(no);
      });
    });

    var haritaya = $('ssHaritayaBtn');
    if (haritaya) haritaya.addEventListener('click', function () {
      gecisSonra(function () {
        ogreticiGizle();
        var s = $('ssSonuc'); if (s) s.classList.remove('show');
        haritaCiz();
        if (global.slideBack) global.slideBack('ssOyun', 'ssHarita');
      });
    });

    /* Sikistin bilgisi: secenekler mevcut joker / bastan akisina gider */
    var skGeri = $('ssSikistiGeri');
    if (skGeri) skGeri.addEventListener('click', function () { if (akanSayisi > 0) return; sikistiGizle(); jokerTiklandi('geriAl'); });
    var skSise = $('ssSikistiSise');
    if (skSise) skSise.addEventListener('click', function () { if (akanSayisi > 0) return; sikistiGizle(); jokerTiklandi('siseEkle'); });
    var skBastan = $('ssSikistiBastan');
    if (skBastan) skBastan.addEventListener('click', bastanBasla);
    var skKapat = $('ssSikistiKapat');
    if (skKapat) skKapat.addEventListener('click', function () { sikistiKapali = true; sikistiGizle(); });
  }

  /* Oyun ekranindan oyun ekranina gecis (kaydirma olmadan) */
  function bolumBaslat2(bolumNo) {
    ogreticiGizle();
    oyun = global.SuSirala.OyunOlustur(bolumNo);
    secili = -1; perdeModu = false; doken = {}; dolan = {}; akanSayisi = 0;
    gorunum++; sikistiKapali = false; sikistiGizle();
    var baslik = $('ssLevelTitle');
    if (baslik) baslik.textContent = 'Bölüm ' + bolumNo;
    tahtaKur();
    barYenile();
  }

  /* ---------- Disa acilan arayuz ---------- */

  global.SuSiralaOyun = {
    modYenile: modYenile,
    haritaCiz: haritaCiz,
    bolumBaslat: bolumBaslat,
    baglan: baglan,
    TOPLAM_BOLUM: TOPLAM_BOLUM,
    OZEL_ACILIS: OZEL_ACILIS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baglan);
  } else {
    baglan();
  }

  /* Ilerleme sifirlanirsa harita da sifirlansin */
  if (global.AppReset && global.AppReset.push) {
    global.AppReset.push(function () {
      if (global.AppProgress) { global.AppProgress.ssAcik = 1; global.AppProgress.ssYildiz = {}; global.AppProgress.ssJoker = null; }
      dokumIptal();   /* gec dokum geri cagrilari bos oyuna dokunmasin */
      gorunum++;      /* gec gelen reklam sonucu bos oyuna islenmesin */
      sikistiGizle();
      oyun = null;
    });
  }

})(window);