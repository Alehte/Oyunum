// atesBocegiIkinciSansTest.js — Karanlikta Suzul ikinci sans (reklam, docs/gorev-reklam.md 1.4).
// 1) Saf cekirdek (js/atesBocegi.js dogmaSec / ikinciSans): dogma yuksekligi tavan/zemin payinin icinde, temizlenen
//    dilimlerde tehlike yok, ilk N adim (TEMIZ_SN) hicbir girdi politikasinda tehlike carpismasi yok, gecikmeli
//    oyuncu zemine degmez, puan/mesafe/toz/esik korunur, carpan (olumcul hasardan onceki zincir) korunur.
// 2) Arayuz (js/atesBocegiOyun.js, sahte DOM + sahte Reklam): tarayicida (destek yok) eski akis aynen; destekte
//    teklif sonme bitince bir kez, odeme teklif sonucuna ertelenir; red -> odeme + sonuc; kabul -> canlanma, geri
//    sayimda dunya donuk, sonra devam; ikinci olumde teklif yok; gec gelen sonuc (geri/dur) yok sayilir; zemin olumu da.
// Calistirma:  node tools/atesBocegiIkinciSansTest.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const AB = require(path.join(__dirname, '..', 'js', 'atesBocegi.js'));
const KAYNAK = fs.readFileSync(path.join(__dirname, '..', 'js', 'atesBocegiOyun.js'), 'utf8');
const A = AB.AYAR, D = A.dunya, M = A.hareket, AD = A.adalet, S = AB.IKINCI_SANS;
const ADIM_SN = Math.round(1 / D.DT);

