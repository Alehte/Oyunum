// atesBocegiTemaTest.js — Ates Bocegi temalari: katalog, kontrast, isikCoz, onizleme, tema gorselligi.
// Tasarim: docs/atesBocegi-tasarim.md bolum 5, 6, 8.3, 8.6, 12.3.
// Tema gorselligi (12.3): her tema bolge tonlari, engel, bocek govdesi, halo, uzak katman ve tehlike tonunu
// isik alaninda tasir; kontrast kurallari temadan cozulen (isikCoz) bu renklerle hesaplanir.
// Calistirma:  node tools/atesBocegiTemaTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const KOK = path.join(__dirname, '..');
const oku = f => fs.readFileSync(path.join(KOK, f), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// ---- Katalog ve market.js sahte pencerede yuklenir ----
function pencere() {
  const depo = {};
  const win = {
    AppProgress: { gold: 0 },
    AppGold: { harca() { return true; }, add() {} },
    AppStore: { get: (k, v) => (k in depo ? depo[k] : v), set: (k, v) => { depo[k] = v; } },
    AppSaveProgress() {}, AppReset: [], AppGelistirme: null, AppReklam: null,
    addEventListener() {}
  };
  win.window = win;
  const doc = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => sahteEl(), createElementNS: () => sahteEl()
  };
  win.document = doc;
  return { win, doc };
}
function sahteEl() {
  const e = {
    cocuklar: [], className: '', innerHTML: '', style: {}, attrs: {},
    appendChild(c) { e.cocuklar.push(c); return c; },
    setAttribute(k, v) { e.attrs[k] = String(v); }, removeAttribute(k) { delete e.attrs[k]; },
    getAttribute(k) { return k in e.attrs ? e.attrs[k] : null; },
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} }
  };
  e.style.setProperty = (k, v) => { e.style[k] = v; };
  e.style.removeProperty = k => { delete e.style[k]; };
  return e;
}
function yukle(oyunVar, katalogDegis) {
  const { win, doc } = pencere();
  const ctx = vm.createContext(win);
  const cagri = [];
  if (oyunVar) win.AtesBocegiOyun = { temaDegisti() { cagri.push(1); } };
  vm.runInContext(katalogDegis ? katalogDegis(oku('js/marketKatalog.js')) : oku('js/marketKatalog.js'), ctx, { filename: 'marketKatalog.js' });
  vm.runInContext(oku('js/market.js'), ctx, { filename: 'market.js' });
  return { win, doc, ctx, cagri };
}
const { win: W, doc: DOC, ctx: CTX } = yukle(false);
const KAT = W.AppMarketKatalog, M = W.AppMarket;
const TEMALAR = KAT.TEMALAR.filter(t => !t.varsayilan);
const OYUN = oku('js/atesBocegiOyun.js'), CEKIRDEK = oku('js/atesBocegi.js');

// ---- renk yardimcilari ----
const HEX = /^#[0-9A-Fa-f]{6}$/;
const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255);
const dogrusal = c => c.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
const karistir = (a, b, t) => { const x = rgb(a), y = rgb(b); return x.map((v, i) => v + (y[i] - v) * t); };  // sRGB 0-1
const VIENOT = {
  normal: null,
  protanopi: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]],
  deuteranopi: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]]
};
function parlaklik(lin, bicim) {
  let c = lin;
  const m = VIENOT[bicim];
  if (m) c = m.map(s => s[0] * lin[0] + s[1] * lin[1] + s[2] * lin[2]);
  c = c.map(v => Math.min(1, Math.max(0, v)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const oran = (a, b, bicim) => {
  const la = parlaklik(dogrusal(a), bicim), lb = parlaklik(dogrusal(b), bicim);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
// CIELAB (D65) ve CIEDE2000 (Sharma, Wu, Dalal 2005). labDogrusal: dogrusal RGB 0-1 girdi.
function labDogrusal(r, g, b) {
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116), fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const labOf = c => { const l = dogrusal(c); return labDogrusal(l[0], l[1], l[2]); };   // sRGB 0-1 girdi
function de2000(p, q) {
  const R = Math.PI / 180, [L1, a1, b1] = p, [L2, a2, b2] = q, p7 = x => Math.pow(x, 7), P25 = p7(25);
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(p7(Cm) / (p7(Cm) + P25)));
  const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G), C1 = Math.hypot(ap1, b1), C2 = Math.hypot(ap2, b2);
  let h1 = Math.atan2(b1, ap1) / R; if (h1 < 0) h1 += 360;
  let h2 = Math.atan2(b2, ap2) / R; if (h2 < 0) h2 += 360;
  let dh = 0; if (C1 * C2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh / 2 * R), Lm = (L1 + L2) / 2, Cpm = (C1 + C2) / 2;
  let hm = h1 + h2; if (C1 * C2 !== 0) hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2) : (h1 + h2) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * R) + 0.24 * Math.cos(2 * hm * R) + 0.32 * Math.cos((3 * hm + 6) * R) - 0.20 * Math.cos((4 * hm - 63) * R);
  const dT = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2)), RC = 2 * Math.sqrt(p7(Cpm) / (p7(Cpm) + P25));
  const SL = 1 + 0.015 * Math.pow(Lm - 50, 2) / Math.sqrt(20 + Math.pow(Lm - 50, 2)), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T, RT = -Math.sin(2 * dT * R) * RC;
  return Math.sqrt(Math.pow(dL / SL, 2) + Math.pow(dC / SC, 2) + Math.pow(dH / SH, 2) + RT * (dC / SC) * (dH / SH));
}
const EN_DUSUK = {};
const izle = (ad, o) => { if (!(ad in EN_DUSUK) || o < EN_DUSUK[ad]) EN_DUSUK[ad] = o; };
// ---- sabitler koddan okunur (kopya yok) ----
const sabit = (kaynak, ad) => { const m = new RegExp(ad + " = '(#[0-9A-Fa-f]{6})'").exec(kaynak); assert(m, ad + ' bulunamadi'); return m[1]; };
const ENGEL_DOLGU = sabit(OYUN, 'ENGEL_DOLGU'), ENGEL_KENAR = sabit(OYUN, 'ENGEL_KENAR');
const bm = /BOLGE_TON = \[([^\]]*)\]/.exec(OYUN);
const BOLGE = bm[1].match(/#[0-9A-Fa-f]{6}/g);          // yerlesik bolge tonlari (temalar isik.bolgeler ile verir)
const ISIK_KARISIM = +/ISIK_KARISIM = ([0-9.]+)/.exec(OYUN)[1];
const BICIMLER = Object.keys(VIENOT);
const YERLESIK_PALET = M.isikCoz({ yerlesik: true });
// Temadan cozulen paletler (oyun ayni isikCoz ciktisini kullanir; birebirlik atesBocegiOyunTest.js'te): 9 tema + yerlesik
const PALET = {};
TEMALAR.forEach(t => { PALET[t.id] = M.isikCoz(t.isik); });
PALET.yerlesik = YERLESIK_PALET;
const zeminOf = (P, bi) => karistir(P.bolgeler[bi], P.isik, ISIK_KARISIM);
// Tehlike renkleri: oyundaki renkCoz ile ayni formul (taban renk + tema tonu, sabit oran; ton yoksa taban)
const TEHLIKE_KARISIM = +/TEHLIKE_KARISIM = ([0-9.]+)/.exec(OYUN)[1], BITKI_KARISIM = +/BITKI_KARISIM = ([0-9.]+)/.exec(OYUN)[1];
const TABAN = { BOMBA_KENAR: sabit(OYUN, 'BOMBA_KENAR'), BOMBA_CEKIRDEK: sabit(OYUN, 'BOMBA_CEKIRDEK'), UNLEM_RENK: sabit(OYUN, 'UNLEM_RENK'),
  SARMASIK_GOVDE: sabit(OYUN, 'SARMASIK_GOVDE'), SARMASIK_YAPRAK: sabit(OYUN, 'SARMASIK_YAPRAK') };
function tehlikeRenk(P) {   // ad -> sRGB 0-1
  const o = {}, t = P.tehlike.ton, b = P.tehlike.bitki;
  const yuvarla = c => c.map(v => Math.round(v * 255) / 255);         // oyundaki karistir hex'e yuvarlar
  ['BOMBA_KENAR', 'BOMBA_CEKIRDEK', 'UNLEM_RENK'].forEach(k => { o[k] = t ? yuvarla(karistir(TABAN[k], t, TEHLIKE_KARISIM)) : rgb(TABAN[k]); });
  ['SARMASIK_GOVDE', 'SARMASIK_YAPRAK'].forEach(k => { o[k] = b ? yuvarla(karistir(TABAN[k], b, BITKI_KARISIM)) : rgb(TABAN[k]); });
  return o;
}

console.log('Ates Bocegi tema katalogu');

dene('9 aktif tema ve her birinde tam, gecerli isik alani', () => {
  assert.strictEqual(TEMALAR.length, 9);
  const IZ = ['cizgi', 'damla', 'baklava', 'akkor'];
  TEMALAR.forEach(t => {
    const i = t.isik;
    assert(i && typeof i === 'object' && !i.yerlesik, t.id + ': isik yok');
    ['isik', 'toz', 'vurgu', 'karanlik'].forEach(a => assert(HEX.test(i[a]), t.id + '.' + a + ' hex degil'));
    assert(i.iz && IZ.indexOf(i.iz.sekil) >= 0, t.id + ': iz.sekil gecersiz');
    if (i.iz.renkler) { assert(i.iz.renkler.length === 3 && i.iz.renkler.every(c => HEX.test(c)), t.id + ': renkler'); }
    else assert(HEX.test(i.iz.renk), t.id + ': iz.renk');
    if (i.iz.renk2 !== undefined) assert(HEX.test(i.iz.renk2), t.id + ': iz.renk2');
  });
});

dene('tema gorselligi alanlari (12.3): 9 temada bolgeler (4), engel, govde, halo, haloHalka, uzak, tehlike tam ve gecerli', () => {
  TEMALAR.forEach(t => {
    const i = t.isik;
    assert(Array.isArray(i.bolgeler) && i.bolgeler.length === 4 && i.bolgeler.every(c => HEX.test(c)), t.id + ': bolgeler');
    assert(i.engel && HEX.test(i.engel.dolgu) && HEX.test(i.engel.kenar), t.id + ': engel');
    assert(i.govde && ['koyu', 'kin', 'plaka', 'kanat'].every(k => HEX.test(i.govde[k])), t.id + ': govde');
    assert(HEX.test(i.halo) && typeof i.haloHalka === 'number' && i.haloHalka > 0 && i.haloHalka <= 0.3, t.id + ': halo');
    assert(HEX.test(i.uzak), t.id + ': uzak');
    assert(i.tehlike && HEX.test(i.tehlike.ton) && HEX.test(i.tehlike.bitki), t.id + ': tehlike');
    // isikCoz alanlari aynen tasir (bozulmadan)
    const P = PALET[t.id];
    assert.deepStrictEqual(Array.from(P.bolgeler), Array.from(i.bolgeler), t.id);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(P.engel)), JSON.parse(JSON.stringify(i.engel)), t.id);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(P.govde)), JSON.parse(JSON.stringify(i.govde)), t.id);
    assert(P.halo === i.halo && P.haloHalka === i.haloHalka && P.uzak === i.uzak && P.tehlike.ton === i.tehlike.ton && P.tehlike.bitki === i.tehlike.bitki, t.id);
  });
});

