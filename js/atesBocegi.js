// atesBocegi.js — Ates Bocegi'nin saf oyun cekirdegi. DOM'a dokunmaz.
// Tarayicida window.AtesBocegi, Node'da module.exports olarak yuklenir;
// tools/atesBocegiTest.js ve tools/atesBocegiAdaletTest.js ayni kodu bassiz calistirir.
//
// DUNYA   : W x H = 50 x 100 birim, y asagi artar. Bocek dunya x'i = mesafe + X_BOCEK.
// DILIM   : bir ya da daha cok engel + tek garantili bosluk [ust, alt] + onundeki tozlar.
//           Engeller eksene hizali dikdortgendir (x, y, w, h; dunya koordinati), cizim
//           icin gereken her alan dilim nesnesindedir. Kusun ve dusen dalin x/y'si adim'da guncellenir.
// URETEC  : tohumlu mulberry32; fizik adimi rastgele sayi cekmez.
(function (kok, fabrika) {
  if (typeof module === 'object' && module.exports) module.exports = fabrika();
  else kok.AtesBocegi = fabrika();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function dondur(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') dondur(o[k]); });
    return Object.freeze(o);
  }

  // ---------------------------------------------------------------
  // AYAR — butun denge sayilari burada (tasarim 3.8)
  // ---------------------------------------------------------------
  var AYAR = dondur({
    dunya: { W: 50, H: 100, X_BOCEK: 8, DT: 1 / 120, Y_UST: 4, Y_ALT: 96, Y_BASLA: 50 },
    hareket: {
      A_YUKSEL: 260, G_SUZUL: 150, VY_YUKARI: 62, VY_ASAGI: 40,
      R_GORSEL: 2.4, R_CARPMA: 1.6, R_TOPLA: 3.2,
      R_TOZ_GORSEL: 1.1, R_KIVILCIM_GORSEL: 2.2      // cizim; oran >= 1,8 (tasarim 6)
    },
    adalet: {
      T_MIN: 0.6, KUS_EK: 0.25, PAY_R: 2,
      R_TABAN: 18, R_TAVAN: 40, SIS: [1, 1, 1, 0.85],
      KARARTMA: 1.25,                                // karartma R ile 1,25*R arasinda artar
      V_GUVENLI: 20, T_IVME: 0.15                    // V_GUVENLI tasarimda 28; isik 0 + T_MIN gecikmeli Bot B icin 20
    },
    uretici: {
      ONDE: 2,                                       // boceğin ONDE*W ilerisine kadar uret
      ACILIS_DILIM: 3, ACILIS_BOSLUK: 30, ACILIS_FARK: 10,
      MERKEZ_MIN: 18, MERKEZ_MAX: 82,
      SERIT_UST: 10, SERIT_ALT: 90, SERIT_PENCERE: 4,
      AGIRLIK: [[5, 2, 2, 1], [6, 1, 0, 3], [3, 2, 5, 0], [4, 4, 1, 1]],   // dal/ag/kus/dusen
      DENEME: 40, EK_DAL: 0.5,
      DAL_GEN: 5,
      AG_GEN: 7, AG_BOY_MIN: 14, AG_BOY_MAX: 20, AG_KENAR: 2,
      KUS_GEN: 5, KUS_BOY: 3.5, KUS_PAY: 3,
      DUSEN_GEN: 5, DUSEN_BOY_MIN: 6, DUSEN_BOY_MAX: 10, DUSEN_SARMASIK_MIN: 4,
      DUSEN_UYARI: 0.15, DUSEN_HIZ: 60,              // DUSEN_UYARI tasarimda 0,25; tetik < minYaricap icin 0,15
      TOZ_MIN: 3, TOZ_MAX: 5, TOZ_SAPMA: 2,
      KIVILCIM_OLASILIK: 0.08, KIVILCIM_UZAK_MIN: 10, KIVILCIM_UZAK_MAX: 16,
      KIVILCIM_Y_MIN: 10, KIVILCIM_Y_MAX: 90
    },
    zorluk: {
      Z_OLCEK: 9000, HIZ_TABAN: 24, HIZ_Z: 18, HIZ_LOG: 2, HIZ_LOG_OLCEK: 40000, HIZ_TAVAN: 44,
      TARA_TABAN: 1.90, TARA_Z: 0.65, BOSLUK_TABAN: 24, BOSLUK_Z: 8,
      SIZINTI_TABAN: 0.028, SIZINTI_Z: 0.022
    },
    isik: { BASLANGIC: 1, TOZ: 0.035, KIVILCIM: 0.25, HASAR: 0.34, AG_HASAR: 0.17, DOKUNULMAZ: 1.0 },
    puan: {
      TOZ: 2, KIVILCIM: 50, MESAFE_BIRIM: 4, ZINCIR_SURE: 1.5,
      ZINCIR_ADIM: 5, CARPAN_ARTIS: 0.5, CARPAN_TAVAN: 4,
      BOLGE_PUAN: 500, BOLGE_SAYI: 4
    },
    ekonomi: {
      AKTIF_TOZ: 10, AKTIF_PUAN: 300, BOLEN: 150, KOSU_TAVAN: 40,
      GUN_TAM: 200, AZALMA: 4,
      ESIK_TABAN: 1000, ESIK_ODUL: [25, 50, 75, 100, 150, 200, 300], ESIK_ARTIS: 100
    }
  });

  var D = AYAR.dunya, M = AYAR.hareket, AD = AYAR.adalet, U = AYAR.uretici,
      Z = AYAR.zorluk, I = AYAR.isik, P = AYAR.puan;
  var TURLER = ['dal', 'ag', 'kus', 'dusen'];

  // ---------------------------------------------------------------
  // Degismezler (3.3, 3.4). Bos dizi = gecerli.
  // ---------------------------------------------------------------
  function ayarDogrula(a) {
    var h = [], d = a.dunya, m = a.hareket, ad = a.adalet, u = a.uretici, z = a.zorluk, p = a.puan;
    function minY(hiz) { return (1 + ad.KUS_EK) * hiz * ad.T_MIN + ad.PAY_R; }
    if (!(minY(z.HIZ_TAVAN) <= ad.R_TAVAN)) h.push('minYaricap(HIZ_TAVAN) > R_TAVAN');
    if (!(ad.R_TAVAN <= d.W - d.X_BOCEK - 2)) h.push('R_TAVAN > W - X_BOCEK - 2');
    if (!(ad.PAY_R >= m.R_CARPMA)) h.push('PAY_R < R_CARPMA');
    [z.HIZ_TABAN, z.HIZ_TAVAN].forEach(function (hiz) {      // dogrusal: iki uc yeter
      if (!(hiz * (ad.T_MIN + u.DUSEN_UYARI) < minY(hiz))) h.push('dusen dal tetik mesafesi >= minYaricap (hiz ' + hiz + ')');
    });
    var bMin = z.BOSLUK_TABAN - z.BOSLUK_Z, taMin = z.TARA_TABAN - z.TARA_Z;
    if (!(bMin > 2 * m.R_CARPMA)) h.push('en kucuk bosluk <= 2*R_CARPMA');
    if (!(taMin > ad.T_MIN + ad.T_IVME)) h.push('en kucuk tAra <= T_MIN + T_IVME');
    if (!(ad.V_GUVENLI <= m.VY_ASAGI && ad.V_GUVENLI <= m.VY_YUKARI)) h.push('V_GUVENLI > dikey hiz siniri');
    if (!(u.MERKEZ_MIN - z.BOSLUK_TABAN / 2 > 0 && u.MERKEZ_MAX + z.BOSLUK_TABAN / 2 < d.H)) h.push('merkez sinirinda bosluk dunya disina tasiyor');
    if (!(u.SERIT_UST + u.ACILIS_BOSLUK / 2 <= u.SERIT_ALT - u.ACILIS_BOSLUK / 2)) h.push('acilis dilimi iki seridi kapatamiyor');
    var dcMin = ad.V_GUVENLI * (taMin - ad.T_MIN - ad.T_IVME);
    if (!((u.SERIT_UST + z.BOSLUK_TABAN / 2) - u.MERKEZ_MIN <= dcMin && u.MERKEZ_MAX - (u.SERIT_ALT - z.BOSLUK_TABAN / 2) <= dcMin))
      h.push('serit yedegi kural 3 ile ulasilamiyor');
    if (!(m.R_KIVILCIM_GORSEL / m.R_TOZ_GORSEL >= 1.8)) h.push('kivilcim/toz cizim orani < 1,8');
    if (!(ad.SIS.length === p.BOLGE_SAYI && u.AGIRLIK.length === p.BOLGE_SAYI)) h.push('bolge sayisi tutarsiz');
    u.AGIRLIK.forEach(function (r, i) {
      if (r.length !== 4 || !(r[0] + r[1] + r[2] + r[3] > 0)) h.push('AGIRLIK[' + i + '] gecersiz');
    });
    if (!(u.TOZ_MIN >= 1 && u.TOZ_MAX >= u.TOZ_MIN)) h.push('toz sayisi gecersiz');
    return h;
  }
  var hatalar = ayarDogrula(AYAR);
  if (hatalar.length) throw new Error('AtesBocegi.AYAR gecersiz: ' + hatalar.join('; '));

  // ---------------------------------------------------------------
  // Rastgele: yalniz mulberry32 (durumu nesnede: JSON'a cevrilebilir)
  // ---------------------------------------------------------------
  function rngAdim(o) {
    o.s = (o.s + 0x6D2B79F5) >>> 0;
    var x = o.s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  function rngOlustur(tohum) {
    var o = { s: tohum >>> 0 };
    return function () { return rngAdim(o); };
  }

  // ---------------------------------------------------------------
  // Saf islevler
  // ---------------------------------------------------------------
  function zorluk(mesafe) {
    var z = 1 - Math.exp(-mesafe / Z.Z_OLCEK);
    return {
      z: z,
      hiz: Math.min(Z.HIZ_TAVAN, Z.HIZ_TABAN + Z.HIZ_Z * z + Z.HIZ_LOG * Math.log2(1 + mesafe / Z.HIZ_LOG_OLCEK)),
      tAra: Z.TARA_TABAN - Z.TARA_Z * z,
      bosluk: Z.BOSLUK_TABAN - Z.BOSLUK_Z * z,
      sizinti: Z.SIZINTI_TABAN + Z.SIZINTI_Z * z
    };
  }
  function minYaricap(hiz) { return (1 + AD.KUS_EK) * hiz * AD.T_MIN + AD.PAY_R; }
  function isikYaricapi(isik, hiz, bolge) {
    return Math.max(minYaricap(hiz), (AD.R_TABAN + (AD.R_TAVAN - AD.R_TABAN) * isik) * AD.SIS[bolge]);
  }
  function bolgeNo(puan) { return Math.floor(puan / P.BOLGE_PUAN) % P.BOLGE_SAYI; }
  function carpan(zincir) { return Math.min(P.CARPAN_TAVAN, 1 + P.CARPAN_ARTIS * Math.floor(zincir / P.ZINCIR_ADIM)); }
  function kistir(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------------------------------------------------------------
  // URETICI (3.4, 3.5)
  // ---------------------------------------------------------------
  // Varis mesafesi d1'deki dilimden sonra en kisa aralik: Δ >= hiz(d1+Δ)·tAra(d1+Δ).
  // hiz artan oldugu icin gercek sure >= Δ / hiz(d1+Δ) >= tAra (kural 2).
  function aralik(d1) {
    function f(x) { var zr = zorluk(d1 + x); return zr.hiz * zr.tAra; }
    var x = f(0), g;
    while (x < (g = f(x))) x = g + 1e-6;
    return x;
  }
  function dalKur(x, ust, alt, ustVar, altVar) {
    var e = [];
    if (ustVar) e.push({ tur: 'dal', yon: 'ust', x: x, y: 0, w: U.DAL_GEN, h: ust });
    if (altVar) e.push({ tur: 'dal', yon: 'alt', x: x, y: alt, w: U.DAL_GEN, h: D.H - alt });
    return e;
  }
  function adayKur(tur, x, ust, alt, r) {
    var e, asagi, ustOk, altOk, q;
    if (tur === 'dal') {
      q = r();                                    // %50 iki yan, %25 yalniz tavan, %25 yalniz zemin
      return dalKur(x, ust, alt, q < 0.75, q < 0.5 || q >= 0.75);
    }
    if (tur === 'ag') {
      var boy = U.AG_BOY_MIN + r() * (U.AG_BOY_MAX - U.AG_BOY_MIN);
      altOk = alt + boy <= D.H - U.AG_KENAR; ustOk = ust - boy >= U.AG_KENAR;
      if (!altOk && !ustOk) return null;
      asagi = altOk && (!ustOk || r() < 0.5);   // ag boslugun altinda mi
      e = [{ tur: 'ag', x: x, y: asagi ? alt : ust - boy, w: U.AG_GEN, h: boy }];
      if (r() < U.EK_DAL) e = e.concat(dalKur(x, ust, alt, asagi, !asagi));
      return e;
    }
    if (tur === 'kus') {
      var pay = r() * U.KUS_PAY;
      altOk = alt + pay + U.KUS_BOY <= D.H; ustOk = ust - pay - U.KUS_BOY >= 0;
      if (!altOk && !ustOk) return null;
      asagi = altOk && (!ustOk || r() < 0.5);
      // Kus, dilimin sabit engelleriyle ayni anda bocegin onune (X_BOCEK + R_CARPMA) degecek
      // sekilde konur: dunya x'i = x0 - KUS_EK * mesafe (yaklasma hizi (1 + KUS_EK) * hiz).
      var x0 = x + AD.KUS_EK * (x - D.X_BOCEK - M.R_CARPMA);
      e = [{ tur: 'kus', x: x0, x0: x0, ek: AD.KUS_EK, y: asagi ? alt + pay : ust - pay - U.KUS_BOY, w: U.KUS_GEN, h: U.KUS_BOY }];
      if (r() < U.EK_DAL) e = e.concat(dalKur(x, ust, alt, asagi, !asagi));
      return e;
    }
    // dusen: tavanda asili dal; dustugunde alt ucu = ust
    var dboy = U.DUSEN_BOY_MIN + r() * (U.DUSEN_BOY_MAX - U.DUSEN_BOY_MIN), s = ust - dboy;
    if (s < U.DUSEN_SARMASIK_MIN) return null;
    e = [{ tur: 'dusen', x: x, y: 0, w: U.DUSEN_GEN, h: dboy, sarmasik: s, faz: 0, sure: 0 }];
    if (r() < U.EK_DAL) e = e.concat(dalKur(x, ust, alt, false, true));
    return e;
  }
  function kapatir(e) {
    var k = { ust: false, alt: false };
    for (var i = 0; i < e.length; i++) {
      if (e[i].tur !== 'dal') continue;
      if (e[i].y <= 0 && e[i].y + e[i].h >= U.SERIT_UST) k.ust = true;
      if (e[i].y <= U.SERIT_ALT && e[i].y + e[i].h >= D.H) k.alt = true;
    }
    return k;
  }
  function agirlikli(r, satir) {
    var top = satir[0] + satir[1] + satir[2] + satir[3], v = r() * top, i;
    for (i = 0; i < 3; i++) { v -= satir[i]; if (v < 0) return TURLER[i]; }
    for (i = 3; i > 0 && !satir[i]; i--);
    return TURLER[i];
  }

  // this = uretici. bolge: dilimin engel agirliklarini secer; degisirse once nefes dilimi gelir.
  function sonraki(bolge) {
    var ur = this, r = function () { return rngAdim(ur); };
    bolge = bolge | 0;
    var x = ur.x + aralik(ur.x - D.X_BOCEK);
    var zr = zorluk(x - D.X_BOCEK);
    var maxDc = AD.V_GUVENLI * (zr.tAra - AD.T_MIN - AD.T_IVME);
    var nefes = ur.n >= U.ACILIS_DILIM && bolge !== ur.bolge;
    ur.bolge = bolge;
    var c, g = zr.bosluk, tur, e = null, k;
    if (ur.n < U.ACILIS_DILIM) {
      g = U.ACILIS_BOSLUK; tur = 'dal';
      c = kistir(ur.c + (2 * r() - 1) * U.ACILIS_FARK, U.SERIT_UST + g / 2, U.SERIT_ALT - g / 2);
      e = dalKur(x, c - g / 2, c + g / 2, true, true);
    } else if (nefes) {
      tur = 'nefes'; e = [];
      c = kistir(ur.c + (2 * r() - 1) * maxDc, U.MERKEZ_MIN, U.MERKEZ_MAX);
    } else {
      for (var deneme = 0; deneme < U.DENEME && !e; deneme++) {
        c = kistir(ur.c + (2 * r() - 1) * maxDc, U.MERKEZ_MIN, U.MERKEZ_MAX);
        tur = agirlikli(r, U.AGIRLIK[bolge]);
        e = adayKur(tur, x, c - g / 2, c + g / 2, r);
        if (!e) continue;
        k = kapatir(e);                            // kural 5: 3 dilimdir kapanmayan serit simdi kapanmali
        if ((ur.ustSay >= U.SERIT_PENCERE - 1 && !k.ust) || (ur.altSay >= U.SERIT_PENCERE - 1 && !k.alt)) e = null;
      }
      if (!e) {                                    // yedek: iki yanli dal, iki seridi de kapatir
        tur = 'dal';
        c = kistir(ur.c, Math.max(U.SERIT_UST + g / 2, ur.c - maxDc), Math.min(U.SERIT_ALT - g / 2, ur.c + maxDc));
        e = dalKur(x, c - g / 2, c + g / 2, true, true);
      }
    }
    if (!nefes) {
      k = kapatir(e);
      ur.ustSay = k.ust ? 0 : ur.ustSay + 1;
      ur.altSay = k.alt ? 0 : ur.altSay + 1;
    }
    var w = 0, i;
    for (i = 0; i < e.length; i++) if (e[i].w > w) w = e[i].w;

    // Toz (kural 6): onceki dilimin arkasi ile bu dilimin onu arasinda kosinus egrisi.
    var a = ur.x + ur.w, b = x, toz = [], n = U.TOZ_MIN + Math.floor(r() * (U.TOZ_MAX - U.TOZ_MIN + 1)), f;
    for (i = 1; i <= n; i++) {
      f = i / (n + 1);
      toz.push({ x: a + (b - a) * f, y: ur.c + (c - ur.c) * (1 - Math.cos(Math.PI * f)) / 2 + (2 * r() - 1) * U.TOZ_SAPMA, alindi: 0 });
    }
    // Kivilcim (kural 7): aralik ortasinda, yoldan 10-16 uzakta; c1 -> kivilcim -> c2 dikey yolu sigmali.
    var kiv = null;
    if (r() < U.KIVILCIM_OLASILIK) {
      var uz = U.KIVILCIM_UZAK_MIN + r() * (U.KIVILCIM_UZAK_MAX - U.KIVILCIM_UZAK_MIN);
      var ys = (ur.c + c) / 2 + (r() < 0.5 ? -uz : uz);
      if (ys >= U.KIVILCIM_Y_MIN && ys <= U.KIVILCIM_Y_MAX &&
          Math.abs(ys - ur.c) + Math.abs(c - ys) <= AD.V_GUVENLI * (zr.tAra - AD.T_MIN))
        kiv = { x: (a + b) / 2, y: ys, alindi: 0 };
    }
    var dl = {
      no: ur.n, x: x, w: w, tur: tur, nefes: nefes ? 1 : 0,
      z: zr.z, hiz: zr.hiz, tAra: zr.tAra, bosluk: zr.bosluk,
      c: c, ust: c - g / 2, alt: c + g / 2,
      engeller: e, toz: toz, kivilcim: kiv
    };
    ur.n++; ur.x = x; ur.w = w; ur.c = c;
    return dl;
  }
  function ureticiOlustur(tohum) {
    // Veri alanlari JSON'a girer (determinizm karsilastirmasi bunlari da kapsar).
    return { s: tohum >>> 0, n: 0, x: D.X_BOCEK, w: 0, c: D.Y_BASLA, bolge: 0, ustSay: 0, altSay: 0, sonraki: sonraki };
  }
  function dilimZarfi(dl) { return { ust: dl.ust, alt: dl.alt }; }

  // ---------------------------------------------------------------
  // OYUN
  // ---------------------------------------------------------------
  function doldur(d) {
    while (d.uretici.x <= d.mesafe + D.X_BOCEK + U.ONDE * D.W) d.dilimler.push(d.uretici.sonraki(d.bolge));
  }
  function oyunOlustur(tohum) {
    var d = {
      t: 0, mesafe: 0, puan: 0, y: D.Y_BASLA, vy: 0, isik: I.BASLANGIC, dokunulmaz: 0,
      zincir: 0, zincirSure: 0, toz: 0, bolge: 0, bitti: 0, dilimler: [], tohum: tohum >>> 0,
      uretici: ureticiOlustur(tohum)
    };
    doldur(d);
    return d;
  }
  function carpar(e, bx, by, r) {
    var cx = kistir(bx, e.x, e.x + e.w), cy = kistir(by, e.y, e.y + e.h);
    return (bx - cx) * (bx - cx) + (by - cy) * (by - cy) <= r * r;
  }
  function adim(d, basili) {
    if (d.bitti) return [];
    var olay = [], dt = D.DT, i, j, s, e, t;
    // hareket (yari ortuk Euler)
    d.vy += (basili ? -M.A_YUKSEL : M.G_SUZUL) * dt;
    if (d.vy < -M.VY_YUKARI) d.vy = -M.VY_YUKARI; else if (d.vy > M.VY_ASAGI) d.vy = M.VY_ASAGI;
    d.y += d.vy * dt;
    if (d.y < D.Y_UST) { d.y = D.Y_UST; d.vy = 0; } else if (d.y > D.Y_ALT) { d.y = D.Y_ALT; d.vy = 0; }
    // dunya
    var zr = zorluk(d.mesafe), eski = Math.floor(d.mesafe / P.MESAFE_BIRIM);
    d.mesafe += zr.hiz * dt; d.t += dt;
    d.puan += Math.floor(d.mesafe / P.MESAFE_BIRIM) - eski;
    d.isik -= zr.sizinti * dt;
    if (d.dokunulmaz > 0) d.dokunulmaz = Math.max(0, d.dokunulmaz - dt);
    if (d.zincirSure > 0) { d.zincirSure -= dt; if (d.zincirSure <= 0) { d.zincirSure = 0; d.zincir = 0; } }
    doldur(d);
    while (d.dilimler.length && d.dilimler[0].x + d.dilimler[0].w < d.mesafe - 1) d.dilimler.shift();

    var bx = d.mesafe + D.X_BOCEK, tetik = zr.hiz * (AD.T_MIN + U.DUSEN_UYARI), r2 = M.R_TOPLA * M.R_TOPLA, vurdu = null;
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      for (j = 0; j < s.engeller.length; j++) {
        e = s.engeller[j];
        if (e.tur === 'kus') e.x = e.x0 - e.ek * d.mesafe;
        else if (e.tur === 'dusen') {
          if (e.faz === 0) { if (e.x - bx <= tetik) { e.faz = 1; e.sure = 0; } }
          else if (e.faz === 1) { e.sure += dt; if (e.sure >= U.DUSEN_UYARI) e.faz = 2; }
          else if (e.faz === 2) { e.y = Math.min(e.sarmasik, e.y + U.DUSEN_HIZ * dt); if (e.y >= e.sarmasik) e.faz = 3; }
        }
        if (!vurdu && d.dokunulmaz <= 0 && e.x <= bx + M.R_CARPMA && e.x + e.w >= bx - M.R_CARPMA &&
            carpar(e, bx, d.y, M.R_CARPMA)) vurdu = e;
      }
    }
    if (vurdu) {
      var ag = vurdu.tur === 'ag';
      d.isik -= ag ? I.AG_HASAR : I.HASAR;
      d.zincir = 0; d.zincirSure = 0; d.dokunulmaz = I.DOKUNULMAZ;
      olay.push({ tur: ag ? 'ag' : 'hasar', engel: vurdu.tur });
    }
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      // Toz ve kivilcim dilimin onunde (x < s.x), x'e gore sirali: geride/uzakta olani atla.
      if (s.x < bx - M.R_TOPLA) continue;
      if (s.toz.length && s.toz[0].x - bx > M.R_TOPLA) break;
      for (j = 0; j < s.toz.length; j++) {
        t = s.toz[j];
        if (t.alindi || (t.x - bx) * (t.x - bx) + (t.y - d.y) * (t.y - d.y) > r2) continue;
        t.alindi = 1;
        var kz = P.TOZ * carpan(d.zincir);
        d.puan += kz; d.isik = Math.min(1, d.isik + I.TOZ);
        d.zincir++; d.zincirSure = P.ZINCIR_SURE; d.toz++;
        olay.push({ tur: 'toz', puan: kz });
      }
      t = s.kivilcim;
      if (t && !t.alindi && (t.x - bx) * (t.x - bx) + (t.y - d.y) * (t.y - d.y) <= r2) {
        t.alindi = 1;
        var kk = P.KIVILCIM * carpan(d.zincir);
        d.puan += kk; d.isik = Math.min(1, d.isik + I.KIVILCIM);
        olay.push({ tur: 'kivilcim', puan: kk });
      }
    }
    var nb = bolgeNo(d.puan);
    if (nb !== d.bolge) { d.bolge = nb; olay.push({ tur: 'bolge', bolge: nb }); }
    if (d.isik <= 0) { d.isik = 0; d.bitti = 1; olay.push({ tur: 'bitti' }); }
    return olay;
  }

  // EKONOMI-BASI (tools/atesBocegiTest.js bu blogu ayri calistirir; yalniz `ayar` parametresini kullanir)
  function esikOdulu(eskiRekor, puan, ayar) {
    var e = ayar.ekonomi, toplam = 0, adet = 0, k, esik, o;
    for (k = 0, esik = e.ESIK_TABAN; esik <= puan && k < 60; k++, esik *= 2) {
      if (esik <= eskiRekor) continue;
      o = k < e.ESIK_ODUL.length ? e.ESIK_ODUL[k]
        : e.ESIK_ODUL[e.ESIK_ODUL.length - 1] + (k - e.ESIK_ODUL.length + 1) * e.ESIK_ARTIS;
      toplam += o; adet++;
    }
    return { jeton: toplam, adet: adet };
  }
  function kosuJetonu(puan, toz, gunJeton, ayar) {
    var e = ayar.ekonomi;
    var aktif = toz >= e.AKTIF_TOZ && puan >= e.AKTIF_PUAN;
    var ham = aktif ? Math.min(e.KOSU_TAVAN, Math.floor(puan / e.BOLEN)) : 0;
    var tam = Math.min(ham, Math.max(0, e.GUN_TAM - gunJeton));
    return { jeton: tam + Math.floor((ham - tam) / e.AZALMA), ham: ham, aktif: aktif };
  }
  // EKONOMI-SONU

  return {
    AYAR: AYAR, ayarDogrula: ayarDogrula, rngOlustur: rngOlustur,
    zorluk: zorluk, minYaricap: minYaricap, isikYaricapi: isikYaricapi,
    bolgeNo: bolgeNo, carpan: carpan,
    ureticiOlustur: ureticiOlustur, dilimZarfi: dilimZarfi,
    oyunOlustur: oyunOlustur, adim: adim,
    esikOdulu: esikOdulu, kosuJetonu: kosuJetonu
  };
});
