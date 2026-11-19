// atesBocegiOyunTest.js — js/atesBocegiOyun.js'i sahte DOM/canvas ile dener (gorsel dogrulamaz).
// Kapsam: tek odeme, gun degisimi, yarim kosu odemez, sifirla, offstage'de rAF durur,
// olum sonrasi isik sonme akisi ekran kapaninca iptal, bozuk/yeni surum kaydi, ilk kosuda rekor yok,
// isik sonme: karanlik cokmeden kart gelmez, yeniden baslat/geri ile cift kart ve cift odeme olmaz.
// Karanliktasuzul: geri tusu yollari dur() cagirir (core.js kaynak + davranis), yutulan toz cizilmez,
// bomba/sarmasik her fazda cizim ve olay hatasiz, bomba/unlem karanlik katmanin ustunde cizilir.
// Calistirma:  node tools/atesBocegiOyunTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const AB = require(path.join(__dirname, '..', 'js', 'atesBocegi.js'));
const KAYNAK = fs.readFileSync(path.join(__dirname, '..', 'js', 'atesBocegiOyun.js'), 'utf8');

function ortam() {
  const o = { oyuk: 0, rafF: null, zamanlayicilar: [], goldAdd: [], yazim: 0, durum: null, t: 0, basili: false, ses: 0, sesLog: [], titresim: [], log: null };
  const proxyCtx = () => new Proxy({}, {
    get(h, k) { if (k in h) return h[k]; return (...a) => { if (o.log) o.log.push([k, a]); return /Gradient/.test(k) ? { addColorStop() {} } : undefined; }; },
    set(h, k, v) { if (k === 'globalCompositeOperation' && v === 'destination-out') o.oyuk++; h[k] = v; return true; }
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
    matchMedia: () => ({ matches: !!o.azHareket }), CoinSVG: () => '<img>',
    AppProgress: { surum: 3, gold: 10, atesBocegi: null },
    AppFX: { tone(a, b, sure, tip) { o.ses++; o.sesLog.push(['tone', a, tip]); }, seq(n, tip) { o.ses++; o.sesLog.push(['seq', n[0][0], tip]); }, vibrate(p) { o.titresim.push(p); } }
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
  // Sonme artik zamanlayici degil kare tabanli: "zamanlayicilari calistir" = sonme suresini (0.85 sn) bitirecek kadar kare
  o.zamanlayicilariCalistir = () => { o.kare(80); };
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

dene('isik sonme: olumden hemen sonra kart YOK; isik sonerken kart gelmez, bitince tek kart', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30);
  assert.ok(o.durum.bitti); assert.ok(!o.el('abSonuc').cl.has('show'), 'olumde kart hemen gelmemeli');
  const oyuk0 = o.oyuk; o.kare(10); assert.ok(o.oyuk > oyuk0, 'isik sonerken hala cizilir');
  assert.ok(!o.el('abSonuc').cl.has('show'));
  o.kare(80);
  assert.ok(o.el('abSonuc').cl.has('show')); assert.strictEqual(o.goldAdd.length, 1);
  const o2 = o.oyuk; o.O.temaDegisti(); assert.strictEqual(o.oyuk, o2, 'sonme bitince isik yarigapi 0: delik acilmaz (tam karanlik)');
});

dene('isik sonme: dunya donar (mesafe kart gelince sabit), ses calar', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30);
  const ses = o.ses; o.kare(80); assert.ok(o.el('abSonuc').cl.has('show'));
  const m = o.durum.mesafe; o.kare(30); assert.strictEqual(o.durum.mesafe, m); assert.ok(o.ses > ses);
});

dene('isik sonme: azaltilmis harekette kisa (30 kare icinde kart)', () => {
  const o = ortam(); o.azHareket = true; o.yeni(); o.olum(2600, 30);
  o.kare(30); assert.ok(o.el('abSonuc').cl.has('show'));
});

