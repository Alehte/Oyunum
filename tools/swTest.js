// swTest.js — sw.js kurulum (install) / etkinlesme (activate) / isit / gezinme akisini
// sahte bir tarayici ortaminda dener. Calistirma:  node tools/swTest.js
// self, caches, fetch, Request taklittir; fetch dosyalari diskten okur, yoksa
// 404 doner. Cache.addAll tarayicidaki gibi davranir: hepsi ok ise hepsini
// yazar, biri bile ok degilse hicbirini yazmadan reddeder.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const KOK = path.join(__dirname, '..');
const kaynak = fs.readFileSync(path.join(KOK, 'sw.js'), 'utf8');

// Dosya diskte TAM bu adla (buyuk/kucuk harf dahil) var mi? Windows'ta
// fs.existsSync harf duyarsizdir; GitHub Pages duyarlidir.
function tamAdlaVar(goreli) {
  let dizin = KOK;
  return goreli.split('/').every(parca => {
    if (!fs.existsSync(dizin) || !fs.statSync(dizin).isDirectory()) return false;
    if (fs.readdirSync(dizin).indexOf(parca) < 0) return false;
    dizin = path.join(dizin, parca);
    return true;
  });
}

function ortamKur(secenek) {
  secenek = secenek || {};
  const kasalar = new Map();          // ad -> Map(yol -> yanit)
  const istekler = [];                // fetch'e gelen Request'ler
  const dinleyiciler = {};

  class Request {
    constructor(yol, ayar) { this.url = yol; this.cache = (ayar && ayar.cache) || 'default'; }
  }
  const anahtar = r => (typeof r === 'string' ? r : r.url);
  function yanit(govde, durum, basliklar, yonlenmis) {
    return { ok: durum >= 200 && durum < 300, status: durum, statusText: '', type: 'basic', govde: govde,
             headers: basliklar || {}, basliklar: basliklar || {}, redirected: !!yonlenmis,
             clone() { return yanit(govde, durum, basliklar, yonlenmis); },
             text() { return Promise.resolve(String(govde)); }, blob() { return Promise.resolve(govde); } };
  }
  // new Response(...) her zaman yonlendirilmemis (redirected=false) yanit kurar
  class Response {
    constructor(govde, ayar) { return yanit(govde, (ayar && ayar.status) || 200, ayar && ayar.headers, false); }
  }
  // Gercek Cache API / fetch gibi: goreli adres calisanin konumuna (kapsam koku)
  // gore cozulur; '#...' yok sayilir. Kapsam icindekiler goreli yola cevrilir.
  function normal(adres) {
    const tam = new URL(adres, KAPSAM);
    tam.hash = '';
    return tam.href.indexOf(KAPSAM) === 0 ? tam.href.slice(KAPSAM.length) : tam.href;
  }
  const sorgusuz = a => a.replace(/\?.*$/, '');
  function goreliYol(adres) { return sorgusuz(normal(adres)) || 'index.html'; }
  function govdeBul(yol) {
    if (yol === 'sw.js') {
      if (secenek.sunucuSurum === undefined) return kaynak;
      return kaynak.replace(/var SURUM = '[^']*'/, "var SURUM = '" + secenek.sunucuSurum + "'");
    }
    if (yol === 'index.html' && secenek.agSayfa) return secenek.agSayfa;
    return 'dosya:' + yol;
  }
  function fetch(istek) {
    istekler.push(istek);
    const yol = goreliYol(anahtar(istek));
    if (secenek.agYok) return Promise.reject(new TypeError('Failed to fetch'));
    if (secenek.eksik && secenek.eksik.indexOf(yol) >= 0) return Promise.resolve(yanit('', 404));
    if (!tamAdlaVar(yol)) return Promise.resolve(yanit('', 404));
    const yonlenmis = !!(secenek.yonlendir && secenek.yonlendir.indexOf(yol) >= 0);
    return Promise.resolve(yanit(govdeBul(yol), 200, { 'Content-Type': 'x/' + yol }, yonlenmis));
  }
  // Anahtarlar normal() ile saklanir (sorgu dahil); ignoreSearch sorguyu iki
  // tarafta da yok sayar.
  function kasaYap(m) {
    return {
      match(r, ayar) {
        const k = normal(anahtar(r));
        if (!(ayar && ayar.ignoreSearch)) return Promise.resolve(m.get(k));
        const bulunan = Array.from(m.keys()).find(a => sorgusuz(a) === sorgusuz(k));
        return Promise.resolve(bulunan === undefined ? undefined : m.get(bulunan));
      },
      put(r, y) { m.set(normal(anahtar(r)), y); return Promise.resolve(); },
      delete(r) { return Promise.resolve(m.delete(normal(anahtar(r)))); },
      keys() { return Promise.resolve(Array.from(m.keys())); },
      addAll(liste) {
        return Promise.all(liste.map(r => fetch(r))).then(yanitlar => {
          yanitlar.forEach((y, i) => { if (!y.ok) throw new TypeError('addAll: ' + anahtar(liste[i]) + ' ' + y.status); });
          yanitlar.forEach((y, i) => m.set(anahtar(liste[i]), y));
        });
      }
    };
  }
  const caches = {
    open(ad) { if (!kasalar.has(ad)) kasalar.set(ad, new Map()); return Promise.resolve(kasaYap(kasalar.get(ad))); },
    keys() { return Promise.resolve(Array.from(kasalar.keys())); },
    delete(ad) { return Promise.resolve(kasalar.delete(ad)); }
  };
  const self = {
    addEventListener(tur, fn) { dinleyiciler[tur] = fn; },
    skipWaiting() {},
    clients: { claim() { return Promise.resolve(); } },
    registration: { scope: 'https://ornek.test/Oyunum/' },
    location: { origin: 'https://ornek.test' }
  };
  const ctx = { self, caches, fetch, Request, Response, URL, setTimeout, Promise };
  vm.runInNewContext(kaynak + '\nthis.CEKIRDEK = CEKIRDEK; this.OYUNLAR = OYUNLAR; this.ONBELLEK = ONBELLEK; this.SURUM = SURUM;', ctx);

  // olay tetikle; waitUntil'e verilen sozu dondur
  function tetikle(tur, veri) {
    let soz = Promise.resolve();
    dinleyiciler[tur]({ data: veri, waitUntil(p) { soz = p; } });
    return soz;
  }
  // gezinme (mode:'navigate'); respondWith'e verilen yaniti dondur
  function gezin(adres) {
    let soz = null;
    dinleyiciler.fetch({
      request: { url: adres, method: 'GET', mode: 'navigate' },
      respondWith(p) { soz = Promise.resolve(p); }, waitUntil() {}
    });
    assert.ok(soz, 'respondWith cagrilmadi: ' + adres);
    return soz;
  }
  // sayfanin alt kaynak istegi (statik yol)
  function iste(adres) {
    let soz = null;
    dinleyiciler.fetch({
      request: { url: adres, method: 'GET', mode: 'no-cors' },
      respondWith(p) { soz = Promise.resolve(p); }, waitUntil() {}
    });
    assert.ok(soz, 'respondWith cagrilmadi: ' + adres);
    return soz;
  }
  return { ctx, kasalar, istekler, tetikle, gezin, iste, secenek };
}
const KAPSAM = 'https://ornek.test/Oyunum/';

