// reklamTest.js — reklam katmani (js/reklamAyar.js + js/reklam.js) ve market reklam
// odulleri (js/market.js) kurallarini DOM'suz dener. Calistirma:  node tools/reklamTest.js
// Saat sahtedir (Date her baglamda degistirilir): gecis sureleri ve gun donumu simule edilir.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const oku = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

const denemeler = [];
function dene(ad, fn) { denemeler.push([ad, fn]); }
const DK = 60 * 1000;

// ---- sahte saat: baglamin Date'i bunu kullanir ----
function saatKur(baslangic) {
  const saat = { t: baslangic };
  class SahteDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(saat.t); }
    static now() { return saat.t; }
  }
  saat.Date = SahteDate;
  return saat;
}

// ---- reklam katmani ----
function reklamKur(o) {
  o = o || {};
  const saat = o.saat || saatKur(new Date(2026, 10, 23, 10, 0).getTime());
  const depo = Object.assign({}, o.depo || {});
  // varsayilan adres yerel (file://): sahte mod yalnizca yerel adreste calisir
  const konum = Object.assign({ protocol: 'file:', hostname: '' }, o.konum || {}, { search: o.search || '' });
  const win = {
    location: konum,
    AppStore: { get: (k, d) => (k in depo ? depo[k] : d), set: (k, v) => { depo[k] = v; } },
    addEventListener() {}
  };
  if (o.yerel) win.Capacitor = { isNativePlatform: () => true };
  const ctx = { window: win, console, Date: saat.Date, setInterval, clearInterval, setTimeout, Promise };
  if (o.dom) { ctx.document = sahteDom(); win.document = ctx.document; }
  vm.createContext(ctx);
  let ayar = oku('reklamAyar.js');
  if (o.release) ayar = ayar.replace('var REKLAM_TEST = true;', 'var REKLAM_TEST = false;');
  vm.runInContext(ayar + '\n' + oku('reklam.js'), ctx);
  return { R: win.Reklam, A: win.ReklamAyar, win, saat, depo };
}

// Pencere testleri icin en kucuk sahte DOM (reklam.js pencere() yalnizca bunlari kullanir).
function sahteDom() {
  function el(tag) {
    const e = {
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, dinle: {}, attr: {},
      className: '', textContent: '', disabled: false, type: '',
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      setAttribute(k, v) { e.attr[k] = v; },
      appendChild(c) { c.parentNode = e; e.children.push(c); return c; },
      removeChild(c) { e.children = e.children.filter(x => x !== c); c.parentNode = null; return c; },
      addEventListener(t, f) { e.dinle[t] = f; },
      click() { if (e.dinle.click) e.dinle.click(); }
    };
    let ic = '';
    Object.defineProperty(e, 'innerHTML', { get: () => ic, set: v => { ic = v; if (v === '') e.children = []; } });
    return e;
  }
  const body = el('body');
  return {
    body, querySelector: () => null, createElement: el,
    createTextNode: t => ({ textContent: t }),
    // yardimci: acik pencereler ve dugmeleri
    ortular: () => body.children.filter(c => c.className === 'rk-ortu'),
    dugmeler: () => {
      const out = [];
      (function gez(n) { (n.children || []).forEach(c => { if (c.tagName === 'BUTTON') out.push(c); gez(c); }); })(body);
      return out;
    }
  };
}

// Test saglayicisi: hazir bayragi + sonraki odullu sonucu ayarlanir, cagrilar sayilir.
function saglayiciYap() {
  const s = { ad: 'deneme', hazir: true, sonuc: true, odulluSayac: 0, gecisSayac: 0, bekle: null };
  s.hazirMi = () => s.hazir;
  s.odullu = () => { s.odulluSayac++; if (s.bekle) return s.bekle; return Promise.resolve(s.sonuc); };
  s.gecis = () => { s.gecisSayac++; return Promise.resolve(true); };
  return s;
}