let gecti = 0;
const kuyruk = [];
function dene(ad, fn) { kuyruk.push([ad, fn]); }
async function calistir() {
  for (const [ad, fn] of kuyruk) {
    if (typeof fn === 'string') { console.log(fn); continue; }
    try { await fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n       ') : e)); process.exitCode = 1; }
  }
  console.log(gecti + ' deneme gecti');
}
function baslik(t) { kuyruk.push([null, t]); }
const kopya = o => JSON.parse(JSON.stringify(o));
const TEHLIKE = { hasar: 1, ag: 1, bomba: 1, sarmasik: 1 };

// ---------------------------------------------------------------
// Olum ureteci: tohumla oyna (bosluk merkezine yonelen bot), rastgele anda bozul (birak ya da rastgele bas) -> olum.
// dusukIsik: ilk hasar olumcul olsun (isik olumu). yuksekPuan: bomba / sarmasik esiklerinin otesi.
// ---------------------------------------------------------------
function rng(t) { return AB.rngOlustur(t); }
function hedefY(d) {
  const bx = d.mesafe + D.X_BOCEK;
  for (const s of d.dilimler) if (s.x + s.w >= bx - M.R_CARPMA) return s.c;
  return D.Y_BASLA;
}
function olumUret(tohum, secenek) {
  const r = rng(tohum ^ 0xA5A5), d = AB.oyunOlustur(tohum);
  if (secenek.yuksekPuan) { d.puan = 2600 + Math.floor(r() * 3000); }
  const bozul = Math.floor((2 + r() * 20) * ADIM_SN), mod = r() < 0.5 ? 'birak' : 'rastgele';
  let n = 0, basili = false, zincirOnce = 0, olay = [];
  while (!d.bitti && n < 60 * ADIM_SN) {
    if (n === bozul && secenek.dusukIsik) d.isik = Math.min(d.isik, 0.05);
    if (n < bozul) basili = d.y > hedefY(d);
    else basili = mod === 'birak' ? false : (n % 30 === 0 ? r() < 0.5 : basili);
    zincirOnce = d.zincirSure > D.DT ? d.zincir : 0;       // arayuzle ayni anlik goruntu
    olay = AB.adim(d, basili); n++;
  }
  return { d, zincirOnce, olay, n };
}
// Canlanmis durumdan politika ile k adim: tehlike olaylari, bitti, en kucuk/buyuk y
function oyna(d, politika, k) {
  const sonuc = { tehlike: [], bitti: -1, yMin: Infinity, yMax: -Infinity, sersem: 0 };
  for (let i = 0; i < k && !d.bitti; i++) {
    const ol = AB.adim(d, politika(d, i));
    for (const o of ol) {
      if (TEHLIKE[o.tur]) sonuc.tehlike.push(i + ':' + o.tur + (o.engel ? '/' + o.engel : ''));
      if (o.tur === 'sersem') sonuc.sersem++;
    }
    if (d.bitti && sonuc.bitti < 0) sonuc.bitti = i;
    sonuc.yMin = Math.min(sonuc.yMin, d.y); sonuc.yMax = Math.max(sonuc.yMax, d.y);
  }
  return sonuc;
}
const TEPKI = Math.round(AD.T_MIN / D.DT);
const POLITIKA = {
  birak: () => false,
  bas: () => true,
  havada: (d) => d.y > hedefY(d),                                      // ilk kalan dilimin boslugunu izler
  gecikmeli: (d, i) => i >= TEPKI && d.y > hedefY(d)                    // T_MIN boyunca hicbir sey yapmaz
};

baslik('Ikinci sans: saf cekirdek (dogmaSec / ikinciSans)');

dene('IKINCI_SANS sabitleri: donuk, isik %50, geri sayim 2-3 sn, bant tavan/zeminden uzak', () => {
  assert.ok(Object.isFrozen(S));
  assert.strictEqual(S.ISIK, 0.5);
  assert.ok(S.GERI_SAYIM >= 2 && S.GERI_SAYIM <= 3);
  assert.ok(S.Y_MIN - D.Y_UST >= 20, 'tavan payi ' + (S.Y_MIN - D.Y_UST));
  assert.ok(D.Y_ALT - S.Y_MAX >= 20, 'zemin payi ' + (D.Y_ALT - S.Y_MAX));
  assert.ok(S.Y_MAX <= AB.uyanmaY + 1e-9, 'Y_MAX uyanma yuksekliginin altinda (zemine yakin)');
  assert.ok(S.Y_MAX + AB.uyanmaDususu(AD.T_MIN) < D.Y_ALT);
});

dene('bitmemis kosuda ikinciSans null, durum degismez; dogmaSec durumu degistirmez', () => {
  const d = AB.oyunOlustur(7); for (let i = 0; i < 200; i++) AB.adim(d, d.y > hedefY(d));
  const once = JSON.stringify(d);
  assert.strictEqual(AB.ikinciSans(d, { zincir: 9 }), null);
  AB.dogmaSec(d);
  assert.strictEqual(JSON.stringify(d), once);
});

const OLUMLER = [];
for (let t = 1; t <= 160; t++) OLUMLER.push(Object.assign(olumUret(t * 7919, { dusukIsik: t % 2 === 0, yuksekPuan: t % 3 === 0 }), { tohum: t * 7919 }));

dene('olum ornekleri: isik (hasar + sizinti) ve zemin olumleri, bomba/sarmasikli dilimler kapsanir', () => {
  const sebep = {}, tur = {};
  for (const o of OLUMLER) {
    assert.strictEqual(o.d.bitti, 1, 'tohum ' + o.tohum + ' olmedi');
    sebep[o.d.sebep] = (sebep[o.d.sebep] || 0) + 1;
    for (const x of o.olay) if (TEHLIKE[x.tur]) tur[x.tur + (x.engel ? '/' + x.engel : '')] = 1;
  }
  console.log('       sebep: ' + JSON.stringify(sebep) + '  olumcul tehlike: ' + Object.keys(tur).join(','));
  assert.ok(sebep.isik >= 20 && sebep.zemin >= 20, JSON.stringify(sebep));
  assert.ok(OLUMLER.some(o => o.d.dilimler.some(s => s.bomba)) && OLUMLER.some(o => o.d.dilimler.some(s => s.sarmasik)), 'bomba/sarmasik ornegi yok');
});

dene('dogma: y bant icinde, temiz dilimlerde engel/bomba/sarmasik yok, ilk kalan dilim TEMIZ_SN otesinde', () => {
  for (const o of OLUMLER) {
    const d = kopya(o.d), sec = AB.ikinciSans(d, { zincir: o.zincirOnce });
    assert.ok(sec, 'null');
    assert.ok(d.y >= S.Y_MIN && d.y <= S.Y_MAX, 'y ' + d.y);
    assert.ok(sec.ilk >= 0, 'ilk kalan dilim yok');
    const bx = d.mesafe + D.X_BOCEK, hiz = AB.zorluk(d.mesafe).hiz;
    for (const i of sec.temiz) { const s = d.dilimler[i]; assert.ok(!s.engeller.length && !s.bomba && !s.sarmasik, 'temiz dilim ' + s.no); }
    const ilk = d.dilimler[sec.ilk];
    assert.ok(ilk.x >= bx + hiz * S.TEMIZ_SN - 1e-9 && !ilk.bomba && !ilk.sarmasik);
    for (let i = 0; i < sec.ilk; i++) {        // ilk kalandan once kalan her sey geride
      const s = d.dilimler[i];
      if (sec.temiz.indexOf(i) < 0) assert.ok(s.x + s.w < bx - M.R_CARPMA, 'geride olmayan temizlenmemis dilim ' + s.no);
    }
    assert.strictEqual(d.y, AB.dogmaSec(o.d).y);
  }
});

dene('canlanma: bitti 0, isik >= %50, durgun, sersem/dokunulmaz yok, zemin korumasi; puan/mesafe/toz/esik/bolge aynen', () => {
  for (const o of OLUMLER) {
    const d = kopya(o.d), e = kopya(o.d);
    AB.ikinciSans(d, { zincir: o.zincirOnce });
    assert.deepStrictEqual([d.bitti, d.sebep, d.vy, d.ay, d.sersem, d.dokunulmaz, d.zeminKoruma], [0, '', 0, 0, 0, 0, M.ZEMIN_KORUMA]);
    assert.ok(d.isik >= S.ISIK && d.isik <= 1 && d.isik === Math.max(e.isik, S.ISIK));
    for (const k of ['puan', 'mesafe', 't', 'toz', 'esikPuan', 'bolge', 'gorunenBolge', 'tohum']) assert.strictEqual(d[k], e[k], k);
    assert.deepStrictEqual(d.uretici, e.uretici);
  }
});

dene('carpan korunur: olumcul hasar zinciri sifirlasa da canlaninca olumden onceki carpan; zincir suresi tazelenir', () => {
  let hasarli = 0;
  for (const o of OLUMLER) {
    const d = kopya(o.d);
    const beklenen = Math.max(o.d.zincir, o.zincirOnce);
    AB.ikinciSans(d, { zincir: o.zincirOnce });
    assert.strictEqual(AB.carpan(d.zincir), AB.carpan(beklenen));
    assert.strictEqual(d.zincirSure, d.zincir > 0 ? A.puan.ZINCIR_SURE : 0);
    if (o.d.zincir === 0 && o.zincirOnce > 0) hasarli++;
  }
  // elle: zincir 12 (carpan 2) iken olumcul dal hasari
  const d = AB.oyunOlustur(3); d.uretici.x = 1e9; d.dilimler = [];
  d.zincir = 12; d.zincirSure = 1; d.isik = 0.1; d.dokunulmaz = 0;
  d.dilimler.push({ no: 0, x: D.X_BOCEK + 0.5, w: 5, c: 20, ust: 12, alt: 28, nefes: 0, bolge: 0, engeller: [{ tur: 'dal', yon: 'alt', x: D.X_BOCEK + 0.5, y: 40, w: 5, h: 60 }], toz: [], kivilcim: null, bomba: null, sarmasik: null });
  const once = d.zincir; AB.adim(d, false);
  assert.strictEqual(d.bitti, 1); assert.strictEqual(d.zincir, 0);
  d.uretici = AB.oyunOlustur(3).uretici;                     // canlaninca uretim normal surer
  AB.ikinciSans(d, { zincir: once });
  assert.strictEqual(d.zincir, 12); assert.strictEqual(AB.carpan(d.zincir), 2);
  console.log('       olumcul hasarla sifirlanip geri gelen zincir: ' + hasarli + ' ornek');
});

dene('ilk N adim (N = TEMIZ_SN - 0,1 sn) hicbir politikada tehlike carpismasi yok; havada/gecikmeli politika olmez', () => {
  const N = Math.floor((S.TEMIZ_SN - 0.1) * ADIM_SN);
  let enKucukZemin = Infinity, enKucukTavan = Infinity;
  for (const o of OLUMLER) {
    const t0 = kopya(o.d); AB.ikinciSans(t0, { zincir: o.zincirOnce });
    for (const ad of Object.keys(POLITIKA)) {
      const d = kopya(t0), s = oyna(d, POLITIKA[ad], N);
      assert.deepStrictEqual(s.tehlike, [], 'tohum ' + o.tohum + ' ' + ad + ': ' + s.tehlike.join(' '));
      if (ad === 'havada' || ad === 'gecikmeli') {
        assert.strictEqual(s.bitti, -1, 'tohum ' + o.tohum + ' ' + ad + ' oldu (' + d.sebep + ')');
        assert.strictEqual(s.sersem, 0, 'tohum ' + o.tohum + ' ' + ad + ' tavana degdi');
        enKucukZemin = Math.min(enKucukZemin, D.Y_ALT - s.yMax); enKucukTavan = Math.min(enKucukTavan, s.yMin - D.Y_UST);
      }
      if (ad === 'birak') assert.ok(s.bitti < 0 || s.bitti >= TEPKI, 'birakan oyuncu T_MIN icinde oldu: adim ' + s.bitti);
    }
  }
  console.log('       N = ' + N + ' adim; havada/gecikmeli en yakin zemin payi ' + enKucukZemin.toFixed(2) + ', tavan payi ' + enKucukTavan.toFixed(2));
});

dene('canlanmis durum JSON gidis-donusuyle ayni devam eder (determinizm)', () => {
  const o = OLUMLER[5], a = kopya(o.d); AB.ikinciSans(a, { zincir: o.zincirOnce });
  const b = kopya(a);
  for (let i = 0; i < 1200; i++) { const p = a.y > hedefY(a); AB.adim(a, p); AB.adim(b, p); }
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
});

// ---------------------------------------------------------------
// Arayuz: sahte DOM (tools/atesBocegiOyunTest.js ile ayni yapi) + sahte Reklam
// ---------------------------------------------------------------
function ortam(reklam, ilerleme) {
  const o = { rafF: null, goldAdd: [], yazim: 0, durum: null, t: 0, ses: 0, teklif: [] };
  const proxyCtx = () => new Proxy({}, { get(h, k) { if (k in h) return h[k]; return () => (/Gradient/.test(k) ? { addColorStop() {} } : undefined); }, set(h, k, v) { h[k] = v; return true; } });
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
    'abSonAlt', 'abDurBtn', 'abDevam', 'abYeniden', 'abTekrar', 'abAna', 'atesBackBtn', 'abGeriSayim'].forEach(el);
  const AB2 = Object.assign({}, AB, { oyunOlustur(t) { o.durum = AB.oyunOlustur(t); return o.durum; } });
  const sb = {
    console, Math, Date, Float32Array, Array, Number, String, JSON, parseInt, isFinite, Object, Promise,
    document: { getElementById: el, createElement: () => el('c' + Math.random()), querySelector: () => null, addEventListener() {}, hidden: false },
    AtesBocegi: AB2, devicePixelRatio: 2, addEventListener() {},
    requestAnimationFrame: f => { o.rafF = f; return 1; }, cancelAnimationFrame() { o.rafF = null; },
    setTimeout: f => 0, matchMedia: () => ({ matches: false }), CoinSVG: () => '<img>',
    AppProgress: ilerleme || { surum: 3, gold: 10, atesBocegi: null },
    AppFX: { tone() { o.ses++; }, seq() { o.ses++; }, vibrate() {} }
  };
  if (reklam) {
    sb.Reklam = {
      destekleniyor: () => reklam.destek !== false,
      ikinciSans(opt) {
        let coz; const p = new Promise(r => { coz = r; });
        o.teklif.push({ opt, coz, kosuT: o.durum && o.durum.t });
        return p;
      }
    };
  }
  sb.AppSaveProgress = p => { Object.assign(sb.AppProgress, p); o.yazim++; };
  sb.AppGold = { add(n) { sb.AppProgress.gold += n; o.goldAdd.push(n); o.yazim++; } };
  sb.window = sb;
  vm.runInNewContext(KAYNAK, sb);
  o.sb = sb; o.O = sb.AtesBocegiOyun; o.el = el;
  o.kare = n => { for (let i = 0; i < n && o.rafF; i++) { o.t += 1000 / 60; const f = o.rafF; o.rafF = null; f(o.t); } };
  o.bas = () => { o.el('abTuval').dinle.pointerdown({ preventDefault() {}, pointerId: 1 }); };
  o.birak = () => { o.el('abTuval').dinle.pointerup({}); };
  o.yeni = () => { o.O.start(); o.bas(); o.kare(2); };
  o.olum = (puan, toz) => { o.durum.puan = puan; o.durum.toz = toz; o.durum.isik = 0.0001; o.durum.dokunulmaz = 0; o.kare(10); };
  o.zemin = () => { o.birak(); o.durum.y = D.Y_ALT - 0.05; o.durum.vy = M.VY_ASAGI; o.durum.ay = M.G_SUZUL; o.durum.zeminKoruma = 0; o.durum.isik = 1; o.kare(1); };
  o.sonme = () => o.kare(120);
  return o;
}
const bekle = () => new Promise(r => setImmediate(r));

