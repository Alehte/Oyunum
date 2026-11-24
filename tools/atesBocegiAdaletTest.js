// atesBocegiAdaletTest.js — tohum x bot adalet testi (tasarim 8.2).
// Calistirma:  node tools/atesBocegiAdaletTest.js [tohumSayisi=1000] [mesafe=20000] [uzunTohum=100] [uzunMesafe=60000] [sersemTohum=60] [ustTohum=200]
// FAZ B (tasarim 13): kademe olaylari, salinan engel (supurulen zarf, her fazda gecit), dogumda isik-engel marji, kinematik
// ulasilabilirlik, duzensiz isik; ust hiz kumesi (60000 birimden, puan 6000: hiz 44, en dar bosluk, kademe 5) olum nedenleri.
// Botlar yalniz cekirdek API'sini (oyunOlustur, adim, dilimZarfi, zorluk, isikYaricapi, minYaricap,
// kosuJetonu, kacisSuresi, kacisMesafesi, frenMesafesi, uyanmaY, uyanmaDususu, rngOlustur) ve durum/dilim alanlarini okur. Bot A ve Bot D (ideal) dilimin butun
// alanlarini bilir. Bot B yalniz gorebildigini bilir: isik cemberine giren engel/toz, ekrandaki bomba, uyarisi
// baslamis sarmasigin yonu ve sutun uclari (sutun x'i yalniz ekrandaysa), hepsi T_MIN gecikmeyle.
// Dilim dizisi puana bagli oldugu icin (tasarim 11.8) yapisal denetim Bot A, Bot B ve Bot B gercek isik
// kosularinin her birinde yapilir; zaman (gorunurluk/varis) denetimi Bot A kosusunda.
'use strict';
const assert = require('assert');
const AB = require('../js/atesBocegi.js');
const A = AB.AYAR, DT = A.dunya.DT, XB = A.dunya.X_BOCEK, H = A.dunya.H, RC = A.hareket.R_CARPMA;
const T_MIN = A.adalet.T_MIN, K = A.adalet.KUS_EK, V = A.adalet.V_GUVENLI, T_IVME = A.adalet.T_IVME;
const U = A.uretici, EPS = 1e-9, NEFES_SURE = U.NEFES_SURE, RT = A.hareket.R_TOPLA;
const RB = A.hareket.R_BOMBA + RC, PAYK = A.adalet.PAY_KACIS, Y_UST = A.dunya.Y_UST, Y_ALT = A.dunya.Y_ALT;
const EKRAN = A.dunya.W - XB;            // en dar ekranin bocek onundeki genisligi (sarmasik sutun x'i bu kadar uzakta bilinir)
// 13: bomba, en dar ekrana girmeden 6 birim once sag kenardaki on isaretle (kendi isigiyla) gorunur. AYAR'dan turetilmez
// (kendini dogrulamasin): W - X_BOCEK + 6 = 48 sabit; AYAR ile esitligi ayri testte.
const BOMBA_GOR = 48;
// Bomba gorunur -> carpma mesafesi (R_BOMBA + R_CARPMA) en az: T_MIN + kacis (R_BOMBA + R_CARPMA + PAY_KACIS; durgun, ivme 0 =
// iki yonlu kacisin en kotu baslangici) + PAY_KACIS_SN. kacisSuresi gercek butunlemedir (tools/atesBocegiTest.js'de sinanir).
const BOMBA_KACIS_SN = A.adalet.T_MIN + AB.kacisSuresi(RB + PAYK, 0, 0) + A.adalet.PAY_KACIS_SN;
// Esik telafisi (atesBocegi.js uretimPuani; dilim UFUK'ta uretilir, esikler ESIK_UFUK'a gore). Cekirdekten bagimsiz AYAR'dan:
// (a) TELAFI_TAVAN: uretildigi adimda dilim.puan <= puan + L / MESAFE_BIRIM + ESIK_TOZ_TAVAN (L = UFUK - ESIK_UFUK). puan azalmaz,
//     uretim puani en cok bu kadar ileri bakar; ustel toz hizi gibi sinirsiz bir tahmin bu denetimi gecemez.
// (b) ESIK_TOL: her esik turu icin esigi gecen ilk (nefes olmayan) dilim ekran x = W'ye (en dar ekranin sag kenari) vardiginda
//     bocegin gercek puani >= esik - ESIK_TOL. Olcum (bu test, 1000 tohum; Bot A/B/Bg/uzun A/B; ayrica denetci takip botu 150 tohum):
//     esik oncesi telafisiz eski uretimde (ufuk 2W) en kotu +29 (geometri tabani +14,5: dilim 108'den 50'ye 58 birim = 14,5 mesafe
//     puani); 50552c8 ustel toz hizi telafisinde -39 (zincir kopunca tahmin en yuksekte kilitli; bu testte 60 tohumda Bot B bomba -21,
//     uzun B -49); ileri toz telafisinde 1000 tohumda en kotu -3 (Bot A sarmasik), diger tur/botlarda >= +19; denetci botu >= +29.
//     ESIK_TOL = 5: olculen en kotunun 2 puan altinda; kucuk tahmin hatasina izin verir, -21/-39 turu erken tehlikeyi yakalar.
const ESIK_L = U.UFUK - U.ESIK_UFUK, TELAFI_TAVAN = ESIK_L / A.puan.MESAFE_BIRIM + U.ESIK_TOZ_TAVAN, ESIK_TOL = 5;
const ESIK_TUR = [['tozsuz', U.TOZSUZ_PUAN], ['bomba', U.BOMBA_PUAN], ['sarmasik', U.SARMASIK_PUAN]];
const ESIK_EKRAN = [A.dunya.W, 82, H * A.dunya.ORAN_MAX];   // en dar ekran (denetlenen), 82 (ornek orta), 20:9 (bilgi)
const esikOlc = {};                                          // kosu adi -> esik turu -> ekran -> [gercek puan - esik]

const TOHUM_SAYI = +process.argv[2] || 1000, MESAFE = +process.argv[3] || 20000;
// 5000+ (cakisma serbest) bolgesi icin uzun mesafe alt kumesi: UZUN_TOHUM tohum x UZUN_MESAFE (Bot A ve Bot B).
const UZUN_TOHUM = process.argv[4] !== undefined ? +process.argv[4] : 100, UZUN_MESAFE = +process.argv[5] || 60000;
const tohum = i => (Math.imul(i + 1, 2654435761) + 0x7F4A7C15) >>> 0;

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// ---------------------------------------------------------------
// Yapisal denetci: her yeni dilim + her engelin gorunurluk / varis zamani
// ---------------------------------------------------------------
const ist = { bolgeOlay: 0, dilim: 0, nefes: 0, kivilcim: 0, uzakDilim: 0, uzakKivilcim: 0, tur: { dal: 0, ag: 0, kus: 0, dusen: 0, salinan: 0 },
              enAzPay: Infinity, enAzAra: Infinity, enCokDcOran: 0, kusur: [],
              // yeni mekanikler (tasarim 11): yapisal denetimden gecen dilim sayilari (butun kosular)
              m: { tozsuz: 0, pencere: 0, bomba: 0, sarmasik: 0, sutun: 0, sarmasik5000: 0, cakismaYan: 0, tozsuz5000: 0,
                   enAzPencereAra: Infinity, enCokPencere: 0, enAzKacisPay: Infinity, enAzBombaPay: Infinity, enAzDonusPay: Infinity },
              // zaman denetimi (Bot A kosusu)
              z: { sarmasik: 0, enAzUyari: Infinity, enAzUyariVaris: Infinity, bomba: 0, enAzBombaGorVaris: Infinity },
              // FAZ B (tasarim 13): yapisal denetim (butun denetlenen kosular)
              f: { kademe: [0, 0, 0, 0, 0], salinan: 0, salKademe: [0, 0, 0, 0, 0], gecitEnAz: Infinity, marjEnAz: Infinity, isik: 0,
                   sarYutulacak: 0, ulasimEnAz: Infinity, dag: 0, dag1: 0, kayan: 0, boslukEnCok: 0, kademeOlay: 0, enCokHiz: 0, enCokSizinti: 0 } };
function kusur(tohum, s, msg) { ist.kusur.push('tohum ' + tohum + ' dilim ' + (s ? s.no : '-') + ': ' + msg); }

// En kotu durum zarfi (3.4 tablosu), ham engel verisinden; dilimin varis anindaki x araligi.
function zarflar(s) {
  return s.engeller.map(e => {
    if (e.tur === 'kus') return { x1: s.x, x2: s.x + s.w, y1: e.y, y2: e.y + e.h };
    if (e.tur === 'salinan') return { x1: e.x, x2: e.x + e.w, y1: e.yc - e.gen, y2: e.yc + e.gen + e.h };   // 13: supurulen kutu
    if (e.tur === 'dusen') return { x1: e.x, x2: e.x + e.w, y1: 0, y2: e.sarmasik + e.h };
    return { x1: e.x, x2: e.x + e.w, y1: e.y, y2: e.y + e.h };
  });
}
const yol = (c1, c2, f) => c1 + (c2 - c1) * (1 - Math.cos(Math.PI * f)) / 2;

// Bagimsiz kacis denetimi (tasarim 11.5, 11.7, 11.9): yalniz AB.kacisMesafesi'ni (gercek butunleme) kullanir.
// k: {a, c1, b, c2, g2, hiz, tA, tU}. Oyuncu toz yolunu izler, tehlikeyi bocek x = xGor'dayken gorur,
// T_MIN sonra tepki verir, onceki dilimin arkasindan (a + R_CARPMA) itibaren kacabilir (isik tabaninda o
// dilimin bandi gorunmeyebilir). Tepki anindaki olasi durumlar: yukseklik [yA, yU] = (yol +- TOZ_SAPMA) ile tutma
// araliginin (bkz. tutmaGuncelle) birlesimi, ivme [-A, +A] (A = min(A_YUKSEL, G_SUZUL)), dikey hiz yolun aleyhte
// hizi (lehteyse 0); kacis suresine PAY_KACIS_SN eklenir. Sonra en uc seviyeden sonraki boslugun serbest bandina
// kural 3 hiziyla (durup donmek icin 2*T_IVME).
const A_ZAYIF = Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL), PAY_SN = A.adalet.PAY_KACIS_SN;
// 12.1: kacis seviyesi duvara fren payindan yakin olamaz (tam hizla varan oyuncu tavana degip sersemlemesin,
// zemine degip olmesin). frenMesafesi'nin gercek adimla ayniligi tools/atesBocegiTest.js'de denetlenir.
const FREN_UST = AB.frenMesafesi(-1), FREN_ALT = AB.frenMesafesi(1);
function kacisGeoT(k, sy, xGor, hed, xArka) {
  const Y = sy * Math.max(...hed.map(h => sy * h.y)), sonX = k.b - RC, ic = RC + PAYK;
  if (Y < Y_UST + FREN_UST || Y > Y_ALT - FREN_ALT) return { neden: 'kacis seviyesi duvara fren payindan yakin' };
  if (xArka > sonX) return { neden: 'tehlike sonraki dilimin zarfina tasiyor' };
  const lo = k.c2 - k.g2 / 2 + ic, hi = k.c2 + k.g2 / 2 - ic, mes = Math.max(0, lo - Y, Y - hi);
  if (mes > 0) {
    const pay = (sonX - xArka) / k.hiz - 2 * T_IVME - mes / V;
    ist.m.enAzDonusPay = Math.min(ist.m.enAzDonusPay, pay);
    if (pay < -EPS) return { neden: 'sonraki bosluga baglanamiyor (' + pay.toFixed(4) + ' sn)' };
  }
  const xe = Math.max(xGor + k.hiz * T_MIN, k.a + RC), uz = k.b - k.a;
  const f = Math.min(1, Math.max(0, (xe - k.a) / uz)), yy = yol(k.c1, k.c2, f);
  if (hed.some(h => !(h.x > xe))) return { neden: 'tepki aninda tehlikeye varilmis' };
  return { sy, Y, xe, hed, vYol: (k.c2 - k.c1) * Math.PI / 2 * Math.sin(Math.PI * f) / uz * k.hiz,
           yA: Math.min(yy - U.TOZ_SAPMA, k.tA), yU: Math.max(yy + U.TOZ_SAPMA, k.tU) };
}
// Bu yanin yetistigi baslangic yuksekligi siniri (asagi: y >= sinir, yukari: y <= sinir); ay0 kacis yonunde.
function sinirT(k, g, ay0) {
  const v0 = Math.min(0, g.sy * g.vYol);
  const b = g.hed.map(h => h.y - g.sy * AB.kacisMesafesi((h.x - g.xe) / k.hiz - PAY_SN, v0, ay0));
  return g.sy > 0 ? Math.max(...b) : Math.min(...b);
}
// Tek yon (sarmasik): en kotu yukseklik + ters tam ivme. Donus: null (gecerli) ya da neden.
function kacisDenetle(k, sy, xGor, hed, xArka) {
  const g = kacisGeoT(k, sy, xGor, hed, xArka);
  if (g.neden) return g.neden;
  const sin = sinirT(k, g, -A_ZAYIF), pay = sy > 0 ? g.yA - sin : sin - g.yU;   // birim (yukseklik payi)
  ist.m.enAzKacisPay = Math.min(ist.m.enAzKacisPay, pay);
  return pay < -EPS ? 'kacis yetismiyor (yukseklik payi ' + pay.toFixed(4) + ')' : null;
}
// Iki yon (bomba): her (y, ay) durumu icin en az bir yan yetismeli; ay 9 noktada.
function ikiYonDenetle(k, xGor, hedA, hedY, xArka) {
  const ga = kacisGeoT(k, 1, xGor, hedA, xArka), gy = kacisGeoT(k, -1, xGor, hedY, xArka);
  if (ga.neden || gy.neden) return 'asagi: ' + (ga.neden || 'ok') + ', yukari: ' + (gy.neden || 'ok');
  const yA = Math.min(ga.yA, gy.yA), yU = Math.max(ga.yU, gy.yU);
  for (let j = -4; j <= 4; j++) {
    const ay = A_ZAYIF * j / 4, f = sinirT(k, ga, ay), g = sinirT(k, gy, -ay);
    const pay = Math.max(g - f, yA - f, g - yU);
    ist.m.enAzBombaPay = Math.min(ist.m.enAzBombaPay, pay);
    if (pay < -EPS) return 'ay ' + ay.toFixed(0) + ' icin iki yan da yetismiyor (' + pay.toFixed(4) + ')';
  }
  return null;
}
// Koridor: [x1, x2] boyunca (bocek merkezi) y seviyesi, verilen dolu dikdortgenlerin R_CARPMA genisletilmisinin
// ve dunya sinirinin disinda mi? dolu: [{x1, x2, y1, y2}]
function koridorAcik(y, x1, x2, dolu) {
  if (y < Y_UST || y > Y_ALT) return false;
  return dolu.every(z => z.x2 < x1 - RC || z.x1 > x2 + RC || y < z.y1 - RC || y > z.y2 + RC);
}

