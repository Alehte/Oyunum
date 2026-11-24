// h2048AcmaTest.js — Hedef 2048 tahta acma zinciri (js/hedef2048.js "H2048 ACMA SAF"
// bolumu + oyun akisi). Calistirma:  node tools/h2048AcmaTest.js
// Saf bolum ayri baglamda denenir; oyun akisi icin hedef2048.js'in TAMAMI sahte DOM,
// sahte saat ve tohumlu Math.random ile calistirilir. Yapay karo: Game2048._test.
// Denenen:
//   - zincir tablosu, kilitli tahta etiketi, Turkce ek, acilacak kurali, bozuk kayit
//   - 5..9 her tahtada hedef karo olusunca sonraki tahta acilir ve kaydedilir
//   - kutlama ilk kez gosterilir, ikinci kez gosterilmez; zaten acik tahtada yok
//   - kutlama acikken klavye/kaydirma oyunu oynatmaz
//   - "devam et": ayni oyun surer (hamle calisir, skor korunur); hedefte oyun bitmez
//   - "dene": yeni boyutta yeni oyun, eski oyun kaydi silinir, rekor kalir
//   - 10x10: hedef/kutlama yok, bilgi mesaji bir kez (kalici bayrak)
//   - hedefi olusturan hamle tahtayi tikarsa hamlesiz durum kaydedilmez; hamlesiz kayit
//     geri yuklenirse kayip akisi (kilit cozme / ikinci sans / kayip ekrani) calisir
//   - kutlama acikken start(), azaltilmis hareket, konfeti temizligi, zafer sesi tek
//   - tahta secim ekrani: fiyat/altin yok, kilitli tahtaya dokunmak hicbir sey acmaz
//   - eski kayit (KAYIT_SURUM degismeden): altinla alinmis tahtalar acik, yeni alan korunur
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const KOK = path.join(__dirname, '..');
const kaynak = fs.readFileSync(path.join(KOK, 'js', 'hedef2048.js'), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.stack || e)); process.exitCode = 1; }
}
const kopya = o => JSON.parse(JSON.stringify(o));

// ---- saf bolum ----
const BAS = '// ==== H2048 ACMA SAF BASLANGIC ====', SON = '// ==== H2048 ACMA SAF SON ====';
const bi = kaynak.indexOf(BAS), si = kaynak.indexOf(SON);
if (bi < 0 || si < 0) { console.error('hedef2048.js icinde acma saf bolumu bulunamadi'); process.exit(1); }
const safCtx = { window: {} };
vm.runInNewContext(kaynak.slice(bi, si), safCtx);
const A = safCtx.window.H2048Acma;

