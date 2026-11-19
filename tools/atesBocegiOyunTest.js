// atesBocegiOyunTest.js — js/atesBocegiOyun.js'i sahte DOM/canvas ile dener (gorsel dogrulamaz).
// Kapsam: tek odeme, gun degisimi, yarim kosu odemez, sifirla, offstage'de rAF durur,
// olum sonrasi isik sonme akisi ekran kapaninca iptal, bozuk/yeni surum kaydi, ilk kosuda rekor yok,
// isik sonme: karanlik cokmeden kart gelmez, yeniden baslat/geri ile cift kart ve cift odeme olmaz.
// Karanliktasuzul: geri tusu yollari dur() cagirir (core.js kaynak + davranis), yutulan toz cizilmez,
// bomba/sarmasik her fazda cizim ve olay hatasiz, bomba/unlem karanlik katmanin ustunde cizilir.
// 2. tur (tasarim 12.1): tavan sersem efekti (halka + yildiz, azaltilmis harekette sabit), zemin olumu animasyonu
// (giris kilidi, sicrama + dusus, dunya donuk, sonra normal sonuc karti; azaltilmis harekette sade).
// Calistirma:  node tools/atesBocegiOyunTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const AB = require(path.join(__dirname, '..', 'js', 'atesBocegi.js'));
const KAYNAK = fs.readFileSync(path.join(__dirname, '..', 'js', 'atesBocegiOyun.js'), 'utf8');

function ortam() {
  const o = { oyuk: 0, rafF: null, zamanlayicilar: [], goldAdd: [], yazim: 0, durum: null, t: 0, basili: false, ses: 0, sesLog: [], titresim: [], log: null };
  const proxyCtx = () => new Proxy({}, {
    get(h, k) { if (k in h) return h[k]; return (...a) => { if (o.log) o.log.push([k, a]); return /Gradient/.test(k) ? { addColorStop() {} } : undefined; }; },
    set(h, k, v) { if (k === 'globalAlpha' && o.alfaAc && o.log) o.log.push(['alpha', [v]]); if (k === 'globalCompositeOperation' && v === 'destination-out') o.oyuk++; h[k] = v; return true; }
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
      const govde = l.slice(0, kk).filter(c => c[0] === 'ellipse' && c[1][2] === 0.5 && c[1][3] === 0.26).length;
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
    assert.ok(Math.abs(tr[0][1][1] - (yon === 'ust' ? 40 + M.R_CARPMA + AB.AYAR.adalet.PAY_KACIS : H - 40 - M.R_CARPMA - AB.AYAR.adalet.PAY_KACIS)) < 1e-9, yon + ' unlem y uc yuksekligi ' + tr[0][1][1]);
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

console.log('Karanliktasuzul B4: gorsel iyilestirme (cizim guvenligi, performans, denetci duzeltmeleri)');

const sonDilim = o => o.durum.dilimler[o.durum.dilimler.length - 1];

dene('K-1: uzak dilimdeki (dilimler[0] degil) sarmasik faz 1 ilk karede unlem cizer (dilim onu siniri yok)', () => {
  ['ust', 'alt'].forEach(yon => {
    const o = ortam(); o.O.start(); o.kare(1);
    const m = o.durum.mesafe, x1 = m + 95, s = sonDilim(o);
    assert.notStrictEqual(s, o.durum.dilimler[0]);
    s.x = m + 140;                                           // dilim onu ekranin cok otesinde
    s.sarmasik = { yon, x1, x2: x1 + 3, sutunlar: [sutunlu(x1, 40, yon)], faz: 1, sure: 0, ilerleme: 0 };
    const l = ciziliyor(o), after = l.slice(sonKaranlik(l));
    assert.strictEqual(after.filter(c => c[0] === 'translate' && Math.abs(c[1][0] - (W - 3.2)) < 1e-9).length, 1, yon + ' unlem ilk karede');
    s.sarmasik.faz = 2;
    const l2 = ciziliyor(o), a2 = l2.slice(sonKaranlik(l2));          // faz 2: unlem yok, kenar isareti kalir
    assert.strictEqual(a2.filter(c => c[0] === 'translate' && Math.abs(c[1][0] - (W - 3.2)) < 1e-9).length, 0);
    assert.ok(a2.some(c => c[0] === 'moveTo' && Math.abs(c[1][0] - (W - 2.4)) < 1e-9), 'kenar isareti');
  });
});

dene('K-a: ekran disi birden cok sutun tek unlem cizer (ust uste binmez)', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  const m = o.durum.mesafe, x1 = m + W + 20, sut = [sutunlu(x1, 30, 'ust'), sutunlu(x1 + 5, 45, 'ust'), sutunlu(x1 + 10, 20, 'ust')];
  o.durum.dilimler[0].sarmasik = { yon: 'ust', x1, x2: x1 + 13, sutunlar: sut, faz: 1, sure: 0, ilerleme: 0 };
  const l = ciziliyor(o), after = l.slice(sonKaranlik(l)), tr = after.filter(c => c[0] === 'translate' && Math.abs(c[1][0] - (W - 3.2)) < 1e-9);
  assert.strictEqual(tr.length, 1, 'tek unlem');
  assert.ok(Math.abs(tr[0][1][1] - (45 + M.R_CARPMA + AB.AYAR.adalet.PAY_KACIS)) < 1e-9, 'en tehlikeli (en uzun) uc seviyesi');
});

dene('O-1: ekrandaki her alinmamis toz cizilir (tozun dilimi ekranin otesinde olsa da)', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  const m = o.durum.mesafe, s = sonDilim(o);
  s.x = m + W + 60;
  s.toz = [{ x: m + 30, y: 50, alindi: 0, yutuldu: 0 }];
  const say = () => ciziliyor(o).filter(c => c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][2] - (50 - M.R_TOZ_GORSEL * 3.2)) < 1e-6 && Math.abs(c[1][3] - M.R_TOZ_GORSEL * 6.4) < 1e-6).length;
  assert.strictEqual(say(), 1);
  s.toz[0].alindi = 1; assert.strictEqual(say(), 0);
});

