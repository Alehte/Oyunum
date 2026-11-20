// atesBocegiTemaYakala.js — Karanlikta Suzul GERCEK cizim kodunu (js/atesBocegiOyun.js canvas) headless Chrome'da
// calistirir; ayni sabit sahneyi (sabit tohum, sabit an, azaltilmis hareket: animasyon yok) her temada ve 4 bolgede
// cizer, tuval piksellerini PNG (base64) olarak JSON'a yazar. atesBocegiTemaTest.js temalar arasi renk uzakligini
// (CIEDE2000) bu goruntulerden olcer (tasarim 12.3).
// Kullanim:  node tools/atesBocegiTemaYakala.js <chrome> <port> [kayitDizini]
//   kayitDizini verilirse her goruntu <tema>-b<bolge>.png olarak oraya da yazilir (gozle denetim icin).
// Sahne yapay ama oyunun kendi veri yapisidir: bir dilimde ust/alt dikenli dal, ag, kus, dusen dal, bomba,
// buyumus sarmasik, toz ve kivilcim; ikinci dilimde uyari fazinda sarmasik (unlem + hayalet siluet).
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), url = require('url');
const [, , chrome, port, kayit] = process.argv;
const KOK = path.join(__dirname, '..');
const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tema-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const js = f => url.pathToFileURL(path.join(KOK, 'js', f)).href;

const SAYFA = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#000}#abAlan{position:relative;width:300px;height:600px}#abTuval{width:300px;height:600px;display:block}.gizli{display:none}</style>
<div class="phone reduced-motion"><div id="screen-ates">
<div class="gizli"><div><i id="abPuan"></i></div><div><i id="abRekor"></i></div><div><i id="abCarpan"></i></div><div><i id="abIsik"></i></div>
<div id="abIpucu"></div><div id="abDuraklat"></div><div id="abSonuc"><div id="abSonBaslik"></div><div id="abSonAlt"></div></div>
<button id="abDurBtn"></button><button id="abDevam"></button><button id="abYeniden"></button><button id="abTekrar"></button><button id="abAna"></button><button id="atesBackBtn"></button></div>
<div id="abAlan"><canvas id="abTuval"></canvas></div></div></div>
<script>
  var depo = {};
  window.AppProgress = { gold: 0, surum: 3 };
  window.AppGold = { harca: function () { return true; }, add: function () {} };
  window.AppStore = { get: function (k, v) { return k in depo ? depo[k] : v; }, set: function (k, v) { depo[k] = v; } };
  window.AppSaveProgress = function () {}; window.AppReset = []; window.AppGelistirme = null; window.AppReklam = null;
  window.devicePixelRatio = 1;
</script>
<script src="${js('marketKatalog.js')}"></script>
<script src="${js('market.js')}"></script>
<script src="${js('atesBocegi.js')}"></script>
<script src="${js('atesBocegiOyun.js')}"></script>
<script>
  var AB = window.AtesBocegi, durum = null, ilk = AB.oyunOlustur;
  AB.oyunOlustur = function () { durum = ilk(20261120); return durum; };       // sabit tohum
  function sahne(b) {
    var d = durum;
    d.mesafe = 0; d.y = 50; d.vy = 0; d.isik = 1; d.dokunulmaz = 0; d.sersem = 0; d.bitti = 0; d.puan = 0; d.zincir = 0;
    d.bolge = b; d.gorunenBolge = b;
    d.dilimler = [{
      x: 0, w: 50, bolge: b,
      engeller: [
        { tur: 'dal', yon: 'ust', x: 14, y: 0, w: 5, h: 30 }, { tur: 'dal', yon: 'alt', x: 14, y: 72, w: 5, h: 28 },
        { tur: 'ag', x: 26, y: 10, w: 7, h: 16 }, { tur: 'kus', x: 30, y: 66, w: 5, h: 3.5 },
        { tur: 'dusen', x: 40, y: 14, w: 5, h: 8, faz: 0, sure: 0 }
      ],
      toz: [{ x: 20, y: 45, alindi: 0, yutuldu: 0 }, { x: 23, y: 57, alindi: 0, yutuldu: 0 }, { x: 36, y: 40, alindi: 0, yutuldu: 0 }, { x: 38, y: 55, alindi: 0, yutuldu: 0 }],
      kivilcim: { x: 31, y: 48, alindi: 0 },
      bomba: { x: 25, y: 36, alindi: 0 },
      sarmasik: { yon: 'alt', faz: 3, ilerleme: 1, x1: 34, x2: 37, sutunlar: [{ x: 34, y: 76, w: 3, h: 24 }] }
    }, {
      x: 50, w: 50, bolge: b, engeller: [], toz: [], kivilcim: null, bomba: null,
      sarmasik: { yon: 'ust', faz: 1, ilerleme: 0, x1: 46, x2: 49, sutunlar: [{ x: 46, y: 0, w: 3, h: 22 }] }
    }];
  }
  function kare() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }); }
  window.yakala = async function (id, b) {
    if (AppProgress.market.s.indexOf(id) < 0) AppProgress.market.s.push(id);
    AppMarket.sec(id);
    sahne(b);
    await kare();
    return document.getElementById('abTuval').toDataURL('image/png');
  };
  window.hazir = false;
  window.addEventListener('load', function () { AtesBocegiOyun.start(); requestAnimationFrame(function () { window.hazir = true; }); });
</script>`;
fs.writeFileSync(path.join(dizin, 'sayfa.html'), SAYFA);

const c = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(dizin, 'profil'),
  '--force-color-profile=srgb', '--no-first-run', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
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
  const degerlendir = async ifade => {
    const r = await gonder('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result.result.value;
  };
  await gonder('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: false });
  await gonder('Page.navigate', { url: url.pathToFileURL(path.join(dizin, 'sayfa.html')).href });
  for (let i = 0; i < 80 && !(await degerlendir('window.hazir === true')); i++) await sleep(100);
  if (!(await degerlendir('window.hazir === true'))) throw new Error('sayfa hazir olmadi');
  const temalar = await degerlendir('AppMarket.temalar().map(function (t) { return t.id; })');
  const sonuclar = [];
  for (const id of temalar) {
    for (let b = 0; b < 4; b++) {
      const veri = await degerlendir('yakala(' + JSON.stringify(id) + ',' + b + ')');
      const png = veri.replace(/^data:image\/png;base64,/, '');
      sonuclar.push({ tema: id, bolge: b, png });
      if (kayit) { fs.mkdirSync(kayit, { recursive: true }); fs.writeFileSync(path.join(kayit, id + '-b' + b + '.png'), Buffer.from(png, 'base64')); }
    }
  }
  process.stdout.write(JSON.stringify({ sonuclar }));
  ws.close(); bitir(0);
})().catch(e => bitir(1, String(e && e.stack || e)));
