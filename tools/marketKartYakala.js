// marketKartYakala.js — GERCEK index.html + style.css + js/*.js ile market envanterini headless Chrome'da acar,
// 9 temanin Karanlikta Suzul onizleme kutularinin ekran goruntusunu ve konumlarini JSON olarak yazdirir.
// Kullanim (atesBocegiTemaTest.js cagirir):  node tools/marketKartYakala.js <chrome> <otomatikKaranlik 0|1> <port>
// Ek (istege bagli) arguman: <genislik> (varsayilan 390) ve <ref 0|1>: 1 ise style.css ve js/marketEkran.js sabit REFERANS commit'inin
// surumuyle yuklenir (Asama 1 oncesi, 9d29413: market minisi duzeltmesi e6cd1fd'den once). HEAD degil: e6cd1fd commit edildikten sonra
// HEAD ile karsilastirma calisma agacini kendisiyle karsilastirirdi.
// <gizle 0|1>: 1 ise .mo-ates gizlenir ve tum animasyon/gecisler durdurulur (referans karsilastirmasinda yerlesim ayni kalsin; Lav parilti animasyonu zamanlamasi pikseli oynatmasin).
// Otomatik karanlik = Android Chrome "web icerigini karart" (CDP Emulation.setAutoDarkModeOverride).
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const [, , chrome, oto, port, genislikArg, refArg, gizleArg] = process.argv;
const GENISLIK = +genislikArg || 390;
const KOK = path.join(__dirname, '..');
const REFERANS = '9d29413';   // Asama 1 oncesi (gorev-karanliktaSuzul3); referans surum bu commit'ten okunur
const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-kart-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
const url = require('url');
if (refArg === '1') {   // referans karsilastirmasi: yalniz bu iki dosya REFERANS commit'inden gelir, gerisi calisma agaci
  ['style.css', 'js/marketEkran.js'].forEach(f => {
    const g = cp.execFileSync('git', ['show', REFERANS + ':' + f], { cwd: KOK, encoding: 'utf8', maxBuffer: 1 << 26 }), h = path.join(dizin, 'ref-' + path.basename(f));
    // referans css gecici dizinden yuklenir: goreli url(fonts/..), url(img/..) kokten mutlak file URL'ye cevrilir (yoksa font/gorsel yuklenmez, 2048 yazi tipi farkli cikar)
    fs.writeFileSync(h, f === 'style.css' ? g.replace(/url\((?!["']?(?:data:|https?:|file:|#))(["']?)([^)"']+)\1\)/g, (m, q, u) => 'url(' + url.pathToFileURL(path.join(KOK, u)).href + ')') : g);
    html = html.replace('"' + f + '"', '"' + url.pathToFileURL(h).href + '"');
  });
}
if (gizleArg === '1') html = html.replace('</head>', '<style>.mo-ates{display:none !important}*,*::before,*::after{animation:none !important;transition:none !important}</style></head>');
html = html.replace('<head>', '<head><base href="' + require('url').pathToFileURL(KOK + path.sep).href + '">');
html = html.replace('</body>', '<script>window.addEventListener("load",function(){setTimeout(function(){' +
  'AppMarket.temalar().forEach(function(t){if(AppProgress.market.s.indexOf(t.id)<0)AppProgress.market.s.push(t.id)});' +
  'MarketEkran.ac();document.querySelector("[data-mod=envanter]").click();},300)});</script></body>');
fs.writeFileSync(path.join(dizin, 'sayfa.html'), html);
const c = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(dizin, 'profil'),
  '--force-color-profile=srgb', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
function bitir(kod, hata) {
  try { c.kill(); } catch (e) { /* kapanmis */ }
  setTimeout(() => { try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici dizin */ } process.exit(kod); }, 300);
  if (hata) console.error(hata);
}
(async () => {
  let sekmeler;
  for (let i = 0; i < 60; i++) { try { sekmeler = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* Chrome henuz acilmadi */ } await sleep(250); }
  const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let n = 0; const bek = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (bek[d.id]) bek[d.id](d); };
  const gonder = (method, params) => new Promise(r => { bek[++n] = r; ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
  await gonder('Emulation.setDeviceMetricsOverride', { width: GENISLIK, height: 2400, deviceScaleFactor: 1, mobile: true });
  await gonder('Emulation.setAutoDarkModeOverride', { enabled: oto === '1' });
  await gonder('Page.navigate', { url: require('url').pathToFileURL(path.join(dizin, 'sayfa.html')).href });
  await sleep(2500);
  // yuklenme zamanlamasi degisken (ozellikle referans/gizli surum): kartlar gelene kadar bekle (yoksa nadiren 0 kart donuyordu), sonra yerlesim otursun
  for (let i = 0; i < 40; i++) {
    const k = await gonder('Runtime.evaluate', { returnByValue: true, expression: 'document.querySelectorAll("#mkIzgara .mk-kart .mo-ates").length' });
    if (k.result && k.result.result && k.result.result.value >= 10) break;
    await sleep(250);
  }
  await sleep(300);
  const r = await gonder('Runtime.evaluate', { returnByValue: true, expression:
    'JSON.stringify(Array.prototype.map.call(document.querySelectorAll("#mkIzgara .mk-kart"),function(k){var b=k.querySelector(".mo-ates").getBoundingClientRect();' +
    'var oz=k.querySelector(".mk-onizleme"),o=oz.getBoundingClientRect();' +
    'var R=function(q){var e=k.querySelector(q);if(!e)return null;var r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}};' +
    'var st=getComputedStyle(k.querySelector(".mo-ates"));' +
    'return {ad:k.querySelector(".mk-ad").textContent,x:b.left,y:b.top,w:b.width,h:b.height,' +
    'oz:{x:o.left,y:o.top,w:o.width,h:o.height,tasma:oz.scrollWidth>oz.clientWidth},' +
    'ates:{bg:st.backgroundColor,br:st.borderRadius,kenar:st.borderTopWidth},' +
    'digerleri:{k2048:R(".board.mo-board"),kacis:R(".mo-yilan"),tempo:R(".mo-bloklar"),sirala:R(".mo-siseler")}}}))' });
  const png = await gonder('Page.captureScreenshot', { format: 'png' });
  process.stdout.write(JSON.stringify({ kutular: JSON.parse(r.result.result.value), png: png.result.data }));
  ws.close(); bitir(0);
})().catch(e => bitir(1, String(e && e.stack || e)));