// ---- sahte DOM ----
function stil() {
  return { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
}
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this._cls = new Set(); this.style = stil(); this.dataset = {}; this.dinle = {};
    this.textContent = ''; this.innerHTML = ''; this.id = '';
    this.offsetTop = 0; this.offsetHeight = 0; this.clientWidth = 400; this.clientHeight = 700;
  }
  get className() { return Array.from(this._cls).join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const s = this._cls;
    return {
      add: (...a) => a.forEach(x => s.add(x)), remove: (...a) => a.forEach(x => s.delete(x)),
      toggle: (x, f) => { if (f === undefined) f = !s.has(x); if (f) s.add(x); else s.delete(x); return f; },
      contains: x => s.has(x)
    };
  }
  get offsetWidth() { return 40; }
  appendChild(c) {
    if (c.parca) { c.children.slice().forEach(k => this.appendChild(k)); c.children = []; return c; }
    if (c.parentNode) c.remove();
    c.parentNode = this; this.children.push(c); return c;
  }
  insertBefore(c, ref) {
    if (c.parca) { c.children.slice().forEach(k => this.insertBefore(k, ref)); c.children = []; return c; }
    if (c.parentNode) c.remove();
    c.parentNode = this;
    const i = this.children.indexOf(ref);
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  remove() { if (this.parentNode) { const p = this.parentNode; p.children = p.children.filter(x => x !== this); this.parentNode = null; } }
  setAttribute() {} removeAttribute() {}
  addEventListener(t, f) { (this.dinle[t] = this.dinle[t] || []).push(f); }
  yay(t, e) { (this.dinle[t] || []).slice().forEach(f => f(Object.assign({ target: this, preventDefault() {} }, e || {}))); }
  click() { this.yay('click'); }
  matches(sel) {
    const m = /^([a-z]*)((?:\.[\w-]+)*)$/i.exec(sel);
    if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    return m[2].split('.').filter(Boolean).every(c => this._cls.has(c));
  }
  closest(sel) { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) {
    const out = [];
    (function gez(n) { n.children.forEach(c => { if (c.matches(sel)) out.push(c); gez(c); }); })(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  // sira konumu: hucre adimi 46, genislik 40 (measure() bunu okur)
  getBoundingClientRect() {
    const i = this.parentNode ? this.parentNode.children.indexOf(this) : 0;
    return { left: i * 46, top: 0, width: 40, height: 40, right: i * 46 + 40, bottom: 40 };
  }
}

function sahteSes(sesler) {
  const p = kayit => ({ setValueAtTime(f) { if (kayit) sesler.push(f); }, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  return function () {
    return {
      state: 'running', currentTime: 0, destination: {}, resume() {},
      createOscillator: () => ({ type: '', frequency: p(true), connect: g => g, start() {}, stop() {} }),
      createGain: () => ({ gain: p(), connect: d => d })
    };
  };
}

// Oyunu yeni bir baglamda kurar. ilerleme: AppProgress baslangici.
// secenek: { azalt: azaltilmis hareket, reklam: ikinci sans taklidi (cagrilar dizisi) }
function kur(ilerleme, tohum, secenek) {
  secenek = secenek || {};
  const body = new El('body');
  const sesler = [];
  const kayit = {};
  const yap = (tag, id, ust, sinif) => {
    const e = new El(tag); if (id) { e.id = id; kayit[id] = e; } if (sinif) e.className = sinif;
    (ust || body).appendChild(e); return e;
  };
  // 2048 ekrani ilk cocuk: gameVisible() getBoundingClientRect ile solda gorur
  const oyunEkran = yap('div', 'screen-game-2048', body, 'app-screen');
  const topbar = yap('div', null, oyunEkran, 'topbar'); topbar.offsetTop = 0; topbar.offsetHeight = 60;
  yap('button', 'backBtn2048', topbar, 'back-btn');
  const kontrol = yap('div', null, oyunEkran, 'controls-row'); kontrol.offsetTop = 60; kontrol.offsetHeight = 50;
  const skorSatir = yap('div', null, kontrol, 'score-row');
  yap('div', 'scoreBox', skorSatir, 'score-box current normal');
  yap('div', 'scoreVal', skorSatir); yap('div', 'bestVal', skorSatir);
  yap('button', 'restartBtn', kontrol, 'restart-btn');
  const ra = yap('div', 'resumeAsk', oyunEkran, 'resume-ask');
  yap('div', 'raTitle', ra); yap('div', 'raSub', ra);
  yap('button', 'raYes', ra, 'ra-yes'); yap('button', 'raNo', ra, 'ra-no');
  const wrap = yap('div', null, oyunEkran, 'board-wrap'); wrap.offsetTop = 110;
  const board = yap('div', 'board', wrap, 'board');
  yap('div', 'tileLayer', board, 'tile-layer');
  yap('div', 'recordFx', board, 'record-fx');
  const ov = yap('div', 'overlay', board, 'overlay');
  yap('div', 'overlayMsg', ov); yap('div', 'overlaySub', ov); yap('button', 'overlayBtn', ov);
  const sec = yap('div', 'screen-2048-boards', body, 'app-screen');
  if (secenek.azalt) yap('div', null, body, 'phone reduced-motion');
  yap('div', 'bdHint', sec, 'bd-hint'); yap('div', 'bdStage', sec, 'bd-stage'); yap('button', 'bdBackCenter', sec, 'bd-back');

  const document = {
    body,
    getElementById: id => kayit[id] || null,
    createElement: t => new El(t),
    createDocumentFragment: () => { const f = new El('#frag'); f.parca = true; return f; },
    querySelector: s => body.querySelector(s)
  };
  // sahte saat
  const saat = { simdi: 0, sira: [], no: 0 };
  const setTimeout_ = (fn, ms) => { const id = ++saat.no; saat.sira.push({ id, t: saat.simdi + (ms || 0), fn }); return id; };
  const clearTimeout_ = id => { saat.sira = saat.sira.filter(x => x.id !== id); };
  function zaman(ms) {
    const son = saat.simdi + ms;
    for (;;) {
      saat.sira.sort((a, b) => a.t - b.t || a.id - b.id);
      const s = saat.sira[0];
      if (!s || s.t > son) break;
      saat.sira.shift(); saat.simdi = s.t; s.fn();
    }
    saat.simdi = son;
  }
  const P = Object.assign({ gold: 0 }, kopya(ilerleme || {}));
  const yazimlar = [];
  const winDinle = {};
  const gecis = [];
  const win = {
    document, AppProgress: P, innerWidth: 400,
    AppSaveProgress: patch => { Object.assign(win.AppProgress, patch); yazimlar.push(kopya(patch)); },
    AppGold: { get: () => P.gold, add: n => { P.gold += n; }, harca() { throw new Error('harca cagrilmamali'); }, render() {} },
    CoinSVG: () => '<img class="app-coin">',
    AppFX: { vol: () => 0, vibrate() {}, tone() {}, seq() {} },
    AudioContext: sahteSes(sesler),
    addEventListener: (t, f) => { (winDinle[t] = winDinle[t] || []).push(f); },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', backgroundColor: 'rgb(1,2,3)' }),
    setTimeout: setTimeout_, clearTimeout: clearTimeout_,
    screens: { boards2048: false },
    slideForward: (a, b) => gecis.push(['ileri', a, b]),
    slideBack: (a, b) => gecis.push(['geri', a, b]),
    console
  };
  if (secenek.reklam) {
    win.Reklam = { destekleniyor: () => true, ikinciSans: x => { secenek.reklam.push(x); return new Promise(() => {}); } };
  }
  win.window = win;
  vm.createContext(win);
  // tohumlu Math.random (mulberry32)
  vm.runInContext('(function(n){ Math.random = function(){ n |= 0; n = (n + 0x6D2B79F5) | 0;' +
    ' var t = Math.imul(n ^ (n >>> 15), 1 | n); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;' +
    ' return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(' + (tohum || 1) + ');', win);
  vm.runInContext(kaynak, win, { filename: 'hedef2048.js' });
  const G = win.Game2048, T = G._test;
  const o = {
    win, P, G, T, zaman, yazimlar, gecis, el: kayit,
    zaferSesi: () => sesler.filter(f => f === 523.25).length,   // playWinSound cagri sayisi
    tus: k => (winDinle.keydown || []).forEach(f => f({ key: k, preventDefault() {} })),
    kaydir: (dx, dy) => {
      oyunEkran.yay('touchstart', { touches: [{ clientX: 200, clientY: 400 }] });
      oyunEkran.yay('touchend', { changedTouches: [{ clientX: 200 + dx, clientY: 400 + dy }] });
    },
    pencere: () => kayit.resumeAsk.classList.contains('show'),
    kutlamaPenceresi: () => kayit.resumeAsk.classList.contains('show') && kayit.resumeAsk.classList.contains('kutlama'),
    boardsYazimi: () => yazimlar.filter(y => 'boards' in y),
    // karolari sabitle: once tahtayi bosalt, sonra listeyi koy
    tahta: liste => { T.temizle(); liste.forEach(k => T.karoKoy(k[0], k[1], k[2])); }
  };
  return o;
}
const zincireKadar = n => kopya(A.ZINCIR.map(z => z.size).filter(s => s <= n));

console.log('2048 tahta acma');

// ================= saf =================
dene('zincir tablosu belgedeki gibi (5->2048->6 ... 9->32768->10, 10 hedefsiz)', () => {
  assert.deepStrictEqual(kopya(A.ZINCIR), [
    { size: 5, hedef: 2048, sonraki: 6 }, { size: 6, hedef: 4096, sonraki: 7 }, { size: 7, hedef: 8192, sonraki: 8 },
    { size: 8, hedef: 16384, sonraki: 9 }, { size: 9, hedef: 32768, sonraki: 10 }, { size: 10, hedef: 0, sonraki: 0 }]);
  assert.strictEqual(A.ZINCIR.some(z => z.size < 5), false, '5x5ten kucuk tahta yok');
});

dene('kilitli tahta etiketi: onceki tahtanin hedefi', () => {
  assert.strictEqual(A.kilitMetni(6), 'Önceki tahtada 2048 karosuna ulaş');
  assert.strictEqual(A.kilitMetni(7), 'Önceki tahtada 4096 karosuna ulaş');
  assert.strictEqual(A.kilitMetni(8), 'Önceki tahtada 8192 karosuna ulaş');
  assert.strictEqual(A.kilitMetni(9), 'Önceki tahtada 16384 karosuna ulaş');
  assert.strictEqual(A.kilitMetni(10), 'Önceki tahtada 32768 karosuna ulaş');
  assert.strictEqual(A.kilitMetni(5), '');
});

dene('Turkce ek: 5x5\'i 6x6\'yi 7x7\'yi 8x8\'i 9x9\'u 10x10\'u', () => {
  assert.deepStrictEqual([5, 6, 7, 8, 9, 10].map(A.boyutEkli),
    ["5x5'i", "6x6'yı", "7x7'yi", "8x8'i", "9x9'u", "10x10'u"]);
});

dene('acilacak: hedef altinda 0, hedefte/ustunde sonraki, zaten aciksa 0, 10x10 hep 0', () => {
  assert.strictEqual(A.acilacak({ boards: [5] }, 5, 1024), 0);
  assert.strictEqual(A.acilacak({ boards: [5] }, 5, 2048), 6);
  assert.strictEqual(A.acilacak({ boards: [5] }, 5, 4096), 6, '>= hedef (joker ile atlama)');
  assert.strictEqual(A.acilacak({ boards: [5, 6] }, 5, 2048), 0, 'altinla alinmis');
  assert.strictEqual(A.acilacak({ boards: [5, 6] }, 6, 4096), 7);
  assert.strictEqual(A.acilacak({ boards: [5, 6, 7, 8, 9] }, 9, 32768), 10);
  assert.strictEqual(A.acilacak({ boards: [5, 6, 7, 8, 9, 10] }, 10, 1 << 20), 0);
  assert.strictEqual(A.acilacak({ boards: [5] }, 10, 1 << 20), 0);
  assert.strictEqual(A.acilacak({}, 5, 2048), 6, 'boards alani yok');
});

dene('sahipler: kayit yok / bozuk -> [5]; 5 hep acik; eski siralar korunur', () => {
  assert.deepStrictEqual(kopya(A.sahipler(undefined)), [5]);
  assert.deepStrictEqual(kopya(A.sahipler({})), [5]);
  assert.deepStrictEqual(kopya(A.sahipler({ boards: 7 })), [5]);
  assert.deepStrictEqual(kopya(A.sahipler({ boards: null })), [5]);
  assert.deepStrictEqual(kopya(A.sahipler({ boards: [5, 8, 6] })), [5, 8, 6]);
  assert.deepStrictEqual(kopya(A.sahipler({ boards: [8] })), [5, 8]);
});

dene('kaynakta altin fiyati / satin alma kalmadi', () => {
  assert.ok(!/price/.test(kaynak), 'price var');
  assert.ok(!/\bbuy\s*\(/.test(kaynak), 'buy( var');
  assert.ok(!/harca\s*\(/.test(kaynak), 'AppGold.harca var');
  assert.ok(!/bd-price/.test(kaynak), 'bd-price var');
});

// ================= oyun akisi =================
// Her tahta (5..9): yeni oyun, iki hedef/2 karosu yan yana, sola hamle -> hedef karo.
[5, 6, 7, 8, 9].forEach(n => {
  dene(n + 'x' + n + ': hedef karo olusunca ' + A.sonraki(n) + 'x' + A.sonraki(n) + ' acilir, kaydedilir, kutlama gelir', () => {
    const o = kur({ boards: zincireKadar(n) }, 10 + n);
    const h = A.hedef(n), s = A.sonraki(n);
    o.G.start(n);
    assert.strictEqual(o.T.durum().size, n);
    o.tahta([[0, 0, h / 2], [0, 1, h / 2], [3, 3, 2]]);
    o.T.hamle('left'); o.zaman(200);
    assert.ok(o.P.boards.indexOf(s) >= 0, 'sonraki tahta acik degil');
    const bw = o.boardsYazimi();
    assert.strictEqual(bw.length, 1, 'boards bir kez yazilmali');
    assert.deepStrictEqual(kopya(bw[0].boards), zincireKadar(n).concat([s]));
    assert.ok(o.T.durum().karolar.some(k => k[0] === 0 && k[1] === 0 && k[2] === h), 'hedef karo yok');
    assert.strictEqual(o.T.durum().kutlamaAcik, true);
    assert.strictEqual(o.el.overlay.classList.contains('show'), false, 'hedefte oyun bitmemeli');
    // parlama + konfeti
    assert.ok(o.el.tileLayer.querySelectorAll('.konfeti').length > 0, 'konfeti yok');
    assert.ok(o.el.tileLayer.querySelectorAll('.hedef-parla').length === 1, 'hedef karo parlamiyor');
    o.zaman(1000);
    assert.strictEqual(o.pencere(), false, 'pencere animasyon bitmeden acildi');
    o.zaman(500);
    assert.strictEqual(o.kutlamaPenceresi(), true, 'kutlama penceresi acilmadi');
    assert.strictEqual(o.el.raTitle.textContent, 'Başardın! ' + s + 'x' + s + ' tahta açıldı');
    assert.strictEqual(o.el.raYes.textContent, n + 'x' + n + ' ile devam et');
    assert.strictEqual(o.el.raNo.textContent, A.boyutEkli(s) + ' dene');
    assert.notStrictEqual(o.el.raNo.style.display, 'none');
    o.zaman(2000);
    assert.strictEqual(o.el.tileLayer.querySelectorAll('.konfeti').length, 0, 'konfeti 2 sn icinde temizlenmeli');
    // oyun kaydi (tek slot) yazildi: uygulama kapansa da acilis kalici
    assert.ok(o.P.g2048active && o.P.g2048active.size === n && o.P.g2048active.score > 0);
  });
});

dene('kutlama acikken klavye ve kaydirma oyunu oynatmaz (pencere oncesi ve sirasinda)', () => {
  const o = kur({ boards: [5] }, 3);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024], [4, 4, 2]]);
  o.T.hamle('left'); o.zaman(200);
  const once = kopya(o.T.durum());
  o.tus('ArrowRight'); o.kaydir(150, 0); o.T.hamle('down'); o.zaman(300);
  assert.deepStrictEqual(kopya(o.T.durum()), once, 'pencereden once hamle oldu');
  o.zaman(1800);
  assert.strictEqual(o.kutlamaPenceresi(), true);
  o.tus('ArrowRight'); o.tus('d'); o.kaydir(150, 0); o.kaydir(0, 150); o.zaman(300);
  assert.deepStrictEqual(kopya(o.T.durum()), once, 'pencere acikken hamle oldu');
});

dene('"devam et": ayni oyun surer (hamle calisir, skor korunur); ayni oyunda ikinci hedef kutlamasiz', () => {
  const o = kur({ boards: [5] }, 4);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024], [4, 4, 2]]);
  o.T.hamle('left'); o.zaman(1700);
  const skor = o.T.durum().score;
  assert.strictEqual(skor, 2048);
  o.el.raYes.click();
  assert.strictEqual(o.pencere(), false);
  assert.strictEqual(o.T.durum().kutlamaAcik, false);
  assert.strictEqual(o.T.durum().size, 5);
  assert.ok(o.T.durum().karolar.some(k => k[2] === 2048), 'oyun silinmis');
  // hamle calisir, skor korunur (uzerine eklenir)
  o.T.karoKoy(2, 0, 4); o.T.karoKoy(2, 1, 4);
  o.tus('ArrowLeft'); o.zaman(200);
  assert.strictEqual(o.T.durum().score, skor + 8, 'devam sonrasi hamle/skor');
  // ikinci 2048 ayni oyunda: tahta zaten acik -> kutlama yok, boards yeniden yazilmaz
  o.T.karoKoy(3, 0, 1024); o.T.karoKoy(3, 1, 1024);
  o.T.hamle('left'); o.zaman(1800);
  assert.strictEqual(o.T.durum().kutlamaAcik, false);
  assert.strictEqual(o.pencere(), false, 'ikinci kez kutlama');
  assert.strictEqual(o.boardsYazimi().length, 1);
  assert.strictEqual(o.el.overlay.classList.contains('show'), false);
});

