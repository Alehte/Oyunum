// atesBocegiBolgeTest.js — Karanlikta Suzul FAZ B (tasarim 13) GERCEK index.html + style.css + js/ ile headless Chrome'da,
// yerel http sunucusu uzerinden (127.0.0.1: reklam.js sahte modu yalniz yerel adreste). 390x844 telefon, iki mod: normal ve
// ?reklamTest=1. Her modda: ana ekrandan Suzul acilir; test kancasi (yalniz bu testin sayfaya ekledigi betik: AtesBocegi.oyunOlustur
// sarilir, window.__bas verilirse cekirdegin oyunOlustur(tohum, {mesafe, puan}) kancasiyla kosu o mesafede baslar; uretim kodunda
// URL parametresi yok) ile her kademe esiginin hemen altindan baslanir: "Bolge 2/3/4/5" yazisi gorunur ve 1,5 sn sonra kaybolur;
// kademe 5'te ekrandaki ipe asili orumcek (salinan engel) ekran goruntusune girer. Konsol hatasi ve yakalanmamis istisna 0.
// Kullanim:  node tools/atesBocegiBolgeTest.js [kayitDizini]   (ekran goruntuleri PNG). Chrome yoksa ATLANDI. Port 9471 (+ http).
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), assert = require('assert');
const KOK = path.join(__dirname, '..'), PORT = 9471, kayit = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AB = require(path.join(KOK, 'js', 'atesBocegi.js'));
const KAD = AB.AYAR.zorluk.KADEME;

function chromeBul() {
  const adaylar = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return adaylar.find(a => fs.existsSync(a)) || null;
}
let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// Test kancasi: AtesBocegi yuklenince oyunOlustur sarilir; __bas varsa baslangic secenegi verilir, durum window.__durum'da.
const KANCA = '<script>(function(){var ab;Object.defineProperty(window,"AtesBocegi",{configurable:true,get:function(){return ab;},' +
  'set:function(v){ab=v;var o=v.oyunOlustur;v.oyunOlustur=function(t){window.__durum=o(t,window.__bas);return window.__durum;};}});' +
  'window.__koru=function(){var d=window.__durum;if(d){d.isik=1;d.zeminKoruma=1;d.dokunulmaz=1;}};' +
  'window.__bas_=function(b){var t=document.getElementById("abTuval");t.dispatchEvent(new PointerEvent(b?"pointerdown":"pointerup",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"}));};' +
  '})();</script>';