baslik('Ikinci sans: arayuz (sahte DOM + sahte Reklam)');

dene('tarayici (Reklam yok / destek yok): eski akis aynen, teklif yok, odeme bitti aninda', async () => {
  for (const rk of [null, { destek: false }]) {
    const o = ortam(rk); o.yeni(); o.olum(2600, 30);
    assert.deepStrictEqual(o.goldAdd, [92]);                 // odeme sonme baslamadan
    assert.ok(!o.el('abSonuc').cl.has('show'));
    o.sonme(); await bekle();
    assert.ok(o.el('abSonuc').cl.has('show')); assert.strictEqual(o.teklif.length, 0); assert.strictEqual(o.rafF, null);
    assert.deepStrictEqual(o.goldAdd, [92]);
  }
});

dene('destek var: teklif sonme BITINCE bir kez; odeme bekler; dongu durur, dokunus oyuna gecmez', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30);
  assert.deepStrictEqual(o.goldAdd, []); assert.strictEqual(o.teklif.length, 0);
  o.sonme(); await bekle();
  assert.strictEqual(o.teklif.length, 1); assert.strictEqual(o.rafF, null);
  assert.strictEqual(o.teklif[0].opt.evet, 'Reklam izle ve devam et'); assert.strictEqual(o.teklif[0].opt.hayir, 'Hayır, bitir');
  assert.ok(!o.el('abSonuc').cl.has('show')); assert.deepStrictEqual(o.goldAdd, []);
  const t = o.durum.t; o.bas(); o.kare(5);
  assert.strictEqual(o.rafF, null); assert.strictEqual(o.durum.t, t); assert.strictEqual(o.durum.bitti, 1);
});

