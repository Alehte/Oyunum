// atesBocegiOyunTest.js — js/atesBocegiOyun.js'i sahte DOM/canvas ile dener (gorsel dogrulamaz).
// Kapsam: tek odeme, gun degisimi, yarim kosu odemez, sifirla, offstage'de rAF durur,
// olum sonrasi zamanlayici ekran kapaninca iptal, bozuk/yeni surum kaydi, ilk kosuda rekor yok.
// Calistirma:  node tools/atesBocegiOyunTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const AB = require(path.join(__dirname, '..', 'js', 'atesBocegi.js'));
const KAYNAK = fs.readFileSync(path.join(__dirname, '..', 'js', 'atesBocegiOyun.js'), 'utf8');

function ortam() {
  const o = { rafF: null, zamanlayicilar: [], goldAdd: [], yazim: 0, durum: null, t: 0, basili: false, ses: 0 };
  const proxyCtx = () => new Proxy({}, {
    get(h, k) { if (k in h) return h[k]; return (...a) => (/Gradient/.test(k) ? { addColorStop() {} } : undefined); },
    set(h, k, v) { h[k] = v; return true; }
  });
  const els = {};
  const el = id => els[id] || (els[id] = (() => {
    const dinle = {}, cl = new Set();
    return { id, style: { setProperty() {} }, dinle, cl,
      classList: { add: c => cl.add(c), remove: c => cl.delete(c), contains: c => cl.has(c), toggle: (c, f) => (f ? cl.add(c) : cl.delete(c)) },
      addEventListener(t, f) { dinle[t] = f; }, setAttribute() {},
      getBoundingClientRect() { return { width: 360, height: 560, left: 0, top: 0 }; },
      getContext: proxyCtx, setPointerCapture() {},
      parentNode: { classList: { toggle() {}, remove() {} }, setAttribute() {} },
      click() { if (dinle.click) dinle.click(); }, textContent: '', innerHTML: '', width: 0, height: 0 };
  })());
  ['screen-ates', 'abAlan', 'abTuval', 'abPuan', 'abRekor', 'abCarpan', 'abIsik', 'abIpucu', 'abDuraklat', 'abSonuc', 'abSonBaslik',
    'abSonAlt', 'abDurBtn', 'abDevam', 'abYeniden', 'abTekrar', 'abAna', 'atesBackBtn'].forEach(el);
  const AB2 = Object.assign({}, AB, { oyunOlustur(t) { o.durum = AB.oyunOlustur(t); return o.durum; } });
  const sb = {
    console, Math, Date, Float32Array, Array, Number, String, JSON, parseInt, isFinite, Object, Promise,
    document: { getElementById: el, createElement: () => el('c' + Math.random()), querySelector: () => null, addEventListener() {}, hidden: false },
    AtesBocegi: AB2, devicePixelRatio: 2, addEventListener() {},
    requestAnimationFrame: f => { o.rafF = f; return 1; }, cancelAnimationFrame() { o.rafF = null; },
    setTimeout: f => { o.zamanlayicilar.push(f); return o.zamanlayicilar.length; },
    matchMedia: () => ({ matches: false }), CoinSVG: () => '<img>',
    AppProgress: { surum: 3, gold: 10, atesBocegi: null },
    AppFX: { tone() { o.ses++; }, seq() { o.ses++; }, vibrate() {} }
  };
  sb.AppSaveProgress = p => { Object.assign(sb.AppProgress, p); o.yazim++; };
  sb.AppGold = { add(n) { sb.AppProgress.gold += n; o.goldAdd.push(n); o.yazim++; } };
  sb.window = sb;
  vm.runInNewContext(KAYNAK, sb);
  o.sb = sb; o.O = sb.AtesBocegiOyun; o.el = el;
  o.kare = n => { for (let i = 0; i < n && o.rafF; i++) { o.t += 1000 / 60; const f = o.rafF; o.rafF = null; f(o.t); } };
  o.bas = () => { o.el('abTuval').dinle.pointerdown({ preventDefault() {}, pointerId: 1 }); o.basili = true; };
  o.birak = () => { o.el('abTuval').dinle.pointerup({}); o.basili = false; };
  o.yeni = () => { o.O.start(); o.bas(); o.kare(2); };
  o.olum = (puan, toz) => {
    o.durum.puan = puan; o.durum.toz = toz; o.durum.isik = 0.0001; o.durum.dokunulmaz = 0;
    o.kare(10);
  };
  o.zamanlayicilariCalistir = () => { const l = o.zamanlayicilar.splice(0); l.forEach(f => f()); };
  return o;
}

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}
const bugun = () => { const d = new Date(), a = d.getMonth() + 1, g = d.getDate(); return d.getFullYear() + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g; };

console.log('atesBocegiOyun (sahte DOM)');

dene('API: start, dur, temaDegisti, sifirla', () => {
  const o = ortam();
  ['start', 'dur', 'temaDegisti', 'sifirla'].forEach(k => assert.strictEqual(typeof o.O[k], 'function', k));
});