dene('yeni oyunda (kayit kalici) ayni hedef: ikinci kez kutlama yok', () => {
  const o = kur({ boards: [5] }, 5);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o.T.hamle('left'); o.zaman(1700); o.el.raYes.click();
  // diskten okunmus gibi yeni baglam: AppProgress kalici kayittan
  const p2 = kopya(o.P); p2.g2048active = null;   // yarim oyun yok: dogrudan yeni oyun
  const o2 = kur(p2, 6);
  o2.G.start(5);
  assert.strictEqual(o2.pencere(), false);
  o2.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o2.T.hamle('left'); o2.zaman(1800);
  assert.strictEqual(o2.pencere(), false);
  assert.strictEqual(o2.boardsYazimi().length, 0);
});

dene('zaten acik tahta (eskiden altinla alinmis 6x6): kutlama yok, kayit degismez', () => {
  const o = kur({ boards: [5, 6, 9], gold: 777 }, 7);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o.T.hamle('left'); o.zaman(1800);
  assert.strictEqual(o.pencere(), false);
  assert.strictEqual(o.T.durum().kutlamaAcik, false);
  assert.strictEqual(o.boardsYazimi().length, 0);
  assert.deepStrictEqual(kopya(o.P.boards), [5, 6, 9]);
  // ayni kayitta 6x6 hedefi: 7 acik degil -> acilir (9 da korunur)
  o.G.start(6);   // 5x5 aktif oyun var: sil onayi
  assert.strictEqual(o.pencere(), true); o.el.raYes.click();
  o.tahta([[0, 0, 2048], [0, 1, 2048]]);
  o.T.hamle('left'); o.zaman(1800);
  assert.deepStrictEqual(kopya(o.P.boards), [5, 6, 9, 7]);
  assert.strictEqual(o.kutlamaPenceresi(), true);
});

