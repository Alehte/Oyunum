// atesBocegiGenislikTest.js — Karanlikta Suzul oyun alani genisligi (gorev 3, Asama 2), GERCEK index.html + style.css + js/
// ile headless Chrome'da. Ana ekrandan oyun karti acilir, kosu birkac saniye oynanir (isik/zemin korumasi testte acik).
// Her boyutta: tuval css genisligi == .ab-alan genisligi (dokunma alani tum alan); sol ve sag kenar piksel sutunlari ile ust ve
// alt kenar piksel satirlari duz renk degil (sahne icerigi; dar ekranin ust/alt bandi dahil); "Dokun ve basla" ve HUD alanda ortali. Genis/yatay oranda (GA > GW_MAX): oyun dunyasi
// GW_MAX'ta kirpilir (otesindeki bomba cizilmez, icindeki cizilir), fazlasi atmosfer (arka plan + karanlik) ile dolar.
// Kullanim:  node tools/atesBocegiGenislikTest.js [kayitDizini]   (ekran goruntuleri PNG olarak kayitDizini'ne)
// Chrome: CHROME_YOL ya da varsayilan yollar; yoksa ATLANDI (basarisiz sayilmaz). Port 9470.
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), url = require('url'), assert = require('assert');
const KOK = path.join(__dirname, '..'), PORT = 9470, kayit = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AB = require(path.join(KOK, 'js', 'atesBocegi.js'));
const H = AB.AYAR.dunya.H, W = AB.AYAR.dunya.W, GW_MAX = H * AB.AYAR.dunya.ORAN_MAX;

// ad, genislik, yukseklik, dpr, mobil, standalone (kurulu uygulama: yatay ekranda da cercevesiz tam ekran)
const BOYUTLAR = [
  ['telefon-360x800', 360, 800, 2, true, false],
  ['telefon-412x915', 412, 915, 2, true, false],
  ['telefon-390x844', 390, 844, 3, true, false],
  ['masaustu-cerceve-1280x900', 1280, 900, 1, false, false],
  ['yatay-915x412', 915, 412, 2, true, true],
  // 21:9 telefon, kurulu uygulama tam ekran: alan en/boy < W/H (0,5) -> genislige sigar, ust/alt bant (BY > 0) yalniz atmosfer
  ['kurulu-21x9-411x960', 411, 960, 2, true, true]
];

function chromeBul() {
  const adaylar = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return adaylar.find(a => fs.existsSync(a)) || null;
}

