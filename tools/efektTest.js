// efektTest.js — ortak efekt modulu (js/efekt.js) ve oyunlardaki rekor / hedef kutlamasi (docs/gorev-performans-efekt-suzul.md FAZ 2).
// Calistirma:  node tools/efektTest.js                 (birim denemeleri + headless Chrome entegrasyonu; Chrome yoksa ATLANDI)
//              node tools/efektTest.js --ekran DIZIN   (ek: uc kalite seviyesinde ekran goruntuleri DIZIN'e)
//              node tools/efektTest.js --birim         (yalniz birim denemeleri; Chrome gerekmez)
// Birim (sahte pencere + gercek js/kalite.js): havuz ust siniri seviye basina (yuksek 120, orta 60, dusuk 20; Kalite.parcacikSayisi),
//   bitince rAF durur ve tuval gizlenir, dusuk kalitede ve azaltilmis harekette titreme yerine parlama, konfeti kisa/az, sayfa
//   gizlenince her sey biter, DPR tavani, Kalite yoksa varsayilan, efekt Math.random cagirmaz, kare dongusunde bellek ayirma yok,
//   rekorIzci (kosu basina 1, eski rekor 0 ise yok, ikinci sans sonrasi tekrar yok, kaldigi yerden devam), sonuc konfetisi oncelikli
//   (dusukte havuz doluyken > 0), renk tablosu tasinca canli parcacik rengi ayni, tuval olcusu efekt basinda / boyut degisince.
// Entegrasyon (gercek index.html, ?kalite=yuksek|orta|dusuk): 2048 hedef karo kutlamasi (pencere zamani ayni), 2048 rekor ani (bir kez),
//   2048 kayip ekrani + ikinci sans teklifi (teklif acikken sonuc efekti yok; ayni oturumda devam: kosu basi rekor bellekte,
//   diskten devam / eski rekor 0: "Yeni Rekor!" yok), rekor ani + ayni hamlede kayip (sonuc konfetisi > 0), ekrandan cikinca efekt
//   biter, gecikmeli kutlama / teklif sonucu ekran disinda efekt baslatmaz (2048, Tempo, Suzul), Tempo rekor ani (titreme suruklemeyi kaydirmaz, bir kez),
//   Tempo oyun sonu (teklif sirasinda efekt yok, reddedince "Yeni Rekor!" + sayac), Suzul rekor ani + ikinci sans (tekrar yok) + sonuc,
//   efekt sirasinda Math.random cagrilmaz, tuval dokunmayi yutmaz.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), cp = require('child_process'), os = require('os'), http = require('http');
const KOK = path.join(__dirname, '..');
const oku = f => fs.readFileSync(path.join(KOK, f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ARG = process.argv.slice(2);
const EKRAN = ARG.indexOf('--ekran') >= 0 ? ARG[ARG.indexOf('--ekran') + 1] : null;
const YALNIZ_BIRIM = ARG.indexOf('--birim') >= 0;

let gecti = 0, atlandi = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.stack || e)); process.exitCode = 1; }
}
async function deneA(ad, fn) {
  try { await fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.stack || e)); process.exitCode = 1; }
}

const EFEKT = oku('js/efekt.js'), KALITE = oku('js/kalite.js'), CSS = oku('style.css');

// ---------------------------------------------------------------
// SAHTE PENCERE (efekt.js + istege bagli gercek kalite.js)
// o: { kalite: 'yuksek'|'orta'|'dusuk'|null (null: Kalite yuklenmez), azalt: .phone.reduced-motion, telefonYok, mm: matchMedia sonucu }
// ---------------------------------------------------------------
function ortam(o) {
  o = o || {};
  const raf = [], anim = [], zaman = [], dinle = {}, wdinle = {}, boya = [];
  let rafNo = 0, simdi = 1000;
  function El(tag, sinif) {
    const s = new Set(sinif || []);
    const e = {
      tagName: tag, style: {}, children: [], textContent: '', attr: {},
      classList: { add: (...a) => a.forEach(x => s.add(x)), remove: (...a) => a.forEach(x => s.delete(x)), contains: x => s.has(x),
                   toggle: (x, f) => { if (f === undefined) f = !s.has(x); if (f) s.add(x); else s.delete(x); return f; } },
      _s: s,
      setAttribute(k, v) { this.attr[k] = v; },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      getBoundingClientRect: () => ({ left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 }),
      animate(k, a) { anim.push({ el: e, k, a }); return { cancel() {} }; },
      clientWidth: 390, clientHeight: 844, clientLeft: 0, clientTop: 0
    };
    Object.defineProperty(e, 'className', { get: () => Array.from(s).join(' '), set: v => { s.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => s.add(x)); } });
    return e;
  }
  const cagri = { fillRect: 0, clearRect: 0, arc: 0, setTransform: 0 };
  const ctx = { setTransform() { cagri.setTransform++; }, clearRect() { cagri.clearRect++; }, fillRect() { cagri.fillRect++; },
                beginPath() {}, arc() { cagri.arc++; }, stroke() {}, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  ctx.fillRect = function () { cagri.fillRect++; boya.push(this.fillStyle); };
  let tuval = null;
  const phone = El('div', o.azalt ? ['phone', 'reduced-motion'] : ['phone']);
  const body = El('body');
  const document = {
    hidden: false, readyState: 'complete', body,
    documentElement: { setAttribute() {} },
    querySelector: s => (s === '.phone' && !o.telefonYok ? phone : null),
    getElementById: () => null,
    createElement: t => { const e = El(t); if (t === 'canvas') { e.width = 300; e.height = 150; e.getContext = () => ctx; tuval = e; } return e; },
    addEventListener: (t, f) => { (dinle[t] = dinle[t] || []).push(f); },
    removeEventListener() {}
  };
  const w = {
    document, devicePixelRatio: 3, innerWidth: 390, innerHeight: 844,
    location: { protocol: 'http:', hostname: '127.0.0.1', search: o.kalite ? '?kalite=' + o.kalite : '' },
    navigator: { webdriver: true, hardwareConcurrency: 8, deviceMemory: 8, userAgent: 'Mozilla/5.0 Chrome/1' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: !!o.mm }),
    addEventListener: (t, f) => { (wdinle[t] = wdinle[t] || []).push(f); }, dispatchEvent() { return true; },
    CustomEvent: function (ad, i) { this.type = ad; this.detail = i && i.detail; },
    requestAnimationFrame: f => { raf.push({ id: ++rafNo, f }); return rafNo; },
    cancelAnimationFrame: id => { const i = raf.findIndex(x => x.id === id); if (i >= 0) raf.splice(i, 1); },
    setTimeout: (f, ms) => { zaman.push({ f, t: simdi + (ms || 0) }); return zaman.length; }, clearTimeout() {},
    console, Float32Array, Float64Array, Uint8Array, JSON, Number, String, Date
  };
  w.window = w;
  vm.createContext(w);
  vm.runInContext('var __rasgele = 0; Math.random = (function(){ var s = 7; return function(){ __rasgele++; s = (s * 16807) % 2147483647; return s / 2147483647; }; })();', w);
  if (o.kalite) vm.runInContext(KALITE, w, { filename: 'kalite.js' });
  vm.runInContext(EFEKT, w, { filename: 'efekt.js' });
  const E = w.Efekt;
  return {
    w, E, El, anim, cagri, phone, tuval: () => tuval, dinle, boya,
    boyutDegis() { (wdinle.resize || []).forEach(f => f()); },
    rasgele: () => vm.runInContext('__rasgele', w),
    bekleyenRaf: () => raf.length,
    // bir kare: bekleyen rAF geri cagirmalari (ms sonra)
    kare(ms) { simdi += ms || 16; const L = raf.splice(0); L.forEach(x => x.f(simdi)); },
    // efekt bitene kadar kare; donus: kare sayisi
    bitir(enCok) { let k = 0; while (raf.length && k < (enCok || 1000)) { this.kare(16); k++; } return k; },
    zamanIlerlet(ms) { simdi += ms; zaman.filter(z => z.t <= simdi).forEach(z => { z.f(); z.t = Infinity; }); },
    gizle() { document.hidden = true; (dinle.visibilitychange || []).forEach(f => f()); }
  };
}