dene('"dene": yeni boyutta yeni oyun; eski oyun kaydi silinir, rekor kalir; ek onay yok', () => {
  const o = kur({ boards: [5] }, 8);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o.T.hamle('left'); o.zaman(1700);
  const skor = o.T.durum().score;
  o.el.raNo.click();
  const d = o.T.durum();
  assert.strictEqual(d.size, 6);
  assert.strictEqual(d.score, 0);
  assert.strictEqual(d.kutlamaAcik, false);
  assert.strictEqual(o.pencere(), false, 'ek onay sorulmamali');
  assert.strictEqual(o.P.g2048active, null, 'eski 5x5 kaydi silinmeli');
  assert.strictEqual(o.P.bests.b5, skor, '5x5 rekoru kalmali');
  assert.strictEqual(d.karolar.filter(k => !k[3]).length, 2, 'yeni oyun 2 karo');
  // yeni 6x6 oyunda hamle calisir
  o.tahta([[1, 0, 2], [1, 1, 2]]);
  o.T.hamle('left'); o.zaman(200);
  assert.strictEqual(o.T.durum().score, 4);
});

dene('hedef + tikanan tahta: kutlama once, "devam et" sonrasi oyun hamle yoklugundan biter', () => {
  // satir 0 sola: [2048,128,256,8,X]; geri kalan 32/64 dama: X (2/4) hicbir komsuyla eslesmez
  let o = null;
  for (let t = 1; t < 60; t++) {
    const d = kur({ boards: [5] }, 100 + t);
    d.G.start(5);
    const l = [[0, 0, 1024], [0, 1, 1024], [0, 2, 128], [0, 3, 256], [0, 4, 8]];
    for (let r = 1; r < 5; r++) for (let c = 0; c < 5; c++) l.push([r, c, (r + c) % 2 ? 64 : 32]);
    d.tahta(l);
    d.T.hamle('left'); d.zaman(200);
    const yeni = d.T.durum().karolar.find(k => k[0] === 0 && k[1] === 4);
    if (yeni && (yeni[2] === 2 || yeni[2] === 4)) { o = d; break; }   // joker/kilit cikmadi
  }
  assert.ok(o, 'uygun tohum bulunamadi');
  assert.strictEqual(o.el.overlay.classList.contains('show'), false, 'kutlamadan once bitti');
  assert.strictEqual(o.P.g2048active, null, 'hamlesiz durum kaydedilmemeli');
  assert.ok(o.P.boards.indexOf(6) >= 0, 'acilis yine kaydedilmeli');
  o.zaman(1500);
  assert.strictEqual(o.kutlamaPenceresi(), true);
  o.el.raYes.click();
  assert.strictEqual(o.el.overlay.classList.contains('show'), true, 'hamle kalmadi bitisi');
  assert.strictEqual(o.el.overlayMsg.textContent, 'Hamle kalmadı');
  assert.ok(o.P.boards.indexOf(6) >= 0);
});

