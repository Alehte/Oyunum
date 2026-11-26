// fpsGosterge.js — gelistirme araci: ekranin sol ust kosesinde canli FPS / kare suresi gostergesi.
// YALNIZCA yerel adreste (js/reklam.js yerelAdres ile ayni kural: file://, localhost, 127.0.0.1, [::1],
// ozel ag IP'leri 10.x / 192.168.x / 172.16-31.x) VE adreste ?fps=1 varken calisir. Yayindaki adreste
// hicbir sey yapmaz (dugum, dinleyici, rAF yok). Telefondan yerel agla: http://192.168.x.y:port/?fps=1
// Gosterilen (yarim saniyede bir guncellenir, kare basina bellek ayirmaz):
//   FPS: son pencerede saniyedeki kare;  ms: ortalama kare suresi / penceredeki en uzun kare
//   >50: acilistan beri 50 ms'den uzun kare sayisi (arka plandan donus gibi 1 sn ustu bosluklar sayilmaz)
// Oyun kodu buna bagli degildir; yalniz olcum icindir (docs/gorev-performans-efekt-suzul.md FAZ 1.1).
(function () {
  'use strict';

  // js/reklam.js yerelAdres ile ayni kural (kopya; reklam.js bunu disari acmiyor, hedef2048.js de ayni kopyayi tasir)
  function yerelAdres() {
    var l = window.location || {};
    if (l.protocol === 'file:') return true;
    var h = String(l.hostname || '').toLowerCase();
    if (/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(h)) return true;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m) return false;
    var a = Number(m[1]), b = Number(m[2]);
    if (Number(m[3]) > 255 || Number(m[4]) > 255) return false;
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  if (!yerelAdres()) return;
  var s = (window.location && typeof window.location.search === 'string') ? window.location.search : '';
  if (!/[?&]fps=1(?:&|$)/.test(s)) return;

  var GUNCELLE_MS = 500, UZUN_MS = 50, BOSLUK_MS = 1000;
  var el = null, son = 0, pencereBas = 0, kare = 0, toplam = 0, enUzun = 0, uzunSayac = 0;

  function kur() {
    el = document.createElement('div');
    el.className = 'fps-gosterge';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = 'FPS --';
    document.body.appendChild(el);
    requestAnimationFrame(adim);
  }

  function adim(t) {
    if (son) {
      var d = t - son;
      if (d < BOSLUK_MS) {              // arka plandan donus / sekme gizliyken olusan bosluk sayilmaz
        kare++; toplam += d;
        if (d > enUzun) enUzun = d;
        if (d > UZUN_MS) uzunSayac++;
      }
    }
    son = t;
    if (!pencereBas) pencereBas = t;
    if (t - pencereBas >= GUNCELLE_MS) {
      var fps = kare ? kare * 1000 / (t - pencereBas) : 0, ort = kare ? toplam / kare : 0;
      el.textContent = 'FPS ' + Math.round(fps) + '  ' + ort.toFixed(1) + '/' + Math.round(enUzun) + ' ms  >50: ' + uzunSayac;
      el.classList.toggle('kotu', fps < 45 || enUzun > UZUN_MS);
      pencereBas = t; kare = 0; toplam = 0; enUzun = 0;
    }
    requestAnimationFrame(adim);
  }

  if (document.body) kur(); else document.addEventListener('DOMContentLoaded', kur);
})();