function govde(metin, ad) {
  const i = metin.indexOf('function ' + ad + '(');
  assert.ok(i >= 0, ad + ' bulunamadi');
  let j = metin.indexOf('{', i), d = 1, k = j + 1;
  while (d && k < metin.length) { if (metin[k] === '{') d++; else if (metin[k] === '}') d--; k++; }
  return metin.slice(j, k);
}

console.log('efekt modulu (js/efekt.js, birim)');

dene('havuz ust siniri seviye basina: yuksek 120, orta 60, dusuk 20 (istenen adet Kalite.parcacikSayisi ile kisilir)', () => {
  const T = { yuksek: 120, orta: 60, dusuk: 20 };
  Object.keys(T).forEach(s => {
    const o = ortam({ kalite: s });
    assert.strictEqual(o.w.Kalite.seviye(), s);
    o.E.konfeti({ adet: 500 }); o.E.patlama(50, 50, { adet: 500 });
    assert.strictEqual(o.E.durum().parcacik, T[s], s + ' tavan');
    assert.strictEqual(o.E.durum().tavan, T[s]);
    const b = ortam({ kalite: s });
    const n = b.E.konfeti({ adet: 90 });
    assert.strictEqual(n, Math.min(b.w.Kalite.parcacikSayisi(90), T[s]), s + ' konfeti 90 -> ' + n);
  });
  // tavan doluyken yeni efekt parcacik uretmez (bellek ayirmaz), mevcutlar bitince yine uretir
  const o = ortam({ kalite: 'dusuk' });
  o.E.konfeti({ adet: 500 });
  assert.strictEqual(o.E.konfeti({ adet: 10 }), 0);
  o.bitir();
  assert.ok(o.E.konfeti({ adet: 10 }) > 0);
});

dene('bitince rAF durur, tuval gizlenir ve temizlenir; sure 1.2-2 sn arasi (varsayilan 1,6 sn)', () => {
  const o = ortam({ kalite: 'yuksek' });
  o.E.konfeti();
  const t = o.tuval();
  assert.ok(t && t.classList.contains('acik'), 'tuval acik degil');
  assert.strictEqual(o.bekleyenRaf(), 1);
  const k = o.bitir();
  const sn = k * 16 / 1000;
  assert.ok(sn >= 1.0 && sn <= 2.0, 'sure ' + sn);
  assert.strictEqual(o.bekleyenRaf(), 0, 'rAF surekli');
  assert.strictEqual(o.E.durum().raf, false);
  assert.strictEqual(t.classList.contains('acik'), false, 'tuval gizlenmedi');
  assert.strictEqual(o.E.durum().parcacik, 0);
  // bos karede bir sey istenmez: ek kare yok
  o.kare(16); assert.strictEqual(o.bekleyenRaf(), 0);
  // tuval dokunmayi yutmaz
  assert.ok(/\.efekt-tuval\{[^}]*pointer-events:none[^}]*display:none/.test(CSS), '.efekt-tuval pointer-events:none / gizli degil');
  assert.ok(/\.efekt-tuval\.acik\{display:block;\}/.test(CSS));
});

