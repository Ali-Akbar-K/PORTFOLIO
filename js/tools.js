/* ===== My Tools page (Calculator · Audio · Radio · TV · Notes · Calendar) ===== */
(function () {
  'use strict';

  var LS_DRIVE = 'ptf-drive-script-url';
  var LS_NOTE = 'ptf-note-draft';
  var LS_EVENTS = 'ptf-cal-events';
  var PREVIEW_SECONDS = 30;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') n.className = attrs[k]; else if (k === 'style') n.style.cssText = attrs[k]; else n.setAttribute(k, attrs[k]); }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function readLS(k, fb) { try { var v = localStorage.getItem(k); return v == null ? fb : v; } catch (e) { return fb; } }
  function writeLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ============ THEME ============ */
  function applyTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    var dark = theme === 'dark';
    var sun = document.getElementById('iconSun');
    document.getElementById('iconMoon').style.display = dark ? 'none' : 'block';
    sun.style.display = dark ? 'block' : 'none';
    var toggle = document.getElementById('themeToggle');
    toggle.setAttribute('aria-pressed', String(!dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    try { localStorage.setItem('site-theme', theme); } catch (e) {}
  }
  window.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };
  var saved = 'dark';
  try { saved = localStorage.getItem('site-theme') || 'dark'; } catch (e) {}
  applyTheme(saved);

  /* ============ TOOL DASHBOARD ============ */
  function selectTool(name, scrollToPane) {
    $all('.tool-nav-button, .service-card').forEach(function (button) {
      var active = button.getAttribute('data-tab') === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $all('.pane').forEach(function (pane) {
      pane.classList.toggle('is-active', pane.getAttribute('data-pane') === name);
    });
    var pane = $('[data-pane="' + name + '"]');
    if (scrollToPane && pane && pane.getBoundingClientRect().top > window.innerHeight - 100) {
      pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (name === 'radio') loadRadioStations();
    if (name === 'tv') loadTVChannels();
    else stopTVPlayback();
  }
  $all('.tool-nav-button, .service-card').forEach(function (t) {
    t.addEventListener('click', function () {
      selectTool(t.getAttribute('data-tab'), t.classList.contains('service-card'));
    });
  });

  /* ============ CALCULATOR ============ */
  (function () {
    var exprEl = $('#calcExpr');
    var outEl = $('#calcOut');
    var expr = '';
    var justEvaluated = false;
    var pretty = function (s) { return s.replace(/\*/g, '\u00d7').replace(/\//g, '\u00f7').replace(/-/g, '\u2212'); };
    function trailing() { var m = expr.match(/(\d+(?:\.\d*)?|\.\d+)$/); return m ? m[0] : null; }
    function replaceTrailing(num) {
      var match = expr.match(/\d+(?:\.\d*)?$|\.\d+$/);
      if (match) expr = expr.slice(0, -match[0].length) + num;
      else expr += num;
    }
    function safeEval(source) {
      var tokens = source.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/]/g);
      if (!tokens || tokens.join('') !== source.replace(/\s+/g, '')) return NaN;
      var index = 0;
      function primary() {
        var token = tokens[index++];
        if (token === '(') {
          var value = expression();
          if (tokens[index++] !== ')') throw new Error('Missing closing parenthesis.');
          return value;
        }
        if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('Expected a number.');
        return Number(token);
      }
      function unary() {
        if (tokens[index] === '+') { index++; return unary(); }
        if (tokens[index] === '-') { index++; return -unary(); }
        return primary();
      }
      function term() {
        var value = unary();
        while (tokens[index] === '*' || tokens[index] === '/') {
          var operator = tokens[index++];
          var right = unary();
          value = operator === '*' ? value * right : value / right;
        }
        return value;
      }
      function expression() {
        var value = term();
        while (tokens[index] === '+' || tokens[index] === '-') {
          var operator = tokens[index++];
          var right = term();
          value = operator === '+' ? value + right : value - right;
        }
        return value;
      }
      try {
        var result = expression();
        return index === tokens.length ? result : NaN;
      } catch (e) {
        return NaN;
      }
    }
    function calculate() {
      var result = safeEval(expr);
      if (!isFinite(result)) {
        outEl.textContent = 'Error';
        return;
      }
      expr = String(+result.toFixed(10));
      justEvaluated = true;
      refresh();
    }
    function refresh() {
      exprEl.textContent = pretty(expr);
      if (!expr) { outEl.textContent = '0'; return; }
      var v = safeEval(expr);
      outEl.textContent = /[+\-*/.]$/.test(expr) ? pretty(expr) : (isFinite(v) ? String(v) : 'Error');
    }
    function press(v) {
      var last = expr.slice(-1);
      if (/^[0-9]$/.test(v)) {
        if (justEvaluated) expr = '';
        justEvaluated = false;
        expr += v;
      } else if (v === '.') {
        if (justEvaluated) expr = '';
        justEvaluated = false;
        var number = trailing() || '';
        if (number.indexOf('.') > -1) return;
        expr += number ? '.' : '0.';
      } else if ('+-*/'.indexOf(v) > -1) {
        justEvaluated = false;
        if (!expr && v !== '-') return;
        if (v === '-' && (!last || /[+\-*/]$/.test(expr))) {
          if (last !== '-') expr += v;
        } else if (/[+\-*/]$/.test(expr)) {
          if (last === '-' && expr.length > 1 && /[+\-*/]/.test(expr.charAt(expr.length - 2))) {
            expr = expr.slice(0, -2) + v;
          } else {
            expr = expr.slice(0, -1) + v;
          }
        } else {
          expr += v;
        }
      }
      refresh();
    }
    function negate() {
      var match = expr.match(/\d+(?:\.\d*)?$|\.\d+$/);
      if (!match) {
        if (!expr) expr = '-';
        refresh();
        return;
      }
      var start = expr.length - match[0].length;
      if (start > 0 && expr.charAt(start - 1) === '-' &&
          (start === 1 || /[+\-*/]/.test(expr.charAt(start - 2)))) {
        expr = expr.slice(0, start - 1) + expr.slice(start);
      } else {
        expr = expr.slice(0, start) + '-' + expr.slice(start);
      }
      justEvaluated = false;
      refresh();
    }
    function clear() { expr = ''; justEvaluated = false; refresh(); }
    $('#calcKeys').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-v'), c = b.getAttribute('data-c');
      if (v != null) { press(v); return; }
      if (c === 'clear') clear();
      else if (c === 'back') { expr = expr.slice(0, -1); justEvaluated = false; refresh(); }
      else if (c === 'eq') calculate();
      else if (c === 'pct') { var t = trailing(); if (t != null) { replaceTrailing(String(parseFloat(t) / 100)); justEvaluated = false; refresh(); } }
      else if (c === 'neg') negate();
    });
    window.addEventListener('keydown', function (e) {
      if (!$('.pane.is-active[data-pane="calc"]')) return;
      if (e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      var k = e.key;
      if (/^[0-9.]$/.test(k)) press(k);
      else if (k === '+') press('+');
      else if (k === '-') press('-');
      else if (k === '*') press('*');
      else if (k === '/') { e.preventDefault(); press('/'); }
      else if (k === 'Enter' || k === '=') { e.preventDefault(); calculate(); }
      else if (k === 'Backspace') { expr = expr.slice(0, -1); justEvaluated = false; refresh(); }
      else if (k === 'Escape' || k.toLowerCase() === 'c') clear();
    });
    refresh();
  })();

  /* ============ MUSIC (Instagram-style audio) ============ */
  var GRADS = [
    'linear-gradient(135deg,#ffbd39,#ff8a3d)',
    'linear-gradient(135deg,#6a5cff,#a34dff)',
    'linear-gradient(135deg,#ff5c8a,#ff2e63)',
    'linear-gradient(135deg,#22d3aa,#0ea5e9)',
    'linear-gradient(135deg,#f97316,#ef4444)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)'
  ];
  var LIBRARY = [
    { t: 'Neon Nights', a: 'Synth Wave', cat: 'Party', tag: 'FEATURED', dur: '4:05', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { t: 'Golden Hour', a: 'Lofi Keys', cat: 'Chill', dur: '5:12', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { t: 'Midnight Drive', a: 'Retro FM', cat: 'Chill', tag: 'TRENDING', dur: '5:48', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { t: 'Deep Focus', a: 'Study Beats', cat: 'Focus', dur: '4:33', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
    { t: 'Pulse', a: 'Club Kids', cat: 'Party', dur: '6:02', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
    { t: 'Flow State', a: 'Study Beats', cat: 'Focus', tag: 'FEATURED', dur: '5:29', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
    { t: 'Sunset Boulevard', a: 'Retro FM', cat: 'Chill', dur: '5:04', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { t: 'High Voltage', a: 'Club Kids', cat: 'Party', tag: 'TRENDING', dur: '4:57', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
    { t: 'Cloud Session', a: 'Lofi Keys', cat: 'Chill', dur: '5:36', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
    { t: 'Launchpad', a: 'Synth Wave', cat: 'Focus', dur: '4:44', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
    { t: 'Level Up', a: 'Gamin Beats', cat: 'Trending', tag: 'TRENDING', dur: '5:10', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
    { t: 'Dreamscape', a: 'Lofi Keys', cat: 'Chill', tag: 'FEATURED', dur: '4:21', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' }
  ];
  var FALLBACK_STATIONS = [
    { t: 'Radio Mirchi Hindi', a: 'Indian FM · Hindi', src: 'https://eu8.fastcast4u.com/proxy/clyedupq/stream' },
    { t: 'BIG 92.7 FM', a: 'Indian FM · Hindi', src: 'https://stream.zeno.fm/dbstwo3dvhhtv' },
    { t: 'Big FM Tamil', a: 'Indian FM · Tamil', src: 'https://stream.zeno.fm/r2gn1pgm4qruv' },
    { t: 'Hindi Gold Radio', a: 'Hindi · Bollywood classics', src: 'https://azuracast.vibesounds.in:8010/radio.mp3' },
    { t: 'Bombay Beats Radio', a: 'Indian music · Bollywood hits', src: 'https://strmreg.1.fm/bombaybeats_mobile_mp3' },
    { t: 'Bollywood Gaane Purane', a: 'Hindi · Classic Bollywood', src: 'https://stream.zeno.fm/6n6ewddtad0uv' },
    { t: '90s Once Again', a: 'Hindi · 90s Bollywood', src: 'https://stream.zeno.fm/rm4i9pdex3cuv' },
    { t: 'Mirchi Love', a: 'Indian FM · Romantic Hindi', src: 'https://drive.uber.radio/uber/bollywoodlove/icecast.audio' },
    { t: 'Vividh Bharati', a: 'All India Radio · India', src: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8' },
    { t: 'AIR FM Gold', a: 'All India Radio · Delhi', src: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio005/hlspbaudio005_Auto.m3u8' },
    { t: 'Radio Paradise', a: 'United States · Rock, world, electronic', src: 'https://stream.radioparadise.com/mp3-192' },
    { t: 'SomaFM Groove Salad', a: 'United States · Ambient and chill', src: 'https://ice1.somafm.com/groovesalad-128-mp3' },
    { t: 'France Info', a: 'France · News and talk', src: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3' },
    { t: 'Radio Swiss Jazz', a: 'Switzerland · Jazz', src: 'https://stream.srg-ssr.ch/m/rsj/mp3_128' }
  ];

  var audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.85;
  var current = null; // {type,t,a,src,live,art}
  var hls = null;
  var hlsLoadPromise = null;

  var grid = $('#igGrid');
  var radioGrid = $('#igRadio');
  var chipsBox = $('#igChips');
  var searchEl = $('#igSearch');
  var radioCategoryEl = $('#radioCategory');
  var radioCountryEl = $('#radioCountry');
  var radioSearchEl = $('#radioSearch');
  var radioStatusEl = $('#radioStatus');
  var radioRefreshEl = $('#radioRefresh');
  var player = $('#igPlayer');
  var playerTitle = $('#igPlayerTitle');
  var playerSub = $('#igPlayerSub');
  var playerLink = $('#igPlayerLink');
  var playerArtEl = $('#igPlayerArt');
  var playerTrack = $('#igPlayerTrack');
  var playIcon = $('#igPlayIcon');
  var pauseIcon = $('#igPauseIcon');
  var filterCat = 'all';
  var filterSearch = '';
  var radioRequestId = 0;
  var radioController = null;
  var radioSearchTimer = null;
  var countriesPromise = null;
  var radioOffset = 0;
  var radioTotal = 0;
  var radioCountryCounts = {};
  var radioPageSize = 100;
  var playbackAttemptId = 0;
  var streamSourceIndex = 0;
  var activeAudioSource = '';
  var playbackConnected = false;
  var connectionTimer = null;
  var radioCountriesInitialized = false;
  var RADIO_MIRRORS = [
    'https://de1.api.radio-browser.info/json',
    'https://de2.api.radio-browser.info/json'
  ];
  var radioMoreEl = $('#radioMore');

  function radioFetch(path, options) {
    options = options || {};
    var attempt = 0;
    function tryFetch() {
      var url = RADIO_MIRRORS[attempt % RADIO_MIRRORS.length] + path;
      return fetch(url, options).then(function (response) {
        if (!response.ok) throw new Error('Radio directory request failed (' + response.status + ').');
        return response;
      }).catch(function (error) {
        if (error && error.name === 'AbortError') throw error;
        attempt++;
        if (attempt < RADIO_MIRRORS.length) return tryFetch();
        throw error;
      });
    }
    return tryFetch();
  }

  function loadHlsLibrary() {
    if (window.Hls) return Promise.resolve();
    if (!hlsLoadPromise) {
      hlsLoadPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
        script.onload = function () {
          if (window.Hls) resolve();
          else reject(new Error('HLS support could not be loaded.'));
        };
        script.onerror = function () { reject(new Error('HLS support could not be loaded.')); };
        document.head.appendChild(script);
      }).catch(function (error) {
        hlsLoadPromise = null;
        throw error;
      });
    }
    return hlsLoadPromise;
  }

  function playIconSVG() { return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; }
  function pauseIconSVG() { return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'; }
  function gradFor(name) { var n = 0; for (var i = 0; i < name.length; i++) n += name.charCodeAt(i); return GRADS[n % GRADS.length]; }
  function upPlayIcons() {
    var playing = audio && !audio.paused;
    playIcon.style.display = playing ? 'none' : 'block';
    pauseIcon.style.display = playing ? 'block' : 'none';
  }
  function markPlaying() {
    $all('.ig-card', grid).forEach(function (c) { c.classList.toggle('is-playing', c.dataset.src === (current ? current.src : null)); });
    $all('.ig-card', radioGrid).forEach(function (c) { c.classList.toggle('is-playing', c.dataset.src === (current ? current.src : null)); });
    // swap card button icons
    $all('.ig-card', grid).concat($all('.ig-card', radioGrid)).forEach(function (c) {
      var b = $('.ig-card-btn', c);
      if (b) b.innerHTML = c.classList.contains('is-playing') ? pauseIconSVG() : playIconSVG();
    });
  }
  function setCurrent(c) {
    if (current && current.src === c.src) { toggle(); return; }
    playbackAttemptId++;
    window.clearTimeout(connectionTimer);
    playbackConnected = false;
    destroyHls();
    audio.pause();
    current = null;
    activeAudioSource = '';
    audio.removeAttribute('src');
    audio.load();
    current = c;
    current.sources = [c.src, c.url].filter(function (source, index, sources) {
      return source && sources.indexOf(source) === index;
    });
    playerLink.hidden = true;
    if (c.homepage) {
      try {
        var homepage = new URL(c.homepage);
        if (homepage.protocol === 'https:' || homepage.protocol === 'http:') {
          playerLink.href = homepage.href;
          playerLink.hidden = false;
        }
      } catch (e) {
        playerLink.hidden = true;
      }
    }
    streamSourceIndex = 0;
    playerTitle.textContent = c.t;
    playerSub.textContent = c.live ? 'Connecting to live station...' : c.a + '  \u00b7  30s preview';
    playerArtEl.style.background = gradFor(c.t);
    playerArtEl.textContent = c.t.charAt(0);
    document.body.classList.add('has-player');
    player.classList.add('is-open');
    playerTrack.style.width = '0%';
    if (c.live) { playerTrack.style.animation = 'seek-pulse 1.2s ease-in-out infinite'; playerTrack.style.width = '100%'; }
    else { playerTrack.style.animation = 'none'; }
    markPlaying();
    playCurrent(playbackAttemptId);
  }
  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }
  function showPlaybackError(error) {
    window.clearTimeout(connectionTimer);
    var mediaErrorCode = error && typeof error.code === 'number' ? error.code : 0;
    var detail = error && error.name === 'NotAllowedError'
      ? 'Your browser blocked playback. Press Play to try again.'
      : (error && error.name === 'NotSupportedError') || mediaErrorCode === 4
      ? 'This station stream could not be opened. It may be unavailable or use an audio format your browser cannot play.'
      : mediaErrorCode === 2
      ? 'The station stream was interrupted or blocked by its provider.'
      : 'The station stream is offline or blocked by its provider.';
    playerSub.textContent = current && current.live
      ? detail + ' You can retry or choose another station.'
      : 'This track could not be played. Please try another track.';
    streamSourceIndex = 0;
    audio.pause();
    playerTrack.style.animation = 'none';
    upPlayIcons();
  }
  function tryNextStream(error, requestId) {
    if (!current || requestId !== playbackAttemptId) return;
    window.clearTimeout(connectionTimer);
    destroyHls();
    activeAudioSource = '';
    playbackConnected = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    streamSourceIndex++;
    if (streamSourceIndex < current.sources.length) {
      playerSub.textContent = 'Trying the station backup stream...';
      playCurrent(requestId);
    } else {
      showPlaybackError(error);
    }
  }
  function startAudioPlayback(requestId) {
    audio.play().then(upPlayIcons).catch(function (error) { tryNextStream(error, requestId); });
    window.clearTimeout(connectionTimer);
    connectionTimer = window.setTimeout(function () {
      if (current && requestId === playbackAttemptId && !playbackConnected) {
        tryNextStream(new Error('Station connection timed out.'), requestId);
      }
    }, 12000);
  }
  function playCurrent(requestId) {
    if (!current) return;
    requestId = requestId || playbackAttemptId;
    if (requestId !== playbackAttemptId) return;
    var source = current.sources[streamSourceIndex];
    var isHls = Number(current.hls) === 1 || /\.m3u8(?:$|[?#])/i.test(source);
    var hlsSupport = audio.canPlayType('application/vnd.apple.mpegurl');
    var nativeHls = hlsSupport === 'probably' || (hlsSupport === 'maybe' && !window.MediaSource);
    if (isHls && !nativeHls) {
      if (!window.Hls) {
        var requestedSource = source;
        loadHlsLibrary().then(function () {
          if (current && current.sources[streamSourceIndex] === requestedSource) playCurrent(requestId);
        }).catch(function (error) {
          if (current && current.sources[streamSourceIndex] === requestedSource) tryNextStream(error, requestId);
        });
        return;
      }
      if (!window.Hls.isSupported()) {
        tryNextStream(new Error('HLS playback is not supported.'), requestId);
        return;
      }
      if (hls) {
        startAudioPlayback(requestId);
        return;
      }
      var instance = new window.Hls();
      hls = instance;
      instance.loadSource(source);
      instance.attachMedia(audio);
      instance.on(window.Hls.Events.MEDIA_ATTACHED, function () {
        if (current && current.sources[streamSourceIndex] === source && hls === instance) {
          startAudioPlayback(requestId);
        }
      });
      instance.on(window.Hls.Events.ERROR, function (event, data) {
        if (data.fatal && current && current.sources[streamSourceIndex] === source && hls === instance) {
          instance.destroy();
          hls = null;
          tryNextStream(new Error(data.details || 'The HLS stream failed.'), requestId);
        }
      });
      return;
    }
    activeAudioSource = new URL(source, document.baseURI).href;
    audio.src = source;
    startAudioPlayback(requestId);
  }
  function toggle() {
    if (!current) return;
    if (audio.paused) playCurrent();
    else audio.pause();
    upPlayIcons();
  }
  function stop() {
    playbackAttemptId++;
    window.clearTimeout(connectionTimer);
    audio.pause();
    destroyHls();
    current = null;
    activeAudioSource = '';
    playerLink.hidden = true;
    audio.removeAttribute('src');
    audio.load();
    player.classList.remove('is-open');
    document.body.classList.remove('has-player');
    markPlaying();
    upPlayIcons();
  }

  audio.addEventListener('playing', function () {
    playbackConnected = true;
    window.clearTimeout(connectionTimer);
    if (current) {
      playerSub.textContent = (current.live ? '\u25cf LIVE  ' : 'Preview playing  \u00b7  ') + current.a +
        (current.live ? '' : '  \u00b7  30s preview');
    }
    upPlayIcons();
  });
  audio.addEventListener('pause', upPlayIcons);
  audio.addEventListener('waiting', function () {
    if (current && current.live && playbackConnected) playerSub.textContent = 'Buffering live stream...';
  });
  audio.addEventListener('stalled', function () {
    if (current && current.live) playerSub.textContent = 'Reconnecting to the live stream...';
  });
  audio.addEventListener('ended', function () { if (current && !current.live) { audio.currentTime = 0; pauseIcon && upPlayIcons(); } });
  audio.addEventListener('timeupdate', function () {
    if (!current) return;
    if (current.live) return;
    if (audio.currentTime >= PREVIEW_SECONDS) { audio.pause(); audio.currentTime = 0; upPlayIcons(); return; }
    if (isFinite(audio.duration) && audio.duration > 0) playerTrack.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('error', function () {
    if (current && !hls && activeAudioSource && audio.src === activeAudioSource) {
      tryNextStream(audio.error, playbackAttemptId);
    }
  });

  /* render chips */
  var CATS = ['all', 'Featured', 'Chill', 'Focus', 'Party', 'Trending'];
  CATS.forEach(function (c) {
    var b = el('button', { type: 'button', class: 'chip' + (c === 'all' ? ' is-active' : ''), 'data-cat': c }, c === 'all' ? 'All' : c);
    b.addEventListener('click', function () {
      filterCat = c;
      $all('.chip', chipsBox).forEach(function (x) { x.classList.toggle('is-active', x === b); });
      renderGrid();
    });
    chipsBox.appendChild(b);
  });

  function filteredLibrary() {
    return LIBRARY.filter(function (tr) {
      var okCat = filterCat === 'all' || tr.cat === filterCat || (filterCat === 'Trending' && tr.tag === 'TRENDING') || (filterCat === 'Featured' && tr.tag === 'FEATURED');
      if (!okCat) return false;
      if (!filterSearch) return true;
      var q = filterSearch.toLowerCase();
      return (tr.t + ' ' + tr.a).toLowerCase().indexOf(q) > -1;
    });
  }

  function cardFor(tr, isRadio) {
    var card = el('button', { type: 'button', class: 'ig-card', 'data-src': tr.src });
    var art = el('div', { class: 'ig-card-art', style: 'background:' + gradFor(tr.t) });
    var initial = el('span');
    initial.textContent = tr.t.charAt(0);
    art.appendChild(initial);
    art.appendChild(el('span', { class: 'ig-card-btn' }, playIconSVG()));
    card.appendChild(art);
    var body = el('div', { class: 'ig-card-body' });
    var title = el('div', { class: 't' });
    title.textContent = tr.t;
    body.appendChild(title);
    var artist = el('div', { class: 'a' });
    artist.textContent = tr.a;
    body.appendChild(artist);
    var meta = el('div', { class: 'meta' });
    if (isRadio) {
      meta.appendChild(el('span', { class: 'ig-live-tag' }, tr.lastcheckok === 0 ? 'UNVERIFIED' : '\u25cf LIVE'));
      if (tr.bitrate) meta.appendChild(el('span', null, tr.bitrate + ' kbps'));
    } else {
      meta.appendChild(el('span', null, tr.cat || ''));
      meta.appendChild(el('span', null, tr.dur || ''));
    }
    body.appendChild(meta);
    card.appendChild(body);
    card.addEventListener('click', function () {
      if (current && current.src === tr.src) { toggle(); return; }
      setCurrent({
        type: isRadio ? 'radio' : 'lib',
        t: tr.t,
        a: tr.a,
        src: tr.src,
        url: tr.url,
        hls: tr.hls,
        homepage: tr.homepage,
        live: !!isRadio
      });
    });
    return card;
  }

  function renderGrid() {
    grid.innerHTML = '';
    filteredLibrary().forEach(function (tr) { grid.appendChild(cardFor(tr, false)); });
    if (!grid.children.length) grid.appendChild(el('div', { style: 'grid-column:1/-1;color:var(--muted);text-align:center;padding:30px 0' }, 'No tracks match that search.'));
  }
  function renderRadio() {
    radioGrid.innerHTML = '';
    radioGridData.forEach(function (station) {
      var homepage = station.homepage;
      try {
        var homepageUrl = new URL(homepage);
        var homepagePath = homepageUrl.origin + homepageUrl.pathname.replace(/\/+$/, '');
        var isStreamUrl = [station.url_resolved, station.url].some(function (source) {
          if (!source) return false;
          var sourceUrl = new URL(source);
          return sourceUrl.origin + sourceUrl.pathname.replace(/\/+$/, '') === homepagePath;
        });
        if ((homepageUrl.protocol !== 'https:' && homepageUrl.protocol !== 'http:') || isStreamUrl) homepage = '';
      } catch (e) {
        homepage = '';
      }
      radioGrid.appendChild(cardFor({
        t: station.name,
        a: [station.country || 'Worldwide', station.codec].filter(Boolean).join(' \u00b7 '),
        src: station.url_resolved,
        url: station.url,
        hls: station.hls,
        homepage: homepage,
        bitrate: station.bitrate,
        lastcheckok: station.lastcheckok
      }, true));
    });
  }

  var radioGridData = [];
  var radioDirectoryError = '';
  function loadRadioCountries() {
    if (countriesPromise) return countriesPromise;
    countriesPromise = radioFetch('/countries?order=stationcount&reverse=true')
      .then(function (response) {
        return response.json();
      })
      .then(function (countries) {
        radioCountryEl.options.length = 1;
        countries.forEach(function (country) {
          if (!country.name || !country.stationcount) return;
          var option = document.createElement('option');
          option.value = country.name;
          option.textContent = country.name + ' (' + country.stationcount + ')';
          option.dataset.stationcount = country.stationcount;
          radioCountryEl.appendChild(option);
          radioCountryCounts[country.name] = Number(country.stationcount);
        });
        if (!radioCountriesInitialized) {
          radioCountriesInitialized = true;
          radioCountryEl.value = Object.prototype.hasOwnProperty.call(radioCountryCounts, 'India') ? 'India' : '';
        }
        return true;
      })
      .catch(function (error) {
        radioDirectoryError = 'Country filters are unavailable. ';
        console.error('Could not load radio countries:', error);
        return false;
      });
    return countriesPromise;
  }
  function showRadioFallback(requestId) {
    if (requestId !== radioRequestId) return;
    if (radioCategoryEl.value === 'news') {
      radioGridData = [];
      radioGrid.innerHTML = '';
      radioStatusEl.textContent = 'News stations are unavailable from the directory right now. Use Refresh to try again, or switch to All stations.';
      return;
    }
    radioGridData = FALLBACK_STATIONS.map(function (station) {
      var artist = station.a.split(' \u00b7 ');
      return {
        name: station.t,
        country: artist.shift() || 'Worldwide',
        codec: artist.join(' \u00b7 '),
        url_resolved: station.src,
        url: station.src,
        bitrate: 0,
        lastcheckok: 1
      };
    });
    renderRadio();
    radioStatusEl.textContent = 'The worldwide station directory is unavailable right now. Showing a small backup list; use Refresh to try again.';
  }
  function loadRadioStations(append) {
    var requestId = ++radioRequestId;
    if (radioController) radioController.abort();
    radioController = new AbortController();
    if (!append) {
      radioOffset = 0;
      radioGridData = [];
      radioGrid.innerHTML = '';
      radioMoreEl.hidden = true;
    }
    radioMoreEl.disabled = true;
    radioMoreEl.textContent = 'Loading stations...';
    radioStatusEl.textContent = append ? 'Loading more live stations...' : 'Loading live stations worldwide...';
    loadRadioCountries().then(function () {
      if (requestId !== radioRequestId) return;
      var params = new URLSearchParams({
        limit: String(radioPageSize),
        offset: String(radioOffset),
        order: 'clickcount',
        reverse: 'true',
        hidebroken: 'true',
        is_https: 'true'
      });
      var country = radioCountryEl.value;
      var query = radioSearchEl.value.trim();
      var category = radioCategoryEl.value;
      if (country) params.set('country', country);
      if (query) params.set('name', query);
      if (category) params.set('tag', category);
      return radioFetch('/stations/search?' + params.toString(), {
        signal: radioController.signal
      }).then(function (response) {
        return response.json();
      }).then(function (stations) {
        if (requestId !== radioRequestId) return;
        radioOffset += stations.length;
        var validStations = stations.filter(function (station) {
          return station.name && /^https:\/\//i.test(station.url_resolved || station.url || '');
        });
        if (category === 'news') {
          validStations.sort(function (a, b) {
            function playbackRank(station) {
              if (station.lastcheckok !== 1) return 2;
              return /^mp3$/i.test(station.codec || '') ? 0 : 1;
            }
            return playbackRank(a) - playbackRank(b);
          });
        }
        var selectedCountry = radioCountryEl.options[radioCountryEl.selectedIndex];
        radioTotal = country && !query && !category
          ? Number(selectedCountry.dataset.stationcount || radioCountryCounts[country] || 0)
          : 0;
        if (radioTotal) {
          var alreadyLoaded = append ? radioGridData.length : 0;
          validStations = validStations.slice(0, Math.max(radioTotal - alreadyLoaded, 0));
        }
        radioGridData = append ? radioGridData.concat(validStations) : validStations;
        renderRadio();
        if (radioTotal && !query) {
          radioStatusEl.textContent = 'Showing ' + radioGridData.length + ' of ' + radioTotal + ' stations in ' + country + '.';
        } else if (radioGridData.length) {
          radioStatusEl.textContent = 'Showing ' + radioGridData.length +
            (category ? ' ' + category + ' stations' : ' stations') +
            (country ? ' in ' + country + '.' : ' worldwide.') +
            (query ? ' Search: "' + query + '".' : '');
        } else {
          radioStatusEl.textContent = 'No stations found. Try another search or country.';
        }
        var moreAvailable = stations.length === radioPageSize &&
          (!radioTotal || radioOffset < radioTotal);
        radioMoreEl.hidden = !moreAvailable;
        radioMoreEl.disabled = false;
        radioMoreEl.textContent = 'Load more stations' +
          (radioTotal ? ' (' + Math.max(radioTotal - radioOffset, 0) + ' left)' : '');
      });
    }).catch(function (error) {
      if (error.name === 'AbortError' || requestId !== radioRequestId) return;
      console.error('Could not load live radio stations:', error);
      if (!append) showRadioFallback(requestId);
      radioMoreEl.disabled = false;
      radioMoreEl.textContent = 'Retry loading stations';
      radioMoreEl.hidden = false;
    });
  }

  searchEl.addEventListener('input', function () { filterSearch = searchEl.value; renderGrid(); });
  radioCategoryEl.addEventListener('change', function () { loadRadioStations(false); });
  radioCountryEl.addEventListener('change', function () { loadRadioStations(false); });
  radioSearchEl.addEventListener('input', function () {
    window.clearTimeout(radioSearchTimer);
    radioSearchTimer = window.setTimeout(function () { loadRadioStations(false); }, 350);
  });
  radioSearchEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      window.clearTimeout(radioSearchTimer);
      loadRadioStations(false);
    }
  });
  radioRefreshEl.addEventListener('click', function () { loadRadioStations(false); });
  radioMoreEl.addEventListener('click', function () { loadRadioStations(true); });

  /* ============ IPTV-ORG LIVE TV ============ */
  var TV_PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
  var tvOpenPlaylistEl = $('#tvOpenPlaylist');
  var tvCopyPlaylistEl = $('#tvCopyPlaylist');
  var tvPlaylistStatusEl = $('#tvPlaylistStatus');
  var tvChannelsEl = $('#tvChannels');
  var tvPlayerEl = $('#tvPlayer');
  var tvStatusEl = $('#tvStatus');
  var tvNowPlayingEl = $('#tvNowPlaying');
  var tvStreamLinkEl = $('#tvStreamLink');
  var tvCopyStreamEl = $('#tvCopyStream');
  var tvNextChannelEl = $('#tvNextChannel');
  var tvGroupEl = $('#tvGroup');
  var tvCountryEl = $('#tvCountry');
  var tvSearchEl = $('#tvSearch');
  var tvRefreshEl = $('#tvRefresh');
  var tvMoreEl = $('#tvMore');
  var tvData = [];
  var tvFilteredData = [];
  var tvVisibleCount = 0;
  var tvRequestId = 0;
  var tvController = null;
  var tvPlaybackQueue = [];
  var tvSearchTimer = null;
  var tvHls = null;
  var tvPlaybackId = 0;
  var tvCurrentChannel = null;
  var tvCurrentIndex = -1;
  var tvFailureHandledId = 0;
  var tvSkipCounts = { headers: 0, insecure: 0 };
  var TV_PAGE_SIZE = 40;
  var TV_PROXY_URL = (window.TV_PROXY_URL || '').replace(/\/+$/, '');

  function buildTVProxyUrl(url, referer, userAgent) {
    if (!url || !TV_PROXY_URL) return '';
    try {
      var params = new URLSearchParams({ url: new URL(url, window.location.href).href });
      if (referer) params.set('referer', referer);
      if (userAgent) params.set('ua', userAgent);
      return TV_PROXY_URL + '/proxy?' + params.toString();
    } catch (error) {
      return '';
    }
  }

  function buildTVTranscodeUrl(url, mode, referer, userAgent) {
    if (!url || !TV_PROXY_URL) return '';
    try {
      var params = new URLSearchParams({
        url: new URL(url, window.location.href).href,
        mode: mode || 'audio'
      });
      if (referer) params.set('referer', referer);
      if (userAgent) params.set('ua', userAgent);
      return TV_PROXY_URL + '/transcode?' + params.toString();
    } catch (error) {
      return '';
    }
  }

  function buildTVPlaybackQueue(channel) {
    var queue = [];
    var seen = {};
    function add(source) {
      if (!source || !source.url || seen[source.url]) return;
      queue.push(source);
      seen[source.url] = true;
    }
    if (channel && channel.url) add({ label: 'direct', url: channel.url });
    var proxyUrl = buildTVProxyUrl(channel.url, channel.referer, channel.userAgent);
    if (proxyUrl) add({ label: 'proxy', url: proxyUrl });
    var audioUrl = buildTVTranscodeUrl(channel.url, 'audio', channel.referer, channel.userAgent);
    var videoUrl = buildTVTranscodeUrl(channel.url, 'video', channel.referer, channel.userAgent);
    if (audioUrl) add({ label: 'transcode-audio', url: audioUrl });
    if (videoUrl) add({ label: 'transcode-video', url: videoUrl });
    return queue;
  }

  function findM3UDelimiter(line) {
    var quoted = false;
    for (var i = 0; i < line.length; i++) {
      if (line.charAt(i) === '"') quoted = !quoted;
      else if (line.charAt(i) === ',' && !quoted) return i;
    }
    return -1;
  }

  function vlcPlaylistUrl() {
    var userAgent = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      return 'vlc-x-callback://x-callback-url/stream?url=' + encodeURIComponent(TV_PLAYLIST_URL);
    }
    if (/Android/i.test(userAgent)) {
      var playlist = new URL(TV_PLAYLIST_URL);
      return 'intent://' + playlist.host + playlist.pathname +
        '#Intent;scheme=' + playlist.protocol.slice(0, -1) +
        ';package=org.videolan.vlc;S.browser_fallback_url=' +
        encodeURIComponent('https://play.google.com/store/apps/details?id=org.videolan.vlc') + ';end';
    }
    return '';
  }

  function copyTVUrl(url, statusEl, successMessage, fallbackMessage) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      statusEl.textContent = fallbackMessage;
      return;
    }
    navigator.clipboard.writeText(url).then(function () {
      statusEl.textContent = successMessage;
    }).catch(function (error) {
      console.error('Could not copy the TV link:', error);
      statusEl.textContent = fallbackMessage;
    });
  }

  function countryName(code) {
    if (!code) return '';
    code = code.toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code)) return code;
    if (typeof Intl.DisplayNames === 'function') {
      var displayName = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
      if (displayName && displayName !== code) return displayName;
    }
    return code;
  }

  function parseM3U(text) {
    var channels = [];
    var metadata = null;
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (line.indexOf('#EXTINF:') === 0) {
        var comma = findM3UDelimiter(line);
        var header = comma < 0 ? line : line.slice(0, comma);
        var title = comma < 0 ? '' : line.slice(comma + 1).trim();
        var attributes = {};
        header.replace(/([\w-]+)="([^"]*)"/g, function (match, key, value) {
          attributes[key.toLowerCase()] = value;
          return match;
        });
        var countryMatch = (attributes['tvg-id'] || '').match(/\.([a-z]{2,3})(?:@|$)/i);
        var countryCode = (attributes['tvg-country'] || '').split(/[;,]/)[0].trim() ||
          (countryMatch ? countryMatch[1] : '');
        var categories = (attributes['group-title'] || 'Other').split(';')
          .map(function (category) { return category.trim(); })
          .filter(function (category, index, all) { return category && all.indexOf(category) === index; });
        metadata = {
          name: attributes['tvg-name'] || title || 'Unnamed channel',
          logo: attributes['tvg-logo'] || '',
          country: countryName(countryCode),
          categories: categories.length ? categories : ['Other'],
          requiresHeaders: false,
          referer: '',
          userAgent: ''
        };
        return;
      }
      if (metadata && line.indexOf('#EXTVLCOPT:') === 0) {
        var option = line.slice('#EXTVLCOPT:'.length);
        var refMatch = option.match(/http-referrer\s*=\s*"?([^"\s]+)"?/i);
        var uaMatch = option.match(/http-user-agent\s*=\s*"?([^"\s]+)"?/i);
        if (refMatch) {
          metadata.referer = decodeURIComponent(refMatch[1]);
          metadata.requiresHeaders = true;
        }
        if (uaMatch) {
          metadata.userAgent = decodeURIComponent(uaMatch[1]);
          metadata.requiresHeaders = true;
        }
        return;
      }
      if (line.charAt(0) === '#') return;
      if (!metadata) return;
      try {
        var url = new URL(line);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          if (document.location.protocol === 'https:' && url.protocol !== 'https:') {
            tvSkipCounts.insecure++;
          }
          channels.push({
            name: metadata.name,
            logo: metadata.logo,
            country: metadata.country,
            categories: metadata.categories,
            url: url.href,
            referer: metadata.referer || '',
            userAgent: metadata.userAgent || '',
            requiresHeaders: metadata.requiresHeaders,
            insecure: document.location.protocol === 'https:' && url.protocol !== 'https:'
          });
        }
      } catch (error) {
        console.warn('Skipping an invalid IPTV channel URL:', line);
      }
      metadata = null;
    });
    return channels;
  }

  function replaceTVOptions(select, values, allLabel) {
    select.options.length = 0;
    select.add(new Option(allLabel, ''));
    values.forEach(function (value) {
      var label = value === 'Animation' ? 'Cartoons & Animation'
        : value === 'Kids' ? 'Kids & Children'
        : value === 'Religious' ? 'Religious & Faith'
        : value;
      select.add(new Option(label, value));
    });
  }

  function renderTVChannels(append) {
    if (!append) {
      tvChannelsEl.innerHTML = '';
      tvVisibleCount = 0;
    }
    tvFilteredData = tvData.filter(function (channel) {
      var query = tvSearchEl.value.trim().toLowerCase();
      return (!tvGroupEl.value || channel.categories.indexOf(tvGroupEl.value) > -1) &&
        (!tvCountryEl.value || channel.country === tvCountryEl.value) &&
        (!query || (channel.name + ' ' + channel.categories.join(' ') + ' ' + channel.country).toLowerCase().indexOf(query) > -1);
    });
    var nextCount = Math.min(tvVisibleCount + TV_PAGE_SIZE, tvFilteredData.length);
    for (var i = tvVisibleCount; i < nextCount; i++) {
      var channel = tvFilteredData[i];
      var card = el('button', { type: 'button', class: 'ig-card tv-channel-card', 'aria-label': 'Watch ' + channel.name });
      var art = el('div', { class: 'ig-card-art tv-channel-art' });
      if (channel.logo) {
        try {
          var logoUrl = new URL(channel.logo);
          if (logoUrl.protocol === 'http:' || logoUrl.protocol === 'https:') {
            var logo = el('img', { class: 'tv-channel-logo', alt: '', loading: 'lazy' });
            logo.src = logoUrl.href;
            logo.addEventListener('error', function () { this.hidden = true; });
            art.appendChild(logo);
          }
        } catch (error) {
          // Ignore invalid optional logo URLs; the channel remains available.
        }
      }
      var initial = el('span', { class: 'tv-channel-initial' });
      initial.textContent = channel.name.charAt(0).toUpperCase();
      art.appendChild(initial);
      card.appendChild(art);
      var body = el('div', { class: 'ig-card-body' });
      var title = el('div', { class: 't' });
      title.textContent = channel.name;
      body.appendChild(title);
      var country = el('div', { class: 'a' });
      country.textContent = channel.country || 'Worldwide';
      body.appendChild(country);
      var group = el('div', { class: 'meta' });
      group.textContent = channel.categories.join(' · ');
      body.appendChild(group);
      card.appendChild(body);
      card.addEventListener('click', function (selectedChannel) {
        return function () { playTVChannel(selectedChannel); };
      }(channel));
      tvChannelsEl.appendChild(card);
    }
    tvVisibleCount = nextCount;
    tvMoreEl.hidden = tvVisibleCount >= tvFilteredData.length;
    if (!tvFilteredData.length) {
      tvChannelsEl.appendChild(el('p', { class: 'tv-empty' }, 'No channels match these filters.'));
    }
    if (tvData.length) {
      tvStatusEl.textContent = 'Showing ' + tvVisibleCount + ' of ' + tvFilteredData.length +
        ' matching browser-compatible channels (' + tvData.length + ' available' +
        (tvSkipCounts.headers ? ', ' + tvSkipCounts.headers + ' requiring VLC headers' : '') +
        (tvSkipCounts.insecure ? ', ' + tvSkipCounts.insecure + ' HTTP-only on this secure page' : '') + ').';
    }
  }

  function loadTVChannels() {
    if (tvData.length) return;
    if (tvController) tvController.abort();
    tvController = new AbortController();
    var requestId = ++tvRequestId;
    tvRefreshEl.disabled = true;
    tvStatusEl.textContent = 'Loading the IPTV-org channel playlist...';
    fetch(TV_PLAYLIST_URL, { signal: tvController.signal }).then(function (response) {
      if (!response.ok) throw new Error('Playlist request failed (' + response.status + ').');
      return response.text();
    }).then(function (text) {
      if (requestId !== tvRequestId) return;
      tvSkipCounts = { headers: 0, insecure: 0 };
      tvData = parseM3U(text);
      if (!tvData.length) throw new Error('The playlist did not contain any playable HTTP(S) channels.');
      var groups = {};
      var countries = {};
      tvData.forEach(function (channel) {
        channel.categories.forEach(function (category) { groups[category] = true; });
        if (channel.country) countries[channel.country] = true;
      });
      replaceTVOptions(tvGroupEl, Object.keys(groups).sort(), 'All categories');
      replaceTVOptions(tvCountryEl, Object.keys(countries).sort(), 'All countries');
      renderTVChannels(false);
    }).catch(function (error) {
      if (error.name === 'AbortError' || requestId !== tvRequestId) return;
      console.error('Could not load the IPTV-org playlist:', error);
      tvStatusEl.textContent = 'Could not load TV channels. Check your connection and use Reload playlist to try again.';
    }).then(function () {
      if (requestId === tvRequestId) tvRefreshEl.disabled = false;
    });
  }

  function destroyTVHls() {
    if (tvHls) {
      tvHls.destroy();
      tvHls = null;
    }
  }

  function stopTVPlayback() {
    tvPlaybackId++;
    tvCurrentChannel = null;
    destroyTVHls();
    tvPlayerEl.pause();
    tvPlayerEl.removeAttribute('src');
    tvPlayerEl.load();
    tvStreamLinkEl.hidden = true;
    tvCopyStreamEl.hidden = true;
    tvNextChannelEl.hidden = true;
    tvCurrentIndex = -1;
    tvNowPlayingEl.textContent = 'Choose a channel to start watching.';
  }

  function tvPlaybackError(channel, error, hlsError) {
    var mediaError = tvPlayerEl.error;
    if (error && error.message === 'HLS playback is not supported by this browser.') {
      return error.message + ' Open the stream URL in VLC or try another browser.';
    }
    if ((error && error.name === 'NotSupportedError') || (mediaError && mediaError.code === 4)) {
      return channel.name + ' uses a media codec this browser cannot decode. Open the stream URL in VLC or try a browser with the required codec.';
    }
    if (mediaError && mediaError.code === 3) {
      return channel.name + ' could not be decoded by this browser. Try another channel or open the stream URL in VLC.';
    }
    var responseCode = hlsError && hlsError.response && hlsError.response.code;
    if (responseCode === 403) return channel.name + ' was denied by its provider (403). It may be geo-restricted or require provider headers.';
    if (responseCode === 404) return channel.name + ' was not found (404). The stream may have been removed.';
    if (hlsError && hlsError.type === window.Hls.ErrorTypes.NETWORK_ERROR && !responseCode) {
      return channel.name + ' could not be reached. This may be a CORS restriction, blocked request, or offline stream.';
    }
    if (mediaError && mediaError.code === 2) {
      return channel.name + ' lost its network connection. It may be offline or blocked by its provider.';
    }
    return channel.name + ' could not be played. The provider may be offline, geo-restricted, or blocking browser playback.';
  }

  function nextTVChannel() {
    if (tvFilteredData.length < 2 || tvCurrentIndex < 0) {
      tvNextChannelEl.hidden = true;
      return;
    }
    var nextIndex = (tvCurrentIndex + 1) % tvFilteredData.length;
    playTVChannel(tvFilteredData[nextIndex]);
  }

  function handleTVPlaybackFailure(channel, playbackId, error, hlsError) {
    if (playbackId !== tvPlaybackId || tvFailureHandledId === playbackId) return;
    tvFailureHandledId = playbackId;
    destroyTVHls();
    tvPlayerEl.pause();
    var message = tvPlaybackError(channel, error, hlsError);
    if (tvFilteredData.length < 2) tvNextChannelEl.hidden = true;
    tvNowPlayingEl.textContent = message + ' Use Next channel to keep browsing, or open the stream in VLC.';
  }

  function playTVChannel(channel) {
    var playbackId = ++tvPlaybackId;
    tvCurrentChannel = channel;
    tvCurrentIndex = tvFilteredData.indexOf(channel);
    tvFailureHandledId = 0;
    tvPlaybackQueue = buildTVPlaybackQueue(channel);
    destroyTVHls();
    tvPlayerEl.pause();
    tvPlayerEl.removeAttribute('src');
    tvPlayerEl.load();
    tvStreamLinkEl.href = channel.url;
    tvStreamLinkEl.hidden = false;
    tvCopyStreamEl.hidden = false;
    tvNextChannelEl.hidden = false;
    tvNowPlayingEl.textContent = 'Connecting to ' + channel.name + '...';

    var playbackQueue = tvPlaybackQueue;
    var playbackIndex = 0;
    var isHls = /\.m3u8(?:$|[?#])/i.test(channel.url);
    var hlsSupport = tvPlayerEl.canPlayType('application/vnd.apple.mpegurl');
    var nativeHls = hlsSupport === 'probably' || (hlsSupport === 'maybe' && !window.MediaSource);

    tvPlayerEl._tvErrorHandler = function () {
      if (playbackId !== tvPlaybackId || !tvCurrentChannel) return;
      if (playbackQueue.length > playbackIndex + 1) {
        tryNextSource();
        return;
      }
      handleTVPlaybackFailure(tvCurrentChannel, playbackId);
    };

    function attemptPlay() {
      if (playbackId !== tvPlaybackId) return;
      var result = tvPlayerEl.play();
      if (result && typeof result.catch === 'function') {
        result.catch(function (error) {
          if (playbackId !== tvPlaybackId) return;
          tvNowPlayingEl.textContent = error.name === 'NotAllowedError'
            ? channel.name + ' is ready. Press Play to start watching.'
            : error.name === 'NotSupportedError'
            ? handleTVPlaybackFailure(channel, playbackId, error)
            : tvPlaybackError(channel, error);
        });
      }
    }

    function tryNextSource(error, hlsError) {
      if (playbackId !== tvPlaybackId) return;
      playbackIndex += 1;
      var source = playbackQueue[playbackIndex];
      if (!source) {
        handleTVPlaybackFailure(channel, playbackId, error, hlsError);
        return;
      }
      tvStreamLinkEl.href = source.url;
      tvNowPlayingEl.textContent = 'Trying the ' + source.label + ' source for ' + channel.name + '...';
      startPlayback(source.url, source.label);
    }

    function startPlayback(sourceUrl, sourceLabel) {
      if (playbackId !== tvPlaybackId) return;
      var useHls = /\.m3u8(?:$|[?#])/i.test(sourceUrl);
      function onFatal(error, hlsError) {
        if (playbackId !== tvPlaybackId) return;
        tryNextSource(error, hlsError);
      }
      if (useHls && !nativeHls && window.Hls && window.Hls.isSupported()) {
        var instance = new window.Hls();
        tvHls = instance;
        instance.attachMedia(tvPlayerEl);
        instance.on(window.Hls.Events.MEDIA_ATTACHED, function () {
          if (playbackId !== tvPlaybackId || tvHls !== instance) return;
          instance.loadSource(sourceUrl);
        });
        instance.on(window.Hls.Events.MANIFEST_PARSED, function () {
          if (playbackId !== tvPlaybackId || tvHls !== instance) return;
          attemptPlay();
        });
        instance.on(window.Hls.Events.ERROR, function (event, data) {
          if (data && data.fatal && playbackId === tvPlaybackId && tvHls === instance) {
            onFatal(null, data);
          }
        });
      } else if (useHls && !nativeHls) {
        onFatal(new Error('HLS playback is not supported by this browser.'));
        return;
      } else {
        tvPlayerEl.src = sourceUrl;
        tvPlayerEl.load();
        attemptPlay();
      }
    }

    if (!playbackQueue.length) {
      handleTVPlaybackFailure(channel, playbackId, new Error('No playable URL was generated for this channel.'));
      return;
    }

    var firstSource = playbackQueue[0];
    tvStreamLinkEl.href = firstSource.url;
    tvNowPlayingEl.textContent = 'Trying the ' + firstSource.label + ' source for ' + channel.name + '...';
    if (isHls && !nativeHls && !window.Hls) {
      loadHlsLibrary().then(function () { startPlayback(firstSource.url, firstSource.label); }).catch(function (error) {
        if (playbackId !== tvPlaybackId) return;
        console.error('Could not load HLS playback support:', error);
        tvNowPlayingEl.textContent = 'HLS playback support could not be loaded. Check your connection and try again.';
      });
    } else {
      startPlayback(firstSource.url, firstSource.label);
    }
  }

  tvPlayerEl.addEventListener('playing', function () {
    tvNowPlayingEl.textContent = 'Now playing live TV.';
  });
  tvPlayerEl.addEventListener('error', function () {
    if (tvPlayerEl.currentSrc && tvCurrentChannel) {
      if (typeof tvPlayerEl._tvErrorHandler === 'function') {
        tvPlayerEl._tvErrorHandler();
        return;
      }
      handleTVPlaybackFailure(tvCurrentChannel, tvPlaybackId);
    }
  });
  tvNextChannelEl.addEventListener('click', nextTVChannel);
  tvGroupEl.addEventListener('change', function () { renderTVChannels(false); });
  tvCountryEl.addEventListener('change', function () { renderTVChannels(false); });
  tvSearchEl.addEventListener('input', function () {
    window.clearTimeout(tvSearchTimer);
    tvSearchTimer = window.setTimeout(function () { renderTVChannels(false); }, 200);
  });
  tvRefreshEl.addEventListener('click', function () {
    tvData = [];
    tvGroupEl.value = '';
    tvCountryEl.value = '';
    tvSearchEl.value = '';
    renderTVChannels(false);
    loadTVChannels();
  });
  tvMoreEl.addEventListener('click', function () { renderTVChannels(true); });
  tvOpenPlaylistEl.addEventListener('click', function () {
    var appUrl = vlcPlaylistUrl();
    if (!appUrl) {
      tvPlaylistStatusEl.textContent = 'On a phone, install VLC, then use Open in VLC. On a computer, copy the playlist link into VLC under Media > Open Network Stream.';
      return;
    }
    tvPlaylistStatusEl.textContent = 'Opening the complete playlist in VLC...';
    window.location.href = appUrl;
  });
  tvCopyPlaylistEl.addEventListener('click', function () {
    copyTVUrl(
      TV_PLAYLIST_URL,
      tvPlaylistStatusEl,
      'Playlist link copied. Open VLC and use Open Network Stream to load all channels.',
      'Copy the playlist link shown below, then paste it into VLC using Open Network Stream.'
    );
  });
  tvCopyStreamEl.addEventListener('click', function () {
    if (!tvCurrentChannel) return;
    copyTVUrl(
      tvCurrentChannel.url,
      tvNowPlayingEl,
      'Stream URL copied. In VLC, choose Media > Open Network Stream and paste it.',
      'Copy the Open stream URL link address and paste it into VLC under Media > Open Network Stream.'
    );
  });

  $('#igPlayPause').addEventListener('click', toggle);
  $('#igClose').addEventListener('click', stop);

  renderGrid();

  /* ============ NOTES -> GOOGLE DRIVE ============ */
  (function () {
    var titleIn = $('#noteTitle');
    var bodyIn = $('#noteBody');
    var statusEl = $('#noteStatus');
    var driveUrlIn = $('#driveUrl');
    var codeEl = $('#driveCode');

    var draft = readLS(LS_NOTE, '');
    if (draft) { try { var d = JSON.parse(draft); titleIn.value = d.t || ''; bodyIn.value = d.b || ''; } catch (e) {} }
    driveUrlIn.value = readLS(LS_DRIVE, '');

    var APPS_SCRIPT_CODE =
      "const DOC_ID = 'PASTE_YOUR_GOOGLE_DOC_ID_HERE';\n\n" +
      "function doPost(e) {\n" +
      "  try {\n" +
      "    const data = JSON.parse(e.postData.contents);\n" +
      "    const doc = DocumentApp.openById(DOC_ID);\n" +
      "    const body = doc.getBody();\n" +
      "    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');\n" +
      "    const head = body.appendParagraph('[' + stamp + '] ' + (data.title || 'Note'));\n" +
      "    head.setHeading(DocumentApp.ParagraphHeading.HEADING2);\n" +
      "    const lines = String(data.text || '').split('\\n');\n" +
      "    for (let i = 0; i < lines.length; i++) body.appendParagraph(lines[i]);\n" +
      "    body.appendParagraph('');\n" +
      "    doc.saveAndClose();\n" +
      "    return ContentService.createTextOutput(JSON.stringify({ ok: true }))\n" +
      "      .setMimeType(ContentService.MimeType.JSON);\n" +
      "  } catch (err) {\n" +
      "    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))\n" +
      "      .setMimeType(ContentService.MimeType.JSON);\n" +
      "  }\n" +
      "}\n\n" +
      "function doGet() {\n" +
      "  return ContentService.createTextOutput(JSON.stringify({ ok: true }))\n" +
      "    .setMimeType(ContentService.MimeType.JSON);\n" +
      "}";
    codeEl.textContent = APPS_SCRIPT_CODE;

    function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'status' + (cls ? ' ' + cls : ''); }
    function saveDraft() { writeLS(LS_NOTE, JSON.stringify({ t: titleIn.value, b: bodyIn.value })); }
    titleIn.addEventListener('input', saveDraft);
    bodyIn.addEventListener('input', saveDraft);

    $('.notes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return;
      var act = b.getAttribute('data-n');
      if (act === 'saveurl') { writeLS(LS_DRIVE, driveUrlIn.value.trim()); setStatus(driveUrlIn.value.trim() ? 'URL saved.' : 'URL cleared.', 'ok'); }
      else if (act === 'local') { saveDraft(); setStatus('Saved in this browser.', 'ok'); }
      else if (act === 'clear') { titleIn.value = ''; bodyIn.value = ''; saveDraft(); setStatus('Cleared.'); }
      else if (act === 'drive') {
        var text = bodyIn.value.trim();
        if (!text) { setStatus('Write something first.', 'err'); return; }
        var url = driveUrlIn.value.trim() || readLS(LS_DRIVE, '');
        if (!url) { setStatus('Add your Apps Script URL in the setup section below.', 'err'); return; }
        var payload = JSON.stringify({ title: titleIn.value.trim() || 'Note', text: text, ts: Date.now() });
        setStatus('Sending to Drive...');
        b.disabled = true;
        fetch(url, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload
        }).then(function () { setStatus('Sent to Google Drive.', 'ok'); saveDraft(); })
          .catch(function () { setStatus('Could not reach the script. Check the URL.', 'err'); })
          .then(function () { b.disabled = false; });
      }
    });
  })();

  /* ============ CALENDAR ============ */
  (function () {
    var monEl = $('#calMon');
    var grid = $('#calGrid');
    var dayTitle = $('#calDayTitle');
    var input = $('#calInput');
    var evList = $('#calEvents');

    var events = {};
    try { events = JSON.parse(readLS(LS_EVENTS, '{}')) || {}; } catch (e) { events = {}; }

    var today = new Date();
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var selected = ymd(today);
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function persist() { writeLS(LS_EVENTS, JSON.stringify(events)); }

    function render() {
      monEl.textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
      grid.innerHTML = '';
      DOW.forEach(function (d) { grid.appendChild(el('div', { class: 'dow' }, d)); });

      var firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      var daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
      var cells = [], i;
      for (i = firstDay - 1; i >= 0; i--) cells.push({ d: new Date(view.getFullYear(), view.getMonth() - 1, prevDays - i), out: true });
      for (i = 1; i <= daysInMonth; i++) cells.push({ d: new Date(view.getFullYear(), view.getMonth(), i), out: false });
      while (cells.length % 7 !== 0) cells.push({ d: new Date(view.getFullYear(), view.getMonth() + 1, cells.length - firstDay - daysInMonth + 1), out: true });

      cells.forEach(function (c) {
        var key = ymd(c.d);
        var b = el('button', { type: 'button', class: 'day' + (c.out ? ' out' : '') + (key === ymd(today) ? ' today' : '') + (key === selected ? ' sel' : '') });
        b.appendChild(document.createTextNode(String(c.d.getDate())));
        if (events[key] && events[key].length) b.appendChild(el('span', { class: 'dot' }));
        b.addEventListener('click', function () { selected = key; render(); });
        grid.appendChild(b);
      });
      renderDay();
    }

    function renderDay() {
      var parts = selected.split('-');
      var dd = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      dayTitle.textContent = DOW[dd.getDay()] + ', ' + dd.getDate() + ' ' + MONTHS[dd.getMonth()] + ' ' + dd.getFullYear();
      evList.innerHTML = '';
      var list = events[selected] || [];
      if (!list.length) { evList.appendChild(el('li', { style: 'color:var(--muted);justify-content:center' }, 'No notes for this day yet.')); return; }
      list.forEach(function (txt, i) {
        var li = el('li');
        li.appendChild(el('span', null, txt));
        var del = el('button', { type: 'button', title: 'Delete' }, '&times;');
        del.addEventListener('click', function () { list.splice(i, 1); if (!list.length) delete events[selected]; persist(); render(); });
        li.appendChild(del);
        evList.appendChild(li);
      });
    }

    $('.cal').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cal]'); if (!b) return;
      var act = b.getAttribute('data-cal');
      if (act === 'prev') { view.setMonth(view.getMonth() - 1); render(); }
      else if (act === 'next') { view.setMonth(view.getMonth() + 1); render(); }
      else if (act === 'today') { view = new Date(today.getFullYear(), today.getMonth(), 1); selected = ymd(today); render(); }
      else if (act === 'add') {
        var t = input.value.trim(); if (!t) return;
        (events[selected] = events[selected] || []).push(t);
        input.value = ''; persist(); render();
      }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-cal="add"]', $('.cal')).click(); } });

    render();
  })();
})();