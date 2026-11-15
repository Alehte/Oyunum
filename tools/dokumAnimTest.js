// dokumAnimTest.js — Su Sirala NORMAL mod dokum animasyonu: plan/geometri (saf) ve
// sahte DOM + sahte zamanlayici ile es zamanlilik / iptal / hareket azaltma yollari.
// Calistirma:  node tools/dokumAnimTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const oku = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.stack || e)); process.exitCode = 1; }
}

const kaynak = oku('suSiralaOyun.js');

// ---- 1) Saf kisim: DOKUM-BASI / DOKUM-SONU blogundan kesilir ----
const bas = kaynak.indexOf('// DOKUM-BASI'), son = kaynak.indexOf('// DOKUM-SONU');
assert.ok(bas >= 0 && son > bas, 'DOKUM-BASI / DOKUM-SONU isaretleri bulunamadi');
const saf = {};
vm.runInNewContext(kaynak.slice(bas, son) +
  '\nthis.SURE = SURE; this.DOKUM = DOKUM; this.plan = dokumPlani; this.geo = dokumGeometri;', saf);
const { SURE, DOKUM } = saf;

console.log('Dokum plani (saf)');
dene('toplam sure SURE tablosuyla ayni (bekleme yokken)', () => {
  for (let n = 1; n <= 5; n++) assert.strictEqual(saf.plan(n, { kalan: 0, kap: 4 }).toplam, SURE[n], 'adet ' + n);
});
dene('evreler sirali: git <= akis <= dolum <= donus <= toplam', () => {
  for (let n = 1; n <= 5; n++) {
    const p = saf.plan(n, { kalan: 1, kap: 4 });
    assert.ok(p.akisBas === p.git + p.bekle);
    assert.ok(p.dolumBas >= p.akisBas && p.dolumBas < p.akisBitis);
    assert.ok(Math.abs(p.dolumBas + p.dolumSure - p.akisBitis) < 1e-9, 'dolum akisla biter');
    assert.ok(Math.abs(p.birim * n - p.dolumSure) < 1e-9, 'katman birimi');
    assert.ok(p.birim >= 90, 'katman basina en az 90ms (adet ' + n + ')');
    assert.strictEqual(p.dolumBitis, p.dolumBas + p.dolumSure);
    assert.strictEqual(p.toplam, p.akisBitis + p.don);
    assert.ok(p.kapa <= p.don, 'akis donusten once biter');
  }
});
dene('dolu hedefe ikinci dokum: dolum oncekinin bitisinden once baslamaz', () => {
  const p0 = saf.plan(2, { kalan: 0, kap: 4 });
  const p = saf.plan(2, { kalan: 0, kap: 4, hedefSerbest: 900 });
  assert.strictEqual(p.dolumBas, 900);
  assert.strictEqual(p.bekle, 900 - p0.dolumBas);
  assert.strictEqual(p.toplam, SURE[2] + p.bekle);
  assert.strictEqual(saf.plan(2, { kalan: 0, kap: 4, hedefSerbest: 100 }).bekle, 0, 'erken biten onceki beklenmez');
});
dene('egim: bosaldikca artar, 90 dereceyi gecmez', () => {
  const dolu = saf.plan(1, { kalan: 3, kap: 4 }), bos = saf.plan(1, { kalan: 0, kap: 4 });
  assert.ok(dolu.aciSon < bos.aciSon);
  assert.ok(dolu.aciSon >= dolu.aciIlk);
  assert.ok(bos.aciSon <= 90);
});
dene('hareket azaltma: yalniz kisa solma, hareket alani yok', () => {
  const p = saf.plan(3, { azalt: true, kalan: 0, kap: 4, hedefSerbest: 5000 });
  assert.strictEqual(p.azalt, true);
  assert.strictEqual(p.toplam, DOKUM.AZALT);
  assert.ok(p.toplam <= 250);
  assert.strictEqual(p.dolumBitis, p.toplam);
  assert.strictEqual(p.aciIlk, undefined);
});