dene('9x9 -> "10x10\'u dene": 10x10 bilgi mesaji bir kez, tek dugme, kalici bayrak', () => {
  const o = kur({ boards: zincireKadar(9) }, 9);
  o.G.start(9);
  o.tahta([[0, 0, 16384], [0, 1, 16384]]);
  o.T.hamle('left'); o.zaman(1700);
  assert.strictEqual(o.el.raNo.textContent, "10x10'u dene");
  o.el.raNo.click();
  assert.strictEqual(o.T.durum().size, 10);
  assert.strictEqual(o.pencere(), true, '10x10 mesaji yok');
  assert.strictEqual(o.el.raTitle.textContent + ' ' + o.el.raSub.textContent, 'Bu tahtada hedef yok. Kaybedene kadar oynayacaksın.');
  assert.strictEqual(o.el.raYes.textContent, 'Anladım');
  assert.strictEqual(o.el.raNo.style.display, 'none');
  assert.strictEqual(o.P.h2048OnMesaj, 1);
  o.el.raYes.click();
  assert.strictEqual(o.pencere(), false);
  // 10x10'da hedef/kutlama yok
  o.tahta([[0, 0, 32768], [0, 1, 32768], [5, 5, 65536], [5, 6, 65536]]);
  o.T.hamle('left'); o.zaman(1800);
  assert.strictEqual(o.T.durum().kutlamaAcik, false);
  assert.strictEqual(o.pencere(), false);
  assert.deepStrictEqual(kopya(o.P.boards), [5, 6, 7, 8, 9, 10]);
  // tekrar baslatma: mesaj yok (ayni oturum ve yeni oturum)
  o.G.start(10);
  assert.strictEqual(o.pencere(), false, 'ayni oturumda tekrar mesaj');
  // yeni oturum, yarim oyun yok: dogrudan yeni oyun, mesaj yok
  const p2 = kopya(o.P); p2.g2048active = null;
  const o2 = kur(p2, 2);
  o2.G.start(10);
  assert.strictEqual(o2.pencere(), false, 'yeni oturumda tekrar mesaj');
  // yeni oturum, yarim 10x10 oyun var: yalnizca devam sorusu, devamdan sonra mesaj yok
  assert.ok(o.P.g2048active && o.P.g2048active.size === 10, '10x10 yarim oyun kaydi yok');
  const o3 = kur(kopya(o.P), 3);
  o3.G.start(10);
  assert.strictEqual(o3.el.raTitle.textContent, 'Kaldığın yerden devam edelim mi?');
  o3.el.raYes.click();
  assert.strictEqual(o3.pencere(), false, 'devamdan sonra tekrar mesaj');
  assert.strictEqual(o3.T.durum().size, 10);
});

