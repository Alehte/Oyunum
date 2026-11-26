// atesBocegiDikkatliBot.js — "dikkatli oyuncu" botu ile Bolge 5 zorluk derecesi olcumu (tasarim 14, FAZ 3).
// Calistirma:  node tools/atesBocegiDikkatliBot.js [tohumSayisi=200] [kosuTavani=30000] [hataSigma=2.2] [dereceler=0,2,4,6,8]
//
// Bot: adalet testinin Bot B'si gibi yalniz gorebildigini bilir (gercek isik yaricapi icindeki engel/toz, kendi isigiyla bomba on
// isareti ve sarmasik uyarisi), ama her gordugu seyi 250-350 ms (nesne basina rastgele) sonra kullanir ve hedefine kucuk bir
// hata ekler: Ornstein-Uhlenbeck surecli dikey nisan hatasi (sigma hataSigma birim, tau 0,5 sn). Hata 0 iken ayni bot kontrol
// kosusudur (0 hasar beklenir): olumler botun hatasindandir, dunyadan degil.
//
// Olcum 1 (sabit derece): cekirdegin derece() islevi sabit d dondurecek sekilde yuklenmis kopyasi (yalniz bu aracta; kaynak dosya
// degismez), kosu test kancasiyla 16000 birimden (hiz 44) baslar; her d icin ayni tohumlar. d = 0 = FAZ 3 oncesi oyun.
// Olcum 2 (gercek ilerleme): gercek cekirdek, kosu Bolge 5 basindan (4000) baslar, d mesafeyle artar; D_MAX = 0 kopyasi (FAZ 3 oncesi)
// ile karsilastirilir.
// Haksiz olum denetimi: botun gectigi her dilimde degismezler bagimsiz olculur (cekirdegin kacis islevleri kullanilmaz):
// engel ilk gorunur (isik 0 yaricapi) -> varis >= T_MIN; bomba on isaret -> carpma mesafesi >= T_MIN + kacis + PAY_KACIS_SN;
// salinan supurulen zarfi boslugun disinda ve gecit >= 16; dogumda isik engel zarfina >= ISIK_MARJ. Ihlal sayisi 0 olmali.
'use strict';
const fs = require('fs'), path = require('path');
const KAYNAK = path.join(__dirname, '..', 'js', 'atesBocegi.js');
const AB = require(KAYNAK);
const A = AB.AYAR, DT = A.dunya.DT, XB = A.dunya.X_BOCEK, RC = A.hareket.R_CARPMA, U = A.uretici, Z = A.zorluk;
const T_MIN = A.adalet.T_MIN, PAYK = A.adalet.PAY_KACIS, RB = A.hareket.R_BOMBA + RC, EPS = 1e-9;
const EKRAN = A.dunya.W - XB, BOMBA_GOR = A.dunya.W - XB + U.BOMBA_ON_ISARET;
const BOMBA_KACIS_SN = T_MIN + AB.kacisSuresi(RB + PAYK, 0, 0) + A.adalet.PAY_KACIS_SN;

const TOHUM = +process.argv[2] || 200, TAVAN = +process.argv[3] || 30000;
const SIGMA = process.argv[4] !== undefined ? +process.argv[4] : 2.2, TAU = 0.5;
const DERECELER = (process.argv[5] || [0, 2, 4, 6, Z.D_MAX].join(',')).split(',').map(Number);
const GEC_MIN = 0.25, GEC_MAX = 0.35;

// Cekirdek kopyasi: derece() sabit (dSabit) ya da AYAR.zorluk.D_MAX degistirilmis (dMax). Yalniz bu aracta, bellekte.
function cekirdek(o) {
  let s = fs.readFileSync(KAYNAK, 'utf8');
  if (o.dSabit !== undefined) {
    const a = 'function derece(mesafe) {';
    if (!s.includes(a)) throw new Error('derece() bulunamadi');
    s = s.replace(a, a + ' return ' + o.dSabit + ';');
  }
  if (o.dMax !== undefined) {
    if (!/\bD_MAX: \d+/.test(s)) throw new Error('D_MAX bulunamadi');
    s = s.replace(/\bD_MAX: \d+/, 'D_MAX: ' + o.dMax);
  }
  const mod = { exports: {} };
  new Function('module', 'self', s)(mod, undefined);
  return mod.exports;
}