dene('red (false): odeme tek kez + sonuc karti; ikinci teklif yok', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  o.teklif[0].coz(false); await bekle();
  assert.deepStrictEqual(o.goldAdd, [92]); assert.ok(o.el('abSonuc').cl.has('show'));
  assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 1); assert.strictEqual(o.teklif.length, 1);
});

dene('kabul (true): canlanir, isik %50, puan korunur; GERI_SAYIM boyunca dunya donuk, sonra ilerler; dokunus sayaci bozmaz', async () => {
  const o = ortam({}); o.yeni(); o.kare(120); o.durum.zincir = 12; o.durum.zincirSure = 1.4;
  o.olum(2600, 30); o.sonme(); await bekle();
  o.teklif[0].coz(true); await bekle();
  const d = o.durum;
  assert.strictEqual(d.bitti, 0); assert.strictEqual(d.isik, 0.5); assert.strictEqual(d.puan, 2600); assert.strictEqual(d.toz, 30);
  assert.ok(d.y >= S.Y_MIN && d.y <= S.Y_MAX); assert.ok(o.rafF, 'dongu yeniden basladi');
  assert.deepStrictEqual(o.goldAdd, []); assert.ok(!o.el('abSonuc').cl.has('show'));
  assert.ok(o.el('abGeriSayim').cl.has('show')); assert.strictEqual(o.el('abGeriSayim').textContent, '3');
  const t0 = d.t, m0 = d.mesafe, y0 = d.y;
  o.kare(65); assert.strictEqual(o.el('abGeriSayim').textContent, '2');
  o.bas(); o.kare(60); o.birak();                            // geri sayimda basili tutmak dunyayi oynatmaz
  assert.strictEqual(o.el('abGeriSayim').textContent, '1');
  assert.deepStrictEqual([d.t, d.mesafe, d.y], [t0, m0, y0]);
  o.kare(64);
  assert.ok(!o.el('abGeriSayim').cl.has('show')); assert.ok(d.t > t0 && d.mesafe > m0, 'geri sayim sonrasi dunya ilerlemeli');
});