dene('K-d: azaltilmis harekette bomba ve unlem sabit (titreme/nabiz/yanip sonme yok); normal harekette degisir', () => {
  [true, false].forEach(az => {
    const o = ortam(); o.azHareket = az; o.O.start(); o.kare(1);
    const m = o.durum.mesafe, x1 = m + 25;
    o.durum.dilimler[0].bomba = { x: m + 30, y: 40, alindi: 0 };
    o.durum.dilimler[0].sarmasik = { yon: 'ust', x1, x2: x1 + 3, sutunlar: [sutunlu(x1, 40, 'ust')], faz: 1, sure: 0, ilerleme: 0 };
    const ozet = () => { const l = ciziliyor(o), a = l.slice(sonKaranlik(l)); return JSON.stringify(a.filter(c => c[0] === 'translate' || c[0] === 'scale' || c[0] === 'rotate')); };
    const hepsi = []; for (let i = 0; i < 6; i++) { hepsi.push(ozet()); o.kare(3); }
    const tek = new Set(hepsi).size === 1;
    assert.strictEqual(tek, az, 'az=' + az + ' sabit mi: ' + tek);
  });
});

dene('K-e: olumcul bomba: sonme sirasinda patlama parcaciklari cizilir ve ilerler; toplam parcacik <= 24', () => {
  const o = ortam(); o.yeni();
  o.durum.isik = 0.1; o.durum.dokunulmaz = 0;
  o.durum.dilimler[0].bomba = { x: o.durum.mesafe + XB + 0.5, y: o.durum.y, alindi: 0 };
  o.kare(1);
  assert.ok(o.durum.bitti, 'olum');
  let en = 0, ilk = null, son = null;
  for (let i = 0; i < 6; i++) {
    o.log = []; o.kare(1); const p = o.log.filter(c => c[0] === 'fillRect' && c[1][2] === 0.6 && c[1][3] === 0.6); o.log = null;
    en = Math.max(en, p.length); if (!ilk && p.length) ilk = p[0][1][0]; if (p.length) son = p[0][1][0];
    assert.ok(p.length <= 24);
  }
  assert.ok(en >= 1, 'patlama gorunmeli'); assert.ok(ilk !== son, 'parcacik ilerlemeli');
});