dene('yaris: sonme sirasinda geri (dur) -> kart/cift odeme yok, yeni kosu temiz', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30); o.kare(5);
  o.O.dur(); o.kare(80);
  assert.ok(!o.el('abSonuc').cl.has('show')); assert.strictEqual(o.goldAdd.length, 1);
  o.O.start(); o.bas(); o.kare(100);
  assert.ok(!o.el('abSonuc').cl.has('show')); assert.strictEqual(o.goldAdd.length, 1);
});

dene('yaris: sonme sirasinda yeniden baslat (start) -> eski kosunun karti gelmez, odeme tek', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30); o.kare(5);
  o.O.start(); o.bas(); o.kare(90);
  assert.ok(!o.el('abSonuc').cl.has('show')); assert.strictEqual(o.goldAdd.length, 1); assert.ok(!o.durum.bitti);
});

dene('yaris: sonme sirasinda girdi/duraklat/tekrar tiklari cift islem yapmaz', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30);
  o.bas(); o.birak(); o.el('abDurBtn').dinle.click(); o.el('abDevam').dinle.click(); o.kare(80);
  assert.strictEqual(o.goldAdd.length, 1); assert.ok(o.el('abSonuc').cl.has('show')); assert.ok(!o.el('abDuraklat').cl.has('show'));
  o.el('abTekrar').dinle.click(); o.el('abTekrar').dinle.click();
  assert.strictEqual(o.goldAdd.length, 1); assert.ok(!o.el('abSonuc').cl.has('show'));
});

dene('Dokun ve basla ipucu: kosu basinda gorunur (show), dokununca kalkar', () => {
  const o = ortam(); o.O.start(); assert.ok(o.el('abIpucu').cl.has('show'));
  o.kare(30); assert.ok(o.el('abIpucu').cl.has('show'), 'dokunana kadar kalir');
  o.bas(); assert.ok(!o.el('abIpucu').cl.has('show'));
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

// ---------------------------------------------------------------
// Karanliktasuzul: geri tusu, yutulan toz, bomba, sarmasik
// ---------------------------------------------------------------
const CORE = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');
const M = AB.AYAR.hareket, XB = AB.AYAR.dunya.X_BOCEK, W = AB.AYAR.dunya.W, H = AB.AYAR.dunya.H;

dene('geri tusu (kaynak): core.js atesBackBtn tiklamasi ve popstate (last[1] === ates) dur() cagirir, ekran gecisinden once', () => {
  const b = /atesBackBtn\.addEventListener\('click', \(\) => \{([^}]*)\}\);/.exec(CORE);
  assert(b, 'atesBackBtn dinleyicisi bulunamadi');
  assert(/AtesBocegiOyun\.dur\(\)/.test(b[1]) && b[1].indexOf('dur()') < b[1].indexOf('slideBack'), 'atesBackBtn dur() sonra slideBack');
  const p = /function handlePopstate\(\)\{[\s\S]*?\n  \}/.exec(CORE);
  assert(p, 'handlePopstate bulunamadi');
  const g = /if\(last\[1\] === 'ates' && window\.AtesBocegiOyun\) window\.AtesBocegiOyun\.dur\(\);\s*_back\(last\[1\], last\[0\]\);/.exec(p[0]);
  assert(g, "popstate: last[1] === 'ates' -> dur() sonra _back");
});

dene('geri tusu (davranis): ekrandaki geri dugmesi yolu abAna -> atesBackBtn; dur() sonrasi rAF yok, ses kesik, odeme yok', () => {
  const o = ortam(); o.yeni(); o.kare(60);
  let geri = 0; o.el('atesBackBtn').dinle.click = () => { geri++; o.O.dur(); };       // core.js: dur() + slideBack
  o.el('abAna').dinle.click();
  assert.strictEqual(geri, 1); assert.strictEqual(o.rafF, null);
  const ses = o.ses; o.kare(120); o.zamanlayicilariCalistir();
  assert.strictEqual(o.ses, ses, 'dur() sonrasi ses yok'); assert.strictEqual(o.goldAdd.length, 0); assert.strictEqual(o.yazim, 0);
  assert.ok(!o.el('abSonuc').cl.has('show'));
});

dene('geri tusu (davranis): olum sonmesi sirasinda popstate yolu dur(): rAF durur, kart ve ikinci odeme yok', () => {
  const o = ortam(); o.yeni(); o.olum(2600, 30); o.kare(5);
  const ses = o.ses; o.O.dur(); o.kare(100);
  assert.strictEqual(o.rafF, null); assert.strictEqual(o.ses, ses); assert.strictEqual(o.goldAdd.length, 1);
  assert.ok(!o.el('abSonuc').cl.has('show'));
});

function sutunlu(x, h, yon) { return { x: x, y: yon === 'ust' ? 0 : H - h, w: 3, h: h, tx: x + 1.5, ty: yon === 'ust' ? h - 1 : H - h + 1 }; }
function ciziliyor(o) { o.log = []; o.kare(1); const l = o.log; o.log = null; return l; }

dene('yutulan toz cizilmez, alinmamis toz cizilir', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  const s = o.durum.dilimler.find(d => d.toz.some(t => t.x - o.durum.mesafe > 6 && t.x - o.durum.mesafe < W - 6));
  const t = s.toz.find(t => t.x - o.durum.mesafe > 6 && t.x - o.durum.mesafe < W - 6);
  const say = () => ciziliyor(o).filter(c => c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][2] - (t.y - M.R_TOZ_GORSEL * 3.2)) < 1e-6 && Math.abs(c[1][3] - M.R_TOZ_GORSEL * 6.4) < 1e-6).length;
  assert.strictEqual(say(), 1, 'toz cizilmeli');
  t.yutuldu = 1; assert.strictEqual(say(), 0, 'yutulan toz cizilmemeli');
});