console.log('Dokum geometrisi (saf)');
const KAT = 30;
const kutu = (sol, kap, enBuyuk) => {   // tahtaya gore yerlesim kutusu (yuva tabanina oturur)
  const h = kap * KAT + 6, yuva = enBuyuk * KAT + 12;
  return { left: sol, top: yuva - h, width: 44, height: h };
};
dene('dudak hedef agzinin ortasinin ustune gelir (saga ve sola)', () => {
  const k = kutu(0, 4, 5), h = kutu(112, 5, 5);
  const g = saf.geo(k, h, KAT, 2, 1);
  assert.strictEqual(g.yon, 1);
  assert.strictEqual(g.origin, '100% 0');
  assert.strictEqual(k.left + k.width + g.dx, h.left + h.width / 2);
  assert.strictEqual(k.top + g.dy, h.top - DOKUM.DUDAK_BOSLUK);
  const g2 = saf.geo(h, k, KAT, 0, 1);
  assert.strictEqual(g2.yon, -1);
  assert.strictEqual(g2.origin, '0 0');
  assert.strictEqual(h.left + g2.dx, k.left + k.width / 2);
});
dene('kapasite 3/4/5: yuzey ve yukselme cam icinde, katman orani dogru', () => {
  [3, 4, 5].forEach(kap => {
    for (let onceki = 0; onceki < kap; onceki++) {
      for (let adet = 1; onceki + adet <= kap; adet++) {
        const h = kutu(56, kap, 5), g = saf.geo(kutu(0, 4, 5), h, KAT, onceki, adet);
        const taban = h.top + h.height - 3;
        assert.strictEqual(g.yuzeyY, taban - onceki * KAT, 'kap ' + kap);
        assert.strictEqual(g.yuksel, adet * KAT);
        assert.ok(g.yuzeyY - g.yuksel >= h.top + 3 - 1e-9, 'tasma kap ' + kap + ' ' + onceki + '+' + adet);
        assert.strictEqual(g.akisY + g.akisBoy, taban, 'akis cam tabanina kadar (sivi arkasinda kalir)');
        assert.strictEqual(g.akisX, h.left + h.width / 2);
      }
    }
  });
});