dene('K-e: lav izi (akkor) bomba patlamasi icin en az 8 yuva birakir', () => {
  const o = ortam(); o.sb.AppMarket = { isikCoz: p => p, aktif: () => ({ isik: '#FFA64A', toz: '#FFD98A', vurgu: '#7CF0A0', karanlik: '#120604', iz: { renk: '#FF6A2A', renk2: '#FFD07A', sekil: 'akkor' }, animasyon: 'lav' }) };
  o.yeni(); o.kare(120);                                    // iz parcaciklari doldu
  o.durum.dilimler[0].bomba = { x: o.durum.mesafe + XB + 0.5, y: o.durum.y, alindi: 0 }; o.durum.dokunulmaz = 0; o.durum.isik = 1;
  o.log = []; o.kare(1);
  const tum = o.log.filter(c => c[0] === 'fillRect' && c[1][2] === 0.6 && c[1][3] === 0.6).length; o.log = null;
  assert.ok(tum <= 24 && tum >= 8, 'parcacik ' + tum);
});

dene('performans: kare basina cizim cagrisi ust siniri (yogun sahne: dal/ag/kus/dusen/bomba/sarmasik/toz); onceki surum 446, simdi < 800', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  const d = o.durum, m = d.mesafe; d.puan = 3000;
  d.dilimler[0].bomba = { x: m + 30, y: 40, alindi: 0 }; d.dilimler[1].bomba = { x: m + 36, y: 60, alindi: 0 };
  const x1 = m + XB + 22;
  d.dilimler[0].sarmasik = { yon: 'ust', x1, x2: x1 + 8, sutunlar: [sutunlu(x1, 40, 'ust'), sutunlu(x1 + 4, 30, 'ust')], faz: 3, sure: 0, ilerleme: 1 };
  d.dilimler[1].sarmasik = { yon: 'alt', x1: m + 40, x2: m + 48, sutunlar: [sutunlu(m + 40, 40, 'alt')], faz: 1, sure: 0, ilerleme: 0 };
  d.dilimler[2].engeller = [{ tur: 'dal', yon: 'ust', x: m + 20, y: 0, w: 5, h: 30 }, { tur: 'dal', yon: 'alt', x: m + 20, y: 70, w: 5, h: 30 }, { tur: 'ag', x: m + 26, y: 10, w: 7, h: 17 }, { tur: 'kus', x: m + 34, y: 60, w: 5, h: 3.5 }, { tur: 'dusen', x: m + 42, y: 0, w: 5, h: 25, faz: 1 }];
  d.dilimler[2].toz = [{ x: m + 12, y: 45, alindi: 0, yutuldu: 0 }, { x: m + 16, y: 55, alindi: 0, yutuldu: 0 }];
  d.dokunulmaz = 0; d.isik = 1;
  o.kare(3);
  let en = 0; for (let i = 0; i < 10; i++) en = Math.max(en, ciziliyor(o).length);
  console.log('       kare basina cizim cagrisi (yogun sahne): ' + en);
  assert.ok(en < 800, 'cagri ' + en);
});

