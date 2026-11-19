// atesBocegiTemaTest.js — Ates Bocegi temalari: katalog, kontrast, isikCoz, onizleme.
// Tasarim: docs/atesBocegi-tasarim.md bolum 5, 6, 8.3, 8.6.
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

// ---- sabitler koddan okunur (kopya yok) ----
const sabit = (kaynak, ad) => { const m = new RegExp(ad + " = '(#[0-9A-Fa-f]{6})'").exec(kaynak); assert(m, ad + ' bulunamadi'); return m[1]; };
const ENGEL_DOLGU = sabit(OYUN, 'ENGEL_DOLGU'), ENGEL_KENAR = sabit(OYUN, 'ENGEL_KENAR');
const bm = /BOLGE_TON = \[([^\]]*)\]/.exec(OYUN);
const BOLGE = bm[1].match(/#[0-9A-Fa-f]{6}/g);
const ISIK_KARISIM = +/ISIK_KARISIM = ([0-9.]+)/.exec(OYUN)[1];
const EDI = { isik: 0, toz: 0 };
const BICIMLER = Object.keys(VIENOT);
const YERLESIK_PALET = M.isikCoz({ yerlesik: true });

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

console.log('Okunabilirlik (bolum 6)');

const sonuclar = [];   // {tema, bolge, kural, bicim, oran}
function kontrastHesapla(ad, isik, toz, vurgu) {
  BOLGE.forEach((ton, bi) => {
    const zemin = karistir(ton, isik, ISIK_KARISIM);
    const dolgu = rgb(ENGEL_DOLGU), kenar = rgb(ENGEL_KENAR);
    BICIMLER.forEach(b => {
      const ekle = (kural, o) => sonuclar.push({ tema: ad, bolge: bi, kural, bicim: b, oran: o });
      ekle('K1', oran(kenar, zemin, b));
      ekle('K2', oran(rgb(isik), zemin, b));
      ekle('K3', oran(rgb(toz), zemin, b));
      ekle('K4', oran(rgb(vurgu), zemin, b));
      ekle('K5', oran(rgb(toz), dolgu, b));
    });
  });
}
TEMALAR.forEach(t => kontrastHesapla(t.id, t.isik.isik, t.isik.toz, t.isik.vurgu));
const ana = sonuclar.length;
kontrastHesapla('yerlesik', YERLESIK_PALET.isik, YERLESIK_PALET.toz, YERLESIK_PALET.vurgu);

const ESIK = { K1: 3.0, K2: 3.0, K3: 3.0, K4: 3.0, K5: 4.5, K6: 4.5 };

dene('540 oran (9 tema x 4 bolge x K1-K5 x 3 gorme bicimi) esik ustunde', () => {
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

dene('K1 ek: engel kenari / paralaks katman renkleri >= 3,0 (oyundaki gercek hesap, 3 gorme bicimi)', () => {
  const kat = /var koyu = karistir\(zemin, '#000000', kat === 0 \? ([0-9.]+) : ([0-9.]+)\), acik = karistir\(zemin, '#FFFFFF', ([0-9.]+)\)/.exec(OYUN);
  assert(kat, 'katmanCiz hesabi okunamadi');
  const k0 = +kat[1], k1 = +kat[2], ac = +kat[3];
  const kenar = rgb(ENGEL_KENAR), kotu = [];
  TEMALAR.map(t => ({ id: t.id, isik: t.isik.isik })).concat([{ id: 'yerlesik', isik: YERLESIK_PALET.isik }]).forEach(t => {
    BOLGE.forEach((ton, bi) => {
      const zemin = karistir(ton, t.isik, ISIK_KARISIM), mix = (c, h, x) => c.map(v => v + (h - v) * x);
      const katmanlar = { 'k0 koyu': mix(zemin, 0, k0), 'k1 koyu': mix(zemin, 0, k1), 'k2 acik': mix(zemin, 1, ac) };
      Object.keys(katmanlar).forEach(ad => BICIMLER.forEach(b => {
        const o = oran(kenar, katmanlar[ad], b);
        if (o < 3.0) kotu.push(t.id + ' bolge' + bi + ' ' + ad + ' ' + b + ' ' + o.toFixed(2));
      }));
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

dene('engel sabit renkleri kodda tek yerde tanimli (js/*.js)', () => {
  const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter(f => /\.js$/.test(f));
  [ENGEL_DOLGU, ENGEL_KENAR].forEach(r => {
    const bulunan = [];
    dosyalar.forEach(f => {
      const n = (oku('js/' + f).match(new RegExp(r, 'gi')) || []).length;
      if (n) bulunan.push(f + ':' + n);
    });
    assert.deepStrictEqual(bulunan, ['atesBocegiOyun.js:1'], r + ' -> ' + bulunan.join(', '));
  });
  // temalar engel rengini tasiyamaz
  TEMALAR.forEach(t => assert(!/0B0F14|E9EDF2/i.test(JSON.stringify(t.isik)), t.id));
});

console.log('Karanliktasuzul: bomba / unlem / sarmasik sabit renkleri ve yeni arka plan katmanlari');

const BOMBA_KENAR = sabit(OYUN, 'BOMBA_KENAR'), BOMBA_CEKIRDEK = sabit(OYUN, 'BOMBA_CEKIRDEK'), UNLEM_RENK = sabit(OYUN, 'UNLEM_RENK');
const SARMASIK_GOVDE = sabit(OYUN, 'SARMASIK_GOVDE'), SARMASIK_YAPRAK = sabit(OYUN, 'SARMASIK_YAPRAK');
const SABIT_TEHLIKE = { BOMBA_KENAR, BOMBA_CEKIRDEK, UNLEM_RENK, SARMASIK_GOVDE, SARMASIK_YAPRAK };
const TUM_TEMA = TEMALAR.map(t => ({ id: t.id, p: t.isik })).concat([{ id: 'yerlesik', p: YERLESIK_PALET }]);
const KATMAN = {};
{ const m = /var KATMAN = \{([^}]*)\}/.exec(OYUN); assert(m, 'KATMAN tablosu yok'); m[1].split(',').forEach(p => { const k = /(\w+):\s*([0-9.]+)/.exec(p); KATMAN[k[1]] = +k[2]; }); }
const EN_DUSUK = {};
const izle = (ad, o) => { if (!(ad in EN_DUSUK) || o < EN_DUSUK[ad]) EN_DUSUK[ad] = o; };

dene('bomba / unlem / sarmasik sabit renkleri zemine >= 3,0 (10 palet x 4 bolge x 3 gorme bicimi, 600 oran)', () => {
  const kotu = []; let n = 0;
  Object.keys(SABIT_TEHLIKE).forEach(ad => TUM_TEMA.forEach(t => BOLGE.forEach((ton, bi) => BICIMLER.forEach(b => {
    const o = oran(rgb(SABIT_TEHLIKE[ad]), karistir(ton, t.p.isik, ISIK_KARISIM), b); n++; izle(ad, o);
    if (o < 3.0) kotu.push(ad + ' ' + t.id + ' bolge' + bi + ' ' + b + ' ' + o.toFixed(2));
  }))));
  assert.strictEqual(n, 600); assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('bomba kenari ile toz renk korlugunde de ayrisir: parlaklik orani >= 1,5 (cekirdek >= 1,4), 3 gorme bicimi', () => {
  // Gerekce: toz acik (L ~0,75-0,9); bomba kenari zemine >= 3 icin L >= ~0,4 ister; iki kosul arasinda kalan pencere 1,5 ya da biraz ustu.
  // Asil ayrim SEKIL (asagidaki test): bu oran renk bilgisini ikinci kanal olarak korur.
  const kotu = [];
  TUM_TEMA.forEach(t => BICIMLER.forEach(b => {
    const k = oran(rgb(BOMBA_KENAR), rgb(t.p.toz), b), c = oran(rgb(BOMBA_CEKIRDEK), rgb(t.p.toz), b);
    izle('bomba kenar/toz', k); izle('bomba cekirdek/toz', c);
    if (k < 1.5) kotu.push(t.id + ' kenar ' + b + ' ' + k.toFixed(2));
    if (c < 1.4) kotu.push(t.id + ' cekirdek ' + b + ' ' + c.toFixed(2));
  }));
  assert.strictEqual(kotu.length, 0, kotu.join('; '));
});

dene('bomba / toz SEKIL ayrimi (renkten bagimsiz): diken sayisi 6-8, tozdan buyuk, dikenli sprite kodda', () => {
  const dk = +/BOMBA_DIKEN = (\d+)/.exec(OYUN)[1], h = require(path.join(KOK, 'js', 'atesBocegi.js')).AYAR.hareket;
  assert(dk >= 6 && dk <= 8, 'diken ' + dk);
  assert(h.R_BOMBA / h.R_TOZ_GORSEL >= 1.4, 'bomba/toz yaricap orani ' + (h.R_BOMBA / h.R_TOZ_GORSEL));
  assert(/function bombaSprite\(\)/.test(OYUN) && /BOMBA_DIKEN \* 2/.test(OYUN), 'dikenli dis hat');
  assert(/ENGEL_DOLGU; x\.strokeStyle = BOMBA_KENAR/.test(OYUN), 'koyu kure + sabit acik kenar');
  assert(!/pal\.(isik|toz|vurgu|karanlik)/.test(/function bombaSprite[\s\S]*?\n  \}/.exec(OYUN)[0]), 'bomba sprite temaya bagli degil');
});

dene('yeni sabit renkler js/*.js icinde tek yerde tanimli ve temalar tasiyamaz', () => {
  const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter(f => /\.js$/.test(f));
  Object.keys(SABIT_TEHLIKE).forEach(ad => {
    const r = SABIT_TEHLIKE[ad], bulunan = [];
    dosyalar.forEach(f => { const n = (oku('js/' + f).match(new RegExp(r, 'gi')) || []).length; if (n) bulunan.push(f + ':' + n); });
    assert.deepStrictEqual(bulunan, ['atesBocegiOyun.js:1'], ad + ' ' + r + ' -> ' + bulunan.join(', '));
    TEMALAR.forEach(t => assert(JSON.stringify(t.isik).toUpperCase().indexOf(r.toUpperCase()) < 0, t.id + ' ' + ad));
  });
  // yutulan toz cizilmez ve renk tema alanindan okunmaz: sarmasik/unlem/bomba cizimi pal.* kullanmaz
  ['function sarmasikCiz', 'function ozIsikCiz'].forEach(fn => {
    const g = new RegExp(fn.replace(' ', '\\s+') + '[\\s\\S]*?\\n  \\}').exec(OYUN);
    assert(g && !/pal\./.test(g[0]), fn + ' pal.* kullanmamali');
  });
});

dene('mantar / ay / sis katmanlari: engel kenarindan her zaman koyu, kenar ve toz ile >= 3,0 (10 palet, 3 gorme bicimi)', () => {
  // Renkler katmanCiz ile ayni formul: mantar kap = karistir(zemin, vurgu, mantarKap) + hale (alfa mantarHale);
  // ay = karistir(zemin, beyaz, ay); sis = karistir(zemin, beyaz, sis) alfa sisAlfa ile (elipsler yari saydam; opak hesap gercegi yansitmaz).
  const kenar = rgb(ENGEL_KENAR), kotu = [], L = (c, b) => parlaklik(dogrusal(c), b);
  const mix = (a, b, x) => a.map((v, i) => v + (b[i] - v) * x);
  TUM_TEMA.forEach(t => {
    const vur = rgb(t.p.vurgu), toz = rgb(t.p.toz), bey = [1, 1, 1];
    const zem = bi => karistir(BOLGE[bi], t.p.isik, ISIK_KARISIM);
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
   { iz: { renkler: ['#111111', 'x'] } }, { iz: { renkler: [] } }].forEach(v => {
    const p = M.isikCoz(v); tam(p);
    assert.strictEqual(p.iz.sekil, 'cizgi');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(p)).isik, '#FFE27A');
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(M.isikCoz({ yerlesik: true }))),
    { isik: '#FFE27A', toz: '#FFF3B0', vurgu: '#9BE86B', karanlik: '#05080D', iz: { renk: '#FFD24A', renk2: '#FFD24A', sekil: 'cizgi' }, animasyon: '' });
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
  assert(/\.mo-sahne\.mo-ates\{[^}]*background:transparent/.test(css) && /\.mo-ates svg\{[^}]*background:transparent/.test(css));
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
      const ic = lum(bx + 29, by + 28, 3, 3);   // bocek karni merkezi (svg ~30,29.5): p.isik rengi
      return { id: t.id, ort: lum(bx, by, 58, 58), kose: Math.max.apply(null, kose), ic };
    });
  } finally { try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { /* gecici dizin silinemedi: test sonucunu etkilemez */ } }
}
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
  // sahne gercekten cizildi mi: bocek karni parlak (isik rengi) olmali
  const bos = olcum.filter(o => !(o.ic > 0.3));
  assert.strictEqual(bos.length, 0, 'bocek karni parlak degil (sahne cizilmedi?): ' + bos.map(o => o.id + ' ' + o.ic.toFixed(3)).join('; '));
  const kotu = olcum.filter(o => o.ort > ONIZ_ESIK.ort || o.kose > ONIZ_ESIK.kose);
  if (process.env.ONIZ_OLCUM) console.log(olcum.map(o => '       ' + o.id + ' ort ' + o.ort.toFixed(3) + ' kose ' + o.kose.toFixed(3)).join('\n'));
  assert.strictEqual(kotu.length, 0, kotu.map(o => o.id + ' ort ' + o.ort.toFixed(3) + ' kose ' + o.kose.toFixed(3)).join('; '));
});

console.log(gecti + ' test gecti' + (atlandi ? ' (' + atlandi + ' atlandi)' : '') + (process.exitCode ? ', HATA VAR' : '') +
  '; en dusuk oran: ' + sonuclar.slice(0, ana).reduce((a, b) => (b.oran < a.oran ? b : a)).oran.toFixed(2));