dene('bekleme: ilk basisa kadar adim yok; 600 kare calisir', () => {
  const o = ortam(); o.O.start(); o.kare(5);
  assert.strictEqual(o.durum.t, 0);
  o.bas(); o.kare(600); assert.ok(o.durum.t > 0.5);
});

dene('kosu sonu: kayit + jeton TEK yazimda, tek kez odenir', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30);
  const ab = o.sb.AppProgress.atesBocegi;
  assert.deepStrictEqual({ r: ab.rekor, k: ab.kosu, g: ab.gunJeton, gun: ab.gun }, { r: 2600, k: 1, g: 17, gun: bugun() });
  assert.deepStrictEqual(o.goldAdd, [92]);          // 17 kosu + 25 + 50 esik
  assert.strictEqual(o.sb.AppProgress.gold, 102);
  assert.strictEqual(o.yazim, 1);
  o.kare(10); o.zamanlayicilariCalistir();
  assert.strictEqual(o.goldAdd.length, 1);
  assert.ok(o.el('abSonuc').cl.has('show'));
});

dene('ikinci kosu: rekor altinda yalniz kosu jetonu, gunJeton birikir', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30); o.zamanlayicilariCalistir();
  o.el('abTekrar').dinle.click(); assert.ok(!o.el('abSonuc').cl.has('show'));
  o.yeni(); o.olum(1500, 12);
  const ab = o.sb.AppProgress.atesBocegi;
  assert.deepStrictEqual(o.goldAdd, [92, 10]); assert.strictEqual(ab.gunJeton, 27); assert.strictEqual(ab.kosu, 2); assert.strictEqual(ab.rekor, 2600);
});

dene('gun degisimi: eski gunun gunJeton degeri sayilmaz', () => {
  const o = ortam(); o.sb.AppProgress.atesBocegi = { rekor: 5000, kosu: 3, gun: '2000-01-01', gunJeton: 500 };
  o.yeni(); o.olum(1500, 12);
  const ab = o.sb.AppProgress.atesBocegi;
  assert.deepStrictEqual(o.goldAdd, [10]); assert.strictEqual(ab.gunJeton, 10); assert.strictEqual(ab.gun, bugun());
});

dene('gunluk sinir: gunJeton 190 + ham 24 -> 13 jeton', () => {
  const o = ortam(); o.sb.AppProgress.atesBocegi = { rekor: 99999, kosu: 3, gun: bugun(), gunJeton: 190 };
  o.yeni(); o.olum(3600, 20);
  assert.deepStrictEqual(o.goldAdd, [13]); assert.strictEqual(o.sb.AppProgress.atesBocegi.gunJeton, 214);
});

dene('bozuk kayit (null, bozuk alt alanlar) onarilir', () => {
  let o = ortam(); o.sb.AppProgress.atesBocegi = null; o.yeni(); o.olum(10, 0);
  assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 1);
  o = ortam(); o.sb.AppProgress.atesBocegi = { rekor: 'x', kosu: -3, gun: 5, gunJeton: NaN }; o.yeni(); o.olum(3000, 20);
  const ab = o.sb.AppProgress.atesBocegi;
  assert.deepStrictEqual({ r: ab.rekor, k: ab.kosu, gun: ab.gun }, { r: 3000, k: 1, gun: bugun() });
});

dene('yarim kosu odeme yapmaz (dur), rAF durur', () => {
  const o = ortam(); o.yeni(); o.kare(60); o.O.dur();
  assert.strictEqual(o.goldAdd.length, 0); assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 0); assert.strictEqual(o.yazim, 0); assert.strictEqual(o.rafF, null);
});

dene('sifirla: kosu atilir, rAF durur, sonra odeme yok', () => {
  const o = ortam(); o.yeni(); o.kare(30); o.O.sifirla();
  assert.strictEqual(o.rafF, null); o.zamanlayicilariCalistir(); assert.strictEqual(o.goldAdd.length, 0);
});

dene('offstage: rAF durur, girdi bos', () => {
  const o = ortam(); o.yeni(); o.kare(30);
  o.el('screen-ates').cl.add('offstage');
  o.rafF && o.kare(1);
  assert.strictEqual(o.rafF, null);
  o.el('abTuval').dinle.pointerdown({ preventDefault() {}, pointerId: 3 });   // aktifMi false: yutulur
});

dene('olum sonrasi zamanlayici ekran kapaninca iptal: kart ve ses yok', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30);
  assert.strictEqual(o.goldAdd.length, 1);           // odeme olumde yapildi
  o.el('screen-ates').cl.add('offstage');
  const ses = o.ses; o.zamanlayicilariCalistir();
  assert.ok(!o.el('abSonuc').cl.has('show')); assert.strictEqual(o.ses, ses); assert.strictEqual(o.rafF, null);
});

