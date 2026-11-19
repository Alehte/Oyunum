// sandikYakala.js — GERCEK index.html + style.css ile market sandik bolumunu headless Chrome'da cizer (CDP).
// Kullanim: node tools/sandikYakala.js <chrome> <port> [pngDizini]
// Cikti (stdout): JSON [{durum, genislik, tasma:[...], png}] ; pngDizini verilirse goruntuler oraya yazilir.
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const [, , chrome, port, pngDizin] = process.argv;
const KOK = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DURUMLAR = ['aktif', 'bos', 'tamam'], GENISLIKLER = [320, 390];

function sayfaYaz(dizin, durum) {
  let html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  html = html.replace('<head>', '<head><base href="' + require('url').pathToFileURL(KOK + path.sep).href + '">');
  const betik = 'window.addEventListener("load",function(){setTimeout(function(){' +
    'var d=' + JSON.stringify(durum) + ';' +
    'AppMarket.temalar().forEach(function(t){if(t.varsayilan)return;' +
    'if((d==="tamam"||(d==="bos"&&t.nadirlik!=="efsanevi"))&&AppProgress.market.s.indexOf(t.id)<0)AppProgress.market.s.push(t.id)});' +
    'AppProgress.gold=99999;MarketEkran.ac();},300)});';
  html = html.replace('</body>', '<script>' + betik + '</script></body>');
  const f = path.join(dizin, 'sayfa-' + durum + '.html');
  fs.writeFileSync(f, html);
  return f;
}

(async () => {
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-sandik-'));
  const c = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(dizin, 'profil'),
    '--force-color-profile=srgb', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  const bitir = (kod, hata) => {
    try { c.kill(); } catch (e) { /* kapanmis */ }
    setTimeout(() => { try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici */ } process.exit(kod); }, 300);
    if (hata) console.error(hata);
  };
  try {
    let sekmeler;
    for (let i = 0; i < 60; i++) { try { sekmeler = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* henuz acilmadi */ } await sleep(250); }
    const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    let n = 0; const bek = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (bek[d.id]) bek[d.id](d); };
    const gonder = (method, params) => new Promise(r => { bek[++n] = r; ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
    const sonuc = [];
    for (const durum of DURUMLAR) {
      const f = sayfaYaz(dizin, durum);
      for (const g of GENISLIKLER) {
        await gonder('Emulation.setDeviceMetricsOverride', { width: g, height: 1400, deviceScaleFactor: 2, mobile: true });
        await gonder('Page.navigate', { url: require('url').pathToFileURL(f).href });
        await sleep(2200);
        const r = await gonder('Runtime.evaluate', { returnByValue: true, expression:
          '(function(){var kap=document.getElementById("mkSandiklar"),o=[],kr=kap.getBoundingClientRect();' +
          'Array.prototype.forEach.call(kap.querySelectorAll(".mk-sandik"),function(k,i){var kk=k.getBoundingClientRect();' +
          'if(kk.right>innerWidth+0.5||kk.left<-0.5)o.push("kart "+i+" ekran disi");' +
          'var b=k.querySelector(".mk-sandik-btn"),bb=b.getBoundingClientRect();' +
          'if(b.scrollWidth>b.clientWidth+0.5)o.push("dugme "+i+" scrollWidth "+b.scrollWidth+">"+b.clientWidth);' +
          'Array.prototype.forEach.call(b.children,function(c){var cb=c.getBoundingClientRect();' +
          'if(cb.left<bb.left-0.5||cb.right>bb.right+0.5)o.push("dugme "+i+" icerik tasti: "+c.textContent)});' +
          'if(bb.right>kk.right+0.5||bb.left<kk.left-0.5)o.push("dugme "+i+" kart disina tasti")});' +
          'return JSON.stringify({tasma:o,x:kr.left,y:kr.top,w:kr.width,h:kr.height,metin:Array.prototype.map.call(kap.querySelectorAll(".mk-sandik-btn"),function(b){return b.textContent})})})()' });
        const o = JSON.parse(r.result.result.value);
        const ek = await gonder('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, o.x - 8), y: Math.max(0, o.y - 8), width: o.w + 16, height: o.h + 16, scale: 1 } });
        const ad = 'sandik-' + durum + '-' + g + '.png';
        if (pngDizin) { fs.mkdirSync(pngDizin, { recursive: true }); fs.writeFileSync(path.join(pngDizin, ad), Buffer.from(ek.result.data, 'base64')); }
        sonuc.push({ durum, genislik: g, tasma: o.tasma, metin: o.metin, png: ad });
      }
    }
    ws.close();
    process.stdout.write(JSON.stringify(sonuc));
    bitir(0);
  } catch (e) { bitir(1, String(e && e.stack || e)); }
})();
