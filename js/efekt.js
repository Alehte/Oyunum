// efekt.js — ortak gorsel efektler: konfeti, patlama, titreme / parlama, sayac, vurgu (docs/gorev-performans-efekt-suzul.md FAZ 2).
// YALNIZ GORSEL: skor, rekor, odul, kayit, oyun kurali ve oyun rastgeleligi bu dosyadan etkilenmez.
//   - Rastgelelik: kendi kucuk ureteci (xorshift32). Math.random HIC cagrilmaz: Math.random oyun ureteciyle ortak
//     (Tempo parcalari, 2048 karolari, market kutusu); efekt oyun sirasini degistirmez (tools/efektTest.js sayar).
//   - Girdi: tek tuval pointer-events:none (style.css .efekt-tuval); oyunu duraklatmaz, dokunmayi yutmaz.
//   - Titreme yalniz verilen ogeye Web Animations transform'u (translate); oyun girdisinin olcu aldigi ogeye verilmez
//     (oyunlar gorsel bir kapsayiciyi secer: Tempo skor cubugu, Suzul tuvali, 2048 tahta kapsayicisi).
//
// Performans (docs/PERFORMANS.md): tek tam ekran tuval (.phone icinde), parcacik havuzu (Float32Array, bir kez ayrilir),
// kare basina nesne/dizi/closure uretilmez, canvas golgesi / filtre yok, DPR Kalite.dprTavan() ile sinirli.
// rAF yalniz efekt varken doner; son parcacik bitince durur ve tuval gizlenir; sayfa gizlenince her sey hemen biter.
//
// Kalite (js/kalite.js; yoksa yuksek varsayilir):
//   ayni anda en cok parcacik: yuksek 120, orta 60, dusuk 20 (istenen adet once Kalite.parcacikSayisi(taban) ile kisilir).
//   dusuk ve azaltilmis hareket (.phone.reduced-motion / prefers-reduced-motion): titreme yerine tek parlama; konfeti kisa.
//   azaltilmis harekette ayrica konfeti az, sayac aninda, baslik / nabiz canlanmaz.
// Ekran degisince (js/core.js slideForward / slideBack) Efekt.dur() cagrilir: efekt yeni ekranda surmez.
//
// API: Efekt.konfeti(o), Efekt.patlama(x, y, o), Efekt.titre(el, sure, siddet), Efekt.parla(el), Efekt.nabiz(el, olcek, sure),
//      Efekt.baslik(el), Efekt.say(el, hedef, o), Efekt.vurgu(kutu, etiket, metin, sure), Efekt.vurguKaldir(kutu, etiket),
//      Efekt.rekorIzci(eskiRekor, mevcut), Efekt.dur(), Efekt.durum()
(function () {
  'use strict';

  var TAVAN = { yuksek: 120, orta: 60, dusuk: 20 };   // ayni anda canli parcacik ust siniri
  var HAVUZ = 120;                                    // en buyuk tavan: havuz bir kez bu boyda ayrilir
  var ALAN = 12;                                      // parcacik basina alan sayisi (asagidaki P_* sirasi)
  var P_X = 0, P_Y = 1, P_VX = 2, P_VY = 3, P_YAS = 4, P_OMUR = 5, P_W = 6, P_H = 7, P_ACI = 8, P_DON = 9, P_FAZ = 10, P_SURT = 11;
  var HALKA = 4, H_ALAN = 6;                          // halka (parlama dalgasi) havuzu: x, y, yas, omur, r, renk
  var SAYAC = 4;                                      // ayni anda en cok sayac
  var RENK_YUVA = 32;                                 // renk tablosu (parcacik / halka yalniz yuva no tutar; ayni renk ayni yuva)
  var VARSAYILAN_RENK = ['#2FE07A', '#FBE7AE', '#7FE6DC', '#F0C25C', '#FF7F92', '#B78BFF', '#6FD3FF', '#FFFFFF'];
  var YERCEKIM = 520, KONFETI_YERCEKIM = 150;         // px/sn^2
  var DT_TAVAN = 0.1;                                 // uzun karede fizik en cok 100 ms ilerler (yavas cihazda efekt yine ~zamaninda biter)

  // ---- kendi rastgele ureteci (Math.random'a dokunmaz) ----
  var tohum = ((Date.now() ^ 0x9E3779B9) >>> 0) || 1;
  function rnd() {
    tohum ^= tohum << 13; tohum >>>= 0;
    tohum ^= tohum >>> 17;
    tohum ^= tohum << 5; tohum >>>= 0;
    return tohum / 4294967296;
  }

  // ---- kalite ----
  function seviye() { var K = window.Kalite; var s = K && K.seviye ? K.seviye() : 'yuksek'; return TAVAN[s] ? s : 'yuksek'; }
  function adetKis(taban) { var K = window.Kalite; return K && K.parcacikSayisi ? window.Kalite.parcacikSayisi(taban) : taban; }
  function efektAcik(ad) { var K = window.Kalite; return K && K.efektAcikMi ? window.Kalite.efektAcikMi(ad) : true; }
  function dprTavan() { var K = window.Kalite; return K && K.dprTavan ? K.dprTavan() : 2; }
  function azHareket() {
    var p = document.querySelector('.phone');
    if (p) return p.classList.contains('reduced-motion');      // core.js sistem tercihini de icerir
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  // ---- durum (hepsi bir kez ayrilir) ----
  var P = new Float32Array(HAVUZ * ALAN), PR = new Uint8Array(HAVUZ), PT = new Uint8Array(HAVUZ);   // PT: 0 konfeti, 1 kivilcim
  var n = 0;                                                      // canli parcacik sayisi (0..n-1 dolu, yer degistirerek silinir)
  var H = new Float32Array(HALKA * H_ALAN), hn = 0;
  var F = new Float32Array(6), flas = false;                      // tek parlama: x, y, w, h, yas, omur
  // Renk tablosu: her renk metni bir yuvaya bir kez yazilir (tekrar eden renk ayni yuvayi kullanir). Tablo dolarsa yalniz canli
  // parcacik / halkanin kullanmadigi yuva yeniden yazilir: canli parcacigin rengi hicbir yolda degismez.
  var RENK = new Array(RENK_YUVA), renkN = 0, RIDX = new Uint8Array(8), KUL = new Uint8Array(RENK_YUVA), i0;
  for (i0 = 0; i0 < RENK_YUVA; i0++) RENK[i0] = '#FFFFFF';
  var sEl = new Array(SAYAC), sBas = new Float64Array(SAYAC), sHedef = new Float64Array(SAYAC), sT0 = new Float64Array(SAYAC),
      sSure = new Float64Array(SAYAC), sSon = new Float64Array(SAYAC), sBicim = new Array(SAYAC), sOn = new Array(SAYAC),
      sSonra = new Array(SAYAC), sn = 0;
  var tuval = null, ctx = null, kap = null, cw = 0, ch = 0, dpr = 1, ox = 0, oy = 0;
  var raf = 0, sonZaman = 0, acik = false;
  var kirli = false, kx0 = 0, ky0 = 0, kx1 = 0, ky1 = 0;          // onceki karede boyanan alan (css px); yalniz o silinir

  function tuvalKur() {
    if (tuval) return true;
    if (!document.createElement) return false;
    tuval = document.createElement('canvas');
    if (!tuval.getContext) { tuval = null; return false; }
    ctx = tuval.getContext('2d');
    if (!ctx) { tuval = null; return false; }
    tuval.className = 'efekt-tuval';
    tuval.setAttribute('aria-hidden', 'true');
    kap = document.querySelector('.phone') || document.body;
    if (kap === document.body) tuval.style.position = 'fixed';
    kap.appendChild(tuval);
    return true;
  }
  // Olcu ve konum her efekt baslarken (ve efekt suruyorken pencere boyutu degisince) yeniden okunur; kare dongusunde
  // getBoundingClientRect yok. Boyut degistiyse tuval yeniden boyutlanir (atama tuvali temizler; sonraki kare hepsini cizer).
  function olc() {
    var r = kap.getBoundingClientRect();
    ox = r.left + (kap.clientLeft || 0); oy = r.top + (kap.clientTop || 0);
    var w = kap === document.body ? window.innerWidth : kap.clientWidth, h = kap === document.body ? window.innerHeight : kap.clientHeight;
    var d = Math.min(window.devicePixelRatio || 1, dprTavan());
    if (w === cw && h === ch && d === dpr) return false;
    cw = w; ch = h; dpr = d;
    tuval.width = Math.max(1, Math.round(cw * dpr)); tuval.height = Math.max(1, Math.round(ch * dpr));
    kirli = false;
    return true;
  }
  function ac() {
    if (!tuvalKur()) return false;
    var yeni = olc();
    if (acik) return true;
    if (!yeni) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, tuval.width, tuval.height); }
    kirli = false;
    tuval.classList.add('acik');
    acik = true;
    return true;
  }
  function baslat() {
    if (raf || !window.requestAnimationFrame) return;
    sonZaman = 0;
    raf = window.requestAnimationFrame(kare);
  }
  function kapat() {
    if (raf && window.cancelAnimationFrame) window.cancelAnimationFrame(raf);
    raf = 0; sonZaman = 0;
    if (tuval && acik) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, tuval.width, tuval.height);
      tuval.classList.remove('acik');
    }
    acik = false; kirli = false;
  }
  // dizi renklerinin yuva numaralari RIDX[0..L) icine yazilir; donus L (en cok 8).
  function renkYaz(dizi) {
    var L = dizi && dizi.length ? Math.min(dizi.length, 8) : 0, i, j, s, kul = false;
    if (!L) { dizi = VARSAYILAN_RENK; L = VARSAYILAN_RENK.length; }
    for (i = 0; i < L; i++) {
      s = String(dizi[i]);
      for (j = 0; j < renkN && RENK[j] !== s; j++) { /* ara */ }
      if (j >= renkN) {
        if (renkN < RENK_YUVA) { j = renkN++; RENK[j] = s; }
        else {
          if (!kul) {                                             // canli parcacik / halka / bu cagrinin yuvalari kullanimda
            kul = true;
            for (j = 0; j < RENK_YUVA; j++) KUL[j] = 0;
            for (j = 0; j < n; j++) KUL[PR[j]] = 1;
            for (j = 0; j < hn; j++) KUL[H[j * H_ALAN + 5]] = 1;
            for (j = 0; j < i; j++) KUL[RIDX[j]] = 1;
          }
          for (j = 0; j < RENK_YUVA && KUL[j]; j++) { /* ara */ }
          if (j < RENK_YUVA) RENK[j] = s; else j = 0;             // hepsi kullanimda (pratikte olmaz): yuva 0 rengi
        }
      }
      RIDX[i] = j;
      if (kul) KUL[j] = 1;
    }
    return L;
  }
  function bos() { return TAVAN[seviye()] - n; }
  // Oncelikli efekt icin yer: en eski (omrunun en cok kismini yasamis) k parcacik silinir. Kare dongusunde cagrilmaz.
  function yerAc(k) {
    var i, j, en, o;
    while (k-- > 0 && n > 0) {
      j = 0; en = -1;
      for (i = 0; i < n; i++) { o = P[i * ALAN + P_YAS] / P[i * ALAN + P_OMUR]; if (o > en) { en = o; j = i; } }
      sil(j);
    }
  }

  // ---- kare dongusu: yalniz efekt varken ----
  function kare(t) {
    raf = 0;
    if (document.hidden) { durdur(); return; }
    var dt = sonZaman ? Math.min(DT_TAVAN, Math.max(0, (t - sonZaman) / 1000)) : 0;
    sonZaman = t;
    sayacIlerlet(t);
    if (acik) ciz(dt);
    if (n > 0 || hn > 0 || flas || sn > 0) { raf = window.requestAnimationFrame(kare); return; }
    kapat();
  }
  function ciz(dt) {
    var c = ctx, i, o, x, y, a, life, w, s, k, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (kirli) c.clearRect(Math.floor(kx0 * dpr) - 2, Math.floor(ky0 * dpr) - 2, Math.ceil((kx1 - kx0) * dpr) + 4, Math.ceil((ky1 - ky0) * dpr) + 4);
    // parcaciklar
    for (i = 0; i < n; i++) {
      o = i * ALAN;
      P[o + P_YAS] += dt;
      if (P[o + P_YAS] >= P[o + P_OMUR]) { sil(i); i--; continue; }
      var surt = Math.max(0, 1 - P[o + P_SURT] * dt);
      P[o + P_VX] *= surt; P[o + P_VY] = P[o + P_VY] * surt + (PT[i] ? YERCEKIM * 0.35 : KONFETI_YERCEKIM) * dt;
      P[o + P_X] += P[o + P_VX] * dt; P[o + P_Y] += P[o + P_VY] * dt;
      P[o + P_ACI] += P[o + P_DON] * dt; P[o + P_FAZ] += dt * 7;
      if (P[o + P_Y] > ch + 30) { sil(i); i--; continue; }
    }
    for (i = 0; i < n; i++) {
      o = i * ALAN; x = P[o + P_X]; y = P[o + P_Y];
      life = P[o + P_YAS] / P[o + P_OMUR];
      if (PT[i]) a = 1 - life * life; else a = life < 0.75 ? 1 : 1 - (life - 0.75) * 4;
      if (a <= 0.01) continue;
      w = P[o + P_W]; s = P[o + P_H];
      if (!PT[i]) w *= Math.max(0.15, Math.abs(Math.cos(P[o + P_FAZ])));   // konfeti cevrilir (ince-genis)
      k = Math.cos(P[o + P_ACI]); var sn2 = Math.sin(P[o + P_ACI]);
      c.globalAlpha = a;
      c.fillStyle = RENK[PR[i]];
      c.setTransform(k * dpr, sn2 * dpr, -sn2 * dpr, k * dpr, x * dpr, y * dpr);
      c.fillRect(-w / 2, -s / 2, w, s);
      var m = (w > s ? w : s);
      if (x - m < minX) minX = x - m; if (x + m > maxX) maxX = x + m;
      if (y - m < minY) minY = y - m; if (y + m > maxY) maxY = y + m;
    }
    // halkalar (parlama dalgasi)
    for (i = 0; i < hn; i++) {
      o = i * H_ALAN;
      H[o + 2] += dt;
      if (H[o + 2] >= H[o + 3]) { halkaSil(i); i--; continue; }
      life = H[o + 2] / H[o + 3];
      var r = 4 + H[o + 4] * (1 - (1 - life) * (1 - life));
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = 0.9 * (1 - life);
      c.strokeStyle = RENK[H[o + 5]];
      c.lineWidth = 0.6 + 4 * (1 - life);
      c.beginPath(); c.arc(H[o], H[o + 1], r, 0, 6.2832); c.stroke();
      if (H[o] - r - 4 < minX) minX = H[o] - r - 4; if (H[o] + r + 4 > maxX) maxX = H[o] + r + 4;
      if (H[o + 1] - r - 4 < minY) minY = H[o + 1] - r - 4; if (H[o + 1] + r + 4 > maxY) maxY = H[o + 1] + r + 4;
    }
    // tek parlama
    if (flas) {
      F[4] += dt;
      if (F[4] >= F[5]) flas = false;
      else {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.globalAlpha = 0.3 * (1 - F[4] / F[5]);
        c.fillStyle = '#FFF1CC';
        c.fillRect(F[0], F[1], F[2], F[3]);
        if (F[0] < minX) minX = F[0]; if (F[0] + F[2] > maxX) maxX = F[0] + F[2];
        if (F[1] < minY) minY = F[1]; if (F[1] + F[3] > maxY) maxY = F[1] + F[3];
      }
    }
    c.globalAlpha = 1;
    kirli = maxX > minX;
    if (kirli) { kx0 = Math.max(0, minX); ky0 = Math.max(0, minY); kx1 = Math.min(cw, maxX); ky1 = Math.min(ch, maxY); kirli = kx1 > kx0 && ky1 > ky0; }
  }
  function sil(i) {                                               // son canli parcacigi i'ye tasi (yerinde; ayirma yok)
    var son = n - 1, a = i * ALAN, b = son * ALAN, k;
    if (i !== son) { for (k = 0; k < ALAN; k++) P[a + k] = P[b + k]; PR[i] = PR[son]; PT[i] = PT[son]; }
    n = son;
  }
  function halkaSil(i) {
    var son = hn - 1, k;
    if (i !== son) for (k = 0; k < H_ALAN; k++) H[i * H_ALAN + k] = H[son * H_ALAN + k];
    hn = son;
  }

  // ---- sayac (textContent; ayni rAF) ----
  function sayacIlerlet(t) {
    for (var i = 0; i < sn; i++) {
      if (!sT0[i]) sT0[i] = t;
      var u = sSure[i] > 0 ? Math.min(1, (t - sT0[i]) / sSure[i]) : 1;
      var v = Math.round(sBas[i] + (sHedef[i] - sBas[i]) * (1 - (1 - u) * (1 - u) * (1 - u)));
      if (v !== sSon[i]) { sSon[i] = v; sEl[i].textContent = sOn[i] + sBicim[i](v); }
      if (u >= 1) { sayacBitir(i); i--; }
    }
  }
  function sayacBitir(i) {
    var el = sEl[i], f = sSonra[i], son = sn - 1;
    el.textContent = sOn[i] + sBicim[i](sHedef[i]);
    if (i !== son) {
      sEl[i] = sEl[son]; sBas[i] = sBas[son]; sHedef[i] = sHedef[son]; sT0[i] = sT0[son]; sSure[i] = sSure[son];
      sSon[i] = sSon[son]; sBicim[i] = sBicim[son]; sOn[i] = sOn[son]; sSonra[i] = sSonra[son];
    }
    sEl[son] = null; sBicim[son] = null; sSonra[son] = null;
    sn = son;
    if (typeof f === 'function') { try { f(); } catch (e) { if (window.console) console.error(e); } }
  }
  function duzSayi(v) { return String(v); }

  function durdur() {
    while (sn > 0) sayacBitir(sn - 1);                            // sayaclar son degerine yazilir (metin hicbir yolda yarim kalmaz)
    n = 0; hn = 0; flas = false;
    kapat();
  }

  // ---- disari ----
  // Ust kenardan butun ekrana konfeti yagmuru. o: { adet (taban, 90), sure (ms, 1600), renkler, oncelik }. Donus: uretilen parcacik.
  // oncelik (sonuc ekrani konfetisi): havuz doluysa yer acmak icin en eski parcaciklar silinir (tavan yine asilmaz).
  function konfeti(o) {
    o = o || {};
    if (!efektAcik('konfeti')) return 0;
    var az = azHareket(), dus = seviye() === 'dusuk';
    var taban = o.adet > 0 ? o.adet : 90, sure = (o.sure > 0 ? o.sure : 1600) / 1000;
    if (az) { taban = Math.min(taban, 24); sure = Math.min(sure, 1.0); }
    else if (dus) sure = Math.min(sure, 1.1);
    var adet = Math.min(adetKis(taban), o.oncelik ? TAVAN[seviye()] : bos());
    if (adet <= 0 || !ac()) return 0;
    if (adet > bos()) yerAc(adet - bos());
    var L = renkYaz(o.renkler), i, k;
    for (i = 0; i < adet; i++) {
      k = n * ALAN;
      P[k + P_X] = rnd() * cw; P[k + P_Y] = -10 - rnd() * ch * 0.3;
      P[k + P_VX] = (rnd() - 0.5) * 70; P[k + P_VY] = 160 + rnd() * 220;
      P[k + P_YAS] = 0; P[k + P_OMUR] = sure * (0.7 + rnd() * 0.3);
      P[k + P_W] = 5 + rnd() * 3; P[k + P_H] = 9 + rnd() * 5;
      P[k + P_ACI] = rnd() * 6.2832; P[k + P_DON] = (rnd() - 0.5) * 9; P[k + P_FAZ] = rnd() * 6.2832; P[k + P_SURT] = 0.6;
      PR[n] = RIDX[i % L]; PT[n] = 0;
      n++;
    }
    baslat();
    return adet;
  }
  // (x, y) istemci koordinatindan radyal kivilcim patlamasi + parlama halkasi. o: { adet (taban, 28), renkler, halka (true), guc (1) }.
  function patlama(x, y, o) {
    o = o || {};
    if (!efektAcik('konfeti')) return 0;
    var az = azHareket(), taban = o.adet >= 0 && o.adet !== undefined ? o.adet : 28, guc = o.guc > 0 ? o.guc : 1;
    if (az) taban = Math.round(taban * 0.4);
    var adet = taban > 0 ? Math.min(adetKis(taban), bos()) : 0;
    var halka = o.halka !== false && hn < HALKA;
    if (adet <= 0 && !halka) return 0;
    if (!ac()) return 0;
    var L = renkYaz(o.renkler), cx = x - ox, cy = y - oy, i, k, a, v;
    for (i = 0; i < adet; i++) {
      k = n * ALAN;
      a = (i / adet) * 6.2832 + rnd() * 0.5; v = (150 + rnd() * 190) * guc * (az ? 0.6 : 1);
      P[k + P_X] = cx; P[k + P_Y] = cy;
      P[k + P_VX] = Math.cos(a) * v; P[k + P_VY] = Math.sin(a) * v - 40;
      P[k + P_YAS] = 0; P[k + P_OMUR] = 0.55 + rnd() * 0.35;
      P[k + P_W] = 3 + rnd() * 3; P[k + P_H] = 3 + rnd() * 3;
      P[k + P_ACI] = rnd() * 6.2832; P[k + P_DON] = (rnd() - 0.5) * 12; P[k + P_FAZ] = 0; P[k + P_SURT] = 3.2;
      PR[n] = RIDX[i % L]; PT[n] = 1;
      n++;
    }
    if (halka) {
      k = hn * H_ALAN;
      H[k] = cx; H[k + 1] = cy; H[k + 2] = 0; H[k + 3] = az ? 0.3 : 0.5; H[k + 4] = (o.yaricap > 0 ? o.yaricap : 64) * guc; H[k + 5] = RIDX[0];
      hn++;
    }
    baslat();
    return adet;
  }
  // Ogenin alaninda tek kisa parlama (titremenin dusuk kalite / azaltilmis hareket karsiligi).
  function parla(el) {
    if (!el || !el.getBoundingClientRect || !ac()) return false;
    var r = el.getBoundingClientRect();
    F[0] = r.left - ox; F[1] = r.top - oy; F[2] = r.width; F[3] = r.height; F[4] = 0; F[5] = 0.22;
    flas = true;
    baslat();
    return true;
  }
  // Kisa sarsinti (yalniz transform). Dusuk kalitede / azaltilmis harekette titreme yerine tek parlama. Donus: 'titre' | 'parla' | null
  function titre(el, sure, siddet) {
    if (!el) return null;
    if (azHareket() || !efektAcik('titreme') || !el.animate) return parla(el) ? 'parla' : null;
    var s = siddet > 0 ? siddet : 5, d = sure > 0 ? sure : 340;
    if (el._efektTitre) { try { el._efektTitre.cancel(); } catch (e) { /* bitmis */ } }
    el._efektTitre = el.animate([
      { transform: 'translate(0px,0px)' },
      { transform: 'translate(' + (-s) + 'px,' + (s * 0.45).toFixed(1) + 'px)' },
      { transform: 'translate(' + (s * 0.8).toFixed(1) + 'px,' + (-s * 0.5).toFixed(1) + 'px)' },
      { transform: 'translate(' + (-s * 0.55).toFixed(1) + 'px,' + (s * 0.3).toFixed(1) + 'px)' },
      { transform: 'translate(' + (s * 0.3).toFixed(1) + 'px,' + (-s * 0.15).toFixed(1) + 'px)' },
      { transform: 'translate(0px,0px)' }
    ], { duration: d, easing: 'ease-out' });
    return 'titre';
  }
  // Kisa buyuyup donme (altin sayaci, kazanc satiri). Azaltilmis harekette yok.
  function nabiz(el, olcek, sure) {
    if (!el || !el.animate || azHareket()) return false;
    var o = olcek > 0 ? olcek : 1.14;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + o + ')', offset: 0.35 }, { transform: 'scale(1)' }],
      { duration: sure > 0 ? sure : 420, easing: 'ease-out' });
    return true;
  }
  // "Yeni Rekor!" basligi: kucukten buyuyerek gelir. Azaltilmis harekette yok.
  function baslik(el) {
    if (!el || !el.animate || azHareket()) return false;
    el.animate([
      { transform: 'scale(.55)', opacity: 0 },
      { transform: 'scale(1.18)', opacity: 1, offset: 0.45 },
      { transform: 'scale(.95)', opacity: 1, offset: 0.72 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: seviye() === 'dusuk' ? 480 : 720, easing: 'ease-out', delay: 60, fill: 'backwards' });
    return true;
  }
  // Sayinin artarak yazilmasi (textContent). o: { bas (0), sure (ms, 900), onEk (''), bicim (fn), sonra (fn) }.
  // Son metin her yolda onEk + bicim(hedef). Azaltilmis harekette aninda.
  function say(el, hedef, o) {
    o = o || {};
    if (!el) return false;
    var bicim = typeof o.bicim === 'function' ? o.bicim : duzSayi, on = o.onEk || '', i;
    for (i = 0; i < sn; i++) if (sEl[i] === el) { sayacBitir(i); break; }
    if (azHareket() || !window.requestAnimationFrame || sn >= SAYAC) {
      el.textContent = on + bicim(hedef);
      if (typeof o.sonra === 'function') o.sonra();
      return false;
    }
    sEl[sn] = el; sBas[sn] = o.bas || 0; sHedef[sn] = hedef; sT0[sn] = 0; sSure[sn] = o.sure > 0 ? o.sure : 900;
    sSon[sn] = NaN; sBicim[sn] = bicim; sOn[sn] = on; sSonra[sn] = o.sonra || null;
    el.textContent = on + bicim(sBas[sn]);
    sn++;
    baslat();
    return true;
  }
  // Skor kutusunda kisa "Rekor!" vurgusu: etiket metni gecici degisir, kutu .efekt-rekor sinifi alir ve nabiz atar.
  function vurgu(kutu, etiket, metin, sure) {
    if (!kutu) return false;
    vurguKaldir(kutu, etiket);
    if (etiket) { etiket._efektEski = etiket.textContent; etiket.textContent = metin || 'Rekor!'; }
    kutu.classList.add('efekt-rekor');
    nabiz(kutu, 1.16, 460);
    kutu._efektVurgu = setTimeout(function () { vurguKaldir(kutu, etiket); }, sure > 0 ? sure : 1800);
    return true;
  }
  function vurguKaldir(kutu, etiket) {
    if (!kutu) return;
    if (kutu._efektVurgu) { clearTimeout(kutu._efektVurgu); kutu._efektVurgu = 0; }
    kutu.classList.remove('efekt-rekor');
    if (etiket && etiket._efektEski !== undefined) { etiket.textContent = etiket._efektEski; etiket._efektEski = undefined; }
  }
  // Kosu ici rekor ani (saf): eski = kosu basinda okunmus rekor. kontrol(skor) kosu basina en cok BIR kez true doner;
  // eski rekor 0 (ilk oyun) ise hic donmez. mevcut > eski ile kurulursa (kaldigi yerden devam: rekor zaten asilmis) tetiklenmis baslar.
  // Ikinci sans (reklamla devam) ayni izciyi kullanir: ikinci kez tetiklenmez.
  function rekorIzci(eski, mevcut) {
    eski = Number(eski) || 0; mevcut = Number(mevcut) || 0;
    var iz = {
      eski: eski,
      tetiklendi: eski > 0 && mevcut > eski,
      kontrol: function (skor) {
        if (iz.tetiklendi || !(iz.eski > 0) || !(skor > iz.eski)) return false;
        iz.tetiklendi = true;
        return true;
      },
      isaretle: function () { iz.tetiklendi = true; }
    };
    return iz;
  }

  if (document.addEventListener) document.addEventListener('visibilitychange', function () { if (document.hidden) durdur(); });
  // efekt suruyorken pencere boyutu degisirse olcu guncellenir (efekt yokken bir sey yapilmaz; sonraki efekt zaten okur)
  if (window.addEventListener) window.addEventListener('resize', function () { if (acik && tuval) olc(); });

  window.Efekt = {
    konfeti: konfeti, patlama: patlama, titre: titre, parla: parla, nabiz: nabiz, baslik: baslik, say: say,
    vurgu: vurgu, vurguKaldir: vurguKaldir, rekorIzci: rekorIzci, dur: durdur,
    // test / olcum: anlik durum (cagri basina tek nesne; dongude kullanilmaz)
    durum: function () {
      return { parcacik: n, halka: hn, parlama: flas, sayac: sn, raf: !!raf, gorunur: acik, tavan: TAVAN[seviye()], seviye: seviye(),
               genislik: tuval ? tuval.width : 0, yukseklik: tuval ? tuval.height : 0 };
    },
    TAVAN: TAVAN
  };
})();