function yeniDenetci(t, basX) {
  return { t: t, basX: basX === undefined ? XB : basX, son: null, sonNo: -1, ustSay: 0, altSay: 0, nefesBekle: false,
           aktif: [], sonVaris: null, tehlike: [],
           pencereUz: 0, pencereSon: -1e9, tozsuzNo: [], sarmasikNo: [], tA: A.dunya.Y_BASLA, tU: A.dunya.Y_BASLA };
}
// Tutma araligi: oyuncunun bir dilimi gecerken bulunabilecegi yukseklikler. Dilim merkezi + yayinin son tozu
// (dilimi goremeyen oyuncu son rehberinde bekler) + tehlike kacis seviyeleri (dilimin bandina kistirilmis);
// tozsuz dilimde onceki aralikla birlesir. Tozsuz dilimin serbest bandi bu araligi kapsamalidir.
function tutmaGuncelle(dn, s, c, zf, Ylist) {
  let a = c, u = c;
  const yt = s.toz;
  if (s.tozsuz) { a = Math.min(c, dn.tA); u = Math.max(c, dn.tU); }
  else if (yt.length) { const y = yt[yt.length - 1].y; a = Math.min(a, y); u = Math.max(u, y); }
  Ylist.forEach(Y => { const y = Math.max(zf.ust + RC + PAYK, Math.min(zf.alt - RC - PAYK, Y)); a = Math.min(a, y); u = Math.max(u, y); });
  dn.tA = a; dn.tU = u;
}
// ---- FAZ B (tasarim 13): kademe, rampa, salinan, isik-engel marji, kinematik ulasilabilirlik, duzensiz isik.
// Bagimsiz: yalniz AYAR, AB.kademeNo, AB.zorluk ve AB.kacisMesafesi (gercek butunleme) kullanilir.
const Z13 = A.zorluk, KAD = Z13.KADEME, MARJ = Z13.ISIK_MARJ;
const ulas = t => t > 0 ? Math.max(0, AB.kacisMesafesi(t, 0, 0)) : 0;
// Kinematik ulasilabilirlik: tam bilgili oyuncu onceki boslugun merkezinde (x = a + R_CARPMA'da durgun) tam girdiyle tozun
// R_TOPLA'sina varir; durup donerek (2 * T_IVME) sonraki boslugun serbest bandina (R_CARPMA + PAY_KACIS icerisi) b - R_CARPMA'da
// varir; toz KIVILCIM_Y bandinda (duvara degen bocek toplayamaz). Donus: en kucuk pay (birim; < 0 ulasilamaz).
function ulasimPayi(tz, a, b, c1, c2, g2, hiz) {
  const tG = (tz.x - a - RC) / hiz, tC = (b - RC - tz.x) / hiz;
  const g1 = ulas(tG) + RT, gg = ulas(tC - 2 * T_IVME) + RT + (g2 / 2 - RC - PAYK);
  return Math.min(g1 - Math.abs(tz.y - c1), gg - Math.abs(tz.y - c2), tz.y - U.KIVILCIM_Y_MIN, U.KIVILCIM_Y_MAX - tz.y);
}
const noktaZarf = (x, y, z) => Math.hypot(Math.max(0, z.x1 - x, x - z.x2), Math.max(0, z.y1 - y, y - z.y2));
function fazBDenetle(dn, s, zf, zr, a, b, pc, c, zarfTum, ozel) {
  const t = dn.t, m = s.x - XB, F = ist.f, kd = AB.kademeNo(m);
  if (s.kademe !== kd) kusur(t, s, 'dilim kademesi ' + s.kademe + ' != ' + kd);
  F.kademe[kd - 1]++;
  // rampa tavanlari
  F.enCokHiz = Math.max(F.enCokHiz, s.hiz); F.enCokSizinti = Math.max(F.enCokSizinti, zr.sizinti);
  if (s.hiz > Z13.HIZ_TAVAN + EPS || zr.sizinti > Z13.SIZINTI_TAVAN + EPS) kusur(t, s, 'rampa tavani asildi');
  // salinan: kademe 3+, supurulen zarf boslugun disinda (zarflar() + kural 1 'zarf boslugu kesiyor' da yakalar), duvar payi,
  // genlik/periyot kademe ilerlemesiyle, her fazda (64 ornek) gecit = bosluktaki serbest en buyuk aralik >= bosluk(z)
  const fo = Math.max(0, Math.min(1, (m - KAD[2]) / (KAD[4] - KAD[2])));
  s.engeller.forEach(e => {
    if (e.tur !== 'salinan') return;
    F.salinan++; F.salKademe[kd - 1]++;
    if (kd < 3) kusur(t, s, 'salinan kademe 3 oncesi');
    if (ozel) kusur(t, s, 'salinan acilis/nefes diliminde');
    const y1 = e.yc - e.gen, y2 = e.yc + e.gen + e.h;
    if (y1 < Z13.SAL_KENAR - EPS || y2 > H - Z13.SAL_KENAR + EPS) kusur(t, s, 'salinan duvara SAL_KENAR\'dan yakin');
    if (!(y2 <= zf.ust + EPS || y1 >= zf.alt - EPS)) kusur(t, s, 'salinan supurulen zarfi boslugu kesiyor');
    if (Math.abs(e.gen - (Z13.SAL_GENLIK[0] + (Z13.SAL_GENLIK[1] - Z13.SAL_GENLIK[0]) * fo)) > 1e-9 ||
        Math.abs(2 * Math.PI / e.om - (Z13.SAL_PERIYOT[0] + (Z13.SAL_PERIYOT[1] - Z13.SAL_PERIYOT[0]) * fo)) > 1e-9) kusur(t, s, 'salinan genlik/periyot kademeyle uyumsuz');
    for (let k = 0; k < 64; k++) {
      const y = e.yc + e.gen * Math.sin(2 * Math.PI * k / 64), lo = Math.max(zf.ust, Math.min(zf.alt, y)), hi = Math.max(zf.ust, Math.min(zf.alt, y + e.h));
      const gecit = Math.max(lo - zf.ust, zf.alt - hi);
      F.gecitEnAz = Math.min(F.gecitEnAz, gecit);
      if (gecit < zr.bosluk - EPS) { kusur(t, s, 'salinan fazinda gecit ' + gecit.toFixed(3) + ' < bosluk'); break; }
    }
  });
  // dogumda isik (toz + kivilcim) her engel zarfindan (bu ve onceki dilim; salinan: supurulen kutu, kus: varistaki x araligi)
  // >= ISIK_MARJ ve x'te [a + MARJ, b - MARJ]. Sarmasik istisnasi: sarmasigin sutun hizasindaki tozlari sonradan yutmasi
  // tasarimdir (dogumda sutun yok); bu tozlar ayri sayilir ve yalniz sutun hizasindakiler olabilir.
  const isiklar = s.toz.concat(s.kivilcim ? [s.kivilcim] : []);
  isiklar.forEach(tz => {
    F.isik++;
    let en = Infinity; zarfTum.forEach(z => { en = Math.min(en, noktaZarf(tz.x, tz.y, z)); });
    F.marjEnAz = Math.min(F.marjEnAz, en, tz.x - a, b - tz.x);
    if (en < MARJ - EPS) kusur(t, s, 'isik engel zarfina ' + en.toFixed(3) + ' < ISIK_MARJ');
    if (tz.x < a + MARJ - EPS || tz.x > b - MARJ + EPS) kusur(t, s, 'isik x marji disinda');
  });
  if (s.sarmasik) s.toz.forEach(tz => {
    const sut = s.sarmasik.sutunlar.find(cl => tz.x >= cl.x && tz.x <= cl.x + cl.w && tz.y >= cl.y && tz.y <= cl.y + cl.h);
    if (!sut) return;
    F.sarYutulacak++;
    if (!(sut.tx === tz.x && sut.ty === tz.y)) kusur(t, s, 'sarmasik sutun hizasi disinda bir tozu kapatiyor');
  });
  // kinematik ulasilabilirlik: her toz (kivilcim: kural 7 bacak denetimi)
  s.toz.forEach(tz => {
    const pay = ulasimPayi(tz, a, b, pc, c, zf.alt - zf.ust, s.hiz);
    F.ulasimEnAz = Math.min(F.ulasimEnAz, pay);
    if (pay < -1e-9) kusur(t, s, 'ulasilamaz toz (pay ' + pay.toFixed(4) + ')');
  });
  // duzensiz isik: kademe 4+, siradan dilim, dag = kademe 4 -> 5 ilerlemesi, son toz yayda (kural 6 denetimi)
  const beklenen = kd >= 4 && !ozel && !s.tozsuz && !s.bomba && !s.sarmasik ? Math.max(0, Math.min(1, (m - KAD[3]) / (KAD[4] - KAD[3]))) : 0;
  if (Math.abs((s.dag || 0) - beklenen) > 1e-9) kusur(t, s, 'dag ' + s.dag + ' != ' + beklenen);
  if (s.dag > 0) {
    F.dag++; if (s.dag === 1) F.dag1++;
    s.toz.forEach(tz => { if (Math.abs(tz.y - yol(pc, c, (tz.x - a) / (b - a))) > U.TOZ_SAPMA + 1e-6) F.kayan++; });
    // dusen toz bilgi boslugu: komsu noktalar (a, tozlar) arasi <= (DAG_BOSLUK + kayma payi 2 * DAG_X / (TOZ_MIN + 1)) * (b - a)
    const sinir = (Z13.DAG_BOSLUK + 2 * Z13.DAG_X / (U.TOZ_MIN + 1)) * (b - a);
    let once = a, enCok = 0; s.toz.forEach(tz => { enCok = Math.max(enCok, tz.x - once); once = tz.x; });
    F.boslukEnCok = Math.max(F.boslukEnCok, enCok / (b - a));
    if (enCok > sinir + 1e-9) kusur(t, s, 'dag toz boslugu ' + (enCok / (b - a)).toFixed(3) + ' > sinir');
  }
}
function dilimDenetle(dn, s, gorPuan) {
  const puan = s.puan;                                        // uretim puani (tasarim 11.8; esik telafisi dahil, AB.uretimPuani)
  // (a) telafi ust siniri: gorPuan = uretildigi adimin sonundaki gercek puan (uretimdeki puandan kucuk olamaz)
  if (!(puan <= gorPuan + TELAFI_TAVAN + EPS)) kusur(dn.t, s, 'uretim puani gercek puan + telafi tavanini asiyor (' + puan.toFixed(1) + ' > ' + gorPuan + ' + ' + TELAFI_TAVAN + ')');
  const t = dn.t, p = dn.son, zf = AB.dilimZarfi(s), c = (zf.ust + zf.alt) / 2;
  const zr = AB.zorluk(s.x - XB), zs = zarflar(s);
  ist.dilim++; if (s.nefes) ist.nefes++; if (s.kivilcim) ist.kivilcim++;
  if (s.x - XB > 10000) { ist.uzakDilim++; if (s.kivilcim) ist.uzakKivilcim++; }
  s.engeller.forEach(e => { ist.tur[e.tur]++; });
  if (s.no !== dn.sonNo + 1) kusur(t, s, 'dilim sirasi atladi');
  // kural 9: acilis
  if (s.no < U.ACILIS_DILIM) {
    if (!s.engeller.length || s.engeller.some(e => e.tur !== 'dal')) kusur(t, s, 'acilis yalniz dal degil');
    if (Math.abs(zf.alt - zf.ust - U.ACILIS_BOSLUK) > EPS) kusur(t, s, 'acilis boslugu 30 degil');
    if (Math.abs(c - (p ? p.c : A.dunya.Y_BASLA)) > U.ACILIS_FARK + EPS) kusur(t, s, 'acilis merkez farki > 10');
  }
  // kural 8: nefes yalniz bolge degisiminden sonra, engelsiz
  if (dn.nefesBekle && s.no >= U.ACILIS_DILIM) { if (!s.nefes) kusur(t, s, 'bolge degisti ama nefes yok'); dn.nefesBekle = false; }
  else if (s.nefes) kusur(t, s, 'beklenmeyen nefes');
  if (s.nefes && s.engeller.length) kusur(t, s, 'nefeste engel var');
  if (!s.nefes && !s.engeller.length) kusur(t, s, 'engelsiz dilim');
  // kural 1: bosluk + zarf disi
  if (zf.ust < 0 || zf.alt > H) kusur(t, s, 'bosluk dunya disinda');
  if (zf.alt - zf.ust < zr.bosluk - EPS) kusur(t, s, 'bosluk ' + (zf.alt - zf.ust) + ' < ' + zr.bosluk);
  zs.forEach(z => { if (!(z.y2 <= zf.ust + EPS || z.y1 >= zf.alt - EPS)) kusur(t, s, 'zarf boslugu kesiyor'); });
  s.engeller.forEach(e => {
    if (e.tur === 'kus' && Math.abs(e.x0 - (s.x + K * (s.x - XB - RC))) > 1e-6) kusur(t, s, 'kus varisi dilimle hizali degil');
    if (e.tur === 'dusen' && (e.y !== 0 || e.faz !== 0)) kusur(t, s, 'dusen dal asili baslamiyor');
    if (e.tur === 'ag' && (e.y <= 0 || e.y + e.h >= H)) kusur(t, s, 'ag havada degil');
  });
  // kural 4
  if (c < U.MERKEZ_MIN - EPS || c > U.MERKEZ_MAX + EPS) kusur(t, s, 'merkez ' + c + ' sinir disi');
  const pc = p ? p.c : A.dunya.Y_BASLA, px = p ? p.x : dn.basX, pw = p ? p.w : 0;
  if (p) {
    // kural 2 (yapisal): hiz artan -> gercek sure >= Δx / hiz(sonraki)
    const ara = (s.x - p.x) / zr.hiz;
    if (ara < zr.tAra - EPS) kusur(t, s, 'tAra ihlali ' + ara);
    // kural 3
    const sinir = V * (zr.tAra - T_MIN - T_IVME), dc = Math.abs(c - pc);
    if (dc > sinir + EPS) kusur(t, s, 'dikey gecis ' + dc + ' > ' + sinir);
    ist.enCokDcOran = Math.max(ist.enCokDcOran, dc / sinir);
    // kural 8: nefes cevresinde >= 2 sn engelsiz
    if (p.nefes && dn.oncekiGercek) {
      const g = dn.oncekiGercek, bos = (s.x - (g.x + g.w)) / zr.hiz;
      if (bos < NEFES_SURE - EPS) kusur(t, s, 'nefes engelsiz suresi ' + bos);
    }
  }
  // kural 5: her 4 gercek dilimde tavan ve zemin seridi kapanir (yalniz dikenli dal kapatir)
  if (!s.nefes) {
    const kUst = s.engeller.some(e => e.tur === 'dal' && e.y <= EPS && e.y + e.h >= U.SERIT_UST - EPS);
    const kAlt = s.engeller.some(e => e.tur === 'dal' && e.y <= U.SERIT_ALT + EPS && e.y + e.h >= H - EPS);
    dn.ustSay = kUst ? 0 : dn.ustSay + 1; dn.altSay = kAlt ? 0 : dn.altSay + 1;
    if (dn.ustSay >= U.SERIT_PENCERE) kusur(t, s, 'tavan seridi 4 dilimdir acik');
    if (dn.altSay >= U.SERIT_PENCERE) kusur(t, s, 'zemin seridi 4 dilimdir acik');
  }
  // kural 6: toz
  // Toz/kivilcim x'i (a, b) acik araliginda: sabit zarflar [p.x, p.x+w] ve [s.x, s.x+w] disinda kalir.
  const a = px + pw, b = s.x, yt = s.toz;
  const tozSay = yt.length + (s.bomba ? 1 : 0);             // bomba bir ic tozun yerindedir
  // 13: duzensiz dilimde (dag > 0) tozlar dusebilir (en az 2) ve son toz disindakiler yaydan kayabilir (fazBDenetle)
  if (s.tozsuz ? s.toz.length !== 0 : (tozSay < (s.dag > 0 ? 2 : U.TOZ_MIN) || tozSay > U.TOZ_MAX)) kusur(t, s, 'toz sayisi ' + tozSay);
  yt.forEach((tz, i) => {
    if (!(tz.x > a && tz.x < b)) kusur(t, s, 'toz araligin disinda');
    const f = (tz.x - a) / (b - a);
    if ((!(s.dag > 0) || i === yt.length - 1) && Math.abs(tz.y - yol(pc, c, f)) > U.TOZ_SAPMA + 1e-6) kusur(t, s, 'toz egriden sapmis');
  });
  // kural 7: kivilcim
  const kv = s.kivilcim;
  if (kv) {
    const f = (kv.x - a) / (b - a), uz = Math.abs(kv.y - yol(pc, c, f));
    if (!(kv.x > a && kv.x < b)) kusur(t, s, 'kivilcim araligin disinda');
    if (uz < U.KIVILCIM_UZAK_MIN - 1e-6 || uz > U.KIVILCIM_UZAK_MAX + 1e-6) kusur(t, s, 'kivilcim uzakligi ' + uz);
    if (kv.y < A.dunya.Y_UST || kv.y > A.dunya.Y_ALT) kusur(t, s, 'kivilcim ulasilamaz yukseklikte');
    const tBacak = ((b - a) / 2 - RC) / zr.hiz;   // bosluktan cikis -> kivilcim -> sonraki bosluga giris
    // 11.1: Bot D %95'in ustunde kaldigi icin bacaklardan T_IVME dusulmez
    if (Math.max(Math.abs(kv.y - pc), Math.abs(c - kv.y)) > V * tBacak + 1e-6) kusur(t, s, "kivilcim bacagi > V_GUVENLI * tBacak");
    if (s.tozsuz || s.bomba || s.sarmasik) kusur(t, s, 'tozsuz/bomba/sarmasik dilimde kivilcim');
    if (Math.abs(kv.x - (a + b) / 2) > 1e-6) kusur(t, s, 'kivilcim ortada degil');
  }
  // ---- tasarim 11: tozsuz pencere, bomba, sarmasik, cakisma. puan: dilimin uretim puani (dilim.puan).
  const ozel = s.nefes || s.no < U.ACILIS_DILIM;
  const k = p ? { a: px + pw, c1: pc, b: s.x, c2: c, g2: zf.alt - zf.ust, hiz: zr.hiz, tA: dn.tA, tU: dn.tU } : null, Ylist = [];
  const zarfTum = zs.concat(p ? zarflar(p) : []);
  if (s.tozsuz) {
    ist.m.tozsuz++; if (puan >= U.CAKISMA_SERBEST) ist.m.tozsuz5000++;
    if (ozel) kusur(t, s, 'nefes/acilis dilimi tozsuz');
    if (s.kivilcim || s.bomba || s.sarmasik) kusur(t, s, 'tozsuz dilimde kivilcim/bomba/sarmasik');
    if (puan < U.TOZSUZ_PUAN) kusur(t, s, 'tozsuz esik altinda (' + puan + ')');
    const lim = zr.bosluk / 2 - RC - PAYK;
    if (p && (c < dn.tU - lim - EPS || c > dn.tA + lim + EPS)) kusur(t, s, 'tozsuz dilimin bandi tutma araligini kapsamiyor');
  }
  // pencere: ardisik tozsuz dilimler (nefes araya girerse duraklar, duzdur), uzunluk 2-3, araliklar >= TOZSUZ_ARA
  if (!(s.nefes && dn.pencereUz)) {
    if (s.tozsuz) {
      if (!dn.pencereUz) {
        const ara = s.no - dn.pencereSon - 1; ist.m.pencere++;
        if (dn.pencereSon > -1e9) ist.m.enAzPencereAra = Math.min(ist.m.enAzPencereAra, ara);
        if (ara < U.TOZSUZ_ARA) kusur(t, s, 'tozsuz pencereler arasi ' + ara + ' dilim');
      }
      dn.pencereUz++; dn.pencereSonTozsuz = s.no;
    } else if (dn.pencereUz) {
      ist.m.enCokPencere = Math.max(ist.m.enCokPencere, dn.pencereUz);
      if (dn.pencereUz < U.TOZSUZ_MIN || dn.pencereUz > U.TOZSUZ_MAX) kusur(t, s, 'tozsuz pencere ' + dn.pencereUz + ' dilim');
      dn.pencereSon = dn.pencereSonTozsuz; dn.pencereUz = 0;
    }
  }
  // cakisma (11.8): CAKISMA_SERBEST altinda uretilen sarmasik ile tozsuz dilim arasi >= CAKISMA_ARA
  if (s.tozsuz) {
    dn.tozsuzNo.push(s.no);
    dn.sarmasikNo.forEach(v => { if (s.no - v.no < U.CAKISMA_ARA) { if (v.p < U.CAKISMA_SERBEST) kusur(t, s, 'cakisma: sarmasik ' + v.no + ' yaninda tozsuz'); else ist.m.cakismaYan++; } });
  }
  if (s.sarmasik) {
    dn.sarmasikNo.push({ no: s.no, p: puan });
    dn.tozsuzNo.forEach(n => { if (s.no - n < U.CAKISMA_ARA) { if (puan < U.CAKISMA_SERBEST) kusur(t, s, 'cakisma: tozsuz ' + n + ' yaninda sarmasik'); else ist.m.cakismaYan++; } });
  }
  if (dn.tozsuzNo.length > 8) dn.tozsuzNo.shift();
  if (dn.sarmasikNo.length > 8) dn.sarmasikNo.shift();
  if ((s.bomba || s.sarmasik) && p && p.tehlike) kusur(t, s, 'ardisik iki tehlike (bomba/sarmasik) dilimi');
  if (s.tozsuz && !dn.pencereUz && p && p.tehlike) kusur(t, s, 'tozsuz pencere tehlike diliminin ardindan basladi');
  if (s.bomba) {
    const bo = s.bomba; ist.m.bomba++;
    if (ozel || s.tozsuz || s.sarmasik) kusur(t, s, 'bomba nefes/acilis/tozsuz/sarmasik dilimde');
    if (puan < U.BOMBA_PUAN) kusur(t, s, 'bomba esik altinda (' + puan + ')');
    if (!(bo.x > a && bo.x < b) || !s.toz.length || !(bo.x > s.toz[0].x && bo.x < s.toz[s.toz.length - 1].x)) kusur(t, s, 'bomba ic tozun yerinde degil');
    if (Math.abs(bo.y - yol(pc, c, (bo.x - a) / (b - a))) > U.TOZ_SAPMA + 1e-6) kusur(t, s, 'bomba yaydan sapmis');
    // kacilabilirlik: her olasi oyuncu durumunda en az bir yana
    const hA = [{ x: bo.x - RB, y: bo.y + RB + PAYK }], hY = [{ x: bo.x - RB, y: bo.y - RB - PAYK }];
    if (k) { const n = ikiYonDenetle(k, bo.x - BOMBA_GOR, hA, hY, bo.x + RB); if (n) kusur(t, s, 'bomba: ' + n); }
    [hA, hY].forEach(h => { Ylist.push(h[0].y); if (!koridorAcik(h[0].y, bo.x - RB, bo.x + RB, zarfTum)) kusur(t, s, 'bomba kacis seviyesi engel zarfinda'); });
  }
  if (s.sarmasik) {
    const sa = s.sarmasik, sy = sa.yon === 'ust' ? 1 : -1, G = U.SARMASIK_GEN;
    ist.m.sarmasik++; ist.m.sutun += sa.sutunlar.length; if (puan >= U.CAKISMA_SERBEST) ist.m.sarmasik5000++;
    if (ozel || s.tozsuz) kusur(t, s, 'sarmasik nefes/acilis/tozsuz dilimde');
    if (puan < U.SARMASIK_PUAN) kusur(t, s, 'sarmasik esik altinda (' + puan + ')');
    if (sa.sutunlar.length < U.SARMASIK_SUTUN_MIN || sa.sutunlar.length > U.SARMASIK_SUTUN_MAX) kusur(t, s, 'sutun sayisi');
    const ort = sa.sutunlar.reduce((q, cl) => q + cl.ty, 0) / sa.sutunlar.length;
    if ((ort < H / 2) !== (sa.yon === 'ust')) kusur(t, s, 'sarmasik yakin duvardan degil');
    const hed = [], dolu = zarfTum.slice();
    sa.sutunlar.forEach(cl => {
      const i = s.toz.findIndex(tz => tz.x === cl.tx && tz.y === cl.ty);
      if (!(i > 0 && i < s.toz.length - 1)) kusur(t, s, 'sutun ic tozun hizasinda degil');
      const tip = cl.ty + sy * U.SARMASIK_TASMA;
      if (Math.abs(cl.x + cl.w / 2 - cl.tx) > 1e-9 || cl.w !== G || Math.abs((sy > 0 ? cl.y + cl.h : cl.y) - tip) > 1e-9 ||
          (sy > 0 ? cl.y !== 0 : Math.abs(cl.y + cl.h - H) > 1e-9)) kusur(t, s, 'sutun geometrisi');
      if (!(cl.x - RC > a && cl.x + cl.w + RC < b)) kusur(t, s, 'sutun dilim zarflarina degiyor');
      hed.push({ x: cl.x - RC, y: tip + sy * (RC + PAYK) });
      dolu.push({ x1: cl.x, x2: cl.x + cl.w, y1: cl.y, y2: cl.y + cl.h });
    });
    // koridor: en uc kacis seviyesi, sutunlarin ve engel zarflarinin birlesiminde her x'te acik
    const Y = sy * Math.max(...hed.map(h => sy * h.y));
    if (!koridorAcik(Y, sa.x1 - RC, sa.x2 + RC, dolu)) kusur(t, s, 'sarmasik koridoru kapali');
    sa.sutunlar.forEach((cl, j) => { if (sy * (Y - hed[j].y) < -EPS) kusur(t, s, 'koridor sutun ucunu gecmiyor'); });
    if (k) { const n = kacisDenetle(k, sy, sa.x1 - RC - zr.hiz * U.SARMASIK_ONCE, hed, sa.x2 + RC); if (n) kusur(t, s, 'sarmasik: ' + n); }
    Ylist.push(Y);
    if (s.kivilcim) kusur(t, s, 'sarmasik dilimde kivilcim');
  }
  fazBDenetle(dn, s, zf, zr, a, b, pc, c, zarfTum, ozel);
  if (!s.nefes) dn.oncekiGercek = { x: s.x, w: s.w };
  tutmaGuncelle(dn, s, c, zf, Ylist);
  dn.son = { no: s.no, x: s.x, w: s.w, c: c, tehlike: !!(s.bomba || s.sarmasik), ust: zf.ust, alt: zf.alt, nefes: s.nefes, engeller: s.engeller.map(e => Object.assign({}, e)) };
  dn.sonNo = s.no;
}