dene('kabul sonrasi ikinci olum: teklif YOK, odeme tek (toplam puanla), sonuc karti', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  o.teklif[0].coz(true); await bekle();
  o.kare(200);                                                // geri sayim biter
  o.olum(3100, 40);
  assert.strictEqual(o.goldAdd.length, 1, 'ikinci olumde odeme bitti aninda');
  o.sonme(); await bekle();
  assert.strictEqual(o.teklif.length, 1); assert.ok(o.el('abSonuc').cl.has('show'));
  assert.strictEqual(o.sb.AppProgress.atesBocegi.rekor, 3100); assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 1);
});

dene('zemin olumu da teklif alir; kabulde bocek guvenli yukseklikte, zemin dususu cizimi biter', async () => {
  const o = ortam({}); o.yeni(); o.kare(30); o.zemin();
  assert.strictEqual(o.durum.sebep, 'zemin'); assert.deepStrictEqual(o.goldAdd, []);
  o.sonme(); await bekle(); assert.strictEqual(o.teklif.length, 1);
  o.teklif[0].coz(true); await bekle();
  assert.strictEqual(o.durum.bitti, 0); assert.ok(o.durum.y <= S.Y_MAX && o.durum.y >= S.Y_MIN);
  o.kare(200); assert.ok(o.durum.t > 0);
});