dene('bomba: karanlik katmanin USTUNDE cizilir (kendi isigiyla gorunur), cekirdek ve sprite', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  o.durum.dilimler[0].bomba = { x: o.durum.mesafe + 30, y: 40, alindi: 0 };
  const l = ciziliyor(o);
  let kk = -1; l.forEach((c, i) => { if (c[0] === 'drawImage' && c[1].length === 3) kk = i; });   // karanlik tuvali (3 arguman) en son
  assert(kk > 0, 'karanlik katman cizimi bulunamadi');
  const bomba = l.map((c, i) => [c, i]).filter(([c, i]) => i > kk && c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][3] - M.R_BOMBA * 2) < 1e-6);
  assert.strictEqual(bomba.length, 1, 'bomba sprite karanligin ustunde 1 kez');
  assert.ok(l.slice(kk).some(c => c[0] === 'arc' && Math.abs(c[1][2] - M.R_BOMBA * 0.36) < 0.1 * M.R_BOMBA), 'cekirdek');
  o.durum.dilimler[0].bomba.alindi = 1;
  assert.strictEqual(ciziliyor(o).filter(c => c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][3] - M.R_BOMBA * 2) < 1e-6).length, 0, 'alinan bomba cizilmez');
});

dene('bomba toplama: ayri alcak ses (110 Hz sine), titresim, parcacik <= 24, isik 0,25 duser; azaltilmis harekette parcacik yok', () => {
  [false, true].forEach(az => {
    const o = ortam(); o.azHareket = az; o.yeni();
    o.durum.dilimler[0].bomba = { x: o.durum.mesafe + XB + 0.5, y: o.durum.y, alindi: 0 };
    const isik = o.durum.isik, ses0 = o.sesLog.length; o.log = [];
    o.kare(1);
    assert.ok(o.durum.dilimler[0].bomba.alindi, 'bomba alinmali');
    assert.ok(isik - o.durum.isik >= AB.AYAR.isik.BOMBA_HASAR - 1e-6);
    assert.ok(o.sesLog.slice(ses0).some(x => x[0] === 'tone' && x[1] === 110 && x[2] === 'sine'), 'bomba sesi');
    assert.ok(o.titresim.length >= 1);
    const parc = o.log.filter(c => c[0] === 'fillRect' && c[1][2] === 0.6 && c[1][3] === 0.6).length; o.log = null;
    if (az) assert.strictEqual(parc, 0); else { assert.ok(parc >= 1 && parc <= 24, 'parcacik ' + parc); }
  });
});