dene('yerlesik palet oyunun sabitleriyle birebir (varsayilan gorunum korunur): bolge, engel, bocek, uzak; halka 0, tehlike tonu yok', () => {
  const Y = YERLESIK_PALET;
  assert.deepStrictEqual(Array.from(Y.bolgeler), BOLGE);
  assert.strictEqual(Y.engel.dolgu, ENGEL_DOLGU); assert.strictEqual(Y.engel.kenar, ENGEL_KENAR);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(Y.govde)), { koyu: sabit(OYUN, 'BOCEK_KOYU'), kin: sabit(OYUN, 'BOCEK_KIN'), plaka: sabit(OYUN, 'BOCEK_PLAKA'), kanat: sabit(OYUN, 'BOCEK_KANAT') });
  assert.strictEqual(Y.uzak, sabit(OYUN, 'UZAK_MAVI'));
  assert.strictEqual(Y.halo, Y.isik); assert.strictEqual(Y.haloHalka, 0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(Y.tehlike)), { ton: '', bitki: '' });
});

dene('testler yeni renkleri gercekten kapsar: her temanin bolge/engel/govde/uzak/tehlike degerleri yerlesikten farkli', () => {
  const Y = YERLESIK_PALET;
  TEMALAR.forEach(t => {
    const P = PALET[t.id];
    P.bolgeler.forEach((c, i) => assert.notStrictEqual(c, Y.bolgeler[i], t.id + ' bolge' + i + ' yerlesikle ayni'));
    assert(P.engel.dolgu !== Y.engel.dolgu && P.engel.kenar !== Y.engel.kenar, t.id + ' engel');
    assert(P.govde.koyu !== Y.govde.koyu && P.uzak !== Y.uzak && P.tehlike.ton && P.tehlike.bitki, t.id);
  });
});

dene('bolge kimligi: her temada 4 bolge tonu birbirinden ayrisir (CIEDE2000 >= 5) ve hepsi koyu (bolge zemini engel kenarindan koyu)', () => {
  const kotu = [];
  Object.keys(PALET).forEach(id => {
    const P = PALET[id];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const d = de2000(labOf(rgb(P.bolgeler[i])), labOf(rgb(P.bolgeler[j])));
      izle('bolge tonlari arasi dE00', d);
      if (d < 5) kotu.push(id + ' b' + i + '/b' + j + ' dE ' + d.toFixed(2));
    }
  });
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('varsayilan tema isik: YERLESIK', () => {
  const v = KAT.TEMALAR.find(t => t.varsayilan);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(v.isik)), { yerlesik: true });
});

dene('tablo (bolum 5): iz sekli ve nadirlige gore ozel alanlar', () => {
  const b = id => TEMALAR.find(t => t.id === id).isik;
  assert.strictEqual(b('cini').iz.sekil, 'damla');
  assert.strictEqual(b('vitray').iz.sekil, 'baklava');
  assert.deepStrictEqual(Array.from(b('vitray').iz.renkler), ['#E8566A', '#5C8FE8', '#A06AE0']);
  assert.strictEqual(b('lav').iz.sekil, 'akkor');
  assert.strictEqual(b('lav').iz.renk2, '#FFD07A');
  TEMALAR.forEach(t => {
    if (t.nadirlik === 'siradan' || t.nadirlik === 'nadir') assert.strictEqual(t.isik.iz.sekil, 'cizgi', t.id);
  });
});

dene('animasyon yalniz efsanevide (lav)', () => {
  TEMALAR.forEach(t => {
    if (t.nadirlik === 'efsanevi') assert.strictEqual(t.isik.animasyon, 'lav', t.id);
    else assert(!t.isik.animasyon, t.id + ' animasyon tasiyor');
  });
});

console.log('Okunabilirlik (bolum 6, 12.3: temadan cozulen renklerle)');

const sonuclar = [];   // {tema, bolge, kural, bicim, oran}
// K1-K5 temanin kendi bolge tonlari, engel renkleri, isik/toz/vurgusu ile (zemin = karistir(bolgeler[b], isik, ISIK_KARISIM))
function kontrastHesapla(ad, P, hedef) {
  const dolgu = rgb(P.engel.dolgu), kenar = rgb(P.engel.kenar);
  P.bolgeler.forEach((ton, bi) => {
    const zemin = karistir(ton, P.isik, ISIK_KARISIM);
    BICIMLER.forEach(b => {
      const ekle = (kural, o) => hedef.push({ tema: ad, bolge: bi, kural, bicim: b, oran: o });
      ekle('K1', oran(kenar, zemin, b));
      ekle('K2', oran(rgb(P.isik), zemin, b));
      ekle('K3', oran(rgb(P.toz), zemin, b));
      ekle('K4', oran(rgb(P.vurgu), zemin, b));
      ekle('K5', oran(rgb(P.toz), dolgu, b));
    });
  });
}
TEMALAR.forEach(t => kontrastHesapla(t.id, PALET[t.id], sonuclar));
const ana = sonuclar.length;
kontrastHesapla('yerlesik', YERLESIK_PALET, sonuclar);

const ESIK = { K1: 3.0, K2: 3.0, K3: 3.0, K4: 3.0, K5: 4.5, K6: 4.5 };

dene('540 oran (9 tema x 4 bolge x K1-K5 x 3 gorme bicimi) esik ustunde (temanin bolge tonu + engel renkleri)', () => {
  assert.strictEqual(ana, 540);
  const kotu = sonuclar.slice(0, ana).filter(s => s.oran < ESIK[s.kural]);
  assert.strictEqual(kotu.length, 0, kotu.map(s => s.tema + ' bolge' + s.bolge + ' ' + s.kural + ' ' + s.bicim + ' ' + s.oran.toFixed(2)).join('; '));
});

dene('yerlesik palet 4 bolge x K1-K5 x 3 bicim (60 oran) esik ustunde', () => {
  const y = sonuclar.slice(ana);
  assert.strictEqual(y.length, 60);
  const kotu = y.filter(s => s.oran < ESIK[s.kural]);
  assert.strictEqual(kotu.length, 0, kotu.map(s => 'bolge' + s.bolge + ' ' + s.kural + ' ' + s.bicim + ' ' + s.oran.toFixed(2)).join('; '));
});

dene('kontrast hesabi bozuk renkleri yakalar (negatif kontrol): engel kenari = bolge tonu, toz = engel dolgusu, bolge tonu = isik', () => {
  const P = PALET.toprak, bozuk = s => { const h = []; kontrastHesapla('bozuk', s, h); return h.filter(x => x.oran < ESIK[x.kural]).map(x => x.kural); };
  const kopya = Object.assign({}, P, { engel: { dolgu: P.engel.dolgu, kenar: P.bolgeler[0] } });
  assert(bozuk(kopya).indexOf('K1') >= 0, 'K1 yakalanmadi');
  assert(bozuk(Object.assign({}, P, { toz: P.engel.dolgu })).indexOf('K5') >= 0, 'K5 yakalanmadi');
  assert(bozuk(Object.assign({}, P, { bolgeler: [P.isik, P.isik, P.isik, P.isik] })).indexOf('K2') >= 0, 'K2 yakalanmadi');
});

