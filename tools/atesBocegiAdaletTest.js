// atesBocegiAdaletTest.js — tohum x bot adalet testi (tasarim 8.2).
// Calistirma:  node tools/atesBocegiAdaletTest.js [tohumSayisi=1000] [mesafe=20000]
// Botlar yalniz cekirdek API'sini (oyunOlustur, adim, dilimZarfi, zorluk, isikYaricapi,
// minYaricap, kosuJetonu) ve durum/dilim alanlarini okur.
'use strict';
const assert = require('assert');
const AB = require('../js/atesBocegi.js');
const A = AB.AYAR, DT = A.dunya.DT, XB = A.dunya.X_BOCEK, H = A.dunya.H, RC = A.hareket.R_CARPMA;
const T_MIN = A.adalet.T_MIN, K = A.adalet.KUS_EK, V = A.adalet.V_GUVENLI, T_IVME = A.adalet.T_IVME;
const U = A.uretici, EPS = 1e-9, NEFES_SURE = 2;   // 3.4 kural 8: "2 sn engel yok"

const TOHUM_SAYI = +process.argv[2] || 1000, MESAFE = +process.argv[3] || 20000;
const tohum = i => (Math.imul(i + 1, 2654435761) + 0x7F4A7C15) >>> 0;

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// ---------------------------------------------------------------
// Yapisal denetci: her yeni dilim + her engelin gorunurluk / varis zamani
// ---------------------------------------------------------------
const ist = { dilim: 0, nefes: 0, kivilcim: 0, uzakDilim: 0, uzakKivilcim: 0, tur: { dal: 0, ag: 0, kus: 0, dusen: 0 },
              enAzPay: Infinity, enAzAra: Infinity, enCokDcOran: 0, kusur: [] };
function kusur(tohum, s, msg) { ist.kusur.push('tohum ' + tohum + ' dilim ' + (s ? s.no : '-') + ': ' + msg); }

// En kotu durum zarfi (3.4 tablosu), ham engel verisinden; dilimin varis anindaki x araligi.
function zarflar(s) {
  return s.engeller.map(e => {
    if (e.tur === 'kus') return { x1: s.x, x2: s.x + s.w, y1: e.y, y2: e.y + e.h };
    if (e.tur === 'dusen') return { x1: e.x, x2: e.x + e.w, y1: 0, y2: e.sarmasik + e.h };
    return { x1: e.x, x2: e.x + e.w, y1: e.y, y2: e.y + e.h };
  });
}
const icinde = (z, x, y) => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2;
const yol = (c1, c2, f) => c1 + (c2 - c1) * (1 - Math.cos(Math.PI * f)) / 2;

function yeniDenetci(t) {
  return { t: t, son: null, sonNo: -1, ustSay: 0, altSay: 0, nefesBekle: false,
           aktif: [], sonVaris: null };
}
function dilimDenetle(dn, s) {
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
  const oncekiZ = p ? zarflar(p) : [], hepsi = zs.concat(oncekiZ), a = px + pw, b = s.x;
  if (s.toz.length < U.TOZ_MIN || s.toz.length > U.TOZ_MAX) kusur(t, s, 'toz sayisi ' + s.toz.length);
  s.toz.forEach(tz => {
    if (!(tz.x > a && tz.x < b)) kusur(t, s, 'toz araligin disinda');
    const f = (tz.x - a) / (b - a);
    if (Math.abs(tz.y - yol(pc, c, f)) > U.TOZ_SAPMA + 1e-6) kusur(t, s, 'toz egriden sapmis');
    if (hepsi.some(z => icinde(z, tz.x, tz.y))) kusur(t, s, 'toz zarf icinde');
  });
  // kural 7: kivilcim
  const kv = s.kivilcim;
  if (kv) {
    const f = (kv.x - a) / (b - a), uz = Math.abs(kv.y - yol(pc, c, f));
    if (!(kv.x > a && kv.x < b)) kusur(t, s, 'kivilcim araligin disinda');
    if (uz < U.KIVILCIM_UZAK_MIN - 1e-6 || uz > U.KIVILCIM_UZAK_MAX + 1e-6) kusur(t, s, 'kivilcim uzakligi ' + uz);
    if (kv.y < A.dunya.Y_UST || kv.y > A.dunya.Y_ALT) kusur(t, s, 'kivilcim ulasilamaz yukseklikte');
    if (Math.max(Math.abs(kv.y - pc), Math.abs(c - kv.y)) > V * zr.tAra / 2 + 1e-6) kusur(t, s, 'kivilcim bacagi > V_GUVENLI * tAra / 2');
    if (Math.abs(kv.x - (a + b) / 2) > 1e-6) kusur(t, s, 'kivilcim ortada degil');
    if (hepsi.some(z => icinde(z, kv.x, kv.y))) kusur(t, s, 'kivilcim zarf icinde');
  }
  if (!s.nefes) dn.oncekiGercek = { x: s.x, w: s.w };
  dn.son = { no: s.no, x: s.x, w: s.w, c: c, nefes: s.nefes, engeller: s.engeller.map(e => Object.assign({}, e)) };
  dn.sonNo = s.no;
}

