// sandikTest.js — market gumus/altin sandik kurallarini dener (market.js sandikDagilimi/sandikCek/sandikAc).
// Calistirma:  node tools/sandikTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const oku = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

function kur(bakiye) {
  const win = { AppProgress: { gold: bakiye || 0 }, AppSaveProgress() {}, AppReset: [], AppStore: { get: (k, d) => d, set() {} } };
  win.AppGold = {
    get: () => win.AppProgress.gold,
    add: n => { win.AppProgress.gold += n; },
    harca: n => { if (win.AppProgress.gold < n) return false; win.AppProgress.gold -= n; return true; }
  };
  const el = () => ({ style: { setProperty() {}, removeProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, dataset: {} });
  const document = { querySelector: el, querySelectorAll: () => [], getElementById: el, createElement: el, documentElement: el(), body: el() };
  const ctx = { window: win, document, console };
  vm.createContext(ctx);
  vm.runInContext(oku('marketKatalog.js') + '\n' + oku('market.js'), ctx);
  return win;
}

// tohumlu rng (mulberry32)
function rngYap(t) {
  return () => {
    t |= 0; t = t + 0x6D2B79F5 | 0;
    let x = Math.imul(t ^ t >>> 15, 1 | t);
    x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
const toplam = o => Object.values(o).reduce((a, b) => a + b, 0);
const SIRA = ['siradan', 'nadir', 'ender', 'efsanevi'];

const w = kur(0), M = w.AppMarket;
const satilik = M.temalar().filter(t => !t.varsayilan);
const idler = nad => satilik.filter(t => !nad || t.nadirlik === nad).map(t => t.id);
const yak = (...nads) => [].concat(...nads.map(n => idler(n)));

console.log('market sandiklari');

dene('fiyatlar degismedi (1000, 3500)', () => {
  assert.strictEqual(M.sandikBul('gumus').fiyat, 1000);
  assert.strictEqual(M.sandikBul('altin').fiyat, 3500);
});

dene('katalog oranlari yeni degerlerde', () => {
  assert.deepStrictEqual({ ...M.sandikBul('gumus').ihtimal }, { siradan: 0.59375, nadir: 0.35625, ender: 0.05, efsanevi: 0 });
  assert.deepStrictEqual({ ...M.sandikBul('altin').ihtimal }, { siradan: 0.10, nadir: 0.35, ender: 0.30, efsanevi: 0.25 });
});

dene('her nadirlikte tema var (test varsayimi)', () => {
  SIRA.forEach(n => assert.ok(idler(n).length > 0, n));
});

dene('oran toplami 1: tam ve yeniden dagitilmis durumlar', () => {
  const durumlar = [[], yak('siradan'), yak('nadir'), yak('ender'), yak('efsanevi'), yak('siradan', 'nadir'),
    yak('siradan', 'efsanevi'), yak('nadir', 'ender', 'efsanevi'), idler('siradan').slice(1)];
  ['gumus', 'altin'].forEach(sid => durumlar.forEach(sahip => {
    const d = M.sandikDagilimi(sid, sahip);
    if (d) assert.ok(Math.abs(toplam(d) - 1) < 1e-12, sid + ' ' + toplam(d));
  }));
  assert.ok(Math.abs(toplam(M.sandikDagilimi('gumus', [])) - 1) < 1e-12);
});

dene('tam havuz: oranlar katalogla ayni', () => {
  const g = M.sandikDagilimi('gumus', []), a = M.sandikDagilimi('altin', []);
  SIRA.forEach(n => {
    assert.ok(Math.abs(g[n] - M.sandikBul('gumus').ihtimal[n]) < 1e-12, 'gumus ' + n);
    assert.ok(Math.abs(a[n] - M.sandikBul('altin').ihtimal[n]) < 1e-12, 'altin ' + n);
  });
});

dene('bos grup orantili dagitilir (tum siradanlar sahip)', () => {
  const g = M.sandikDagilimi('gumus', yak('siradan'));
  assert.strictEqual(g.siradan, 0);
  assert.ok(Math.abs(g.nadir - 0.35625 / 0.40625) < 1e-12);
  assert.ok(Math.abs(g.ender - 0.05 / 0.40625) < 1e-12);
  assert.strictEqual(g.efsanevi, 0);
  const a = M.sandikDagilimi('altin', yak('siradan'));
  assert.ok(Math.abs(a.nadir - 0.35 / 0.90) < 1e-12);
  assert.ok(Math.abs(a.ender - 0.30 / 0.90) < 1e-12);
  assert.ok(Math.abs(a.efsanevi - 0.25 / 0.90) < 1e-12);
});

dene('gumusta efsanevi hicbir zaman pay almaz', () => {
  [[], yak('siradan'), yak('siradan', 'nadir'), yak('siradan', 'nadir', 'ender')].forEach(s => {
    const g = M.sandikDagilimi('gumus', s);
    if (g) assert.strictEqual(g.efsanevi, 0);
  });
});

dene('sahip olunan tema hic cikmaz (cok cekim)', () => {
  ['gumus', 'altin'].forEach(sid => {
    const rng = rngYap(7), sahip = [];
    for (let i = 0; i < 20000; i++) {
      const t = M.sandikCek(sid, sahip, rng);
      if (!t) break;
      assert.ok(sahip.indexOf(t.id) < 0, sid + ' tekrar: ' + t.id);
      assert.ok(M.sandikDagilimi(sid, sahip)[t.nadirlik] > 0);
      sahip.push(t.id);
    }
    const sabit = idler('siradan').concat(idler('nadir').slice(0, 1));
    for (let i = 0; i < 20000; i++) { const t = M.sandikCek(sid, sabit, rng); assert.ok(sabit.indexOf(t.id) < 0); }
  });
});

dene('gumus: cikarabildigi her temayi verince biter, efsanevi hic cikmaz', () => {
  const rng = rngYap(3), sahip = [];
  let t;
  while ((t = M.sandikCek('gumus', sahip, rng))) { assert.notStrictEqual(t.nadirlik, 'efsanevi'); sahip.push(t.id); }
  assert.strictEqual(sahip.length, idler().length - idler('efsanevi').length);
});

dene('simulasyon: 200k cekimde gerceklesen oranlar beklenene yakin (0.5 puan)', () => {
  const senaryolar = [['gumus', []], ['altin', []], ['gumus', yak('siradan')], ['altin', yak('siradan')], ['altin', yak('ender')]];
  senaryolar.forEach(([sid, sahip], k) => {
    const rng = rngYap(100 + k), sayac = { siradan: 0, nadir: 0, ender: 0, efsanevi: 0 }, N = 200000;
    for (let i = 0; i < N; i++) sayac[M.sandikCek(sid, sahip, rng).nadirlik]++;
    const d = M.sandikDagilimi(sid, sahip);
    SIRA.forEach(n => assert.ok(Math.abs(sayac[n] / N - d[n]) < 0.005, sid + ' ' + n + ' ' + (sayac[n] / N) + ' vs ' + d[n]));
  });
});

dene('tum temalar sahip: sandik pasif (tamam), coin harcanmaz, sonuc kapali', () => {
  const x = kur(0), m = x.AppMarket;
  x.AppProgress.gold = 1e9;
  m.temalar().forEach(t => { if (!t.varsayilan) m.satinAl(t.id); });
  x.AppProgress.gold = 50000;
  assert.strictEqual(m.kalanVarMi(), false);
  ['gumus', 'altin'].forEach(sid => {
    assert.strictEqual(m.sandikDagilimi(sid), null);
    assert.strictEqual(m.sandikDurum(sid), 'tamam');
    assert.strictEqual(m.sandikAc(sid).tur, 'kapali');
    assert.strictEqual(x.AppProgress.gold, 50000);
  });
});

dene('gumusta yalniz efsanevi kaldi: gumus pasif (bos), altin aktif, coin harcanmaz', () => {
  const x = kur(0), m = x.AppMarket;
  x.AppProgress.gold = 1e9;
  m.temalar().forEach(t => { if (!t.varsayilan && t.nadirlik !== 'efsanevi') m.satinAl(t.id); });
  x.AppProgress.gold = 50000;
  assert.strictEqual(m.sandikDurum('gumus'), 'bos');
  assert.strictEqual(m.sandikDurum('altin'), 'aktif');
  assert.strictEqual(m.sandikAc('gumus').tur, 'kapali');
  assert.strictEqual(x.AppProgress.gold, 50000);
  const r2 = m.sandikAc('altin');
  assert.strictEqual(r2.tur, 'tema');
  assert.strictEqual(r2.tema.nadirlik, 'efsanevi');
  assert.strictEqual(x.AppProgress.gold, 50000 - 3500);
  assert.ok(m.sahipMi(r2.tema.id));
});

dene('sandikAc: jeton yetmezse null, bakiye ayni', () => {
  const x = kur(999), m = x.AppMarket;
  assert.strictEqual(m.sandikAc('gumus'), null);
  assert.strictEqual(x.AppProgress.gold, 999);
});

dene('sandikAc: hep yeni tema, iade yok, koleksiyon tamamlanir', () => {
  const x = kur(0), m = x.AppMarket;
  x.AppProgress.gold = 1e9;
  const goren = new Set();
  for (let i = 0; i < 500 && m.kalanVarMi(); i++) {
    let r = m.sandikAc(i % 2 ? 'gumus' : 'altin');
    if (r.tur === 'kapali') r = m.sandikAc('altin');
    if (r.tur === 'kapali') break;
    assert.strictEqual(r.tur, 'tema');
    assert.ok(!goren.has(r.tema.id));
    goren.add(r.tema.id);
  }
  assert.ok(goren.size > 0);
});

// ---- gercek tarayicida sandik duzeni (Chrome yoksa atlanir, basarisiz sayilmaz) ----
dene('tarayici: pasif/aktif sandik dugmeleri 320 ve 390 pxte tasmaz', () => {
  const cp = require('child_process');
  const adaylar = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const chrome = adaylar.find(a => a && fs.existsSync(a));
  if (!chrome) { console.log('       ATLANDI (Chrome yok): CHROME_YOL verin'); return; }
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'sandikYakala.js'), chrome, String(9400 + Math.floor(Math.random() * 400))],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 1 << 26 });
  assert.strictEqual(r.status, 0, r.stderr);
  const sonuc = JSON.parse(r.stdout);
  assert.strictEqual(sonuc.length, 6);
  sonuc.forEach(o => assert.deepStrictEqual(o.tasma, [], o.durum + ' ' + o.genislik + ': ' + o.tasma.join('; ')));
});

console.log(gecti + ' gecti' + (process.exitCode ? ', HATA VAR' : ''));