// Gorunurluk (en kotu durum: isik = 0 -> yaricap minYaricap, bocek ayni yukseklikte -> yatay mesafe)
// ve varis (on kenar bocegin onune degdigi an). Zamanlar adim icinde dogrusal ara degerlemeyle.
// Iz durumu ayri kuyrukta tutulur; cekirdegin nesnelerine alan eklenmez.
function izBaslat(dn, s) {
  const h = s.engeller.length ? s.engeller.slice() : [s];   // nefes: dilimin kendisi
  dn.aktif.push({ s: s, h: h, g: h.map(() => Infinity), R: h.map(() => 0), t: h.map(() => 0),
                  gor: h.map(() => Infinity), bitti: h.map(() => false), kalan: h.length, v: Infinity });
  if (s.sarmasik || s.bomba) dn.tehlike.push({ s: s, uyari: null, buyume: null, gor: null });
}
// Sarmasik: uyari suresi (faz 1) >= T_MIN; uyari baslangicindan bocegin ilk sutuna varisina sure >= SARMASIK_ONCE
// (bir adim toleransla) ve >= T_MIN + T_IVME + kacis(TASMA + R_CARPMA + PAY). Bomba: ekrana girişten carpma
// mesafesine (R_BOMBA + R_CARPMA) sure >= T_MIN. Zamanlar adim icinde dogrusal ara degerlemeyle.
const SA_KACIS = A.adalet.T_MIN + T_IVME + AB.kacisSuresi(U.SARMASIK_TASMA + RC + PAYK, 0, -Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL)) + A.adalet.PAY_KACIS_SN;   // olculen: >= ONCE - DT >= bu
function tehlikeZamanDenetle(dn, d, bx0, t0) {
  const bx = d.mesafe + XB, ara = (x) => t0 + (d.t - t0) * (x - bx0) / (bx - bx0);
  for (let i = 0; i < dn.tehlike.length; i++) {
    const k = dn.tehlike[i], s = k.s, sa = s.sarmasik;
    if (sa) {
      if (k.uyari === null && sa.faz >= 1) k.uyari = d.t;
      if (k.buyume === null && sa.faz >= 2) k.buyume = d.t;
      if (bx + RC >= sa.x1) {
        ist.z.sarmasik++;
        const v = ara(sa.x1 - RC);
        if (k.uyari === null || k.buyume === null) kusur(dn.t, s, 'sarmasik bocek varmadan buyumedi');
        else {
          const u = k.buyume - k.uyari, uv = v - k.uyari;
          ist.z.enAzUyari = Math.min(ist.z.enAzUyari, u); ist.z.enAzUyariVaris = Math.min(ist.z.enAzUyariVaris, uv);
          if (u < A.adalet.T_MIN - EPS) kusur(dn.t, s, 'sarmasik uyarisi ' + u.toFixed(4) + ' sn < T_MIN');
          if (uv < U.SARMASIK_ONCE - DT - 1e-6 || uv < SA_KACIS - 1e-6) kusur(dn.t, s, 'sarmasik uyari->varis ' + uv.toFixed(4) + ' sn');
        }
        dn.tehlike.splice(i--, 1);
      }
    } else {
      const bo = s.bomba;
      if (k.gor === null && bo.x - bx <= BOMBA_GOR) k.gor = bo.x - bx0 > BOMBA_GOR ? ara(bo.x - BOMBA_GOR) : d.t;
      if (bx >= bo.x - RB) {
        ist.z.bomba++;
        const gv = ara(bo.x - RB) - k.gor;
        ist.z.enAzBombaGorVaris = Math.min(ist.z.enAzBombaGorVaris, gv);
        if (!(gv >= BOMBA_KACIS_SN - 1e-9)) kusur(dn.t, s, 'bomba carpma mesafesine ' + gv.toFixed(4) + ' sn kala gorundu (< ' + BOMBA_KACIS_SN.toFixed(4) + ')');
        dn.tehlike.splice(i--, 1);
      }
    }
  }
}
function zamanDenetle(dn, d) {
  const bx = d.mesafe + XB, R0 = AB.minYaricap(AB.zorluk(d.mesafe).hiz);
  for (let i = 0; i < dn.aktif.length; i++) {
    const k = dn.aktif[i], s = k.s;
    for (let j = 0; j < k.h.length; j++) {
      if (k.bitti[j]) continue;
      const e = k.h[j], g = Math.max(0, e.x - bx);
      if (k.g[j] === Infinity) {
        if (g <= R0) kusur(dn.t, s, 'engel ilk kez gorunur alanda dogdu');
        k.g[j] = g; k.R[j] = R0; k.t[j] = d.t;
        continue;
      }
      if (k.gor[j] === Infinity && e !== s && g <= R0) {
        const a0 = k.g[j] - k.R[j], a1 = g - R0;
        k.gor[j] = k.t[j] + DT * a0 / (a0 - a1);
      }
      if (g <= RC) {
        const v = k.t[j] + DT * (k.g[j] - RC) / (k.g[j] - g);
        if (e !== s) {
          const pay = v - k.gor[j];
          ist.enAzPay = Math.min(ist.enAzPay, pay);
          if (!(pay >= T_MIN - EPS)) kusur(dn.t, s, 'engel varisa ' + pay.toFixed(4) + ' sn kala gorundu');
        }
        k.bitti[j] = true; k.kalan--; if (v < k.v) k.v = v;
        continue;
      }
      k.g[j] = g; k.R[j] = R0; k.t[j] = d.t;
    }
  }
  // kural 2 (olculen): ardisik dilimlerin varis zamanlari arasi >= tAra
  while (dn.aktif.length && dn.aktif[0].kalan === 0) {
    const k = dn.aktif.shift(), s = k.s;
    if (dn.sonVaris) {
      const ara = k.v - dn.sonVaris.v;
      if (s.no !== dn.sonVaris.no + 1) kusur(dn.t, s, 'varis sirasi');
      ist.enAzAra = Math.min(ist.enAzAra, ara - s.tAra);
      if (ara < s.tAra - 1e-6) kusur(dn.t, s, 'olculen varis arasi ' + ara + ' < tAra');
    }
    dn.sonVaris = { no: s.no, v: k.v };
  }
}