dene('gec sonuc: teklif acikken geri (dur) -> odeme hemen; sonra gelen true canlandirmaz, tekrar odemez', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  o.O.dur();                                                 // core.js geri tusu / atesBackBtn yolu
  assert.deepStrictEqual(o.goldAdd, [92]);
  o.teklif[0].coz(true); await bekle();
  assert.strictEqual(o.durum.bitti, 1); assert.strictEqual(o.rafF, null); assert.deepStrictEqual(o.goldAdd, [92]);
  assert.ok(!o.el('abSonuc').cl.has('show'));
});

dene('sonme sirasinda cikis: bekleyen odeme yapilir, teklif acilmaz', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.kare(10);
  o.O.dur(); assert.deepStrictEqual(o.goldAdd, [92]);
  o.kare(200); await bekle(); assert.strictEqual(o.teklif.length, 0);
});

dene('teklif acikken yeni kosu (start): eski kosu bir kez odenir, gec sonuc yeni kosuyu etkilemez', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  o.O.start(); assert.deepStrictEqual(o.goldAdd, [92]);
  const yeni = o.durum; o.teklif[0].coz(false); await bekle();
  assert.strictEqual(o.durum, yeni); assert.strictEqual(yeni.bitti, 0); assert.deepStrictEqual(o.goldAdd, [92]);
  assert.ok(!o.el('abSonuc').cl.has('show'));
  o.bas(); o.kare(5); o.olum(500, 3); o.sonme(); await bekle();
  assert.strictEqual(o.teklif.length, 2, 'yeni kosunun kendi teklif hakki var');
});

