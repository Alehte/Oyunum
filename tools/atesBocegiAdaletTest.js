// atesBocegiAdaletTest.js — tohum x bot adalet testi (tasarim 8.2).
// Calistirma:  node tools/atesBocegiAdaletTest.js [tohumSayisi=1000] [mesafe=20000] [uzunTohum=100] [uzunMesafe=60000] [sersemTohum=60] [riskTohum=100]
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
const EKRAN = A.dunya.W - XB;            // bomba kendi isigiyla ekrana girince gorunur

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
const ist = { bolgeOlay: 0, dilim: 0, nefes: 0, kivilcim: 0, uzakDilim: 0, uzakKivilcim: 0, tur: { dal: 0, ag: 0, kus: 0, dusen: 0 },
              enAzPay: Infinity, enAzAra: Infinity, enCokDcOran: 0, kusur: [],
              // yeni mekanikler (tasarim 11): yapisal denetimden gecen dilim sayilari (butun kosular)
              m: { tozsuz: 0, pencere: 0, bomba: 0, sarmasik: 0, sutun: 0, sarmasik5000: 0, cakismaYan: 0, tozsuz5000: 0,
                   enAzPencereAra: Infinity, enCokPencere: 0, enAzKacisPay: Infinity, enAzBombaPay: Infinity, enAzDonusPay: Infinity },
              // zaman denetimi (Bot A kosusu)
              z: { sarmasik: 0, enAzUyari: Infinity, enAzUyariVaris: Infinity, bomba: 0, enAzBombaGorVaris: Infinity },
              // risk tozu (tasarim 12.2): yapisal denetim
              r: { aday: 0, dilim: 0, ust: 0, ardisik: 0, donusum: 0, enAzUzak: Infinity } };
function kusur(tohum, s, msg) { ist.kusur.push('tohum ' + tohum + ' dilim ' + (s ? s.no : '-') + ': ' + msg); }