// ---- denetleyici ve kacis plani (adalet testindeki Bot B ile ayni mantik)
const KP = 6, A_ZAYIF = Math.min(A.hareket.A_YUKSEL, A.hareket.G_SUZUL), A_FREN = 0.5 * A_ZAYIF, A_SERT = 0.9 * A_ZAYIF, MBOT = 1.5;
function kontrol(d, hedef, sert) {
  const e = hedef - d.y, ae = Math.abs(e);
  const v = Math.max(-A.hareket.VY_YUKARI, Math.min(A.hareket.VY_ASAGI, Math.sign(e) * Math.min(sert ? Infinity : KP * ae, Math.sqrt(2 * (sert ? A_SERT : A_FREN) * ae))));
  return d.vy + d.ay * A.hareket.T_RAMPA > v;
}
function tehlikePlani(s) {
  if (s.bomba) return { bomba: s.bomba, x1: s.bomba.x - RB, x2: s.bomba.x + RB, sy: 0, Y: 0 };
  if (s.sarmasik) {
    const sa = s.sarmasik, sy = sa.yon === 'ust' ? 1 : -1;
    const Y = sy * Math.max(...sa.sutunlar.map(c => sy * (c.ty + sy * (U.SARMASIK_TASMA + RC + PAYK))));
    return { x1: sa.x1 - RC, x2: sa.x2 + RC, sy: sy, Y: Y };
  }
  return null;
}
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
function kacisHedefi(AB, d, bx, pl, bant) {
  if (!pl || bx > pl.x2 + 0.5) return null;
  if (pl.bomba && !pl.sy) {
    const t = Math.max(0, (pl.x1 - bx) / AB.zorluk(d.mesafe).hiz);
    let en = -Infinity;
    for (const sy of [1, -1]) {
      const p = AB.kacisMesafesi(t, sy * d.vy, sy * d.ay) - sy * (pl.bomba.y + sy * (RB + PAYK) - d.y);
      if (p > en) { en = p; pl.sy = sy; }
    }
    pl.Y = pl.bomba.y + pl.sy * (RB + PAYK);
  }
  const y = pl.Y + pl.sy * MBOT;
  return bant ? { y: Math.max(bant.lo, Math.min(bant.hi, y)), sert: false, x2: pl.x2 } : { y: y, sert: true, x2: pl.x2 };
}
const bantOf = s => ({ lo: s.ust + RC + 1, hi: s.alt - RC - 1 });
function cemberKesar(e, bx, by, r) {
  const cx = Math.max(e.x, Math.min(bx, e.x + e.w)), cy = Math.max(e.y, Math.min(by, e.y + e.h));
  return (bx - cx) * (bx - cx) + (by - cy) * (by - cy) <= r * r;
}
// Dikkatli bot: r = tohumlu rastgele (gecikme ve hata). Her nesnenin gecikmesi gorulurken cekilir.
function dikkatliBot(AB, r, sigma) {
  let sonHedef = null, sonNo = -1, kacisX = -Infinity, kacisY = 0, hata = 0, t0 = 0;
  const kuyruk = [], yp = new Float64Array(512), gec = () => GEC_MIN + (GEC_MAX - GEC_MIN) * r();
  const ou = Math.exp(-DT / TAU), ouS = sigma * Math.sqrt(1 - ou * ou);
  const bot = d => {
    // nisan hatasi (OU): her adim; Box-Muller
    const g = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    hata = hata * ou + ouS * g; bot.hata = hata;
    const bx = d.mesafe + XB, by = d.y, hiz = AB.zorluk(d.mesafe).hiz;
    const R = AB.isikYaricapi(d.isik, hiz, d.gorunenBolge), R2 = R * R, sn = d.t + EPS;
    const L = d.dilimler;
    for (let i = 0; i < L.length; i++) {
      if (L[i].no <= sonNo) continue;
      const s = L[i]; sonNo = s.no;
      const z = AB.dilimZarfi(s);
      kuyruk.push({ s: s, c: (z.ust + z.alt) / 2, gor: Infinity, gg: Infinity, toz: s.toz.filter(t => t.x < s.x - RC).map(t => ({ x: t.x, y: t.y, gor: Infinity, gg: 0 })),
                    tp: tehlikePlani(s), tgor: Infinity, tg: 0 });
    }
    while (kuyruk.length > 1 && kuyruk[1].s.x + kuyruk[1].s.w + RC < bx) kuyruk.shift();
    let n = 0;
    for (let i = 0; i < kuyruk.length; i++) {
      const k = kuyruk[i], s = k.s, tz = k.toz;
      if (k.gor === Infinity && tz.length && tz[0].x - bx > R) break;
      for (let j = 0; j < tz.length; j++) {
        const t = tz[j];
        if (t.gor === Infinity && (t.x - bx) * (t.x - bx) + (t.y - by) * (t.y - by) <= R2) { t.gor = d.t; t.gg = gec(); }
        if (t.gor + t.gg <= sn) { yp[n++] = t.x; yp[n++] = t.y; }
      }
      if (k.gor === Infinity) {
        for (let j = 0; j < s.engeller.length; j++) {
          const e = s.engeller[j];
          if (e.x - bx <= R && cemberKesar(e, bx, by, R)) { k.gor = d.t; k.gg = gec(); break; }
        }
      }
      if (k.gor + k.gg <= sn) { yp[n++] = s.x - RC; yp[n++] = k.c; yp[n++] = s.x + s.w + RC; yp[n++] = k.c; }
    }
    const q = bx + hiz * 0.1;
    let hedef = null;
    for (let i = 0; i < n; i += 2) {
      if (yp[i] >= q) { hedef = i === 0 ? yp[1] : yp[i - 1] + (yp[i + 1] - yp[i - 1]) * (q - yp[i - 2]) / (yp[i] - yp[i - 2]); break; }
    }
    if (hedef === null && n) hedef = yp[n - 2] > kacisX ? yp[n - 1] : kacisY;
    if (hedef === null) hedef = sonHedef === null ? by : sonHedef;
    sonHedef = hedef;
    let ilk = -1;
    for (let i = 0; i < kuyruk.length; i++) {
      const k = kuyruk[i], s = k.s;
      if (k.tp && k.tgor === Infinity && (s.bomba ? s.bomba.x - bx <= BOMBA_GOR : s.sarmasik.faz >= 1)) { k.tgor = d.t; k.tg = gec(); }
      if (s.sarmasik && k.tgor + k.tg <= sn) k.tp = sarmasikBilinen(s.sarmasik, bx);
      if (ilk < 0 && s.x + s.w + RC >= bx) ilk = i;
    }
    if (ilk >= 0) {
      const k1 = kuyruk[ilk], k2 = kuyruk[ilk + 1];
      let y = k1.tgor + k1.tg <= sn ? kacisHedefi(AB, d, bx, k1.tp, null) : null;
      if (y === null && k2 && k2.tgor + k2.tg <= sn && k1.gor + k1.gg <= sn) y = kacisHedefi(AB, d, bx, k2.tp, bantOf(k1.s));
      if (y !== null) { kacisX = y.x2; kacisY = y.y; return kontrol(d, y.y + hata, y.sert); }
    }
    return kontrol(d, hedef + hata);
  };
  bot.hata = 0;
  return bot;
}

