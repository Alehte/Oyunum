// atesBocegi.js — Ates Bocegi'nin saf oyun cekirdegi. DOM'a dokunmaz.
// Tarayicida window.AtesBocegi, Node'da module.exports olarak yuklenir;
// tools/atesBocegiTest.js ve tools/atesBocegiAdaletTest.js ayni kodu bassiz calistirir.
//
// DUNYA   : W x H = 50 x 100 birim, y asagi artar. Bocek dunya x'i = mesafe + X_BOCEK.
//           Gorunen genislik ekran oranina gore W .. H * ORAN_MAX (cizim, atesBocegiOyun.js); oyun mantigi ve
//           adalet modeli W'yi (en dar ekran) varsayar. Uretim ufku (UFUK) cihazdan bagimsiz: her cihazda ayni dunya.
// DILIM   : bir ya da daha cok engel + tek garantili bosluk [ust, alt] + onundeki tozlar.
//           Engeller eksene hizali dikdortgendir (x, y, w, h; dunya koordinati), cizim
//           icin gereken her alan dilim nesnesindedir. Kusun ve dusen dalin x/y'si adim'da guncellenir.
// URETEC  : tohumlu mulberry32; fizik adimi rastgele sayi cekmez.
// TASARIM 11 (Karanlikta Suzul): dilimde tozsuz (0/1), bomba ({x, y, alindi} | null), sarmasik
//           ({yon, x1, x2, sutunlar[{x, y, w, h, tx, ty}], faz 0-3, sure, ilerleme} | null); tozda yutuldu (0/1).
//           Miknatis tozun x/y'sini adim'da kaydirir. Olaylar: bomba, sarmasik, sarmasikUyari, yutuldu (x, y).
// TASARIM 12.1: durumda sersem (kalan sn), zeminKoruma (kalan sn), sebep ('' | 'isik' | 'zemin'). Olaylar: sersem,
//           uyandi, zemin (x, y); bitti olayi sebep tasir.
// TASARIM 13 (FAZ B): kademe (ekranda "Bolge N", mesafe esikli; gorsel biyom 'bolge'den ayri), hiz/sizinti rampasi,
//           salinan engel ({tur: 'salinan', x, y, w, h, yc, gen, om, faz}: y = yc + gen * sin(om * t + faz)), dilimde
//           dag (duzensiz isik katsayisi 0-1) ve kademe. Olay: kademe (kademe). 12.2 risk tozu kaldirildi.
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
    dunya: { W: 50, H: 100, X_BOCEK: 8, DT: 1 / 120, Y_UST: 4, Y_ALT: 96, Y_BASLA: 50,
             ORAN_MAX: 20 / 9 },                            // gorunen genislik en cok H * ORAN_MAX (20:9); fazlasi yalniz atmosfer
    hareket: {
      A_YUKSEL: 170, G_SUZUL: 120, VY_YUKARI: 40, VY_ASAGI: 30,   // tasarim 11.1 (suzulme hissi)
      T_RAMPA: 0.07,                                 // ivme rampasi: ay hedefe birinci dereceden yaklasir
      R_GORSEL: 3.0, R_CARPMA: 1.6, R_TOPLA: 4.2,    // gorsel %25 buyudu, carpma ayni (11.2, 11.3)
      R_MIKNATIS: 7.5, MIKNATIS_HIZ: 20,             // yalniz toz bocege kayar (11.2); < HIZ_TABAN: gerideki tozu kovalamaz
      R_BOMBA: 1.6,                                  // bomba cizim = carpma yaricapi; R_TOPLA/miknatis uygulanmaz
      R_TOZ_GORSEL: 1.1, R_KIVILCIM_GORSEL: 2.2,     // cizim; oran >= 1,8 (tasarim 6)
      // Tavan sersemlemesi ve zemin olumu (tasarim 12.1). Tavana degince SERSEM_SURE sn girdi etkisiz; bocek
      // Y_UST'ten uyanma yuksekligine (Y_ALT - SERSEM_UYANMA_ORAN * (Y_ALT - Y_UST)) yumusak (smoothstep) suzulur,
      // orada durgun uyanir; sure dolunca ya da o yukseklige varinca (hangisi once). Uyaninca ZEMIN_KORUMA sn
      // zemin olumu kapali (zemine degerse kistirilir). Zemine degmek (koruma disinda) kosuyu bitirir.
      SERSEM_SURE: 0.9, SERSEM_UYANMA_ORAN: 0.25, ZEMIN_KORUMA: 0.5
    },
    adalet: {
      T_MIN: 0.6, KUS_EK: 0.25, PAY_R: 2,
      R_TABAN: 18, R_TAVAN: 40, SIS: [1, 1, 1, 0.85],
      KARARTMA: 1.25,                                // karartma R ile 1,25*R arasinda artar
      V_GUVENLI: 20, T_IVME: 0.24,                   // V_GUVENLI tasarimda 28; isik 0 + T_MIN gecikmeli Bot B icin 20.
                                                     // T_IVME: durustan V_GUVENLI'ye rampa dahil sayisal cikis suresi (11.1)
      PAY_KACIS: 0.5,                                // bomba/sarmasik kacisinda carpma payinin ustune bosluk
      PAY_KACIS_SN: 0.05                             // kacis suresine eklenen zaman payi
    },
    uretici: {
      // Uretim ufku: bocegin UFUK birim ilerisine kadar uret. En genis gorunur alanin (H * ORAN_MAX - X_BOCEK = 214,2)
      // ve en genis engelin otesinde: hicbir nesne gorunur alanin icinde dogmaz (cihazdan bagimsiz sabit).
      // ESIK_UFUK: puan esikleri (TOZSUZ/BOMBA/SARMASIK_PUAN, bolge) bu ufka gore olculur. Dilim UFUK'ta
      // uretildigi icin uretimde, bocegin aradaki L = UFUK - ESIK_UFUK birimde kazanacagi puan tahmini eklenir
      // (uretimPuani): mesafe puani L / MESAFE_BIRIM + ileri toz puani (ileriTozPuani): bocegin onundeki L birimde
      // ZATEN URETILMIS alinmamis tozlarin, zincir surerse verecegi puan; en cok ESIK_TOZ_TAVAN.
      // Kullanilan deger kosu boyunca azalmaz (durum.esikPuan = en buyugu): bolge ve esikler geri donmez.
      // Esigi asan ilk dilim boylece eski ufuktaki (100) konumuna yakin dogar; cihazdan bagimsiz, deterministik.
      // ESIK_TOZ_TAVAN (olcum, gorev 3 denetimi): tavansiz ileri toz terimi uretimde p50 ~55, p90 ~95, en cok 120 (15 toz x 8);
      // 100'de medyan kayma eskiye gore +-6 icinde, 80'de +12'ye cikar. Tavan telafinin sabit ust siniridir (adalet testi (a)).
      UFUK: 230, ESIK_UFUK: 100, ESIK_TOZ_TAVAN: 100,
      ACILIS_DILIM: 3, ACILIS_BOSLUK: 30, ACILIS_FARK: 10,
      MERKEZ_MIN: 18, MERKEZ_MAX: 82,
      SERIT_UST: 10, SERIT_ALT: 90, SERIT_PENCERE: 4,
      AGIRLIK: [[5, 2, 2, 1], [6, 1, 0, 3], [3, 2, 5, 0], [4, 4, 1, 1]],   // dal/ag/kus/dusen
      DENEME: 40, EK_DAL: 0.5, YAN_ALT: 0.5,               // YAN_ALT: ag/kus/kivilcim icin alt yani secme olasiligi
      DAL_IKI: 0.5, DAL_UST: 0.25,                     // dal: iki yan / yalniz tavan (kalan: yalniz zemin)
      NEFES_SURE: 2,                                   // nefes cevresinde en az engelsiz sure (sn)
      DAL_GEN: 5,
      AG_GEN: 7, AG_BOY_MIN: 14, AG_BOY_MAX: 20, AG_KENAR: 2,
      KUS_GEN: 5, KUS_BOY: 3.5, KUS_PAY: 3,
      DUSEN_GEN: 5, DUSEN_BOY_MIN: 6, DUSEN_BOY_MAX: 10, DUSEN_SARMASIK_MIN: 4,
      DUSEN_UYARI: 0.15, DUSEN_HIZ: 60,              // DUSEN_UYARI tasarimda 0,25; tetik < minYaricap icin 0,15
      TOZ_MIN: 3, TOZ_MAX: 5, TOZ_SAPMA: 2,
      KIVILCIM_OLASILIK: 0.10, KIVILCIM_UZAK_MIN: 10, KIVILCIM_UZAK_MAX: 16,   // olasilik 0,08 -> 0,10: tozsuz/bomba/sarmasik dilimlerinde kivilcim yok
      KIVILCIM_Y_MIN: 10, KIVILCIM_Y_MAX: 90,
      // Tozsuz bolumler (11.6): pencere TOZSUZ_MIN..MAX dilim, araya en az TOZSUZ_ARA dilim.
      TOZSUZ_PUAN: 800, TOZSUZ_OLASILIK: 0.05, TOZSUZ_ARTIS: 0.01, TOZSUZ_ADIM: 1000, TOZSUZ_TAVAN: 0.10,
      TOZSUZ_MIN: 2, TOZSUZ_MAX: 3, TOZSUZ_ARA: 8,
      TOZSUZ_ISIK_MAX: 0.35,                         // en uzun pencerede en buyuk sizintiyla isik kaybi siniri
      // Bomba (11.5): ic tozlardan birinin yerine.
      BOMBA_PUAN: 1200, BOMBA_OLASILIK: 0.20,
      // 13 (FAZ B, kullanici karari): bomba en dar ekrana (W - X_BOCEK) girmeden BOMBA_ON_ISARET birim once sag kenarda,
      // bombanin y'sinde, kendi isigiyla bir on isaret belirir (arayuz); kacis modeli gorunurlugu isaretten sayar.
      // Yoksa hiz ~41'i asinca (mesafe ~4700+) hicbir bomba adayi kacilabilir olmuyordu.
      BOMBA_ON_ISARET: 6,
      // Sarmasik (11.7): ic tozlarin hizasinda sutunlar. Zaman cizgisi bocegin ilk sutuna varisina gore:
      // uyari varistan SARMASIK_ONCE sn once baslar, SARMASIK_UYARI sn surer, sonra SARMASIK_BUYUME sn buyur.
      SARMASIK_PUAN: 2000, SARMASIK_OLASILIK: 0.12, SARMASIK_SUTUN_MIN: 2, SARMASIK_SUTUN_MAX: 3,
      SARMASIK_GEN: 3, SARMASIK_TASMA: 1,
      SARMASIK_ONCE: 1.26, SARMASIK_UYARI: 0.91, SARMASIK_BUYUME: 0.25,
      // Cakisma (11.8): CAKISMA_SERBEST puanin altinda sarmasik ile tozsuz dilim arasi >= CAKISMA_ARA dilim.
      CAKISMA_SERBEST: 5000, CAKISMA_ARA: 2
    },
    zorluk: {
      Z_OLCEK: 9000, HIZ_TABAN: 24, HIZ_Z: 18, HIZ_LOG: 2, HIZ_LOG_OLCEK: 40000, HIZ_TAVAN: 44,
      TARA_TABAN: 1.90, TARA_Z: 0.65, BOSLUK_TABAN: 24, BOSLUK_Z: 8,
      SIZINTI_TABAN: 0.028, SIZINTI_Z: 0.022,
      // FAZ B (tasarim 13). Kademe esikleri: bocegin mesafesi (birim). Ekranda "Bolge N" (N = 1..5); 5'ten sonrasi 5'in
      // surdurulmesi. Gorsel biyom (puan.BOLGE_PUAN, 'bolge') bundan ayridir. Bir dilimin kademesi varis mesafesinden (x - X_BOCEK).
      KADEME: [0, 500, 1600, 2800, 4000],
      // Hiz ve sizinti rampasi (kademe 2'den): r = kistir((mesafe - KADEME[1]) / (RAMPA_SON - KADEME[1]), 0, 1);
      // hiz = min(HIZ_TAVAN, eski + HIZ_EK * r), sizinti = min(SIZINTI_TAVAN, eski + SIZINTI_EK * r). Kademe 1 aynen eskisi.
      HIZ_EK: 10, SIZINTI_EK: 0.012, RAMPA_SON: 5000, SIZINTI_TAVAN: 0.06,
      // Salinan engel (kademe 3+): ipe asili orumcek; carpma kutusu yalniz govde (SAL_GEN x SAL_BOY). Dikey sinus; supurulen
      // zarf [yc - gen, yc + gen + h] boslugun disinda (uc noktada bosluk kenarina deger): her fazda gecit = bosluk.
      // Genlik / periyot kademe 3 basindan 5 basina dogrusal (mesafeyle). SAL_AGIRLIK: kademe basina, biyom satirina 5. agirlik.
      SAL_GEN: 5, SAL_BOY_MIN: 5, SAL_BOY_MAX: 8, SAL_KENAR: 2,
      SAL_GENLIK: [2, 5], SAL_PERIYOT: [2.4, 1.4], SAL_AGIRLIK: [0, 0, 2, 3, 5],
      // Duzensiz isik (kademe 4+): j = kistir((mesafe - KADEME[3]) / (KADEME[4] - KADEME[3]), 0, 1); son toz disindaki
      // tozlar y'de +- DAG_Y * j, x'te +- DAG_X * j * toz araligi kayar, DAG_ATLA * j olasilikla duser (en az 2 toz kalir).
      // Kinematik ulasilabilirlik (ulasimSiniri) ve ISIK_MARJ ile kistirilir. Bomba/sarmasik/tozsuz/acilis/nefes dilimine uygulanmaz.
      // DAG_Y olcumle (adalet Bot B, isik 0 + T_MIN gecikme; 40 tohum): 3'te 0 hasar, 4'te 2, 10'da onlarca. Isik 0'da toz yolu
      // T_MIN gecikmeli oyuncunun sonraki bosluga dair tek erken bilgisidir; y sapmasi bu kanali bozmayacak kadar kucuk tutulur.
      DAG_Y: 3, DAG_X: 0.35, DAG_ATLA: 0.25,
      // Dusen toz bilgi boslugu birakmaz: ardisik iki toz dusmez ve kalan komsu noktalar (onceki dilim arkasi a, tozlar)
      // arasi (asil x'lerle) yayin (b - a) en cok DAG_BOSLUK'u olur (olcum: sinirsiz dusmede isik 0 Bot B %1,5 tohumda carpar).
      DAG_BOSLUK: 0.34,
      // Isik (toz/kivilcim) dogumda her engel zarfindan (salinan: supurulen zarf) en az bu kadar uzak (B.1): R_CARPMA + R_TOPLA.
      ISIK_MARJ: 5.8
    },
    isik: { BASLANGIC: 1, TOZ: 0.035, KIVILCIM: 0.25, HASAR: 0.34, AG_HASAR: 0.17, DOKUNULMAZ: 1.0,
            DAL_HASAR: 0.50, BOMBA_HASAR: 0.25, SARMASIK_HASAR: 0.20 },   // HASAR: kus ve dusen dal (11.4)
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
  var TURLER = ['dal', 'ag', 'kus', 'dusen', 'salinan'];

  // ---------------------------------------------------------------
  // Degismezler (3.3, 3.4). Bos dizi = gecerli.
  // ---------------------------------------------------------------
  function ayarDogrula(a) {
    var h = [], d = a.dunya, m = a.hareket, ad = a.adalet, u = a.uretici, z = a.zorluk, p = a.puan, i = a.isik;
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
    var dcTozsuz = bMin / 2 - m.R_CARPMA - ad.PAY_KACIS;     // tozsuz dilimde merkez farki siniri (11.6)
    if (!(dcTozsuz > 0 && (u.SERIT_UST + z.BOSLUK_TABAN / 2) - u.MERKEZ_MIN <= dcTozsuz && u.MERKEZ_MAX - (u.SERIT_ALT - z.BOSLUK_TABAN / 2) <= dcTozsuz))
      h.push('tozsuz dilimde serit yedegine ulasilamiyor');
    if (!(m.R_KIVILCIM_GORSEL / m.R_TOZ_GORSEL >= 1.8)) h.push('kivilcim/toz cizim orani < 1,8');
    if (!(ad.SIS.length === p.BOLGE_SAYI && u.AGIRLIK.length === p.BOLGE_SAYI)) h.push('bolge sayisi tutarsiz');
    u.AGIRLIK.forEach(function (r, i) {
      if (r.length !== 4 || !(r[0] + r[1] + r[2] + r[3] > 0)) h.push('AGIRLIK[' + i + '] gecersiz');
    });
    if (!(u.TOZ_MIN >= 1 && u.TOZ_MAX >= u.TOZ_MIN)) h.push('toz sayisi gecersiz');
    // nefes: iki aralik (her biri >= tAra) eksi onceki dilimin en genis engeli
    var enGenis = Math.max(u.DAL_GEN, u.AG_GEN, u.KUS_GEN, u.DUSEN_GEN, z.SAL_GEN);
    if (!(2 * taMin - enGenis / z.HIZ_TABAN >= u.NEFES_SURE)) h.push('nefes engelsiz suresi < NEFES_SURE');
    // kural 3: durustan V_GUVENLI'ye cikis T_IVME icinde sigmali; zayif yon, rampa dahil gercek butunleme (11.1)
    var tCikis = benzet(m, d.DT, 0, 0, ad.V_GUVENLI);
    if (!(tCikis <= ad.T_IVME)) h.push('V_GUVENLI T_IVME icinde kazanilamiyor (rampa dahil ' + tCikis.toFixed(4) + ' sn)');
    if (!(m.T_RAMPA > 0)) h.push('T_RAMPA <= 0');
    if (!(m.R_CARPMA <= m.R_GORSEL)) h.push('R_GORSEL < R_CARPMA');
    // toplama (11.2, 12.1): duvara degen bocek (tavanda sersemlemenin basladigi an, zeminde uyanma korumasi
    // icinde kistirilmis) en yakin tozu (merkez siniri - sapma) miknatisla cekemez, kivilcimi toplayamaz;
    // duvara yaslanmak toz/kivilcim getirmez. (Eski AFK varsayimi: tavanda/zeminde beklemek artik mumkun degil.)
    if (!(m.R_TOPLA <= m.R_MIKNATIS)) h.push('R_TOPLA > R_MIKNATIS');
    if (!(m.R_MIKNATIS < u.MERKEZ_MIN - u.TOZ_SAPMA - d.Y_UST && m.R_MIKNATIS < d.Y_ALT - (u.MERKEZ_MAX + u.TOZ_SAPMA)))
      h.push('miknatis duvara (tavan/zemin) degen bocege tozu cekebilir');
    if (!(m.MIKNATIS_HIZ > 0)) h.push('MIKNATIS_HIZ <= 0');
    if (!(u.KIVILCIM_Y_MIN - d.Y_UST > m.R_TOPLA && d.Y_ALT - u.KIVILCIM_Y_MAX > m.R_TOPLA)) h.push('duvara (tavan/zemin) degen bocek kivilcim toplayabilir');
    // tavan sersemlemesi ve zemin olumu (12.1)
    var yUyan = d.Y_ALT - m.SERSEM_UYANMA_ORAN * (d.Y_ALT - d.Y_UST);
    if (!(m.SERSEM_SURE > 0 && m.SERSEM_SURE <= i.DOKUNULMAZ)) h.push('SERSEM_SURE (0, DOKUNULMAZ] disinda (sersemken en cok bir hasar)');
    if (!(m.SERSEM_UYANMA_ORAN > 0 && m.SERSEM_UYANMA_ORAN < 1 && yUyan > d.Y_UST && yUyan < d.Y_ALT)) h.push('uyanma yuksekligi (Y_UST, Y_ALT) disinda');
    if (!(yUyan >= u.MERKEZ_MIN && yUyan <= u.MERKEZ_MAX)) h.push('uyanma yuksekligi bosluk merkezi araliginda degil');
    if (!(yUyan + m.R_CARPMA < u.SERIT_ALT)) h.push('uyanma yuksekligi zemin seridinde');
    if (!(m.ZEMIN_KORUMA > 0 && m.ZEMIN_KORUMA <= 1)) h.push('ZEMIN_KORUMA (0, 1] disinda');
    // uyanan (durgun) bocek T_MIN gecikmeyle tepki verse de zemine degmez: koruma yalniz ek pay
    var dUyan = uyanmaDususu(m, d.DT, ad.T_MIN);
    if (!(yUyan + dUyan < d.Y_ALT)) h.push('uyaninca T_MIN gecikmeli oyuncu zemine degiyor (' + (yUyan + dUyan).toFixed(2) + ')');
    // tam hizla zemine yakin kivilcima giden bocek fren payiyla zemine degmez
    if (!(d.Y_ALT - u.KIVILCIM_Y_MAX > frenMesafesi(m, d.DT, 1))) h.push('zemine yakin kivilcim frenle zemine degdirir');
    // esikler (11.8): baslangic puanlari ayri ve sirali; cakisma serbestligi hepsinden sonra
    if (!(u.TOZSUZ_PUAN < u.BOMBA_PUAN && u.BOMBA_PUAN < u.SARMASIK_PUAN && u.SARMASIK_PUAN < u.CAKISMA_SERBEST)) h.push('esik puanlari ayri/sirali degil');
    if (!(u.CAKISMA_ARA >= 1)) h.push('CAKISMA_ARA < 1');
    // tozsuz (11.6)
    if (!(u.TOZSUZ_MIN >= 1 && u.TOZSUZ_MAX >= u.TOZSUZ_MIN && u.TOZSUZ_ARA >= 1)) h.push('tozsuz pencere uzunlugu/araligi gecersiz');
    if (!(u.TOZSUZ_OLASILIK > 0 && u.TOZSUZ_OLASILIK <= u.TOZSUZ_TAVAN && u.TOZSUZ_TAVAN < 1)) h.push('tozsuz olasiligi gecersiz');
    // sarmasik (11.7)
    if (!(u.SARMASIK_UYARI >= ad.T_MIN)) h.push('sarmasik uyarisi < T_MIN');
    if (!(u.SARMASIK_UYARI + u.SARMASIK_BUYUME <= u.SARMASIK_ONCE)) h.push('sarmasik zaman cizgisi: uyari + buyume > once');
    // en kotu baslangic: ters tam ivme (zayif yon), O1
    var ayTers = -Math.min(m.A_YUKSEL, m.G_SUZUL);
    var kSa = benzet(m, d.DT, u.SARMASIK_TASMA + m.R_CARPMA + ad.PAY_KACIS, 0, undefined, ayTers);
    if (!(ad.T_MIN + ad.T_IVME + kSa + ad.PAY_KACIS_SN + d.DT <= u.SARMASIK_ONCE))   // +DT: uyari->varis suresi bir adim kisa olabilir
      h.push("sarmasik kacis degismezi: T_MIN + T_IVME + kacis(" + kSa.toFixed(4) + ") + PAY_KACIS_SN + DT > SARMASIK_ONCE");
    if (!(u.SARMASIK_ONCE * z.HIZ_TAVAN <= u.UFUK)) h.push('sarmasik uyarisi uretim ufkunun otesinde');
    // ufuk: en genis gorunur alanin sag kenari + en genis engel (dilimin tum nesneleri onceki dilimin x'inin otesinde)
    if (!(u.UFUK >= d.H * d.ORAN_MAX - d.X_BOCEK + enGenis)) h.push('uretim ufku en genis gorunur alanin icinde');
    if (!(d.ORAN_MAX * d.H >= d.W)) h.push('ORAN_MAX * H < W');
    if (!(u.ESIK_UFUK > 0 && u.ESIK_UFUK <= u.UFUK)) h.push('ESIK_UFUK (0, UFUK] disinda');
    if (!(u.ESIK_TOZ_TAVAN >= 0)) h.push('ESIK_TOZ_TAVAN < 0');
    if (!(z.HIZ_TABAN * (u.SARMASIK_ONCE - u.SARMASIK_UYARI) + m.R_CARPMA + u.SARMASIK_GEN / 2 > m.R_MIKNATIS))
      h.push('sarmasik sutun tozu buyumeden once miknatisla cekilir');
    if (!(u.SARMASIK_SUTUN_MIN >= 1 && u.SARMASIK_SUTUN_MAX >= u.SARMASIK_SUTUN_MIN && u.SARMASIK_SUTUN_MAX + 2 <= u.TOZ_MAX))
      h.push('sarmasik sutun sayisi ic toz sayisini asiyor');
    // bomba (11.5): taban hizda, ekrana girdikten T_MIN sonra durustan kacilabilmeli (yoksa hic konamaz)
    var kBo = benzet(m, d.DT, m.R_BOMBA + m.R_CARPMA + ad.PAY_KACIS, 0, undefined, ayTers);
    if (!(ad.T_MIN + kBo + ad.PAY_KACIS_SN <= (d.W - d.X_BOCEK - m.R_BOMBA - m.R_CARPMA) / z.HIZ_TABAN)) h.push('bomba taban hizda kacilamiyor');
    // 13: HIZ_TAVAN'da da bomba yerlesebilmeli (gorunurluk on isaretten: BOMBA_ON_ISARET birim once). Uretecin olcutu
    // (ikiYonUygun, f <= g dali): ivme izgarasinin (9 nokta, [-A, +A]) her ay'i icin asagi yanin ay ile ve yukari yanin -ay ile
    // T sn'de aldigi yollarin toplami >= 2 * (R_BOMBA + R_CARPMA + PAY_KACIS); oyuncu bombanin y'sinde, dikey hiz 0.
    // T = (W - X_BOCEK + ON - R_BOMBA - R_CARPMA) / HIZ_TAVAN - T_MIN - PAY_KACIS_SN. Hiz siniri yuzunden toplam ay != 0'da
    // ay = 0'dakinden kucuk olabilir (yalniz ay = 0 denetimi yetmez). Gerekli kosul: hic yerlesmeyecek ayari yakalar.
    var Ab = Math.min(m.A_YUKSEL, m.G_SUZUL), Vb = Math.min(m.VY_YUKARI, m.VY_ASAGI), kb = 1 - Math.exp(-d.DT / m.T_RAMPA);
    var Tb = (d.W - d.X_BOCEK + u.BOMBA_ON_ISARET - m.R_BOMBA - m.R_CARPMA) / z.HIZ_TAVAN - ad.T_MIN - ad.PAY_KACIS_SN;
    var yolB = function (ay0) {                       // kacisMesafesi'nin aynisi, bu ayarla (vy hala tehlikeye dogruysa -Infinity)
      var ay = ay0, vy = 0, y = 0, n = Math.floor(Tb / d.DT + 1e-9);
      for (; n > 0; n--) { ay += (Ab - ay) * kb; vy += ay * d.DT; if (vy > Vb) vy = Vb; y += vy * d.DT; }
      return vy >= 0 ? y : -Infinity;
    };
    var jb, enAzB = Infinity;
    for (jb = -4; jb <= 4; jb++) enAzB = Math.min(enAzB, yolB(Ab * jb / 4) + yolB(-Ab * jb / 4));
    if (!(u.BOMBA_ON_ISARET >= 0 && Tb > 0 && enAzB >= 2 * (m.R_BOMBA + m.R_CARPMA + ad.PAY_KACIS)))
      h.push('bomba HIZ_TAVAN hizinda on isaretle bile kacilamiyor');
    if (!(ad.PAY_KACIS >= 0 && ad.PAY_KACIS_SN >= 0)) h.push('kacis paylari negatif');
    if (!(m.MIKNATIS_HIZ < z.HIZ_TABAN)) h.push('MIKNATIS_HIZ >= HIZ_TABAN (geride kalan toz bocegi kovalar)');
    // hasarlar (0, 1], olasiliklar [0, 1]
    [['HASAR', i.HASAR], ['AG_HASAR', i.AG_HASAR], ['DAL_HASAR', i.DAL_HASAR], ['BOMBA_HASAR', i.BOMBA_HASAR], ['SARMASIK_HASAR', i.SARMASIK_HASAR]]
      .forEach(function (q) { if (!(q[1] > 0 && q[1] <= 1)) h.push(q[0] + ' (0, 1] disinda'); });
    ['KIVILCIM_OLASILIK', 'BOMBA_OLASILIK', 'SARMASIK_OLASILIK', 'TOZSUZ_OLASILIK', 'TOZSUZ_ARTIS', 'TOZSUZ_TAVAN', 'EK_DAL', 'YAN_ALT', 'DAL_IKI', 'DAL_UST']
      .forEach(function (q) { if (!(u[q] >= 0 && u[q] <= 1)) h.push(q + ' [0, 1] disinda'); });
    // tozsuz isik ekonomisi: en uzun pencere x en uzun aralik x en buyuk sizinti (13: rampa terimi dahil, tavanla)
    var sizEnCok = Math.min(z.SIZINTI_TAVAN, z.SIZINTI_TABAN + z.SIZINTI_Z + z.SIZINTI_EK);
    if (!(u.TOZSUZ_MAX * z.TARA_TABAN * sizEnCok < u.TOZSUZ_ISIK_MAX)) h.push('tozsuz pencerede isik kaybi TOZSUZ_ISIK_MAX ustunde');
    // tozsuz tutma araligi (11.6): siradan dilimin araligi (merkez .. yayin son tozu) en cok TOZ_SAPMA + kosinus
    // egrisinin son tozdaki acigi (en az tozda en buyuk) kadardir; tozsuz bandina (bMin/2 - R_CARPMA - PAY) sigmali,
    // yoksa tozsuz dilim icin merkez bulunamaz (pencere kisalirdi).
    var dcEnCok = Math.max(ad.V_GUVENLI * (z.TARA_TABAN - ad.T_MIN - ad.T_IVME), u.ACILIS_FARK);
    var acik = dcEnCok * (1 + Math.cos(Math.PI * u.TOZ_MIN / (u.TOZ_MIN + 1))) / 2;
    if (!(u.TOZ_SAPMA + acik <= dcTozsuz)) h.push('tutma araligi tozsuz bandini asiyor (' + (u.TOZ_SAPMA + acik).toFixed(2) + ' > ' + dcTozsuz.toFixed(2) + ')');
    // tozsuz yedek dal: tutma araliginin ucu (en uc toz) bandla serit sinirinin icinde kalmali (acik pay)
    var icPay = m.R_CARPMA + ad.PAY_KACIS;
    if (!(u.MERKEZ_MAX + u.TOZ_SAPMA <= u.SERIT_ALT - icPay && u.MERKEZ_MIN - u.TOZ_SAPMA >= u.SERIT_UST + icPay))
      h.push('tozsuz yedek dal tutma araligina sigmiyor');
    // ---- FAZ B (tasarim 13): kademe, rampa, salinan, duzensiz isik
    var K = z.KADEME;
    if (!(Array.isArray(K) && K.length === 5 && K[0] === 0 && K.every(function (v, i) { return i === 0 || v > K[i - 1]; })))
      h.push('KADEME 5 artan esik degil (ilk 0)');
    if (!(z.HIZ_EK >= 0 && z.SIZINTI_EK >= 0 && z.RAMPA_SON > K[1])) h.push('rampa ayarlari gecersiz');
    if (!(z.SIZINTI_TAVAN >= z.SIZINTI_TABAN)) h.push('SIZINTI_TAVAN < SIZINTI_TABAN');
    if (!(z.SAL_GEN > 0 && z.SAL_BOY_MIN > 0 && z.SAL_BOY_MAX >= z.SAL_BOY_MIN && z.SAL_KENAR >= 0)) h.push('salinan geometrisi gecersiz');
    if (!(z.SAL_GENLIK.length === 2 && z.SAL_GENLIK[0] > 0 && z.SAL_GENLIK[1] >= z.SAL_GENLIK[0] &&
          z.SAL_PERIYOT.length === 2 && z.SAL_PERIYOT[0] > 0 && z.SAL_PERIYOT[1] > 0)) h.push('salinan genlik/periyot gecersiz');
    // salinan bocekten hizli dikey hareket etmez (tepe hiz 2 * pi * genlik / periyot, her iki uc; genlik ve periyot uclar arasinda monoton)
    [0, 1].forEach(function (i) { if (!(2 * Math.PI * z.SAL_GENLIK[i] / z.SAL_PERIYOT[i] < Math.min(m.VY_ASAGI, m.VY_YUKARI))) h.push('salinan tepe hizi >= bocek dikey hizi'); });
    if (!(z.SAL_AGIRLIK.length === 5 && z.SAL_AGIRLIK[0] === 0 && z.SAL_AGIRLIK[1] === 0 && z.SAL_AGIRLIK.every(function (v) { return v >= 0; })))
      h.push('SAL_AGIRLIK: kademe 1-2 sifir degil / negatif');
    if (!(z.DAG_Y >= 0 && z.DAG_X >= 0 && z.DAG_X < 0.5 && z.DAG_ATLA >= 0 && z.DAG_ATLA < 1 && z.DAG_BOSLUK > 0 && z.DAG_BOSLUK < 1)) h.push('duzensiz isik ayarlari gecersiz');
    // isik marji: bocek tozun ustunde (merkez) dururken engele degmemeli; siradan yay tozlari (araligin 1/(TOZ_MAX+1)'i
    // kadar araliklarla) marji uclarda saglamali (en kucuk aralik iki uctan biri; ara degerler adalet testinde olculur)
    var arMin = Math.min(z.HIZ_TABAN * z.TARA_TABAN, z.HIZ_TAVAN * taMin) - enGenis;
    if (!(z.ISIK_MARJ >= m.R_CARPMA && arMin / (u.TOZ_MAX + 1) >= z.ISIK_MARJ)) h.push('ISIK_MARJ < R_CARPMA ya da yay tozu marja sigmiyor');
    return h;
  }

  // Hareket benzetimi (kacis suresi): adim()'daki butunlemenin aynisi, ZAYIF yonde (min ivme, min hiz siniri)
  // tam girdiyle. Baslangic ay = ay0 (varsayilan 0), vy = v0 (kacis yonunde isaretli; negatif = tehlikeye dogru).
  // v0 <= 0 ya da ay0 >= 0 iken hiz bir kez >= 0 olunca hep >= 0 kalir (uretici yalniz bu durumlari kullanir).
  // vHedef verilirse: vy >= vHedef olan ilk an (cikis suresi). Verilmezse: yer degistirme >= dy olan ve hizin
  // kacis yonune donmus oldugu (vy >= 0; bundan sonra yer degistirme azalmaz) ilk an. Ulasilamazsa Infinity.
  function benzet(m, dt, dy, v0, vHedef, ay0) {
    var A = Math.min(m.A_YUKSEL, m.G_SUZUL), V = Math.min(m.VY_YUKARI, m.VY_ASAGI);
    var k = 1 - Math.exp(-dt / m.T_RAMPA), ay = ay0 || 0, vy = v0 || 0, y = 0, n;
    if (vHedef === undefined && vy >= 0 && ay >= 0 && dy <= 0) return 0;
    for (n = 1; n <= 1200; n++) {
      ay += (A - ay) * k; vy += ay * dt; if (vy > V) vy = V;
      y += vy * dt;
      if (vHedef !== undefined ? vy >= vHedef : (vy >= 0 && y >= dy)) return n * dt;
    }
    return Infinity;
  }
  // Fren mesafesi (12.1): duvara dogru tam hizla ve tam ivmeyle giden bocek ters tam girdiyle durana kadar
  // (rampa dahil, adim() butunlemesi) ne kadar daha ilerler. yon: 1 = zemine (asagi), -1 = tavana (yukari).
  function frenMesafesi(m, dt, yon) {
    var k = 1 - Math.exp(-dt / m.T_RAMPA), asagi = yon > 0, n, y = 0;
    var ay = asagi ? m.G_SUZUL : -m.A_YUKSEL, vy = asagi ? m.VY_ASAGI : -m.VY_YUKARI, hedef = asagi ? -m.A_YUKSEL : m.G_SUZUL;
    for (n = 0; n < 1200; n++) {
      ay += (hedef - ay) * k; vy += ay * dt;
      if (vy < -m.VY_YUKARI) vy = -m.VY_YUKARI; else if (vy > m.VY_ASAGI) vy = m.VY_ASAGI;
      if (asagi ? vy <= 0 : vy >= 0) break;
      y += vy * dt;
    }
    return Math.abs(y);
  }
  // Uyanma dususu (12.1): uyanma yuksekliginde durgun (vy = ay = 0) uyanan bocek tepki suresi boyunca birakili
  // kalir, sonra basar; zemine dogru en cok ne kadar iner.
  function uyanmaDususu(m, dt, tepki) {
    var k = 1 - Math.exp(-dt / m.T_RAMPA), ay = 0, vy = 0, y = 0, n, adim = Math.round(tepki / dt);
    for (n = 0; n < 2400; n++) {
      ay += ((n < adim ? m.G_SUZUL : -m.A_YUKSEL) - ay) * k; vy += ay * dt;
      if (vy < -m.VY_YUKARI) vy = -m.VY_YUKARI; else if (vy > m.VY_ASAGI) vy = m.VY_ASAGI;
      y += vy * dt;
      if (n >= adim && vy <= 0) break;
    }
    return y;
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
  // 13: hiz ve sizinti kademe 2'den rampayla artar (tavanli); kademe 1'de (mesafe <= KADEME[1]) deger eskisiyle bit bit ayni.
  // tAra / bosluk eski z egrisinde kalir: aralik (hiz * tAra) ve butun adalet sureleri saniye cinsinden olcektir.
  function rampa(mesafe) { return kistir((mesafe - Z.KADEME[1]) / (Z.RAMPA_SON - Z.KADEME[1]), 0, 1); }
  function zorluk(mesafe) {
    var z = 1 - Math.exp(-mesafe / Z.Z_OLCEK), r = rampa(mesafe);
    return {
      z: z,
      hiz: Math.min(Z.HIZ_TAVAN, Z.HIZ_TABAN + Z.HIZ_Z * z + Z.HIZ_LOG * Math.log2(1 + mesafe / Z.HIZ_LOG_OLCEK) + Z.HIZ_EK * r),
      tAra: Z.TARA_TABAN - Z.TARA_Z * z,
      bosluk: Z.BOSLUK_TABAN - Z.BOSLUK_Z * z,
      sizinti: Math.min(Z.SIZINTI_TAVAN, Z.SIZINTI_TABAN + Z.SIZINTI_Z * z + Z.SIZINTI_EK * r)
    };
  }
  // Kademe (13): 1..KADEME.length; mesafe >= KADEME[k - 1] olan en buyuk k. Ekranda "Bolge k".
  function kademeNo(mesafe) { var k = 1; while (k < Z.KADEME.length && mesafe >= Z.KADEME[k]) k++; return k; }
  // Kademe icinde dogrusal ilerleme: kademe a basindan b basina 0 -> 1 (salinan genligi, duzensizlik)
  function kademeOran(mesafe, a, b) { return kistir((mesafe - Z.KADEME[a - 1]) / (Z.KADEME[b - 1] - Z.KADEME[a - 1]), 0, 1); }
  function minYaricap(hiz) { return (1 + AD.KUS_EK) * hiz * AD.T_MIN + AD.PAY_R; }
  function isikYaricapi(isik, hiz, bolge) {
    return Math.max(minYaricap(hiz), (AD.R_TABAN + (AD.R_TAVAN - AD.R_TABAN) * isik) * AD.SIS[bolge]);
  }
  function bolgeNo(puan) { return Math.floor(puan / P.BOLGE_PUAN) % P.BOLGE_SAYI; }
  function carpan(zincir) { return Math.min(P.CARPAN_TAVAN, 1 + P.CARPAN_ARTIS * Math.floor(zincir / P.ZINCIR_ADIM)); }
  function kistir(v, a, b) { return v < a ? a : (v > b ? b : v); }
  var RAMPA_K = 1 - Math.exp(-D.DT / M.T_RAMPA), AY_TERS = -Math.min(M.A_YUKSEL, M.G_SUZUL);
  // Kacis suresi (11.1, 11.5, 11.7): zayif yonde, rampa ve hiz siniri dahil, vy = v0 / ay = 0'dan dy yer degistirme.
  function kacisSuresi(dy, v0, ay0) { return benzet(M, D.DT, dy, v0, undefined, ay0); }
  // Ayni benzetimle t sn'de alinan yol (adim sayisi floor(t / DT)); hiz o an hala tehlikeye dogruysa -Infinity.
  function kacisMesafesi(t, v0, ay0) {
    if (!(t >= 0)) return -Infinity;
    var A = Math.min(M.A_YUKSEL, M.G_SUZUL), V = Math.min(M.VY_YUKARI, M.VY_ASAGI);
    var ay = ay0 || 0, vy = v0 || 0, y = 0, n = Math.floor(t / D.DT + 1e-9);
    for (; n > 0; n--) { ay += (A - ay) * RAMPA_K; vy += ay * D.DT; if (vy > V) vy = V; y += vy * D.DT; }
    return vy >= 0 ? y : -Infinity;
  }
  function cikisSuresi(v) { return benzet(M, D.DT, 0, 0, v); }
  // Tavan sersemlemesi / zemin olumu (12.1). Kacis seviyeleri duvara fren payi kadar yakin olamaz: tam hizla
  // varan oyuncu durana kadar tavana (sersemler) ya da zemine (olur) degmesin.
  var Y_UYAN = D.Y_ALT - M.SERSEM_UYANMA_ORAN * (D.Y_ALT - D.Y_UST);
  var FREN_UST = frenMesafesi(M, D.DT, -1), FREN_ALT = frenMesafesi(M, D.DT, 1);

  // Ikinci sans (reklam, docs/gorev-reklam.md 1.4). AYAR gruplarina katilmaz (AYAR 3.8 gruplari sabit); ayni sekilde donuk.
  // Yukseklik bandi zemin tarafinda uyanma yuksekligiyle ayni (durgun bocek T_MIN gecikmeyle de zemine degmez,
  // ayarDogrula 'uyaninca' degismezi), tavan tarafinda ona simetrik.
  var IKINCI_SANS = dondur({
    ISIK: 0.5,                          // isik en az bu orana dolar (zemin olumunde fazlasi korunur)
    GERI_SAYIM: 3,                      // sn: dunya donuk (adim yok), sonra devam; sayaci arayuz tutar
    TEMIZ_SN: 2,                        // bocegin onunde bu kadar saniyede bocege varacak dilimlerin tehlikeleri silinir
    Y_MIN: D.Y_UST + (D.Y_ALT - Y_UYAN), Y_MAX: Y_UYAN
  });
  (function () {
    var S = IKINCI_SANS, h = [], enGenis = Math.max(U.DAL_GEN, U.AG_GEN, U.KUS_GEN, U.DUSEN_GEN, Z.SAL_GEN);
    if (!(S.ISIK > 0 && S.ISIK <= 1)) h.push('ISIK (0, 1] disinda');
    if (!(S.GERI_SAYIM >= 2 && S.GERI_SAYIM <= 3)) h.push('GERI_SAYIM 2-3 sn disinda');
    if (!(S.Y_MIN < S.Y_MAX && S.Y_MIN > D.Y_UST + FREN_UST)) h.push('Y_MIN tavana fren payindan yakin');
    if (!(S.Y_MAX + uyanmaDususu(M, D.DT, AD.T_MIN) < D.Y_ALT)) h.push('Y_MAX: T_MIN gecikmeli oyuncu zemine degiyor');
    if (!(S.TEMIZ_SN > AD.T_MIN + AD.T_IVME)) h.push('TEMIZ_SN <= T_MIN + T_IVME');
    // ilk kalan dilimin bosluk merkezi [MERKEZ_MIN, MERKEZ_MAX]; banda kistirilinca kalan fark kural 3 hiziyla kapanmali
    if (!(Math.max(S.Y_MIN - U.MERKEZ_MIN, U.MERKEZ_MAX - S.Y_MAX, 0) <= AD.V_GUVENLI * (S.TEMIZ_SN - AD.T_MIN - AD.T_IVME)))
      h.push('kistirilan dogma yuksekligi bosluga yetismiyor');
    if (!(Z.HIZ_TAVAN * S.TEMIZ_SN + enGenis < U.UFUK)) h.push('temizlik uretim ufkunun otesinde (ilk kalan dilim yok)');
    // 13: salinan temizligi TEMIZ_SN + tAra'ya kadar (en buyuk tAra ile) ufuk icinde
    if (!(Z.HIZ_TAVAN * (S.TEMIZ_SN + Z.TARA_TABAN) + enGenis < U.UFUK)) h.push('salinan temizligi uretim ufkunun otesinde');
    if (h.length) throw new Error('AtesBocegi.IKINCI_SANS gecersiz: ' + h.join('; '));
  })();

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
  function adayKur(tur, x, ust, alt, r, kd) {
    var e, asagi, ustOk, altOk, q;
    if (tur === 'dal') {
      q = r();
      return dalKur(x, ust, alt, q < U.DAL_IKI + U.DAL_UST, q < U.DAL_IKI || q >= U.DAL_IKI + U.DAL_UST);
    }
    if (tur === 'ag') {
      var boy = U.AG_BOY_MIN + r() * (U.AG_BOY_MAX - U.AG_BOY_MIN);
      altOk = alt + boy <= D.H - U.AG_KENAR; ustOk = ust - boy >= U.AG_KENAR;
      if (!altOk && !ustOk) return null;
      asagi = altOk && (!ustOk || r() < U.YAN_ALT);   // ag boslugun altinda mi
      e = [{ tur: 'ag', x: x, y: asagi ? alt : ust - boy, w: U.AG_GEN, h: boy }];
      if (r() < U.EK_DAL) e = e.concat(dalKur(x, ust, alt, asagi, !asagi));
      return e;
    }
    if (tur === 'kus') {
      var pay = r() * U.KUS_PAY;
      altOk = alt + pay + U.KUS_BOY <= D.H; ustOk = ust - pay - U.KUS_BOY >= 0;
      if (!altOk && !ustOk) return null;
      asagi = altOk && (!ustOk || r() < U.YAN_ALT);
      // Kus, dilimin sabit engelleriyle ayni anda bocegin onune (X_BOCEK + R_CARPMA) degecek
      // sekilde konur: dunya x'i = x0 - KUS_EK * mesafe (yaklasma hizi (1 + KUS_EK) * hiz).
      var x0 = x + AD.KUS_EK * (x - D.X_BOCEK - M.R_CARPMA);
      e = [{ tur: 'kus', x: x0, x0: x0, ek: AD.KUS_EK, y: asagi ? alt + pay : ust - pay - U.KUS_BOY, w: U.KUS_GEN, h: U.KUS_BOY }];
      if (r() < U.EK_DAL) e = e.concat(dalKur(x, ust, alt, asagi, !asagi));
      return e;
    }
    if (tur === 'salinan') {
      // 13: ipe asili orumcek, boslugun bir yaninda. Govde (carpma kutusu) y = yc + gen * sin(om * t + faz) ile salinir;
      // supurulen zarf [yc - gen, yc + gen + h]: ust yanda alt ucu tam ust'e, alt yanda ust ucu tam alt'a deger (bosluga girmez).
      // kd = {gen, om}: dilimin kademe ilerlemesiyle (uret). Duvara SAL_KENAR'dan yakin olmaz.
      var sboy = Z.SAL_BOY_MIN + r() * (Z.SAL_BOY_MAX - Z.SAL_BOY_MIN), A2 = 2 * kd.gen;
      altOk = alt + sboy + A2 <= D.H - Z.SAL_KENAR; ustOk = ust - sboy - A2 >= Z.SAL_KENAR;
      if (!altOk && !ustOk) return null;
      asagi = altOk && (!ustOk || r() < U.YAN_ALT);
      var yc = asagi ? alt + kd.gen : ust - sboy - kd.gen, fz = r() * 2 * Math.PI;
      e = [{ tur: 'salinan', yon: asagi ? 'alt' : 'ust', x: x, y: yc + kd.gen * Math.sin(fz), w: Z.SAL_GEN, h: sboy,
             yc: yc, gen: kd.gen, om: kd.om, faz: fz }];
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
  // satir: 4 (biyom) ya da 5 (kademe 3+: + salinan) agirlik. 4 elemanli satirda sonuc ve rng tuketimi eskisiyle ayni.
  function agirlikli(r, satir) {
    var L = satir.length, top = 0, v, i;
    for (i = 0; i < L; i++) top += satir[i];
    v = r() * top;
    for (i = 0; i < L - 1; i++) { v -= satir[i]; if (v < 0) return TURLER[i]; }
    for (i = L - 1; i > 0 && !satir[i]; i--);
    return TURLER[i];
  }

  function yolY(c1, c2, f) { return c1 + (c2 - c1) * (1 - Math.cos(Math.PI * f)) / 2; }
  // Kacis (11.5, 11.7, 11.9). k = {a, b, c1, c2, g2, hiz, tA, tU}: onceki dilimin arkasi, bu dilimin onu, iki
  // bosluk merkezi, bu dilimin boslugu, hiz (bu dilimin hizi: aradaki her noktadan buyuk -> sureler kotumser),
  // oyuncunun onceki dilimi gecerken bulunabilecegi tutma araligi [tA, tU] (bkz. uret).
  // Oyuncu toz yolunu izler; tehlikeyi bocek x = xGor'dayken gorur, T_MIN sonra tepki verir; onceki dilimin
  // zarfindan (a + R_CARPMA) once ayrilmaz (isik tabaninda o dilimin bandi, ornegin asili dusen dal, gorunmeyebilir).
  // Tepki anindaki olasi durumlar: yukseklik [yA, yU] (yol +- TOZ_SAPMA ile tutma araliginin birlesimi), ivme
  // [-A, +A] (A = min(A_YUKSEL, G_SUZUL), zayif yon), dikey hiz 0 ya da yolun aleyhte hizi; sureye PAY_KACIS_SN eklenir.
  // hedefler: [{x: bocek merkezinin ulasacagi x, y: o x'te gereken seviye}]. Sonra en uc seviyeden (tutulur) xArka'dan
  // itibaren sonraki boslugun serbest bandina kural 3 hiziyla baglanmali (durup donmek icin 2 * T_IVME).
  // kacisGeo: s yaninin geometrisi ve donus denetimi; null = bu yan hic uygun degil.
  function kacisGeo(k, s, xGor, hedefler, xArka) {
    var uc = -Infinity, i, ic = M.R_CARPMA + AD.PAY_KACIS;
    for (i = 0; i < hedefler.length; i++) if (s * hedefler[i].y > uc) uc = s * hedefler[i].y;
    var Y = s * uc, sonX = k.b - M.R_CARPMA;
    if (Y < D.Y_UST + FREN_UST || Y > D.Y_ALT - FREN_ALT || xArka > sonX) return null;
    var lo = k.c2 - k.g2 / 2 + ic, hi = k.c2 + k.g2 / 2 - ic, mes = Math.max(0, lo - Y, Y - hi);
    if (mes > 0 && mes > AD.V_GUVENLI * ((sonX - xArka) / k.hiz - 2 * AD.T_IVME)) return null;
    var uz = k.b - k.a, xe = Math.max(xGor + k.hiz * AD.T_MIN, k.a + M.R_CARPMA);
    var f = kistir((xe - k.a) / uz, 0, 1), yy = yolY(k.c1, k.c2, f);
    return { s: s, Y: Y, xe: xe, hed: hedefler, vYol: (k.c2 - k.c1) * Math.PI / 2 * Math.sin(Math.PI * f) / uz * k.hiz,
             yA: Math.min(yy - U.TOZ_SAPMA, k.tA), yU: Math.max(yy + U.TOZ_SAPMA, k.tU) };
  }
  // s yanindan her hedefe yetisilebilen baslangic yuksekligi siniri (asagi yan: y >= sinir, yukari: y <= sinir).
  // ay0: kacis yonunde isaretli baslangic ivmesi; hiz yolun aleyhte hizi (lehteyse 0).
  function kacisSiniri(k, g, ay0) {
    var v0 = Math.min(0, g.s * g.vYol), sin = -g.s * Infinity, i, hd, b;
    for (i = 0; i < g.hed.length; i++) {
      hd = g.hed[i];
      if (!(hd.x > g.xe)) return g.s * Infinity;
      b = hd.y - g.s * kacisMesafesi((hd.x - g.xe) / k.hiz - AD.PAY_KACIS_SN, v0, ay0);
      sin = g.s > 0 ? Math.max(sin, b) : Math.min(sin, b);
    }
    return sin;
  }
  // Tek yonlu kacis (sarmasik): en kotu durum = tehlikeye en yakin yukseklik + ters tam ivme. Donus: Y ya da null.
  function kacisUygun(k, s, xGor, hedefler, xArka) {
    var g = kacisGeo(k, s, xGor, hedefler, xArka);
    if (!g) return null;
    var sin = kacisSiniri(k, g, AY_TERS);
    return (s > 0 ? g.yA >= sin : g.yU <= sin) ? g.Y : null;
  }
  // Iki yonlu kacis (bomba): her olasi durum (y, ay) icin en az bir yan yetismeli; oyuncu yanini kendi durumuna
  // gore secer. Sabit ay'da asagi yan y >= f, yukari yan y <= g'de yetisir: [yA, yU] kapsanir <=> f <= g ya da
  // yA >= f ya da yU <= g. ay [-A, +A] araliginda 9 noktada denenir. Donus: [Y_asagi, Y_yukari] ya da null.
  function ikiYonUygun(k, xGor, hedAsagi, hedYukari, xArka) {
    var ga = kacisGeo(k, 1, xGor, hedAsagi, xArka), gy = ga && kacisGeo(k, -1, xGor, hedYukari, xArka), j, ay, f, g;
    if (!gy) return null;
    var yA = Math.min(ga.yA, gy.yA), yU = Math.max(ga.yU, gy.yU);
    for (j = -4; j <= 4; j++) {
      ay = -AY_TERS * j / 4;                       // asagi pozitif
      f = kacisSiniri(k, ga, ay); g = kacisSiniri(k, gy, -ay);
      if (!(f <= g || yA >= f || yU <= g)) return null;
    }
    return [ga.Y, gy.Y];
  }
  // Sarmasik: toz[i0 .. i0+say-1] hizasinda sutunlar, ortalama yuksekligin yakin duvarindan; kacis uzak yana.
  function sarmasikDene(toz, i0, say, k) {
    var G = U.SARMASIK_GEN, sut = [], hed = [], ort = 0, i, t, tip;
    for (i = i0; i < i0 + say; i++) ort += toz[i].y;
    var ust = ort / say < D.H / 2, s = ust ? 1 : -1;
    for (i = i0; i < i0 + say; i++) {
      t = toz[i]; tip = t.y + s * U.SARMASIK_TASMA;
      sut.push(ust ? { x: t.x - G / 2, y: 0, w: G, h: tip, tx: t.x, ty: t.y }
                   : { x: t.x - G / 2, y: tip, w: G, h: D.H - tip, tx: t.x, ty: t.y });
      hed.push({ x: t.x - G / 2 - M.R_CARPMA, y: tip + s * (M.R_CARPMA + AD.PAY_KACIS) });
    }
    var x1 = sut[0].x, x2 = sut[say - 1].x + G;
    // gorunurluk: uyari basladigi an; uyari bocek x1'e (R_CARPMA payiyla) SARMASIK_ONCE sn kala baslar
    var Y = kacisUygun(k, s, x1 - M.R_CARPMA - k.hiz * U.SARMASIK_ONCE, hed, x2 + M.R_CARPMA);
    if (Y === null) return null;
    k.Y = [Y];
    return { yon: ust ? 'ust' : 'alt', x1: x1, x2: x2, sutunlar: sut, faz: 0, sure: 0, ilerleme: 0 };
  }
  function sarmasikSec(toz, k, r) {
    var say = Math.min(toz.length - 2, U.SARMASIK_SUTUN_MIN + Math.floor(r() * (U.SARMASIK_SUTUN_MAX - U.SARMASIK_SUTUN_MIN + 1)));
    var bas = r(), secenek, j, sa;
    for (; say >= U.SARMASIK_SUTUN_MIN; say--) {      // uymazsa daha az sutunla dene
      secenek = toz.length - 1 - say;
      for (j = 0; j < secenek; j++) { sa = sarmasikDene(toz, 1 + (Math.floor(bas * secenek) + j) % secenek, say, k); if (sa) return sa; }
    }
    return null;
  }
  // Bomba: bir ic tozun yerine; kendi isigiyla ekrana girdigi an gorunur. Her olasi oyuncu durumu icin en az bir
  // yana kacilabiliyorsa konur (ikiYonUygun). Bomba carpismasi R_BOMBA + R_CARPMA'dir (R_TOPLA degil).
  function bombaSec(toz, k, r) {
    var secenek = toz.length - 2, bas = Math.floor(r() * secenek), R = M.R_BOMBA + M.R_CARPMA, j, i, t, xGor, y1;
    for (j = 0; j < secenek; j++) {
      i = 1 + (bas + j) % secenek; t = toz[i]; xGor = t.x - (D.W - D.X_BOCEK) - U.BOMBA_ON_ISARET;   // 13: on isaretten
      y1 = ikiYonUygun(k, xGor, [{ x: t.x - R, y: t.y + R + AD.PAY_KACIS }], [{ x: t.x - R, y: t.y - R - AD.PAY_KACIS }], t.x + R);
      if (y1) {
        k.Y = y1;
        toz.splice(i, 1);
        return { x: t.x, y: t.y, alindi: 0 };
      }
    }
    return null;
  }

  // Duzensiz isik (13): yayin son tozu disindaki tozlar kayar / duser. Kinematik ulasilabilirlik (ulasimSiniri): tam bilgili
  // oyuncu onceki boslugun merkezinden (x = a + R_CARPMA'da durgun) tam girdiyle tozun R_TOPLA'sina varir ve oradan durup
  // donerek (2 * T_IVME) sonraki boslugun serbest bandina b - R_CARPMA'ya kadar varir. Kayan toz bu araliga, KIVILCIM_Y
  // bandina ve x'te [a + ISIK_MARJ, b - ISIK_MARJ]'a kistirilir; aralik bossa toz kaymaz. Son toz kaymaz (tutma araligi).
  function ulasimSiniri(x, k) {
    var tG = (x - k.a - M.R_CARPMA) / k.hiz, tC = (k.b - M.R_CARPMA - x) / k.hiz;
    var g1 = (tG > 0 ? Math.max(0, kacisMesafesi(tG, 0, 0)) : 0) + M.R_TOPLA;
    var g2 = (tC > 2 * AD.T_IVME ? Math.max(0, kacisMesafesi(tC - 2 * AD.T_IVME, 0, 0)) : 0) + M.R_TOPLA + (k.g2 / 2 - M.R_CARPMA - AD.PAY_KACIS);
    return { lo: Math.max(k.c1 - g1, k.c2 - g2, U.KIVILCIM_Y_MIN), hi: Math.min(k.c1 + g1, k.c2 + g2, U.KIVILCIM_Y_MAX) };
  }
  function dagit(toz, k, j, r) {
    var n = toz.length, ara = (k.b - k.a) / (n + 1), kalan = n, sonuc = [], once = k.a, dustu = false, i, t, q, dx, dy, x, y, u;
    for (i = 0; i < n - 1; i++) {
      t = toz[i]; q = r(); dx = (2 * r() - 1) * Z.DAG_X * j * ara; dy = (2 * r() - 1) * Z.DAG_Y * j;
      if (q < Z.DAG_ATLA * j && kalan > 2 && !dustu && toz[i + 1].x - once <= Z.DAG_BOSLUK * (k.b - k.a)) { kalan--; dustu = true; continue; }
      dustu = false; once = t.x;
      x = kistir(t.x + dx, k.a + Z.ISIK_MARJ, k.b - Z.ISIK_MARJ); u = ulasimSiniri(x, k);
      if (u.lo <= u.hi) { y = kistir(t.y + dy, u.lo, u.hi); t.x = x; t.y = y; }
      sonuc.push(t);
    }
    sonuc.push(toz[n - 1]);
    return sonuc;
  }

  // ur = uretici verisi (duz nesne). bolge: dilimin engel agirliklarini secer; degisirse once nefes dilimi gelir.
  // puan: tozsuz/bomba/sarmasik esikleri ve cakisma kurali (11.5-11.8); dilim dizisi bu yuzden puana da baglidir.
  function uret(ur, bolge, puan) {
    var r = function () { return rngAdim(ur); };
    bolge = bolge | 0; puan = +puan || 0;
    var x = ur.x + aralik(ur.x - D.X_BOCEK);
    var zr = zorluk(x - D.X_BOCEK), kd = kademeNo(x - D.X_BOCEK);   // 13: dilimin kademesi varis mesafesinden
    var kdOran = kademeOran(x - D.X_BOCEK, 3, 5), salK = {
      gen: Z.SAL_GENLIK[0] + (Z.SAL_GENLIK[1] - Z.SAL_GENLIK[0]) * kdOran,
      om: 2 * Math.PI / (Z.SAL_PERIYOT[0] + (Z.SAL_PERIYOT[1] - Z.SAL_PERIYOT[0]) * kdOran) };
    var satir = kd >= 3 ? U.AGIRLIK[bolge].concat([Z.SAL_AGIRLIK[kd - 1]]) : U.AGIRLIK[bolge];
    var maxDc = AD.V_GUVENLI * (zr.tAra - AD.T_MIN - AD.T_IVME);
    var nefes = ur.n >= U.ACILIS_DILIM && bolge !== ur.bolge, acilis = ur.n < U.ACILIS_DILIM;
    ur.bolge = bolge;
    // Tozsuz pencere (11.6): acilis/nefes disinda; bomba/sarmasik diliminin hemen ardindan baslamaz (kacis
    // donusu tutma araligini genisletir). Nefes pencereyi duraklatir (nefeste toz vardir).
    // Cakisma (11.8): son sarmasik CAKISMA_SERBEST altinda uretildiyse ona CAKISMA_ARA dilimden yakin baslamaz.
    var tozsuz = false;
    if (!acilis && !nefes) {
      if (ur.tzKalan > 0) { tozsuz = true; ur.tzKalan--; }
      else if (puan >= U.TOZSUZ_PUAN && !ur.tehlikeOnce && ur.n - ur.tzSon - 1 >= U.TOZSUZ_ARA &&
               (ur.saPuan >= U.CAKISMA_SERBEST || ur.n - ur.saNo >= U.CAKISMA_ARA) &&
               r() < Math.min(U.TOZSUZ_TAVAN, U.TOZSUZ_OLASILIK + U.TOZSUZ_ARTIS * Math.floor((puan - U.TOZSUZ_PUAN) / U.TOZSUZ_ADIM))) {
        tozsuz = true; ur.tzKalan = U.TOZSUZ_MIN + Math.floor(r() * (U.TOZSUZ_MAX - U.TOZSUZ_MIN + 1)) - 1;
      }
      if (tozsuz) ur.tzSon = ur.n;
    }
    // Tozsuz dilimde yolu gosteren toz yok: isik tabaninda T_MIN gecikmeli oyuncu boslugu varistan ancak
    // ~0,2 sn once ogrenir ve o ana kadar bildigi son noktada bekler. Bu nokta tutma araligindadir [tA, tU]:
    // onceki dilimin merkezi ile yayinin son tozu (dilimi goremeyen oyuncu, ornegin asili dusen dal), tehlike
    // donusu ve onceki tozsuz dilimlerin araligi. Tozsuz dilimin merkezi bu araligin tamami yeni boslugun
    // serbest bandinda (R_CARPMA + PAY_KACIS payiyla) kalacak sekilde secilir (kural 3'ten siki). ayarDogrula'daki
    // 'tutma araligi' degismezi bu araligin bos olmamasini (pencere hic kisalmaz), 'tozsuz yedek dal' degismezi
    // yedek dalin seritle birlikte aralikta kalmasini garanti eder.
    var mMin = U.MERKEZ_MIN, mMax = U.MERKEZ_MAX;
    if (tozsuz) {
      var lim = zr.bosluk / 2 - M.R_CARPMA - AD.PAY_KACIS;
      mMin = Math.max(mMin, ur.tU - lim, ur.c - maxDc); mMax = Math.min(mMax, ur.tA + lim, ur.c + maxDc);
    }
    var c, g = zr.bosluk, tur, e = null, k;
    if (ur.n < U.ACILIS_DILIM) {
      g = U.ACILIS_BOSLUK; tur = 'dal';
      // 13: acilis farki kural 3 sinirini (maxDc) asmaz; mesafe 0'da maxDc 21,2 > ACILIS_FARK (eskisiyle ayni), test kancasiyla
      // yuksek hizda baslayan kosuda (tAra 1,25: maxDc 8,2) kisilir
      c = kistir(ur.c + (2 * r() - 1) * Math.min(U.ACILIS_FARK, maxDc), U.SERIT_UST + g / 2, U.SERIT_ALT - g / 2);
      e = dalKur(x, c - g / 2, c + g / 2, true, true);
    } else if (nefes) {
      tur = 'nefes'; e = [];
      c = kistir(ur.c + (2 * r() - 1) * maxDc, U.MERKEZ_MIN, U.MERKEZ_MAX);
    } else {
      for (var deneme = 0; deneme < U.DENEME && !e; deneme++) {
        c = kistir(ur.c + (2 * r() - 1) * maxDc, mMin, mMax);
        tur = agirlikli(r, satir);
        e = adayKur(tur, x, c - g / 2, c + g / 2, r, salK);
        if (!e) continue;
        k = kapatir(e);                            // kural 5: 3 dilimdir kapanmayan serit simdi kapanmali
        if ((ur.ustSay >= U.SERIT_PENCERE - 1 && !k.ust) || (ur.altSay >= U.SERIT_PENCERE - 1 && !k.alt)) e = null;
      }
      if (!e) {                                    // yedek: iki yanli dal, iki seridi de kapatir
        tur = 'dal';
        c = kistir(ur.c, Math.max(mMin, U.SERIT_UST + g / 2, ur.c - maxDc), Math.min(mMax, U.SERIT_ALT - g / 2, ur.c + maxDc));
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
    // bomba/sarmasik yalniz siradan dilimde; ardisik iki tehlike dilimi yok (oncekinden donus hareketi
    // tepki aninda aleyhte hiz birakir, kacis modeli bunu varsaymaz)
    var ozel = !acilis && !nefes && !tozsuz && !ur.tehlikeOnce;
    var saAday = ozel && puan >= U.SARMASIK_PUAN && (puan >= U.CAKISMA_SERBEST || ur.n - ur.tzSon >= U.CAKISMA_ARA) &&
                 r() < U.SARMASIK_OLASILIK;
    if (saAday) n = U.TOZ_MAX;                   // sutunlar ic tozlarda; en cok toz = daha gec sutun secenegi (kacis suresi)
    for (i = 1; i <= n && !tozsuz; i++) {
      f = i / (n + 1);
      toz.push({ x: a + (b - a) * f, y: yolY(ur.c, c, f) + (2 * r() - 1) * U.TOZ_SAPMA, alindi: 0, yutuldu: 0 });
    }
    var gk = { a: a, b: b, c1: ur.c, c2: c, g2: g, hiz: zr.hiz, tA: ur.tA, tU: ur.tU, Y: [] }, sa = null, bomba = null;
    if (saAday) sa = sarmasikSec(toz, gk, r);
    if (sa) { ur.saNo = ur.n; ur.saPuan = puan; }
    if (ozel && !sa && puan >= U.BOMBA_PUAN && r() < U.BOMBA_OLASILIK) bomba = bombaSec(toz, gk, r);
    // Kivilcim (kural 7): aralik ortasinda, yoldan 10-16 uzakta. Uzaktan gorunur (T_MIN yok):
    // her bacak ayri ayri |ys - c1|, |c2 - ys| <= V_GUVENLI * tBacak; tBacak = onceki boslugu
    // terk etmekten (a + R_CARPMA) kivilcima / kivilcimdan sonraki boslugun onune (b - R_CARPMA)
    // gercek sure = ((b - a)/2 - R_CARPMA) / hiz (hiz artan: bu dilimin hizi en kotusu). 11.1 rampasiyla
    // bacaklardan T_IVME dusmek gerekmedi: Bot D (gecikmesiz) carpismasiz alma orani >= %95 kaliyor; T_IVME
    // dusulseydi yuksek hizda hic kivilcim konamazdi.
    // En buyuk bacak uz + |dc|/2 oldugu icin uz, [UZAK_MIN, min(UZAK_MAX, sinir - |dc|/2)] icinden cekilir.
    var kiv = null;
    if (r() < U.KIVILCIM_OLASILIK) {
      var ym = (ur.c + c) / 2, bacak = AD.V_GUVENLI * ((b - a) / 2 - M.R_CARPMA) / zr.hiz;
      var ust = Math.min(U.KIVILCIM_UZAK_MAX, bacak - Math.abs(c - ur.c) / 2);
      var uz = U.KIVILCIM_UZAK_MIN + r() * (ust - U.KIVILCIM_UZAK_MIN), yon = r() < U.YAN_ALT ? 1 : -1;
      var ys = ym + yon * uz;
      if (ys < U.KIVILCIM_Y_MIN || ys > U.KIVILCIM_Y_MAX) ys = ym - yon * uz;   // diger yan
      // tozsuz pencerede kivilcim yok; sarmasik/bomba dilimlerinde de yok (kacis yolu ile catismasin)
      if (ust >= U.KIVILCIM_UZAK_MIN && ys >= U.KIVILCIM_Y_MIN && ys <= U.KIVILCIM_Y_MAX && !tozsuz && !sa && !bomba)
        kiv = { x: (a + b) / 2, y: ys, alindi: 0 };
    }
    // Duzensiz isik (13, kademe 4+): siradan dilimde; son toz kaymaz. Rng yalniz j > 0 iken cekilir (kademe 1-3 aynen).
    var dag = kd >= 4 && !acilis && !nefes && !tozsuz && !sa && !bomba && toz.length >= 2 ? kademeOran(x - D.X_BOCEK, 4, 5) : 0;
    if (dag > 0) toz = dagit(toz, gk, dag, r);
    var dl = {
      no: ur.n, x: x, w: w, tur: tur, nefes: nefes ? 1 : 0, bolge: bolge,
      z: zr.z, hiz: zr.hiz, tAra: zr.tAra, bosluk: zr.bosluk,
      c: c, ust: c - g / 2, alt: c + g / 2,
      engeller: e, toz: toz, kivilcim: kiv,
      tozsuz: tozsuz ? 1 : 0, bomba: bomba, sarmasik: sa, puan: puan, kademe: kd, dag: dag
    };
    // Tutma araligi (sonraki dilim icin): merkez + yayin son tozu + tehlike donus seviyesi (bandla kistirilmis);
    // tozsuz dilimde oncekiyle birlesir (oyuncu bu dilimi gormemis olabilir).
    var tA = c, tU = c, ic = M.R_CARPMA + AD.PAY_KACIS, yy;
    if (tozsuz) { tA = Math.min(c, ur.tA); tU = Math.max(c, ur.tU); }
    else if (toz.length) { yy = toz[toz.length - 1].y; tA = Math.min(tA, yy); tU = Math.max(tU, yy); }
    for (i = 0; i < gk.Y.length; i++) { yy = kistir(gk.Y[i], c - g / 2 + ic, c + g / 2 - ic); tA = Math.min(tA, yy); tU = Math.max(tU, yy); }
    ur.n++; ur.x = x; ur.w = w; ur.c = c; ur.tA = tA; ur.tU = tU; ur.tehlikeOnce = sa || bomba ? 1 : 0;
    return dl;
  }
  // Uretici durumu duz veridir (rng durumu dahil sayi): durum JSON gidis-donusunden sonra aynen devam eder.
  function ureticiVerisi(tohum) {
    return { s: tohum >>> 0, n: 0, x: D.X_BOCEK, w: 0, c: D.Y_BASLA, bolge: 0, ustSay: 0, altSay: 0,
             tzKalan: 0, tzSon: -1000, saNo: -1000, saPuan: 0, tA: D.Y_BASLA, tU: D.Y_BASLA, tehlikeOnce: 0 };
  }
  function ureticiOlustur(tohum) {
    var v = ureticiVerisi(tohum);
    return { veri: v, sonraki: function (bolge, puan) { return uret(v, bolge, puan); } };
  }
  function dilimZarfi(dl) { return { ust: dl.ust, alt: dl.alt }; }

  // ---------------------------------------------------------------
  // OYUN
  // ---------------------------------------------------------------
  // Esik telafisi (bkz. U.UFUK): uretim ve agirlik bolgesi icin puan = o anki puan + dilimin ESIK_UFUK'a varmasina
  // kadarki (L birim) mesafe puani + ileri toz puani, en cok ESIK_TOZ_TAVAN.
  // Ileri toz puani: bocegin onundeki (bx, bx + L] araligindaki alinmamis, yutulmamis tozlar (bu dilimler
  // UFUK'a kadar zaten uretilmis): yeni dilim ESIK_UFUK'a varana dek bocek tam bunlarin yanindan gecer. Puan zincir
  // surerse verilecek olan: P.TOZ * carpan(zincir + k), k = 0..n-1. Gecmis hiz yerine ileriye bakar: tozsuz dilim ve
  // zincir kopmasi (hasarda zincir 0) tahmine hemen yansir; onceki ustel toz hizi zincir kopunca tahmini en yuksekte
  // kilitliyordu (denetim: ekran 50'de gercek puan - esik en kotu -39). Kivilcim sayilmaz (alinmayabilir).
  // Yalniz tamsayi toplama/carpma, karsilastirma ve en buyuk: her cihazda ayni sonuc, kare hizindan bagimsiz (sabit DT).
  // durum.esikPuan tahminin kosu boyunca en buyugudur (azalmaz): bolge/esik sinirinda ileri-geri gidip gelmez
  // (ornegin nefes dilimi olmadan eski bolgeye donus). Ust sinir: esikPuan <= puan + ESIK_EK + ESIK_TOZ_TAVAN (puan azalmaz).
  var ESIK_L = U.UFUK - U.ESIK_UFUK, ESIK_EK = ESIK_L / P.MESAFE_BIRIM;
  function uretimPuani(puan, tozPuani) { return puan + ESIK_EK + (tozPuani > 0 ? Math.min(tozPuani, U.ESIK_TOZ_TAVAN) : 0); }
  function ileriTozPuani(d) {
    var bx = d.mesafe + D.X_BOCEK, son = bx + ESIK_L, n = 0, top = 0, i, j, s, t, z = d.zincir > 0 ? d.zincir : 0;
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      if (s.toz.length && s.toz[0].x > son) break;            // tozlar dilimin onunde, x'e gore sirali; sonraki dilimler daha ileride
      for (j = 0; j < s.toz.length; j++) {
        t = s.toz[j];
        if (t.alindi || t.yutuldu || !(t.x > bx) || t.x > son) continue;
        top += P.TOZ * carpan(z + n); n++;
      }
    }
    return top;
  }
  function esikGuncelle(d) {
    var p = uretimPuani(d.puan, ileriTozPuani(d));
    if (!(d.esikPuan >= p)) d.esikPuan = p;
    return d.esikPuan;
  }
  function doldur(d) {
    while (d.uretici.x <= d.mesafe + D.X_BOCEK + U.UFUK) d.dilimler.push(uret(d.uretici, d.bolge, esikGuncelle(d)));
  }
  // secenek (OPSIYONEL, test kancasi 13): { mesafe, puan } baslangic. Kosu o mesafede (ilk 3 dilim acilis dilimi) ve
  // puanla baslar; kademe, bolge ve esik puani ona gore kurulur (baslangicta kademe olayi yok). Arayuz bunu kullanmaz.
  function oyunOlustur(tohum, secenek) {
    var m0 = secenek && secenek.mesafe > 0 ? +secenek.mesafe : 0, p0 = secenek && secenek.puan > 0 ? Math.floor(+secenek.puan) : 0;
    var ep = uretimPuani(p0, 0), b0 = bolgeNo(ep);
    var d = {
      t: 0, mesafe: m0, puan: p0, y: D.Y_BASLA, vy: 0, ay: 0, isik: I.BASLANGIC, dokunulmaz: 0,
      zincir: 0, zincirSure: 0, toz: 0, bolge: b0, esikPuan: ep, gorunenBolge: b0, bitti: 0, dilimler: [], tohum: tohum >>> 0,
      sersem: 0, zeminKoruma: 0, sebep: '',          // 12.1: kalan sersemlik / zemin korumasi (sn); bitis sebebi 'isik' | 'zemin'
      kademe: kademeNo(m0),                          // 13: gecilen en yuksek kademe (ekranda "Bolge N")
      uretici: ureticiVerisi(tohum)
    };
    d.uretici.x = m0 + D.X_BOCEK; d.uretici.bolge = b0;
    doldur(d);
    return d;
  }
  // Sarmasik buyumeye basladiginda zarfindaki alinmamis tozlar yutulur (toplanamaz, miknatis cekmez).
  function yut(s, olay) {
    var sut = s.sarmasik.sutunlar, i, j, t, c;
    for (i = 0; i < s.toz.length; i++) {
      t = s.toz[i];
      if (t.alindi || t.yutuldu) continue;
      for (j = 0; j < sut.length; j++) {
        c = sut[j];
        if (t.x >= c.x && t.x <= c.x + c.w && t.y >= c.y && t.y <= c.y + c.h) {
          t.yutuldu = 1; olay.push({ tur: 'yutuldu', x: t.x, y: t.y }); break;
        }
      }
    }
  }
  function carpar(e, bx, by, r) {
    var cx = kistir(bx, e.x, e.x + e.w), cy = kistir(by, e.y, e.y + e.h);
    return (bx - cx) * (bx - cx) + (by - cy) * (by - cy) <= r * r;
  }
  // Sersem suzulme egrisi (smoothstep): durgun baslar (tavanda vy = 0), durgun uyanir; ortalama hiz
  // (Y_UYAN - Y_UST) / SERSEM_SURE, en buyuk hiz bunun 1,5 kati.
  function sersemEgri(u) { return u * u * (3 - 2 * u); }
  function adim(d, basili) {
    if (d.bitti) return [];
    var olay = [], dt = D.DT, i, j, s, e, t;
    if (d.sersem > 0) {
      // Tavan sersemlemesi (12.1): girdi etkisiz; Y_UYAN'a dogru egri boyunca suzulur. Sure dolunca ya da
      // Y_UYAN'a varinca (hangisi once) durgun uyanir, ZEMIN_KORUMA baslar. Isik normal sizar, zincir korunur.
      var u0 = 1 - d.sersem / M.SERSEM_SURE, y0 = d.y;
      d.sersem -= dt; if (d.sersem < 1e-9) d.sersem = 0;
      d.y = Math.min(Y_UYAN, d.y + (Y_UYAN - D.Y_UST) * (sersemEgri(1 - d.sersem / M.SERSEM_SURE) - sersemEgri(u0)));
      d.vy = (d.y - y0) / dt; d.ay = 0;
      if (d.sersem === 0 || d.y >= Y_UYAN) {
        d.sersem = 0; d.vy = 0; d.ay = 0; d.zeminKoruma = M.ZEMIN_KORUMA;
        olay.push({ tur: 'uyandi', x: d.mesafe + D.X_BOCEK, y: d.y });
      }
    } else {
      // hareket: ivme rampasi (ay hedefe birinci dereceden yaklasir, 11.1), sonra yari ortuk Euler
      d.ay += ((basili ? -M.A_YUKSEL : M.G_SUZUL) - d.ay) * RAMPA_K;
      d.vy += d.ay * dt;
      if (d.vy < -M.VY_YUKARI) d.vy = -M.VY_YUKARI; else if (d.vy > M.VY_ASAGI) d.vy = M.VY_ASAGI;
      d.y += d.vy * dt;
      if (d.y < D.Y_UST) {
        // tavan: hasar degil; sersemleme baslar (isik cezasi yok, zincir korunur)
        d.y = D.Y_UST; d.vy = 0; d.ay = 0; d.sersem = M.SERSEM_SURE;
        olay.push({ tur: 'sersem', x: d.mesafe + D.X_BOCEK, y: d.y });
      } else if (d.y > D.Y_ALT) {
        d.y = D.Y_ALT; d.vy = 0;
        if (!(d.zeminKoruma > 0)) {
          // zemin olumu: temas aninda kosu biter (girdi kilitlenir); dunya bu adimda ilerlemez
          d.bitti = 1; d.sebep = 'zemin';
          olay.push({ tur: 'zemin', x: d.mesafe + D.X_BOCEK, y: d.y }, { tur: 'bitti', sebep: 'zemin' });
          return olay;
        }
      }
      if (d.zeminKoruma > 0) { d.zeminKoruma -= dt; if (d.zeminKoruma < 1e-9) d.zeminKoruma = 0; }
    }
    // dunya
    var zr = zorluk(d.mesafe), eski = Math.floor(d.mesafe / P.MESAFE_BIRIM);
    d.mesafe += zr.hiz * dt; d.t += dt;
    d.puan += Math.floor(d.mesafe / P.MESAFE_BIRIM) - eski;
    d.isik -= zr.sizinti * dt;
    if (d.dokunulmaz > 0) d.dokunulmaz = Math.max(0, d.dokunulmaz - dt);
    if (d.zincirSure > 0) { d.zincirSure -= dt; if (d.zincirSure <= 0) { d.zincirSure = 0; d.zincir = 0; } }
    doldur(d);
    while (d.dilimler.length && d.dilimler[0].x + d.dilimler[0].w < d.mesafe - 1) d.dilimler.shift();
    // 13: kademe gecisi (her kademe bir kez, artan sirada; ekranda "Bolge N")
    var kdNo = kademeNo(d.mesafe);
    if (kdNo > d.kademe) { d.kademe = kdNo; olay.push({ tur: 'kademe', kademe: kdNo }); }

    var bx = d.mesafe + D.X_BOCEK, tetik = zr.hiz * (AD.T_MIN + U.DUSEN_UYARI), r2 = M.R_TOPLA * M.R_TOPLA, vurdu = null;
    var sarVurdu = false, bomVurdu = null, sa, rb = M.R_BOMBA + M.R_CARPMA, q, L;
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      // Sarmasik (11.7): uyari bocek ilk sutuna SARMASIK_ONCE sn kala baslar; buyume basinda hizasindaki
      // (sutun zarfindaki) tozlar yutulur; buyume basladigi andan tam boy zarfla carpar.
      sa = s.sarmasik;
      if (sa) {
        if (sa.faz === 0) {
          // dilimin hizi (hiz artan: sutunlara varistaki hizdan buyuk) ile: uyari->varis suresi
          // SARMASIK_ONCE'den bir adimdan fazla kisalmaz; adim basina zorluk() cagrisi yok
          q = sa.x1 - bx - M.R_CARPMA;
          if (q <= s.hiz * U.SARMASIK_ONCE) {
            sa.faz = 1; sa.sure = 0;
            olay.push({ tur: 'sarmasikUyari', x: sa.x1, y: sa.yon === 'ust' ? D.Y_UST : D.Y_ALT });
          }
        } else if (sa.faz === 1) {
          sa.sure += dt;
          if (sa.sure >= U.SARMASIK_UYARI - 1e-9) { sa.faz = 2; sa.sure = 0; yut(s, olay); }
        } else if (sa.faz === 2) {
          sa.sure += dt; sa.ilerleme = Math.min(1, sa.sure / U.SARMASIK_BUYUME);
          if (sa.sure >= U.SARMASIK_BUYUME - 1e-9) { sa.faz = 3; sa.ilerleme = 1; }
        }
        if (sa.faz >= 2 && !sarVurdu && sa.x1 <= bx + M.R_CARPMA && sa.x2 >= bx - M.R_CARPMA)
          for (j = 0; j < sa.sutunlar.length; j++) if (carpar(sa.sutunlar[j], bx, d.y, M.R_CARPMA)) sarVurdu = true;
      }
      e = s.bomba;
      if (e && !e.alindi && !bomVurdu && (e.x - bx) * (e.x - bx) + (e.y - d.y) * (e.y - d.y) <= rb * rb) bomVurdu = e;
      for (j = 0; j < s.engeller.length; j++) {
        e = s.engeller[j];
        if (e.tur === 'kus') e.x = e.x0 - e.ek * d.mesafe;
        else if (e.tur === 'salinan') e.y = e.yc + e.gen * Math.sin(e.om * d.t + e.faz);   // 13: d.t (geri sayimda donuk)
        else if (e.tur === 'dusen') {
          if (e.faz === 0) { if (e.x - bx <= tetik) { e.faz = 1; e.sure = 0; } }
          else if (e.faz === 1) { e.sure += dt; if (e.sure >= U.DUSEN_UYARI) e.faz = 2; }
          else if (e.faz === 2) { e.y = Math.min(e.sarmasik, e.y + U.DUSEN_HIZ * dt); if (e.y >= e.sarmasik) e.faz = 3; }
        }
        if (!vurdu && d.dokunulmaz <= 0 && e.x <= bx + M.R_CARPMA && e.x + e.w >= bx - M.R_CARPMA &&
            carpar(e, bx, d.y, M.R_CARPMA)) vurdu = e;
      }
    }
    // Adim basina tek hasar; oncelik engel > sarmasik > bomba. Dokunulmazken hicbiri islemez (bomba yerinde kalir).
    if (d.dokunulmaz > 0) { sarVurdu = false; bomVurdu = null; }
    if (vurdu || sarVurdu || bomVurdu) {
      if (vurdu) {
        var ag = vurdu.tur === 'ag';
        d.isik -= ag ? I.AG_HASAR : (vurdu.tur === 'dal' ? I.DAL_HASAR : I.HASAR);
        olay.push({ tur: ag ? 'ag' : 'hasar', engel: vurdu.tur, x: bx, y: d.y });
      } else if (sarVurdu) {
        d.isik -= I.SARMASIK_HASAR;
        olay.push({ tur: 'sarmasik', x: bx, y: d.y });
      } else {
        bomVurdu.alindi = 1; d.isik -= I.BOMBA_HASAR;
        olay.push({ tur: 'bomba', x: bomVurdu.x, y: bomVurdu.y });
      }
      d.zincir = 0; d.zincirSure = 0; d.dokunulmaz = I.DOKUNULMAZ;
      // Olumcul hasar ayni adimdaki tozla iptal olmaz.
      if (d.isik <= 0) { d.isik = 0; d.bitti = 1; d.sebep = 'isik'; olay.push({ tur: 'bitti', sebep: 'isik' }); return olay; }
    }
    // Toz: miknatis (11.2) R_MIKNATIS icindeki alinmamis/yutulmamis tozu bocege MIKNATIS_HIZ ile kaydirir
    // (dunya koordinati, deterministik); sonra R_TOPLA icindeyse alinir. Kivilcim cekilmez.
    // Sersemken (12.1) miknatis kapali: yalniz dogrudan temas (R_TOPLA) toplar.
    var rm = d.sersem > 0 ? M.R_TOPLA : M.R_MIKNATIS, rm2 = rm * rm, adimM = M.MIKNATIS_HIZ * dt;
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      // Toz ve kivilcim dilimin onunde (x < s.x), x'e gore sirali: uzaktakileri atla. Cekilen toz yalniz bocege
      // yaklasir; ilk tozun x'i bu yuzden hala bir alt sinirdir. Gerideki dilim atlanmaz: cekilen tozu dilimin
      // onunu gecmis olabilir (atlanirsa havada donardi); geride en cok bir dilim kalir.
      if (s.toz.length && s.toz[0].x - bx > rm) break;
      for (j = 0; j < s.toz.length; j++) {
        t = s.toz[j];
        if (t.alindi || t.yutuldu) continue;
        q = (t.x - bx) * (t.x - bx) + (t.y - d.y) * (t.y - d.y);
        if (q > rm2) continue;
        if (q > r2) {
          L = Math.sqrt(q);
          t.x += (bx - t.x) / L * adimM; t.y += (d.y - t.y) / L * adimM;
          q = (t.x - bx) * (t.x - bx) + (t.y - d.y) * (t.y - d.y);
          if (q > r2) continue;
        }
        t.alindi = 1;
        var kz = P.TOZ * carpan(d.zincir);
        d.puan += kz; d.isik = Math.min(1, d.isik + I.TOZ);
        d.zincir++; d.zincirSure = P.ZINCIR_SURE; d.toz++;
        olay.push({ tur: 'toz', puan: kz, x: t.x, y: t.y });
      }
      t = s.kivilcim;
      if (t && !t.alindi && (t.x - bx) * (t.x - bx) + (t.y - d.y) * (t.y - d.y) <= r2) {
        t.alindi = 1;
        var kk = P.KIVILCIM * carpan(d.zincir);
        d.puan += kk; d.isik = Math.min(1, d.isik + I.KIVILCIM);
        olay.push({ tur: 'kivilcim', puan: kk, x: t.x, y: t.y });
      }
    }
    // bolge: uretici agirliklari icin uretim puaniyla (esik telafisi dahil) hemen degisir (olay yok).
    // gorunenBolge: arka plan ve SIS; nefes dilimi bocege varinca degisir, 'bolge' olayi o an.
    d.bolge = bolgeNo(esikGuncelle(d));
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      if (s.x > bx) break;
      if (s.nefes && s.bolge !== d.gorunenBolge && s.x + s.w + M.R_CARPMA >= bx) { d.gorunenBolge = s.bolge; olay.push({ tur: 'bolge', bolge: s.bolge }); }
    }
    if (d.isik <= 0) { d.isik = 0; d.bitti = 1; d.sebep = 'isik'; olay.push({ tur: 'bitti', sebep: 'isik' }); }
    return olay;
  }

  // ---------------------------------------------------------------
  // IKINCI SANS (saf; tools/atesBocegiIkinciSansTest.js)
  // ---------------------------------------------------------------
  // Guvenli yeniden dogma secimi; d'yi degistirmez. Dilimin bocege varis zamani s.x'tir (kus da sabit engellerle ayni
  // anda varir, bkz. adayKur). Bocegin onunde TEMIZ_SN sn icinde varacak (s.x < sinir) ve geride kalmamis dilimler
  // temizlenecek dilimlerdir; ilk kalan dilimin (s.x >= sinir) bomba/sarmasigi da onun yaklasma yolundadir (toz araligi,
  // x < s.x): o da silinir. Yukseklik: ilk kalan dilimin bosluk merkezi, [Y_MIN, Y_MAX] bandina kistirilmis.
  // Donus: { y, temiz: [dilim indeksi], ilk: dilim indeksi (-1: yok; IKINCI_SANS dogrulamasi ufuk icinde garanti eder),
  //          salinan: [dilim indeksi] }.
  // 13: salinan (hareketli) engeli: varisi TEMIZ_SN + tAra'dan erken olabilecek her dilimin salinani da silinir. Hiz mesafeyle
  // azalmadigi icin varis suresi >= (s.x - bx) / s.hiz (dilimin hizi yol boyunca en buyuk); bu alt sinir esige gore secilir.
  function dogmaSec(d) {
    var S = IKINCI_SANS, bx = d.mesafe + D.X_BOCEK, sinir = bx + zorluk(d.mesafe).hiz * S.TEMIZ_SN, temiz = [], ilk = -1, sal = [], i, j, s;
    for (i = 0; i < d.dilimler.length; i++) {
      s = d.dilimler[i];
      if (s.x + s.w < bx - M.R_CARPMA) continue;          // geride: bocege bir daha degmez (kusu da geride, daha hizli uzaklasir)
      if (ilk < 0) { if (s.x < sinir) temiz.push(i); else ilk = i; }
      if (ilk >= 0) {
        if ((s.x - bx) / s.hiz >= S.TEMIZ_SN + s.tAra) break;
        for (j = 0; j < s.engeller.length; j++) if (s.engeller[j].tur === 'salinan') { sal.push(i); break; }
      }
    }
    return { y: kistir(ilk >= 0 ? d.dilimler[ilk].c : D.Y_BASLA, S.Y_MIN, S.Y_MAX), temiz: temiz, ilk: ilk, salinan: sal };
  }
  // Ikinci sansi uygular (d'yi degistirir; yalniz bitmis kosuda). dogmaSec'in dilimlerinde engel, bomba ve sarmasik
  // silinir (toz ve kivilcim kalir); bocek y'de durgun, sersemlik ve dokunulmazlik yok, zemin korumasi uyanmadaki gibi
  // ZEMIN_KORUMA; isik en az ISIK. Puan, mesafe, toz sayisi, esik puani ve bolge aynen kalir. Carpan: o.zincir verilirse
  // (arayuz olumcul adimdan onceki zinciri verir; hasar zinciri sifirlar) zincir ona doner; zincir > 0 ise sure tazelenir.
  // Donus: dogmaSec sonucu (bitmemis kosuda null, durum degismez).
  function ikinciSans(d, o) {
    if (!d || !d.bitti) return null;
    var sec = dogmaSec(d), i, s, z = o && typeof o.zincir === 'number' && o.zincir > 0 ? Math.floor(o.zincir) : 0;
    for (i = 0; i < sec.temiz.length; i++) { s = d.dilimler[sec.temiz[i]]; s.engeller = []; s.bomba = null; s.sarmasik = null; }
    if (sec.ilk >= 0) { s = d.dilimler[sec.ilk]; s.bomba = null; s.sarmasik = null; }
    for (i = 0; i < sec.salinan.length; i++) { s = d.dilimler[sec.salinan[i]]; s.engeller = s.engeller.filter(function (e) { return e.tur !== 'salinan'; }); }
    d.bitti = 0; d.sebep = '';
    d.y = sec.y; d.vy = 0; d.ay = 0;
    d.sersem = 0; d.dokunulmaz = 0; d.zeminKoruma = M.ZEMIN_KORUMA;
    d.isik = Math.min(1, Math.max(d.isik, IKINCI_SANS.ISIK));
    if (z > d.zincir) d.zincir = z;
    d.zincirSure = d.zincir > 0 ? P.ZINCIR_SURE : 0;
    return sec;
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
    zorluk: zorluk, minYaricap: minYaricap, isikYaricapi: isikYaricapi, kademeNo: kademeNo,
    kacisSuresi: kacisSuresi, kacisMesafesi: kacisMesafesi, cikisSuresi: cikisSuresi,
    uyanmaY: Y_UYAN, frenMesafesi: function (yon) { return frenMesafesi(M, D.DT, yon); },
    uyanmaDususu: function (tepki) { return uyanmaDususu(M, D.DT, tepki); },
    bolgeNo: bolgeNo, carpan: carpan, uretimPuani: uretimPuani, ileriTozPuani: ileriTozPuani,
    ureticiOlustur: ureticiOlustur, dilimZarfi: dilimZarfi,
    oyunOlustur: oyunOlustur, adim: adim,
    IKINCI_SANS: IKINCI_SANS, dogmaSec: dogmaSec, ikinciSans: ikinciSans,
    esikOdulu: esikOdulu, kosuJetonu: kosuJetonu
  };
});