dene('eski kayitta 10x10 (altinla alinmis), bayrak yok: ilk baslatmada mesaj; yeni bayrak eski kayda eklenir', () => {
  const o = kur({ boards: [5, 10] }, 11);
  o.G.start(10);
  assert.strictEqual(o.el.raYes.textContent, 'Anladım');
  assert.strictEqual(o.P.h2048OnMesaj, 1);
  assert.deepStrictEqual(kopya(o.P.boards), [5, 10]);
});

dene('tahta secim ekrani: kilitli tahtada fiyat yok, kosul metni; dokunmak acmaz, altin harcanmaz', () => {
  const o = kur({ boards: [5, 7], gold: 999999 }, 12);
  const B = o.win.Boards2048;
  B.open();
  const tahta = n => o.el.bdStage.querySelectorAll('.bd-tile').find(t => Number(t.dataset.size) === n);
  [5, 6, 7, 8, 9, 10].forEach(n => {
    const t = tahta(n);
    assert.ok(t, n + ' yok');
    const kilitli = n === 6 || n >= 8;
    assert.strictEqual(t.classList.contains('locked'), kilitli, n + ' kilit durumu');
    assert.ok(!/app-coin|bd-price/.test(t.innerHTML), n + ' fiyat/jeton gorunuyor');
    if (kilitli) assert.ok(t.innerHTML.indexOf(A.kilitMetni(n)) >= 0, n + ' kosul metni yok');
    else assert.ok(!/bd-lock/.test(t.innerHTML), n + ' acik ama kilitli');
  });
  // kilitli 8x8: once ortaya, sonra dokun -> ipucu kosul, hicbir sey acilmaz
  o.el.bdStage.yay('click', { target: tahta(8) });
  assert.strictEqual(o.el.bdHint.textContent, 'Önceki tahtada 8192 karosuna ulaş');
  o.el.bdStage.yay('click', { target: tahta(8) });
  assert.strictEqual(o.el.bdHint.textContent, 'Önceki tahtada 8192 karosuna ulaş');
  assert.strictEqual(o.P.gold, 999999);
  assert.deepStrictEqual(kopya(o.P.boards), [5, 7]);
  assert.strictEqual(o.boardsYazimi().length, 0);
  assert.strictEqual(o.gecis.length, 0);
  // acik 7x7 (eski altin alimi): oynanir
  B.handleBack();
  o.el.bdStage.yay('click', { target: tahta(7) });
  o.el.bdStage.yay('click', { target: tahta(7) });
  assert.deepStrictEqual(o.gecis[0], ['ileri', 'boards2048', 'game2048']);
  assert.strictEqual(o.T.durum().size, 7);
});

dene('eski oyun kaydi (g2048active, yeni alan yok) aynen geri yuklenir', () => {
  const eski = { size: 6, score: 5000, tiles: [[0, 0, 2048, 0, 0, 0], [0, 1, 2048, 0, 0, 0], [2, 2, 0, 0, 0, 1]], milestones: [2048] };
  const o = kur({ boards: [5, 6], g2048active: eski, bests: { b6: 9000 } }, 13);
  o.G.start(6);
  assert.strictEqual(o.pencere(), true);           // kaldigin yerden devam?
  o.el.raYes.click();
  const d = o.T.durum();
  assert.strictEqual(d.size, 6); assert.strictEqual(d.score, 5000);
  assert.deepStrictEqual(kopya(d.karolar).sort(), [[0, 0, 2048, 0], [0, 1, 2048, 0], [2, 2, 0, 1]].sort());
  // 2048+2048 -> 4096: 6x6 hedefi, 7x7 acilir
  o.T.hamle('left'); o.zaman(1700);
  assert.deepStrictEqual(kopya(o.P.boards), [5, 6, 7]);
  assert.strictEqual(o.kutlamaPenceresi(), true);
});