let gecti = 0, hata = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { hata++; console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// Sayfaya eklenen kanca: AtesBocegi yuklenince oyunOlustur sarilir (kosu durumu window.__durum'da; cizim degismez).
const KANCA = '<script>(function(){var ab;Object.defineProperty(window,"AtesBocegi",{configurable:true,get:function(){return ab;},' +
  'set:function(v){ab=v;var o=v.oyunOlustur;v.oyunOlustur=function(t){window.__durum=o(t);return window.__durum;};}});})();</script>';
// Sayfa ici olcum yardimcilari
const OLCUM = `
window.__olc = function () {
  var R = function (e) { var r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  var alan = document.getElementById('abAlan'), tuval = document.getElementById('abTuval'), ip = document.getElementById('abIpucu');
  var hud = document.querySelector('#screen-ates .ab-hud'), kutu = Array.prototype.map.call(hud.children, R);
  return { alan: R(alan), tuval: R(tuval), ipucu: R(ip), ipucuGorunur: getComputedStyle(ip).opacity, hud: R(hud), kutu: kutu,
           bw: tuval.width, bh: tuval.height, ekran: getComputedStyle(document.getElementById('screen-ates')).transform };
};
window.__sutun = function (x) {           // tuvalin x. piksel sutunu: farkli renk sayisi, ort parlaklik, (0,0,0) ve duz dolgu sayisi
  var t = document.getElementById('abTuval');
  return window.__dizi(t.getContext('2d').getImageData(x, 0, 1, t.height).data);
};
window.__satir = function (y) {           // tuvalin y. piksel satiri (ayni olcumler)
  var t = document.getElementById('abTuval');
  return window.__dizi(t.getContext('2d').getImageData(0, y, t.width, 1).data);
};
window.__dizi = function (d) {
  var h = getComputedStyle(document.getElementById('screen-ates')).getPropertyValue('--ab-karanlik').trim();
  window.__karanlik = [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];   // tuvalin duz zemin dolgusu (eski bant rengi)
  var s = {}, n = 0, top = 0, enc = 0, i, l;
  for (i = 0; i < d.length; i += 4) { var k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; if (!s[k]) { s[k] = 1; n++; } l = d[i] + d[i + 1] + d[i + 2]; top += l; if (l > enc) enc = l; }
  var siyah = 0, duz = 0, kr = window.__karanlik; for (i = 0; i < d.length; i += 4) {
    if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) siyah++;
    if (Math.abs(d[i] - kr[0]) <= 1 && Math.abs(d[i + 1] - kr[1]) <= 1 && Math.abs(d[i + 2] - kr[2]) <= 1) duz++;   // duz zemin dolgusu (bant) rengi
  }
  return { renk: n, ort: top / (d.length / 4) / 3, enCok: enc / 3, siyah: siyah, duz: duz, boy: d.length / 4, ornek: Object.keys(s).slice(0, 4) };
};
window.__kutu = function (x0, y0, x1, y1) {   // piksel kutusunda en turuncu (R - B) deger
  var t = document.getElementById('abTuval'), c = t.getContext('2d');
  x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); x1 = Math.min(t.width, Math.round(x1)); y1 = Math.min(t.height, Math.round(y1));
  if (x1 <= x0 || y1 <= y0) return -1;
  var d = c.getImageData(x0, y0, x1 - x0, y1 - y0).data, en = -999, i;
  for (i = 0; i < d.length; i += 4) en = Math.max(en, d[i] - d[i + 2]);
  return en;
};
// Karanlik katmani (kc) cizilmeden hemen once tuvalin verilen sutunlari (arka plan + dunya) ve kc genisligi. Karanlik
// tuvali her karede ust uste %94 dolgu aldigindan isik disinda pratikte opaktir (onceden var olan davranis); bu yuzden
// arka planin kenara kadar cizildigi karanliktan ONCE olculur, son goruntude ise sutun (0,0,0) olmamali.
window.__oncesi = function (xs, ys) {
  var t = document.getElementById('abTuval'), c = t.getContext('2d'), o = c.drawImage, out = null;
  return new Promise(function (bitti) {
    c.drawImage = function (img) {
      if (!out && img.width === t.width && img.height === t.height) {
        out = { kcW: img.width, kcH: img.height, sutun: xs.map(function (x) { return window.__sutun(x); }), satir: (ys || []).map(function (y) { return window.__satir(y); }) };
      }
      return o.apply(c, arguments);
    };
    requestAnimationFrame(function () { requestAnimationFrame(function () { c.drawImage = o; bitti(out); }); });
  });
};
window.__bas = function (b) {
  var t = document.getElementById('abTuval');
  t.dispatchEvent(new PointerEvent(b ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'touch' }));
};
window.__koru = function () { var d = window.__durum; if (d) { d.isik = 1; d.zeminKoruma = 1; d.dokunulmaz = 0; } };
`;

// kurulu: style.css'teki tam ekran blogu (max-width:520px / standalone / fullscreen) kosulsuz eklenir; CDP display-mode
// benzetimi headless'ta medya sorgusunu tetiklemedi. Boylece yatay telefonda kurulu uygulama (TWA) gorunumu.
function tamEkranCss() {
  const css = fs.readFileSync(path.join(KOK, 'style.css'), 'utf8'), bas = css.indexOf('@media (max-width:520px), (display-mode:standalone)');
  assert.ok(bas > 0, 'tam ekran medya blogu bulunamadi');
  let i = css.indexOf('{', bas) + 1, derin = 1;
  for (; derin && i < css.length; i++) { if (css[i] === '{') derin++; else if (css[i] === '}') derin--; }
  return css.slice(css.indexOf('{', bas) + 1, i - 1);
}
function sayfaKur(dizin, kurulu) {
  let html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  html = html.replace('<head>', '<head><base href="' + url.pathToFileURL(KOK + path.sep).href + '">' + KANCA);
  if (kurulu) html = html.replace('</head>', '<style>' + tamEkranCss() + '</style></head>');
  html = html.replace('</body>', '<script>' + OLCUM + '</script></body>');
  const f = path.join(dizin, kurulu ? 'sayfa-kurulu.html' : 'sayfa.html');
  fs.writeFileSync(f, html);
  return url.pathToFileURL(f).href;
}

async function boyutOlc(gonder, deger, sayfalar, [ad, gen, boy, dpr, mobil, kurulu]) {
  await gonder('Emulation.setDeviceMetricsOverride', { width: gen, height: boy, deviceScaleFactor: dpr, mobile: mobil });
  await gonder('Page.navigate', { url: sayfalar[kurulu ? 1 : 0] });
  for (let i = 0; i < 80 && !(await deger('!!document.getElementById("cardAtes") && document.readyState === "complete"')); i++) await sleep(100);
  await sleep(400);
  await deger('document.getElementById("cardAtes").click(), 1');
  for (let i = 0; i < 80 && !(await deger('!!window.AtesBocegiOyun && !!window.__durum')); i++) await sleep(100);
  await sleep(900);                                        // ekran gecisi (0,28 sn) + yerlesim
  const ilk = await deger('__olc()');                     // bekleme: "Dokun ve basla" gorunur
  const g1 = await gonder('Page.captureScreenshot', { format: 'png' });
  // kosu: ~3 sn, basili/birak donusumlu; isik ve zemin korumasi (yalniz test)
  for (let i = 0; i < 12; i++) { await deger('__koru(), __bas(' + (i % 2 === 0) + '), 1'); await sleep(250); }
  const kosu = await deger('__koru(), __bas(false), [window.__durum.t, window.__durum.bitti]');   // olcumler sirasinda bocek dusebilir: kosu burada
  const sonra = await deger('__olc()');
  const sol = await deger('__sutun(0)'), sag = await deger('__sutun(document.getElementById("abTuval").width - 1)');
  const ust = await deger('__satir(0)'), alt = await deger('__satir(document.getElementById("abTuval").height - 1)');
  const once = await deger('__oncesi([0, document.getElementById("abTuval").width - 1], [0, document.getElementById("abTuval").height - 1])');
  const g2 = await gonder('Page.captureScreenshot', { format: 'png' });
  // GW_MAX kirpma: bocegin y'sinde iki bomba (biri GW icinde, biri GW_MAX otesinde, atmosferde), 2 kare sonra pikselden
  const kirp = await deger(`(async function () {
    var d = window.__durum, a = document.getElementById('abAlan').getBoundingClientRect(), olcek = a.height / ${H}, GA = a.width / olcek;
    if (GA < ${W}) { olcek = a.width / ${W}; GA = ${W}; }
    var bant = (a.height - ${H} * olcek) / 2;
    var GW = Math.min(GA, ${GW_MAX}), t = document.getElementById('abTuval'), k = t.width / a.width, y = 50;
    var ic = Math.min(GW - 12, 40), dis = GW + Math.min(14, (GA - GW) / 2);
    __koru();
    // uzak (ufuktaki) iki dilime: cizim her dilimin bombasini kendi x'iyle cizer; yakin dilim bu arada atilabilir
    var L = d.dilimler, bi = { x: d.mesafe + ic, y: y, alindi: 0 }, bd = GA > ${GW_MAX} + 6 ? { x: d.mesafe + dis, y: y, alindi: 0 } : null;
    L[L.length - 2].bomba = bi; L[L.length - 1].bomba = bd;
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    var px = function (sx) { return sx * olcek * k; }, oy = (a.height - ${H} * olcek) / 2 * k, R = 4 * olcek * k;
    var m = d.mesafe;
    return { GA: GA, GW: GW, bant: bant, ic: __kutu(px(bi.x - m) - R, oy + px(y) - R, px(bi.x - m) + R, oy + px(y) + R),
             dis: bd ? __kutu(px(bd.x - m) - R, oy + px(y) - R, px(bd.x - m) + R, oy + px(y) + R) : null,
             atmosferX: GA > GW + 2 ? Math.round(px(GW + (GA - GW) / 2)) : null };
  })()`);
  if (kirp.atmosferX !== null) kirp.atmosferSutun = (await deger('__oncesi([' + kirp.atmosferX + '])')).sutun[0];
  const g3 = await gonder('Page.captureScreenshot', { format: 'png' });
  if (kayit) {
    fs.mkdirSync(kayit, { recursive: true });
    fs.writeFileSync(path.join(kayit, 'genislik-' + ad + '-bekle.png'), Buffer.from(g1.result.data, 'base64'));
    fs.writeFileSync(path.join(kayit, 'genislik-' + ad + '-kosu.png'), Buffer.from(g2.result.data, 'base64'));
    fs.writeFileSync(path.join(kayit, 'genislik-' + ad + '-bomba.png'), Buffer.from(g3.result.data, 'base64'));
  }
  return { once: ilk, sonra, sol, sag, ust, alt, oncesi: once, kirp, durumT: kosu[0], bitti: kosu[1] };
}

(async () => {
  console.log('Karanlikta Suzul oyun alani genisligi (gercek sayfa, headless Chrome)');
  const chrome = chromeBul();
  if (!chrome) { console.log('  ATLANDI (Chrome yok): CHROME_YOL ile chrome.exe yolunu verin'); return; }
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-genislik-'));
  const sayfa = [sayfaKur(dizin, false), sayfaKur(dizin, true)];
  const c = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(dizin, 'profil'),
    '--force-color-profile=srgb', '--no-first-run', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  const sonuclar = [];
  try {
    let sekmeler;
    for (let i = 0; i < 60; i++) { try { sekmeler = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* Chrome henuz acilmadi */ } await sleep(250); }
    const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    let n = 0; const bek = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (bek[d.id]) bek[d.id](d); };
    const gonder = (method, params) => new Promise(r => { bek[++n] = r; ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
    const deger = async ifade => {
      const r = await gonder('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result.result.value;
    };
    for (const b of BOYUTLAR) sonuclar.push([b, await boyutOlc(gonder, deger, sayfa, b)]);
    ws.close();
  } finally {
    try { c.kill(); } catch (e) { /* kapanmis */ }
    await sleep(300);
    try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici dizin */ }
  }
  const yakin = (a, b, t) => Math.abs(a - b) <= t;
  for (const [[ad, gen, boy, dpr], r] of sonuclar) {
    const o = r.sonra, A = o.alan, k = r.kirp, ob0 = r.oncesi || { sutun: [], satir: [] };   // oncesi null: karanlik tuvali tuval boyutunda degil (asagida HATA)
    console.log('       ' + ad + ': alan ' + A.w + 'x' + A.h.toFixed(1) + ' css, tuval ' + o.bw + 'x' + o.bh + ' px, GA ' + k.GA.toFixed(1) + ', GW ' + k.GW.toFixed(1) +
      ', sol sutun ' + r.sol.renk + ' renk (ort ' + r.sol.ort.toFixed(1) + ', siyah ' + r.sol.siyah + ', duz dolgu ' + r.sol.duz + '/' + r.sol.boy + '), sag sutun ' + r.sag.renk + ' renk (ort ' + r.sag.ort.toFixed(1) +
      ', siyah ' + r.sag.siyah + ', duz dolgu ' + r.sag.duz + ', ornek ' + r.sag.ornek.join(' ') + '), bomba ic ' + k.ic + ' dis ' + k.dis +
      (k.atmosferSutun ? ', atmosfer sutunu (karanliktan once) ' + k.atmosferSutun.renk + ' renk' : '') +
      ', karanliktan once sol/sag ' + ob0.sutun.map(s => s.renk + ' renk duz ' + s.duz).join(' / ') + ', ust/alt satir ' + [r.ust, r.alt].map(s => s.renk + ' renk duz ' + s.duz + '/' + s.boy).join(' / ') +
      ', karanliktan once ust/alt ' + ob0.satir.map(s => s.renk + ' renk duz ' + s.duz).join(' / ') + ', bant ' + k.bant.toFixed(1) + ' css px, kosu ' + r.durumT.toFixed(2) + ' sn');
    dene(ad + ': oyun ekrani acik, kosu surdu', () => {
      assert.ok(/matrix\(1, 0, 0, 1, 0, 0\)|none/.test(o.ekran), 'ekran gecisi: ' + o.ekran);
      assert.ok(r.durumT > 1.5 && !r.bitti, 'kosu ' + r.durumT);
    });
    dene(ad + ': tuval css genisligi/yuksekligi == .ab-alan (dokunma alani tum alan)', () => {
      assert.ok(yakin(o.tuval.w, A.w, 0.01) && yakin(o.tuval.h, A.h, 0.01) && yakin(o.tuval.x, A.x, 0.01) && yakin(o.tuval.y, A.y, 0.01), JSON.stringify([o.tuval, A]));
      assert.ok(Math.abs(o.bw - Math.round(A.w * Math.min(dpr, 2))) <= 1, 'tuval piksel genisligi ' + o.bw);
    });
    dene(ad + ': sol ve sag kenar piksel sutunlari duz degil (sahne icerigi), hicbiri (0,0,0) sutun degil', () => {
      // Karanlik katmani (%94) koyu arka planin ustunde tek renge yuvarlanabilir; olcut: sutun tamamen (0,0,0) degil ve
      // tamamen duz zemin dolgusu (eski letterbox bandi rengi) degil, yani arka plan + karanlik cizilmis.
      [['sol', r.sol], ['sag', r.sag]].forEach(([y, s]) => assert.ok(s.siyah < s.boy, y + ' sutun tamamen (0,0,0)'));
      const ob = r.oncesi;
      assert.ok(ob && ob.kcW === o.bw && ob.kcH === o.bh, 'karanlik tuvali tum tuvali kaplamiyor ' + JSON.stringify(ob && [ob.kcW, ob.kcH]));
      ob.sutun.forEach((s, j) => {
        assert.ok(s.duz < s.boy * 0.5 && s.renk >= 8, (j ? 'sag' : 'sol') + ' sutun karanliktan once duz (arka plan yok): ' + JSON.stringify(s));
      });
    });
    dene(ad + ': ust ve alt kenar piksel satirlari duz degil (dar ekranda bant da arka plan + karanlik), hicbiri (0,0,0) satir degil', () => {
      // Dar ekranda (bant > 0) satir 0 ve son satir bantin icindedir: eski cizimde tamamen duz zemin dolgusu (pal.karanlik) idi
      // (karanliktan once duz = boy). Genis ekranda ayni satirlar sahnenin ust/alt kenaridir.
      [['ust', r.ust], ['alt', r.alt]].forEach(([y, s]) => assert.ok(s.siyah < s.boy, y + ' satir tamamen (0,0,0)'));
      assert.ok(r.oncesi && r.oncesi.satir.length === 2, 'karanlik tuvali tum tuvali (bantlar dahil) kaplamiyor: karanliktan once olculemedi');
      r.oncesi.satir.forEach((s, j) => {
        assert.ok(s.duz < s.boy * 0.5 && s.renk >= 8, (j ? 'alt' : 'ust') + ' satir karanliktan once duz (arka plan yok): ' + JSON.stringify(s));
      });
    });
    dene(ad + ': "Dokun ve basla" alanda yatay ortali, HUD ekranda ortali', () => {
      const b = r.once, ipx = b.ipucu.x + b.ipucu.w / 2, ax = b.alan.x + b.alan.w / 2;
      assert.ok(b.ipucuGorunur === '1', 'ipucu gorunur degil ' + b.ipucuGorunur);
      assert.ok(yakin(ipx, ax, 1), 'ipucu merkezi ' + ipx + ' alan merkezi ' + ax);
      const kx0 = b.kutu[0].x, kx1 = b.kutu[b.kutu.length - 1].x + b.kutu[b.kutu.length - 1].w, hx = b.hud.x + b.hud.w / 2;
      assert.ok(yakin((kx0 + kx1) / 2, hx, 1.5), 'HUD ortali degil ' + (kx0 + kx1) / 2 + ' / ' + hx);
    });
    dene(ad + ': oyun dunyasi GW = min(GA, GW_MAX) icinde cizilir; GW_MAX otesi yalniz atmosfer', () => {
      assert.ok(yakin(k.GW, Math.min(k.GA, GW_MAX), 1e-9) && k.GA >= W);
      assert.ok(k.ic > 120, 'GW icindeki bomba cizilmedi (' + k.ic + ')');
      if (k.dis !== null) {
        assert.ok(k.dis < 40, 'GW_MAX otesindeki bomba cizildi (' + k.dis + ')');
        assert.ok(k.atmosferSutun.duz < k.atmosferSutun.boy * 0.5 && k.atmosferSutun.renk >= 8, 'atmosfer sutununda arka plan yok ' + JSON.stringify(k.atmosferSutun));
      }
    });
  }
  // 411x960 kurulu: alan 411x829 css (HUD dahil degil), GA 49,6 -> bant ~3,5 css px = 7 cihaz pikseli: satir 0 ve son satir bantin icinde
  dene('dar ekran sinandi: en az bir boyutta ust/alt bant var (alan en/boy < W/H) ve kenar satirlari bantin icinde (bant >= 2 cihaz pikseli)', () => {
    assert.ok(sonuclar.some(([b, r]) => r.kirp.bant * Math.min(b[3], 2) >= 2), sonuclar.map(([b, r]) => b[0] + ' bant ' + r.kirp.bant.toFixed(1)).join(', '));
  });
  dene('genis/yatay oran sinandi: en az bir boyutta GA > GW_MAX (atmosfer dolgusu ve kirpma)', () => {
    assert.ok(sonuclar.some(([, r]) => r.kirp.GA > GW_MAX + 6 && r.kirp.dis !== null), sonuclar.map(([b, r]) => b[0] + ' GA ' + r.kirp.GA.toFixed(1)).join(', '));
  });
  console.log(gecti + ' deneme gecti' + (hata ? ', ' + hata + ' HATA' : ''));
})().catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