// Kasanin anlik goruntusu: yol -> yanit nesnesi (silinen/degisen girdi anlasilsin)
const goruntu = kasa => Array.from(kasa.entries());

let gecti = 0;
const denemeler = [];
function dene(ad, fn) { denemeler.push([ad, fn]); }

const ilk = ortamKur();
// vm baglamindaki diziler baska bir Array'den gelir; deepStrictEqual icin kopyala
const HEPSI = Array.from(ilk.ctx.CEKIRDEK).concat(Array.from(ilk.ctx.OYUNLAR));

dene('listelerdeki her yol diskte tam bu adla var', () => {
  const yok = HEPSI.filter(y => !tamAdlaVar(y));
  assert.strictEqual(yok.length, 0, 'eksik: ' + yok.join(', '));
  assert.ok(HEPSI.length > 30, 'liste beklenenden kisa: ' + HEPSI.length);
  assert.strictEqual(new Set(HEPSI).size, HEPSI.length, 'listede tekrarlanan yol var');
});

dene('Ates Bocegi: iki dosya OYUNLAR icinde, SURUM 20, index.html ve core.js yukledigi her js listede', () => {
  const oyunlar = Array.from(ilk.ctx.OYUNLAR);
  ['js/atesBocegi.js', 'js/atesBocegiOyun.js'].forEach(y => assert.ok(oyunlar.includes(y), y + ' OYUNLAR icinde yok'));
  assert.strictEqual(ilk.ctx.SURUM, '20');
  const kok = path.join(__dirname, '..');
  const kaynak = fs.readFileSync(path.join(kok, 'index.html'), 'utf8') + ' ' + fs.readFileSync(path.join(kok, 'js/core.js'), 'utf8');
  const yuklenen = new Set();
  let m;
  const scriptRe = /<script[^>]+src="([^"]+\.js)"/g;
  while ((m = scriptRe.exec(kaynak))) yuklenen.add(m[1]);
  const dosyaRe = /'(js\/[A-Za-z0-9_]+\.js)'/g;
  while ((m = dosyaRe.exec(kaynak))) yuklenen.add(m[1]);
  const liste = new Set(HEPSI);
  const eksik = Array.from(yuklenen).filter(y => !liste.has(y));
  assert.deepStrictEqual(eksik, [], 'sw listesinde olmayan js: ' + eksik.join(', '));
  assert.ok(yuklenen.has('js/atesBocegiOyun.js'), 'core.js Ates dosyalarini yuklemiyor');
});