// ---- market (sandikTest.js ile ayni sahte pencere) + Reklam taklidi ----
function marketKur(o) {
  o = o || {};
  const saat = o.saat || saatKur(new Date(2026, 10, 23, 10, 0).getTime());
  const yazimlar = [];
  const win = { AppProgress: o.ilerleme || { gold: o.altin || 0 }, AppReset: [], AppStore: { get: (k, d) => d, set() {} } };
  win.AppSaveProgress = patch => { Object.assign(win.AppProgress, patch); yazimlar.push(JSON.parse(JSON.stringify(patch))); };
  win.AppGold = {
    get: () => win.AppProgress.gold,
    add: n => { win.AppProgress.gold += n; },
    harca: n => { if (win.AppProgress.gold < n) return false; win.AppProgress.gold -= n; return true; },
    render() {}
  };
  const reklam = { durum: o.reklamDurum || 'hazir', sonuc: true, sayac: 0 };
  if (o.reklamYok !== true) {
    win.Reklam = {
      destekleniyor: () => reklam.durum !== 'gizli',
      dugmeDurumu: () => reklam.durum,
      odulluGoster: birim => { reklam.sayac++; reklam.sonBirim = birim; return Promise.resolve({ odul: reklam.sonuc }); }
    };
  }
  const el = () => ({ style: { setProperty() {}, removeProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, dataset: {} });
  const document = { querySelector: el, querySelectorAll: () => [], getElementById: el, createElement: el, documentElement: el(), body: el() };
  const ctx = { window: win, document, console, Date: saat.Date, Promise };
  vm.createContext(ctx);
  // Kayit ve AppReset baglamin KENDI Array/Object'leriyle kurulur (tarayicida oldugu gibi;
  // market.js 'instanceof Array' denetler, baska baglamin dizisi bunu gecemez).
  win.AppProgress = icindeKur(ctx, win.AppProgress);
  win.AppReset = vm.runInContext('[]', ctx);
  vm.runInContext(oku('marketKatalog.js') + '\n' + oku('market.js'), ctx);
  return { M: win.AppMarket, win, saat, reklam, yazimlar, ctx };
}
function icindeKur(ctx, nesne) {
  return vm.runInContext('JSON.parse(' + JSON.stringify(JSON.stringify(nesne)) + ')', ctx);
}
const kopya = x => JSON.parse(JSON.stringify(x));

// =================================================================
denemeler.push(['reklam katmani']);

dene('sahte saat baglamda calisiyor', () => {
  const { win, saat } = reklamKur();
  const d = vm.runInContext('Date.now()', vm.createContext({ Date: saat.Date }));
  assert.strictEqual(d, saat.t);
  assert.ok(win.Reklam);
});

dene('reklamAyar: test modunda Google test kimlikleri', () => {
  const { A } = reklamKur();
  assert.strictEqual(A.REKLAM_TEST, true);
  assert.strictEqual(A.uygulamaId(), 'ca-app-pub-3940256099942544~3347511713');
  ['ipucu_joker', 'ikinci_sans', 'altin_x2'].forEach(b => assert.strictEqual(A.birimId(b), 'ca-app-pub-3940256099942544/5224354917'));
  assert.strictEqual(A.birimId('gecis'), 'ca-app-pub-3940256099942544/1033173712');
  assert.strictEqual(A.birimId('yok_boyle'), null);
  assert.deepStrictEqual(Array.from(A.BIRIMLER), ['ipucu_joker', 'ikinci_sans', 'altin_x2', 'gecis']);
});

dene('reklamAyar: release modunda yer tutuculu birim null, gecis gercek kimlik', () => {
  const { A } = reklamKur({ release: true });
  assert.strictEqual(A.uygulamaId(), 'ca-app-pub-2250901316269310~9912780818');
  ['ipucu_joker', 'ikinci_sans', 'altin_x2'].forEach(b => assert.strictEqual(A.birimId(b), null));
  assert.strictEqual(A.birimId('gecis'), 'ca-app-pub-2250901316269310/5223687222');
});

dene('tarayici (sorgu yok): destek yok, her birim gizli, hicbir sey acilmaz', async () => {
  const { R } = reklamKur();
  assert.strictEqual(R._saglayici(), 'yok');
  assert.strictEqual(R.destekleniyor(), false);
  ['ipucu_joker', 'ikinci_sans', 'altin_x2', 'gecis'].forEach(b => {
    assert.strictEqual(R.hazirMi(b), false);
    assert.strictEqual(R.dugmeDurumu(b), 'gizli');
  });
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: false });
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 10 })).gosterildi, false);
  assert.strictEqual(await R.ikinciSans({}), false);          // pencere acilmaz (document yok, patlamaz)
  assert.strictEqual(await R.secim({ secenekler: [{ deger: 'r', etiket: 'Reklam', birim: 'ipucu_joker' }] }), null);
});

dene('?reklamTest=1: destek var, hazir; ?reklamTest=2: destek var, hazir degil (pasif)', () => {
  const a = reklamKur({ search: '?reklamTest=1' }).R;
  assert.strictEqual(a._saglayici(), 'sahte');
  assert.strictEqual(a.destekleniyor(), true);
  assert.strictEqual(a.hazirMi('ikinci_sans'), true);
  assert.strictEqual(a.dugmeDurumu('ipucu_joker'), 'hazir');
  assert.strictEqual(a.hazirMi('bilinmeyen'), false);
  const b = reklamKur({ search: '?x=1&reklamTest=2' }).R;
  assert.strictEqual(b.destekleniyor(), true);
  assert.strictEqual(b.hazirMi('altin_x2'), false);
  assert.strictEqual(b.dugmeDurumu('altin_x2'), 'pasif');
  assert.strictEqual(reklamKur({ search: '?reklamTest=3' }).R.destekleniyor(), false);
  assert.strictEqual(reklamKur({ search: '?reklamTest=12' }).R.destekleniyor(), false);
});

dene('sahte mod yalnizca REKLAM_TEST acikken', () => {
  const { R } = reklamKur({ search: '?reklamTest=1', release: true });
  assert.strictEqual(R.destekleniyor(), false);
});