// ---------------------------------------------------------------
// Botlar
// ---------------------------------------------------------------
// Denetleyici: istenen hiz hedef farkiyla orantili, fren mesafesiyle sinirli (yarim zayif ivmeyle durabilecek
// kadar); karar rampa gecikmesi kadar ilerideki tahmini hizla verilir (11.1 rampasi asimi buyutur).
// sert: tehlikeden kacarken neredeyse zaman-optimal (fren ivmesi zayif yonun %90'i).
const KP = 6, A_FREN = 0.5 * Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL), A_SERT = 0.9 * Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL);
function kontrol(d, hedef, sert) {
  const e = hedef - d.y, ae = Math.abs(e);
  const v = Math.max(-A.hareket.VY_YUKARI, Math.min(A.hareket.VY_ASAGI, Math.sign(e) * Math.min(sert ? Infinity : KP * ae, Math.sqrt(2 * (sert ? A_SERT : A_FREN) * ae))));
  return d.vy + d.ay * A.hareket.T_RAMPA > v;      // basili: yukari ivme
}
// Tehlikeden kacis (tasarim 11.5, 11.7). Plan: bocek merkezi [x1, x2] boyunca Y seviyesinin otesinde (sy yonunde)
// kalir. Sarmasikta yon sabittir (yakin duvarin tersi), Y = sutun uclarinin en ucu + R_CARPMA + PAY.
// Bombada yan, plan ilk kullanildiginda botun o anki durumundan (y, vy, ay) kacisMesafesi ile en cok pay birakan
// yandir; uretici her olasi durumda en az bir yanin kacilabilir oldugunu garanti eder. Bot hedefi MBOT kadar oteye koyar (P denetleyici
// hedefe asimptotik yaklasir).
const MBOT = 1.5;
function tehlikePlani(s) {
  if (s.bomba) return { bomba: s.bomba, x1: s.bomba.x - RB, x2: s.bomba.x + RB, sy: 0, Y: 0 };
  if (s.sarmasik) {
    const sa = s.sarmasik, sy = sa.yon === 'ust' ? 1 : -1;
    const Y = sy * Math.max(...sa.sutunlar.map(c => sy * (c.ty + sy * (U.SARMASIK_TASMA + RC + PAYK))));
    return { x1: sa.x1 - RC, x2: sa.x2 + RC, sy: sy, Y: Y };
  }
  return null;
}
// Bot B'nin bildigi sarmasik plani (tasarim 11.7, K1): uyari baslayinca (T_MIN sonra) yon ve her sutunun uc
// yuksekligi bilinir (UI faz 1'de hayalet siluet + unlem gosterir); sutunun x'i yalniz sutun ekrandaysa
// (x - bx <= W - X_BOCEK) bilinir, degilse en erken varis varsayilir (x = bx + W - X_BOCEK).
function sarmasikBilinen(sa, bx) {
  const sy = sa.yon === 'ust' ? 1 : -1;
  let uc = -Infinity, x1 = Infinity, x2 = -Infinity;
  for (const c of sa.sutunlar) {
    const tip = sy > 0 ? c.y + c.h : c.y, cx = c.x - bx <= EKRAN ? c.x : bx + EKRAN;
    uc = Math.max(uc, sy * (tip + sy * (RC + PAYK)));
    x1 = Math.min(x1, cx - RC); x2 = Math.max(x2, cx + c.w + RC);
  }
  return { x1: x1, x2: x2, sy: sy, Y: sy * uc };
}
// bant: bocek henuz gecmedigi onceki dilimin serbest bandi {lo, hi} (tehlike o dilimin arkasindaysa).
// Donus: null ya da {y, sert}; bant icinde yumusak denetim (asim engele carpar), disinda sert (zaman-optimal).
function kacisHedefi(d, bx, pl, bant) {
  if (!pl || bx > pl.x2 + 0.5) return null;
  if (pl.bomba && !pl.sy) {
    const t = Math.max(0, (pl.x1 - bx) / AB.zorluk(d.mesafe).hiz);
    let en = -Infinity;
    for (const sy of [1, -1]) {
      // pay (birim): t sn'de tam girdiyle alinan yol - gereken yol; botun gercek y, vy, ay'siyla
      const p = AB.kacisMesafesi(t, sy * d.vy, sy * d.ay) - sy * (pl.bomba.y + sy * (RB + PAYK) - d.y);
      if (p > en) { en = p; pl.sy = sy; }
    }
    pl.Y = pl.bomba.y + pl.sy * (RB + PAYK);
  }
  const y = pl.Y + pl.sy * MBOT;
  return bant ? { y: Math.max(bant.lo, Math.min(bant.hi, y)), sert: false, x2: pl.x2 } : { y: y, sert: true, x2: pl.x2 };
}
const bantOf = s => ({ lo: s.ust + RC + 1, hi: s.alt - RC - 1 });
// Ideal botlar icin: ilk = gecilmemis ilk dilim, ikinci = sonraki. ilk'in tehlikesi bocegin bulundugu araliktadir;
// ikinci'ninki ilk'in arkasindadir (bocek ilk'in bandindan cikamaz).
function idealKacis(d, bx, planlar, ilk, ikinci) {
  const al = s => { if (!planlar.has(s)) planlar.set(s, tehlikePlani(s)); return planlar.get(s); };
  let y = kacisHedefi(d, bx, al(ilk), null);
  if (y === null && ikinci) y = kacisHedefi(d, bx, al(ikinci), bantOf(ilk));
  return y;
}
function ilkIkinci(L, bx) {
  let ilk = null;
  for (const s of L) if (s.x + s.w + RC >= bx) { if (!ilk) ilk = s; else return [ilk, s]; }
  return [ilk, null];
}
// Bot A: siradaki (gecilmemis) dilimin bosluk merkezini gecikmesiz hedefler; bomba/sarmasiktan kacar.
function botA() {
  const planlar = new Map();
  return d => {
    const bx = d.mesafe + XB, [ilk, ikinci] = ilkIkinci(d.dilimler, bx);
    if (!ilk) return kontrol(d, d.y);
    const y = idealKacis(d, bx, planlar, ilk, ikinci);
    if (y !== null) return kontrol(d, y.y, y.sert);
    const z = AB.dilimZarfi(ilk); return kontrol(d, (z.ust + z.alt) / 2);
  };
}
// Bot D: Bot A gibi gecikmesiz; siradaki dilimin onunde alinmamis kivilcim varsa once onu hedefler,
// kivilcimi gecince bosluga doner. Kivilcim denemeleri kayit'a yazilir: {s, carpti}.
function botD(kayit) {
  const planlar = new Map();
  return d => {
    const bx = d.mesafe + XB, [s, ikinci] = ilkIkinci(d.dilimler, bx);
    if (!s) return kontrol(d, d.y);
    const k = s.kivilcim;
    if (k) {
      if (!kayit.has(s)) kayit.set(s, { carpti: false });
      if (!k.alindi && k.x + RT >= bx) return kontrol(d, k.y);
    }
    const y = idealKacis(d, bx, planlar, s, ikinci);
    if (y !== null) return kontrol(d, y.y, y.sert);
    const z = AB.dilimZarfi(s);
    return kontrol(d, (z.ust + z.alt) / 2);
  };
}
function cemberKesar(e, bx, by, r) {
  const cx = Math.max(e.x, Math.min(bx, e.x + e.w)), cy = Math.max(e.y, Math.min(by, e.y + e.h));
  return (bx - cx) * (bx - cx) + (by - cy) * (by - cy) <= r * r;
}
// Bot B: yalniz isik cemberine giren seyi gorur (engel -> dilimin boslugu, toz -> konumu),
// gordugunden T_MIN sonra kullanir. sabit: yaricap isik = 0'a gore (en kotu durum).
// Bomba ve sarmasik kendi isigiyla gorunur (11.5, 11.7): bomba ekrana girdigi an (konumu), sarmasik uyarisi
// basladigi an (yon + sutun uclari; sutun x'i yalniz ekrandaysa, bkz. sarmasikBilinen); bot bunlari T_MIN sonra
// kullanir. Tehlike siradaki engelin arkasindaysa (uyari o yaydadir) ve o engelin bandi henuz bilinmiyorsa (T_MIN
// dolmadi) kacisa baslamaz; bu yalniz botu temkinli yapar, kacisa bilgi katmaz.
// Gorulme anlari botun kendi kuyrugunda tutulur; cekirdegin nesnelerine alan eklenmez.
function botB(sabit) {
  let sonHedef = null, sonNo = -1, kacisX = -Infinity, kacisY = 0;   // son kacis plani: x2 ve tutulan seviye
  const kuyruk = [], yp = new Float64Array(512);   // bilinen yol noktalari: x0, y0, x1, y1, ...
  return d => {
    const bx = d.mesafe + XB, by = d.y, hiz = AB.zorluk(d.mesafe).hiz;
    const R = AB.isikYaricapi(sabit ? 0 : d.isik, hiz, d.gorunenBolge), R2 = R * R, sinir = d.t - T_MIN + EPS;
    const L = d.dilimler;
    for (let i = 0; i < L.length; i++) {
      if (L[i].no <= sonNo) continue;
      const s = L[i]; sonNo = s.no;
      const z = AB.dilimZarfi(s);
      // Secici (12.2): engelin x araligindaki (dalin ustundeki) tozu yol saymaz. Gizli bilgi kullanmaz: o toz dalin
      // icinde oldugu icin isik cemberine girdigi adimda dal da cembere girmistir; filtre bota bilgi katmaz.
      kuyruk.push({ s: s, c: (z.ust + z.alt) / 2, gor: Infinity, toz: s.toz.filter(t => t.x < s.x - RC).map(t => ({ x: t.x, y: t.y, gor: Infinity })),
                   tp: tehlikePlani(s), tgor: Infinity });
    }
    while (kuyruk.length > 1 && kuyruk[1].s.x + kuyruk[1].s.w + RC < bx) kuyruk.shift();   // gecilmis dilimlerden biri kalir
    let n = 0;
    for (let i = 0; i < kuyruk.length; i++) {
      const k = kuyruk[i], s = k.s, tz = k.toz;
      if (k.gor === Infinity && tz.length && tz[0].x - bx > R) break;   // bu ve sonrakiler henuz gorunmez
      for (let j = 0; j < tz.length; j++) {
        const t = tz[j];
        if (t.gor === Infinity && (t.x - bx) * (t.x - bx) + (t.y - by) * (t.y - by) <= R2) t.gor = d.t;
        if (t.gor <= sinir) { yp[n++] = t.x; yp[n++] = t.y; }
      }
      if (k.gor === Infinity) {
        for (let j = 0; j < s.engeller.length; j++) {
          const e = s.engeller[j];
          if (e.x - bx <= R && cemberKesar(e, bx, by, R)) { k.gor = d.t; break; }
        }
      }
      if (k.gor <= sinir) { yp[n++] = s.x - RC; yp[n++] = k.c; yp[n++] = s.x + s.w + RC; yp[n++] = k.c; }
    }
    const q = bx + hiz * 0.1;
    let hedef = null;
    for (let i = 0; i < n; i += 2) {
      if (yp[i] >= q) {
        hedef = i === 0 ? yp[1] : yp[i - 1] + (yp[i + 1] - yp[i - 1]) * (q - yp[i - 2]) / (yp[i] - yp[i - 2]);
        break;
      }
    }
    // bilinen yol bitti: son nokta son kacistan onceyse (eski) kacis seviyesinde bekle, degilse son noktada
    if (hedef === null && n) hedef = yp[n - 2] > kacisX ? yp[n - 1] : kacisY;
    if (hedef === null) hedef = sonHedef === null ? by : sonHedef;
    sonHedef = hedef;
    // tehlike: kendi isigiyla gorunme + T_MIN
    let ilk = -1;
    for (let i = 0; i < kuyruk.length; i++) {
      const k = kuyruk[i], s = k.s;
      if (k.tp && k.tgor === Infinity && (s.bomba ? s.bomba.x - bx <= BOMBA_GOR : s.sarmasik.faz >= 1)) k.tgor = d.t;
      if (s.sarmasik && k.tgor <= sinir) k.tp = sarmasikBilinen(s.sarmasik, bx);
      if (ilk < 0 && s.x + s.w + RC >= bx) ilk = i;
    }
    if (ilk >= 0) {
      const k1 = kuyruk[ilk], k2 = kuyruk[ilk + 1];
      let y = k1.tgor <= sinir ? kacisHedefi(d, bx, k1.tp, null) : null;
      if (y === null && k2 && k2.tgor <= sinir && k1.gor <= sinir) y = kacisHedefi(d, bx, k2.tp, bantOf(k1.s));
      if (y !== null) { kacisX = y.x2; kacisY = y.y; return kontrol(d, y.y, y.sert); }
    }
    return kontrol(d, hedef);
  };
}