// ---- bagimsiz degismez denetimi (botun gectigi dilimler)
function zarflar(s) {
  return s.engeller.map(e => {
    if (e.tur === 'kus') return { x1: s.x, x2: s.x + s.w, y1: e.y, y2: e.y + e.h };
    if (e.tur === 'salinan') return { x1: e.x, x2: e.x + e.w, y1: e.yc - e.gen, y2: e.yc + e.gen + e.h };
    if (e.tur === 'dusen') return { x1: e.x, x2: e.x + e.w, y1: 0, y2: e.sarmasik + e.h };
    return { x1: e.x, x2: e.x + e.w, y1: e.y, y2: e.y + e.h };
  });
}
const noktaZarf = (x, y, z) => Math.hypot(Math.max(0, z.x1 - x, x - z.x2), Math.max(0, z.y1 - y, y - z.y2));
function denetci() {
  return { ihlal: 0, ornek: [], enAzTepki: Infinity, enAzBomba: Infinity, enAzGecit: Infinity, enAzMarj: Infinity, iz: new Map(), sonNo: -1, onceki: null,
           kusur(m) { this.ihlal++; if (this.ornek.length < 5) this.ornek.push(m); } };
}
function yapiDenetle(AB, dn, s) {
  const zs = zarflar(s), bMin = Z.BOSLUK_TABAN - Z.BOSLUK_Z;
  if (s.alt - s.ust < bMin - EPS) dn.kusur('bosluk < 16');
  zs.forEach(z => { if (!(z.y2 <= s.ust + EPS || z.y1 >= s.alt - EPS)) dn.kusur('zarf boslugu kesiyor'); });
  s.engeller.forEach(e => { if (e.tur === 'salinan') dn.enAzGecit = Math.min(dn.enAzGecit, s.alt - s.ust); });
  const p = dn.onceki, tum = zs.concat(p ? zarflar(p) : []);
  s.toz.concat(s.kivilcim ? [s.kivilcim] : []).forEach(tz => {
    let en = Infinity; tum.forEach(z => { en = Math.min(en, noktaZarf(tz.x, tz.y, z)); });
    dn.enAzMarj = Math.min(dn.enAzMarj, en);
    if (en < Z.ISIK_MARJ - EPS) dn.kusur('isik engel zarfina ' + en.toFixed(3));
  });
  dn.onceki = s;
}
// zaman: her engel isik 0 yaricapina (minYaricap) girdigi an -> on kenari bocek on yuzune degdigi an >= T_MIN (toleranssiz; iki an da
// adim ici dogrusal ara degerlemeyle, adalet testindeki zamanDenetle ile ayni); bomba on isaret (BOMBA_GOR) -> carpma mesafesi (RB)
// >= BOMBA_KACIS_SN (adim ici dogrusal ara degerleme).
function zamanDenetle(AB, dn, d, bx0, t0) {
  const bx = d.mesafe + XB, R0 = AB.minYaricap(AB.zorluk(d.mesafe).hiz), ara = x => t0 + (d.t - t0) * (x - bx0) / (bx - bx0);
  for (const s of d.dilimler) {
    if (s.no > dn.sonNo) {
      dn.sonNo = s.no; yapiDenetle(AB, dn, s);
      dn.iz.set(s, { gor: s.engeller.map(() => Infinity), g: s.engeller.map(() => Infinity), R: s.engeller.map(() => 0), t: s.engeller.map(() => 0),
                     bomGor: null, bitti: s.engeller.map(() => false), bomBitti: !s.bomba });
    }
    const k = dn.iz.get(s); if (!k) continue;
    s.engeller.forEach((e, j) => {
      if (k.bitti[j]) return;
      const g = Math.max(0, e.x - bx);
      // ilk gozlem: engel gorunur alanin (R0) disinda dogmali; sonra onceki adimla dogrusal ara degerleme (bocek ve kus adim icinde dogrusal)
      if (k.g[j] === Infinity) { if (g <= R0) dn.kusur('engel gorunur alanda dogdu'); k.g[j] = g; k.R[j] = R0; k.t[j] = d.t; return; }
      if (k.gor[j] === Infinity && g <= R0) { const a0 = k.g[j] - k.R[j], a1 = g - R0; k.gor[j] = k.t[j] + (d.t - k.t[j]) * a0 / (a0 - a1); }
      if (g <= RC) {
        const v = k.t[j] + (d.t - k.t[j]) * (k.g[j] - RC) / (k.g[j] - g), pay = v - k.gor[j];
        dn.enAzTepki = Math.min(dn.enAzTepki, pay); if (!(pay >= T_MIN - EPS)) dn.kusur('tepki ' + pay.toFixed(4)); k.bitti[j] = true; return;
      }
      k.g[j] = g; k.R[j] = R0; k.t[j] = d.t;
    });
    if (!k.bomBitti) {
      const bo = s.bomba;
      if (k.bomGor === null && bo.x - bx <= BOMBA_GOR) k.bomGor = bo.x - bx0 > BOMBA_GOR ? ara(bo.x - BOMBA_GOR) : d.t;
      if (bx >= bo.x - RB) { const gv = ara(bo.x - RB) - k.bomGor; dn.enAzBomba = Math.min(dn.enAzBomba, gv); if (gv < BOMBA_KACIS_SN - 1e-6) dn.kusur('bomba ' + gv.toFixed(3)); k.bomBitti = true; }
    }
  }
  for (const s of dn.iz.keys()) if (s.x + s.w < bx - 5) dn.iz.delete(s);
}