dene('sahte mod yalnizca yerel adreste: file, localhost, 127.0.0.1, [::1], ozel ag IP', () => {
  const yerel = [{ protocol: 'file:', hostname: '' },
    { protocol: 'http:', hostname: 'localhost' }, { protocol: 'http:', hostname: '127.0.0.1' },
    { protocol: 'http:', hostname: '[::1]' }, { protocol: 'http:', hostname: '10.0.0.2' },
    { protocol: 'http:', hostname: '192.168.1.34' }, { protocol: 'http:', hostname: '172.16.0.1' },
    { protocol: 'http:', hostname: '172.31.255.254' }, { protocol: 'https:', hostname: 'LOCALHOST' }];
  yerel.forEach(k => {
    const { R } = reklamKur({ search: '?reklamTest=1', konum: k });
    assert.strictEqual(R._saglayici(), 'sahte', JSON.stringify(k));
    assert.strictEqual(R.dugmeDurumu('ikinci_sans'), 'hazir');
  });
  assert.strictEqual(reklamKur({ search: '?reklamTest=2', konum: { protocol: 'http:', hostname: '192.168.0.5' } }).R.dugmeDurumu('ipucu_joker'), 'pasif');
});

dene('yayindaki adreste ?reklamTest etkisiz: destek yok (yerel Capacitor degilse)', () => {
  const uzak = ['kullanici.github.io', 'ornek.com', '172.32.0.1', '172.15.9.9', '192.169.1.1', '11.0.0.1',
    '8.8.8.8', 'localhost.ornek.com', '10.0.0.1.nip.io', '127.0.0.2', '192.168.1.300', ''];
  uzak.forEach(h => {
    ['?reklamTest=1', '?reklamTest=2'].forEach(q => {
      const { R } = reklamKur({ search: q, konum: { protocol: 'https:', hostname: h } });
      assert.strictEqual(R._saglayici(), 'yok', h + q);
      assert.strictEqual(R.destekleniyor(), false, h + q);
      assert.strictEqual(R.dugmeDurumu('altin_x2'), 'gizli');
    });
  });
  // yerel uygulama (Capacitor) uzak adres gibi gorunse de yerel saglayiciyi kullanir; sahte degil
  const y = reklamKur({ search: '?reklamTest=1', konum: { protocol: 'https:', hostname: 'kullanici.github.io' }, yerel: true }).R;
  assert.strictEqual(y._saglayici(), 'yerel');
  assert.strictEqual(y.dugmeDurumu('ikinci_sans'), 'pasif');
});

dene('yerel uygulama (eklenti yok, Asama 1): destek var, hicbir birim hazir degil, patlamaz', async () => {
  const { R } = reklamKur({ yerel: true });
  assert.strictEqual(R._saglayici(), 'yerel');
  assert.strictEqual(R.destekleniyor(), true);
  assert.strictEqual(R.dugmeDurumu('ikinci_sans'), 'pasif');
  assert.deepStrictEqual(kopya(await R.odulluGoster('ikinci_sans')), { odul: false });
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 10 })).gosterildi, false);
});

dene('odulluGoster: odul yalnizca saglayici sonuna kadar izlendi derse; gecis birimi odullu degil', async () => {
  const { R } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: true });
  s.sonuc = false;
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: false });
  s.sonuc = 'evet';   // true disinda her sey odulsuz
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: false });
  s.sonuc = true;
  assert.deepStrictEqual(kopya(await R.odulluGoster('gecis')), { odul: false });
  assert.deepStrictEqual(kopya(await R.odulluGoster('yok_boyle')), { odul: false });
  s.hazir = false;
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: false });
  assert.strictEqual(s.odulluSayac, 3);
});

dene('odulluGoster: saglayici hata verirse odulsuz, katman kilitli kalmaz', async () => {
  const { R } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  s.odullu = () => Promise.reject(new Error('yuklenemedi'));
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: false });
  s.odullu = () => { throw new Error('senkron'); };
  assert.deepStrictEqual(kopya(await R.odulluGoster('altin_x2')), { odul: false });
  assert.strictEqual(R.acikMi(), false);
});

dene('ayni anda iki reklam acilmaz: ikinci cagri hemen {odul:false}, gecis de acilmaz', async () => {
  const { R } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  let bitir; s.bekle = new Promise(r => { bitir = r; });
  const ilk = R.odulluGoster('ipucu_joker');
  assert.strictEqual(R.acikMi(), true);
  assert.deepStrictEqual(kopya(await R.odulluGoster('ikinci_sans')), { odul: false });
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 9 })).neden, 'mesgul');
  bitir(true);
  assert.deepStrictEqual(kopya(await ilk), { odul: true });
  assert.strictEqual(R.acikMi(), false);
  assert.strictEqual(s.odulluSayac, 1);
});

// ---- ortak pencere: tek reklam, geri tusu, pencereKapat ----
const bekle = () => new Promise(r => setImmediate(r));
function pencereKur() {
  const k = reklamKur({ dom: true });
  const s = saglayiciYap(); k.R._saglayiciAyarla(s);
  let bitir = null;
  k.s = s;
  k.reklamTut = () => { s.bekle = new Promise(r => { bitir = r; }); };
  k.reklamBitir = v => { const b = bitir; bitir = null; s.bekle = null; b(v); };
  k.doc = k.win.document;
  return k;
}
const IPUCU = () => ({ baslik: 'Ipucu', secenekler: [{ deger: 'altin', etiket: '20 altin' },
  { deger: 'reklam', etiket: 'Reklam izle', birim: 'ipucu_joker' }], iptal: 'Vazgec' });