// ---------------------------------------------------------------
// Kosu
// ---------------------------------------------------------------
// secenek: isikSabit, zaman (zaman denetimi: Bot A), yapi (yapisal denetim; dilim dizisi puana bagli oldugu icin
// her kosuda), kayit (Bot D), mesafe.
function kos(t, bot, secenek) {
  const d = AB.oyunOlustur(t, secenek.bas), dn = yeniDenetci(t, (secenek.bas ? secenek.bas.mesafe : 0) + XB), hedefMesafe = secenek.mesafe || MESAFE;
  // 13: olum nedenleri (olay turu / engel turu / bitis sebebi) ve kademe olaylari (sirayla, esigi gecen adimda, her biri bir kez)
  const neden = {}; let kdSon = AB.kademeNo(d.mesafe);
  const mek = { tozsuz: [], bomba: [], sarmasik: [] };
  // (b) esik: her tur icin esigi gecen ilk nefes olmayan dilim; ekrana (ESIK_EKRAN) varista gercek puan - esik
  const denetle = secenek.yapi || secenek.zaman, izE = ESIK_TUR.map(() => null), kayE = ESIK_TUR.map(() => ESIK_EKRAN.map(() => false));
  const olcE = denetle && secenek.ad ? (esikOlc[secenek.ad] = esikOlc[secenek.ad] || ESIK_TUR.map(() => ESIK_EKRAN.map(() => []))) : null;
  const esikBak = () => {
    for (let j = 0; j < ESIK_TUR.length; j++) {
      const s = izE[j]; if (!s) continue;
      for (let e = 0; e < ESIK_EKRAN.length; e++) {
        if (kayE[j][e] || s.x - d.mesafe > ESIK_EKRAN[e]) continue;
        kayE[j][e] = true; const fark = d.puan - ESIK_TUR[j][1];
        if (olcE) olcE[j][e].push(fark);
        if (e === 0 && !(fark >= -ESIK_TOL)) kusur(t, s, ESIK_TUR[j][0] + ' esigi erken: esigi gecen ilk dilim ekran x = W konumunda, gercek puan ' + d.puan + ' < ' + ESIK_TUR[j][1] + ' - ' + ESIK_TOL);
      }
    }
  };
  const yeni = () => {
    const L = d.dilimler; let i = L.length; while (i > 0 && L[i - 1].no > dn.sonNo) i--;
    for (; i < L.length; i++) {
      const s = L[i];
      if (s.tozsuz) mek.tozsuz.push(s); if (s.bomba) mek.bomba.push(s); if (s.sarmasik) mek.sarmasik.push(s);
      if (denetle) {
        dilimDenetle(dn, s, d.puan);
        if (!s.nefes) ESIK_TUR.forEach(([, T], j) => { if (!izE[j] && s.puan >= T) izE[j] = s; });
      } else dn.sonNo = s.no;
      if (secenek.zaman) izBaslat(dn, s);
    }
  };
  yeni();
  let carpma = 0, bomba = 0, enAzIsik = d.isik, adimSay = 0, bolge = d.bolge, yutuldu = 0, uyari = 0, sersem = 0, zemin = 0;
  while (d.mesafe < hedefMesafe && !d.bitti) {
    if (secenek.isikSabit) d.isik = 1;
    const bx0 = d.mesafe + XB, t0 = d.t;
    const olay = AB.adim(d, bot(d));
    for (const o of olay) {
      const k = o.tur === 'hasar' ? 'hasar/' + o.engel : o.tur === 'bitti' ? 'bitti/' + o.sebep : o.tur;
      if (o.tur === 'hasar' || o.tur === 'ag' || o.tur === 'bomba' || o.tur === 'sarmasik' || o.tur === 'sersem' || o.tur === 'zemin' || o.tur === 'bitti') neden[k] = (neden[k] || 0) + 1;
      if (o.tur === 'kademe') {
        ist.f.kademeOlay++;
        const K = A.zorluk.KADEME[o.kademe - 1];
        if (!(o.kademe === kdSon + 1 && bx0 - XB < K && d.mesafe >= K && d.kademe === o.kademe)) kusur(t, null, 'kademe olayi ' + o.kademe + ' (onceki ' + kdSon + ', mesafe ' + d.mesafe.toFixed(2) + ')');
        kdSon = o.kademe;
      }
    }
    adimSay++;
    yeni();
    if (denetle) esikBak();
    if (d.bolge !== bolge) { bolge = d.bolge; dn.nefesBekle = true; }   // sonraki uretilen dilim nefes olmali
    for (const o of olay) {
      if (o.tur === 'yutuldu') yutuldu++;
      if (o.tur === 'sersem') sersem++;                 // 12.1: tavana degme (sersemlik)
      if (o.tur === 'zemin') zemin++;                   // 12.1: zemin olumu
      if (o.tur === 'sarmasikUyari') uyari++;
      if (o.tur === 'bomba') bomba++;
      if (o.tur === 'hasar' || o.tur === 'ag' || o.tur === 'sarmasik' || o.tur === 'bomba') {
        if (o.tur !== 'bomba') carpma++;
        if (secenek.kayit) { const bx = d.mesafe + XB, s = d.dilimler.find(q => q.x + q.w + RC >= bx); if (s && secenek.kayit.has(s)) secenek.kayit.get(s).carpti = true; }
      }
      if (o.tur === 'bolge' && secenek.zaman) {
        const bx = d.mesafe + XB, hiz = AB.zorluk(d.mesafe).hiz;
        ist.bolgeOlay++;
        if (d.gorunenBolge !== o.bolge || !d.dilimler.some(q => q.nefes && q.bolge === o.bolge && q.x <= bx && q.x > bx - hiz * DT - 1e-6))
          kusur(t, null, 'bolge olayi nefes diliminin varisinda degil');
      }
    }
    if (secenek.zaman) { zamanDenetle(dn, d); tehlikeZamanDenetle(dn, d, bx0, t0); }
    if (d.isik < enAzIsik) enAzIsik = d.isik;
  }
  if (kdSon !== AB.kademeNo(d.mesafe)) kusur(t, null, 'kademe olayi eksik: ' + kdSon + ' / ' + AB.kademeNo(d.mesafe));
  const bx = d.mesafe + XB, gecilen = L => L.filter(s => s.x + s.w < bx).length;
  return { d: d, neden: neden, carpma: carpma, bomba: bomba, enAzIsik: enAzIsik, adim: adimSay, yutuldu: yutuldu, uyari: uyari, sersem: sersem, zemin: zemin,
           tozsuz: gecilen(mek.tozsuz), bombaDilim: gecilen(mek.bomba), sarmasikDilim: gecilen(mek.sarmasik), puan: d.puan };
}