dene('K1 ek: engel kenari / paralaks katman renkleri >= 3,0 (oyundaki gercek hesap, temanin bolge tonlari, 3 gorme bicimi)', () => {
  const kat = /var koyu = karistir\(zemin, '#000000', kat === 0 \? ([0-9.]+) : ([0-9.]+)\), acik = karistir\(zemin, '#FFFFFF', ([0-9.]+)\)/.exec(OYUN);
  assert(kat, 'katmanCiz hesabi okunamadi');
  const k0 = +kat[1], k1 = +kat[2], ac = +kat[3], kotu = [];
  Object.keys(PALET).forEach(id => {
    const P = PALET[id], kenar = rgb(P.engel.kenar);
    P.bolgeler.forEach((ton, bi) => {
      const zemin = zeminOf(P, bi), mix = (c, h, x) => c.map(v => v + (h - v) * x);
      const katmanlar = { 'k0 koyu': mix(zemin, 0, k0), 'k1 koyu': mix(zemin, 0, k1), 'k2 acik': mix(zemin, 1, ac) };
      Object.keys(katmanlar).forEach(ad => BICIMLER.forEach(b => {
        const o = oran(kenar, katmanlar[ad], b);
        if (o < 3.0) kotu.push(id + ' bolge' + bi + ' ' + ad + ' ' + b + ' ' + o.toFixed(2));
      }));
    });
  });
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('bocek (12.3): fener (isik) / govde koyusu >= 3,0; kanat / zemin >= 3,0; govde koyusu her bolge zemininden koyu (10 palet, 3 gorme bicimi)', () => {
  const kotu = [];
  Object.keys(PALET).forEach(id => {
    const P = PALET[id], koyu = rgb(P.govde.koyu), kin = rgb(P.govde.kin), plaka = rgb(P.govde.plaka);
    BICIMLER.forEach(b => {
      const L = c => parlaklik(dogrusal(c), b), f = oran(rgb(P.isik), koyu, b); izle('bocek fener/govde', f);
      if (f < 3.0) kotu.push(id + ' fener/govde ' + b + ' ' + f.toFixed(2));
      if (!(L(koyu) <= L(kin) && L(koyu) <= L(plaka))) kotu.push(id + ' govde koyusu kin/plakadan acik ' + b);
      P.bolgeler.forEach((t, bi) => {
        const z = zeminOf(P, bi), k = oran(rgb(P.govde.kanat), z, b); izle('bocek kanat/zemin', k);
        if (k < 3.0) kotu.push(id + ' b' + bi + ' kanat ' + b + ' ' + k.toFixed(2));
        if (!(L(koyu) < L(z))) kotu.push(id + ' b' + bi + ' govde koyusu zeminden acik ' + b);
      });
    });
  });
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('K6: HUD yazisi / HUD zemini >= 4,5 (style.css, 3 gorme bicimi)', () => {
  const css = oku('style.css');
  const blok = s => { const m = new RegExp(s.replace(/[.]/g, '\\.') + '\\{([^}]*)\\}').exec(css); assert(m, s + ' yok'); return m[1]; };
  const alan = (b, a) => { const m = new RegExp('(?:^|[;\\s])' + a + ':\\s*([^;]+)').exec(b); assert(m, a + ' yok'); return m[1].trim(); };
  const ekranBg = /#screen-ates\{[^}]*radial-gradient\([^#]*(#[0-9A-Fa-f]{6}) 0%, (#[0-9A-Fa-f]{6}) 78%/.exec(css);
  assert(ekranBg, '#screen-ates arka plani okunamadi');
  const kutu = blok('.ab-kutu'), best = blok('.ab-kutu.best');
  const rgbaOku = s => { const m = /rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/.exec(s); assert(m, s); return { c: [m[1], m[2], m[3]].map(v => v / 255), a: +m[4] }; };
  const ustune = (zemin, kat) => zemin.map((v, i) => v + (kat.c[i] - v) * kat.a);
  const yazi = h => rgb(h.trim());
  const kK = rgbaOku(alan(kutu, 'background')), kB = rgbaOku(alan(best, 'background'));
  const yaziK = alan(kutu, 'color'), yaziB = alan(best, 'color');
  const baslik = /\.ab-title\{[^}]*color:(#[0-9A-Fa-f]{6})/.exec(css);
  const hesap = [];
  [ekranBg[1], ekranBg[2]].forEach(zeminHex => {
    const z = rgb(zeminHex), kutuZ = ustune(z, kK), bestZ = ustune(z, kB);
    BICIMLER.forEach(b => {
      hesap.push(['HUD kutu', oran(yazi(yaziK), kutuZ, b)]);
      hesap.push(['HUD en iyi', oran(yazi(yaziB), bestZ, b)]);
      if (baslik) hesap.push(['baslik', oran(yazi(baslik[1]), z, b)]);
      TEMALAR.concat([{ id: 'yerlesik', isik: YERLESIK_PALET }]).forEach(t => hesap.push(['carpan ' + t.id, oran(rgb(t.isik.vurgu), kutuZ, b)]));
    });
  });
  const kotu = hesap.filter(h => h[1] < ESIK.K6);
  assert.strictEqual(kotu.length, 0, kotu.map(h => h[0] + ' ' + h[1].toFixed(2)).join('; '));
});

dene('kivilcim / toz cizim yaricap orani >= 1,8 (AYAR)', () => {
  const h = require(path.join(KOK, 'js', 'atesBocegi.js')).AYAR.hareket;
  assert(h.R_KIVILCIM_GORSEL / h.R_TOZ_GORSEL >= 1.8, 'oran ' + (h.R_KIVILCIM_GORSEL / h.R_TOZ_GORSEL));
});

dene('yerlesik engel / bolge / bocek renkleri: oyunda tek sabit, market.js yerlesik paletinde ayni deger (iki yerlesik palet birebir)', () => {
  const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter(f => /\.js$/.test(f));
  [ENGEL_DOLGU, ENGEL_KENAR].concat(BOLGE).forEach(r => {
    const bulunan = [];
    dosyalar.forEach(f => {
      const n = (oku('js/' + f).match(new RegExp(r, 'gi')) || []).length;
      if (n) bulunan.push(f + ':' + n);
    });
    assert.deepStrictEqual(bulunan, ['atesBocegiOyun.js:1', 'market.js:1'], r + ' -> ' + bulunan.join(', '));
  });
});

console.log('Karanliktasuzul: bomba / unlem / sarmasik (temadan tonlu, silüet sabit) ve arka plan katmanlari');

const TUM_TEMA = Object.keys(PALET).map(id => ({ id, p: PALET[id], th: tehlikeRenk(PALET[id]) }));
const KATMAN = {};
{ const m = /var KATMAN = \{([^}]*)\}/.exec(OYUN); assert(m, 'KATMAN tablosu yok'); m[1].split(',').forEach(p => { const k = /(\w+):\s*([0-9.]+)/.exec(p); KATMAN[k[1]] = +k[2]; }); }

dene('bomba / unlem / sarmasik renkleri (temanin tehlike tonuyla) zemine >= 3,0 (10 palet x 4 bolge x 3 gorme bicimi, 600 oran)', () => {
  const kotu = []; let n = 0;
  TUM_TEMA.forEach(t => Object.keys(t.th).forEach(ad => t.p.bolgeler.forEach((ton, bi) => BICIMLER.forEach(b => {
    const o = oran(t.th[ad], zeminOf(t.p, bi), b); n++; izle(ad, o);
    if (o < 3.0) kotu.push(ad + ' ' + t.id + ' bolge' + bi + ' ' + b + ' ' + o.toFixed(2));
  }))));
  assert.strictEqual(n, 600); assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('bomba kenari ile toz renk korlugunde de ayrisir: parlaklik orani >= 1,5 (cekirdek >= 1,4), 3 gorme bicimi', () => {
  // Gerekce: toz acik (L ~0,75-0,9); bomba kenari zemine >= 3 icin L >= ~0,4 ister; iki kosul arasinda kalan pencere 1,5 ya da biraz ustu.
  // Asil ayrim SEKIL (asagidaki test): bu oran renk bilgisini ikinci kanal olarak korur.
  const kotu = [];
  TUM_TEMA.forEach(t => BICIMLER.forEach(b => {
    const k = oran(t.th.BOMBA_KENAR, rgb(t.p.toz), b), c = oran(t.th.BOMBA_CEKIRDEK, rgb(t.p.toz), b);
    izle('bomba kenar/toz', k); izle('bomba cekirdek/toz', c);
    if (k < 1.5) kotu.push(t.id + ' kenar ' + b + ' ' + k.toFixed(2));
    if (c < 1.4) kotu.push(t.id + ' cekirdek ' + b + ' ' + c.toFixed(2));
  }));
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('renkCoz (oyun) tehlike formulu testteki tehlikeRenk ile ayni: taban rengi tema tonuna TEHLIKE_KARISIM / BITKI_KARISIM; engel ve govde aynen', () => {
  const g = /function renkCoz[\s\S]*?\n  \}/.exec(OYUN);
  assert(g, 'renkCoz yok');
  ['bombaKenar: ton\\(BOMBA_KENAR, t, TEHLIKE_KARISIM\\)', 'bombaCekirdek: ton\\(BOMBA_CEKIRDEK, t, TEHLIKE_KARISIM\\)', 'unlem: ton\\(UNLEM_RENK, t, TEHLIKE_KARISIM\\)',
   'sarGovde: ton\\(SARMASIK_GOVDE, b, BITKI_KARISIM\\)', 'sarYaprak: ton\\(SARMASIK_YAPRAK, b, BITKI_KARISIM\\)', 'dolgu: p\\.engel\\.dolgu, kenar: p\\.engel\\.kenar',
   'var t = p\\.tehlike\\.ton, b = p\\.tehlike\\.bitki', 'return k \\? karistir\\(h, k, x\\) : h'].forEach(r => assert(new RegExp(r).test(g[0]), 'renkCoz: ' + r));
  // cizim tehlike / engel renklerini yalniz rk'den alir: sabit adlar yalniz tanim, YERLESIK ve renkCoz'da
  const say = ad => (OYUN.match(new RegExp('\\b' + ad + '\\b', 'g')) || []).length;
  ['ENGEL_DOLGU', 'ENGEL_KENAR'].forEach(ad => assert.strictEqual(say(ad), 2, ad + ' cizimde sabit kullaniliyor'));
  Object.keys(TABAN).forEach(ad => assert.strictEqual(say(ad), 2, ad + ' cizimde sabit kullaniliyor'));
});

dene('tehlike renk ailesi korunur (12.3): ton orani <= 0,25; tonlu renk tabana CIEDE2000 <= 12, ton acisi farki <= 25 derece', () => {
  assert(TEHLIKE_KARISIM > 0 && TEHLIKE_KARISIM <= 0.25 && BITKI_KARISIM > 0 && BITKI_KARISIM <= 0.25, 'oranlar ' + TEHLIKE_KARISIM + ' ' + BITKI_KARISIM);
  const aci = c => { const l = labOf(c); return Math.atan2(l[2], l[1]) * 180 / Math.PI; }, kotu = [];
  TUM_TEMA.forEach(t => Object.keys(t.th).forEach(ad => {
    const taban = rgb(TABAN[ad]), d = de2000(labOf(taban), labOf(t.th[ad]));
    let fa = Math.abs(aci(taban) - aci(t.th[ad])); if (fa > 180) fa = 360 - fa;
    if (d > 12 || fa > 25) kotu.push(t.id + ' ' + ad + ' dE ' + d.toFixed(1) + ' aci ' + fa.toFixed(1));
  }));
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('bomba / toz SEKIL ayrimi (renkten bagimsiz): diken sayisi 6-8, tozdan buyuk, dikenli sprite kodda', () => {
  const dk = +/BOMBA_DIKEN = (\d+)/.exec(OYUN)[1], h = require(path.join(KOK, 'js', 'atesBocegi.js')).AYAR.hareket;
  assert(dk >= 6 && dk <= 8, 'diken ' + dk);
  assert(h.R_BOMBA / h.R_TOZ_GORSEL >= 1.4, 'bomba/toz yaricap orani ' + (h.R_BOMBA / h.R_TOZ_GORSEL));
  assert(/function bombaSprite\(\)/.test(OYUN) && /BOMBA_DIKEN \* 2/.test(OYUN), 'dikenli dis hat');
  const bs = /function bombaSprite[\s\S]*?\n  \}/.exec(OYUN)[0];
  assert(/x\.fillStyle = rk\.dolgu; x\.strokeStyle = rk\.bombaKenar/.test(bs), 'koyu kure (engel dolgusu) + acik kenar (tonlu)');
  assert(!/pal\./.test(bs), 'bomba sprite tema alanini dogrudan okumaz (renkler rk: gorselKur, 12.3)');
});

dene('tehlike taban renkleri js/*.js icinde tek yerde (atesBocegiOyun.js); temalar taban rengi degil yalniz ton tasir', () => {
  const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter(f => /\.js$/.test(f));
  Object.keys(TABAN).forEach(ad => {
    const r = TABAN[ad], bulunan = [];
    dosyalar.forEach(f => { const n = (oku('js/' + f).match(new RegExp(r, 'gi')) || []).length; if (n) bulunan.push(f + ':' + n); });
    assert.deepStrictEqual(bulunan, ['atesBocegiOyun.js:1'], ad + ' ' + r + ' -> ' + bulunan.join(', '));
    TEMALAR.forEach(t => assert(JSON.stringify(t.isik).toUpperCase().indexOf(r.toUpperCase()) < 0, t.id + ' ' + ad));
  });
  // sarmasik/unlem/bomba cizimi tema alanini dogrudan okumaz (renkler gorselKur'da cozulur)
  ['function sarmasikCiz', 'function ozIsikCiz'].forEach(fn => {
    const g = new RegExp(fn.replace(' ', '\\s+') + '[\\s\\S]*?\\n  \\}').exec(OYUN);
    assert(g && !/pal\./.test(g[0]), fn + ' pal.* kullanmamali');
  });
});

dene('mantar / ay / sis katmanlari: engel kenarindan her zaman koyu, kenar ve toz ile >= 3,0 (10 palet, temanin bolge tonlari, 3 gorme bicimi)', () => {
  // Renkler katmanCiz ile ayni formul: mantar kap = karistir(zemin, vurgu, mantarKap) + hale (alfa mantarHale);
  // ay = karistir(zemin, beyaz, ay); sis = karistir(zemin, beyaz, sis) alfa sisAlfa ile (elipsler yari saydam; opak hesap gercegi yansitmaz).
  const kotu = [], L = (c, b) => parlaklik(dogrusal(c), b);
  const mix = (a, b, x) => a.map((v, i) => v + (b[i] - v) * x);
  TUM_TEMA.forEach(t => {
    const vur = rgb(t.p.vurgu), toz = rgb(t.p.toz), bey = [1, 1, 1], kenar = rgb(t.p.engel.kenar);
    const zem = bi => zeminOf(t.p, bi);
    const katmanlar = {
      'mantar kap': mix(zem(1), vur, KATMAN.mantarKap),
      'mantar hale': mix(zem(1), vur, KATMAN.mantarHale),
      'ay': mix(zem(2), bey, KATMAN.ay),
      'sis (alfa)': mix(zem(3), mix(zem(3), bey, KATMAN.sis), KATMAN.sisAlfa)
    };
    Object.keys(katmanlar).forEach(ad => BICIMLER.forEach(b => {
      const c = katmanlar[ad], ok = oran(kenar, c, b), ot = oran(toz, c, b);
      izle('katman/kenar', ok); izle('katman/toz', ot);
      if (!(L(c, b) < L(kenar, b))) kotu.push(t.id + ' ' + ad + ' ' + b + ' kenardan acik');
      if (ok < 3.0) kotu.push(t.id + ' ' + ad + ' kenar ' + b + ' ' + ok.toFixed(2));
      if (ot < 3.0) kotu.push(t.id + ' ' + ad + ' toz ' + b + ' ' + ot.toFixed(2));
    }));
  });
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('B4 derinlik katmanlari (uzak = temanin uzak tonu, yakin koyu siluet, huzme/sis bandi): kenardan koyu, kenar ve toz ile >= 3,0 (10 palet, 3 gorme bicimi)', () => {
  // katmanCiz: uzak = karistir(zemin, pal.uzak, uzak); yakin = karistir(zemin, siyah, yakin); huzme / sis bandi = acik (zemin + %15 beyaz) uzerine alfa (<= acik).
  const kotu = [], L = (c, b) => parlaklik(dogrusal(c), b);
  const mix = (a, b, x) => a.map((v, i) => v + (b[i] - v) * x);
  TUM_TEMA.forEach(t => t.p.bolgeler.forEach((ton, bi) => {
    const zem = zeminOf(t.p, bi), toz = rgb(t.p.toz), kenar = rgb(t.p.engel.kenar);
    const kat = { 'uzak': mix(zem, rgb(t.p.uzak), KATMAN.uzak), 'yakin siluet': mix(zem, [0, 0, 0], KATMAN.yakin), 'huzme/sis bandi (acik)': mix(zem, [1, 1, 1], 0.15) };
    Object.keys(kat).forEach(ad => BICIMLER.forEach(b => {
      const c = kat[ad], ok = oran(kenar, c, b), ot = oran(toz, c, b);
      izle('B4 katman/kenar', ok); izle('B4 katman/toz', ot);
      if (!(L(c, b) < L(kenar, b))) kotu.push(t.id + ' b' + bi + ' ' + ad + ' ' + b + ' kenardan acik');
      if (ok < 3.0) kotu.push(t.id + ' b' + bi + ' ' + ad + ' kenar ' + b + ' ' + ok.toFixed(2));
      if (ot < 3.0) kotu.push(t.id + ' b' + bi + ' ' + ad + ' toz ' + b + ' ' + ot.toFixed(2));
    }));
  }));
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('uzak nokta (arka plan ates bocegi) tozdan ayrisir: yaricap*3 < R_TOZ_GORSEL, zemine kontrasti tozdan belirgin dusuk', () => {
  const h = require(path.join(KOK, 'js', 'atesBocegi.js')).AYAR.hareket, r = [];
  OYUN.replace(/uzakNokta\(c, [^,]+, [^,]+, ([0-9.]+), nokta, ([0-9.]+)\)/g, (m, a, b) => { r.push([+a, +b]); return m; });
  assert(r.length >= 3, 'uzakNokta cagrilari');
  r.forEach(q => assert(q[0] * 3 < h.R_TOZ_GORSEL, 'nokta yaricap ' + q[0]));
  const mix = (a, b, x) => a.map((v, i) => v + (b[i] - v) * x), kotu = [];
  TUM_TEMA.forEach(t => t.p.bolgeler.forEach((ton, bi) => BICIMLER.forEach(b => {
    const zem = zeminOf(t.p, bi), nokta = mix(zem, mix(zem, rgb(t.p.vurgu), KATMAN.mantarKap), 0.8);   // alfa 0,8 (en yogun)
    const on = oran(nokta, zem, b), ot = oran(rgb(t.p.toz), zem, b); izle('uzak nokta/zemin', on);
    if (!(on <= ot * 0.5)) kotu.push(t.id + ' b' + bi + ' ' + b + ' nokta ' + on.toFixed(2) + ' toz ' + ot.toFixed(2));
  })));
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('O-3: tehlike renkleri x (zemin + her katman rengi) x 10 palet x 4 bolge x 3 bicim: >= 3,0 YA DA koyu dis kontur (kodda var, >= ~1 px) ve kontur (temanin engel dolgusu) x tehlike >= 3,0', () => {
  // Secim: renkleri degistirmek yerine (toz/tehlike ayrimi ve tema paletleri bozulmasin) koyu dis kontur zorunlu.
  // Bomba: sprite'ta koyu (engel dolgusu) (0,26 + 2*bant) genis kontur altta, acik kenar 0,26 ustte; bant = max(0,22, 1 cihaz pikseli).
  // Sarmasik: koyu (0,7 + 2*max(0,3, pxD)) altta, yesil 0,7 ustte. Unlem: koyu kontur 2*max(0,23, pxD/k).
  // Silüet / uc cizgisi / kenar isareti: koyu alt cizgi (ince + 2*max(0,2, pxD)) altta, unlem rengi ince cizgi ustte, alfa 0,75.
  const mix = (a, b, x) => a.map((v, i) => v + (b[i] - v) * x);
  const kaynakBomba = /function bombaSprite[\s\S]*?\n  \}/.exec(OYUN)[0];
  assert(/var bant = Math\.max\(0\.22, pxD\), dis = 0\.26 \+ 2 \* bant/.test(kaynakBomba) && /x\.strokeStyle = rk\.dolgu; x\.lineWidth = dis; x\.stroke\(\);\s*\/\/[^\n]*\n\s*x\.strokeStyle = rk\.bombaKenar; x\.lineWidth = 0\.26; x\.stroke\(\);/.test(kaynakBomba), 'bomba koyu dis kontur (>= 1 cihaz pikseli)');
  const sar = /function sarmasikCiz[\s\S]*?\n  \}/.exec(OYUN)[0];
  assert(/u \? rk\.sarGovde : rk\.dolgu; c\.lineWidth = u \? 0\.7 : 0\.7 \+ 2 \* Math\.max\(0\.3, pxD\)/.test(sar), 'sarmasik koyu dis cizgi (>= 1 cihaz pikseli)');
  assert(/c\.fillStyle = rk\.unlem; c\.strokeStyle = rk\.dolgu; c\.lineWidth = 2 \* Math\.max\(0\.23, pxD \/ k\)/.test(OYUN), 'unlem koyu kontur (>= 1 cihaz pikseli)');
  assert(/c\.fillStyle = rk\.sarYaprak; c\.strokeStyle = rk\.dolgu; c\.lineWidth = 2 \* Math\.max\(0\.06, pxD\)/.test(sar), 'sarmasik yaprak koyu kontur (>= 1 cihaz pikseli)');
  assert(/c\.lineWidth = u \? 0\.3 : 0\.3 \+ 2 \* Math\.max\(0\.16, pxD\)/.test(sar), 'sarmasik filiz koyu bant (>= 1 cihaz pikseli)');
  const oz = /function ozIsikCiz[\s\S]*?\n  \}/.exec(OYUN)[0];
  const altCizgi = ince => new RegExp('c\\.strokeStyle = rk\\.dolgu; c\\.lineWidth = ' + ince + ' \\+ 2 \\* Math\\.max\\(0\\.2, pxD\\); c\\.stroke\\(\\);[^\\n]*\\n\\s*c\\.strokeStyle = rk\\.unlem; c\\.lineWidth = ' + ince + '; c\\.stroke\\(\\);');
  assert(altCizgi('0\\.5').test(oz) && altCizgi('0\\.3').test(oz), 'siluet / uc cizgisi / kenar isareti koyu alt cizgi');
  const alfalar = (oz.match(/c\.globalAlpha = 0\.[0-9]+ \* \(1 - p\); (?:c\.setLineDash|c\.beginPath)/g) || []).map(m => +/= (0\.[0-9]+)/.exec(m)[1]);
  assert(alfalar.length === 2 && alfalar.every(a => a >= 0.7), 'siluet / kenar isareti alfa >= 0,7: ' + alfalar.join(','));
  const kotu = [], konturGereken = {}; let n = 0;
  TUM_TEMA.forEach(t => t.p.bolgeler.forEach((ton, bi) => {
    const zem = zeminOf(t.p, bi), vur = rgb(t.p.vurgu), bey = [1, 1, 1], sif = [0, 0, 0], dolgu = rgb(t.p.engel.dolgu);
    const zeminler = {
      'zemin': zem, 'k0 koyu': mix(zem, sif, 0.15), 'k1 koyu': mix(zem, sif, 0.07), 'acik': mix(zem, bey, 0.15), 'uzak': mix(zem, rgb(t.p.uzak), KATMAN.uzak),
      'yakin siluet': mix(zem, sif, KATMAN.yakin), 'mantar kap': mix(zem, vur, KATMAN.mantarKap), 'mantar hale': mix(zem, vur, KATMAN.mantarHale),
      'ay': mix(zem, bey, KATMAN.ay), 'sis': mix(zem, mix(zem, bey, KATMAN.sis), KATMAN.sisAlfa)
    };
    Object.keys(t.th).forEach(ad => BICIMLER.forEach(b => {
      const c = t.th[ad], kon = oran(c, dolgu, b); izle('O-3 tehlike/koyu kontur', kon);
      if (kon < 3.0) kotu.push(t.id + ' ' + ad + ' x koyu kontur ' + b + ' ' + kon.toFixed(2));
      Object.keys(zeminler).forEach(zn => {
        const o = oran(c, zeminler[zn], b); n++; izle('O-3 tehlike/katman (kontursuz)', o);
        if (o < 3.0) konturGereken[ad + ' x ' + zn] = 1;      // kontur sayesinde okunur
      });
    }));
    // alfa dahil: zemin uzerine koyu alt cizgi (alfa 0,75), onun uzerine unlem rengi cizgi (alfa 0,75); cizgi / alt cizgi >= 3,0
    [zem, mix(zem, [1, 1, 1], 0.15), mix(zem, rgb(t.p.uzak), KATMAN.uzak), mix(zem, [0, 0, 0], KATMAN.yakin)].forEach(z => BICIMLER.forEach(b => {
      const alt = mix(z, dolgu, 0.75), cizgi = mix(alt, t.th.UNLEM_RENK, 0.75), o = oran(cizgi, alt, b); izle('O1 siluet cizgi/koyu alt cizgi (alfa dahil)', o);
      if (o < 3.0) kotu.push('siluet ' + t.id + ' b' + bi + ' ' + b + ' ' + o.toFixed(2));
    }));
  }));
  assert.strictEqual(n, 6000, 'oran sayisi ' + n);       // 5 renk x 10 palet x 4 bolge x 3 bicim x 10 zemin/katman
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
  console.log('       kontur gerektiren cift (tehlike x katman, 3,0 altinda): ' + Object.keys(konturGereken).length);
});

dene('en dusuk oranlar (bilgi)', () => {
  console.log('       ' + Object.keys(EN_DUSUK).map(k => k + ' ' + EN_DUSUK[k].toFixed(2)).join(' | '));
});

console.log('Market baglantisi (8.6)');

dene('isikCoz: yerlesik / eksik / bozuk girdi -> tam palet', () => {
  const tam = p => {
    ['isik', 'toz', 'vurgu', 'karanlik'].forEach(a => assert(HEX.test(p[a]), a));
    assert(HEX.test(p.iz.renk) && HEX.test(p.iz.renk2), 'iz renkleri');
    assert(['cizgi', 'damla', 'baklava', 'akkor'].indexOf(p.iz.sekil) >= 0, 'sekil');
    assert.strictEqual(typeof p.animasyon, 'string');
  };
  [{ yerlesik: true }, undefined, null, 5, 'x', [], {}, { isik: 'kirmizi', iz: 3 },
   { isik: '#12345', toz: 7, vurgu: null, karanlik: {}, iz: { renk: 'x', sekil: 'yildiz' }, animasyon: 4 },
   { iz: { renkler: ['#111111', 'x'] } }, { iz: { renkler: [] } },
   { bolgeler: 'x', engel: 5, govde: { koyu: 'kirmizi' }, halo: 3, haloHalka: 2, uzak: [], tehlike: 7 }].forEach(v => {
    const p = M.isikCoz(v); tam(p);
    assert.strictEqual(p.iz.sekil, 'cizgi');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(p)).isik, '#FFE27A');
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(M.isikCoz({ yerlesik: true }))),
    { isik: '#FFE27A', toz: '#FFF3B0', vurgu: '#9BE86B', karanlik: '#05080D', iz: { renk: '#FFD24A', renk2: '#FFD24A', sekil: 'cizgi' }, animasyon: '',
      bolgeler: ['#24402F', '#2E2A44', '#1F3F4C', '#3A4031'], engel: { dolgu: '#0B0F14', kenar: '#E9EDF2' },
      govde: { koyu: '#1A1410', kin: '#2E2219', plaka: '#3A2C20', kanat: '#FFFFFF' }, halo: '#FFE27A', haloHalka: 0, uzak: '#7F98C0', tehlike: { ton: '', bitki: '' } });
});

dene('isikCoz yeni alanlar (12.3): bozuk / kismi alan yerlesige duser, gecerli kisim korunur; halo yoksa isik; haloHalka [0, 0,3]', () => {
  const Y = YERLESIK_PALET;
  const b = M.isikCoz({ bolgeler: 'x', engel: 5, govde: { koyu: 'kirmizi' }, halo: 3, haloHalka: 2, uzak: [], tehlike: 7 });
  assert.deepStrictEqual(Array.from(b.bolgeler), Array.from(Y.bolgeler));
  assert.deepStrictEqual(JSON.parse(JSON.stringify([b.engel, b.govde, b.uzak, b.tehlike, b.haloHalka])), JSON.parse(JSON.stringify([Y.engel, Y.govde, Y.uzak, Y.tehlike, 0])));
  const k = M.isikCoz({ isik: '#ABCDEF', bolgeler: ['#111111', 'x'], engel: { kenar: '#EEEEEE' }, govde: { kanat: '#FAFAFA' }, haloHalka: 0.31, tehlike: { ton: '#ABCDEF' } });
  assert.deepStrictEqual(Array.from(k.bolgeler), ['#111111'].concat(Array.from(Y.bolgeler).slice(1)));
  assert.strictEqual(k.engel.kenar, '#EEEEEE'); assert.strictEqual(k.engel.dolgu, Y.engel.dolgu);
  assert.strictEqual(k.govde.kanat, '#FAFAFA'); assert.strictEqual(k.govde.koyu, Y.govde.koyu);
  assert.strictEqual(k.halo, '#ABCDEF', 'halo yoksa isik'); assert.strictEqual(k.haloHalka, 0, 'tavan ustu');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(k.tehlike)), { ton: '#ABCDEF', bitki: '' });
  assert.strictEqual(M.isikCoz({ haloHalka: 0.3 }).haloHalka, 0.3);
});

dene('CIEDE2000 uygulamasi Sharma (2005) referans ciftleriyle uyusur (+-0,0001)', () => {
  [[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 0, 0], [50, -1, 2], 2.3669], [[50, 2.5, 0], [73, 25, -18], 27.1492],
   [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], [[50, 2.5, 0], [50, 0, -2.5], 4.3065]].forEach(c => {
    const d = de2000(c[0], c[1]); assert(Math.abs(d - c[2]) < 1e-4, c[2] + ' != ' + d.toFixed(4));
  });
});

dene('isikCoz: tanimsiz iz.sekil -> cizgi; gecerli tema aynen korunur; saf (girdi degismez)', () => {
  assert.strictEqual(M.isikCoz({ iz: { renk: '#112233', sekil: 'yildiz' } }).iz.sekil, 'cizgi');
  TEMALAR.forEach(t => {
    const once = JSON.stringify(t.isik), p = M.isikCoz(t.isik);
    assert.strictEqual(JSON.stringify(t.isik), once, t.id + ' girdi degisti');
    ['isik', 'toz', 'vurgu', 'karanlik'].forEach(a => assert.strictEqual(p[a], t.isik[a]));
    assert.strictEqual(p.iz.sekil, t.isik.iz.sekil);
    assert.strictEqual(p.animasyon, t.isik.animasyon || '');
  });
});

dene('isikCoz: Vitray renkler[0] renk de olur, lav iki renk', () => {
  const v = M.isikCoz(TEMALAR.find(t => t.id === 'vitray').isik);
  assert.strictEqual(v.iz.renk, '#E8566A');
  assert.deepStrictEqual(Array.from(v.iz.renkler), ['#E8566A', '#5C8FE8', '#A06AE0']);
  const l = M.isikCoz(TEMALAR.find(t => t.id === 'lav').isik);
  assert.strictEqual(l.iz.renk, '#FF6A2A'); assert.strictEqual(l.iz.renk2, '#FFD07A');
  assert.strictEqual(l.animasyon, 'lav');
});

dene('aktif("ates","isik"): varsayilanda yerlesik, tema degisince yeni nesne', () => {
  const { win } = yukle(false), m = win.AppMarket;
  const a0 = m.aktif('ates', 'isik');
  assert.strictEqual(a0.yerlesik, true);
  assert.strictEqual(m.aktif('ates', 'isik'), a0, 'onbellek ayni nesne');
  win.AppProgress.market.s.push('toprak', 'lav');
  assert(m.sec('toprak'));
  const a1 = m.aktif('ates', 'isik');
  assert.notStrictEqual(a1, a0);
  assert.strictEqual(a1.isik, '#F2C078');
  assert(m.sec('lav'));
  const a2 = m.aktif('ates', 'isik');
  assert.notStrictEqual(a2, a1);
  assert.strictEqual(a2.iz.sekil, 'akkor');
  assert(m.sec('varsayilan'));
  assert.strictEqual(m.aktif('ates', 'isik').yerlesik, true);
});

dene('sec -> temayiYay AtesBocegiOyun.temaDegisti cagirir; oyun yokken hatasiz', () => {
  const { win, cagri } = yukle(true), m = win.AppMarket;
  const basta = cagri.length;
  win.AppProgress.market.s.push('buz');
  m.sec('buz');
  assert(cagri.length > basta, 'temaDegisti cagrilmadi');
  const { win: w2 } = yukle(false);
  w2.AppProgress.market.s.push('buz');
  assert.doesNotThrow(() => w2.AppMarket.sec('buz'));
});

dene('indeksle: isik alani silinen tema devre disi kalmaz, aktifken yerlesige duser', () => {
  const degis = k => { assert(k.indexOf("isik: { isik: '#F2C078'") > 0); return k.replace("isik: { isik: '#F2C078'", "xisik: { isik: '#F2C078'"); };
  const { win } = yukle(false, degis), m = win.AppMarket;
  assert.strictEqual(m.temalar().length, 10);
  assert(m.bul('toprak').isik === undefined);
  win.AppProgress.market.s.push('toprak');
  assert(m.sec('toprak'), 'toprak secilemedi');
  assert.strictEqual(m.seciliId(), 'toprak');
  const a = m.aktif('ates', 'isik');
  assert.strictEqual(a.yerlesik, true);
  const p = m.isikCoz(a);
  assert.strictEqual(p.isik, '#FFE27A'); assert.strictEqual(p.iz.sekil, 'cizgi');
  ['toz', 'vurgu', 'karanlik'].forEach(k => assert(HEX.test(p[k]), k));
});

dene('onizleme: her tema icin sahte DOM\'da hatasiz kurulur (atesSahnesi dahil)', () => {
  const { win, doc, ctx } = yukle(false);
  let src = oku('js/marketEkran.js');
  assert(src.indexOf('return { ac: ac, kapat: kapat, ciz: ciz };') > 0);
  src = src.replace('return { ac: ac, kapat: kapat, ciz: ciz };', 'return { ac: ac, kapat: kapat, ciz: ciz, onizlemeKur: onizlemeKur };');
  const hata = console.error; console.error = () => {};
  try { vm.runInContext(src, ctx, { filename: 'marketEkran.js' }); } finally { console.error = hata; }
  const ME = win.MarketEkran;
  assert(ME && ME.onizlemeKur, 'MarketEkran yuklenmedi');
  win.AppMarket.temalar().forEach(t => {
    const kap = doc.createElement();
    ME.onizlemeKur(kap, t);
    const sahne = kap.cocuklar.filter(c => /mo-ates/.test(c.className));
    assert.strictEqual(sahne.length, 1, t.id + ': atesSahnesi yok');
    assert.strictEqual(kap.cocuklar[kap.cocuklar.length - 1], sahne[0], t.id + ': sise sahnesinden sonra degil');
    const svg = sahne[0].innerHTML;
    assert(/viewBox="0 0 58 58"/.test(svg), t.id + ': svg');
    assert(!/undefined|NaN/.test(svg), t.id + ': svg bozuk');
    const iz = t.isik && !t.isik.yerlesik ? t.isik.iz : null;
    assert.strictEqual(/mo-ates-iz lav/.test(svg), t.id === 'lav', t.id + ': lav animasyon sinifi');
    if (iz && iz.sekil === 'baklava') iz.renkler.forEach(r => assert(svg.indexOf(r) > 0, t.id + ' ' + r));
  });
  const idler = []; // gradyan kimlikleri kartlar arasinda cakismaz
  win.AppMarket.temalar().forEach(t => { const k = doc.createElement(); ME.onizlemeKur(k, t); idler.push(/id="(moAtes\d+)z"/.exec(k.cocuklar[k.cocuklar.length - 1].innerHTML)[1]); });
  assert.strictEqual(new Set(idler).size, idler.length);
});

dene('stil: .mo-ates CSS style.css\'te, JS stil enjekte etmiyor; hareketi azaltta animasyon kapali', () => {
  const css = oku('style.css'), ekran = oku('js/marketEkran.js');
  assert(/@media \(max-width:339px\)\{ \.mo-sahne\.mo-ates\{display:none/.test(css) && /\.mo-sahne\.mo-ates\{flex:0 1 58px; min-width:0/.test(css));
  assert(/\.mo-sahne\.mo-ates\{/.test(css) && /\.mo-ates-iz\.lav\{animation/.test(css));
  assert(/reduced-motion \.mo-ates-iz\.lav\{animation:none/.test(css));
  assert(!/createElement\('style'\)|<style/.test(ekran));
  assert(/Beş oyunda birden geçerli/.test(ekran) && !/Dört oyunda/.test(ekran));
});

dene('onizleme zemini beyaz degil: 9 temanin karanlik rengi koyu, zemin CSS seffaf', () => {
  const lum = h => (parseInt(h.substr(1, 2), 16) * 0.299 + parseInt(h.substr(3, 2), 16) * 0.587 + parseInt(h.substr(5, 2), 16) * 0.114);
  TEMALAR.forEach(t => assert(lum(M.isikCoz(t.isik).karanlik) < 60, t.id + ' karanlik zemin acik'));
  const css = oku('style.css');
  assert(/\.mo-sahne\.mo-ates\{[^}]*background:#05080D; border-radius:6px/.test(css) && /\.mo-ates svg\{[^}]*background:transparent/.test(css), 'sahne sabit koyu CSS zemini + yuvarlak kose');
  assert(!/class="mo-ates-zemin"/.test(oku('js/marketEkran.js')), 'zemin SVG dolgusu olmamali (otomatik karanlik modu ters cevirir)');
});

dene('ana ekran Karanlikta Suzul etiketi: acik renk, kontrast >= 4.5, zemin seffaf', () => {
  const css = oku('style.css');
  const m = css.match(/\.game-label\.theme-ates\{([^}]*)\}/);
  assert(m, 'kural yok');
  const r = m[1].match(/(?:^|[;\s])color:(#[0-9A-Fa-f]{6})/);
  assert(r, 'duz renk yok');
  const lin = h => [1, 3, 5].map(i => { const c = parseInt(h.substr(i, 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  const L = h => { const [a, b, c] = lin(h); return 0.2126 * a + 0.7152 * b + 0.0722 * c; };
  const oran = (L(r[1]) + 0.05) / (L('#0B1220') + 0.05);
  assert(oran >= 4.5, 'kontrast ' + oran.toFixed(2));
  assert(/background:none/.test(m[1]) && !/background-clip:text/.test(m[1]) && /text-shadow/.test(m[1]));
});

// ---- Gercek tarayici olcumu: onizleme sahnesi koyu mu? (headless Chrome, tek cagri, 9 tema izgara) ----
// Gercek kapsayici (.mk-onizleme zemini + tema ton katmani) ve style.css kurallariyla 120x100 hucrelere cizilir;
// 58x58 sahne karesinin ortalama ve dort kose (6x6) goreli parlakligi (WCAG dogrusal, 0-1) olculur.
// Koseler zemin rect yuvarlak kosesinin icinde (kart tonundan bagimsiz). HEAD sahnesi (ONIZ_HEAD=1 ile olculur): ort 0,067-0,089, kose 0,032-0,048;
// duzeltme sonrasi: ort 0,036-0,046, kose 0,006-0,010. Esik ikisinin arasinda: ort 0,05; kose 0,02.
// beyazimsi gorunum = yesil disk + beyaz dal + ton katmaninin toplami, bu yuzden hem ortalama hem kose sinirlanir.
let atlandi = 0;
const ONIZ_ESIK = { ort: 0.05, kose: 0.02 };
function chromeBul() {
  const adaylar = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  if (process.env.CHROME_YOL && !fs.existsSync(process.env.CHROME_YOL)) console.log('       UYARI: CHROME_YOL gecersiz (' + process.env.CHROME_YOL + '), varsayilan yollar deneniyor');
  return adaylar.find(a => fs.existsSync(a)) || null;
}
function pngCoz(buf) {
  const zlib = require('zlib');
  let o = 8, w, h, ct, id = [];
  while (o < buf.length) {
    const n = buf.readUInt32BE(o), t = buf.toString('latin1', o + 4, o + 8), d = buf.slice(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; assert(d[8] === 8 && d[12] === 0 && (ct === 2 || ct === 6), 'PNG bicimi desteklenmiyor'); }
    if (t === 'IDAT') id.push(d);
    o += 12 + n;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(id)), st = w * bpp, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const v = raw[y * (st + 1) + 1 + x], a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[y * st + x] = r & 255;
    }
  }
  return { w, h, bpp, px };
}
function onizlemeOlc(chrome, kaynak) {   // kaynak: {ekran, css} verilirse (HEAD karsilastirmasi) onlar kullanilir
  const os = require('os'), cp = require('child_process');
  const { win, doc, ctx } = yukle(false);
  const src = (kaynak ? kaynak.ekran : oku('js/marketEkran.js')).replace('return { ac: ac, kapat: kapat, ciz: ciz };', 'return { ac: ac, kapat: kapat, ciz: ciz, onizlemeKur: onizlemeKur };');
  const hata = console.error; console.error = () => {};
  try { vm.runInContext(src, ctx, { filename: 'marketEkran.js' }); } finally { console.error = hata; }
  const css = kaynak ? kaynak.css : oku('style.css'), bas = css.indexOf('.mk-onizleme{position:relative'), son = '.mo-ates-iz.lav{animation:none;} }';
  assert(bas > 0 && css.indexOf(son, bas) > 0, 'onizleme CSS blogu bulunamadi');
  const kural = css.slice(bas, css.indexOf(son, bas) + son.length);
  const temalar = win.AppMarket.temalar().filter(t => !t.varsayilan);
  let hucre = '';
  temalar.forEach(t => {
    const k = doc.createElement(); win.MarketEkran.onizlemeKur(k, t);
    const s = k.cocuklar[k.cocuklar.length - 1], tonVar = t.ton && t.ton.css;
    hucre += '<div class="mk-onizleme' + (tonVar ? ' ton-var' : '') + '" style="' + (tonVar ? '--tema-ton:' + t.ton.css + ';' : '') + 'width:120px;height:100px;box-sizing:border-box">' +
      '<div class="' + s.className + '">' + s.innerHTML + '</div></div>';
  });
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'ates-onizleme-'));
  try {
    fs.writeFileSync(path.join(dizin, 'a.html'), '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}' +
      '.g{display:grid;grid-template-columns:repeat(3,120px);grid-auto-rows:100px;width:360px;align-items:start}' + kural + '</style><div class="g">' + hucre + '</div>');
    const r = cp.spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--force-color-profile=srgb', '--window-size=360,300',
      '--screenshot=' + path.join(dizin, 'a.png'), require('url').pathToFileURL(path.join(dizin, 'a.html')).href], { timeout: 90000, encoding: 'utf8' });
    assert(r.status === 0 && fs.existsSync(path.join(dizin, 'a.png')), 'Chrome ekran goruntusu uretmedi (' + (r.error ? r.error.message : 'cikis ' + r.status) + ') ' + String(r.stderr || '').slice(0, 300));
    const im = pngCoz(fs.readFileSync(path.join(dizin, 'a.png')));
    assert(im.w === 360 && im.h >= 300, 'ekran goruntusu boyutu ' + im.w + 'x' + im.h);
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (x0, y0, w, h) => {
      let s = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * im.w + x) * im.bpp; s += 0.2126 * lin(im.px[i]) + 0.7152 * lin(im.px[i + 1]) + 0.0722 * lin(im.px[i + 2]); }
      return s / (w * h);
    };
    return temalar.map((t, i) => {
      const bx = (i % 3) * 120 + 31, by = Math.floor(i / 3) * 100 + 21;   // 58 px sahne, 120x100 hucrede ortali
      // koseler zemin rect'in yuvarlak kosesinin ICINDE (kenardan 11 px = en buyuk rx 9 + 2): rx'ten ve kart tonundan bagimsiz
      const kose = [[11, 11], [41, 11], [11, 41], [41, 41]].map(c => lum(bx + c[0], by + c[1], 6, 6));
      const ic = lum(bx + 25, by + 28, 3, 3);   // bocek feneri (karnin arka yarisi, svg ~26,5 29,5): p.isik rengi
      return { id: t.id, ort: lum(bx, by, 58, 58), kose: Math.max.apply(null, kose), ic };
    });
  } finally { try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { /* gecici dizin silinemedi: test sonucunu etkilemez */ } }
}
dene('onizleme zemini temanin orman tonundan (12.3): oyunla ayni kaynak, temalar arasi farkli, koyu', () => {
  const { win, doc, ctx } = yukle(false);
  const src = oku('js/marketEkran.js').replace('return { ac: ac, kapat: kapat, ciz: ciz };', 'return { ac: ac, kapat: kapat, ciz: ciz, onizlemeKur: onizlemeKur };');
  const hata = console.error; console.error = () => {};
  try { vm.runInContext(src, ctx, { filename: 'marketEkran.js' }); } finally { console.error = hata; }
  const hexK = (a, b, x) => '#' + [1, 3, 5].map(i => { const p = parseInt(a.substr(i, 2), 16), q = parseInt(b.substr(i, 2), 16); return Math.round(p + (q - p) * x).toString(16).padStart(2, '0'); }).join('').toUpperCase();   // marketEkran hexKaristir (tamsayi)
  const goruldu = new Set();
  win.AppMarket.temalar().forEach(t => {
    const k = doc.createElement(); win.MarketEkran.onizlemeKur(k, t);
    const svg = k.cocuklar[k.cocuklar.length - 1].innerHTML, P = M.isikCoz(t.isik);
    const z = /<stop offset="\.72" stop-color="(#[0-9A-Fa-f]{6})"/.exec(svg);
    assert(z, t.id + ': zemin duragi yok');
    assert.strictEqual(z[1].toUpperCase(), hexK(hexK(P.bolgeler[0], '#000000', 0.36), P.isik, 0.06), t.id + ': zemin orman tonundan degil');
    assert(parlaklik(dogrusal(rgb(z[1])), 'normal') < 0.03, t.id + ': zemin acik');
    goruldu.add(z[1].toUpperCase());
    assert(svg.indexOf(P.govde.koyu) > 0 && svg.indexOf(P.govde.kin) > 0, t.id + ': bocek govdesi temadan degil');
  });
  assert.strictEqual(goruldu.size, 10, 'onizleme zeminleri temalar arasi farkli olmali');
});

dene('onizleme halo (Chrome disi, statik): merkez opaklik <= .35, r 11.6-14.5 (58 px sahnenin %20-25i), renk p.isik', () => {
  const { win, doc, ctx } = yukle(false);
  const src = oku('js/marketEkran.js').replace('return { ac: ac, kapat: kapat, ciz: ciz };', 'return { ac: ac, kapat: kapat, ciz: ciz, onizlemeKur: onizlemeKur };');
  const hata = console.error; console.error = () => {};
  try { vm.runInContext(src, ctx, { filename: 'marketEkran.js' }); } finally { console.error = hata; }
  win.AppMarket.temalar().forEach(t => {
    const k = doc.createElement(); win.MarketEkran.onizlemeKur(k, t);
    const svg = k.cocuklar[k.cocuklar.length - 1].innerHTML, isik = M.isikCoz(t.isik).isik;
    const g = /<radialGradient id="(moAtes\d+)p"><stop offset="0" stop-color="(#[0-9A-Fa-f]{6})" stop-opacity="([0-9.]+)"/.exec(svg);
    assert(g, t.id + ': halo gradyani yok');
    assert(+g[3] <= 0.35, t.id + ': halo merkez opaklik ' + g[3]);
    assert.strictEqual(g[2].toUpperCase(), isik.toUpperCase(), t.id + ': halo rengi p.isik degil');
    const c = new RegExp('<circle [^>]*r="([0-9.]+)" fill="url\\(#' + g[1] + 'p\\)"').exec(svg);
    assert(c, t.id + ': halo circle yok');
    assert(+c[1] >= 11.6 && +c[1] <= 14.5, t.id + ': halo r ' + c[1]);
  });
});

dene('onizleme sahnesi gercek tarayicida koyu: 9 tema ortalama <= ' + ONIZ_ESIK.ort + ', kose <= ' + ONIZ_ESIK.kose + ' (headless Chrome)', () => {
  const chrome = chromeBul();
  if (!chrome) { console.log('       ATLANDI (Chrome yok): CHROME_YOL ortam degiskeniyle chrome.exe yolunu verin; bu test BASARISIZ SAYILMADI'); atlandi++; return; }
  if (process.env.ONIZ_HEAD) {   // tanilama: HEAD sahnesi (git show) ile olc, yalniz yazdir
    const cp = require('child_process'), g = f => cp.execFileSync('git', ['show', 'HEAD:' + f], { cwd: KOK, encoding: 'utf8' });
    onizlemeOlc(chrome, { ekran: g('js/marketEkran.js'), css: g('style.css') }).forEach(o => console.log('       HEAD ' + o.id + ' ort ' + o.ort.toFixed(3) + ' kose ' + o.kose.toFixed(3)));
  }
  const olcum = onizlemeOlc(chrome);
  assert.strictEqual(olcum.length, 9);
  // sahne gercekten cizildi mi: bocek feneri parlak (isik rengi) olmali
  const bos = olcum.filter(o => !(o.ic > 0.3));
  assert.strictEqual(bos.length, 0, 'bocek feneri parlak degil (sahne cizilmedi?): ' + bos.map(o => o.id + ' ' + o.ic.toFixed(3)).join('; '));
  const kotu = olcum.filter(o => o.ort > ONIZ_ESIK.ort || o.kose > ONIZ_ESIK.kose);
  if (process.env.ONIZ_OLCUM) console.log(olcum.map(o => '       ' + o.id + ' ort ' + o.ort.toFixed(3) + ' kose ' + o.kose.toFixed(3)).join('\n'));
  assert.strictEqual(kotu.length, 0, kotu.map(o => o.id + ' ort ' + o.ort.toFixed(3) + ' kose ' + o.kose.toFixed(3)).join('; '));
});

// ---- GERCEK market yolu: index.html + style.css + js/*.js, market envanteri (10 kart), CDP ile ekran goruntusu ----
// Beyaz kare sebebi: Android Chrome "web icerigini karart" (otomatik karanlik mod) SVG <rect fill="#05080D"> dolgusunu
// ters cevirip neredeyse beyaz yapiyordu (kart HTML arka plani koyu kalir, SVG dolgusu terslenir). Normal modda sorun yok;
// bu yuzden hem normal hem otomatik karanlik modda olculur. Kutunun kose (4 px ic) ve kenar orta (1,5 px ic) pikselleri koyu olmali.
function marketKartlariOlc(chrome, oto, port) {
  const r = require('child_process').spawnSync(process.execPath, [path.join(KOK, 'tools', 'marketKartYakala.js'), chrome, oto ? '1' : '0', String(port)],
    { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 90000 });
  assert(r.status === 0, 'marketKartYakala basarisiz: ' + String(r.stderr || r.error).slice(0, 300));
  const o = JSON.parse(r.stdout), im = pngCoz(Buffer.from(o.png, 'base64'));
  return o.kutular.map(k => {
    const x0 = Math.round(k.x), y0 = Math.round(k.y), W = Math.round(k.w), H = Math.round(k.h);
    const noktalar = [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5], [Math.round(W / 2), 1], [Math.round(W / 2), H - 2], [1, Math.round(H / 2)]];
    let en = 0;
    noktalar.forEach(n => { const i = ((y0 + n[1]) * im.w + x0 + n[0]) * im.bpp; en = Math.max(en, im.px[i], im.px[i + 1], im.px[i + 2]); });
    return { ad: k.ad, en, w: W, h: H };
  });
}
[false, true].forEach((oto, mi) => dene('gercek market karti: Karanlikta Suzul onizleme kutusu kose/kenar pikselleri koyu (her kanal < 60), 10 kart, ' + (oto ? 'otomatik karanlik mod' : 'normal mod'), () => {
  const chrome = chromeBul();
  if (!chrome) { console.log('       ATLANDI (Chrome yok)'); atlandi++; return; }
  const olcum = marketKartlariOlc(chrome, oto, 9440 + mi);
  assert.strictEqual(olcum.length, 10, 'kart sayisi ' + olcum.length);
  olcum.forEach(o => assert(o.w === 58 && o.h === 58, o.ad + ' kutu boyutu ' + o.w + 'x' + o.h));
  const kotu = olcum.filter(o => !(o.en < 60));
  if (process.env.ONIZ_OLCUM) console.log(olcum.map(o => '       ' + o.ad + ' en parlak kanal ' + o.en).join('\n'));
  assert.strictEqual(kotu.length, 0, kotu.map(o => o.ad + ' kanal ' + o.en).join('; '));
}));

// ---- Tema gorselligi (12.3): ayni sahne 10 palette (9 tema + varsayilan) x 4 bolge, GERCEK oyun cizimi (tools/atesBocegiTemaYakala.js) ----
// Yontem: tuval 300x600 px (dunya 50x100, olcek 6, dpr 1); 4x4 px bloklar dogrusal RGB'de ortalanir (kenar yumusatma gurultusu
// ve goz olcegi), CIELAB'a cevrilir; iki temanin AYNI konumdaki bloklari arasinda CIEDE2000 hesaplanir, tum bloklarin ortalamasi alinir
// (sahne geometrisi ayni oldugu icin fark yalniz renktir). Cift degeri = 4 bolgenin ortalamasi. Karanlik katman (cember disi) dahildir:
// oyuncunun gordugu tum kare olculur.
// Sinir (12.3): taban (tema gorselligi oncesi) en dusuk cift varsayilan/vitray 1,42, ciftlerin ortalamasi 5,97; son olcum en dusuk
// cift buz/cini 7,61, ortalama 16,51. 6,0 = tabanin en dusugunun ~4 kati ve taban ortalamasinin ustu; en dusuk ciftin %21 altinda pay.
const DE_SINIR = 6.0;
function temaGoruntuleri(chrome, port, kayit) {
  const r = require('child_process').spawnSync(process.execPath, [path.join(KOK, 'tools', 'atesBocegiTemaYakala.js'), chrome, String(port)].concat(kayit ? [kayit] : []),
    { encoding: 'utf8', maxBuffer: 1 << 29, timeout: 240000 });
  assert(r.status === 0, 'atesBocegiTemaYakala basarisiz: ' + String(r.stderr || r.error).slice(0, 400));
  return JSON.parse(r.stdout).sonuclar;
}
function blokLab(im, B) {
  const lin = new Float64Array(256), out = [];
  for (let v = 0; v < 256; v++) { const c = v / 255; lin[v] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  for (let y = 0; y + B <= im.h; y += B) for (let x = 0; x + B <= im.w; x += B) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = ((y + j) * im.w + x + i) * im.bpp; r += lin[im.px[k]]; g += lin[im.px[k + 1]]; b += lin[im.px[k + 2]]; }
    out.push(labDogrusal(r / (B * B), g / (B * B), b / (B * B)));
  }
  return out;
}
function temaUzakliklari(sonuclar) {
  const temalar = [], lab = {};
  sonuclar.forEach(s => {
    if (temalar.indexOf(s.tema) < 0) temalar.push(s.tema);
    const im = pngCoz(Buffer.from(s.png, 'base64'));
    assert(im.w === 300 && im.h === 600, s.tema + ' b' + s.bolge + ' boyut ' + im.w + 'x' + im.h);
    lab[s.tema + '|' + s.bolge] = blokLab(im, 4);
  });
  const ciftler = [];
  for (let i = 0; i < temalar.length; i++) for (let j = i + 1; j < temalar.length; j++) {
    const bol = [0, 1, 2, 3].map(b => { const A = lab[temalar[i] + '|' + b], C = lab[temalar[j] + '|' + b]; let s = 0; for (let k = 0; k < A.length; k++) s += de2000(A[k], C[k]); return s / A.length; });
    ciftler.push({ a: temalar[i], b: temalar[j], de: bol.reduce((x, y) => x + y, 0) / 4, bol });
  }
  // sahne gercekten bolgeye gore cizildi mi: her temada 4 bolge goruntusu birbirinden farkli
  let bolgeEn = Infinity;
  temalar.forEach(t => { for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const A = lab[t + '|' + i], C = lab[t + '|' + j]; let s = 0; for (let k = 0; k < A.length; k++) s += de2000(A[k], C[k]); bolgeEn = Math.min(bolgeEn, s / A.length); } });
  return { temalar, ciftler: ciftler.sort((x, y) => x.de - y.de), bolgeEn };
}
dene('tema gorselligi: ayni sahne 10 palet x 4 bolge gercek cizimle; temalar arasi ortalama CIEDE2000' + (DE_SINIR ? ' >= ' + DE_SINIR : ' (olcum)') + ' (headless Chrome)', () => {
  const chrome = chromeBul();
  if (!chrome) { console.log('       ATLANDI (Chrome yok)'); atlandi++; return; }
  const sonuclar = temaGoruntuleri(chrome, 9446, process.env.ATES_TEMA_KAYIT || '');
  assert.strictEqual(sonuclar.length, 40, 'goruntu sayisi ' + sonuclar.length);
  const { temalar, ciftler, bolgeEn } = temaUzakliklari(sonuclar);
  assert.strictEqual(temalar.length, 10); assert.strictEqual(ciftler.length, 45);
  assert(bolgeEn > 1, 'ayni temada bolge goruntuleri ayni (bolge uygulanmadi?): ' + bolgeEn.toFixed(2));
  const en = ciftler[0], ort = ciftler.reduce((x, c) => x + c.de, 0) / ciftler.length;
  console.log('       en dusuk cift ' + en.a + '/' + en.b + ' dE00 ' + en.de.toFixed(2) + ' (bolgeler ' + en.bol.map(v => v.toFixed(2)).join(' ') + '), ciftlerin ortalamasi ' + ort.toFixed(2) + ', ayni temada bolgeler arasi en az ' + bolgeEn.toFixed(2));
  if (process.env.ATES_DE_OLCUM) ciftler.forEach(c => console.log('       ' + c.a + '/' + c.b + ' ' + c.de.toFixed(2)));
  if (DE_SINIR) { const kotu = ciftler.filter(c => c.de < DE_SINIR); assert.strictEqual(kotu.length, 0, kotu.map(c => c.a + '/' + c.b + ' ' + c.de.toFixed(2)).join('; ')); }
});

console.log(gecti + ' test gecti' + (atlandi ? ' (' + atlandi + ' atlandi)' : '') + (process.exitCode ? ', HATA VAR' : '') +
  '; en dusuk oran: ' + sonuclar.slice(0, ana).reduce((a, b) => (b.oran < a.oran ? b : a)).oran.toFixed(2));
