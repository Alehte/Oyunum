// marketKartYakala.js — GERCEK index.html + style.css + js/*.js ile market envanterini headless Chrome'da acar,
// 9 temanin Karanlikta Suzul onizleme kutularinin ekran goruntusunu ve konumlarini JSON olarak yazdirir.
// Kullanim (atesBocegiTemaTest.js cagirir):  node tools/marketKartYakala.js <chrome> <otomatikKaranlik 0|1> <port>
// Otomatik karanlik = Android Chrome "web icerigini karart" (CDP Emulation.setAutoDarkModeOverride).
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const [, , chrome, oto, port] = process.argv;
const KOK = path.join(__dirname, '..');
const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-kart-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
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
  await gonder('Emulation.setDeviceMetricsOverride', { width: 390, height: 2400, deviceScaleFactor: 1, mobile: true });
  await gonder('Emulation.setAutoDarkModeOverride', { enabled: oto === '1' });
  await gonder('Page.navigate', { url: require('url').pathToFileURL(path.join(dizin, 'sayfa.html')).href });
  await sleep(2500);
  const r = await gonder('Runtime.evaluate', { returnByValue: true, expression:
    'JSON.stringify(Array.prototype.map.call(document.querySelectorAll("#mkIzgara .mk-kart"),function(k){var b=k.querySelector(".mo-ates").getBoundingClientRect();' +
    'return {ad:k.querySelector(".mk-ad").textContent,x:b.left,y:b.top,w:b.width,h:b.height}}))' });
  const png = await gonder('Page.captureScreenshot', { format: 'png' });
  process.stdout.write(JSON.stringify({ kutular: JSON.parse(r.result.result.value), png: png.result.data }));
  ws.close(); bitir(0);
})().catch(e => bitir(1, String(e && e.stack || e)));
