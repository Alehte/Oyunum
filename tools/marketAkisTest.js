// marketAkisTest.js — market yerinde guncelleme DOM akisi, GERCEK index.html ile headless Chrome'da (CDP; sandikYakala.js duzeni).
// Akis: vitrinden satin al (altin fiyat kadar duser, kart vitrinden kalkar) -> Sonra -> Envanter -> Kullan (secili kart en ustte,
// tek secili, sahip olunanlar once, altin degismez, onizleme dugumu tasinir, degismeyen kart yeniden kurulmaz) -> vitrinin
// hepsini al (bos vitrin). Her adimda IntersectionObserver'in izledigi her dugum belgede olmali (kopuk dugum izlenmez).
// Chrome yoksa ATLANDI (basarisiz sayilmaz).  Calistirma:  node tools/marketAkisTest.js
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), url = require('url');
const KOK = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(a => a && fs.existsSync(a));
console.log('market yerinde guncelleme (headless DOM akisi)');
if (!chrome) { console.log('  ATLANDI (Chrome yok): CHROME_YOL verin; basarisiz sayilmadi'); process.exit(0); }

// IntersectionObserver izleme kaydi (sayfanin betiklerinden once)
const IZ = '<script>(function(){var IO=window.IntersectionObserver;if(!IO)return;window.__izlenen=new Set();' +
  'var o=IO.prototype.observe,u=IO.prototype.unobserve;' +
  'IO.prototype.observe=function(e){__izlenen.add(e);return o.call(this,e)};' +
  'IO.prototype.unobserve=function(e){__izlenen.delete(e);return u.call(this,e)};})();</script>';

const AKIS = '(async function(){var M=AppMarket,h=[],w=function(ms){return new Promise(function(r){setTimeout(r,ms)})};' +
  'function ok(c,m){if(!c)h.push(m)}' +
  'function kopuk(ad){if(window.__izlenen)__izlenen.forEach(function(e){if(!e.isConnected)h.push(ad+": kopuk dugum izleniyor")})}' +
  'function kapat(){var s=document.querySelector("#mkSonuc [data-eylem=sonucKapat]");if(s)s.click()}' +
  'AppProgress.gold=99999;MarketEkran.ac();await w(400);' +
  'var b=document.querySelector("#mkVitrin [data-eylem=al]");if(!b)return JSON.stringify(["vitrinde alinabilir tema yok"]);' +
  'var id=b.getAttribute("data-id"),f=M.fiyat(id),g0=AppGold.get(),vk=document.querySelectorAll("#mkVitrin .mk-kart").length;' +
  'b.click();await w(50);' +
  'ok(M.sahipMi(id),"satin alinmadi");ok(AppGold.get()===g0-f,"altin "+AppGold.get()+" != "+(g0-f));' +
  'ok(document.getElementById("mkSonuc").classList.contains("gorunur"),"sonuc acilmadi");' +
  'ok(document.querySelectorAll("#mkVitrin .mk-kart").length===vk-1,"alinan kart vitrinden kalkmadi");kopuk("satin alma");' +
  'kapat();document.querySelector("[data-mod=envanter]").click();await w(150);' +
  'var iz=document.getElementById("mkIzgara"),kil=iz.querySelector(".mk-kart.kilitli"),kb=iz.querySelector("[data-eylem=sec][data-id=\\""+id+"\\"]");' +
  'if(!kb)return JSON.stringify(h.concat(["envanterde Kullan yok"]));' +
  'var oz=kb.closest(".mk-kart").querySelector(".mk-onizleme"),g1=AppGold.get(),once=M.seciliId();' +
  'kb.click();await w(50);' +
  'ok(M.seciliId()===id,"secili degil");ok(AppGold.get()===g1,"Kullan altini degistirdi");' +
  'var ilk=iz.firstElementChild;ok(ilk&&ilk.classList.contains("secili")&&!!ilk.querySelector(".mk-btn.secili"),"secili kart en ustte degil");' +
  'ok(ilk&&ilk.querySelector(".mk-onizleme")===oz,"onizleme tasinmadi (yeniden kuruldu)");' +
  'ok(iz.querySelectorAll(".mk-kart.secili").length===1,"tek secili kart yok");' +
  'ok(iz.querySelectorAll(".mk-kart").length===M.temalar().length,"kart sayisi");' +
  'var k=[].slice.call(iz.children),i=k.findIndex(function(x){return x.classList.contains("kilitli")});' +
  'ok(i<0||k.slice(i).every(function(x){return x.classList.contains("kilitli")}),"sira: sahip olunanlar once degil");' +
  'ok(!kil||kil.isConnected,"degismeyen (kilitli) kart yeniden kuruldu");' +
  'ok(!!iz.querySelector("[data-eylem=sec][data-id=\\""+once+"\\"]"),"onceki tema Kullan dugmesine donmedi");kopuk("Kullan");' +
  'document.querySelector("[data-mod=magaza]").click();await w(50);' +
  'for(var n=0,x;n<12&&(x=document.querySelector("#mkVitrin [data-eylem=al]"));n++){x.click();kapat();await w(20)}' +
  'ok(!document.querySelector("#mkVitrin .mk-kart")&&!!document.querySelector("#mkVitrin .mk-vitrin-bos"),"vitrin bosalmadi");kopuk("bos vitrin");' +
  'return JSON.stringify(h)})()';

(async () => {
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-akis-')), port = String(9800 + Math.floor(Math.random() * 400));
  let html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  html = html.replace('<head>', '<head><base href="' + url.pathToFileURL(KOK + path.sep).href + '">' + IZ);
  const sayfa = path.join(dizin, 'sayfa.html'); fs.writeFileSync(sayfa, html);
  const c = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(dizin, 'profil'),
    '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  const bitir = kod => {
    try { c.kill(); } catch (e) { /* kapanmis */ }
    setTimeout(() => { try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici */ } process.exit(kod); }, 300);
  };
  try {
    let sekmeler;
    for (let i = 0; i < 60; i++) { try { sekmeler = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* henuz acilmadi */ } await sleep(250); }
    const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    let n = 0; const bek = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (bek[d.id]) bek[d.id](d); };
    const gonder = (method, params) => new Promise(r => { bek[++n] = r; ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
    // kisa ekran: envanterin alt kartlari onizlemesini bekler (gozcu devrede)
    await gonder('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 2, mobile: true });
    await gonder('Page.navigate', { url: url.pathToFileURL(sayfa).href });
    await sleep(2000);
    const r = await gonder('Runtime.evaluate', { expression: AKIS, awaitPromise: true, returnByValue: true });
    ws.close();
    const v = r.result && r.result.result && r.result.result.value;
    if (typeof v !== 'string') { console.log('  HATA akis calismadi: ' + JSON.stringify(r.result && (r.result.exceptionDetails || r.result)).slice(0, 400)); bitir(1); return; }
    const hatalar = JSON.parse(v);
    const ad = 'satin al -> Kullan: altin, secili, sira, onizleme tasima, degismeyen kart aynen; bos vitrin; gozcu kopuk dugum izlemiyor';
    if (hatalar.length) { console.log('  HATA ' + ad + '\n       ' + hatalar.join('; ')); bitir(1); return; }
    console.log('  ok  ' + ad);
    console.log('1 gecti');
    bitir(0);
  } catch (e) { console.log('  HATA ' + String(e && e.stack || e)); bitir(1); }
})();