// ---- kosu
// tavan (istege bagli): karar kumesi icin; yoksa TAVAN
function kos(AB, tohum, bas, sigma, dn, tavan) {
  const d = AB.oyunOlustur(tohum, bas), r = AB.rngOlustur((tohum ^ 0x5DEECE66) >>> 0), bot = dikkatliBot(AB, r, sigma), tv = tavan || TAVAN;
  const m0 = d.mesafe, hasar = {}; let sonHasar = '', hasarSay = 0, hataTop = 0;
  while (!d.bitti && d.mesafe - m0 < tv) {
    const bx0 = d.mesafe + XB, t0 = d.t;
    const ol = AB.adim(d, bot(d));
    for (const o of ol) {
      if (o.tur === 'hasar' || o.tur === 'ag' || o.tur === 'bomba' || o.tur === 'sarmasik') {
        const k = o.tur === 'hasar' ? o.engel : o.tur; hasar[k] = (hasar[k] || 0) + 1; sonHasar = k; hasarSay++; hataTop += Math.abs(bot.hata);
      }
      if (o.tur === 'sersem') { hasar.sersem = (hasar.sersem || 0) + 1; }
    }
    if (dn) zamanDenetle(AB, dn, d, bx0, t0);
  }
  return { m: d.mesafe - m0, bitti: d.bitti, sebep: d.bitti ? (d.sebep === 'zemin' ? 'zemin' : 'isik/' + (sonHasar || 'sizinti')) : 'yasadi', hasar, hasarSay, hataOrt: hasarSay ? hataTop / hasarSay : 0, puan: d.puan };
}
const tohumNo = i => (Math.imul(i + 1, 2654435761) + 0x1234567) >>> 0;
function dagilim(L) {
  const m = L.map(x => x.m).sort((a, b) => a - b), q = f => m[Math.min(m.length - 1, Math.floor(f * m.length))];
  const neden = {}; L.forEach(x => { neden[x.sebep] = (neden[x.sebep] || 0) + 1; });
  const hz = {}; L.forEach(x => Object.keys(x.hasar).forEach(k => { hz[k] = (hz[k] || 0) + x.hasar[k]; }));
  const top = m.reduce((a, b) => a + b, 0);
  return { ort: top / m.length, med: q(0.5), p10: q(0.1), p90: q(0.9), tavan: L.filter(x => !x.bitti).length, neden, hz, hasar1000: 1000 * L.reduce((a, x) => a + x.hasarSay, 0) / top,
           hataOrt: L.reduce((a, x) => a + x.hataOrt * x.hasarSay, 0) / Math.max(1, L.reduce((a, x) => a + x.hasarSay, 0)) };
}
const f0 = v => Math.round(v).toString();
function satir(ad, D, dn) {
  return '| ' + ad + ' | ' + f0(D.ort) + ' | ' + f0(D.med) + ' | ' + f0(D.p10) + ' | ' + f0(D.p90) + ' | ' + D.tavan + ' | ' + D.hasar1000.toFixed(2) + ' | ' +
         Object.keys(D.neden).sort().map(k => k + ' ' + D.neden[k]).join(', ') + ' | ' + Object.keys(D.hz).sort().map(k => k + ' ' + D.hz[k]).join(', ') + ' | ' +
         (dn ? dn.ihlal : '-') + ' |';
}