const TUR = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
              '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function sunucu() {
  return http.createServer((istek, yanit) => {
    let yol = decodeURIComponent(istek.url.split('?')[0]); if (yol === '/') yol = '/index.html';
    const dosya = path.join(KOK, path.normalize(yol).replace(/^([\\/])+/, ''));
    if (!dosya.startsWith(KOK) || !fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) { yanit.writeHead(404); yanit.end(); return; }
    let veri = fs.readFileSync(dosya);
    if (yol === '/index.html') veri = Buffer.from(veri.toString('utf8').replace('<head>', '<head>' + KANCA));
    yanit.writeHead(200, { 'Content-Type': TUR[path.extname(dosya)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    yanit.end(veri);
  });
}

async function mod(gonder, deger, adres, ad, hatalar) {
  const sonuc = { ad, yazilar: [], kayboldu: [], orumcek: null, destek: null };
  await gonder('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await gonder('Page.navigate', { url: adres });
  for (let i = 0; i < 100 && !(await deger('!!document.getElementById("cardAtes") && document.readyState === "complete"')); i++) await sleep(100);
  await sleep(500);
  sonuc.destek = await deger('!!(window.Reklam && window.Reklam.destekleniyor && window.Reklam.destekleniyor())');
  await deger('document.getElementById("cardAtes").click(), 1');
  for (let i = 0; i < 100 && !(await deger('!!window.AtesBocegiOyun && !!window.__durum')); i++) await sleep(100);
  await sleep(900);
  const kaydet = async (dosya) => {
    if (!kayit) return;
    const g = await gonder('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(kayit, { recursive: true }); fs.writeFileSync(path.join(kayit, dosya), Buffer.from(g.result.data, 'base64'));
  };
  for (let k = 2; k <= 5; k++) {
    await deger('window.__bas = { mesafe: ' + (KAD[k - 1] - 30) + ', puan: 0 }; AtesBocegiOyun.start(); __bas_(true), 1');
    let gor = null;
    for (let i = 0; i < 80 && !gor; i++) {
      gor = await deger('(__koru(), __bas_(' + (i % 4 < 2) + '), (function(){var b=document.getElementById("abBolge");return b.classList.contains("show")&&b.textContent?' +
                        '{y:b.textContent,op:getComputedStyle(b).opacity,m:window.__durum.mesafe,k:window.__durum.kademe}:null;})())');
      if (!gor) await sleep(60);
    }
    if (gor) { await sleep(250); gor.op2 = await deger('getComputedStyle(document.getElementById("abBolge")).opacity'); await kaydet('bolge' + k + '-' + ad + '.png'); }
    sonuc.yazilar.push(gor);
    await sleep(1500);
    for (let i = 0; i < 4; i++) { await deger('__koru(), 1'); await sleep(100); }
    sonuc.kayboldu.push(await deger('!document.getElementById("abBolge").classList.contains("show")'));
  }
  // kademe 5: ekranda (isik cemberinde) ipe asili orumcek
  await deger('window.__bas = { mesafe: 9000, puan: 3000 }; AtesBocegiOyun.start(); __bas_(true), 1');
  for (let i = 0; i < 300 && !sonuc.orumcek; i++) {
    sonuc.orumcek = await deger('(function(){__koru();__bas_(' + (i % 6 < 3) + ');var d=window.__durum;for(var i=0;i<d.dilimler.length;i++){var s=d.dilimler[i];' +
      'for(var j=0;j<s.engeller.length;j++){var e=s.engeller[j],x=e.x-d.mesafe;if(e.tur==="salinan"&&x>14&&x<30)return {x:x,y:e.y,yon:e.yon,kademe:s.kademe};}}return null;})()');
    if (!sonuc.orumcek) await sleep(40);
  }
  if (sonuc.orumcek) await kaydet('orumcek-' + ad + '.png');
  sonuc.bitti = await deger('window.__durum.bitti');
  if (ad === 'normal') {
    // Gorsel kanit (yalniz test): isik cemberinde sabit ekran konumunda iki orumcek (ust: tavandan ipli, alt: ipsiz) ve en dar
    // ekranda (GA = W) bomba on isareti. Nesneler her karede ayni ekran x'ine yeniden konur (yakalama gecikmesinden bagimsiz);
    // bocek y = 47'de tutulur (yalniz bu gorsel asamada), isik ve dokunulmazlik korunur. Cekirdek salinan hareketini (y) kendisi yurutur.
    await deger('window.__bas = { mesafe: 9000, puan: 3000 }; AtesBocegiOyun.start(); __bas_(true), 1');
    await deger(`(function(){ var d = window.__durum, s = d.dilimler[d.dilimler.length - 1];
      var u = { tur: 'salinan', yon: 'ust', x: 0, y: 26, w: 5, h: 6, yc: 26, gen: 3, om: 3, faz: 0 }, a = { tur: 'salinan', yon: 'alt', x: 0, y: 64, w: 5, h: 6, yc: 64, gen: 3, om: 3, faz: 1 };
      s.engeller.push(u, a); window.__sabit = function () { var d = window.__durum; u.x = d.mesafe + 22; a.x = d.mesafe + 30; __koru();
        d.y = 47; d.vy = 0; d.ay = 0; if (window.__sabitAcik) requestAnimationFrame(window.__sabit); };
      window.__sabitAcik = true; requestAnimationFrame(window.__sabit); return 1; })()`);
    await sleep(1500); await kaydet('orumcek-ust-alt.png');
    sonuc.orumcekIkili = await deger('(function(){var d=window.__durum,L=[];d.dilimler.forEach(function(s){s.engeller.forEach(function(e){var x=e.x-d.mesafe;if(e.tur==="salinan"&&x>15&&x<35)L.push(e.yon);});});return L;})()');
    await deger('window.__sabitAcik = false, 1'); await sleep(100);
    await gonder('Emulation.setDeviceMetricsOverride', { width: 300, height: 800, deviceScaleFactor: 2, mobile: true });
    await sleep(600);
    await deger(`(function(){ var d = window.__durum, s = d.dilimler[d.dilimler.length - 1], b = { x: 0, y: 40, alindi: 0 }; s.bomba = b;
      window.__sabit = function () { var d = window.__durum; b.x = d.mesafe + ${AB.AYAR.dunya.W} + 3; __koru(); d.y = 47; d.vy = 0; d.ay = 0;
        if (window.__sabitAcik) requestAnimationFrame(window.__sabit); };
      window.__sabitAcik = true; requestAnimationFrame(window.__sabit); return 1; })()`);
    await sleep(800); await kaydet('bomba-on-isaret.png');
    // piksel: oyun dunyasinin sag kenarinda, y = 40 cevresinde en turuncu (R - B) deger (isaret yoksa karanlik)
    const piksel = `(function(y0){ var t = document.getElementById('abTuval'), r = document.getElementById('abAlan').getBoundingClientRect(), k = t.width / r.width;
      var olcek = r.width / ${AB.AYAR.dunya.W}, bant = (r.height - ${AB.AYAR.dunya.H} * olcek) / 2, x0 = Math.round((${AB.AYAR.dunya.W} - 4) * olcek * k), y = Math.round((bant + y0 * olcek) * k), h = Math.round(2.5 * olcek * k);
      var d = t.getContext('2d').getImageData(x0, y - h, t.width - x0, 2 * h).data, en = -999; for (var i = 0; i < d.length; i += 4) en = Math.max(en, d[i] - d[i + 2]); return en; })`;
    sonuc.isaretPiksel = await deger(piksel + '(40)');
    sonuc.isaretYokPiksel = await deger(piksel + '(80)');            // ayni kenarda isaretsiz y (kontrol)
    await deger('window.__sabitAcik = false, 1');
  }
  sonuc.hata = hatalar.slice();
  return sonuc;
}

(async () => {
  console.log('Karanlikta Suzul FAZ B: kademe yazisi ve salinan orumcek (gercek sayfa, yerel sunucu, headless Chrome 390x844)');
  const chrome = chromeBul();
  if (!chrome) { console.log('  ATLANDI (Chrome yok): CHROME_YOL ile chrome.exe yolunu verin'); return; }
  const srv = sunucu(); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const kok = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-bolge-'));
  const c = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(dizin, 'profil'),
    '--force-color-profile=srgb', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  const sonuclar = [];
  try {
    let sekmeler;
    for (let i = 0; i < 60; i++) { try { sekmeler = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* Chrome henuz acilmadi */ } await sleep(250); }
    const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    let n = 0; const bek = {}, hatalar = [];
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (bek[d.id]) bek[d.id](d);
      if (d.method === 'Runtime.exceptionThrown') hatalar.push('istisna: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') hatalar.push('console.error: ' + JSON.stringify(d.params.args).slice(0, 300));
    };
    const gonder = (method, params) => new Promise(r => { bek[++n] = r; ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
    const deger = async ifade => {
      const r = await gonder('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result.result.value;
    };
    await gonder('Runtime.enable');
    for (const [ad, adres] of [['normal', kok], ['reklamTest', kok + '?reklamTest=1']]) { hatalar.length = 0; sonuclar.push(await mod(gonder, deger, adres, ad, hatalar)); }
    ws.close();
  } finally {
    try { c.kill(); } catch (e) { /* kapanmis */ }
    srv.close();
    await sleep(300);
    try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici dizin */ }
  }
  for (const r of sonuclar) {
    console.log('       ' + r.ad + ': destek ' + r.destek + ', yazilar ' + JSON.stringify(r.yazilar.map(y => y && [y.y, +(+y.op2).toFixed(2), Math.round(y.m), y.k])) +
                ', kayboldu ' + JSON.stringify(r.kayboldu) + ', orumcek ' + JSON.stringify(r.orumcek) + ', hata ' + r.hata.length);
    dene(r.ad + ': Suzul acildi, konsol hatasi / istisna 0', () => assert.deepStrictEqual(r.hata, []));
    dene(r.ad + ': reklam destegi ' + (r.ad === 'normal' ? 'yok (tarayici)' : 'var (sahte mod, yerel adres)'), () => assert.strictEqual(r.destek, r.ad !== 'normal'));
    dene(r.ad + ': kademe esiklerinde "Bölge 2/3/4/5" gorunur (opaklik > 0,5), 1,5 sn sonra kaybolur', () => {
      r.yazilar.forEach((y, i) => {
        assert.ok(y && y.y === 'Bölge ' + (i + 2) && y.k === i + 2 && y.m >= KAD[i + 1], 'kademe ' + (i + 2) + ': ' + JSON.stringify(y));
        assert.ok(+y.op2 > 0.5, 'opaklik ' + y.op2);
      });
      assert.deepStrictEqual(r.kayboldu, [true, true, true, true]);
    });
    dene(r.ad + ': kademe 5te ekranda ipe asili orumcek (salinan engel)', () => assert.ok(r.orumcek && r.orumcek.kademe === 5, JSON.stringify(r.orumcek)));
    if (r.ad === 'normal') {
      console.log('       gorsel: isik icinde orumcekler ' + JSON.stringify(r.orumcekIkili) + ', on isaret kenar pikseli (R-B) y40 ' + r.isaretPiksel + ' / isaretsiz y80 ' + r.isaretYokPiksel);
      dene('gorsel: isik cemberinde ust ve alt orumcek; en dar ekranda bomba on isareti sag kenarda turuncu (R-B > 60), isaretsiz yerde degil', () => {
        assert.ok(r.orumcekIkili && r.orumcekIkili.indexOf('ust') >= 0 && r.orumcekIkili.indexOf('alt') >= 0, JSON.stringify(r.orumcekIkili));
        assert.ok(r.isaretPiksel > 60 && r.isaretYokPiksel < 30, r.isaretPiksel + ' / ' + r.isaretYokPiksel);
      });
    }
  }
  console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
})().catch(e => { console.log('  HATA ' + e.stack); process.exitCode = 1; });