// Hedef karoyu olusturan hamle tahtayi tikar: satir 0 sola [2048,128,256,8,X], geri kalan
// 32/64 dama; X (2/4) hicbir komsuyla eslesmez. Joker/kilit cikmayan tohum aranir.
// kilitli: (2,0) 64 ve kilitli -> komsulari (1,0),(2,1),(3,0) 64; tikanma YALNIZCA kilitten.
function tikaliHedef(secenek, kilitli) {
  for (let t = 1; t < 80; t++) {
    const d = kur({ boards: [5] }, 100 + t, secenek);
    d.G.start(5);
    d.tahta([[0, 0, 1024], [0, 1, 1024], [0, 2, 128], [0, 3, 256], [0, 4, 8]]);
    for (let r = 1; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (kilitli && r === 2 && c === 0) d.T.karoKoy(r, c, 64, 3);
      else d.T.karoKoy(r, c, (r + c) % 2 ? 64 : 32);
    }
    d.T.hamle('left'); d.zaman(200);
    const yeni = d.T.durum().karolar.find(k => k[0] === 0 && k[1] === 4);
    if (yeni && (yeni[2] === 2 || yeni[2] === 4)) return d;
  }
  throw new Error('uygun tohum bulunamadi');
}
// Tam dolu, hamlesiz 5x5 kayit (32/64 dama). kilit: (0,0) 64 ve kilitli; (0,1)=64 ile
// eslesir ama kilit yuzunden birlesemez.
function oluKayit(kilit) {
  const t = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) t.push([r, c, (r + c) % 2 ? 64 : 32, 0, 0, 0]);
  if (kilit) t[0] = [0, 0, 64, 2, 0, 0];
  return { size: 5, score: 5000, tiles: t, milestones: [32, 64] };
}

dene('tikali hedef hamlesi: hamlesiz durum diske yazilmaz; kutlama acikken kapanirsa yeni oturumda oyuncu sikismaz', () => {
  const o = tikaliHedef();
  assert.strictEqual(o.P.g2048active, null, 'hamlesiz durum diske yazilmis');
  assert.ok(o.P.boards.indexOf(6) >= 0, 'acilis yine kaydedilmeli');
  o.zaman(1500);
  assert.strictEqual(o.kutlamaPenceresi(), true);
  const o2 = kur(kopya(o.P), 21);          // pencere acikken kapandi: diskteki kayitla yeni oturum
  o2.G.start(5);
  assert.strictEqual(o2.pencere(), false, 'olu oyun icin devam sorusu cikmamali');
  assert.strictEqual(o2.T.durum().score, 0);
  o2.tahta([[2, 0, 2], [2, 1, 2]]);
  o2.T.hamle('left'); o2.zaman(200);
  assert.strictEqual(o2.T.durum().score, 4, 'yeni oyunda hamle calismali');
});

dene('tikali (yalnizca kilitten) hedef + "devam et": kilitler cozulur, oyun surer, kayit geri yazilir', () => {
  const o = tikaliHedef(null, true);
  assert.strictEqual(o.P.g2048active, null);
  o.zaman(1500);
  o.el.raYes.click();
  assert.strictEqual(o.el.overlay.classList.contains('show'), false, 'oyun bitmemeli');
  assert.ok(o.P.g2048active && o.P.g2048active.score === o.T.durum().score, 'surebilen oyun kaydedilmeli');
  assert.ok(o.P.g2048active.tiles.every(t => !t[3]), 'kilitler cozulmus olmali');
});

dene('hamlesiz kayit geri yuklenince kayip akisi calisir: ikinci sans / kayip ekrani / kilit cozme', () => {
  const cagri = [];
  const a = kur({ boards: [5], g2048active: oluKayit() }, 22, { reklam: cagri });
  a.G.start(5);
  assert.strictEqual(a.el.raTitle.textContent, 'Kaldığın yerden devam edelim mi?');
  a.el.raYes.click();
  assert.strictEqual(cagri.length, 1, 'ikinci sans sorulmadi');
  assert.strictEqual(a.P.g2048active, null, 'olu kayit diskte kaldi');
  const b = kur({ boards: [5], g2048active: oluKayit() }, 23);   // reklam yok
  b.G.start(5); b.el.raYes.click();
  assert.strictEqual(b.el.overlay.classList.contains('show'), true, 'kayip ekrani yok');
  assert.strictEqual(b.el.overlayMsg.textContent, 'Hamle kalmadı');
  assert.strictEqual(b.P.g2048active, null);
  const c = kur({ boards: [5], g2048active: oluKayit(true) }, 24);   // yalnizca kilit
  c.G.start(5); c.el.raYes.click();
  assert.strictEqual(c.el.overlay.classList.contains('show'), false);
  c.T.hamle('left'); c.zaman(200);
  assert.ok(c.T.durum().score > 5000, 'kilit cozulunce hamle calismali');
});