console.log('Ates Bocegi adalet: ' + TOHUM_SAYI + ' tohum x ' + MESAFE + ' birim');
const bas = Date.now();
const sonuc = { A: [], B: [], Bg: [], C0: [], C1: [], uA: [], uB: [] }, kivD = { deneme: 0, alinan: 0, temiz: 0, carpma: 0, tohumCarpma: 0, sersem: 0, zemin: 0 };
const ozet = r => ({ t: r.t, c: r.carpma, b: r.bomba, s: r.sersem, z: r.zemin, m: r.d.mesafe, puan: r.puan, tozsuz: r.tozsuz, bomba: r.bombaDilim,
                     sarmasik: r.sarmasikDilim, yutuldu: r.yutuldu, uyari: r.uyari });
for (let i = 0; i < TOHUM_SAYI; i++) {
  const t = tohum(i);
  const a = kos(t, botA(), { isikSabit: true, zaman: true, ad: 'A' });   // zaman denetimi geometriye bagli: A kosusunda
  sonuc.A.push(Object.assign(ozet(Object.assign(a, { t: t }))));
  const kayit = new Map(), dk = kos(t, botD(kayit), { isikSabit: true, kayit: kayit });
  kivD.carpma += dk.carpma; if (dk.carpma) kivD.tohumCarpma++; kivD.sersem += dk.sersem; kivD.zemin += dk.zemin;
  for (const [s, k] of kayit) {
    if (s.x + s.w + RC >= dk.d.mesafe + XB) continue;   // kosu bitiminde gecilmemis
    kivD.deneme++;
    if (s.kivilcim.alindi) kivD.alinan++;
    if (s.kivilcim.alindi && !k.carpti) kivD.temiz++;
  }
  const b = kos(t, botB(true), { isikSabit: true, yapi: true, ad: 'B' });
  sonuc.B.push(ozet(Object.assign(b, { t: t })));
  const bg = kos(t, botB(false), { yapi: true, ad: 'Bg' });
  sonuc.Bg.push(Object.assign(ozet(Object.assign(bg, { t: t })), { isik: bg.enAzIsik, bitti: bg.d.bitti }));
  [[false, 'C0'], [true, 'C1']].forEach(([bas, ad]) => {
    const c = kos(t, () => bas, {});
    sonuc[ad].push({ t: t, sure: c.d.t, toz: c.d.toz, bitti: c.d.bitti, sebep: c.d.sebep, sersem: c.sersem,
                     jeton: AB.kosuJetonu(c.d.puan, c.d.toz, 0, A).jeton, puan: c.d.puan });
  });
}
// Uzun mesafe alt kumesi: 5000+ puanda (cakisma serbest) tozsuz + sarmasik birlikte; Bot A ve Bot B (isik 0).
for (let i = 0; i < UZUN_TOHUM; i++) {
  const t = tohum(100000 + i);
  sonuc.uA.push(ozet(Object.assign(kos(t, botA(), { isikSabit: true, zaman: true, mesafe: UZUN_MESAFE, ad: 'uA' }), { t: t })));
  sonuc.uB.push(ozet(Object.assign(kos(t, botB(true), { isikSabit: true, yapi: true, mesafe: UZUN_MESAFE, ad: 'uB' }), { t: t })));
}
// Bot S (12.1, tavan sersemlemesi): Bot A her 3-6 sn'de bir bilerek tavana carpar; sersemken girdisi rastgele
// (etkisiz olmali), uyandiktan sonra T_MIN boyunca birakili kalir (en kotu tepki), sonra Bot A'ya doner.
// Olculen: zemin olumu (0 olmali: uyanma yuksekligi + T_MIN dususu < Y_ALT), zemin payi, sersem basina hasar/toz.
const SERSEM_TOHUM = +process.argv[6] || 60, SERSEM_MESAFE = 6000;
const bs = { sersem: 0, zemin: 0, hasarSersem: 0, hasarUyanis: 0, toz: 0, enAzPay: Infinity, kor: 0 };
for (let i = 0; i < SERSEM_TOHUM; i++) {
  const t = tohum(200000 + i), d = AB.oyunOlustur(t), bot = botA(), r = AB.rngOlustur(t);
  let faz = 'normal', sonraki = 3 + 3 * r(), uyanT = 0, enAltY = 0;
  while (d.mesafe < SERSEM_MESAFE && !d.bitti) {
    d.isik = 1;
    const g = faz === 'normal' ? bot(d) : faz === 'cik' ? true : faz === 'sersem' ? r() < 0.5 : (d.t - uyanT < T_MIN - EPS ? false : bot(d));
    if (faz === 'normal' && d.t >= sonraki) faz = 'cik';
    for (const o of AB.adim(d, g)) {
      if (o.tur === 'sersem') { faz = 'sersem'; bs.sersem++; }
      else if (o.tur === 'uyandi') { faz = 'uyanis'; uyanT = d.t; enAltY = d.y; }
      else if (o.tur === 'zemin') bs.zemin++;
      else if (o.tur === 'toz' && faz === 'sersem') bs.toz++;
      else if (o.tur === 'hasar' || o.tur === 'ag' || o.tur === 'sarmasik' || o.tur === 'bomba') { if (faz === 'sersem') bs.hasarSersem++; else if (faz === 'uyanis') bs.hasarUyanis++; }
    }
    if (faz === 'uyanis') {
      enAltY = Math.max(enAltY, d.y); if (d.zeminKoruma > 0 && d.y >= Y_ALT) bs.kor++;
      if (d.t - uyanT >= 1.5) { bs.enAzPay = Math.min(bs.enAzPay, Y_ALT - enAltY); faz = 'normal'; sonraki = d.t + 3 + 3 * r(); }
    }
  }
}
// Ust hiz kumesi (13, B.3): kosu 60000 birimden ve puan 6000 ile baslar (hiz 44 tavanda, tAra ~1,25, bosluk ~16, kademe 5:
// salinan en sik ve en genis, isik tam duzensiz; bomba/sarmasik/tozsuz esikleri gecilmis). Bot A (sabit isik, zaman denetimi),
// Bot B (isik 0 sabit, T_MIN gecikmeli) ve Bot B gercek isikla; yapisal denetim her kosuda. Olum nedenleri raporlanir (hedef 0).
const UST_TOHUM = process.argv[7] !== undefined ? +process.argv[7] : 200, UST_BAS = { mesafe: 60000, puan: 6000 }, UST_UZUN = 6000;
const ust = { A: [], B: [], Bg: [] };
for (let i = 0; i < UST_TOHUM; i++) {
  const t = tohum(500000 + i), sec = o => Object.assign({ bas: UST_BAS, mesafe: UST_BAS.mesafe + UST_UZUN }, o);
  const ua = kos(t, botA(), sec({ isikSabit: true, zaman: true }));
  ust.A.push(Object.assign(ozet(Object.assign(ua, { t: t })), { neden: ua.neden }));
  const ub = kos(t, botB(true), sec({ isikSabit: true, yapi: true }));
  ust.B.push(Object.assign(ozet(Object.assign(ub, { t: t })), { neden: ub.neden }));
  const ug = kos(t, botB(false), sec({ yapi: true }));
  ust.Bg.push(Object.assign(ozet(Object.assign(ug, { t: t })), { neden: ug.neden, isik: ug.enAzIsik, bitti: ug.d.bitti, hiz: AB.zorluk(ug.d.mesafe).hiz }));
}
// Bagimsiz ulasilabilirlik benzetimi (13, denetci): cekirdegin isikUlasir / kacisMesafesi / benzet'ini KULLANMAZ. adim()
// butunlemesinin aynisi (ivme rampasi, hiz siniri), gercek A_YUKSEL / G_SUZUL; frenli bang-bang oyuncu. Onceki boslugun
// merkezinde (x = a + R_CARPMA, durgun) baslar; 1. bacak tozun R_TOPLA'sina, 2. bacak sonraki boslugun serbest bandina
// (merkezden g2/2 - R_CARPMA) b - R_CARPMA'da; duvara (Y_UST / Y_ALT) degmez. Duzensiz dilimlerin her tozu.
const UB_TOHUM = 120, UB_MESAFE = 30000, UB_K = 1 - Math.exp(-DT / A.hareket.T_RAMPA);
function ubAdim(s, bas) {
  s.ay += ((bas ? -A.hareket.A_YUKSEL : A.hareket.G_SUZUL) - s.ay) * UB_K; s.vy += s.ay * DT;
  if (s.vy < -A.hareket.VY_YUKARI) s.vy = -A.hareket.VY_YUKARI; else if (s.vy > A.hareket.VY_ASAGI) s.vy = A.hareket.VY_ASAGI;
  s.y += s.vy * DT;
}
function ubFren(s) { const q = { y: 0, vy: s.vy, ay: s.ay }, bas = s.vy > 0; let n = 0; while (n++ < 400 && (bas ? q.vy > 0 : q.vy < 0)) ubAdim(q, bas); return q.y; }
const ubKontrol = (s, hedef) => s.y + ubFren(s) > hedef;     // durunca hedefin altinda kalacaksa yuksel
function ubDene(a, b, c1, c2, g2, hiz, tz) {
  const s = { y: c1, vy: 0, ay: 0 }; let x = a + RC, enYakin = Infinity, alindi = false;
  while (x < b - RC) {
    ubAdim(s, ubKontrol(s, alindi ? c2 : tz.y)); x += hiz * DT;
    if (!alindi) { const dd = Math.hypot(x - tz.x, s.y - tz.y); enYakin = Math.min(enYakin, dd); if (dd <= RT) alindi = true; if (x > tz.x + RT) break; }
    if (s.y < Y_UST || s.y > Y_ALT) return { ok: false, neden: 'duvar', pay: -1 };
  }
  if (!alindi) return { ok: false, neden: 'toz', pay: enYakin - RT };
  while (x < b - RC) { ubAdim(s, ubKontrol(s, c2)); x += hiz * DT; }
  const ic = g2 / 2 - RC, pay = ic - Math.abs(s.y - c2);
  return { ok: pay >= -1e-9, neden: pay >= -1e-9 ? '' : 'bosluk', pay: pay };
}
const ub = { toz: 0, kot: { toz: 0, bosluk: 0, duvar: 0 }, ornek: [], enAzPay: Infinity };
for (let t = 1; t <= UB_TOHUM; t++) {
  const u = AB.ureticiOlustur(t); let p = null;
  for (let i = 0; ; i++) {
    const pu = 2500 + i * 3, s = u.sonraki(AB.bolgeNo(pu), pu); if (s.x - XB > UB_MESAFE) break;
    if (p && s.dag > 0) s.toz.forEach(tz => {
      ub.toz++; const r = ubDene(p.x + p.w, s.x, p.c, s.c, s.alt - s.ust, s.hiz, tz);
      if (r.ok) ub.enAzPay = Math.min(ub.enAzPay, r.pay);
      else { ub.kot[r.neden]++; if (ub.ornek.length < 3) ub.ornek.push('tohum ' + t + ' dilim ' + s.no + ' ' + r.neden + ' ' + r.pay.toFixed(3)); }
    });
    p = s;
  }
}
const sure = ((Date.now() - bas) / 1000).toFixed(1);