// Gorunurluk (en kotu durum: isik = 0 -> yaricap minYaricap, bocek ayni yukseklikte -> yatay mesafe)
// ve varis (on kenar bocegin onune degdigi an). Zamanlar adim icinde dogrusal ara degerlemeyle.
// Iz durumu ayri kuyrukta tutulur; cekirdegin nesnelerine alan eklenmez.
function izBaslat(dn, s) {
  const h = s.engeller.length ? s.engeller.slice() : [s];   // nefes: dilimin kendisi
  dn.aktif.push({ s: s, h: h, g: h.map(() => Infinity), R: h.map(() => 0), t: h.map(() => 0),
                  gor: h.map(() => Infinity), bitti: h.map(() => false), kalan: h.length, v: Infinity });
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
const KP = 6;
function kontrol(d, hedef) {
  const v = Math.max(-A.hareket.VY_YUKARI, Math.min(A.hareket.VY_ASAGI, KP * (hedef - d.y)));
  return d.vy > v;      // basili: yukari ivme
}
// Bot A: siradaki (gecilmemis) dilimin bosluk merkezini gecikmesiz hedefler.
function botA() {
  return d => {
    const bx = d.mesafe + XB;
    for (const s of d.dilimler) {
      if (s.x + s.w + RC >= bx) { const z = AB.dilimZarfi(s); return kontrol(d, (z.ust + z.alt) / 2); }
    }
    return kontrol(d, d.y);
  };
}
function cemberKesar(e, bx, by, r) {
  const cx = Math.max(e.x, Math.min(bx, e.x + e.w)), cy = Math.max(e.y, Math.min(by, e.y + e.h));
  return (bx - cx) * (bx - cx) + (by - cy) * (by - cy) <= r * r;
}
// Bot B: yalniz isik cemberine giren seyi gorur (engel -> dilimin boslugu, toz -> konumu),
// gordugunden T_MIN sonra kullanir. sabit: yaricap isik = 0'a gore (en kotu durum).
// Gorulme anlari botun kendi kuyrugunda tutulur; cekirdegin nesnelerine alan eklenmez.
function botB(sabit) {
  let sonHedef = null, sonNo = -1;
  const kuyruk = [], yp = new Float64Array(512);   // bilinen yol noktalari: x0, y0, x1, y1, ...
  return d => {
    const bx = d.mesafe + XB, by = d.y, hiz = AB.zorluk(d.mesafe).hiz;
    const R = AB.isikYaricapi(sabit ? 0 : d.isik, hiz, d.bolge), R2 = R * R, sinir = d.t - T_MIN + EPS;
    const L = d.dilimler;
    for (let i = 0; i < L.length; i++) {
      if (L[i].no <= sonNo) continue;
      const s = L[i]; sonNo = s.no;
      const z = AB.dilimZarfi(s);
      kuyruk.push({ s: s, c: (z.ust + z.alt) / 2, gor: Infinity, toz: s.toz.map(t => ({ x: t.x, y: t.y, gor: Infinity })) });
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
    if (hedef === null && n) hedef = yp[n - 1];
    if (hedef === null) hedef = sonHedef === null ? by : sonHedef;
    sonHedef = hedef;
    return kontrol(d, hedef);
  };
}

// ---------------------------------------------------------------
// Kosu
// ---------------------------------------------------------------
function kos(t, bot, secenek) {
  const d = AB.oyunOlustur(t), dn = yeniDenetci(t);
  const yeni = () => { const L = d.dilimler; let i = L.length; while (i > 0 && L[i - 1].no > dn.sonNo) i--; for (; i < L.length; i++) { dilimDenetle(dn, L[i]); if (secenek.zaman) izBaslat(dn, L[i]); } };
  yeni();
  let carpma = 0, enAzIsik = d.isik, adimSay = 0;
  while (d.mesafe < MESAFE && !d.bitti) {
    if (secenek.isikSabit) d.isik = 1;
    const olay = AB.adim(d, bot(d));
    adimSay++;
    yeni();
    for (const o of olay) {
      if (o.tur === 'hasar' || o.tur === 'ag') carpma++;
      if (o.tur === 'bolge') dn.nefesBekle = true;
    }
    if (secenek.zaman) zamanDenetle(dn, d);
    if (d.isik < enAzIsik) enAzIsik = d.isik;
  }
  return { d: d, carpma: carpma, enAzIsik: enAzIsik, adim: adimSay };
}

console.log('Ates Bocegi adalet: ' + TOHUM_SAYI + ' tohum x ' + MESAFE + ' birim');
const bas = Date.now();
const sonuc = { A: [], B: [], Bg: [], C0: [], C1: [] };
for (let i = 0; i < TOHUM_SAYI; i++) {
  const t = tohum(i);
  const a = kos(t, botA(), { isikSabit: true, zaman: true });   // zaman denetimi geometriye bagli: A kosusunda
  sonuc.A.push({ t: t, c: a.carpma, m: a.d.mesafe });
  const b = kos(t, botB(true), { isikSabit: true });
  sonuc.B.push({ t: t, c: b.carpma, m: b.d.mesafe });
  const bg = kos(t, botB(false), {});
  sonuc.Bg.push({ t: t, c: bg.carpma, m: bg.d.mesafe, isik: bg.enAzIsik, bitti: bg.d.bitti });
  [[false, 'C0'], [true, 'C1']].forEach(([bas, ad]) => {
    const c = kos(t, () => bas, {});
    sonuc[ad].push({ t: t, sure: c.d.t, toz: c.d.toz, bitti: c.d.bitti,
                     jeton: AB.kosuJetonu(c.d.puan, c.d.toz, 0, A).jeton, puan: c.d.puan });
  });
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
dene('Bot A (ideal): ' + TOHUM_SAYI + '/' + TOHUM_SAYI + ' tohumda 0 carpisma', () => {
  const n = sonuc.A.filter(x => x.c > 0).length; assert.strictEqual(n, 0, n + ' tohum carpti: ' + kotu(sonuc.A, x => x.c > 0));
});
dene('Bot B (gecikmeli, isik = 0 sabit): ' + TOHUM_SAYI + '/' + TOHUM_SAYI + ' tohumda 0 carpisma', () => {
  const n = sonuc.B.filter(x => x.c > 0).length; assert.strictEqual(n, 0, n + ' tohum carpti: ' + kotu(sonuc.B, x => x.c > 0));
});
dene('Bot B gercek isikla: isik hicbir tohumda 0,25 altina inmez', () => {
  const n = sonuc.Bg.filter(x => x.isik < 0.25 || x.bitti || x.m < MESAFE).length;
  const enAz = Math.min(...sonuc.Bg.map(x => x.isik));
  assert.strictEqual(n, 0, n + ' tohum, en az isik ' + enAz.toFixed(3) + ': ' + kotu(sonuc.Bg, x => x.isik < 0.25 || x.bitti));
  console.log('       en az isik ' + enAz.toFixed(3) + ', carpisan tohum ' + sonuc.Bg.filter(x => x.c > 0).length);
});
[['C0', 'hic basmaz'], ['C1', 'hep basili']].forEach(([ad, ac]) => {
  dene('Bot C (' + ac + '): <= 40 sn biter, toz < 10, jeton 0', () => {
    const r = sonuc[ad];
    const n = r.filter(x => !x.bitti || x.sure > 40 || x.toz >= 10 || x.jeton !== 0).length;
    assert.strictEqual(n, 0, n + ' tohum: ' + kotu(r, x => !x.bitti || x.sure > 40 || x.toz >= 10 || x.jeton !== 0));
    console.log('       en uzun ' + Math.max(...r.map(x => x.sure)).toFixed(2) + ' sn, en cok toz ' + Math.max(...r.map(x => x.toz)) +
                ', en cok puan ' + Math.max(...r.map(x => x.puan)));
  });
});
console.log('  bilgi: ' + ist.dilim + ' dilim, nefes ' + ist.nefes + ', kivilcim ' + ist.kivilcim + ' (%' + (100 * ist.kivilcim / ist.dilim).toFixed(2) +
            '), engel ' + JSON.stringify(ist.tur) + ', en cok |dc|/sinir ' + ist.enCokDcOran.toFixed(3) +
            ', en az (varis arasi - tAra) ' + ist.enAzAra.toFixed(4) + ' sn, sure ' + sure + ' sn');
console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