dene('kutlama acikken start() ile ekrana yeniden giris: kutlama kapanir, pencere sonradan acilmaz, oyun surer', () => {
  // pencere acilmadan once (parlama sirasinda) ayni tahtaya donus
  const a = kur({ boards: [5] }, 31);
  a.G.start(5);
  a.tahta([[0, 0, 1024], [0, 1, 1024]]);
  a.T.hamle('left'); a.zaman(300);
  assert.strictEqual(a.T.durum().kutlamaAcik, true);
  a.G.start(5);
  assert.strictEqual(a.T.durum().kutlamaAcik, false);
  a.zaman(3000);
  assert.strictEqual(a.pencere(), false, 'eski zamanlayici pencereyi acti');
  assert.strictEqual(a.el.tileLayer.querySelectorAll('.tile-parca').length, 0, 'konfeti kaldi');
  assert.strictEqual(a.T.durum().score, 2048);
  a.T.karoKoy(3, 0, 2); a.T.karoKoy(3, 1, 2);
  a.T.hamle('left'); a.zaman(200);
  assert.strictEqual(a.T.durum().score, 2048 + 4);
  // pencere aciktayken ayni tahta
  const b = kur({ boards: [5] }, 32);
  b.G.start(5);
  b.tahta([[0, 0, 1024], [0, 1, 1024]]);
  b.T.hamle('left'); b.zaman(1700);
  assert.strictEqual(b.kutlamaPenceresi(), true);
  b.G.start(5);
  assert.strictEqual(b.pencere(), false);
  assert.strictEqual(b.el.resumeAsk.classList.contains('kutlama'), false);
  b.T.karoKoy(3, 0, 2); b.T.karoKoy(3, 1, 2);
  b.tus('ArrowLeft'); b.zaman(200);
  assert.strictEqual(b.T.durum().score, 2048 + 4);
  // pencere aciktayken baska tahta: normal silme sorusu, kutlama gorunumu yok
  const c = kur({ boards: [5] }, 33);
  c.G.start(5);
  c.tahta([[0, 0, 1024], [0, 1, 1024]]);
  c.T.hamle('left'); c.zaman(1700);
  c.G.start(6);
  assert.strictEqual(c.el.raTitle.textContent, 'Aktif 5x5 oyunun silinsin mi?');
  assert.strictEqual(c.el.resumeAsk.classList.contains('kutlama'), false);
  assert.strictEqual(c.T.durum().kutlamaAcik, false);
});

dene('azaltilmis hareket: parlama/konfeti yok, pencere hemen acilir', () => {
  const o = kur({ boards: [5] }, 41, { azalt: true });
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o.T.hamle('left'); o.zaman(150);
  assert.strictEqual(o.kutlamaPenceresi(), true, 'pencere hemen acilmadi');
  assert.strictEqual(o.el.tileLayer.querySelectorAll('.tile-parca').length, 0);
  assert.strictEqual(o.el.tileLayer.querySelectorAll('.hedef-parla').length, 0);
});

dene('"dene" sonrasi konfeti kalmaz', () => {
  const o = kur({ boards: [5] }, 42);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o.T.hamle('left'); o.zaman(1700);
  assert.ok(o.el.tileLayer.querySelectorAll('.konfeti').length > 0, 'pencere acilirken konfeti beklenirdi');
  o.el.raNo.click();
  assert.strictEqual(o.T.durum().size, 6);
  assert.strictEqual(o.el.tileLayer.querySelectorAll('.tile-parca').length, 0, 'dene sonrasi konfeti kaldi');
});

dene('ayni hamlede rekor + hedef: zafer sesi bir kez; hedefsiz rekorda ses yine calar', () => {
  const o = kur({ boards: [5] }, 43);
  o.G.start(5);
  o.tahta([[0, 0, 1024], [0, 1, 1024]]);
  o.T.hamle('left'); o.zaman(1700);
  assert.ok(o.el.scoreBox.classList.contains('record'), 'rekor kirilmadi');
  assert.strictEqual(o.zaferSesi(), 1, 'zafer sesi sayisi');
  const r = kur({ boards: [5] }, 44);
  r.G.start(5);
  r.tahta([[0, 0, 2], [0, 1, 2]]);
  r.T.hamle('left'); r.zaman(500);
  assert.ok(r.el.scoreBox.classList.contains('record'));
  assert.strictEqual(r.zaferSesi(), 1, 'rekor sesi calmadi');
});

dene('kayit gocu: KAYIT_SURUM degismedi, yeni alan (h2048OnMesaj) ve boards gocte korunur', () => {
  const core = fs.readFileSync(path.join(KOK, 'js', 'core.js'), 'utf8');
  const b = core.indexOf('const KAYIT_SURUM'), s = core.indexOf('window.AppKayitGoc');
  const c = {};
  vm.runInNewContext(core.slice(b, s) + '\nthis.gocEt = gocEt; this.SURUM = KAYIT_SURUM; this.v = varsayilanIlerleme;', c);
  assert.strictEqual(c.SURUM, 3);
  assert.ok(!('boards' in c.v()) && !('h2048OnMesaj' in c.v()), 'varsayilan degismemeli');
  const kayitli = { surum: 3, gold: 5, boards: [5, 6, 8], h2048OnMesaj: 1, bests: { b5: 100 } };
  const g = c.gocEt(kopya(kayitli));
  assert.strictEqual(g.degisti, false);
  assert.deepStrictEqual(kopya(g.p), kayitli);
  const eski = c.gocEt({ unlocked: 3, boards: [5, 6] });   // surumsuz eski kayit
  assert.deepStrictEqual(kopya(eski.p.boards), [5, 6]);
  assert.strictEqual(eski.p.h2048OnMesaj, undefined);
  assert.deepStrictEqual(kopya(A.sahipler(eski.p)), [5, 6]);
});

console.log(gecti + ' deneme gecti' + (process.exitCode ? ' (HATA VAR)' : ''));