function yogunSahne(o) {
  const d = o.durum, m = d.mesafe; d.puan = 3000;
  d.dilimler[2].engeller = [{ tur: 'dal', yon: 'ust', x: m + 20, y: 0, w: 5, h: 30 }, { tur: 'dal', yon: 'alt', x: m + 20, y: 70, w: 5, h: 30 }, { tur: 'dal', yon: 'ust', x: m + 10, y: 0, w: 5, h: 45 }, { tur: 'dal', yon: 'alt', x: m + 10, y: 60, w: 5, h: 40 }, { tur: 'dal', yon: 'ust', x: m + 46, y: 0, w: 5, h: 35 }, { tur: 'dusen', x: m + 42, y: 0, w: 5, h: 25, faz: 1 }];
  d.dokunulmaz = 0; d.isik = 1;
}
const yolSay = l => l.filter(c => c[0] === 'lineTo' || c[0] === 'quadraticCurveTo' || c[0] === 'bezierCurveTo' || c[0] === 'arc').length;

dene('O2: dallar onbellekli: kare basina yol segmenti sinirli (5 dal + dusen dal sahnesi; onceki surum 280, simdi 18; sinir < 100)', () => {
  const o = ortam(); o.O.start(); o.kare(1); yogunSahne(o); o.kare(3);
  let en = 0; for (let i = 0; i < 10; i++) en = Math.max(en, yolSay(ciziliyor(o)));
  console.log('       kare basina yol segmenti (lineTo+quadraticCurveTo+bezierCurveTo+arc): ' + en);
  assert.ok(en < 100, 'segment ' + en);
});

dene('O2: dal onbellegi kare basina yeni tuval uretmez; sinirli (<= 24 dal tuvali)', () => {
  const o = ortam(); o.O.start(); o.kare(1); yogunSahne(o); o.kare(3);
  let n = 0; const orj = o.sb.document.createElement; o.sb.document.createElement = (...a) => { n++; return orj(...a); };
  o.kare(30);
  assert.strictEqual(n, 0, 'kare basina tuval uretimi: ' + n);
  // cok farkli yukseklikte dal: tuval sayisi sinirli (en cok 24 dal + degisimde yeniden kullanim)
  n = 0;
  for (let k = 0; k < 60; k++) { o.durum.dilimler[2].engeller = [{ tur: 'dal', yon: 'ust', x: o.durum.mesafe + 20, y: 0, w: 5, h: 10 + k * 1.3 }]; o.kare(1); }
  assert.ok(n <= 24, 'dal tuvali ' + n);
  o.sb.document.createElement = orj;
});

dene('K5: sarmasik yutan toz ~0,25 sn solarak kaybolur (azaltilmis harekette aninda)', () => {
  [false, true].forEach(az => {
    const o = ortam(); o.azHareket = az; o.yeni();
    const m = o.durum.mesafe, x1 = m + XB + 25, s = o.durum.dilimler[0];
    s.sarmasik = { yon: 'ust', x1, x2: x1 + 3, sutunlar: [sutunlu(x1, 60, 'ust')], faz: 1, sure: 99, ilerleme: 0 };
    s.engeller = []; s.toz = [{ x: x1 + 1.5, y: 30, alindi: 0, yutuldu: 0 }];
    const toz = () => ciziliyor(o).filter(c => c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][3] - M.R_TOZ_GORSEL * 6.4) < 1e-6 && Math.abs(c[1][2] - (30 - M.R_TOZ_GORSEL * 3.2)) < 1e-6).length;
    const sayilar = []; for (let i = 0; i < 30; i++) sayilar.push(toz());
    assert.ok(s.toz[0].yutuldu, 'yutuldu');
    if (az) assert.ok(sayilar.every(x => x === 0), 'az hareket: aninda yok');
    else { assert.ok(sayilar.slice(0, 3).some(x => x > 0), 'solma gorunmeli'); assert.ok(sayilar.slice(24).every(x => x === 0), '0,25 sn sonra yok: ' + sayilar.join('')); }
  });
});