dene('kivilcim orani: tum dilimler >= %3, d > 10000 dilimleri > %1', () => {
  const tum = ist.kivilcim / ist.dilim, uzak = ist.uzakKivilcim / ist.uzakDilim;
  console.log('       tum %' + (100 * tum).toFixed(2) + ', d>10000 %' + (100 * uzak).toFixed(2) + ' (' + ist.uzakDilim + ' dilim)');
  assert.ok(tum >= 0.03, 'tum ' + tum); assert.ok(uzak > 0.01, 'uzak ' + uzak);
});
const kotu = (dizi, f) => dizi.filter(f).slice(0, 5).map(x => x.t).join(',');
dene('yapisal kurallar 1-9 + T_MIN gorunurluk (' + ist.dilim + ' dilim)', () => {
  assert.strictEqual(ist.kusur.length, 0, ist.kusur.length + ' kusur: ' + ist.kusur.slice(0, 8).join(' | '));
});
// (b) esik telafisi: ayrinti kusur listesinde de (yukaridaki yapisal test); burada tur basina olcum ve ayri denetim.
{
  const ozet = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? 'n' + b.length + ' min ' + b[0] + ' med ' + b[b.length >> 1] : 'n0'; };
  const tum = ESIK_TUR.map(() => ESIK_EKRAN.map(() => []));
  Object.keys(esikOlc).forEach(ad => esikOlc[ad].forEach((te, j) => te.forEach((l, e) => { tum[j][e].push(...l); })));
  Object.keys(esikOlc).forEach(ad => console.log('  bilgi esik ' + ad + ': ' + ESIK_TUR.map(([n, T], j) => n + ' ' + T + ' [' +
    ESIK_EKRAN.map((E, e) => 'E' + E.toFixed(0) + ' ' + ozet(esikOlc[ad][j][e])).join(', ') + ']').join('; ')));
  dene('esik telafisi: (a) uretim puani <= gercek puan + ' + TELAFI_TAVAN + '; (b) esigi gecen ilk dilim ekran x = W konumuna vardiginda gercek puan >= esik - ' + ESIK_TOL +
       ' (tozsuz ' + U.TOZSUZ_PUAN + ', bomba ' + U.BOMBA_PUAN + ', sarmasik ' + U.SARMASIK_PUAN + '; Bot A, B, Bg, uzun A/B)', () => {
    const k = ist.kusur.filter(x => / esigi erken| telafi tavanini /.test(x));
    assert.strictEqual(k.length, 0, k.length + ' kusur: ' + k.slice(0, 5).join(' | '));
    ESIK_TUR.forEach(([n], j) => assert.ok(tum[j][0].length > 0, n + ' esigi hic olculmedi'));
    ESIK_TUR.forEach(([n], j) => assert.ok(Math.min(...tum[j][0]) >= -ESIK_TOL, n + ' en kotu ' + Math.min(...tum[j][0])));
  });
}
dene('her engel ilk gorundugunde varisa >= T_MIN (en az ' + ist.enAzPay.toFixed(4) + ' sn)', () => assert.ok(ist.enAzPay >= T_MIN - EPS));
dene('tum kosular ' + MESAFE + ' birime ulasti (A, B)', () => {
  assert.ok(sonuc.A.every(x => x.m >= MESAFE) && sonuc.B.every(x => x.m >= MESAFE));
});
// carpisma = engel (hasar/ag) + sarmasik; bomba ayri sayilir; ikisi de 0 olmali.
[['A', 'Bot A (ideal)'], ['B', 'Bot B (gecikmeli, isik = 0 sabit)'], ['Bg', 'Bot B gercek isikla'],
 ['uA', 'uzun: Bot A ' + UZUN_MESAFE], ['uB', 'uzun: Bot B isik 0 ' + UZUN_MESAFE]].forEach(([ad, ac]) => {
  const r = sonuc[ad]; if (!r.length) return;
  dene(ac + ': ' + r.length + '/' + r.length + ' tohumda 0 carpisma (engel + sarmasik), 0 bomba, 0 tavan (sersem), 0 zemin', () => {
    const kot = x => x.c > 0 || x.b > 0 || x.s > 0 || x.z > 0, n = r.filter(kot).length;
    assert.strictEqual(n, 0, n + ' tohum (' + r.reduce((q, x) => q + x.c, 0) + ' carpisma, ' + r.reduce((q, x) => q + x.b, 0) + ' bomba, ' +
      r.reduce((q, x) => q + x.s, 0) + ' tavan, ' + r.reduce((q, x) => q + x.z, 0) + ' zemin): ' + kotu(r, kot));
  });
});
dene('yeni mekanikler sinandi: tozsuz pencere, bomba, sarmasik (5000 alti ve ustu), 5000+ yan yana', () => {
  const m = ist.m;
  assert.ok(m.pencere > 0 && m.bomba > 0 && m.sarmasik > 0, JSON.stringify(m));
  assert.ok(ist.f.salinan > 0 && ist.f.dag1 > 0 && ist.f.kademe[4] > 0, 'salinan / duzensiz isik / kademe 5 sinanmadi');
  assert.ok(m.sarmasik5000 > 0 && m.tozsuz5000 > 0, '5000+ sarmasik/tozsuz yok');
  assert.ok(ist.z.sarmasik > 0 && ist.z.bomba > 0, 'zaman denetimi yok');
  if (UZUN_TOHUM) assert.ok(m.cakismaYan > 0, '5000+ yan yana sarmasik-tozsuz ornegi yok');
});
dene('sarmasik uyari >= T_MIN (en az ' + ist.z.enAzUyari.toFixed(4) + ' sn), uyari->varis >= ' + U.SARMASIK_ONCE +
     ' (en az ' + ist.z.enAzUyariVaris.toFixed(4) + ' sn, degismez ' + SA_KACIS.toFixed(4) + ')', () => {
  assert.ok(ist.z.enAzUyari >= A.adalet.T_MIN - EPS && ist.z.enAzUyariVaris >= SA_KACIS - 1e-6);
});
dene('bomba on isareti: testin BOMBA_GOR sabiti (48) = AYAR (W - X_BOCEK + BOMBA_ON_ISARET)', () => assert.strictEqual(A.dunya.W - XB + U.BOMBA_ON_ISARET, BOMBA_GOR));
dene('bomba gorunur (on isaret) -> carpma mesafesi >= T_MIN + kacis + PAY_KACIS_SN = ' + BOMBA_KACIS_SN.toFixed(4) + ' sn (en az ' + ist.z.enAzBombaGorVaris.toFixed(4) + ' sn)', () => {
  assert.ok(ist.z.bomba > 0 && ist.z.enAzBombaGorVaris >= BOMBA_KACIS_SN - 1e-9);
  assert.strictEqual(ist.kusur.filter(x => /bomba carpma mesafesine/.test(x)).length, 0);
});
dene('Bot D (kivilcim kovalar): carpismasiz alma orani >= %95', () => {
  const oran = kivD.temiz / kivD.deneme;
  console.log('       ' + kivD.deneme + ' kivilcim, alinan ' + kivD.alinan + ', carpismasiz alinan ' + kivD.temiz + ' (%' + (100 * oran).toFixed(2) + '), toplam carpisma ' + kivD.carpma + ' (' + kivD.tohumCarpma + ' tohum), tavan ' + kivD.sersem + ', zemin ' + kivD.zemin);
  assert.ok(kivD.deneme > 0 && oran >= 0.95, 'oran ' + oran);
  assert.strictEqual(kivD.zemin, 0, 'kivilcim kovalarken zemin olumu');
});
dene('Bot S (bilerek tavana carpar, uyaninca T_MIN gecikmeli): ' + bs.sersem + ' sersemlikte 0 zemin olumu, zemin payi > 0', () => {
  console.log('       sersem basina hasar: sersemken ' + (bs.hasarSersem / bs.sersem).toFixed(3) + ', uyanistan sonra 1,5 sn ' + (bs.hasarUyanis / bs.sersem).toFixed(3) +
              '; sersemken toplanan toz ' + (bs.toz / bs.sersem).toFixed(2) + '; en az zemin payi ' + bs.enAzPay.toFixed(2) + ' (uyanmaY ' + AB.uyanmaY + ' + T_MIN dususu ' +
              AB.uyanmaDususu(T_MIN).toFixed(2) + '); zemin korumasina giren ' + bs.kor + ' adim');
  assert.ok(bs.sersem > 0); assert.strictEqual(bs.zemin, 0); assert.ok(bs.enAzPay > 0);
});
dene('bolge olaylari nefes varisinda (' + ist.bolgeOlay + ' olay)', () => assert.ok(ist.bolgeOlay > 0));
// ---- FAZ B (tasarim 13)
// Bolge 2 oncesi uretim: HEAD (32f4eef) cekirdeginin risk tozlari cikarilmis uretimiyle bayt bayt ayni. Ozet HEAD ile
// hesaplandi (300 tohum, puan i * 250: tozsuz/bomba/sarmasik/kivilcim ve eski risk tozu esikleri dilim 4-8'de gecilir).
// Dilimin yeni alanlari (kademe, dag) ozet disi. Uretici bilerek degisirse ozet yeniden hesaplanir.
function fnv(h, s) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
dene('Bolge 2 oncesi (varis mesafesi <= KADEME[1]) uretim HEAD ile ayni (risk tozu cikarilmis HEAD): 300 tohum, ozet c40d01b6', () => {
  let h = 0x811C9DC5, n = 0; const tur = { bomba: 0, sarmasik: 0, tozsuz: 0, kivilcim: 0 };
  for (let t = 1; t <= 300; t++) {
    const u = AB.ureticiOlustur(t);
    for (let i = 0; ; i++) {
      const p = i * 250, s = u.sonraki(AB.bolgeNo(p), p);
      if (s.x - XB > A.zorluk.KADEME[1]) break;
      if (s.bomba) tur.bomba++; if (s.sarmasik) tur.sarmasik++; if (s.tozsuz) tur.tozsuz++; if (s.kivilcim) tur.kivilcim++;
      h = fnv(0x811C9DC5, h.toString(16) + JSON.stringify(s, (k, v) => (k === 'kademe' || k === 'dag') ? undefined : v)); n++;
    }
  }
  console.log('       ' + n + ' dilim ' + JSON.stringify(tur));
  assert.deepStrictEqual([h.toString(16), n], ['c40d01b6', 3000]);
});
const F = ist.f;
dene('kademe olaylari: her kosuda esik basina bir kez, sirayla, esigi gecen adimda (' + F.kademeOlay + ' olay); rampa tavanlari (en cok hiz ' +
     F.enCokHiz.toFixed(2) + ', sizinti ' + F.enCokSizinti.toFixed(4) + ')', () => {
  const k = ist.kusur.filter(x => /kademe olayi|rampa tavani|dilim kademesi/.test(x));
  assert.strictEqual(k.length, 0, k.slice(0, 5).join(' | '));
  assert.ok(F.kademeOlay > 0 && F.enCokHiz <= A.zorluk.HIZ_TAVAN && F.enCokSizinti <= A.zorluk.SIZINTI_TAVAN + EPS);
});
dene('salinan: yalniz kademe 3+, supurulen zarf boslugu kesmez, her fazda gecit >= bosluk (en az ' + F.gecitEnAz.toFixed(3) + '; ' + F.salinan +
     ' salinan, kademe 3/4/5: ' + F.salKademe.slice(2).join('/') + ')', () => {
  const k = ist.kusur.filter(x => /salinan/.test(x));
  assert.strictEqual(k.length, 0, k.slice(0, 5).join(' | '));
  assert.ok(F.salinan > 1000 && F.salKademe[0] === 0 && F.salKademe[1] === 0 && F.gecitEnAz >= A.zorluk.BOSLUK_TABAN - A.zorluk.BOSLUK_Z - EPS);
});
dene('isik-engel: dogumda her toz/kivilcim engel zarfina (salinan supurulen) >= ISIK_MARJ ' + A.zorluk.ISIK_MARJ + ', 0 ihlal (en az ' + F.marjEnAz.toFixed(3) +
     ', ' + F.isik + ' isik); sarmasik istisnasi ayri: ' + F.sarYutulacak + ' sutun hizasi tozu', () => {
  const k = ist.kusur.filter(x => /isik engel|isik x marji|sarmasik sutun hizasi disinda/.test(x));
  assert.strictEqual(k.length, 0, k.slice(0, 5).join(' | '));
  assert.ok(F.marjEnAz >= A.zorluk.ISIK_MARJ - EPS && F.sarYutulacak > 0);
});
dene('ulasilamaz isik 0: her toz kinematik ulasilabilir (en az pay ' + F.ulasimEnAz.toFixed(3) + ' birim); duzensiz dilim ' + F.dag + ' (tam ' + F.dag1 +
     '), yaydan kayan toz ' + F.kayan + ', en buyuk toz boslugu yayin %' + (100 * F.boslukEnCok).toFixed(1), () => {
  const k = ist.kusur.filter(x => /ulasilamaz|dag /.test(x));
  assert.strictEqual(k.length, 0, k.slice(0, 5).join(' | '));
  assert.ok(F.ulasimEnAz >= -1e-9 && F.dag > 1000 && F.kayan > 1000);
});
dene('ulasilamaz isik 0 (bagimsiz benzetim, cekirdek kacis islevleri kullanilmaz): ' + UB_TOHUM + ' tohum x ' + UB_MESAFE + ' birim, ' + ub.toz +
     ' duzensiz toz; frenli bang-bang oyuncu hepsini alip sonraki bosluga giriyor (en az bosluk payi ' + ub.enAzPay.toFixed(3) + ')', () => {
  const k = ub.kot.toz + ub.kot.bosluk + ub.kot.duvar;
  assert.strictEqual(k, 0, JSON.stringify(ub.kot) + ' ' + ub.ornek.join(' | '));
  assert.ok(ub.toz > 10000);
});
{
  const nedenOzet = L => { const o = {}; L.forEach(r => Object.keys(r.neden).forEach(k => { o[k] = (o[k] || 0) + r.neden[k]; })); return o; };
  [['A', 'Bot A (sabit isik)'], ['B', 'Bot B (isik 0 sabit, T_MIN)'], ['Bg', 'Bot B gercek isikla']].forEach(([ad, ac]) => {
    const r = ust[ad]; if (!r.length) return;
    dene('ust hiz kumesi ' + ac + ': ' + r.length + ' tohum x ' + UST_UZUN + ' birim (60000+, hiz 44, kademe 5): 0 olum / 0 haksiz hasar', () => {
      const no = nedenOzet(r), bit = r.filter(x => x.c > 0 || x.b > 0 || x.s > 0 || x.z > 0 || (x.bitti) || x.m < UST_BAS.mesafe + UST_UZUN);
      const gecBomba = r.reduce((q, x) => q + x.bomba, 0), gecSar = r.reduce((q, x) => q + x.sarmasik, 0);
      console.log('       olum/hasar nedenleri ' + JSON.stringify(no) + (ad === 'Bg' ? ', en az isik ' + Math.min(...r.map(x => x.isik)).toFixed(3) : '') +
                  ', puan ort ' + Math.round(r.reduce((q, x) => q + x.puan, 0) / r.length) + ', gecilen bomba ' + gecBomba + ' (bomba hasari ' + r.reduce((q, x) => q + x.b, 0) + '), sarmasik ' + gecSar);
      assert.ok(gecBomba > 100, 'ust hizda bomba uretilmiyor: ' + gecBomba);
      assert.strictEqual(bit.length, 0, bit.length + ' tohum: ' + JSON.stringify(no) + ' ' + kotu(bit, () => true));
      assert.deepStrictEqual(no, {});
    });
  });
}
dene('Bot B gercek isikla: isik hicbir tohumda 0,25 altina inmez', () => {
  const n = sonuc.Bg.filter(x => x.isik < 0.25 || x.bitti || x.m < MESAFE).length;
  const enAz = Math.min(...sonuc.Bg.map(x => x.isik));
  assert.strictEqual(n, 0, n + ' tohum, en az isik ' + enAz.toFixed(3) + ': ' + kotu(sonuc.Bg, x => x.isik < 0.25 || x.bitti));
  console.log('       en az isik ' + enAz.toFixed(3));
});
// 12.1: hic basmayan zeminde bekleyemez (zemin olumu); hep basili tavanda bekleyemez (sersemlik dongusu:
// tavan -> uyanma yuksekligi -> yeniden tavan; isik ve serit dallariyla biter). Sersemken toz dogrudan temasla
// toplandigi icin hep basili bot nadiren AKTIF_TOZ'a (10) ulasir (1000 tohumda en cok 12); kosu jetonu yine
// aktif olmaz cunku puani AKTIF_PUAN'in (300) cok altinda kalir (en cok 164). Olcut bu yuzden C1'de "aktif degil".
const aktifMi = x => AB.kosuJetonu(x.puan, x.toz, 0, A).aktif;
[['C0', 'hic basmaz', 3, x => x.sebep === 'zemin' && x.toz < 10], ['C1', 'hep basili', 40, x => x.sebep === 'isik' && x.sersem > 0 && !aktifMi(x)]].forEach(([ad, ac, tavan, sebepOk]) => {
  dene('Bot C (' + ac + '): <= ' + tavan + ' sn biter (' + (ad === 'C0' ? 'zemin olumu; toz < 10' : 'isik; sersemlik dongusu; kosu jetonu aktif degil') + '), jeton 0', () => {
    const r = sonuc[ad], kot = x => !x.bitti || !sebepOk(x) || x.sure > tavan || x.jeton !== 0;
    const n = r.filter(kot).length;
    assert.strictEqual(n, 0, n + ' tohum: ' + kotu(r, kot));
    console.log('       en uzun ' + Math.max(...r.map(x => x.sure)).toFixed(2) + ' sn, en cok toz ' + Math.max(...r.map(x => x.toz)) +
                ', en cok puan ' + Math.max(...r.map(x => x.puan)) + ', en cok sersemlik ' + Math.max(...r.map(x => x.sersem)));
  });
});
const top = (r, k) => r.reduce((q, x) => q + x[k], 0), pz = r => r.length ? 'puan ort ' + Math.round(top(r, 'puan') / r.length) +
  ' en az ' + Math.min(...r.map(x => x.puan)) + ' en cok ' + Math.max(...r.map(x => x.puan)) : '-';