dene('install: CEKIRDEK + OYUNLAR tamami onbellekte, temiz anahtarla; istekler ?v=SURUM ve cache:reload', () => {
  const o = ortamKur();
  return o.tetikle('install').then(() => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    assert.ok(kasa, 'onbellek acilmadi');
    assert.deepStrictEqual(Array.from(kasa.keys()).sort(), HEPSI.slice().sort());
    assert.strictEqual(o.istekler.length, HEPSI.length);
    const sorgu = '?v=' + o.ctx.SURUM;
    assert.deepStrictEqual(o.istekler.map(r => r.url).sort(), HEPSI.map(y => y + sorgu).sort());
    o.istekler.forEach(r => assert.strictEqual(r.cache, 'reload', r.url + ' reload degil'));
  });
});

// yarim set olmadi: onbellek hic acilmadi ya da bos
const yarimYok = o => { const k = o.kasalar.get(o.ctx.ONBELLEK); assert.ok(!k || k.size === 0, 'yarim onbellek kaldi'); };

dene('install: bir oyun dosyasi 404 ise reddedilir, onbellege hicbir sey yazilmaz', () => {
  const o = ortamKur({ eksik: ['js/tempoKup.js'] });
  return o.tetikle('install').then(() => { throw new Error('install basarili sayildi'); }, () => yarimYok(o));
});

dene('install: bir cekirdek dosyasi 404 ise reddedilir, onbellege hicbir sey yazilmaz', () => {
  const o = ortamKur({ eksik: ['style.css'] });
  return o.tetikle('install').then(() => { throw new Error('install basarili sayildi'); }, () => yarimYok(o));
});

dene('install: ag yoksa reddedilir, onbellege hicbir sey yazilmaz', () => {
  const o = ortamKur({ agYok: true });
  return o.tetikle('install').then(() => { throw new Error('install basarili sayildi'); }, () => yarimYok(o));
});

dene('install: yonlendirilmis yanit temiz (redirected=false) yazilir, govde/durum/baslik korunur', () => {
  const o = ortamKur({ yonlendir: ['index.html', 'gizlilik.html', 'js/core.js'] });
  return o.tetikle('install').then(() => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    ['index.html', 'gizlilik.html', 'js/core.js'].forEach(y => {
      const g = kasa.get(y);
      assert.strictEqual(g.redirected, false, y + ' hala redirected');
      assert.strictEqual(g.govde, 'dosya:' + y);
      assert.strictEqual(g.status, 200);
      assert.strictEqual(g.headers['Content-Type'], 'x/' + y);
    });
    assert.ok(Array.from(kasa.values()).every(g => !g.redirected));
  });
});

dene('install anahtarlari gezinme ve statik tarafindan bulunur (aga cikmadan)', () => {
  const o = ortamKur();
  return o.tetikle('install').then(() => {
    o.secenek.agYok = true;
    o.istekler.length = 0;
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    return o.gezin(KAPSAM).then(y => {
      assert.strictEqual(y, kasa.get('index.html'));
      return Promise.all(['js/core.js', 'style.css', 'img/joker-sise.webp'].map(y => o.iste(KAPSAM + y)));
    }).then(yanitlar => {
      assert.deepStrictEqual(yanitlar.map(y => y.govde), ['dosya:js/core.js', 'dosya:style.css', 'dosya:img/joker-sise.webp']);
      assert.strictEqual(o.istekler.length, 0, 'aga cikildi');
    });
  });
});