dene('dusuk kalitede titreme yerine tek parlama; yuksek / orta titreme yalniz transform (translate)', () => {
  ['yuksek', 'orta', 'dusuk'].forEach(s => {
    const o = ortam({ kalite: s }), el = o.El('div');
    const sonuc = o.E.titre(el, 340, 5);
    if (s === 'dusuk') {
      assert.strictEqual(sonuc, 'parla', s);
      assert.strictEqual(o.anim.filter(a => a.el === el).length, 0, 'dusukte transform canlandi');
      assert.strictEqual(o.E.durum().parlama, true);
      o.bitir(); assert.strictEqual(o.E.durum().parlama, false); assert.strictEqual(o.bekleyenRaf(), 0);
    } else {
      assert.strictEqual(sonuc, 'titre', s);
      const a = o.anim.filter(x => x.el === el)[0];
      assert.ok(a && a.a.duration === 340, 'sure');
      a.k.forEach(kare => assert.deepStrictEqual(Object.keys(kare), ['transform'], 'yalniz transform'));
      assert.ok(a.k.every(kare => /^translate\(/.test(kare.transform)));
      assert.strictEqual(o.E.durum().parlama, false);
    }
  });
});

dene('azaltilmis hareket (.phone.reduced-motion ya da prefers-reduced-motion): parlama, konfeti az ve kisa, sayac aninda, baslik/nabiz yok', () => {
  [{ azalt: true }, { telefonYok: true, mm: true }].forEach(sec => {
    const o = ortam(Object.assign({ kalite: 'yuksek' }, sec)), el = o.El('div');
    assert.strictEqual(o.E.titre(el), 'parla');
    assert.strictEqual(o.anim.length, 0);
    o.bitir();
    const n = o.E.konfeti({ adet: 90, sure: 1800 });
    assert.ok(n > 0 && n <= 24, 'konfeti adet ' + n);
    const k = o.bitir();
    assert.ok(k * 16 <= 1000 + 32, 'konfeti suresi ' + (k * 16) + ' ms');
    const s = o.El('div');
    o.E.say(s, 1234, { onEk: 'Skorun: ' });
    assert.strictEqual(s.textContent, 'Skorun: 1234');
    assert.strictEqual(o.E.durum().sayac, 0);
    assert.strictEqual(o.E.baslik(el), false); assert.strictEqual(o.E.nabiz(el), false);
    assert.strictEqual(o.anim.length, 0);
  });
});

dene('dusukte konfeti kisa (en cok 1,1 sn); yuksekte istenen sure (1,8 sn)', () => {
  const y = ortam({ kalite: 'yuksek' }), d = ortam({ kalite: 'dusuk' });
  y.E.konfeti({ sure: 1800 }); d.E.konfeti({ sure: 1800 });
  const ky = y.bitir(), kd = d.bitir();
  assert.ok(ky * 16 > 1500 && ky * 16 <= 1800 + 32, 'yuksek ' + ky * 16);
  assert.ok(kd * 16 <= 1100 + 32, 'dusuk ' + kd * 16);
});

dene('sayac: textContent ile artar, son metin her yolda onEk + hedef; bitince sonra() bir kez', () => {
  const o = ortam({ kalite: 'yuksek' }), el = o.El('div');
  let sonra = 0;
  o.E.say(el, 5000, { onEk: 'Skorun: ', sure: 900, sonra: () => sonra++ });
  assert.strictEqual(el.textContent, 'Skorun: 0');
  for (let i = 0; i < 20; i++) o.kare(16);
  const ara = Number(el.textContent.replace('Skorun: ', ''));
  assert.ok(ara > 0 && ara < 5000, 'ara deger ' + el.textContent);
  o.bitir();
  assert.strictEqual(el.textContent, 'Skorun: 5000'); assert.strictEqual(sonra, 1);
  assert.strictEqual(o.bekleyenRaf(), 0);
});

dene('sayfa gizlenince her sey hemen biter: parcacik 0, rAF yok, tuval gizli, sayac son degerinde', () => {
  const o = ortam({ kalite: 'yuksek' }), el = o.El('div');
  o.E.konfeti(); o.E.patlama(10, 10); o.E.titre(o.El('div')); o.E.say(el, 77);
  o.kare(16); o.kare(16);
  o.gizle();
  const d = o.E.durum();
  assert.strictEqual(d.parcacik, 0); assert.strictEqual(d.halka, 0); assert.strictEqual(d.raf, false); assert.strictEqual(d.gorunur, false);
  assert.strictEqual(o.bekleyenRaf(), 0);
  assert.strictEqual(el.textContent, '77');
  assert.strictEqual(o.tuval().classList.contains('acik'), false);
});

dene('DPR Kalite.dprTavan ile sinirli (yuksek 2, orta 1,5, dusuk 1); Kalite yoksa yuksek varsayilir (tavan 120, DPR 2)', () => {
  [['yuksek', 780], ['orta', 585], ['dusuk', 390]].forEach(([s, g]) => {
    const o = ortam({ kalite: s }); o.E.konfeti();
    assert.strictEqual(o.tuval().width, g, s); assert.strictEqual(o.tuval().height, Math.round(844 * g / 390), s);
  });
  const o = ortam({ kalite: null });
  assert.strictEqual(o.w.Kalite, undefined);
  o.E.konfeti({ adet: 500 });
  assert.strictEqual(o.E.durum().parcacik, 120); assert.strictEqual(o.tuval().width, 780);
  assert.strictEqual(o.E.titre(o.El('div')), 'titre');
});

dene('efekt oyun rastgeleligini tuketmez: hicbir API ve kare Math.random cagirmaz (kaynakta da yok)', () => {
  ['yuksek', 'orta', 'dusuk', null].forEach(s => {
    const o = ortam({ kalite: s }), el = o.El('div');
    o.E.konfeti(); o.E.konfeti({ adet: 300, renkler: ['#fff'] }); o.E.patlama(1, 2, { adet: 40, halka: true }); o.E.titre(el); o.E.parla(el);
    o.E.nabiz(el); o.E.baslik(el); o.E.say(el, 100); o.E.vurgu(el, o.El('div'), 'Rekor!', 1000);
    o.bitir(); o.E.rekorIzci(10, 0).kontrol(20);
    assert.strictEqual(o.rasgele(), 0, (s || 'Kalite yok') + ': Math.random cagrildi');
  });
  assert.ok(!/Math\.random/.test(EFEKT.replace(/\/\/.*$/gm, '')), 'efekt.js kodu Math.random iceriyor');
});

dene('kare dongusunde bellek ayirma yok (kare, ciz, sayacIlerlet: new / function / dizi / gradyan yok)', () => {
  ['kare', 'ciz', 'sayacIlerlet', 'sil', 'halkaSil'].forEach(f => {
    const g = govde(EFEKT, f);
    assert.ok(!/\bnew\s/.test(g), f + ': new');
    assert.ok(!/\bfunction\b/.test(g), f + ': closure');
    assert.ok(!/\[\s*\]|\[\s*[^\]\s]+\s*,/.test(g.replace(/\[[a-zA-Z_.+ *0-9()-]+\]/g, '')), f + ': dizi');
    assert.ok(!/create(Radial|Linear)Gradient|getBoundingClientRect|offset(Width|Height|Left|Top)/.test(g), f + ': gradyan / olcu okuma');
  });
  assert.ok(/new Float32Array\(HAVUZ \* ALAN\)/.test(EFEKT), 'havuz Float32Array degil');
});

dene('vurgu: etiket gecici "Rekor!", kutu .efekt-rekor; sure dolunca ya da vurguKaldir ile eski metin geri gelir', () => {
  const o = ortam({ kalite: 'yuksek' }), kutu = o.El('div'), et = o.El('div');
  et.textContent = 'Skor';
  o.E.vurgu(kutu, et, 'Rekor!', 1800);
  assert.strictEqual(et.textContent, 'Rekor!'); assert.ok(kutu.classList.contains('efekt-rekor'));
  o.zamanIlerlet(1800);
  assert.strictEqual(et.textContent, 'Skor'); assert.ok(!kutu.classList.contains('efekt-rekor'));
  o.E.vurgu(kutu, et, 'Rekor!', 1800); o.E.vurgu(kutu, et, 'Rekor!', 1800);   // iki kez ust uste: eski metin kaybolmaz
  o.E.vurguKaldir(kutu, et);
  assert.strictEqual(et.textContent, 'Skor');
});

dene('sonuc konfetisi oncelikli: dusukte havuz rekor aniyla doluyken (ayni hamlede kayip) en eski parcaciklar atilir, konfeti > 0, tavan asilmaz', () => {
  const o = ortam({ kalite: 'dusuk' });
  o.E.patlama(50, 50, { adet: 26 }); o.E.konfeti({ adet: 40, sure: 1300 });   // rekor ani (2048 / Tempo ile ayni adetler)
  assert.strictEqual(o.E.durum().parcacik, 20, 'havuz dolu degil');
  assert.strictEqual(o.E.konfeti({ adet: 100, sure: 1800 }), 0, 'onceliksiz konfeti eskisi gibi uretmez');
  const n = o.E.konfeti({ adet: 100, sure: 1800, oncelik: true });
  assert.ok(n > 0, 'sonuc konfetisi ' + n);
  assert.strictEqual(o.E.durum().parcacik, 20, 'tavan asildi');
  o.bitir(); assert.strictEqual(o.bekleyenRaf(), 0);
  // yuksekte havuz bos: oncelik bir sey silmez, adet ayni
  const y = ortam({ kalite: 'yuksek' }), y2 = ortam({ kalite: 'yuksek' });
  assert.strictEqual(y.E.konfeti({ adet: 100, oncelik: true }), y2.E.konfeti({ adet: 100 }));
});

dene('renk tablosu tasinca canli parcacigin rengi degismez (40 farkli renkli efekt ust uste); bos yuva yeniden kullanilir', () => {
  const o = ortam({ kalite: 'yuksek' });
  o.E.konfeti({ adet: 5, sure: 1800, renkler: ['#111111'] });
  for (let i = 0; i < 40; i++) o.E.patlama(100, 100, { adet: 1, halka: false, renkler: ['#' + (0x200000 + i * 4099).toString(16)] });
  o.boya.length = 0; o.kare(16);
  assert.ok(o.boya.filter(x => x === '#111111').length >= 5, 'konfeti rengi degisti: ' + o.boya.filter(x => x === '#111111').length);
  for (let k = 0; k < 62; k++) o.kare(16);                       // kivilcimlar biter (en cok 0,9 sn), konfeti surer (en az 1,26 sn)
  const d = o.E.durum(); assert.strictEqual(d.parcacik, 5, JSON.stringify(d));
  o.E.patlama(100, 100, { adet: 2, halka: false, renkler: ['#ABCDEF'] });
  o.boya.length = 0; o.kare(16);
  assert.strictEqual(o.boya.filter(x => x === '#111111').length, 5);
  assert.strictEqual(o.boya.filter(x => x === '#ABCDEF').length, 2, 'bos yuva kullanilmadi');
  // ayni renk ayni yuva: tekrar eden renk tabloyu doldurmaz
  const t = ortam({ kalite: 'yuksek' });
  for (let i = 0; i < 100; i++) t.E.patlama(10, 10, { adet: 1, halka: false, renkler: ['#222222', '#333333'] });
  t.boya.length = 0; t.kare(16);
  assert.ok(t.boya.length > 0 && t.boya.every(x => x === '#222222' || x === '#333333'), Array.from(new Set(t.boya)).join(','));
});

dene('tuval olcusu her efekt basinda okunur; efekt suruyorken pencere boyutu degisirse guncellenir', () => {
  const o = ortam({ kalite: 'yuksek' });
  o.E.konfeti();
  assert.deepStrictEqual([o.tuval().width, o.tuval().height], [780, 1688]);
  o.phone.clientWidth = 500;                                      // olcu degisti, efekt suruyor: yeni efekt yeni olcuyu okur
  o.E.patlama(10, 10, { adet: 4 });
  assert.deepStrictEqual([o.tuval().width, o.tuval().height], [1000, 1688]);
  o.phone.clientHeight = 600; o.boyutDegis();                     // efekt suruyor, pencere boyutu degisti
  assert.deepStrictEqual([o.tuval().width, o.tuval().height], [1000, 1200]);
  assert.strictEqual(o.E.durum().gorunur, true);
  o.kare(16); assert.ok(o.cagri.fillRect > 0);
  o.bitir();
  o.phone.clientWidth = 390; o.boyutDegis();                      // efekt yokken bir sey yapilmaz
  assert.strictEqual(o.tuval().width, 1000);
  o.E.konfeti();
  assert.deepStrictEqual([o.tuval().width, o.tuval().height], [780, 1200]);
});

dene('rekorIzci: kosu basina 1 kez, eski rekor 0 ise hic, ikinci sans (ayni izci) sonrasi tekrar yok, kaldigi yerden devam', () => {
  const E = ortam({ kalite: 'yuksek' }).E;
  let iz = E.rekorIzci(100, 0);
  assert.deepStrictEqual([50, 100, 101, 150, 400].map(s => iz.kontrol(s)), [false, false, true, false, false]);
  assert.strictEqual(iz.tetiklendi, true);
  // ikinci sans: kosu surer, ayni izci -> skor artsa da tekrar yok
  assert.strictEqual(iz.kontrol(1000), false);
  // yeni kosu: yeni izci, eski rekor artik 400 (kosu basinda okunan)
  iz = E.rekorIzci(400, 0);
  assert.strictEqual(iz.kontrol(300), false); assert.strictEqual(iz.kontrol(401), true);
  // ilk oyun (eski rekor 0): hic tetiklenmez
  iz = E.rekorIzci(0, 0);
  assert.deepStrictEqual([1, 10, 1e6].map(s => iz.kontrol(s)), [false, false, false]);
  assert.strictEqual(iz.tetiklendi, false);
  // kaldigi yerden devam: skor eski rekoru zaten asmis -> tetiklenmis baslar
  iz = E.rekorIzci(100, 150);
  assert.strictEqual(iz.tetiklendi, true); assert.strictEqual(iz.kontrol(200), false);
  iz = E.rekorIzci(100, 90);
  assert.strictEqual(iz.tetiklendi, false); assert.strictEqual(iz.kontrol(101), true);
  iz = E.rekorIzci(100, 0); iz.isaretle(); assert.strictEqual(iz.kontrol(500), false);
});

dene('oyunlar efekti yalniz window.Efekt varsa cagirir; efekt.js uc oyunda yuklenir ve sw OYUNLAR icinde', () => {
  const core = oku('js/core.js'), sw = oku('sw.js');
  ['h2048', 'tempo', 'ates'].forEach(a => assert.ok(new RegExp(a + ":\\s*\\['js/efekt\\.js'").test(core), a + ' efekt.js yuklemiyor'));
  assert.ok(/var OYUNLAR = \[[\s\S]*'js\/efekt\.js'[\s\S]*\];/.test(sw));
  [['js/hedef2048.js', 3], ['js/tempoKup.js', 2], ['js/atesBocegiOyun.js', 2]].forEach(([f]) => {
    const m = oku(f);
    assert.ok(/window\.Efekt \? window\.Efekt\.rekorIzci\(/.test(m), f + ': rekorIzci korumasiz');
    // Efekt kullanan her fonksiyon once E'yi denetler
    assert.ok(!/[^.\w]Efekt\.(konfeti|patlama|titre|say|vurgu|baslik)\(/.test(m.replace(/window\.Efekt\./g, '')), f + ': korumasiz Efekt cagrisi');
  });
  assert.ok(/id="overlayRekor" hidden/.test(oku('index.html')), '2048 kayip ekraninda gizli "Yeni Rekor!" basligi yok');
});

// ---------------------------------------------------------------
// HEADLESS ENTEGRASYON
// ---------------------------------------------------------------
function chromeBul() {
  const adaylar = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return adaylar.find(a => fs.existsSync(a)) || null;
}
const TUR = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
              '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
function sunucu() {
  return http.createServer((istek, yanit) => {
    let yol = decodeURIComponent(istek.url.split('?')[0]); if (yol === '/') yol = '/index.html';
    const dosya = path.join(KOK, path.normalize(yol).replace(/^([\\/])+/, ''));
    if (yol === '/sw.js' || !dosya.startsWith(KOK) || !fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) { yanit.writeHead(404); yanit.end(); return; }
    yanit.writeHead(200, { 'Content-Type': TUR[path.extname(dosya)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    yanit.end(fs.readFileSync(dosya));
  });
}
async function baglan(port) {
  let sekmeler;
  for (let i = 0; i < 80; i++) {
    try { sekmeler = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* acilmadi */ }
    await sleep(250);
  }
  const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, h) => { ws.onopen = r; ws.onerror = h; });
  let n = 0; const bek = {}, hatalar = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (bek[d.id]) { bek[d.id](d); delete bek[d.id]; }
    if (d.method === 'Runtime.exceptionThrown') hatalar.push('istisna: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 400));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') hatalar.push('console.error: ' + JSON.stringify(d.params.args).slice(0, 400));
  };
  const gonder = (method, params) => new Promise((r, h) => {
    bek[++n] = d => d.error ? h(new Error(method + ': ' + JSON.stringify(d.error))) : r(d.result);
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });
  const deger = async ifade => {
    const r = await gonder('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(ifade.slice(0, 100) + ' -> ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };
  return { ws, gonder, deger, hatalar };
}

// Her belgede sayfa betiklerinden once: tohumlu ve SAYAN Math.random; Suzul kancasi (oyunOlustur sarilir, __bas ile baslar,
// durum window.__durum'da; tools/perfOlc.js ile ayni yontem). Yalniz test.
const ENJEKTE = `(function(){
  var s = 12345;
  window.__rasgele = 0;
  Math.random = function(){ window.__rasgele++; s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  var ab;
  Object.defineProperty(window, 'AtesBocegi', { configurable: true, get: function(){ return ab; }, set: function(v){
    ab = v; var o = v.oyunOlustur;
    v.oyunOlustur = function(t){ window.__durum = o(777, window.__bas); return window.__durum; };
  } });
})();`;
// Efekt cagri sayaclari (oyunlar window.Efekt.X'i cagri aninda okur) + titre sonuclari + ikinci sans taklidi
const SAYAC = `(function(){
  window.__say = {}; window.__titre = [];
  ['konfeti','patlama','titre','vurgu','baslik','say','nabiz'].forEach(function(a){
    var f = Efekt[a]; __say[a] = 0;
    Efekt[a] = function(){ __say[a]++; var r = f.apply(Efekt, arguments); if (a === 'titre') __titre.push(r); return r; };
  });
  window.__teklifSayi = 0;
  Reklam.destekleniyor = function(){ return true; };
  Reklam.ikinciSans = function(){ __teklifSayi++; return new Promise(function(r){ window.__teklif = r; }); };
  return 1;
})()`;
// Suzul denetcisi: isik / zemin korumasi, bocek y 47 (tools/perfOlc.js 'sabit' modu)
const SUZUL_DENETCI = `window.__suzul = function(){
  window.__suzulAcik = true;
  requestAnimationFrame(function f(){
    if (!window.__suzulAcik) return;
    var d = window.__durum;
    if (d && !d.bitti) { d.isik = 1; d.zeminKoruma = 1; d.dokunulmaz = 1; d.y = 47; d.vy = 0; d.ay = 0; }
    requestAnimationFrame(f);
  });
  return 1;
}; 1`;
// Tempo: ilk sigan konuma surukle (sentetik pointer olaylari; tempoKup.js hayaletKonumu'nun tersi: kazanc 1.08, kaldirDokunma 38)
const TEMPO_BOT = `window.__tempoHedef = function(){
  var hc = document.querySelectorAll('#tpBoard .tp-cell'), N = Math.round(Math.sqrt(hc.length)), dolu = [], i;
  for (i = 0; i < hc.length; i++) dolu.push(hc[i].classList.contains('filled'));
  var a = hc[0].getBoundingClientRect(), b = hc[1].getBoundingClientRect(), m = { sol: a.left, ust: a.top, adim: b.left - a.left, boy: a.width };
  var yuvalar = document.querySelectorAll('#tpTray .tp-slot');
  for (var y = 0; y < yuvalar.length; y++) {
    var pe = yuvalar[y].querySelector('.tp-piece:not(.used)'); if (!pe) continue;
    var hs = [].map.call(pe.querySelectorAll('i.tp-blok'), function(e){ return [Number(e.style.gridRow) - 1, Number(e.style.gridColumn) - 1]; });
    var sw = 0, sh = 0; hs.forEach(function(h){ sh = Math.max(sh, h[0] + 1); sw = Math.max(sw, h[1] + 1); });
    for (var r = 0; r + sh <= N; r++) for (var c = 0; c + sw <= N; c++) {
      if (!hs.every(function(h){ return !dolu[(r + h[0]) * N + c + h[1]]; })) continue;
      var pr = pe.getBoundingClientRect(), x0 = pr.left + pr.width / 2, y0 = pr.top + pr.height / 2;
      var w = sw * m.adim - (m.adim - m.boy), h = sh * m.adim - (m.adim - m.boy), gx = m.sol + c * m.adim, gy = m.ust + r * m.adim;
      return { pe: pe, x0: x0, y0: y0, x: x0 + (gx + w / 2 - x0) / 1.08, y: y0 + (gy + h + 38 - y0) / 1.08 };
    }
  }
  return null;
};
window.__tempoBasla = function(){
  var h = __tempoHedef(); if (!h) return 0;
  window.__tpH = h;
  h.pe.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: h.x0, clientY: h.y0, button: 0 }));
  return 1;
};
window.__tempoTasi = function(k){ var h = __tpH, x = h.x0 + (h.x - h.x0) * k, y = h.y0 + (h.y - h.y0) * k;
  document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y })); return 1; };
window.__tempoBirak = function(){ var h = __tpH;
  document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: h.x, clientY: h.y })); return 1; };
window.__tahtaRect = function(){ var r = document.getElementById('tpBoard').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].join(','); };
1`;
// Tempo: bitmis (yer kalmadi) oyun kaydi uret: cekirdekle ilk sigan konuma oyna (UI'ya dokunmaz). rb: oyun basindaki rekor.
const TEMPO_BITMIS = `(function(){
  var C = TempoCekirdek, o = new C.Oyun().basla(), g = 0, N = C.N;
  while (!o.bitti && g++ < 400) {
    var ok = false;
    for (var i = 0; i < 3 && !ok; i++) for (var r = 0; r < N && !ok; r++) for (var c = 0; c < N && !ok; c++) if (o.konabilir(i, r, c)) { o.oyna(i, r, c); ok = true; }
    if (!ok) break;
  }
  var renk = []; for (var k = 0; k < N * N; k++) renk.push((o.b[Math.floor(k / N)] & (1 << (k % N))) ? 1 : -1);
  var rb = Math.max(1, Math.floor(o.skor / 2));
  AppProgress.tempoBest = rb;
  AppProgress.tempoOyun = { k: o.kayit(), r: renk, t: [0, 1, 2], rb: rb, tb: 0, ib: 1 };
  return { bitti: o.bitti, skor: o.skor, rb: rb };
})()`;

// 2048: sola hamlede ust satirda 16+16 birlesir (skor +32), tek bos hucre dolar, hamle kalmaz (alt satirlar 8/64 dama)
const KAYIP_TAHTA = '(function(){ var T = Game2048._test; T.temizle(); [16, 16, 64, 8, 64].forEach(function(v, c){ T.karoKoy(0, c, v); }); ' +
  'for (var r = 1; r < 5; r++) for (var c = 0; c < 5; c++) T.karoKoy(r, c, (r + c) % 2 ? 64 : 8); return 1; })()';
const DOLU_TAHTA = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) DOLU_TAHTA.push([r, c, (r + c) % 2 ? 4 : 2, 0, 0, 0]);
// Efekt.konfeti donus degerleri (__say sarmalayicisinin ustune)
const KONFETI_DONUS = '(function(){ var f = Efekt.konfeti; window.__konfetiDon = []; Efekt.konfeti = function(){ var r = f.apply(Efekt, arguments); __konfetiDon.push(r); return r; }; })(); ';

async function entegrasyon() {
  const chrome = chromeBul();
  if (!chrome) { console.log('  ATLANDI headless entegrasyon (Chrome yok: CHROME_YOL)'); atlandi++; return; }
  if (EKRAN) fs.mkdirSync(EKRAN, { recursive: true });
  const srv = sunucu(); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const koken = 'http://127.0.0.1:' + srv.address().port, port = 9300 + Math.floor(Math.random() * 400);
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'efekt-test-'));
  const c = cp.spawn(chrome, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(dizin, 'profil'),
    '--force-color-profile=srgb', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
  try {
    const cdp = await baglan(port), { gonder, deger } = cdp;
    const bekle = async (ifade, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await deger('!!(' + ifade + ')')) return true; await sleep(50); } throw new Error('beklenen olmadi: ' + ifade); };
    const ekran = async ad => { if (!EKRAN) return; const g = await gonder('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(EKRAN, ad + '.png'), Buffer.from(g.data, 'base64')); };
    await gonder('Runtime.enable'); await gonder('Page.enable');
    await gonder('Page.addScriptToEvaluateOnNewDocument', { source: ENJEKTE });
    await gonder('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await gonder('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const ac = async (seviye, kart, oyun, hazirlik) => {
      cdp.hatalar.length = 0;
      await gonder('Storage.clearDataForOrigin', { origin: koken, storageTypes: 'all' });
      await gonder('Page.navigate', { url: koken + '/index.html?kalite=' + seviye });
      await bekle('document.readyState === "complete" && !!window.AppProgress && !!document.getElementById("' + kart + '")', 20000);
      await sleep(400);
      if (hazirlik) await deger(hazirlik);
      if (await deger('!!window.Efekt && !window.__say')) await deger(SAYAC);   // oyun dosyalari onceden yuklendiyse: sayac / taklit acilistan once
      await deger('document.getElementById(' + JSON.stringify(kart) + ').click(), 1');
      await bekle(oyun + ' && window.Efekt', 15000);
      await sleep(700);
      if (!(await deger('!!window.__say'))) await deger(SAYAC);
      assert.strictEqual(await deger('Kalite.seviye()'), seviye);
    };
    const hataYok = () => assert.deepStrictEqual(cdp.hatalar, [], 'sayfa hatasi');
    const D = () => deger('Efekt.durum()');
    // 2048: ekrandan cik ve ayni oturumda geri gel (liveSession ile sessiz devam)
    const cikDon = async () => {
      await deger('slideBack("game2048","boards2048"), 1'); await sleep(450);
      await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
    };

    for (const seviye of ['yuksek', 'orta', 'dusuk']) {
      const tavan = { yuksek: 120, orta: 60, dusuk: 20 }[seviye], titreBek = seviye === 'dusuk' ? 'parla' : 'titre';
      console.log('headless: ' + seviye);

      await deneA(seviye + ': 2048 hedef karo kutlamasi: parlama + konfeti + ' + titreBek + ' + patlama, pencere 1500 ms sonra; sonra rAF durur', async () => {
        // referans: ayni adimlar, Efekt cagrilari bos (efekt yokmus gibi) -> hamlenin Math.random cagri sayisi
        await ac(seviye, 'cardHedef2048', 'window.Game2048', null);
        await deger('["konfeti","patlama","titre"].forEach(function(a){ Efekt[a] = function(){ return null; }; }); 1');
        await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
        await deger('Game2048._test.temizle(); Game2048._test.karoKoy(0,0,1024); Game2048._test.karoKoy(0,1,1024); 1');
        const q0 = await deger('__rasgele');
        await deger('Game2048._test.hamle("left"), 1');
        await sleep(450);
        const efektsiz = await deger('__rasgele') - q0;
        await ac(seviye, 'cardHedef2048', 'window.Game2048', null);
        await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
        await deger('Game2048._test.temizle(); Game2048._test.karoKoy(0,0,1024); Game2048._test.karoKoy(0,1,1024); 1');
        const r0 = await deger('__rasgele');
        await deger('window.__hamleT = performance.now(), Game2048._test.hamle("left"), 1');
        await sleep(450);
        const d = await D(), dm = await deger('({ kutlama: Game2048._test.durum().kutlamaAcik, parla: !!document.querySelector(".tile.hedef-parla"), dom: document.querySelectorAll(".tile-parca.konfeti").length, pencere: document.getElementById("resumeAsk").classList.contains("show") })');
        assert.ok(dm.kutlama && dm.parla && dm.dom > 0 && !dm.pencere, JSON.stringify(dm));
        assert.ok(d.parcacik > 0 && d.parcacik <= tavan && d.gorunur && d.raf, JSON.stringify(d));
        assert.deepStrictEqual(await deger('__titre'), [titreBek]);
        assert.deepStrictEqual(await deger('[__say.konfeti, __say.patlama, __say.vurgu]'), [1, 1, 0]);
        await ekran(seviye + '-2048-hedef');
        // oyun rastgeleligi: efektli ve efektsiz kosuda hamlenin Math.random cagri sayisi ayni (efekt tuketmedi)
        assert.strictEqual(await deger('__rasgele') - r0, efektsiz, 'Math.random cagri sayisi');
        // pencere zamani degismedi: hamle (140 ms) + KUTLAMA_GECIKME 1500 ms
        await bekle('document.getElementById("resumeAsk").classList.contains("show") && document.getElementById("resumeAsk").classList.contains("kutlama")', 2500);
        const gecen = await deger('performance.now() - __hamleT');
        assert.ok(gecen >= 1640 && gecen < 2400, 'pencere ' + Math.round(gecen) + ' ms sonra acildi');
        await bekle('!Efekt.durum().raf', 2500);
        const s = await D();
        assert.ok(!s.gorunur && s.parcacik === 0, JSON.stringify(s));
        assert.strictEqual(await deger('getComputedStyle(document.querySelector(".efekt-tuval")).display'), 'none');
        hataYok();
      });

      await deneA(seviye + ': 2048 rekor ani (eski rekor 8): bir kez; ikinci birlesmede tekrar yok; tuval dokunmayi yutmaz', async () => {
        await ac(seviye, 'cardHedef2048', 'window.Game2048', 'AppProgress.bests = { b5: 8 }; 1');
        await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
        await deger('Game2048._test.temizle(); Game2048._test.karoKoy(4,0,8); Game2048._test.karoKoy(4,1,8); 1');
        await deger('Game2048._test.hamle("left"), 1');
        await sleep(300);
        assert.strictEqual(await deger('Game2048._test.durum().score'), 16);
        assert.deepStrictEqual(await deger('[__say.patlama, __say.konfeti, __say.titre]'), [1, 1, 1]);
        const d = await D();
        assert.ok(d.parcacik > 0 && d.parcacik <= tavan, JSON.stringify(d));
        // dokunma tuvalden gecer (pointer-events:none): ortadaki oge tuval degil
        assert.strictEqual(await deger('document.elementFromPoint(195, 600).classList.contains("efekt-tuval")'), false);
        assert.strictEqual(await deger('getComputedStyle(document.querySelector(".efekt-tuval")).pointerEvents'), 'none');
        await ekran(seviye + '-2048-rekor');
        await bekle('!Efekt.durum().raf', 3000);
        await deger('Game2048._test.karoKoy(3,0,4); Game2048._test.karoKoy(3,1,4); Game2048._test.hamle("left"), 1');
        await sleep(300);
        assert.ok(await deger('Game2048._test.durum().score') > 16);
        assert.deepStrictEqual(await deger('[__say.patlama, __say.konfeti, __say.titre]'), [1, 1, 1], 'ikinci kez tetiklendi');
        assert.strictEqual((await D()).parcacik, 0);
        hataYok();
      });

      await deneA(seviye + ': 2048 kayip + rekor (ayni oturumda devam): teklif acikken sonuc efekti yok; reddedince "Yeni Rekor!" + konfeti + sayac; devamdan sonra rekor ani tekrar yok', async () => {
        await ac(seviye, 'cardHedef2048', 'window.Game2048', 'AppProgress.bests = { b5: 8 }; 1');
        await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
        await deger('Game2048._test.temizle(); Game2048._test.karoKoy(4,0,8); Game2048._test.karoKoy(4,1,8); Game2048._test.hamle("left"), 1');
        await sleep(300);
        assert.deepStrictEqual(await deger('[Game2048._test.durum().score, Game2048._test.durum().best, __say.patlama]'), [16, 16, 1]);
        await cikDon();                                             // ayni oturum: liveSession ile sessiz devam (skor == rekor)
        assert.strictEqual(await deger('Game2048._test.durum().score'), 16);
        await deger(KAYIP_TAHTA + ', Game2048._test.hamle("left"), 1');
        await sleep(300);
        assert.strictEqual(await deger('__teklifSayi'), 1, 'ikinci sans teklifi yok');
        assert.deepStrictEqual(await deger('[document.getElementById("overlay").classList.contains("show"), __say.patlama, __say.konfeti, __say.baslik, __say.say]'), [false, 1, 1, 0, 0]);
        await deger('__teklif(false), 1');
        await sleep(250);
        assert.deepStrictEqual(await deger('[document.getElementById("overlay").classList.contains("show"), document.getElementById("overlayRekor").hidden, __say.patlama, __say.konfeti, __say.baslik, __say.say]'), [true, false, 1, 2, 1, 1]);
        assert.strictEqual(await deger('document.getElementById("overlayMsg").textContent'), 'Hamle kalmadı');
        const ara = await deger('document.getElementById("overlaySub").textContent');
        assert.ok(/^Skorun: \d+$/.test(ara) && ara !== 'Skorun: 48', 'sayac: ' + ara);
        assert.ok((await D()).parcacik > 0);
        await ekran(seviye + '-2048-sonuc');
        await bekle('!Efekt.durum().raf', 3000);
        assert.strictEqual(await deger('document.getElementById("overlaySub").textContent'), 'Skorun: 48');
        hataYok();
      });

      await deneA(seviye + ': 2048 uygulama yeniden acildi (diskten devam, skor 5000 > rekor 3000): kosu basi rekor bilinmez, kayipta "Yeni Rekor!" / konfeti yok', async () => {
        await ac(seviye, 'cardHedef2048', 'window.Game2048',
          'AppProgress.bests = { b5: 3000 }; AppProgress.g2048active = ' + JSON.stringify({ size: 5, score: 5000, tiles: DOLU_TAHTA, milestones: [] }) + '; 1');
        await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
        await deger('document.getElementById("raYes").click(), 1');
        await sleep(300);
        assert.strictEqual(await deger('__teklifSayi'), 1, 'ikinci sans teklifi yok');
        assert.deepStrictEqual(await deger('[document.getElementById("overlay").classList.contains("show"), __say.konfeti, __say.baslik, __say.say]'), [false, 0, 0, 0]);
        await deger('__teklif(false), 1');
        await sleep(250);
        assert.deepStrictEqual(await deger('[document.getElementById("overlay").classList.contains("show"), document.getElementById("overlayRekor").hidden, __say.konfeti, __say.baslik, __say.say, __say.patlama]'), [true, true, 0, 0, 0, 0]);
        assert.strictEqual(await deger('document.getElementById("overlaySub").textContent'), 'Skorun: 5000');
        // skor kutusu rekor isigi eski davranis (recordBroken: skor >= rekor)
        assert.strictEqual(await deger('document.getElementById("scoreBox").classList.contains("record")'), true);
        assert.strictEqual(await deger('AppProgress.bests.b5'), 5000);
        hataYok();
      });

      await deneA(seviye + ': 2048 rekor ani + ayni hamlede kayip (teklif yok): sonuc konfetisi > 0 (havuz dolu olsa da); ekrandan cikinca efekt biter', async () => {
        await ac(seviye, 'cardHedef2048', 'window.Game2048', 'AppProgress.bests = { b5: 8 }; 1');
        await deger(KONFETI_DONUS + 'Reklam.destekleniyor = function(){ return false; }; 1');
        await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
        await deger(KAYIP_TAHTA + ', Game2048._test.hamle("left"), 1');
        await sleep(300);
        assert.deepStrictEqual(await deger('[Game2048._test.durum().score, __say.patlama, __say.konfeti, __say.baslik, document.getElementById("overlayRekor").hidden]'), [32, 1, 2, 1, false]);
        const kd = await deger('__konfetiDon');
        assert.ok(kd.length === 2 && kd[1] > 0, 'sonuc konfetisi ' + JSON.stringify(kd));
        const d = await D(); assert.ok(d.parcacik > 0 && d.parcacik <= tavan && d.raf, JSON.stringify(d));
        await deger('slideBack("game2048","boards2048"), 1');
        const s = await D();
        assert.ok(s.parcacik === 0 && !s.raf && !s.gorunur, 'ekrandan cikinca efekt surdu: ' + JSON.stringify(s));
        assert.strictEqual(await deger('document.getElementById("overlaySub").textContent'), 'Skorun: 32', 'sayac son degerinde degil');
        hataYok();
      });

      if (seviye === 'yuksek') {
        await deneA(seviye + ': 2048 ayni oturumda devam, eski rekor 0 (ilk oyun, skor == rekor): rekor ani yok, kayipta "Yeni Rekor!" yok', async () => {
          await ac(seviye, 'cardHedef2048', 'window.Game2048', 'AppProgress.bests = {}; 1');
          await deger('Reklam.destekleniyor = function(){ return false; }; 1');
          await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
          await deger('Game2048._test.temizle(); Game2048._test.karoKoy(4,0,2); Game2048._test.karoKoy(4,1,2); Game2048._test.hamle("left"), 1');
          await sleep(300);
          assert.deepStrictEqual(await deger('[Game2048._test.durum().score, Game2048._test.durum().best]'), [4, 4]);
          await cikDon();
          await deger(KAYIP_TAHTA + ', Game2048._test.hamle("left"), 1');
          await sleep(300);
          assert.deepStrictEqual(await deger('[document.getElementById("overlay").classList.contains("show"), document.getElementById("overlayRekor").hidden, __say.patlama, __say.konfeti, __say.baslik, __say.say]'), [true, true, 0, 0, 0, 0]);
          assert.strictEqual(await deger('AppProgress.bests.b5'), 36);
          hataYok();
        });

        await deneA(seviye + ': 2048 diskten devam, skor == rekor (20): rekoru gecince rekor ani yok, kayipta "Yeni Rekor!" yok', async () => {
          await ac(seviye, 'cardHedef2048', 'window.Game2048',
            'AppProgress.bests = { b5: 20 }; AppProgress.g2048active = ' + JSON.stringify({ size: 5, score: 20, tiles: [[4, 0, 8, 0, 0, 0], [4, 1, 8, 0, 0, 0]], milestones: [] }) + '; 1');
          await deger('Reklam.destekleniyor = function(){ return false; }; 1');
          await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
          await deger('document.getElementById("raYes").click(), 1');
          await sleep(200);
          await deger('Game2048._test.hamle("left"), 1');
          await sleep(300);
          assert.deepStrictEqual(await deger('[Game2048._test.durum().score, AppProgress.bests.b5, __say.patlama, __say.konfeti]'), [36, 36, 0, 0]);
          await cikDon();                                           // ayni oturumda tekrar devam: kosu basi rekor hala bilinmiyor
          await deger(KAYIP_TAHTA + ', Game2048._test.hamle("left"), 1');
          await sleep(300);
          assert.deepStrictEqual(await deger('[document.getElementById("overlay").classList.contains("show"), document.getElementById("overlayRekor").hidden, __say.patlama, __say.konfeti, __say.baslik]'), [true, true, 0, 0, 0]);
          hataYok();
        });

        await deneA(seviye + ': 2048 hedef karo hamlesinden hemen sonra ekrandan cikis: kutlama efekti baslamaz; tahta acilisi ve pencere zamanlayicisi ayni', async () => {
          await ac(seviye, 'cardHedef2048', 'window.Game2048', null);
          await deger('Game2048.start(5); slideForward("boards2048","game2048"); 1'); await sleep(700);
          await deger('Game2048._test.temizle(); Game2048._test.karoKoy(0,0,1024); Game2048._test.karoKoy(0,1,1024); Game2048._test.hamle("left"); slideBack("game2048","boards2048"), 1');
          await sleep(450);
          assert.deepStrictEqual(await deger('[__say.konfeti, __say.patlama, __say.titre, Game2048._test.durum().kutlamaAcik, AppProgress.boards.indexOf(6) >= 0]'), [0, 0, 0, true, true]);
          const d = await D(); assert.ok(d.parcacik === 0 && !d.raf, JSON.stringify(d));
          await bekle('document.getElementById("resumeAsk").classList.contains("show")', 2500);
          hataYok();
        });

        await deneA(seviye + ': Tempo teklif acikken ekrandan cikis, sonra red: odeme ve bitis ekrani ayni, sonuc efekti yok', async () => {
          await ac(seviye, 'cardTempo', 'window.TempoKup', 'AppYukle.oyun("tempo").then(function(){ window.__b = ' + TEMPO_BITMIS + '; window.__altin0 = AppGold.get(); return 1; })');
          const b = await deger('__b'), altin0 = await deger('__altin0');
          assert.ok(b.bitti && b.skor > b.rb, JSON.stringify(b));
          await bekle('__teklifSayi === 1', 3000);
          await deger('slideBack("tempo","home"), 1');
          await sleep(500);
          await deger('__teklif(false), 1');
          await sleep(200);
          assert.deepStrictEqual(await deger('[document.getElementById("tpOver").classList.contains("show"), __say.konfeti, __say.baslik, __say.say, __say.nabiz]'), [true, 0, 0, 0, 0]);
          assert.ok(/Yeni.*Rekor!/.test(await deger('document.getElementById("tpOverBig").textContent')));
          assert.strictEqual(await deger('document.querySelector(".tp-over-skor").textContent'), b.skor.toLocaleString('tr-TR'));
          const toplam = await deger('(function(){ var b = document.querySelector("#tpOverSub .tp-over-odul b"); return b ? Number(b.textContent.replace(/\\D/g, "")) : 0; })()');
          assert.strictEqual(await deger('AppGold.get()') - altin0, toplam);
          assert.strictEqual((await D()).parcacik, 0);
          hataYok();
        });

        await deneA(seviye + ': Suzul teklif sonucu ekran disindayken gelir: odeme ve sonuc ayni, sonuc efekti yok', async () => {
          await ac(seviye, 'cardAtes', 'window.AtesBocegiOyun',
            'AppProgress.atesBocegi = { rekor: 1000, kosu: 3, gun: "", gunJeton: 0 }; window.__bas = { mesafe: 300, puan: 985 }; 1');
          await deger(SUZUL_DENETCI);
          await deger('AtesBocegiOyun.start(), 1'); await sleep(300);
          await deger('__suzul()');
          await deger('var t = document.getElementById("abTuval"); t.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"})); t.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"})); 1');
          await bekle('Math.floor(__durum.puan) > 1010', 20000);
          await deger('__suzulAcik = false; __durum.isik = 0; __durum.dokunulmaz = 0; 1');
          await bekle('__teklifSayi === 1', 5000);
          const k0 = await deger('[__say.konfeti, __say.baslik, __say.say]');
          await deger('slideBack("ates","home"), 1');                // dur() cagrilmadan ekran gecisi: teklif sonucu gec gelir
          await sleep(500);
          await deger('__teklif(false), 1');
          await sleep(200);
          assert.deepStrictEqual(await deger('[__say.konfeti, __say.baslik, __say.say]'), k0, 'ekran disinda sonuc efekti basladi');
          assert.ok(await deger('AppProgress.atesBocegi.rekor') > 1000, 'rekor kaydedilmedi');
          assert.ok(/Rekor!/.test(await deger('document.getElementById("abSonBaslik").innerHTML')));
          assert.strictEqual((await D()).parcacik, 0);
          hataYok();
        });
      }

      await deneA(seviye + ': Tempo rekor ani: "Rekor!" + patlama + konfeti + ' + titreBek + ' (skor cubugu); titreme sirasinda surukleme kaymaz/kopmaz; bir kez', async () => {
        await ac(seviye, 'cardTempo', 'window.TempoKup', 'AppProgress.tempoBest = 1; 1');
        await deger(TEMPO_BOT);
        const rect0 = await deger('__tahtaRect()');
        assert.strictEqual(await deger('__tempoBasla()'), 1);
        for (let k = 1; k <= 6; k++) { await deger('__tempoTasi(' + k / 6 + ')'); await sleep(16); }
        await deger('__tempoBirak()');
        await sleep(60);
        const s1 = await deger('Number(document.getElementById("tpBest").textContent.replace(/\\D/g, ""))');
        assert.ok(s1 > 1, 'yerlestirme olmadi');
        assert.deepStrictEqual(await deger('[__say.vurgu, __say.patlama, __say.konfeti, __say.titre]'), [1, 1, 1, 1]);
        assert.deepStrictEqual(await deger('__titre'), [titreBek]);
        assert.deepStrictEqual(await deger('[document.querySelector(".tp-box.cur").classList.contains("efekt-rekor"), document.querySelector(".tp-box.cur .l").textContent]'), [true, 'Rekor!']);
        // titreme suruyorken (ilk 320 ms) ikinci surukleme: tahta olcusu ayni, parca yerlesir
        assert.strictEqual(await deger('__tahtaRect()'), rect0, 'tahta titremeyle kaydi');
        assert.strictEqual(await deger('__tempoBasla()'), 1);
        for (let k = 1; k <= 6; k++) { await deger('__tempoTasi(' + k / 6 + ')'); await sleep(16); }
        assert.strictEqual(await deger('!!document.querySelector(".tp-ghost")'), true, 'surukleme koptu');
        await deger('__tempoBirak()');
        await sleep(60);
        const s2 = await deger('Number(document.getElementById("tpBest").textContent.replace(/\\D/g, ""))');
        assert.ok(s2 > s1, 'ikinci parca yerlesmedi (' + s1 + ' -> ' + s2 + ')');
        await ekran(seviye + '-tempo-rekor');
        assert.deepStrictEqual(await deger('[__say.vurgu, __say.patlama, __say.konfeti, __say.titre]'), [1, 1, 1, 1], 'ikinci kez tetiklendi');
        await bekle('!Efekt.durum().raf', 3000);
        await sleep(1600);
        assert.strictEqual(await deger('document.querySelector(".tp-box.cur .l").textContent'), 'Skor');
        hataYok();
      });

      await deneA(seviye + ': Tempo oyun sonu (rekor): teklif acikken efekt yok; reddedince baslik + konfeti + sayac + altin nabzi, odul ayni', async () => {
        // dosyalar onceden yuklenir, bitmis (teklif bekleyen) kayit uretilir, sonra oyun acilir: start() kaydi yukler, teklifi sorar
        await ac(seviye, 'cardTempo', 'window.TempoKup', 'AppYukle.oyun("tempo").then(function(){ window.__b = ' + TEMPO_BITMIS + '; window.__altin0 = AppGold.get(); return 1; })');
        const b = await deger('__b'), altin0 = await deger('__altin0');
        assert.ok(b.bitti && b.skor > b.rb, JSON.stringify(b));
        await bekle('__teklifSayi === 1', 3000);
        assert.deepStrictEqual(await deger('[document.getElementById("tpOver").classList.contains("show"), __say.konfeti, __say.baslik, __say.say]'), [false, 0, 0, 0]);
        await deger('__teklif(false), 1');
        await sleep(200);
        assert.deepStrictEqual(await deger('[document.getElementById("tpOver").classList.contains("show"), __say.konfeti, __say.baslik, __say.say]'), [true, 1, 1, 1]);
        assert.ok(/Yeni.*Rekor!/.test(await deger('document.getElementById("tpOverBig").textContent')));
        await ekran(seviye + '-tempo-sonuc');
        await bekle('!Efekt.durum().raf', 3000);
        const yazi = b.skor.toLocaleString('tr-TR');
        assert.strictEqual(await deger('document.querySelector(".tp-over-skor").textContent'), yazi);
        // odul: odenen altin = ekrandaki "Toplam" (yoksa 0); efekt yalniz gosterir
        const toplam = await deger('(function(){ var b = document.querySelector("#tpOverSub .tp-over-odul b"); return b ? Number(b.textContent.replace(/\\D/g, "")) : 0; })()');
        assert.strictEqual(await deger('AppGold.get()') - altin0, toplam);
        hataYok();
      });

      await deneA(seviye + ': Suzul rekor ani (eski 1000): "Rekor!" + patlama + ' + titreBek + ' (tuval); ikinci sans sonrasi tekrar yok; sonuc karti efektleri', async () => {
        await ac(seviye, 'cardAtes', 'window.AtesBocegiOyun',
          'AppProgress.atesBocegi = { rekor: 1000, kosu: 3, gun: "", gunJeton: 0 }; window.__bas = { mesafe: 300, puan: 985 }; 1');
        await deger(SUZUL_DENETCI);
        await deger('AtesBocegiOyun.start(), 1'); await sleep(300);
        await deger('__suzul()');
        await deger('var t = document.getElementById("abTuval"); t.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"})); t.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"})); 1');
        await bekle('Math.floor(__durum.puan) > 1000', 20000);
        await sleep(120);
        assert.deepStrictEqual(await deger('[__say.vurgu, __say.patlama, __say.titre, __say.konfeti]'), [1, 1, 1, 0]);
        assert.deepStrictEqual(await deger('__titre'), [titreBek]);
        assert.strictEqual(await deger('document.querySelector(".ab-kutu.cur .l").textContent'), 'Rekor!');
        assert.strictEqual(await deger('__durum.bitti'), 0, 'oyun durdu');
        const d = await D(); assert.ok(d.parcacik > 0 && d.parcacik <= tavan, JSON.stringify(d));
        await ekran(seviye + '-suzul-rekor');
        await sleep(1800);
        // olum -> ikinci sans teklifi: sonuc efekti yok
        await deger('__suzulAcik = false; __durum.isik = 0; __durum.dokunulmaz = 0; 1');
        await bekle('__teklifSayi === 1', 5000);
        assert.deepStrictEqual(await deger('[document.getElementById("abSonuc").classList.contains("show"), __say.konfeti, __say.baslik, __say.say]'), [false, 0, 0, 0]);
        await deger('__teklif(true); __suzul(); 1');
        await sleep(4500);                                          // geri sayim (3 sn) + kosu surer, puan artar
        assert.strictEqual(await deger('__durum.bitti'), 0);
        assert.deepStrictEqual(await deger('[__say.vurgu, __say.patlama, __say.titre]'), [1, 1, 1], 'ikinci sanstan sonra tekrar tetiklendi');
        // ikinci olum: hak kullanildi -> dogrudan sonuc karti, yeni rekor efektleri
        await deger('__suzulAcik = false; __durum.isik = 0; __durum.dokunulmaz = 0; 1');
        await bekle('document.getElementById("abSonuc").classList.contains("show")', 5000);
        await sleep(150);
        assert.strictEqual(await deger('__teklifSayi'), 1);
        assert.deepStrictEqual(await deger('[__say.konfeti, __say.baslik, __say.say]'), [1, 1, 1]);
        assert.ok(/Rekor!/.test(await deger('document.getElementById("abSonBaslik").innerHTML')));
        await ekran(seviye + '-suzul-sonuc');
        await bekle('!Efekt.durum().raf', 3000);
        const p = await deger('AppProgress.atesBocegi.rekor');
        assert.strictEqual(await deger('document.querySelector(".ab-sonpuan").textContent'), p.toLocaleString('tr-TR'));
        hataYok();
      });

      await deneA(seviye + ': tarayicida efekt API (konfeti/patlama/titre/say, 60 kare) Math.random cagirmaz', async () => {
        await ac(seviye, 'cardTempo', 'window.TempoKup', null);
        const n = await deger('(function(){ var r0 = __rasgele, el = document.getElementById("tpScore"); Efekt.konfeti(); Efekt.patlama(100, 100); Efekt.titre(el.parentNode); ' +
          'Efekt.say(el, 50); return new Promise(function(c){ var k = 0; requestAnimationFrame(function f(){ if (++k < 60) requestAnimationFrame(f); else c(__rasgele - r0); }); }); })()');
        assert.strictEqual(n, 0);
        hataYok();
      });
    }
    cdp.ws.close();
  } finally {
    try { c.kill(); } catch (e) { /* kapanmis */ }
    srv.close();
    await sleep(300);
    try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici dizin */ }
  }
}

(async () => {
  if (!YALNIZ_BIRIM) { console.log('oyun entegrasyonu (headless Chrome)'); await entegrasyon(); }
  console.log(gecti + ' test gecti' + (atlandi ? ', ' + atlandi + ' atlandi' : ''));
})().catch(e => { console.log('HATA ' + e.stack); process.exitCode = 1; });