dene('sifirla teklif acikken: eski kosu sifirlanan kayda yazilmaz', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  const y = o.yazim;                                         // bitti aninda bekleyen odeme (bo) yazildi
  o.sb.AppProgress = { surum: 3, gold: 0 };                  // core.js resetBtn: yeni ilerleme, sonra AppReset
  o.O.sifirla(); o.teklif[0].coz(true); await bekle();
  assert.deepStrictEqual(o.goldAdd, []); assert.strictEqual(o.yazim, y);
  assert.strictEqual(o.sb.AppProgress.atesBocegi === undefined || o.sb.AppProgress.atesBocegi.bo === undefined, true);
});

baslik('Ikinci sans: bekleyen odeme kalici kayitta (bo) — sayfa kapanirsa kaybolmaz, iki kez odenmez');

dene('teklif / reklam acikken sayfa kapanir: bo kayitta; yeniden yuklenince BIR kez odenir (jeton, rekor, kosu)', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30);
  assert.deepStrictEqual(kopya(o.sb.AppProgress.atesBocegi.bo), { p: 2600, t: 30 }, 'bitti aninda yazilir');
  o.sonme(); await bekle(); assert.strictEqual(o.teklif.length, 1);
  const ab = o.sb.AppProgress.atesBocegi;
  assert.deepStrictEqual(o.goldAdd, []); assert.strictEqual(ab.kosu, 0); assert.strictEqual(ab.rekor, 0);
  const disk = kopya(o.sb.AppProgress);                      // teklif (ya da reklam) acikken sayfa kapanir
  const o2 = ortam({}, disk);                                // yeniden acilis: oyun dosyasi yuklenir
  const ab2 = o2.sb.AppProgress.atesBocegi;
  assert.deepStrictEqual(o2.goldAdd, [92]);
  assert.strictEqual(ab2.bo, undefined); assert.strictEqual(ab2.kosu, 1); assert.strictEqual(ab2.rekor, 2600);
  assert.strictEqual(o2.sb.AppProgress.gold, 10 + 92);
  const o3 = ortam({}, kopya(o2.sb.AppProgress));            // bir daha acilis: tekrar odenmez
  assert.deepStrictEqual(o3.goldAdd, []); assert.strictEqual(o3.yazim, 0);
  assert.strictEqual(o3.sb.AppProgress.atesBocegi.kosu, 1);
  o2.yeni(); assert.deepStrictEqual(o2.goldAdd, [92], 'yeni kosu eski odemeyi tekrarlamaz');
});

dene('red / dur / yeni kosu: odeme ve bo silinmesi ayni anda; yeniden acilista tekrar odenmez', async () => {
  const yollar = [o => { o.teklif[0].coz(false); }, o => { o.O.dur(); }, o => { o.O.start(); }];
  for (const yol of yollar) {
    const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
    yol(o); await bekle();
    assert.deepStrictEqual(o.goldAdd, [92]);
    assert.strictEqual(o.sb.AppProgress.atesBocegi.bo, undefined); assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 1);
    const o2 = ortam({}, kopya(o.sb.AppProgress));
    assert.deepStrictEqual(o2.goldAdd, []); assert.strictEqual(o2.sb.AppProgress.atesBocegi.kosu, 1);
  }
});