['A', 'B', 'Bg', 'uA', 'uB'].forEach(ad => {
  const r = sonuc[ad]; if (!r.length) return;
  console.log('  bilgi ' + ad + ': ' + pz(r) + '; gecilen tozsuz ' + top(r, 'tozsuz') + ', bomba ' + top(r, 'bomba') +
              ', sarmasik ' + top(r, 'sarmasik') + ' (uyari ' + top(r, 'uyari') + ', yutulan toz ' + top(r, 'yutuldu') + ')');
});
const m = ist.m;
console.log('  bilgi yapisal: tozsuz ' + m.tozsuz + ' dilim / ' + m.pencere + ' pencere (en uzun ' + m.enCokPencere + ', en az ara ' + m.enAzPencereAra +
            '), bomba ' + m.bomba + ', sarmasik ' + m.sarmasik + ' (' + m.sutun + ' sutun), 5000+: sarmasik ' + m.sarmasik5000 + ' tozsuz ' + m.tozsuz5000 +
            ' yan yana ' + m.cakismaYan + ', en az kacis payi (yukseklik): sarmasik ' + m.enAzKacisPay.toFixed(4) + ', bomba ' + m.enAzBombaPay.toFixed(4) + ' birim, en az donus payi ' + m.enAzDonusPay.toFixed(4) +
            ' sn; zaman: sarmasik ' + ist.z.sarmasik + ', bomba ' + ist.z.bomba);
console.log('  bilgi: ' + ist.dilim + ' dilim, nefes ' + ist.nefes + ', kivilcim ' + ist.kivilcim + ' (%' + (100 * ist.kivilcim / ist.dilim).toFixed(2) +
            '), engel ' + JSON.stringify(ist.tur) + ', en cok |dc|/sinir ' + ist.enCokDcOran.toFixed(3) +
            ', en az (varis arasi - tAra) ' + ist.enAzAra.toFixed(4) + ' sn, sure ' + sure + ' sn');
console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