// ---- 2) Sahte DOM + sahte zamanlayici ile tum dosya ----
function ortamKur(secenek) {
  secenek = secenek || {};
  let saat = 0, sira = 1;
  const bekleyen = new Map();
  const zaman = {
    setTimeout(fn, ms) { const id = sira++; bekleyen.set(id, { t: saat + (ms || 0), fn }); return id; },
    clearTimeout(id) { bekleyen.delete(id); },
    ilerle(ms) {
      const hedef = saat + ms;
      for (;;) {
        let enId = null, en = null;
        for (const [id, z] of bekleyen) if (z.t <= hedef && (!en || z.t < en.t || (z.t === en.t && id < enId))) { en = z; enId = id; }
        if (!en) break;
        bekleyen.delete(enId); saat = en.t; en.fn();
      }
      saat = hedef;
    },
    simdi: () => saat
  };

  class Sinif {
    constructor(e) { this.e = e; }
    _l() { return this.e._cls; }
    add(...a) { a.forEach(c => { if (!this._l().includes(c)) this._l().push(c); }); }
    remove(...a) { this.e._cls = this._l().filter(c => !a.includes(c)); }
    contains(c) { return this._l().includes(c); }
    toggle(c, z) { const v = z === undefined ? !this.contains(c) : !!z; v ? this.add(c) : this.remove(c); return v; }
  }
  class Stil {
    constructor() { this._p = {}; }
    setProperty(k, v) { this._p[k] = String(v); }
    removeProperty(k) { delete this._p[k]; }
    getPropertyValue(k) { return this._p[k] || ''; }
  }
  const kimlikler = {};
  class El {
    constructor(tag) { this.tagName = tag; this._cls = []; this.classList = new Sinif(this); this.style = new Stil();
      this.dataset = {}; this.children = []; this.parentNode = null; this._dinle = {}; this.textContent = ''; this._html = ''; }
    get className() { return this._cls.join(' '); }
    set className(v) { this._cls = String(v).split(/\s+/).filter(Boolean); }
    set innerHTML(v) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; this._html = v; }
    get innerHTML() { return this._html; }
    set id(v) { kimlikler[v] = this; }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); this.children.push(c); c.parentNode = this; return c; }
    removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    get nextElementSibling() { if (!this.parentNode) return null; const s = this.parentNode.children; return s[s.indexOf(this) + 1] || null; }
    addEventListener(t, fn) { (this._dinle[t] = this._dinle[t] || []).push(fn); }
    removeEventListener() {}
    tikla() { (this._dinle.click || []).forEach(f => f({})); }
    setAttribute(k, v) { this['_a_' + k] = v; }
    get offsetHeight() { return parseFloat(this.style.height) || 0; }
    get offsetWidth() { return 44; }
    get offsetLeft() {
      if (!this.parentNode) return 0;
      if (this._cls.includes('ss-yuva')) return this.parentNode.children.filter(c => c._cls.includes('ss-yuva')).indexOf(this) * 56;
      return 0;
    }
    get offsetTop() {
      if (this._cls.includes('ss-tup') && this.parentNode) return this.parentNode.offsetHeight - this.offsetHeight;
      return 0;
    }
    get clientWidth() { return 320; } get clientHeight() { return 600; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 44, bottom: 100, width: 44, height: 100 }; }
    altlar() { return this.children.reduce((a, c) => a.concat([c], c.altlar()), []); }
  }
  ['ssTahta', 'ssJokerBar', 'ssHamle', 'ssHedef', 'ssLevelTitle', 'ssSonuc', 'ssSonucYildiz', 'ssSonucMetin',
   'ssSonucOdul', 'ssSonrakiBtn', 'ssBastanBtn', 'ssMesaj', 'ssPathInner', 'ssPathWrap', 'ssHaritayaBtn']
    .forEach(id => { const e = new El('div'); e.id = id; });
  const durumlar = { azalt: !!secenek.azalt, sistemAzalt: !!secenek.sistemAzalt };
  const document = {
    readyState: 'complete',
    getElementById: id => kimlikler[id] || null,
    createElement: t => new El(t),
    createElementNS: (ns, t) => new El(t),
    addEventListener() {},
    querySelector(sel) {
      if (sel === '.phone.reduced-motion') return durumlar.azalt ? {} : null;
      const m = /^#ssTahta \.ss-tup\[data-i="(\d+)"\]$/.exec(sel);
      if (m) return kimlikler.ssTahta.altlar().find(e => e._cls.includes('ss-tup') && String(e.dataset.i) === m[1]) || null;
      throw new Error('desteklenmeyen secici: ' + sel);
    }
  };
  const sayac = { kayit: 0, altin: 0, altinToplam: 0, ses: 0 };
  const ctx = {
    document, console, Math, JSON,
    setTimeout: zaman.setTimeout, clearTimeout: zaman.clearTimeout,
    Date: { now: zaman.simdi },
    matchMedia: q => ({ matches: q.indexOf('reduce') >= 0 && durumlar.sistemAzalt }),
    AppProgress: {},
    AppSaveProgress: () => { sayac.kayit++; },
    AppGold: { render() {}, add(n) { sayac.altin++; sayac.altinToplam += n; } },
    AppFX: { tone() {}, seq() { sayac.ses++; }, vibrate() { sayac.titresim = (sayac.titresim || 0) + 1; } },   // seq yalniz 'kazan' sesinde
    SuSiralaJoker: {
      TURLER: ['geriAl'], TANIM: { geriAl: { ad: 'Geri Al', fiyat: 25 } },
      adet: () => 9, geriAl: o => ({ ok: o.geriAl() })
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(oku('suSirala.js'), ctx);
  vm.runInContext(kaynak, ctx);
  let ozel = null;
  const orj = ctx.SuSirala.OyunOlustur;
  const kopya = d => ({ tupler: d.tupler.map(t => t.slice()), kaplar: d.kaplar.slice(), gizli: d.gizli.slice() });
  ctx.SuSirala.OyunOlustur = n => { const o = orj(n); if (ozel) o.durum = kopya(ozel); ortam.oyun = o; return o; };

  const tahta = kimlikler.ssTahta;
  const ortam = {
    ctx, zaman, sayac, durumlar, tahta, oyun: null,
    baslat(durum) { ozel = durum || null; ctx.SuSiralaOyun.bolumBaslat(1); },
    tup: i => tahta.altlar().find(e => e._cls.includes('ss-tup') && String(e.dataset.i) === String(i)),
    dok(a, b) { ortam.tup(a).tikla(); ortam.tup(b).tikla(); },
    akislar: () => tahta.altlar().filter(e => e._cls.includes('ss-dk-akis')),
    dkSinifli: () => tahta.altlar().filter(e => e._cls.some(c => c.indexOf('ss-dk-') === 0) || e._cls.includes('ss-dokuyor')),
    jokerKapali: () => kimlikler.ssJokerBar.children[0].disabled === true,
    jokerTikla: () => kimlikler.ssJokerBar.children[0].tikla(),
    sonucAcik: () => kimlikler.ssSonuc.classList.contains('show'),
    // DOM modele birebir uyuyor mu: katman sayisi, perde sayisi, renkler, artik sinif yok
    modeleUygunMu() {
      const d = ortam.oyun.durum;
      for (let i = 0; i < d.tupler.length; i++) {
        const t = ortam.tup(i);
        assert.ok(t, 'tup ' + i + ' yok');
        assert.strictEqual(t.children.length, d.tupler[i].length, 'tup ' + i + ' katman sayisi');
        t.children.forEach((s, k) => {
          if (k < d.gizli[i]) assert.ok(s._cls.includes('ss-perde'), 'tup ' + i + ' perde ' + k);
          assert.ok(!s._cls.some(c => c.indexOf('ss-dk-') === 0), 'tup ' + i + ' katmanda artik dokum sinifi');
        });
        assert.ok(!t._cls.includes('ss-dokuyor') && !t._cls.some(c => c.indexOf('ss-dk-') === 0), 'tup ' + i + ' artik sinif: ' + t.className);
        assert.strictEqual(t.style.getPropertyValue('--dk-x'), '', 'tup ' + i + ' artik --dk-x');
        assert.ok(!t.style.transformOrigin, 'tup ' + i + ' artik transformOrigin');
      }
      assert.strictEqual(ortam.akislar().length, 0, 'artik akis seridi');
      assert.strictEqual(tahta.altlar().filter(e => e._cls.includes('ss-dk-sicrama')).length, 0, 'artik sicrama');
    }
  };
  return ortam;
}

// gorunen katmanlarin rengi modeldeki renkle ayni mi
function renklerDogru(o) {
  const d = o.oyun.durum;
  const RENK = /var RENKLER = \[([\s\S]*?)\];/.exec(kaynak)[1].match(/#[0-9A-Fa-f]{6}/g);
  for (let i = 0; i < d.tupler.length; i++) {
    o.tup(i).children.forEach((s, k) => {
      if (k >= d.gizli[i]) assert.strictEqual(s.style.getPropertyValue('--ss-renk'), RENK[d.tupler[i][k] % RENK.length], 'renk ' + i + '/' + k);
    });
  }
}

const D = (tupler, kaplar, gizli) => ({ tupler, kaplar: kaplar || tupler.map(() => 4), gizli: gizli || tupler.map(() => 0) });

console.log('Dokum akisi (sahte DOM)');
dene('normal dokum: evreler, katmanlar, akis seridi, sonda temiz DOM', () => {
  const o = ortamKur();
  o.baslat(D([[0, 1, 1], [1], [2, 2, 2, 2], [0, 0, 0], []]));
  o.dok(0, 1);
  const p = saf.plan(2, { kalan: 1, kap: 4 });
  const k = o.tup(0), h = o.tup(1);
  assert.ok(k.classList.contains('ss-dokuyor') && k.classList.contains('ss-dk-git'));
  assert.ok(k.style.getPropertyValue('--dk-x') !== '' && k.style.transformOrigin === '100% 0');
  assert.strictEqual(h.children.length, 3, 'gelen katmanlar bastan eklenir');
  assert.strictEqual(h.children.filter(c => c._cls.includes('ss-dk-gelen')).length, 2);
  assert.strictEqual(k.children.filter(c => c._cls.includes('ss-dk-giden')).length, 2);
  assert.ok(h.classList.contains('ss-dk-hedef'));
  assert.strictEqual(o.akislar().length, 1);
  assert.ok(o.jokerKapali(), 'animasyonda joker kapali');
  const gec = h.children.filter(c => c._cls.includes('ss-dk-gelen')).map(c => parseFloat(c.style.getPropertyValue('--dk-gec')));
  assert.deepStrictEqual(gec, [p.dolumBas, p.dolumBas + p.birim]);
  o.zaman.ilerle(p.akisBas + 1);
  assert.ok(o.akislar()[0].classList.contains('show') && k.classList.contains('ss-dk-dok'));
  o.zaman.ilerle(p.akisBitis - p.akisBas);
  assert.ok(o.akislar()[0].classList.contains('bitis') && k.classList.contains('ss-dk-don'));
  o.zaman.ilerle(p.toplam - p.akisBitis);
  o.modeleUygunMu(); renklerDogru(o);
  assert.ok(!o.jokerKapali(), 'bitince joker acik');
});

dene('hizli art arda: ayni hedefe iki dokum + ayri dokum; kilitler; sonda modele uygun', () => {
  const o = ortamKur();
  o.baslat(D([[0, 1], [1], [3, 1], [2, 2], [2], [], [0, 0]]));
  o.dok(0, 1);                     // 0 -> 1 (1 katman)
  o.zaman.ilerle(50);
  o.dok(2, 1);                     // 2 -> 1 ayni hedef, ilki dolarken
  o.dok(4, 3);                     // ayri cift
  assert.strictEqual(o.oyun.durum.tupler[1].length, 3);
  assert.strictEqual(o.tup(1).children.length, 3, 'hedefte DOM model kadar katman');
  const gelen = o.tup(1).children.filter(c => c._cls.includes('ss-dk-gelen'));
  const p1 = saf.plan(1, { kalan: 1, kap: 4 });
  assert.ok(parseFloat(gelen[1].style.getPropertyValue('--dk-gec')) + 50 >= p1.dolumBitis - 1e-9,
    'ikinci dokum ilkinin dolumu bitmeden dolmaya baslamaz');
  // egik sise ne kaynak ne hedef; dolan sise kaynak olamaz
  const hamle = o.oyun.hamleSayisi;
  o.tup(0).tikla(); o.tup(5).tikla();          // 0 egik: yok sayilir, 5 bos: secilmez
  o.tup(1).tikla(); o.tup(5).tikla();          // 1 doluyor: kaynak olamaz
  assert.strictEqual(o.oyun.hamleSayisi, hamle, 'kilitli siselerle hamle olmadi');
  // joker animasyonda calismaz
  const gecmis = o.oyun.gecmis.length;
  o.jokerTikla();
  assert.strictEqual(o.oyun.gecmis.length, gecmis, 'animasyonda geri al calismadi');
  o.zaman.ilerle(5000);
  o.modeleUygunMu(); renklerDogru(o);
  assert.ok(!o.jokerKapali());
});

dene('animasyon ortasinda Bastan Basla: yok sayilir, animasyon bozulmadan biter', () => {
  const o = ortamKur();
  o.baslat(D([[0, 1], [1], [0], []]));
  o.dok(0, 1);
  o.zaman.ilerle(150);
  o.ctx.document.getElementById('ssBastanBtn').tikla();
  assert.strictEqual(o.oyun.hamleSayisi, 1, 'baştan başla animasyonda calismadi');
  o.zaman.ilerle(3000);
  o.modeleUygunMu();
});

dene('kazanma: iki es zamanli son dokum, bolumBitti tam bir kez', () => {
  const o = ortamKur();
  o.baslat(D([[0, 0], [0, 0], [1, 1], [1], []]));
  o.dok(1, 0); o.dok(3, 2);
  assert.ok(o.oyun.kazandiMi());
  o.zaman.ilerle(2000);
  assert.strictEqual(o.sayac.kayit, 1);
  assert.ok(o.sonucAcik());
  o.zaman.ilerle(5000);
  assert.strictEqual(o.sayac.kayit, 1, 'cift tetik yok');
});

dene('kazanma bekleme penceresinde Bastan Basla: eski bolumBitti calismaz', () => {
  const o = ortamKur();
  o.baslat(D([[0, 0, 0], [0], [1, 1], []]));
  o.dok(1, 0);
  o.zaman.ilerle(SURE[1] + 50);    // animasyon bitti, 220ms kazanma beklemesi suruyor
  assert.strictEqual(o.sayac.kayit, 0);
  o.ctx.document.getElementById('ssBastanBtn').tikla();
  o.zaman.ilerle(2000);
  assert.strictEqual(o.sayac.kayit, 0, 'sifirlanan oyuna yildiz yazilmadi');
  assert.ok(!o.sonucAcik());
  o.modeleUygunMu();
});

dene('animasyon ortasinda ekrandan cikis: iptal + modele gore cizim, gec geri cagri DOM\'a dokunmaz', () => {
  const o = ortamKur();
  o.baslat(D([[0, 1, 1], [1], [0, 0], [2, 2, 2], []]));
  o.dok(0, 1);
  o.zaman.ilerle(120);
  o.ctx.SuSiralaOyun.haritaCiz();   // geri dugmesi / telefon geri tusu bu yoldan gecer
  o.modeleUygunMu(); renklerDogru(o);
  const anlik = JSON.stringify(o.tahta.altlar().map(e => e.className));
  o.zaman.ilerle(5000);
  assert.strictEqual(JSON.stringify(o.tahta.altlar().map(e => e.className)), anlik, 'gec zamanlayici DOM\'u degistirdi');
  assert.ok(!o.jokerKapali(), 'akan sayaci sifirlandi');
  assert.strictEqual(o.sayac.kayit, 0);
});

dene('kazandiran dokum ortasinda cikis: zafer kaybolmaz, tam bir kez yazilir', () => {
  const o = ortamKur();
  o.baslat(D([[0, 0, 0], [0], [1, 1], []]));
  o.dok(1, 0);
  o.zaman.ilerle(100);
  o.ctx.SuSiralaOyun.haritaCiz();
  assert.strictEqual(o.sayac.kayit, 1);
  o.zaman.ilerle(5000);
  o.ctx.SuSiralaOyun.haritaCiz();   // haritaya tekrar donus: yeniden yazmaz
  assert.strictEqual(o.sayac.kayit, 1);
});

dene('animasyon ortasinda yeni bolum: eski geri cagrilar yeni tahtaya dokunmaz', () => {
  const o = ortamKur();
  o.baslat(D([[0, 1], [1], [0], []]));
  o.dok(0, 1);
  o.zaman.ilerle(100);
  o.baslat(D([[2, 2], [3, 3], [2, 3], [], []]));
  o.dok(0, 3);                       // yeni tahtada bir dokum
  o.zaman.ilerle(60);
  assert.ok(o.tup(0).classList.contains('ss-dokuyor'), 'yeni dokum suruyor');
  o.zaman.ilerle(SURE[1] - 160 + 50);   // eski dokumun bitis ani gecti, yenisi (SURE[2]) suruyor
  assert.ok(o.tup(0).classList.contains('ss-dokuyor'), 'eski bitis yeni kaynagi dogrultmadi');
  assert.ok(o.jokerKapali(), 'eski dokumun bitisi yeni dokumun kilidini acmadi');
  o.zaman.ilerle(5000);
  o.modeleUygunMu(); renklerDogru(o);
});

dene('perdeli kaynak: perde dokum bitince acilir', () => {
  const o = ortamKur();
  o.baslat(D([[0, 2, 1], [1], [2, 2], [0, 0], []], null, [2, 0, 0, 0, 0]));
  o.dok(0, 1);
  assert.strictEqual(o.oyun.durum.gizli[0], 1, 'model aninda acti');
  assert.ok(o.tup(0).children[1]._cls.includes('ss-perde'), 'gorsel animasyon bitene kadar eski');
  o.zaman.ilerle(3000);
  o.modeleUygunMu(); renklerDogru(o);
  assert.ok(!o.tup(0).children[1]._cls.includes('ss-perde'));
});

dene('hareket azaltma (ayar sinifi): egilme/akis yok, kisa solma', () => {
  const o = ortamKur({ azalt: true });
  o.baslat(D([[0, 1, 1], [1], [0, 0], [2, 2, 2], []]));
  o.dok(0, 1);
  assert.ok(!o.tup(0).classList.contains('ss-dokuyor'), 'egilme yok');
  assert.strictEqual(o.akislar().length, 0, 'akis yok');
  assert.strictEqual(o.tup(1).children.filter(c => c._cls.includes('ss-dk-gelen')).length, 2);
  o.zaman.ilerle(DOKUM.AZALT - 1);
  assert.ok(o.jokerKapali());
  o.zaman.ilerle(1);
  o.modeleUygunMu(); renklerDogru(o);
  assert.ok(!o.jokerKapali());
});

dene('hareket azaltma (sistem tercihi, matchMedia)', () => {
  const o = ortamKur({ sistemAzalt: true });
  o.baslat(D([[0, 1], [1], [0], []]));
  o.dok(0, 1);
  assert.ok(!o.tup(0).classList.contains('ss-dokuyor'));
  o.zaman.ilerle(DOKUM.AZALT);
  o.modeleUygunMu();
});

console.log('Oyundan cikis: kayit / sunum ayrimi (sahte DOM)');
const YILDIZ_ODUL = [0, 10, 20, 30];
const KAZAN = () => D([[0, 0, 0], [0], [1, 1], []]);   // tek dokumle (1 -> 0) kazanilir
// kayit tam bir kez ve dogru: yildiz, ssAcik, coin (ilk gecis = yildiz odulu)
function tekKayit(o, yildiz) {
  const p = o.ctx.AppProgress;
  assert.strictEqual(o.sayac.kayit, 1, 'ilerleme kaydi tam bir kez');
  assert.strictEqual(p.ssYildiz[1], yildiz, 'ssYildiz yazildi');
  assert.strictEqual(p.ssAcik, 2, 'sonraki bolum acildi');
  assert.strictEqual(o.sayac.altin, 1, 'coin tam bir kez eklendi');
  assert.strictEqual(o.sayac.altinToplam, YILDIZ_ODUL[yildiz], 'coin yildiz kuralina gore');
}
// cikis yapilmis ekranda sunum yok: kart, kazan sesi, kart konfetisi
function sunumYok(o) {
  const kutu = o.ctx.document.getElementById('ssSonuc');
  assert.ok(!o.sonucAcik(), 'sonuc karti show almadi');
  assert.strictEqual(o.sayac.ses, 0, 'kazan sesi calmadi');
  assert.ok(!o.sayac.titresim, 'titresim yok');
  assert.strictEqual(kutu.children.filter(c => c._cls.includes('ss-konfeti')).length, 0, 'kart konfetisi yok');
}

dene('(1) kazandiran dokum ortasinda cikis: kart/ses yok, yildiz+ssAcik+coin tam bir kez', () => {
  const o = ortamKur();
  o.baslat(KAZAN());
  o.dok(1, 0);
  const y = o.oyun.yildiz();
  o.zaman.ilerle(100);
  o.ctx.SuSiralaOyun.haritaCiz();
  tekKayit(o, y); sunumYok(o);
  o.zaman.ilerle(500);   // kart konfetisi zamanlayicilari (120/380ms) gecti
  sunumYok(o);
});

dene('(2) hizli art arda iki cikis: tek kayit', () => {
  const o = ortamKur();
  o.baslat(KAZAN());
  o.dok(1, 0);
  const y = o.oyun.yildiz();
  o.zaman.ilerle(100);
  o.ctx.SuSiralaOyun.haritaCiz();
  o.ctx.SuSiralaOyun.haritaCiz();
  tekKayit(o, y); sunumYok(o);
});

dene('(3) cikis + tum zamanlayicilar ilerler: ek kayit / ek kart yok', () => {
  const o = ortamKur();
  o.baslat(KAZAN());
  o.dok(1, 0);
  const y = o.oyun.yildiz();
  o.zaman.ilerle(100);
  o.ctx.SuSiralaOyun.haritaCiz();
  o.zaman.ilerle(10000);
  tekKayit(o, y); sunumYok(o);
});

dene('(4) zafer bekleme penceresinde cikis: tek kayit, kart yok', () => {
  const o = ortamKur();
  o.baslat(KAZAN());
  o.dok(1, 0);
  const y = o.oyun.yildiz();
  o.zaman.ilerle(SURE[1] + 50);    // dokum bitti, 220ms kazanma beklemesi suruyor
  assert.strictEqual(o.sayac.kayit, 0);
  o.ctx.SuSiralaOyun.haritaCiz();
  tekKayit(o, y); sunumYok(o);
  o.zaman.ilerle(5000);
  tekKayit(o, y); sunumYok(o);
});

dene('(5) normal bitis (kart acik) sonrasi cikis: ek odul yok', () => {
  const o = ortamKur();
  o.baslat(KAZAN());
  o.dok(1, 0);
  const y = o.oyun.yildiz();
  o.zaman.ilerle(3000);
  assert.ok(o.sonucAcik(), 'normal bitiste kart acik');
  assert.strictEqual(o.sayac.ses, 1, 'normal bitiste kazan sesi');
  o.ctx.SuSiralaOyun.haritaCiz();
  o.ctx.SuSiralaOyun.haritaCiz();
  o.zaman.ilerle(5000);
  tekKayit(o, y);
  assert.strictEqual(o.sayac.ses, 1, 'cikista ikinci kazan sesi yok');
});

dene('(6) cikip ayni bolume yeniden giris: kart kapali, akan yok, oynanabilir, odul tekrar yazilmaz', () => {
  const o = ortamKur();
  o.baslat(KAZAN());
  o.dok(1, 0);
  const y = o.oyun.yildiz();
  o.zaman.ilerle(100);
  o.ctx.SuSiralaOyun.haritaCiz();
  o.baslat(D([[0, 0], [0], [0], [1, 1, 1, 1], []]));   // iki dokumle kazanilir
  o.zaman.ilerle(5000);          // eski oyunun gec zamanlayicilari
  assert.ok(!o.sonucAcik(), 'yeni bolumde kart kapali');
  o.modeleUygunMu(); renklerDogru(o);
  assert.ok(!o.oyun.kazandiMi());
  tekKayit(o, y);
  o.dok(1, 0);
  assert.strictEqual(o.oyun.hamleSayisi, 1, 'yeni bolum oynanabilir');
  o.zaman.ilerle(3000);
  // akanSayisi eskiden kalsaydi dokum bitince de joker kilitli kalirdi
  assert.ok(!o.jokerKapali(), 'akanSayisi 0, joker acik');
  o.dok(2, 0);
  o.zaman.ilerle(3000);
  assert.ok(o.sonucAcik(), 'yeni oyunda normal bitis karti');
  assert.strictEqual(o.sayac.kayit, 2, 'yeni oyun ornegi kendi kaydini yapar');
  assert.strictEqual(o.sayac.altinToplam, YILDIZ_ODUL[Math.max(y, o.oyun.yildiz())], 'yildiz farki kurali');
});

dene('(7) kazandirmayan dokum ortasinda cikis: kayit yok', () => {
  const o = ortamKur();
  o.baslat(D([[0, 0], [0], [1, 1], [1], []]));
  o.dok(1, 0);
  o.zaman.ilerle(100);
  o.ctx.SuSiralaOyun.haritaCiz();
  o.zaman.ilerle(5000);
  assert.ok(!o.oyun.kazandiMi());
  assert.strictEqual(o.sayac.kayit, 0);
  assert.strictEqual(o.sayac.altin, 0);
  assert.strictEqual(o.ctx.AppProgress.ssYildiz[1], undefined);
  sunumYok(o);
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