dene('kabul (reklam izlendi): bo silinir; kosu surerken kapanirsa odeme yok (eski davranis); ikinci olum tek odeme', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  o.teklif[0].coz(true); await bekle();
  assert.strictEqual(o.sb.AppProgress.atesBocegi.bo, undefined);
  const o2 = ortam({}, kopya(o.sb.AppProgress));
  assert.deepStrictEqual(o2.goldAdd, []); assert.strictEqual(o2.sb.AppProgress.atesBocegi.kosu, 0);
  o.kare(200); o.olum(3100, 40);
  assert.strictEqual(o.goldAdd.length, 1); assert.strictEqual(o.sb.AppProgress.atesBocegi.bo, undefined);
  assert.strictEqual(o.sb.AppProgress.atesBocegi.kosu, 1);
});

dene('tarayici (destek yok): bo hic yazilmaz, odeme bitti aninda', async () => {
  const o = ortam(null); o.yeni(); o.olum(2600, 30);
  assert.deepStrictEqual(o.goldAdd, [92]); assert.strictEqual(o.sb.AppProgress.atesBocegi.bo, undefined);
});

dene('eski kayit (bo yok): yukleniste hicbir sey degismez, yazim yok', () => {
  const eski = { surum: 3, gold: 50, atesBocegi: { rekor: 1234, kosu: 7, gun: '2026-11-20', gunJeton: 40 }, kacisHearts: { 1: 3 } };
  const o = ortam({}, kopya(eski));
  assert.deepStrictEqual(o.goldAdd, []); assert.strictEqual(o.yazim, 0);
  assert.deepStrictEqual(kopya(o.sb.AppProgress), eski);
  const o2 = ortam(null, { surum: 3, gold: 0, atesBocegi: null });   // atesBocegi bos: yazim yok
  assert.strictEqual(o2.yazim, 0); assert.deepStrictEqual(o2.goldAdd, []);
});

dene('bozuk bo: odenmeden silinir, diger alanlar aynen', () => {
  const bozuklar = [null, 5, 'x', [], {}, { p: -1, t: 3 }, { p: NaN, t: 1 }, { p: 100 }, { p: '100', t: 2 }, { p: Infinity, t: 0 }, true];
  for (const b of bozuklar) {
    const ab = { rekor: 1234, kosu: 7, gun: '2026-11-20', gunJeton: 40, bo: b };
    const o = ortam({}, { surum: 3, gold: 50, atesBocegi: ab });
    assert.deepStrictEqual(o.goldAdd, [], JSON.stringify(b));
    assert.deepStrictEqual(kopya(o.sb.AppProgress.atesBocegi), { rekor: 1234, kosu: 7, gun: '2026-11-20', gunJeton: 40 }, String(b));
    assert.strictEqual(o.sb.AppProgress.gold, 50); assert.strictEqual(o.yazim, 1);
  }
});

dene('daha yeni kayit surumu: bo dahil hicbir seye dokunulmaz', () => {
  const k = { surum: 99, gold: 5, atesBocegi: { rekor: 1, kosu: 1, gun: '', gunJeton: 0, bo: { p: 5000, t: 50 } } };
  const o = ortam({}, kopya(k));
  assert.deepStrictEqual(o.goldAdd, []); assert.strictEqual(o.yazim, 0);
  assert.deepStrictEqual(kopya(o.sb.AppProgress), k);
});

dene('geri sayimda duraklat: sayac durur, devam ile kaldigi yerden', async () => {
  const o = ortam({}); o.yeni(); o.olum(2600, 30); o.sonme(); await bekle();
  o.teklif[0].coz(true); await bekle();
  o.kare(70); assert.strictEqual(o.el('abGeriSayim').textContent, '2');
  o.el('abDurBtn').dinle.click(); assert.ok(o.el('abDuraklat').cl.has('show')); assert.strictEqual(o.rafF, null);
  const t = o.durum.t; o.el('abDevam').dinle.click(); o.kare(30);
  assert.strictEqual(o.el('abGeriSayim').textContent, '2'); assert.strictEqual(o.durum.t, t);
  o.kare(120); assert.ok(o.durum.t > t);
});

calistir();