dene('K3: bomba patlama parcaciklari dunyayla kayar (ortalama x hareketi ~ -dunya hizi)', () => {
  const o = ortam(); o.yeni();
  o.durum.dilimler[0].bomba = { x: o.durum.mesafe + XB + 0.5, y: o.durum.y, alindi: 0 };
  o.durum.isik = 1; o.durum.dokunulmaz = 0;
  const pos = () => { o.log = []; o.kare(1); const p = o.log.filter(c => c[0] === 'fillRect' && c[1][2] === 0.6 && c[1][3] === 0.6).map(c => c[1][0]); o.log = null; return p; };
  pos(); const a = pos(), b = pos();
  assert.ok(a.length >= 4 && a.length === b.length, 'parcacik ' + a.length + '/' + b.length);
  const ort = b.reduce((s, x, i) => s + (x - a[i]), 0) / b.length, hiz = AB.zorluk(0).hiz;
  assert.ok(ort < -0.7 * hiz / 60, 'ortalama dx ' + ort + ' hiz ' + hiz);
});

dene('K4: olum sonmesinde lav izi yeni parcacik uretmez (sonme sonuna dogru parcacik kalmaz)', () => {
  const o = ortam(); o.sb.AppMarket = { isikCoz: p => p, aktif: () => ({ isik: '#FFA64A', toz: '#FFD98A', vurgu: '#7CF0A0', karanlik: '#120604', iz: { renk: '#FF6A2A', renk2: '#FFD07A', sekil: 'akkor' }, animasyon: 'lav' }) };
  o.yeni(); o.kare(90);
  o.durum.isik = 0.0001; o.durum.dokunulmaz = 0; o.kare(3);
  assert.ok(o.durum.bitti, 'olum');
  o.kare(40);
  o.log = []; o.kare(1); const say = o.log.filter(c => c[0] === 'fillRect' && c[1][2] === 0.6 && c[1][3] === 0.6).length; o.log = null;
  assert.strictEqual(say, 0, 'sonme sirasinda kalan parcacik ' + say);
});

dene('feneri nabzi: azaltilmis harekette sabit, normalde degisir', () => {
  [true, false].forEach(az => {
    const o = ortam(); o.azHareket = az; o.O.start(); o.kare(1);
    const rx = () => { const l = ciziliyor(o).filter(c => c[0] === 'ellipse' && c[1][0] === -1.95); assert.strictEqual(l.length, 1); return l[0][1][2]; };
    const v = new Set(); for (let i = 0; i < 8; i++) { v.add(rx()); o.kare(4); }
    assert.strictEqual(v.size === 1, az, 'az=' + az + ' farkli deger ' + v.size);
  });
});

dene('O1: bomba patlamasi her yone: parcacik dikey hizi hem pozitif hem negatif (yatay serit degil)', () => {
  const o = ortam(); o.yeni();
  o.durum.dilimler[0].bomba = { x: o.durum.mesafe + XB + 0.5, y: o.durum.y, alindi: 0 };
  o.durum.isik = 1; o.durum.dokunulmaz = 0;
  const ys = () => { o.log = []; o.kare(1); const p = o.log.filter(c => c[0] === 'fillRect' && c[1][2] === 0.6 && c[1][3] === 0.6).map(c => c[1][1]); o.log = null; return p; };
  ys(); const a = ys(), b = ys();
  assert.ok(a.length >= 4 && a.length === b.length, 'parcacik ' + a.length + '/' + b.length);
  const dy = b.map((y, i) => y - a[i]);
  assert.ok(dy.some(v => v > 0.05) && dy.some(v => v < -0.05), 'dy ' + dy.map(v => v.toFixed(2)).join(','));
});