const reklamDugmesi = doc => doc.dugmeler().find(d => d.className.indexOf('rk-reklam') >= 0);

dene('reklam oynarken yeni secim/ikinciSans hemen null/false; oynayan reklam ve odulu korunur', async () => {
  const { R, doc, reklamTut, reklamBitir, s } = pencereKur();
  reklamTut();
  const ilk = R.secim(IPUCU());
  assert.strictEqual(doc.ortular().length, 1);
  reklamDugmesi(doc).click();
  assert.strictEqual(R.acikMi(), true);
  let ikinci = 'bekliyor', sans = 'bekliyor';
  R.secim(IPUCU()).then(d => { ikinci = d; });
  R.ikinciSans({}).then(d => { sans = d; });
  await bekle();
  assert.strictEqual(ikinci, null);
  assert.strictEqual(sans, false);
  assert.strictEqual(doc.ortular().length, 1, 'yeni pencere acilmadi, eskisi duruyor');
  reklamBitir(true);
  assert.strictEqual(await ilk, 'reklam', 'oynayan reklamin odulu kaybolmadi');
  assert.strictEqual(doc.ortular().length, 0);
  assert.strictEqual(s.odulluSayac, 1);
  // pencere disi reklam (market) oynarken de pencere acilmaz
  reklamTut();
  const m = R.odulluGoster('altin_x2');
  assert.strictEqual(await R.secim(IPUCU()), null);
  assert.strictEqual(doc.ortular().length, 0);
  reklamBitir(true);
  assert.deepStrictEqual(kopya(await m), { odul: true });
});

dene('reklam oynamiyorken yeni pencere eskisini null ile kapatir (onceki davranis)', async () => {
  const { R, doc } = pencereKur();
  const a = R.secim(IPUCU());
  const b = R.ikinciSans({});
  assert.strictEqual(await a, null);
  assert.strictEqual(doc.ortular().length, 1);
  doc.dugmeler().find(d => d.className.indexOf('rk-normal') >= 0).click();   // "Hayir, bitir"
  assert.strictEqual(await b, false);
  assert.strictEqual(doc.ortular().length, 0);
});

dene('geriTusu: pencere acikken yalniz onu kapatir (true); reklam oynarken yok sayar (true); bos iken false', async () => {
  const { R, doc, reklamTut, reklamBitir } = pencereKur();
  assert.strictEqual(R.geriTusu(), false);
  const a = R.secim(IPUCU());
  assert.strictEqual(R.geriTusu(), true);
  assert.strictEqual(await a, null);
  assert.strictEqual(doc.ortular().length, 0);
  assert.strictEqual(R.geriTusu(), false);
  const b = R.ikinciSans({});
  assert.strictEqual(R.geriTusu(), true);
  assert.strictEqual(await b, false);
  // pencerede reklam oynarken: geri tusu tuketilir ama pencere/reklam surer
  reklamTut();
  const c = R.ikinciSans({});
  reklamDugmesi(doc).click();
  assert.strictEqual(R.geriTusu(), true);
  assert.strictEqual(R.geriTusu(), true);
  assert.strictEqual(doc.ortular().length, 1);
  reklamBitir(true);
  assert.strictEqual(await c, true);
  // pencere disi reklam (sahte katman / market) oynarken de yok sayilir
  reklamTut();
  const m = R.odulluGoster('altin_x2');
  assert.strictEqual(R.geriTusu(), true);
  reklamBitir(false);
  assert.deepStrictEqual(kopya(await m), { odul: false });
  assert.strictEqual(R.geriTusu(), false);
});

dene('pencereKapat: acik pencere null ile kapanir; reklam oynarken kapanmaz', async () => {
  const { R, doc, reklamTut, reklamBitir } = pencereKur();
  assert.strictEqual(R.pencereKapat(), false);
  const a = R.ikinciSans({});
  assert.strictEqual(R.pencereKapat(), true);
  assert.strictEqual(await a, false);
  reklamTut();
  const b = R.ikinciSans({});
  reklamDugmesi(doc).click();
  assert.strictEqual(R.pencereKapat(), false);
  assert.strictEqual(doc.ortular().length, 1);
  reklamBitir(true);
  assert.strictEqual(await b, true);
  assert.strictEqual(doc.ortular().length, 0);
});