dene('dikenli dal hasari: agir ses (150 Hz sawtooth), diger engel hasarindan ayri; kus/dusen: 220 Hz', () => {
  const dene1 = tur => {
    const o = ortam(); o.yeni(); const mesafe = o.durum.mesafe;
    o.durum.dilimler[0].engeller = [{ tur: tur, x: mesafe + XB - 1, x0: mesafe + XB - 1, ek: 0, y: 0, w: 3, h: H, yon: 'ust' }];
    o.durum.dokunulmaz = 0; const ses0 = o.sesLog.length; o.kare(2);
    return o.sesLog.slice(ses0).map(x => x[1]);
  };
  assert.ok(dene1('dal').indexOf(150) >= 0, 'dal ses 150'); assert.ok(dene1('kus').indexOf(220) >= 0, 'kus ses 220');
  assert.ok(dene1('dal').indexOf(220) < 0);
});

dene('sarmasik: her fazda (0,1,2,3) cizim hatasiz; faz 1 unlem karanligin ustunde; faz 2-3 sarmasik cizilir; azHareket de', () => {
  [false, true].forEach(az => ['ust', 'alt'].forEach(yon => {
    const o = ortam(); o.azHareket = az; o.O.start(); o.kare(1);
    const m = o.durum.mesafe, x1 = m + 25, sut = [sutunlu(x1, 40, yon), sutunlu(x1 + 8, 40, yon)];
    const sa = { yon, x1, x2: x1 + 11, sutunlar: sut, faz: 0, sure: 0, ilerleme: 0 };
    o.durum.dilimler[0].sarmasik = sa;
    for (let faz = 0; faz <= 3; faz++) {
      sa.faz = faz; sa.ilerleme = faz === 2 ? 0.5 : faz === 3 ? 1 : 0;
      const l = ciziliyor(o);
      let kk = -1; l.forEach((c, i) => { if (c[0] === 'drawImage' && c[1].length === 3) kk = i; });
      const unlem = l.slice(kk).filter(c => c[0] === 'lineTo' && c[1][0] === 2.5 && c[1][1] === 1.7).length;
      const govde = l.slice(0, kk).filter(c => c[0] === 'ellipse' && c[1][2] === 0.55 && c[1][3] === 0.28).length;
      assert.strictEqual(unlem > 0, faz === 1, 'faz ' + faz + ' unlem');
      assert.strictEqual(govde > 0, faz >= 2, 'faz ' + faz + ' yaprak');
    }
  }));
});

const sonKaranlik = l => { let kk = -1; l.forEach((c, i) => { if (c[0] === 'drawImage' && c[1].length === 3) kk = i; }); return kk; };