dene('cevrimdisi gizlilik.html: yalnizca install kaydiyla (sorgulu adres dahil) acilir', () => {
  const o = ortamKur();
  return o.tetikle('install').then(() => {
    o.secenek.agYok = true;
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    const kayit = kasa.get('gizlilik.html');
    return Promise.all([o.gezin(KAPSAM + 'gizlilik.html'), o.gezin(KAPSAM + 'gizlilik.html?utm_source=play')])
      .then(yanitlar => yanitlar.forEach(y => assert.strictEqual(y, kayit, 'install kaydi donmedi')));
  });
});

dene('guncelleme: kurulum eski onbellege dokunmaz; activate eski ait-* siler, digerlerini birakir', () => {
  const o = ortamKur();
  const eski = new Map([['index.html', 'eski']]);
  o.kasalar.set('ait-v8', eski);
  o.kasalar.set('baska-onbellek', new Map());
  return o.tetikle('install').then(() => {
    assert.strictEqual(o.kasalar.get('ait-v8'), eski);
    assert.strictEqual(eski.size, 1);
    assert.strictEqual(eski.get('index.html'), 'eski');
    return o.tetikle('activate');
  }).then(() => {
    assert.deepStrictEqual(Array.from(o.kasalar.keys()).sort(), ['baska-onbellek', o.ctx.ONBELLEK].sort());
  });
});

dene('basarisiz kurulum eski calisanin onbellegini bozmaz', () => {
  const o = ortamKur({ eksik: ['img/joker-sise.webp'] });
  const eski = new Map([['index.html', 'eski']]);
  o.kasalar.set('ait-v8', eski);
  return o.tetikle('install').then(() => { throw new Error('install basarili sayildi'); }, () => {
    assert.strictEqual(o.kasalar.get('ait-v8'), eski);
    assert.strictEqual(eski.size, 1);
  });
});

dene('isit: sunucuda ayni SURUM varsa eksikleri tamamlar, var olana dokunmaz', () => {
  const o = ortamKur();
  return o.tetikle('install').then(() => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    kasa.clear();
    kasa.set('index.html', 'yeni-sayfa');
    o.istekler.length = 0;
    return o.tetikle('message', { tur: 'isit' }).then(() => {
      assert.deepStrictEqual(Array.from(kasa.keys()).sort(), HEPSI.slice().sort());
      assert.strictEqual(kasa.get('index.html'), 'yeni-sayfa');
      // eksik her dosya (?v=SURUM ile) + surum denetimi icin bir kez sw.js (?t=..., bizim SURUM'la degil)
      assert.strictEqual(o.istekler.length, HEPSI.length);
      const swIstek = o.istekler.filter(r => /^sw\.js\?/.test(r.url));
      assert.strictEqual(swIstek.length, 1);
      assert.ok(/^sw\.js\?t=\d+$/.test(swIstek[0].url), swIstek[0].url);
      const dosyaIstek = o.istekler.filter(r => r !== swIstek[0]);
      assert.ok(dosyaIstek.every(r => r.url.slice(-('?v=' + o.ctx.SURUM).length) === '?v=' + o.ctx.SURUM && r.cache === 'reload'));
      assert.ok(Array.from(kasa.keys()).every(k => k.indexOf('?') < 0), 'sorgulu anahtar yazildi');
    });
  });
});

dene('isit: yonlendirilmis yanit temiz yazilir', () => {
  const o = ortamKur({ yonlendir: ['index.html'] });
  return o.tetikle('install').then(() => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    kasa.delete('index.html');
    return o.tetikle('message', { tur: 'isit' }).then(() => {
      assert.strictEqual(kasa.get('index.html').redirected, false);
      assert.strictEqual(kasa.get('index.html').govde, 'dosya:index.html');
    });
  });
});

dene('isit: eksik yoksa aga hic cikmaz', () => {
  const o = ortamKur();
  return o.tetikle('install').then(() => {
    o.istekler.length = 0;
    return o.tetikle('message', { tur: 'isit' });
  }).then(() => assert.strictEqual(o.istekler.length, 0));
});

dene('isit: sunucuda baska SURUM varsa eksikler YAZILMAZ (surum karismaz)', () => {
  const o = ortamKur({ sunucuSurum: '999' });
  return o.tetikle('install').then(() => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    kasa.delete('js/kacis.js');
    const once = goruntu(kasa);
    return o.tetikle('message', { tur: 'isit' }).then(() => {
      assert.deepStrictEqual(goruntu(kasa), once);
      assert.ok(!kasa.has('js/kacis.js'));
    });
  });
});