// ---- gecis kurallari ----
dene('saf gecisKarari: tablo', () => {
  const { R } = reklamKur();
  const T = 1e9, d = (o) => Object.assign({ sonGecis: T - 10 * DK, sonOdullu: -Infinity, sayac: 4 }, o);
  const k = (dd, b, noads, simdi) => R.gecisKarari(d(dd), b, simdi === undefined ? T : simdi, !!noads);
  assert.strictEqual(k({}, { oyun: 'kacis', bolum: 3 }), '');
  assert.strictEqual(k({}, { oyun: 'ss', bolum: 50 }), '');
  assert.strictEqual(k({}, { oyun: 'kacis', bolum: 3 }, true), 'noads');
  assert.strictEqual(k({}, { oyun: 'h2048', bolum: 9 }), 'oyun');
  assert.strictEqual(k({}, { oyun: 'tempo', bolum: 9 }), 'oyun');
  assert.strictEqual(k({}, { oyun: 'ates', bolum: 9 }), 'oyun');
  assert.strictEqual(k({}, { oyun: 'sso', bolum: 9 }), 'oyun');
  assert.strictEqual(k({}, null), 'oyun');
  assert.strictEqual(k({}, { oyun: 'kacis', bolum: 1 }), 'ilkBolum');
  assert.strictEqual(k({}, { oyun: 'ss', bolum: 2 }), 'ilkBolum');
  assert.strictEqual(k({}, { oyun: 'kacis', bolum: 'o5' }), 'ilkBolum');
  assert.strictEqual(k({}, { oyun: 'kacis', bolum: NaN }), 'ilkBolum');
  assert.strictEqual(k({}, { oyun: 'kacis' }), 'ilkBolum');
  assert.strictEqual(k({ sayac: 3 }, { oyun: 'kacis', bolum: 5 }), 'sayac');
  assert.strictEqual(k({ sonOdullu: T - 2 * DK }, { oyun: 'kacis', bolum: 5 }), 'odullu');
  assert.strictEqual(k({ sonOdullu: T - 3 * DK }, { oyun: 'kacis', bolum: 5 }), '');
  assert.strictEqual(k({ sonGecis: T - 3 * DK + 1 }, { oyun: 'kacis', bolum: 5 }), 'aralik');
  assert.strictEqual(k({ sonGecis: T - 3 * DK }, { oyun: 'kacis', bolum: 5 }), '');
});

dene('gecis akisi: acilistan 3 dk ve 4 bolum gerekir; gosterince sayac sifirlanir', async () => {
  const { R, saat } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  const t0 = saat.t;
  for (let b = 1; b <= 3; b++) R.bolumTamamlandi({ oyun: 'kacis', bolum: b });
  saat.t = t0 + 5 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 3 })).neden, 'sayac');   // 3 bolum
  R.bolumTamamlandi({ oyun: 'kacis', bolum: 4 });
  saat.t = t0 + 2 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 4 })).neden, 'aralik');  // ilk acilistan 2 dk
  saat.t = t0 + 3 * DK;
  assert.deepStrictEqual(kopya(await R.gecisGoster({ oyun: 'kacis', bolum: 4 })), { gosterildi: true, neden: '' });
  assert.strictEqual(R._durum().sayac, 0);
  assert.strictEqual(R._durum().sonGecis, t0 + 3 * DK);
  // hemen ardindan: sayac 0
  for (let b = 5; b <= 8; b++) R.bolumTamamlandi({ oyun: 'kacis', bolum: b });
  saat.t = t0 + 5 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 8 })).neden, 'aralik');
  saat.t = t0 + 6 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 8 })).gosterildi, true);
  assert.strictEqual(s.gecisSayac, 2);
});

dene('gecis: iki oyun birlikte sayilir, diger oyunlar sayilmaz', async () => {
  const { R, saat } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  R.bolumTamamlandi({ oyun: 'kacis', bolum: 10 });
  R.bolumTamamlandi({ oyun: 'ss', bolum: 20 });
  R.bolumTamamlandi({ oyun: 'h2048', bolum: 1 });
  R.bolumTamamlandi({ oyun: 'tempo' });
  R.bolumTamamlandi(null);
  assert.strictEqual(R._durum().sayac, 2);
  R.bolumTamamlandi({ oyun: 'ss', bolum: 21 });
  R.bolumTamamlandi({ oyun: 'kacis', bolum: 11 });
  saat.t += 4 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'ss', bolum: 21 })).gosterildi, true);
});

dene('gecis: 1-2. bolumden sonra yok (sayac yetse bile), sayac korunur', async () => {
  const { R, saat } = reklamKur();
  R._saglayiciAyarla(saglayiciYap());
  for (let i = 0; i < 6; i++) R.bolumTamamlandi({ oyun: 'ss', bolum: 1 + (i % 2) });
  saat.t += 10 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'ss', bolum: 1 })).neden, 'ilkBolum');
  assert.strictEqual((await R.gecisGoster({ oyun: 'ss', bolum: 2 })).neden, 'ilkBolum');
  assert.strictEqual(R._durum().sayac, 6);
  assert.strictEqual((await R.gecisGoster({ oyun: 'ss', bolum: 3 })).gosterildi, true);
});

dene('gecis: odullu reklamdan (odulsuz kapatilsa da) sonra 3 dk yok', async () => {
  const { R, saat } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  for (let i = 0; i < 8; i++) R.bolumTamamlandi({ oyun: 'kacis', bolum: 10 + i });
  saat.t += 20 * DK;
  s.sonuc = false;
  await R.odulluGoster('ipucu_joker');
  const t = saat.t;
  saat.t = t + 2 * DK + 59 * 1000;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 17 })).neden, 'odullu');
  saat.t = t + 3 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 17 })).gosterildi, true);
});