// En kotu durum zarfi (3.4 tablosu), ham engel verisinden; dilimin varis anindaki x araligi.
function zarflar(s) {
  return s.engeller.map(e => {
    if (e.tur === 'kus') return { x1: s.x, x2: s.x + s.w, y1: e.y, y2: e.y + e.h };
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

function yeniDenetci(t) {
  return { t: t, son: null, sonNo: -1, ustSay: 0, altSay: 0, nefesBekle: false,
           aktif: [], sonVaris: null, tehlike: [],
           pencereUz: 0, pencereSon: -1e9, tozsuzNo: [], sarmasikNo: [], tA: A.dunya.Y_BASLA, tU: A.dunya.Y_BASLA };
}
// Tutma araligi: oyuncunun bir dilimi gecerken bulunabilecegi yukseklikler. Dilim merkezi + yayinin son tozu
// (dilimi goremeyen oyuncu son rehberinde bekler) + tehlike kacis seviyeleri (dilimin bandina kistirilmis);
// tozsuz dilimde onceki aralikla birlesir. Tozsuz dilimin serbest bandi bu araligi kapsamalidir.
function tutmaGuncelle(dn, s, c, zf, Ylist) {
  let a = c, u = c;
  const yt = s.toz.filter(tz => !tz.risk);                 // 12.2: risk tozu yol tozu degil
  if (s.tozsuz) { a = Math.min(c, dn.tA); u = Math.max(c, dn.tU); }
  else if (yt.length) { const y = yt[yt.length - 1].y; a = Math.min(a, y); u = Math.max(u, y); }
  Ylist.forEach(Y => { const y = Math.max(zf.ust + RC + PAYK, Math.min(zf.alt - RC - PAYK, Y)); a = Math.min(a, y); u = Math.max(u, y); });
  dn.tA = a; dn.tU = u;
}
// 12.2 risk tozu: yalniz RISK_PUAN ve sonrasinda, siradan dilimde (acilis/nefes/tozsuz/bomba/sarmasik disi), en cok
// bir tane, toz dizisinin sonunda; bir dikenli dalin x ortasinda, dal ucundan (= bosluk kenari) RISK_DERIN otede,
// RISK_Y araliginda: guvenli zarfin (dilimZarfi) disinda. Carpmadan alinamazlik burada gercek dal geometrisiyle
// sayisal olarak: carpmayan bocek dalin x araligindaki adimlarda (adim ayrikligi HIZ_TAVAN*DT) uctan R_CARPMA
// otede, disinda en dik egimle (max VY / HIZ_TABAN) uzaklasir; toza en kisa uzaklik > R_TOPLA (miknatis cekmez).
const KE = Math.max(A.hareket.VY_YUKARI, A.hareket.VY_ASAGI) / A.zorluk.HIZ_TABAN, ADIM_X = A.zorluk.HIZ_TAVAN * DT;
function riskUzaklik(rt, dal, ust) {
  let en = Infinity;
  for (let x = rt.x - 8; x <= rt.x + 8; x += 0.04) {         // en yakin nokta tozdan ~3 birim icinde
    const dx = Math.max(0, dal.x + ADIM_X - x, x - (dal.x + dal.w - ADIM_X));
    const dy = ust ? Math.max(0, dal.y + dal.h + RC - KE * dx - rt.y) : Math.max(0, rt.y - (dal.y - RC + KE * dx));
    en = Math.min(en, Math.hypot(x - rt.x, dy));
  }
  return en;
}
function riskDenetle(dn, s, zf, puan, ozel) {
  const rk = s.toz.filter(tz => tz.risk), t = dn.t;
  if (puan >= U.RISK_PUAN && !ozel && !s.tozsuz && !s.bomba && !s.sarmasik) ist.r.aday++;
  if (!rk.length) return;
  ist.r.dilim++;
  if (rk.length > 1) kusur(t, s, 'dilimde birden cok risk tozu');
  if (puan < U.RISK_PUAN) kusur(t, s, 'risk tozu esik altinda (' + puan + ')');
  if (ozel || s.tozsuz || s.bomba || s.sarmasik) kusur(t, s, 'risk tozu nefes/acilis/tozsuz/bomba/sarmasik dilimde');
  if (s.toz[s.toz.length - 1] !== rk[rk.length - 1] || s.toz.some((tz, i) => i && tz.x < s.toz[i - 1].x)) kusur(t, s, 'risk tozu sonda degil / x sirasi bozuk');
  rk.forEach(rt => {
    if (rt.alindi !== 0 || rt.yutuldu !== 0) kusur(t, s, 'risk tozu alinmis/yutulmus dogdu');
    const ust = rt.y < zf.ust;
    if (!(ust ? rt.y <= zf.ust - U.RISK_DERIN + 1e-9 : rt.y >= zf.alt + U.RISK_DERIN - 1e-9)) kusur(t, s, 'risk tozu guvenli zarfa RISK_DERIN\'den yakin');
    if (rt.y < U.RISK_Y_MIN - EPS || rt.y > U.RISK_Y_MAX + EPS) kusur(t, s, 'risk tozu RISK_Y araligi disinda (' + rt.y + ')');
    const dal = s.engeller.find(e => e.tur === 'dal' && e.yon === (ust ? 'ust' : 'alt') && rt.x >= e.x && rt.x <= e.x + e.w && rt.y >= e.y && rt.y <= e.y + e.h);
    if (!dal) { kusur(t, s, 'risk tozu dikenli dalin icinde degil'); return; }
    if (Math.abs(rt.x - (dal.x + dal.w / 2)) > 1e-9) kusur(t, s, 'risk tozu dalin ortasinda degil');
    const u = riskUzaklik(rt, dal, ust);
    ist.r.enAzUzak = Math.min(ist.r.enAzUzak, u);
    if (!(u > RT)) kusur(t, s, 'risk tozu carpmadan alinabilir (uzaklik ' + u.toFixed(3) + ' <= R_TOPLA)');
    if (dn.riskSon !== undefined) { ist.r.ardisik++; if (dn.riskSon !== ust) ist.r.donusum++; }
    dn.riskSon = ust; if (ust) ist.r.ust++;
  });
}
function dilimDenetle(dn, s, gorPuan) {
  const puan = s.puan;                                        // uretim puani (tasarim 11.8)
  if (!(puan <= gorPuan)) kusur(dn.t, s, 'uretim puani gorulen puandan buyuk');
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
  const pc = p ? p.c : A.dunya.Y_BASLA, px = p ? p.x : XB, pw = p ? p.w : 0;
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
  const a = px + pw, b = s.x, yt = s.toz.filter(tz => !tz.risk);   // 12.2: risk tozu ayri denetlenir (riskDenetle)
  const tozSay = yt.length + (s.bomba ? 1 : 0);             // bomba bir ic tozun yerindedir
  if (s.tozsuz ? s.toz.length !== 0 : (tozSay < U.TOZ_MIN || tozSay > U.TOZ_MAX)) kusur(t, s, 'toz sayisi ' + tozSay);
  yt.forEach(tz => {
    if (!(tz.x > a && tz.x < b)) kusur(t, s, 'toz araligin disinda');
    const f = (tz.x - a) / (b - a);
    if (Math.abs(tz.y - yol(pc, c, f)) > U.TOZ_SAPMA + 1e-6) kusur(t, s, 'toz egriden sapmis');
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
    if (k) { const n = ikiYonDenetle(k, bo.x - EKRAN, hA, hY, bo.x + RB); if (n) kusur(t, s, 'bomba: ' + n); }
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
  riskDenetle(dn, s, zf, puan, ozel);
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
      if (k.gor === null && bo.x - bx <= EKRAN) k.gor = bo.x - bx0 > EKRAN ? ara(bo.x - EKRAN) : d.t;
      if (bx >= bo.x - RB) {
        ist.z.bomba++;
        const gv = ara(bo.x - RB) - k.gor;
        ist.z.enAzBombaGorVaris = Math.min(ist.z.enAzBombaGorVaris, gv);
        if (!(gv >= A.adalet.T_MIN)) kusur(dn.t, s, 'bomba carpma mesafesine ' + gv.toFixed(4) + ' sn kala gorundu');
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
// Bot T (tam toplayici, 12.2): Bot A gibi; siradaki (gecilmemis) dilimde alinmamis risk tozu varsa once onundeki
// yol tozlarini izler, risk tozuna yetisme payi kalmayinca (|dy| / RT_VY * hiz + 2 birim) risk tozunu sert hedefler
// (dala girer), alinca ya da gecince Bot A'ya doner. Isik sabit: olum degil hasar olculur.
const RT_VY = 22;
function botT() {
  const planlar = new Map();
  return d => {
    const bx = d.mesafe + XB, [ilk, ikinci] = ilkIkinci(d.dilimler, bx);
    if (!ilk) return kontrol(d, d.y);
    const rt = ilk.toz.find(t => t.risk && !t.alindi);
    if (rt && rt.x + RT >= bx) {
      const yol = ilk.toz.find(t => !t.risk && !t.alindi && !t.yutuldu && t.x + RT >= bx);
      if (yol && rt.x - bx > Math.abs(rt.y - d.y) / RT_VY * AB.zorluk(d.mesafe).hiz + 2) return kontrol(d, yol.y);
      return kontrol(d, rt.y, true);
    }
    const y = idealKacis(d, bx, planlar, ilk, ikinci);
    if (y !== null) return kontrol(d, y.y, y.sert);
    const z = AB.dilimZarfi(ilk); return kontrol(d, (z.ust + z.alt) / 2);
  };
}
// Bot K (kenar siyiran, miknatis olcumu 12.2): Bot A gibi; risk tozlu dilimde dalin x araligini guvenli boslugun
// risk tozu tarafindaki kenarindan (R_CARPMA + K_PAY) gecer: risk tozuna carpmadan en cok yaklasan yol. Risk tozu
// carpmadan (bedava) alinmamali.
const K_PAY = 0.5;
function botK() {
  const planlar = new Map();
  return d => {
    const bx = d.mesafe + XB, [ilk, ikinci] = ilkIkinci(d.dilimler, bx);
    if (!ilk) return kontrol(d, d.y);
    const y = idealKacis(d, bx, planlar, ilk, ikinci);
    if (y !== null) return kontrol(d, y.y, y.sert);
    const z = AB.dilimZarfi(ilk), rt = ilk.toz.find(t => t.risk && !t.alindi);
    if (rt && bx >= ilk.x - 2 * RT) return kontrol(d, rt.y < z.ust ? z.ust + RC + K_PAY : z.alt - RC - K_PAY);
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
      if (k.tp && k.tgor === Infinity && (s.bomba ? s.bomba.x - bx <= EKRAN : s.sarmasik.faz >= 1)) k.tgor = d.t;
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
  const d = AB.oyunOlustur(t), dn = yeniDenetci(t), hedefMesafe = secenek.mesafe || MESAFE;
  const mek = { tozsuz: [], bomba: [], sarmasik: [] };
  const yeni = () => {
    const L = d.dilimler; let i = L.length; while (i > 0 && L[i - 1].no > dn.sonNo) i--;
    for (; i < L.length; i++) {
      const s = L[i];
      if (s.tozsuz) mek.tozsuz.push(s); if (s.bomba) mek.bomba.push(s); if (s.sarmasik) mek.sarmasik.push(s);
      if (secenek.yapi || secenek.zaman) dilimDenetle(dn, s, d.puan);
      else dn.sonNo = s.no;
      if (secenek.zaman) izBaslat(dn, s);
    }
  };
  yeni();
  let carpma = 0, bomba = 0, enAzIsik = d.isik, adimSay = 0, bolge = d.bolge, yutuldu = 0, uyari = 0, sersem = 0, zemin = 0;
  while (d.mesafe < hedefMesafe && !d.bitti) {
    if (secenek.isikSabit) d.isik = 1;
    const bx0 = d.mesafe + XB, t0 = d.t;
    const olay = AB.adim(d, bot(d));
    adimSay++;
    yeni();
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
  const bx = d.mesafe + XB, gecilen = L => L.filter(s => s.x + s.w < bx).length;
  return { d: d, carpma: carpma, bomba: bomba, enAzIsik: enAzIsik, adim: adimSay, yutuldu: yutuldu, uyari: uyari, sersem: sersem, zemin: zemin,
           tozsuz: gecilen(mek.tozsuz), bombaDilim: gecilen(mek.bomba), sarmasikDilim: gecilen(mek.sarmasik), puan: d.puan };
}

console.log('Ates Bocegi adalet: ' + TOHUM_SAYI + ' tohum x ' + MESAFE + ' birim');
const bas = Date.now();
const sonuc = { A: [], B: [], Bg: [], C0: [], C1: [], uA: [], uB: [] }, kivD = { deneme: 0, alinan: 0, temiz: 0, carpma: 0, tohumCarpma: 0, sersem: 0, zemin: 0 };
const ozet = r => ({ t: r.t, c: r.carpma, b: r.bomba, s: r.sersem, z: r.zemin, m: r.d.mesafe, puan: r.puan, tozsuz: r.tozsuz, bomba: r.bombaDilim,
                     sarmasik: r.sarmasikDilim, yutuldu: r.yutuldu, uyari: r.uyari });
for (let i = 0; i < TOHUM_SAYI; i++) {
  const t = tohum(i);
  const a = kos(t, botA(), { isikSabit: true, zaman: true });   // zaman denetimi geometriye bagli: A kosusunda
  sonuc.A.push(Object.assign(ozet(Object.assign(a, { t: t }))));
  const kayit = new Map(), dk = kos(t, botD(kayit), { isikSabit: true, kayit: kayit });
  kivD.carpma += dk.carpma; if (dk.carpma) kivD.tohumCarpma++; kivD.sersem += dk.sersem; kivD.zemin += dk.zemin;
  for (const [s, k] of kayit) {
    if (s.x + s.w + RC >= dk.d.mesafe + XB) continue;   // kosu bitiminde gecilmemis
    kivD.deneme++;
    if (s.kivilcim.alindi) kivD.alinan++;
    if (s.kivilcim.alindi && !k.carpti) kivD.temiz++;
  }
  const b = kos(t, botB(true), { isikSabit: true, yapi: true });
  sonuc.B.push(ozet(Object.assign(b, { t: t })));
  const bg = kos(t, botB(false), { yapi: true });
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
  sonuc.uA.push(ozet(Object.assign(kos(t, botA(), { isikSabit: true, zaman: true, mesafe: UZUN_MESAFE }), { t: t })));
  sonuc.uB.push(ozet(Object.assign(kos(t, botB(true), { isikSabit: true, yapi: true, mesafe: UZUN_MESAFE }), { t: t })));
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
// Toz deseni zorlugu (12.2): Bot T (tam toplayici), Bot K (kenar siyiran) ve Bot A (secici) ayni tohumlarda, isik
// sabit (olum degil hasar olculur). Dilim = gecilen gercek dilim (nefes haric), uretim puani (dilim.puan) >= esik.
// Hasar = hasar/ag/sarmasik/bomba olayi, bocegin o an icinde bulundugu (gecilmemis ilk) dilime yazilir.
// Risk tozu alimi 'bedava': alimdan once DOKUNULMAZ sn ve sonra 0,5 sn icinde hasar yok.
// Toz olayinin puani her tozda (risk dahil) P.TOZ * carpan(o anki zincir) olmali (risk tozu ekstra puan vermez).
const RISK_TOHUM = process.argv[7] !== undefined ? +process.argv[7] : 100, RISK_MESAFE = MESAFE;   // gercek isikli Tg/Bg: ilk yarisi (sure)
const RISK_ESIK = 2400, RISK_PENCERE = 7;               // olcum: bkz. tasarim 12.2
const HASAR_TUR = { hasar: 1, ag: 1, sarmasik: 1, bomba: 1 };
function riskKos(t, bot, gercekIsik) {
  const d = AB.oyunOlustur(t), r = { dilim: [], riskVar: 0, riskAl: 0, bedava: 0, puanHata: 0, sersem: 0, zemin: 0, bitti: 0, puan: 0 };
  const hasarNo = new Map(), alim = [], hasarT = [], izle = [];
  let sonNo = -1, sonGec = -1;
  while (d.mesafe < RISK_MESAFE && !d.bitti) {
    if (!gercekIsik) d.isik = 1;
    let zb = d.zincirSure > 0 && d.zincirSure - DT <= 0 ? 0 : d.zincir;   // adim zincir suresini tozdan once dusurur
    const olay = AB.adim(d, bot(d)), bx = d.mesafe + XB;
    for (const s of d.dilimler) if (s.no > sonNo) { sonNo = s.no; s.toz.forEach(tz => { if (tz.risk) izle.push(tz); }); }
    for (const o of olay) {
      if (HASAR_TUR[o.tur]) {
        zb = 0; hasarT.push(d.t);
        const s = d.dilimler.find(q => q.x + q.w + RC >= bx); if (s) hasarNo.set(s.no, (hasarNo.get(s.no) || 0) + 1);
      } else if (o.tur === 'toz') { if (o.puan !== A.puan.TOZ * AB.carpan(zb)) r.puanHata++; zb++; }
      else if (o.tur === 'sersem') r.sersem++; else if (o.tur === 'zemin') r.zemin++;
    }
    for (let i = 0; i < izle.length; i++) if (izle[i].alindi) { alim.push(d.t); izle.splice(i--, 1); }
    for (const s of d.dilimler) if (s.no > sonGec && s.x + s.w + RC < bx) {
      sonGec = s.no;
      const rv = s.toz.some(tz => tz.risk);
      if (!s.nefes) r.dilim.push({ p: s.puan, h: hasarNo.get(s.no) || 0, risk: rv ? 1 : 0, al: rv && s.toz.some(tz => tz.risk && tz.alindi) ? 1 : 0 });
    }
  }
  r.riskVar = r.dilim.reduce((q, x) => q + x.risk, 0); r.riskAl = r.dilim.reduce((q, x) => q + x.al, 0);
  r.bedava = alim.filter(ta => !hasarT.some(th => th >= ta - A.isik.DOKUNULMAZ - EPS && th <= ta + 0.5)).length;
  r.bitti = d.bitti; r.puan = d.puan; r.mesafe = d.mesafe;
  return r;
}
const rs = { T: [], K: [], A: [], Tg: [], Bg: [] };
for (let i = 0; i < RISK_TOHUM; i++) {
  const t = tohum(300000 + i);
  rs.T.push(riskKos(t, botT())); rs.K.push(riskKos(t, botK())); rs.A.push(riskKos(t, botA()));
  if (2 * i < RISK_TOHUM) { rs.Tg.push(riskKos(t, botT(), true)); rs.Bg.push(riskKos(t, botB(false), true)); }
}
// esikten sonraki dilimlerde dilim basina hasar ve RISK_PENCERE dilimlik ardisik (ortusmeyen) pencereler
function riskOzet(L, esik) {
  let dilim = 0, hasar = 0, pen = 0, pen2 = 0, penTop = 0;
  L.forEach(r => {
    const D = r.dilim.filter(x => x.p >= esik);
    dilim += D.length; hasar += D.reduce((q, x) => q + x.h, 0);
    for (let j = 0; j + RISK_PENCERE <= D.length; j += RISK_PENCERE) {
      const h = D.slice(j, j + RISK_PENCERE).reduce((q, x) => q + x.h, 0);
      pen++; penTop += h; if (h >= 2) pen2++;
    }
  });
  return { dilim, hasar, oran: hasar / Math.max(1, dilim), pen, penOrt: penTop / Math.max(1, pen), pen2: pen2 / Math.max(1, pen) };
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
  assert.ok(m.sarmasik5000 > 0 && m.tozsuz5000 > 0, '5000+ sarmasik/tozsuz yok');
  assert.ok(ist.z.sarmasik > 0 && ist.z.bomba > 0, 'zaman denetimi yok');
  if (UZUN_TOHUM) assert.ok(m.cakismaYan > 0, '5000+ yan yana sarmasik-tozsuz ornegi yok');
});
dene('sarmasik uyari >= T_MIN (en az ' + ist.z.enAzUyari.toFixed(4) + ' sn), uyari->varis >= ' + U.SARMASIK_ONCE +
     ' (en az ' + ist.z.enAzUyariVaris.toFixed(4) + ' sn, degismez ' + SA_KACIS.toFixed(4) + ')', () => {
  assert.ok(ist.z.enAzUyari >= A.adalet.T_MIN - EPS && ist.z.enAzUyariVaris >= SA_KACIS - 1e-6);
});
dene('bomba gorunur -> carpma mesafesi >= T_MIN (en az ' + ist.z.enAzBombaGorVaris.toFixed(4) + ' sn)', () => assert.ok(ist.z.enAzBombaGorVaris >= A.adalet.T_MIN));
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
// ---- 12.2 toz deseni zorlugu
// Ozetler HEAD'deki (risk tozu oncesi) cekirdekle hesaplandi: 800 oncesi uretim bayt bayt ayni; 800 sonrasi
// risk tozlari cikarilinca da ayni (risk tozu ayri rng akisi, ana akisin tuketimi degismedi). Uretici bilerek
// degisirse ozet yeniden hesaplanir.
function fnv(h, s) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
function uretimOzeti(tohumlar, n, puanF, soy) {
  let h = 0x811C9DC5, risk = 0;
  for (let t = 1; t <= tohumlar; t++) {
    const u = AB.ureticiOlustur(t);
    for (let i = 0; i < n; i++) {
      const p = puanF(i), s = u.sonraki(AB.bolgeNo(p), p);
      risk += s.toz.filter(z => z.risk).length;
      if (soy) s.toz = s.toz.filter(z => !z.risk);
      h = fnv(0x811C9DC5, h.toString(16) + JSON.stringify(s));
    }
  }
  return { h: h.toString(16), risk: risk };
}
dene('800 oncesi desen degismedi: 200 tohum x 120 dilim (puan 0-799) uretim ozeti eskiyle ayni, risk tozu yok', () => {
  const o = uretimOzeti(200, 120, i => Math.min(U.RISK_PUAN - 1, i * 7), false);
  assert.deepStrictEqual(o, { h: '2e61cd7b', risk: 0 });
});
dene('800 sonrasi risk tozlari cikarilinca uretim eskiyle ayni (100 tohum x 600 dilim, puan 0-8400)', () => {
  const o = uretimOzeti(100, 600, i => i * 14, true);
  console.log('       ' + o.risk + ' risk tozu');
  assert.strictEqual(o.h, '6a4bf060'); assert.ok(o.risk > 1000);
});
dene('risk tozu yapisal: guvenli zarf disinda, dikenli dalda, carpmadan alinamaz (' + ist.r.dilim + ' / ' + ist.r.aday + ' aday dilim)', () => {
  console.log('       toza en kisa carpmasiz uzaklik ' + ist.r.enAzUzak.toFixed(3) + ' (R_TOPLA ' + RT + '), ust ' + ist.r.ust + ' / alt ' + (ist.r.dilim - ist.r.ust) +
              ', ardisik yan degisimi %' + (100 * ist.r.donusum / Math.max(1, ist.r.ardisik)).toFixed(1));
  assert.ok(ist.r.dilim > 1000 && ist.r.enAzUzak > RT);
});
const roT = riskOzet(rs.T, RISK_ESIK), roA = riskOzet(rs.A, RISK_ESIK), roK = riskOzet(rs.K, RISK_ESIK), ro8 = riskOzet(rs.T, U.RISK_PUAN), roA8 = riskOzet(rs.A, U.RISK_PUAN);
const riskAl = L => L.reduce((q, r) => q + r.riskAl, 0) + ' / ' + L.reduce((q, r) => q + r.riskVar, 0);
dene('(a) Bot T (tam toplayici, ' + rs.T.length + ' tohum): puan >= ' + RISK_ESIK + ' sonrasi her ' + RISK_PENCERE + ' dilimde ortalama >= 2 hasar; secici Bot A\'nin >= 3 kati', () => {
  console.log('       Bot T: >= ' + RISK_ESIK + ': ' + roT.dilim + ' dilim, dilim basina hasar ' + roT.oran.toFixed(3) + ', ' + RISK_PENCERE + ' dilimlik pencere ort ' + roT.penOrt.toFixed(2) +
              ' (>= 2 hasarli pencere %' + (100 * roT.pen2).toFixed(1) + '); >= ' + U.RISK_PUAN + ': dilim basina ' + ro8.oran.toFixed(3) + '; risk tozu alinan ' + riskAl(rs.T));
  const kova = [[U.RISK_PUAN, 1600], [1600, 2400], [2400, 3200], [3200, 6400], [6400, Infinity]].map(([lo, hi]) => {
    const D = [].concat(...rs.T.map(r => r.dilim.filter(x => x.p >= lo && x.p < hi)));
    return lo + '-' + hi + ': ' + (D.reduce((q, x) => q + x.h, 0) / Math.max(1, D.length)).toFixed(3) + ' (risk %' + (100 * D.reduce((q, x) => q + x.risk, 0) / Math.max(1, D.length)).toFixed(1) + ')';
  });
  console.log('       Bot T puan kovasi -> dilim basina hasar: ' + kova.join(', '));
  console.log('       Bot A: >= ' + RISK_ESIK + ' dilim basina hasar ' + roA.oran.toFixed(3) + ', >= ' + U.RISK_PUAN + ' ' + roA8.oran.toFixed(3) + '; risk tozu alinan ' + riskAl(rs.A));
  assert.ok(roT.dilim > 1000 && roT.penOrt >= 2, 'pencere ort ' + roT.penOrt);
  assert.ok(roT.oran >= 3 * roA.oran && roT.oran - roA.oran >= 0.2, 'T ' + roT.oran + ' A ' + roA.oran);
});
dene('(b) secici botlar yasar: Bot A ve Bot B gercek isikla ' + RISK_MESAFE + ' birimi tamamlar, 800 sonrasi 0 hasar, risk tozu almaz', () => {
  const bg = riskOzet(rs.Bg, U.RISK_PUAN);
  console.log('       Bot B gercek isik: tamamlanan ' + rs.Bg.filter(r => !r.bitti).length + '/' + rs.Bg.length + ', dilim basina hasar ' + bg.oran.toFixed(3) + ', risk tozu alinan ' + riskAl(rs.Bg));
  [rs.A, rs.Bg].forEach(L => L.forEach(r => { assert.ok(!r.bitti && r.mesafe >= RISK_MESAFE && r.riskAl === 0 && r.sersem === 0 && r.zemin === 0, 'tohum kosusu'); }));
  assert.strictEqual(roA8.hasar + bg.hasar, 0);
});
dene('Bot T gercek isikla (hepsini toplamaya calisan kaybeder): kosularin cogu biter', () => {
  const b = rs.Tg.filter(r => r.bitti).length, p = rs.Tg.map(r => r.puan).sort((x, y) => x - y);
  console.log('       biten ' + b + '/' + rs.Tg.length + ', puan medyan ' + p[p.length >> 1] + ' (secici Bot B gercek isik medyan ' + rs.Bg.map(r => r.puan).sort((x, y) => x - y)[rs.Bg.length >> 1] + ')');
  assert.ok(b >= 0.9 * rs.Tg.length, b + ' biten');
});
dene('miknatis: Bot K (risk tozu tarafindaki kenardan siyirir) risk tozunu carpmadan alamaz', () => {
  const bd = rs.K.reduce((q, r) => q + r.bedava, 0);
  console.log('       Bot K: risk tozu alinan ' + riskAl(rs.K) + ', bedava ' + bd + ', dilim basina hasar (>= ' + RISK_ESIK + ') ' + roK.oran.toFixed(3));
  assert.strictEqual(bd, 0);
  assert.strictEqual(rs.T.reduce((q, r) => q + r.bedava, 0) + rs.A.reduce((q, r) => q + r.riskAl, 0), 0, 'Bot T bedava / Bot A risk tozu');
});
dene('risk tozu ekstra puan vermez: her toz olayi P.TOZ * carpan(zincir) (Bot T/K/A)', () => {
  assert.strictEqual(['T', 'K', 'A', 'Tg', 'Bg'].reduce((q, k) => q + rs[k].reduce((a, r) => a + r.puanHata, 0), 0), 0);
});
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