dene('isit: cevrimdisiyken bir sey yazmaz, reddetmez', () => {
  const o = ortamKur();
  return o.tetikle('install').then(() => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    kasa.delete('js/kacis.js');
    o.secenek.agYok = true;
    return o.tetikle('message', { tur: 'isit' }).then(() => assert.ok(!kasa.has('js/kacis.js')));
  });
});

// --- gezinme (index.html once onbellek) ---
function kurulu(secenek) {
  const o = ortamKur(secenek);
  return o.tetikle('install').then(() => {
    o.secenek.agSayfa = 'FARKLI-YENI-YAYIN';   // kurulumdan sonra sunucuda yeni sayfa
    o.istekler.length = 0;
    return o;
  });
}

dene('gezinme: agda FARKLI sayfa olsa da onbellektekini dondurur, onbellege dokunmaz, aga cikmaz', () =>
  kurulu().then(o => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    const once = goruntu(kasa), kasaAdlari = Array.from(o.kasalar.keys());
    return o.gezin(KAPSAM).then(y => {
      assert.strictEqual(y.govde, 'dosya:index.html');
      assert.strictEqual(y, kasa.get('index.html'));
      assert.deepStrictEqual(goruntu(kasa), once);
      assert.deepStrictEqual(Array.from(o.kasalar.keys()), kasaAdlari);
      assert.strictEqual(o.istekler.length, 0, 'aga cikildi');
    });
  }));

dene('gezinme: ag yokken onbellekten acilir', () =>
  kurulu().then(o => {
    o.secenek.agYok = true;
    return o.gezin(KAPSAM + 'index.html').then(y => assert.strictEqual(y.govde, 'dosya:index.html'));
  }));

dene('gezinme: kapsam koku, index.html ve sorgu dizgili adres ayni sayfayi verir', () =>
  kurulu().then(o => {
    const adresler = [KAPSAM, KAPSAM + 'index.html', KAPSAM + 'index.html?utm_source=twa',
                      KAPSAM + '?utm_source=play#x'];
    return Promise.all(adresler.map(a => o.gezin(a))).then(yanitlar => {
      const beklenen = o.kasalar.get(o.ctx.ONBELLEK).get('index.html');
      yanitlar.forEach((y, i) => assert.strictEqual(y, beklenen, adresler[i]));
      assert.strictEqual(o.istekler.length, 0);
    });
  }));

dene('gezinme: onbellekte sayfa yoksa agdan gelir, onbellege YAZILMAZ, hicbir sey silinmez', () =>
  kurulu().then(o => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    kasa.delete('index.html');
    const once = goruntu(kasa);
    return o.gezin(KAPSAM + '?utm_source=twa').then(y => {
      assert.strictEqual(y.govde, 'FARKLI-YENI-YAYIN');
      assert.deepStrictEqual(goruntu(kasa), once);
    });
  }));

dene('gezinme: onbellekte sayfa yok, ag da yok -> 503 cevrimdisi sayfasi (reddetmez)', () =>
  kurulu().then(o => {
    o.kasalar.get(o.ctx.ONBELLEK).delete('index.html');
    o.secenek.agYok = true;
    return o.gezin(KAPSAM).then(y => {
      assert.strictEqual(y.status, 503);
      assert.ok(/text\/html/.test(y.basliklar['Content-Type']));
      assert.ok(/Ba&#287;lant&#305; yok/.test(y.govde));
    });
  }));

dene('gezinme: gizlilik.html index.html yolundan gecmez (agdan, onbellegine yazilir)', () =>
  kurulu().then(o => {
    const kasa = o.kasalar.get(o.ctx.ONBELLEK);
    const sayfa = kasa.get('index.html');
    return o.gezin(KAPSAM + 'gizlilik.html').then(y => {
      assert.strictEqual(y.govde, 'dosya:gizlilik.html');
      assert.strictEqual(o.istekler.length, 1);
      assert.strictEqual(kasa.get('index.html'), sayfa, 'index.html degisti');
      o.secenek.agYok = true;
      return o.gezin(KAPSAM + 'gizlilik.html');
    }).then(y => assert.ok(/gizlilik/.test(y.govde), 'cevrimdisi gizlilik acilmadi'));
  }));

console.log('servis calisani (sw.js)');
denemeler.reduce((zincir, d) => zincir.then(() => {
  return Promise.resolve().then(d[1]).then(
    () => { gecti++; console.log('  ok  ' + d[0]); },
    e => { console.log('  HATA ' + d[0] + '\n       ' + e.message); process.exitCode = 1; });
}), Promise.resolve()).then(() => {
  console.log(gecti + '/' + denemeler.length + ' deneme gecti');
});