dene('gecis: hazir degilse gosterilmez, sayac korunur, sonra gosterilir', async () => {
  const { R, saat } = reklamKur();
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  for (let i = 0; i < 4; i++) R.bolumTamamlandi({ oyun: 'kacis', bolum: 5 + i });
  saat.t += 4 * DK;
  s.hazir = false;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 8 })).neden, 'hazirDegil');
  assert.strictEqual(R._durum().sayac, 4);
  s.hazir = true;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 8 })).gosterildi, true);
});

dene('NO ADS: gecis hic yok; odullu reklamlar yine calisir', async () => {
  const { R, saat } = reklamKur({ depo: { ait_noads: true } });
  const s = saglayiciYap(); R._saglayiciAyarla(s);
  for (let i = 0; i < 10; i++) R.bolumTamamlandi({ oyun: 'kacis', bolum: 10 + i });
  saat.t += 60 * DK;
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 19 })).neden, 'noads');
  assert.strictEqual(s.gecisSayac, 0);
  assert.strictEqual(R.dugmeDurumu('ikinci_sans'), 'hazir');
  assert.deepStrictEqual(kopya(await R.odulluGoster('ikinci_sans')), { odul: true });
});

dene('yeni oturum: sayac 0, acilis ani son gecis sayilir (ilk acilista asla)', async () => {
  const { R, saat } = reklamKur();
  R._saglayiciAyarla(saglayiciYap());
  assert.strictEqual(R._durum().sayac, 0);
  assert.strictEqual(R._durum().sonGecis, saat.t);
  assert.strictEqual((await R.gecisGoster({ oyun: 'kacis', bolum: 40 })).gosterildi, false);
});

// =================================================================
denemeler.push(['market reklam odulleri']);

const GUN = (g, sa, dk) => new Date(2026, 10, g, sa, dk || 0).getTime();

dene('eski kayit (ri dolu, h eski gun, yeni alanlar yok): bozulmaz, varsayilanlar gelir', () => {
  const eski = { surum: 2, s: ['buz'], a: 'buz', ri: ['lav', 'buz'], v: { g: '', i: [] }, h: '2026-11-13' };
  const { M, win, yazimlar } = marketKur({ ilerleme: { gold: 500, market: kopya(eski) } });
  const m = win.AppProgress.market;
  assert.deepStrictEqual(kopya(m.s), ['buz']);
  assert.strictEqual(m.a, 'buz');
  assert.strictEqual(m.h, '2026-11-13');
  assert.deepStrictEqual(kopya(m.ri), []);
  assert.deepStrictEqual(kopya(m.ra), { g: '', n: 0 });
  assert.strictEqual(m.ig, '');
  assert.strictEqual(m.ih, 0);
  assert.strictEqual(win.AppProgress.gold, 500);
  assert.strictEqual(yazimlar.length, 0, 'surum ayni: acilista diske yazilmaz');
  assert.strictEqual(M.hediyeHazirMi(), true);
  assert.strictEqual(M.altinReklamKalan(), 3);
  assert.strictEqual(M.indirimHakkiVar(), false);
  // eski ri artik indirim saymaz
  M.temalar().forEach(t => assert.strictEqual(M.fiyat(t.id), M.temelFiyat(t.id)));
});

dene('surum 1 kaydi (ri dolu): goc ri tasimaz, sahiplik korunur', () => {
  const { win } = marketKur({ ilerleme: { gold: 0, market: { s: ['kacis.deri.buz'], ri: ['kacis.deri.lav'], a: { kacis: 'kacis.deri.buz' }, h: '2026-11-01' } } });
  const m = win.AppProgress.market;
  assert.strictEqual(m.surum, 2);
  assert.deepStrictEqual(kopya(m.s), ['buz']);
  assert.deepStrictEqual(kopya(m.ri), []);
  assert.strictEqual(m.h, '2026-11-01');
  assert.strictEqual(m.ih, 0);
});

dene('bozuk opsiyonel alanlar onarilir', () => {
  [[{ ra: 'x', ig: 5, ih: 'evet' }], [{ ra: { g: 3, n: 1 } }], [{ ra: { g: '2026-11-23', n: -2 } }], [{ ra: { g: '2026-11-23', n: NaN } }], [{ ra: null, ih: 2 }]]
    .forEach(([ek]) => {
      const { win } = marketKur({ ilerleme: { gold: 0, market: Object.assign({ surum: 2, s: [], a: 'varsayilan', ri: [], v: { g: '', i: [] }, h: '' }, ek) } });
      const m = win.AppProgress.market;
      assert.deepStrictEqual(kopya(m.ra), { g: '', n: 0 }, JSON.stringify(ek));
      assert.strictEqual(typeof m.ig, 'string');
      assert.strictEqual(m.ih, 0);
    });
});

dene('+200 altin: gunde 3 kez, 4. reddedilir; sayac + altin tek yazimda', async () => {
  const { M, win, yazimlar, reklam } = marketKur({ altin: 100 });
  for (let i = 1; i <= 3; i++) {
    const n = yazimlar.length;
    assert.deepStrictEqual(kopya(await M.altinReklamIzle()), { odul: true, altin: 200 });
    assert.strictEqual(yazimlar.length, n + 1, 'tek yazim');
    const y = yazimlar[yazimlar.length - 1];
    assert.strictEqual(y.gold, 100 + 200 * i);
    assert.deepStrictEqual(y.market.ra, { g: '2026-11-23', n: i });
    assert.strictEqual(M.altinReklamIzlenen(), i);
  }
  assert.strictEqual(reklam.sonBirim, 'altin_x2');
  assert.strictEqual(M.altinReklamKalan(), 0);
  assert.deepStrictEqual(kopya(await M.altinReklamIzle()), { odul: false, altin: 0 });
  assert.strictEqual(reklam.sayac, 3, '4. reklam hic acilmaz');
  assert.strictEqual(win.AppProgress.gold, 700);
});