dene('K1: azaltilmis harekette kanat cirpmasi ve bocek hale alfa nabzi sabit; normalde degisir', () => {
  [true, false].forEach(az => {
    const o = ortam(); o.azHareket = az; o.O.start(); o.bas(); o.kare(2);
    const imza = () => { o.log = []; o.alfaAc = true; o.kare(1); o.alfaAc = false; const l = o.log; o.log = null;
      const kanat = l.filter(c => c[0] === 'ellipse' && (Math.abs(c[1][2] - 1.7) < 1e-9 || Math.abs(c[1][2] - 1.5) < 1e-9));
      const im = l.findIndex(c => c[0] === 'drawImage' && c[1].length === 5 && Math.abs(c[1][3] - M.R_GORSEL * 8) < 1e-9);
      assert.ok(im > 0 && l[im - 1][0] === 'alpha', 'bocek hale alfa');
      return JSON.stringify(kanat) + '|' + l[im - 1][1][0]; };
    const v = new Set(); for (let i = 0; i < 6; i++) { v.add(imza()); o.kare(5); }
    assert.strictEqual(v.size === 1, az, 'az=' + az + ' farkli imza ' + v.size);
  });
});

dene('K3: dal sprite onbellegi 3 desen varyanti (e.x tabanli) ayri tuval; ayni varyant yeniden kullanilir', () => {
  const o = ortam(); o.O.start(); o.kare(1);
  const m = o.durum.mesafe;
  const say = xs => { let n = 0; const orj = o.sb.document.createElement; o.sb.document.createElement = (...a) => { n++; return orj(...a); };
    o.durum.dilimler[2].engeller = xs.map(x => ({ tur: 'dal', yon: 'ust', x: m + x, y: 0, w: 5, h: 33.3 })); o.kare(2); o.sb.document.createElement = orj; return n; };
  assert.strictEqual(say([10, 11, 12]), 3, '3 varyant 3 tuval');
  assert.strictEqual(say([13, 14, 15, 16, 30]), 0, 'ayni varyantlar yeniden kullanilir');
});

dene('K6: tozSon yuva aramasi bomba patlamasina ayrilmis son yuvalari almaz', () => {
  const g = /function tozSon[\s\S]*?\n  \}/.exec(KAYNAK)[0];
  assert.ok(/for \(i = 0; i < PARCACIK_TAVAN - PATLAMA_YUVA; i\+\+\)/.test(g), 'tozSon dongusu');
});

console.log('Karanliktasuzul 2. tur: tavan sersemlemesi ve zemin olumu (tasarim 12.1)');
const DUNYA = AB.AYAR.dunya;
const sabit = ad => +new RegExp('\\b' + ad + ' = ([0-9.]+)').exec(KAYNAK)[1];
const HALKA_RX = sabit('SERSEM_HALKA_RX'), HALKA_RY = sabit('SERSEM_HALKA_RY'), ZEMIN_OLUM_SN = sabit('ZEMIN_OLUM_SN');
// tavana tam hizla degdir: bir sonraki adimda sersemlik baslar
function tavanaCarp(o) { o.durum.y = DUNYA.Y_UST + 0.05; o.durum.vy = -M.VY_YUKARI; o.durum.ay = -M.A_YUKSEL; o.durum.dokunulmaz = 0; o.kare(1); }
function zemineCarp(o) { o.birak(); o.durum.y = DUNYA.Y_ALT - 0.05; o.durum.vy = M.VY_ASAGI; o.durum.ay = M.G_SUZUL; o.durum.zeminKoruma = 0; o.durum.isik = 1; o.kare(1); }
const halka = l => l.filter(c => c[0] === 'ellipse' && c[1][2] === HALKA_RX && c[1][3] === HALKA_RY);
// halka cizimini izleyen ilk SERSEM_YILDIZ moveTo cagrisi = yildizlarin ilk koseleri
function yildizlar(l) { const i = l.findIndex(c => c[0] === 'ellipse' && c[1][2] === HALKA_RX && c[1][3] === HALKA_RY); return i < 0 ? [] : l.slice(i).filter(c => c[0] === 'moveTo').slice(0, 3).map(c => c[1]); }