const bas = Date.now();
console.log('Dikkatli bot: ' + TOHUM + ' tohum, kosu tavani ' + TAVAN + ' birim, tepki ' + GEC_MIN + '-' + GEC_MAX + ' sn, nisan hatasi sigma ' + SIGMA + ' (tau ' + TAU + ' sn); D_MAX ' + Z.D_MAX + ', D_ADIM ' + Z.D_ADIM);
const BAS_S = { mesafe: A.zorluk.KADEME[4] + Z.D_ADIM * Z.D_MAX, puan: Math.round(0.75 * (A.zorluk.KADEME[4] + Z.D_ADIM * Z.D_MAX)) };
console.log('\nOlcum 1: sabit derece, kosu ' + BAS_S.mesafe + ' birimden (hiz 44). Mesafe = baslangictan olume (tavan: ' + TAVAN + ').');
console.log('| d | ort | medyan | p10 | p90 | tavana ulasan | hasar/1000 birim | olum nedeni (son hasar) | hasar turleri | degismez ihlali |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const ozet1 = [], dnTum = denetci();
for (const dv of DERECELER) {
  const C = cekirdek({ dSabit: dv }), L = [], dn = denetci();
  for (let i = 0; i < TOHUM; i++) L.push(kos(C, tohumNo(i), BAS_S, SIGMA, dn));
  const D = dagilim(L); ozet1.push([dv, D]);
  dnTum.ihlal += dn.ihlal; dnTum.ornek.push(...dn.ornek);
  ['enAzTepki', 'enAzBomba', 'enAzGecit', 'enAzMarj'].forEach(k => { dnTum[k] = Math.min(dnTum[k], dn[k]); });
  console.log(satir(String(dv), D, dn) + '  (tepki en az ' + dn.enAzTepki.toFixed(3) + ' sn, bomba ' + dn.enAzBomba.toFixed(3) + ' sn, gecit ' + dn.enAzGecit.toFixed(2) + ', isik marji ' + dn.enAzMarj.toFixed(2) + ')');
}
console.log('\nOlcum 2: gercek ilerleme, kosu Bolge 5 basindan (' + A.zorluk.KADEME[4] + ', puan 3000); FAZ 3 oncesi = ayni cekirdek D_MAX 0.');
console.log('| cekirdek | ort | medyan | p10 | p90 | tavana ulasan | hasar/1000 birim | olum nedeni (son hasar) | hasar turleri | degismez ihlali |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const BAS_G = { mesafe: A.zorluk.KADEME[4], puan: 3000 }, ozet2 = [];
for (const [ad, C] of [['FAZ 3 oncesi (D_MAX 0)', cekirdek({ dMax: 0 })], ['FAZ 3 (D_MAX ' + Z.D_MAX + ')', AB]]) {
  const L = [], dn = denetci();
  for (let i = 0; i < TOHUM; i++) L.push(kos(C, tohumNo(i), BAS_G, SIGMA, dn));
  const D = dagilim(L); ozet2.push(D);
  dnTum.ihlal += dn.ihlal; dnTum.ornek.push(...dn.ornek);
  console.log(satir(ad, D, dn));
}
// Kontrol: hata 0 (yalniz 250-350 ms gecikme), en yuksek derece, ayni tohumlar: 0 hasar beklenir.
const C8 = cekirdek({ dSabit: Z.D_MAX }), K = [], dnK = denetci(), KT = Math.min(TOHUM, 100);
for (let i = 0; i < KT; i++) K.push(kos(C8, tohumNo(i), BAS_S, 0, dnK));
const DK = dagilim(K);
console.log('\nKontrol (hata 0, d = ' + Z.D_MAX + ', ' + KT + ' tohum): hasar ' + K.reduce((a, x) => a + x.hasarSay, 0) + ', olum ' + K.filter(x => x.bitti).length + ', degismez ihlali ' + dnK.ihlal);
console.log('Hasar aninda ortalama |nisan hatasi|: ' + ozet1.map(([dv, D]) => 'd ' + dv + ' ' + D.hataOrt.toFixed(2)).join(', ') + ' birim (sigma ' + SIGMA + ')');
console.log('Degismezler (butun kosular): ihlal ' + dnTum.ihlal + (dnTum.ornek.length ? ' ' + dnTum.ornek.slice(0, 5).join(' | ') : '') + '; en kisa tepki ' + dnTum.enAzTepki.toFixed(3) +
            ' sn, bomba on isaret -> carpma ' + dnTum.enAzBomba.toFixed(3) + ' sn, orumcek gecidi en az ' + dnTum.enAzGecit.toFixed(2) + ', isik marji en az ' + dnTum.enAzMarj.toFixed(2));
let hata = 0;
if (dnTum.ihlal + dnK.ihlal > 0) { console.log('HATA: degismez ihlali'); hata = 1; }
if (K.some(x => x.hasarSay > 0 || x.bitti)) { console.log('HATA: hata 0 kontrol kosusunda hasar/olum'); hata = 1; }
// "Ortalama dustu" karari arguman bagimsiz SABIT kumede (KARAR: varsayilan 200 tohum, tavan 30000, sigma 2,2): her kosuda ayni sonuc.
// Argumanlar varsayilansa yukaridaki olcumler kullanilir; degilse karar kumesi ayrica kosulur (tablolar yine argumanlarla).
const KARAR = { tohum: 200, tavan: 30000, sigma: 2.2 };
if (Z.D_MAX === 0) console.log('Karar (ortalama dustu): D_MAX 0, atlandi');
else {
  const ayni = TOHUM === KARAR.tohum && TAVAN === KARAR.tavan && SIGMA === KARAR.sigma;
  const ortOf = (C, b) => { const L = []; for (let i = 0; i < KARAR.tohum; i++) L.push(kos(C, tohumNo(i), b, KARAR.sigma, null, KARAR.tavan)); return dagilim(L).ort; };
  const o1 = new Map(ozet1.map(([dv, D]) => [dv, D.ort]));
  let k0, kM, g0, gM;
  if (ayni && o1.has(0) && o1.has(Z.D_MAX)) { k0 = o1.get(0); kM = o1.get(Z.D_MAX); g0 = ozet2[0].ort; gM = ozet2[1].ort; }
  else { k0 = ortOf(cekirdek({ dSabit: 0 }), BAS_S); kM = ortOf(cekirdek({ dSabit: Z.D_MAX }), BAS_S); g0 = ortOf(cekirdek({ dMax: 0 }), BAS_G); gM = ortOf(AB, BAS_G); }
  console.log('Karar (sabit kume ' + KARAR.tohum + ' tohum, sigma ' + KARAR.sigma + ', tavan ' + KARAR.tavan + (ayni ? '' : '; ayrica kosuldu') + '): sabit d 0 ort ' + f0(k0) + ' -> d ' + Z.D_MAX + ' ' + f0(kM) +
              '; gercek ilerleme D_MAX 0 ' + f0(g0) + ' -> FAZ 3 ' + f0(gM));
  if (!(kM < k0)) { console.log('HATA: en yuksek derecede ortalama mesafe d = 0\'dan kisa degil'); hata = 1; }
  if (!(gM < g0)) { console.log('HATA: gercek ilerlemede ortalama mesafe FAZ 3 oncesinden kisa degil'); hata = 1; }
}
console.log('\nsure ' + ((Date.now() - bas) / 1000).toFixed(1) + ' sn' + (hata ? ', HATA VAR' : ', tamam'));
process.exitCode = hata;