dene('+200 altin: odulsuz kapatilirsa altin ve sayac degismez', async () => {
  const { M, win, reklam, yazimlar } = marketKur({ altin: 0 });
  reklam.sonuc = false;
  assert.deepStrictEqual(kopya(await M.altinReklamIzle()), { odul: false, altin: 0 });
  assert.strictEqual(win.AppProgress.gold, 0);
  assert.strictEqual(M.altinReklamIzlenen(), 0);
  assert.strictEqual(yazimlar.length, 0);
});

dene('+200 altin: destek yok (gizli) / hazir degil (pasif) -> reklam acilmaz', async () => {
  for (const d of ['gizli', 'pasif']) {
    const { M, win, reklam } = marketKur({ altin: 0, reklamDurum: d });
    assert.strictEqual(M.reklamDurumu(), d);
    assert.strictEqual(M.reklamVarMi(), d !== 'gizli');
    assert.strictEqual((await M.altinReklamIzle()).odul, false);
    assert.strictEqual((await M.indirimReklamIzle()).odul, false);
    assert.strictEqual(reklam.sayac, 0);
    assert.strictEqual(win.AppProgress.gold, 0);
  }
  const { M } = marketKur({ reklamYok: true });   // reklam.js hic yuklenmemis
  assert.strictEqual(M.reklamDurumu(), 'gizli');
  assert.strictEqual(M.reklamVarMi(), false);
  assert.strictEqual((await M.altinReklamIzle()).odul, false);
});

dene('gun donumu: gece yarisindan sonra sayac sifirlanir (yerel tarih)', async () => {
  const saat = saatKur(GUN(23, 23, 50));
  const { M, win } = marketKur({ altin: 0, saat });
  for (let i = 0; i < 3; i++) await M.altinReklamIzle();
  assert.strictEqual(M.altinReklamKalan(), 0);
  saat.t = GUN(23, 23, 59);
  assert.strictEqual(M.altinReklamKalan(), 0);
  saat.t = GUN(24, 0, 1);
  assert.strictEqual(M.altinReklamIzlenen(), 0);
  assert.strictEqual(M.altinReklamKalan(), 3);
  assert.strictEqual((await M.altinReklamIzle()).odul, true);
  assert.deepStrictEqual(kopya(win.AppProgress.market.ra), { g: '2026-11-24', n: 1 });
  assert.strictEqual(win.AppProgress.gold, 800);
});

dene('kayit diske yazilip yeniden acilinca sayaclar korunur', async () => {
  const saat = saatKur(GUN(23, 12));
  const a = marketKur({ altin: 0, saat });
  await a.M.altinReklamIzle(); await a.M.altinReklamIzle(); await a.M.indirimReklamIzle();
  const b = marketKur({ ilerleme: kopya(a.win.AppProgress), saat });
  assert.strictEqual(b.M.altinReklamIzlenen(), 2);
  assert.strictEqual(b.M.indirimHakkiVar(), true);
  assert.strictEqual(b.M.indirimReklamBugunIzlendi(), true);
  assert.strictEqual(b.win.AppProgress.gold, 400);
});

dene('%20 indirim: gunde 1 kez; tek hak birikir; hak varken ertesi gun de izlenemez', async () => {
  const saat = saatKur(GUN(23, 9));
  const { M, reklam } = marketKur({ altin: 0, saat });
  assert.strictEqual(M.indirimReklamUygunMu(), true);
  assert.deepStrictEqual(kopya(await M.indirimReklamIzle()), { odul: true });
  assert.strictEqual(M.indirimHakkiVar(), true);
  assert.strictEqual(M.indirimReklamUygunMu(), false);
  assert.strictEqual((await M.indirimReklamIzle()).odul, false);
  saat.t = GUN(25, 9);                                   // iki gun sonra, hak kullanilmadi
  assert.strictEqual(M.indirimHakkiVar(), true, 'gun dolumu yok');
  assert.strictEqual(M.indirimReklamUygunMu(), false, 'ayni anda tek hak');
  assert.strictEqual((await M.indirimReklamIzle()).odul, false);
  assert.strictEqual(reklam.sayac, 1);
});

dene('%20 indirim: odulsuz kapatilirsa hak yok, ayni gun yeniden denenebilir', async () => {
  const { M, reklam } = marketKur({ altin: 0 });
  reklam.sonuc = false;
  assert.strictEqual((await M.indirimReklamIzle()).odul, false);
  assert.strictEqual(M.indirimHakkiVar(), false);
  assert.strictEqual(M.indirimReklamUygunMu(), true);
  reklam.sonuc = true;
  assert.strictEqual((await M.indirimReklamIzle()).odul, true);
});