dene('sersem efekti: tavana carpinca bocek ustunde halka + 3 yildiz (tema vurgu rengi), ses; sersemlik bitince yok', () => {
  const o = ortam(); o.yeni(); const ses0 = o.sesLog.length;
  tavanaCarp(o);
  assert.ok(o.durum.sersem > 0, 'sersem');
  assert.ok(o.sesLog.slice(ses0).some(x => x[0] === 'tone' && x[1] === 640 && x[2] === 'triangle'), 'tavan sesi');
  const l = ciziliyor(o);
  assert.strictEqual(halka(l).length, 1, 'halka');
  const ys = yildizlar(l); assert.strictEqual(ys.length, 3, 'yildiz');
  assert.ok(Math.abs(halka(l)[0][1][1] - (o.durum.y - M.R_GORSEL - 1.2)) < 1e-9, 'halka bocegin basinin ustunde');
  assert.ok(/function sersemCiz[\s\S]*?pal\.vurgu[\s\S]*?\n  \}/.test(KAYNAK), 'renk temadan (pal.vurgu)');
  o.kare(Math.ceil(M.SERSEM_SURE * 60) + 2);
  assert.strictEqual(o.durum.sersem, 0, 'uyandi'); assert.strictEqual(halka(ciziliyor(o)).length, 0, 'uyaninca efekt yok');
  assert.strictEqual(o.durum.bitti, 0);
});
dene('sersem efekti: normal harekette yildizlar doner, azaltilmis harekette sabit (donme yok)', () => {
  [false, true].forEach(az => {
    const o = ortam(); o.azHareket = az; o.yeni(); tavanaCarp(o);
    const imza = new Set();
    for (let i = 0; i < 5; i++) {
      const l = ciziliyor(o), y = halka(l)[0][1][1];
      imza.add(JSON.stringify(yildizlar(l).map(p => [+(p[0]).toFixed(6), +(p[1] - y).toFixed(6)])));   // halkaya gore (bocek suzulurken iner)
    }
    assert.strictEqual(imza.size === 1, az, 'az=' + az + ' farkli ' + imza.size);
  });
});
dene('sersemken basili tutmak kanat cirpmasini hizlandirmaz (girdi etkisiz), miknatis kuyrugu cizilmez', () => {
  assert.ok(/kanatFaz \+= dt \* \(basili && !\(d\.sersem > 0\) \? 88 : 31\)/.test(KAYNAK), 'kanat hizi sersemken birakili gibi');
  assert.ok(/md < rm2 && md > 1 && !\(durum\.sersem > 0\)/.test(KAYNAK), 'miknatis kuyrugu sersemken yok');
});
dene('zemin olumu: temas aninda giris kilitli, odeme tek, dunya donar; once yukari sicrama, sonra ekran disina dusus; sonra sonuc karti', () => {
  const o = ortam(); o.yeni(); o.durum.puan = 2600; o.durum.toz = 30;
  zemineCarp(o);
  assert.strictEqual(o.durum.bitti, 1); assert.strictEqual(o.durum.sebep, 'zemin');
  assert.strictEqual(o.goldAdd.length, 1, 'odeme olumde bir kez'); assert.ok(!o.el('abSonuc').cl.has('show'), 'kart hemen gelmez');
  const t0 = o.durum.t, m0 = o.durum.mesafe, y0 = o.durum.y;
  o.bas(); o.el('abDurBtn').dinle.click();                             // girdi kilitli: adim yok, duraklatma yok
  assert.strictEqual(o.durum.t, t0); assert.ok(!o.el('abDuraklat').cl.has('show'));
  const ys = [];
  for (let i = 0; i < 70; i++) {
    const l = ciziliyor(o), tr = l.find(c => c[0] === 'translate' && c[1][0] === XB);
    if (tr) ys.push(tr[1][1]);
    assert.strictEqual(o.durum.t, t0, 'cekirdek adimi yok'); assert.strictEqual(o.durum.mesafe, m0, 'dunya donuk');
    if (i < 60) assert.ok(!o.el('abSonuc').cl.has('show'), 'animasyon bitmeden kart ' + i);
  }
  const enUst = Math.min(...ys), iTepe = ys.indexOf(enUst);
  assert.ok(enUst < y0 - 5, 'yukari sicrama ' + enUst); assert.ok(iTepe > 3 && iTepe < 30, 'tepe karesi ' + iTepe);
  assert.ok(ys.slice(iTepe).every((y, i, a) => i === 0 || y >= a[i - 1] - 1e-9), 'tepeden sonra hep asagi');
  assert.ok(ys[ys.length - 1] > H + 3 * M.R_GORSEL, 'ekran disina dustu ' + ys[ys.length - 1]);
  o.kare(Math.ceil(ZEMIN_OLUM_SN * 60) - 60);
  assert.ok(o.el('abSonuc').cl.has('show'), 'animasyon sonrasi normal sonuc karti'); assert.strictEqual(o.goldAdd.length, 1);
  assert.ok(/Söndü|Rekor/.test(o.el('abSonBaslik').innerHTML), 'mevcut bitis basligi');
});
dene('zemin olumu: ters donus (dikey takla) ve isik sonerek kuculur; isik olumu eski akista (sicrama yok)', () => {
  const o = ortam(); o.yeni(); zemineCarp(o);
  const sc = []; for (let i = 0; i < 30; i++) { const l = ciziliyor(o); const s = l.find(c => c[0] === 'scale' && c[1][0] === 1 && c[1][1] < 0); if (s) sc.push(s[1][1]); }
  assert.ok(sc.length > 0 && Math.min(...sc) <= -0.99, 'sirt ustu ters');
  const p = ortam(); p.yeni(); p.olum(500, 5);
  const ys = []; for (let i = 0; i < 20; i++) { const l = ciziliyor(p), tr = l.find(c => c[0] === 'translate' && c[1][0] === XB); if (tr) ys.push(tr[1][1]); }
  assert.ok(ys.every(y => y === p.durum.y), 'isik olumunde bocek yerinde soner');
});
dene('zemin olumu azaltilmis harekette sade: sicrama/dusus yok, kisa sonme (30 kare icinde kart)', () => {
  const o = ortam(); o.azHareket = true; o.yeni(); zemineCarp(o);
  const ys = []; for (let i = 0; i < 10; i++) { const l = ciziliyor(o), tr = l.find(c => c[0] === 'translate' && c[1][0] === XB); if (tr) ys.push(tr[1][1]); }
  assert.ok(ys.length && ys.every(y => y === DUNYA.Y_ALT), 'yerinde');
  o.kare(20); assert.ok(o.el('abSonuc').cl.has('show'));
});
dene('zemin olumu sonrasi yeni kosu temiz: olum turu sifirlanir, bocek yerinde cizilir, Dokun ve basla oncesi olum yok', () => {
  const o = ortam(); o.yeni(); zemineCarp(o); o.kare(90);
  assert.ok(o.el('abSonuc').cl.has('show'));
  o.el('abTekrar').dinle.click(); o.kare(120);                    // dokunmadan bekle: adim yok, olum yok
  assert.strictEqual(o.durum.t, 0); assert.strictEqual(o.durum.bitti, 0); assert.ok(o.el('abIpucu').cl.has('show'));
  const l = ciziliyor(o), tr = l.find(c => c[0] === 'translate' && c[1][0] === XB);
  assert.strictEqual(tr[1][1], DUNYA.Y_BASLA);
  o.bas(); o.kare(30); assert.strictEqual(o.durum.bitti, 0); assert.ok(o.durum.t > 0.3);
  assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 1, 'yalniz ilk kosu kayitli');
});

console.log(gecti + ' deneme gecti');