dene('sarmasik hayalet siluet: faz 1-3 karanligin USTUNDE kesik cizgi (sutun zarfi + uc), faz 0da yok', () => {
  ['ust', 'alt'].forEach(yon => {
    const o = ortam(); o.O.start(); o.kare(1);
    const m = o.durum.mesafe, x1 = m + 25, sa = { yon, x1, x2: x1 + 11, sutunlar: [sutunlu(x1, 40, yon), sutunlu(x1 + 8, 40, yon)], faz: 0, sure: 0, ilerleme: 0 };
    o.durum.dilimler[0].sarmasik = sa;
    for (let faz = 0; faz <= 3; faz++) {
      sa.faz = faz; sa.ilerleme = faz === 2 ? 0.2 : faz === 3 ? 1 : 0;
      const l = ciziliyor(o), kk = sonKaranlik(l), after = l.slice(kk);
      const dash = after.filter(c => c[0] === 'setLineDash' && c[1][0].length > 0).length;
      const rects = after.filter(c => c[0] === 'rect' && Math.abs(c[1][2] - 3) < 1e-9 && Math.abs(c[1][3] - 40) < 1e-9);
      assert.strictEqual(dash > 0, faz >= 1, yon + ' faz ' + faz + ' kesik cizgi'); assert.strictEqual(rects.length, faz >= 1 ? 2 : 0, yon + ' faz ' + faz + ' zarf');
      if (faz >= 1) { const ucY = yon === 'ust' ? 40 : H - 40; assert.ok(after.some(c => c[0] === 'moveTo' && Math.abs(c[1][1] - ucY) < 1e-9), 'uc isareti'); }
    }
  });
});

dene('sarmasik ekran disi sutun (x - mesafe > W): unlem sag kenarda, uc yuksekliginde (kacis seviyesi)', () => {
  ['ust', 'alt'].forEach(yon => {
    const o = ortam(); o.O.start(); o.kare(1);
    const m = o.durum.mesafe, x1 = m + W + 20;
    o.durum.dilimler[0].sarmasik = { yon, x1, x2: x1 + 3, sutunlar: [sutunlu(x1, 40, yon)], faz: 1, sure: 0, ilerleme: 0 };
    const l = ciziliyor(o), after = l.slice(sonKaranlik(l));
    const tr = after.filter(c => c[0] === 'translate' && Math.abs(c[1][0] - (W - 3.2)) < 1e-9);
    assert.strictEqual(tr.length, 1, yon + ' unlem sag kenarda');
    assert.ok(Math.abs(tr[0][1][1] - (yon === 'ust' ? 43.5 : H - 40 - 3.5)) < 1e-9, yon + ' unlem y uc yuksekligi ' + tr[0][1][1]);
  });
});

dene('bomba her ekran konumunda karanligin ustunde cizilir (x = 0..W)', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  [0.5, 8, 25, 40, W - 0.5].forEach(sx => {
    o.durum.dilimler[0].bomba = { x: o.durum.mesafe + sx, y: 30, alindi: 0 };
    const l = ciziliyor(o), after = l.slice(sonKaranlik(l));
    assert.strictEqual(after.filter(c => c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][3] - M.R_BOMBA * 2) < 1e-6).length, 1, 'x=' + sx);
  });
});

dene('sarmasik: uyari -> kisa uyari sesi (880 Hz), carpinca hasar sesi (280 Hz triangle) + titresim; dal/diger sesinden ayri', () => {
  const o = ortam(); o.yeni();
  const m = o.durum.mesafe, x1 = m + XB + 20, sut = [sutunlu(x1, 100, 'ust')];
  o.durum.dilimler[0].sarmasik = { yon: 'ust', x1, x2: x1 + 3, sutunlar: sut, faz: 0, sure: 0, ilerleme: 0 };
  o.durum.dilimler[0].engeller = []; o.durum.dokunulmaz = 0;
  const ses0 = o.sesLog.length; o.kare(2);
  assert.ok(o.sesLog.slice(ses0).some(x => x[0] === 'seq' && x[1] === 880), 'uyari sesi');
  o.kare(200);
  assert.ok(o.sesLog.some(x => x[0] === 'tone' && x[1] === 280 && x[2] === 'triangle'), 'sarmasik hasar sesi');
  assert.ok(o.durum.isik < 1);
});

dene('yeni alanlarla 600 karelik kosu hatasiz (bomba/sarmasik uretildiyse de), temaDegisti dahil', () => {
  const o = ortam(); o.yeni();
  o.durum.puan = 3000; o.kare(600); o.O.temaDegisti(); o.kare(10);
});

console.log(gecti + ' deneme gecti');