dene('dur() sonrasi bekleyen zamanlayici kart basmaz', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30); o.O.dur();
  o.zamanlayicilariCalistir(); assert.ok(!o.el('abSonuc').cl.has('show'));
});

dene('daha yeni kayit surumu (4): kayit/odeme yok, atesBocegi dokunulmaz', () => {
  const o = ortam(); o.sb.AppProgress.surum = 4; o.sb.AppProgress.atesBocegi = 'baska';
  o.yeni(); o.olum(2600, 30);
  assert.strictEqual(o.goldAdd.length, 0); assert.strictEqual(o.yazim, 0); assert.strictEqual(o.sb.AppProgress.atesBocegi, 'baska');
});

dene('AppGold yoksa jetonluysa bile kayit yazilir (AppSaveProgress)', () => {
  const o = ortam(); o.sb.AppGold = undefined; o.yeni(); o.olum(2600, 30);
  assert.strictEqual(o.sb.AppProgress.atesBocegi.rekor, 2600); assert.strictEqual(o.yazim, 1);
});

dene('ilk kosuda "Yeni Rekor" yok; sonraki rekor kirilinca var', () => {
  const o = ortam(); o.yeni(); o.olum(500, 5); o.zamanlayicilariCalistir();
  assert.ok(!/Rekor!/.test(o.el('abSonBaslik').innerHTML));
  o.el('abTekrar').dinle.click(); o.yeni(); o.olum(900, 5); o.zamanlayicilariCalistir();
  assert.ok(/Rekor!/.test(o.el('abSonBaslik').innerHTML));
});

dene('temaDegisti: bozuk isikCoz cikmaz, paletler cizilir', () => {
  const o = ortam(); o.yeni();
  for (const sk of ['cizgi', 'damla', 'baklava', 'akkor']) {
    o.sb.AppMarket = { aktif: () => ({}), isikCoz: () => ({ isik: '#FFA64A', toz: '#FFD98A', vurgu: '#7CF0A0', karanlik: '#120604', iz: { renk: '#FF6A2A', renk2: '#FFD07A', sekil: sk }, animasyon: 'lav' }) };
    o.O.temaDegisti(); o.kare(120);
  }
  o.sb.AppMarket.isikCoz = () => { throw new Error('bozuk'); }; o.O.temaDegisti(); o.kare(5);
});

dene('gercek market.js + katalog: 10 temanin palet sonucu isikCoz ile birebir (paletOku/paletTamamla)', () => {
  const oku = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  const win = { AppProgress: { gold: 0 }, AppGold: { harca() { return true; }, add() {} }, AppStore: { get: (k, v) => v, set() {} },
    AppSaveProgress() {}, AppReset: [], addEventListener() {}, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } };
  win.window = win; vm.createContext(win);
  vm.runInContext(oku('marketKatalog.js'), win); vm.runInContext(oku('market.js'), win);
  const a = KAYNAK.indexOf('  var YERLESIK = {'), qi = KAYNAK.indexOf('  function q(id)', a);
  const h = KAYNAK.indexOf('  function hexMi'), pt = KAYNAK.indexOf('  function paletTamamla'), c = KAYNAK.indexOf('  // ONBELLEKLI GORSELLER');
  assert(a > 0 && qi > a && h > 0 && pt > 0 && c > pt, 'oyun palet kodu bulunamadi');
  const kod = KAYNAK.slice(a, qi) + KAYNAK.slice(h, KAYNAK.indexOf('\n', h) + 1) + KAYNAK.slice(pt, c);
  const M = win.AppMarket, temalar = M.temalar();
  assert.strictEqual(temalar.length, 10);
  temalar.forEach(t => {
    win.AppProgress.market.s.push(t.id); assert(M.sec(t.id), t.id);
    const ic = { window: win, AppMarket: M };
    vm.runInNewContext(kod + '\nthis.p = paletOku();', ic);
    const beklenen = M.isikCoz(M.aktif('ates', 'isik')), p = JSON.parse(JSON.stringify(ic.p));
    ['isik', 'toz', 'vurgu', 'karanlik', 'animasyon'].forEach(k => assert.strictEqual(p[k], beklenen[k], t.id + '.' + k));
    assert.strictEqual(p.iz.sekil, beklenen.iz.sekil, t.id + ' sekil');
    assert.strictEqual(p.iz.renk, beklenen.iz.renk, t.id + ' renk');
    assert.strictEqual(p.iz.renk2, beklenen.iz.renk2, t.id + ' renk2');
    assert.deepStrictEqual(p.iz.renkler, Array.from(beklenen.iz.renkler || [beklenen.iz.renk, beklenen.iz.renk2]), t.id + ' renkler');
    if (t.isik && t.isik.iz && t.isik.iz.renkler) assert.deepStrictEqual(p.iz.renkler, Array.from(t.isik.iz.renkler), t.id + ' vitray renkler');
  });
});

console.log(gecti + ' deneme gecti');