dene('%20 indirim: tema fiyati x0.8, satin almada tukenir, sonra tam fiyat', async () => {
  const saat = saatKur(GUN(23, 9));
  const { M, win } = marketKur({ altin: 100000, saat });
  const tema = M.temalar().find(t => !t.varsayilan && t.nadirlik === 'nadir');
  const diger = M.temalar().find(t => !t.varsayilan && t.nadirlik === 'ender');
  assert.strictEqual(M.fiyat(tema.id), 1800);
  await M.indirimReklamIzle();
  assert.strictEqual(M.temelFiyat(tema.id), 1800);
  assert.strictEqual(M.fiyat(tema.id), 1440);
  assert.strictEqual(M.indirimliMi(tema.id), true);
  assert.strictEqual(M.fiyat(diger.id), 3200);
  assert.strictEqual(M.sandikFiyat('gumus'), 800);
  assert.strictEqual(M.sandikFiyat('altin'), 2800);
  assert.strictEqual(M.sandikTemelFiyat('altin'), 3500);
  assert.strictEqual(M.fiyat('varsayilan'), 0);
  assert.strictEqual(M.indirimliMi('varsayilan'), false);
  assert.strictEqual(M.satinAl(tema.id), true);
  assert.strictEqual(win.AppProgress.gold, 100000 - 1440);
  assert.strictEqual(M.indirimHakkiVar(), false);
  assert.strictEqual(win.AppProgress.market.ih, 0);
  assert.strictEqual(M.fiyat(diger.id), 4000);
  assert.strictEqual(M.sandikFiyat('gumus'), 1000);
  assert.strictEqual(M.indirimliMi(tema.id), false);
  // ayni gun yeniden izlenemez, ertesi gun izlenebilir
  assert.strictEqual(M.indirimReklamUygunMu(), false);
  saat.t = GUN(24, 0, 0);
  assert.strictEqual(M.indirimReklamUygunMu(), true);
});

dene('%20 indirim: kutu alisinda tukenir (once kutu)', async () => {
  const { M, win } = marketKur({ altin: 5000 });
  await M.indirimReklamIzle();
  const r = M.sandikAc('altin');
  assert.strictEqual(r.tur, 'tema');
  assert.strictEqual(win.AppProgress.gold, 5000 - 2800);
  assert.strictEqual(M.indirimHakkiVar(), false);
  assert.strictEqual(M.sandikFiyat('altin'), 3500);
});

dene('%20 indirim: jeton yetmezse / kutu kapaliysa hak kalir', async () => {
  const { M, win } = marketKur({ altin: 700 });
  await M.indirimReklamIzle();
  const tema = M.temalar().find(t => !t.varsayilan && t.nadirlik === 'siradan');
  assert.strictEqual(M.fiyat(tema.id), 640);
  win.AppProgress.gold = 600;
  assert.strictEqual(M.satinAl(tema.id), false);
  assert.strictEqual(M.sandikAc('gumus'), null);    // 800 gerekir
  assert.strictEqual(M.indirimHakkiVar(), true);
  assert.strictEqual(win.AppProgress.gold, 600);
  win.AppProgress.gold = 640;
  assert.strictEqual(M.satinAl(tema.id), true);
  assert.strictEqual(win.AppProgress.gold, 0);
  assert.strictEqual(M.indirimHakkiVar(), false);
});

dene('gunluk hediye her zaman reklamsiz (destek varken de reklam acilmaz)', () => {
  const { M, reklam, win } = marketKur({ altin: 0 });
  let odul;
  M.hediyeAl(o => { odul = o; });
  assert.ok(odul && odul.jeton >= 150 && odul.jeton <= 400);
  assert.strictEqual(reklam.sayac, 0);
  assert.strictEqual(win.AppProgress.gold, odul.jeton);
  assert.strictEqual(M.hediyeHazirMi(), false);
  let ikinci = 'yok';
  M.hediyeAl(o => { ikinci = o; });
  assert.strictEqual(ikinci, null);
});

dene('"Ilerlemeyi Sifirla": market kaydi varsayilana doner (sayac + hak sifir)', async () => {
  const { M, win, ctx } = marketKur({ altin: 0 });
  await M.altinReklamIzle(); await M.indirimReklamIzle();
  // core.js resetBtn: AppProgress = varsayilanIlerleme() (market alani yok) + AppReset
  win.AppProgress = icindeKur(ctx, { surum: 3, gold: 0 });
  win.AppReset.forEach(fn => fn());
  const m = win.AppProgress.market;
  assert.deepStrictEqual(kopya(m.ra), { g: '', n: 0 });
  assert.strictEqual(m.ih, 0);
  assert.strictEqual(m.ig, '');
  assert.strictEqual(M.altinReklamKalan(), 3);
  assert.strictEqual(M.indirimHakkiVar(), false);
  assert.strictEqual(M.indirimReklamUygunMu(), true);
});

// ---- calistir ----
(async () => {
  let gecti = 0;
  for (const [ad, fn] of denemeler) {
    if (!fn) { console.log(ad); continue; }
    try { await fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.message)); process.exitCode = 1; }
  }
  console.log(gecti + '/' + denemeler.filter(d => d[1]).length + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
})();
