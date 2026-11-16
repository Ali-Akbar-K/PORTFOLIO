(function () {
  'use strict';

  var API_BASE = 'https://api.quran.com/api/v4';
  var AUDIO_BASE = 'https://verses.quran.com/';
  var TRANSLATION_ID = 20;
  var RECITER_ID = 7;
  var surahSelect = document.getElementById('quranSurah');
  var playButton = document.getElementById('quranPlay');
  var pauseButton = document.getElementById('quranPause');
  var status = document.getElementById('quranStatus');
  var versesElement = document.getElementById('quranVerses');
  var storyStage = document.getElementById('quranStoryStage');
  var caveStoryPlayButton = document.getElementById('quranCaveStoryPlay');
  var caveStoryPauseButton = document.getElementById('quranCaveStoryPause');
  var caveStoryStatus = document.getElementById('quranCaveStoryStatus');
  var caveSceneElement = document.getElementById('quranCaveScene');
  var caveSceneLabel = document.getElementById('quranCaveSceneLabel');
  var caveSceneSummary = document.getElementById('quranCaveSceneSummary');
  var caveArabicCaption = document.getElementById('quranCaveArabic');
  var caveTranslationCaption = document.getElementById('quranCaveTranslation');
  var quranAudio = new Audio();
  quranAudio.preload = 'none';

  var chapters = [];
  var verses = [];
  var chapterId = 0;
  var verseIndex = -1;
  var loadToken = 0;
  var isInitializing = false;
  var isPlaying = false;
  var isLoadingChapter = false;
  var isLoadingCaveStory = false;
  var caveStoryLoadToken = 0;
  var storyPlaybackMode = null;
  var storyEndIndex = -1;
  var activeVerseElement = null;
  var activeWordElement = null;
  var playbackStoryVerseId = null;
  var sajdahStories = {
    '7:206': {
      title: 'Worship without arrogance',
      reflection: 'Those near their Lord glorify Him and prostrate without arrogance.',
      context: 'The translation identifies those near their Lord as angels. The scene uses light and geometry, not angel figures.',
      scene: 'night'
    },
    '13:15': {
      title: 'Creation prostrates',
      reflection: 'The verse describes all within the heavens and earth, and their shadows, prostrating to Allah.',
      context: 'The illustration follows the verse’s imagery of creation and the changing shadows of morning and afternoon.',
      scene: 'creation'
    },
    '16:50': {
      title: 'Obedience to the Lord',
      reflection: 'They fear their Lord and do what they are commanded.',
      context: 'The surrounding passage describes creatures and angels obeying their Lord. No unseen beings are depicted.',
      scene: 'stars'
    },
    '17:109': {
      title: 'Humility during recitation',
      reflection: 'The verse describes the Qur’an increasing them in humble submission.',
      context: 'The scene reflects the verse’s response to recitation without depicting individuals.',
      scene: 'recitation'
    },
    '19:58': {
      title: 'A response to revelation',
      reflection: 'When the verses of the Most Merciful were recited, they fell in prostration and weeping.',
      context: 'The verse names prophets and guided people. The illustration uses symbolic light and recitation, without depicting prophets or people.',
      scene: 'recitation'
    },
    '22:18': {
      title: 'The signs in creation',
      reflection: 'The verse names the sun, moon, stars, mountains, trees, creatures, and many people.',
      context: 'The illustration uses celestial and natural elements named in the verse; no divine or unseen beings are shown.',
      scene: 'creation'
    },
    '25:60': {
      title: 'A refusal to prostrate',
      reflection: 'The verse describes the response of those told to prostrate to the Most Merciful.',
      context: 'The scene represents the exchange with abstract speech marks rather than depicting people.',
      scene: 'response'
    },
    '27:26': {
      title: 'The Lord of the Great Throne',
      reflection: 'The verse affirms that Allah alone is worthy of worship and is Lord of the Great Throne.',
      context: 'The illustration is geometric and symbolic; it does not depict Allah or the unseen.',
      scene: 'throne'
    },
    '32:15': {
      title: 'Remembrance and humility',
      reflection: 'When reminded of the verses, believers prostrate and praise their Lord.',
      context: 'The scene reflects remembrance and worship with symbolic light, without depicting people.',
      scene: 'remembrance'
    },
    '38:24': {
      title: 'Repentance after a test',
      reflection: 'The verse says David recognized a test, sought forgiveness, prostrated, and turned in repentance.',
      context: 'Tafsir Ibn Kathir (abridged) cautions against treating expanded, weakly sourced backstories as certain. This animation stays with the actions stated in the verse.',
      scene: 'repentance',
      source: 'Context checked against Tafsir Ibn Kathir (abridged), Quran.com tafsir 169.'
    },
    '41:38': {
      title: 'Praise by night and day',
      reflection: 'Those near their Lord glorify Him by night and day without weariness.',
      context: 'The scene represents the verse’s night-and-day imagery without depicting angels or other unseen beings.',
      scene: 'night'
    },
    '53:62': {
      title: 'Prostrate and worship',
      reflection: 'The verse calls people to prostrate to Allah and worship Him.',
      context: 'The illustration uses a quiet, empty prayer space as a symbolic reflection.',
      scene: 'worship'
    },
    '84:21': {
      title: 'A question about recitation',
      reflection: 'The verse asks why they do not prostrate when the Qur’an is recited.',
      context: 'The scene centers on recitation and response, without depicting people.',
      scene: 'recitation'
    },
    '96:19': {
      title: 'Draw near',
      reflection: 'The verse says not to obey the rejecter, but to prostrate and draw near.',
      context: 'The illustration uses an open book and a path of light as symbolic elements.',
      scene: 'nearness'
    }
  };
  var caveStoryScenes = [
    {
      id: 'refuge',
      firstVerse: 9,
      lastVerse: 10,
      label: 'Scene 1 · Seeking refuge',
      summary: 'The young people retreat to the cave and ask their Lord for mercy and guidance.'
    },
    {
      id: 'faith',
      firstVerse: 11,
      lastVerse: 16,
      label: 'Scene 2 · Steadfast faith',
      summary: 'The passage describes their sleep, their faith, and their decision to withdraw from their people.'
    },
    {
      id: 'awakening',
      firstVerse: 17,
      lastVerse: 20,
      label: 'Scene 3 · Sleep and awakening',
      summary: 'The sunlight passes the cave; the young people awaken and send one of their number to the city.'
    },
    {
      id: 'lesson',
      firstVerse: 21,
      lastVerse: 26,
      label: 'Scene 4 · The lesson',
      summary: 'Their case becomes known. The passage warns against speculation and says Allah knows their time and the unseen.'
    }
  ];

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Quran service returned ' + response.status + '.');
      return response.json();
    });
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function chapterById(id) {
    for (var index = 0; index < chapters.length; index++) {
      if (chapters[index].id === id) return chapters[index];
    }
    return null;
  }

  function initializeReader() {
    if (isInitializing) return;
    if (chapters.length) {
      if (!chapterId) loadChapter(Number(surahSelect.value) || 1, false);
      return;
    }
    isInitializing = true;
    setStatus('Loading surahs…');
    fetchJson(API_BASE + '/chapters?language=en').then(function (data) {
      if (!data.chapters || !data.chapters.length) throw new Error('The Quran chapter list was empty.');
      chapters = data.chapters;
      surahSelect.textContent = '';
      chapters.forEach(function (chapter) {
        var option = document.createElement('option');
        option.value = String(chapter.id);
        option.textContent = chapter.id + '. ' + chapter.name_simple + ' (' + chapter.name_arabic + ') — ' + chapter.translated_name.name;
        surahSelect.appendChild(option);
      });
      surahSelect.disabled = false;
      surahSelect.value = '1';
      return loadChapter(1, false);
    }).catch(function (error) {
      setStatus('Could not load the Quran. Check your internet connection and try again.');
      console.error('Could not load Quran chapters.', error);
    }).then(function () {
      isInitializing = false;
    });
  }

  function versePageUrl(id, page) {
    var params = new URLSearchParams({
      language: 'en',
      words: 'true',
      word_fields: 'text_uthmani',
      translations: String(TRANSLATION_ID),
      audio: String(RECITER_ID),
      per_page: '300',
      page: String(page)
    });
    return API_BASE + '/verses/by_chapter/' + id + '?' + params.toString();
  }

  function cleanTranslation(value) {
    return String(value || '')
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createStoryVisual(variant, scene) {
    var visual = document.createElement('div');
    visual.className = 'quran-story-visual quran-story-visual--' + variant;
    visual.setAttribute('data-scene', scene);
    visual.setAttribute('aria-hidden', 'true');
    [
      'quran-story-orbit',
      'quran-story-sun',
      'quran-story-horizon',
      'quran-story-arch',
      'quran-story-book',
      'quran-story-mountains',
      'quran-story-cave',
      'quran-story-water',
      'quran-story-path',
      'quran-story-rain',
      'quran-story-stars',
      'quran-story-flame',
      'quran-story-garden'
    ].forEach(function (className) {
      var shape = document.createElement('span');
      shape.className = className;
      visual.appendChild(shape);
    });
    return visual;
  }

  function getVerseStory(verse) {
    var sajdahStory = sajdahStories[verse.verse_key];
    if (sajdahStory) return sajdahStory;
    var reflection = cleanTranslation(verse.translations && verse.translations[0] && verse.translations[0].text) ||
      'English translation unavailable.';
    var normalized = reflection.toLowerCase();
    var scene = 'nearness';
    if (/\b(cave|youths?|companions of the cave|retreated|awaken(?:ed|ing)?)\b/.test(normalized)) {
      scene = 'cave';
    } else if (/\b(seek refuge|refuge|protector|protect(?:ed|ing)?)\b/.test(normalized)) {
      scene = 'refuge';
    } else if (/\b(jinn|mankind|humankind|humanity|people)\b/.test(normalized)) {
      scene = 'humanity';
    } else if (/\b(fire|hell|flames?|burn(?:ed|ing)?|blaze)\b/.test(normalized)) {
      scene = 'fire';
    } else if (/\b(garden|paradise|fruit|shade|orchard)\b/.test(normalized)) {
      scene = 'garden';
    } else if (/\b(rain|water|sea|river|flood|ocean|springs?|clouds?)\b/.test(normalized)) {
      scene = 'water';
    } else if (/\b(travel|journey|caravan|ships?|road|cross(?:ed|ing)?)\b/.test(normalized)) {
      scene = 'journey';
    } else if (/\b(resurrection|judgment|recompense|hereafter|the unseen|return to your lord)\b/.test(normalized)) {
      scene = 'afterlife';
    } else if (/\b(sun|moon|stars?|heavens?|earth|mountains?|trees?)\b/.test(normalized)) {
      scene = 'creation';
    } else if (/\b(night|day|dawn|morning|evening|light|darkness)\b/.test(normalized)) {
      scene = 'night';
    } else if (/\b(qur.?an|recit|book|scripture|revelation)\b/.test(normalized)) {
      scene = 'recitation';
    } else if (/\b(forgiv\w*|repent\w*)\b/.test(normalized)) {
      scene = 'repentance';
    } else if (/\b(mercy|merciful|compassion)\b/.test(normalized)) {
      scene = 'mercy';
    } else if (/\b(prostrate|worship|prayer|praise|bow)\b/.test(normalized)) {
      scene = 'worship';
    } else if (/\b(guid\w*|path)\b/.test(normalized)) {
      scene = 'guidance';
    } else if (/\b(warn\w*|punish\w*|reject\w*|destruction|severe|evil|whisper\w*)\b/.test(normalized)) {
      scene = 'warning';
    }
    var titles = {
      cave: 'Seeking refuge',
      refuge: 'Seeking protection',
      humanity: 'Humanity and the unseen',
      fire: 'A warning and its consequence',
      garden: 'Garden imagery',
      water: 'Water and renewal',
      journey: 'A journey through the land',
      creation: 'Signs in creation',
      night: 'Night and light',
      recitation: 'Revelation and recitation',
      repentance: 'Mercy and return',
      mercy: 'Mercy and compassion',
      worship: 'Worship and humility',
      guidance: 'The path of guidance',
      afterlife: 'The unseen and the Hereafter',
      warning: 'A reminder and warning',
      nearness: 'Ayah story'
    };
    return {
      title: titles[scene] || 'Ayah story',
      reflection: reflection,
      context: 'A symbolic 2D scene based only on this ayah’s translation; it is not tafsir.',
      scene: scene
    };
  }

  function setAnimationTriggers(article, expanded) {
    Array.prototype.forEach.call(article.querySelectorAll('.quran-animation-trigger'), function (trigger) {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function createVerseAnimationPanel(article, verse, focusTrigger) {
    var story = getVerseStory(verse);
    var panel = document.createElement('section');
    panel.className = 'quran-verse-animation-panel';
    panel.setAttribute('aria-label', 'Ayah story animation');
    panel.lang = 'en';
    panel.dir = 'ltr';

    var header = document.createElement('div');
    header.className = 'quran-story-header';
    var heading = document.createElement('h3');
    heading.textContent = story.title + ' · ' + verse.verse_key;
    header.appendChild(heading);
    var closeButton = document.createElement('button');
    closeButton.className = 'btn ghost quran-story-close';
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.setAttribute('aria-label', 'Close ayah animation');
    closeButton.addEventListener('click', function () {
      panel.parentNode.removeChild(panel);
      setAnimationTriggers(article, false);
      focusTrigger.focus();
    });
    header.appendChild(closeButton);
    panel.appendChild(header);

    var scene = document.createElement('div');
    scene.className = 'quran-story-frame';
    scene.appendChild(createStoryVisual('illustrated', story.scene));
    panel.appendChild(scene);

    var subtitle = document.createElement('p');
    subtitle.className = 'quran-story-subtitle';
    subtitle.lang = 'en';
    subtitle.textContent = story.reflection;
    panel.appendChild(subtitle);

    var note = document.createElement('p');
    note.className = 'quran-story-note';
    note.textContent = 'Symbolic visuals only: no prophets, people, angels, or depiction of Allah. The scene follows the translation and does not replace scholarly tafsir.';
    panel.appendChild(note);
    if (story.source) {
      var source = document.createElement('p');
      source.className = 'quran-story-source';
      source.textContent = story.source;
      panel.appendChild(source);
    }
    return panel;
  }

  function toggleVerseAnimation(article, verse, trigger) {
    var openPanel = article.querySelector('.quran-verse-animation-panel');
    if (openPanel) {
      article.removeChild(openPanel);
      setAnimationTriggers(article, false);
      return;
    }
    Array.prototype.forEach.call(versesElement.querySelectorAll('.quran-verse-animation-panel'), function (panel) {
      var owner = panel.parentNode;
      if (!owner) return;
      owner.removeChild(panel);
      setAnimationTriggers(owner, false);
    });
    var panel = createVerseAnimationPanel(article, verse, trigger);
    article.appendChild(panel);
    setAnimationTriggers(article, true);
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function hidePlaybackStory() {
    if (!storyStage) return;
    storyStage.hidden = true;
    storyStage.setAttribute('aria-hidden', 'true');
    storyStage.textContent = '';
    storyStage.removeAttribute('data-mode');
    storyStage.removeAttribute('data-scene');
    playbackStoryVerseId = null;
  }

  function updatePlaybackStory(verse) {
    if (!storyStage || !isPlaying || !verse) {
      hidePlaybackStory();
      return;
    }
    if (storyPlaybackMode === 'cave') {
      updateCaveStoryScene(verse);
      renderCavePlaybackStage(verse);
      return;
    }
    if (playbackStoryVerseId === verse.id) return;
    playbackStoryVerseId = verse.id;
    var story = getVerseStory(verse);
    storyStage.textContent = '';
    storyStage.setAttribute('data-mode', 'verse');
    storyStage.setAttribute('data-scene', story.scene);

    var copy = document.createElement('div');
    copy.className = 'quran-story-stage-copy';
    var heading = document.createElement('h3');
    heading.textContent = 'Now animating · ' + verse.verse_key;
    copy.appendChild(heading);
    var reflection = document.createElement('p');
    reflection.textContent = story.reflection;
    copy.appendChild(reflection);
    storyStage.appendChild(copy);

    var visual = createStoryVisual('illustrated', story.scene);
    visual.classList.add('quran-story-stage-animation');
    storyStage.appendChild(visual);
    storyStage.hidden = false;
    storyStage.setAttribute('aria-hidden', 'false');
  }

  function getCaveSceneForVerse(verse) {
    var scene = caveStoryScenes[0];
    for (var index = 0; index < caveStoryScenes.length; index++) {
      if (verse.verse_number >= caveStoryScenes[index].firstVerse &&
          verse.verse_number <= caveStoryScenes[index].lastVerse) {
        scene = caveStoryScenes[index];
        break;
      }
    }
    return scene;
  }

  function updateCaveStoryScene(verse) {
    if (!caveSceneElement || !verse || chapterId !== 18) return;
    var scene = getCaveSceneForVerse(verse);
    caveSceneElement.setAttribute('data-scene', scene.id);
    caveSceneLabel.textContent = scene.label + ' · Al-Kahf ' + verse.verse_key;
    caveSceneSummary.textContent = scene.summary;
    caveArabicCaption.textContent = (verse.words || []).filter(function (word) {
      return word.char_type_name === 'word';
    }).map(function (word) {
      return word.text_uthmani || word.text || '';
    }).join(' ');
    caveTranslationCaption.textContent = cleanTranslation(verse.translations && verse.translations[0] && verse.translations[0].text) ||
      'English translation unavailable.';
    Array.prototype.forEach.call(document.querySelectorAll('.quran-cave-progress [data-cave-scene]'), function (step) {
      step.classList.toggle('is-active', step.getAttribute('data-cave-scene') === scene.id);
    });
  }

  function renderCavePlaybackStage(verse) {
    if (!storyStage || !caveSceneElement) return;
    var scene = getCaveSceneForVerse(verse);
    storyStage.textContent = '';
    storyStage.setAttribute('data-mode', 'cave');
    storyStage.setAttribute('data-scene', scene.id);

    var artwork = caveSceneElement.querySelector('.quran-cave-art').cloneNode(true);
    artwork.setAttribute('aria-hidden', 'true');
    storyStage.appendChild(artwork);

    var caption = document.createElement('div');
    caption.className = 'quran-cave-playback-caption';
    var heading = document.createElement('h3');
    heading.textContent = scene.label + ' · Al-Kahf ' + verse.verse_key;
    caption.appendChild(heading);
    var translation = document.createElement('p');
    translation.textContent = cleanTranslation(verse.translations && verse.translations[0] && verse.translations[0].text) ||
      'English translation unavailable.';
    caption.appendChild(translation);
    storyStage.appendChild(caption);
    storyStage.hidden = false;
    storyStage.setAttribute('aria-hidden', 'false');
    playbackStoryVerseId = verse.id;
  }

  function updateCaveStoryButtons() {
    if (!caveStoryPlayButton || !caveStoryPauseButton) return;
    var storyIsPlaying = isPlaying && storyPlaybackMode === 'cave';
    caveStoryPlayButton.disabled = !chapterId || isLoadingChapter || isLoadingCaveStory || storyIsPlaying;
    caveStoryPauseButton.disabled = !storyIsPlaying;
  }

  function startCaveStoryPlayback() {
    var startIndex = -1;
    var endIndex = -1;
    for (var index = 0; index < verses.length; index++) {
      if (verses[index].verse_number === 9) startIndex = index;
      if (verses[index].verse_number === 26) endIndex = index;
    }
    if (startIndex < 0 || endIndex < startIndex) {
      storyPlaybackMode = null;
      storyEndIndex = -1;
      caveStoryStatus.textContent = 'Could not find Al-Kahf 18:9–26 in the loaded chapter.';
      console.error('Could not start the Cave story: the required ayah range is missing.');
      updatePlaybackButtons();
      return;
    }
    storyPlaybackMode = 'cave';
    storyEndIndex = endIndex;
    isPlaying = true;
    updatePlaybackButtons();
    updateCaveStoryScene(verses[startIndex]);
    updatePlaybackStory(verses[startIndex]);
    caveStoryStatus.textContent = 'Playing the recitation for Al-Kahf 18:9–26.';
    setStatus('Playing the Companions of the Cave story with Quran recitation.');
    playVerse(startIndex);
  }

  function playCaveStory() {
    if (isLoadingCaveStory || (isPlaying && storyPlaybackMode === 'cave')) return;
    if (!isPlaying && storyPlaybackMode === 'cave' && verseIndex >= 0 &&
        verseIndex <= storyEndIndex && quranAudio.src && !quranAudio.ended) {
      isPlaying = true;
      updatePlaybackButtons();
      updatePlaybackStory(verses[verseIndex]);
      caveStoryStatus.textContent = 'Playing the recitation for Al-Kahf 18:9–26.';
      setStatus('Playing the Companions of the Cave story with Quran recitation.');
      quranAudio.play().catch(function (error) {
        if (isPlaying) showPlaybackError(error);
      });
      return;
    }
    if (isPlaying) {
      isPlaying = false;
      quranAudio.pause();
    }
    storyPlaybackMode = null;
    storyEndIndex = -1;
    hidePlaybackStory();
    updatePlaybackButtons();
    if (chapterId === 18 && verses.length) {
      startCaveStoryPlayback();
      return;
    }
    surahSelect.value = '18';
    isLoadingCaveStory = true;
    var requestToken = ++caveStoryLoadToken;
    caveStoryStatus.textContent = 'Loading Al-Kahf recitation…';
    setStatus('Loading Surah Al-Kahf for the story animation…');
    updateCaveStoryButtons();
    loadChapter(18, false).then(function (loaded) {
      if (requestToken !== caveStoryLoadToken) return;
      isLoadingCaveStory = false;
      if (loaded) {
        startCaveStoryPlayback();
      } else {
        caveStoryStatus.textContent = 'Could not load the story recitation. Check your connection and try again.';
        updateCaveStoryButtons();
      }
    });
  }

  function pauseRecitation() {
    if (!isPlaying) return;
    isPlaying = false;
    quranAudio.pause();
    hidePlaybackStory();
    updatePlaybackButtons();
    if (storyPlaybackMode === 'cave') {
      caveStoryStatus.textContent = 'Paused at Al-Kahf ' + (verses[verseIndex] ? verses[verseIndex].verse_key : '18:9–26') + '.';
      setStatus('Cave story paused.');
    } else {
      setStatus('Recitation paused.');
    }
  }

  function renderVerses() {
    var fragment = document.createDocumentFragment();
    verses.forEach(function (verse) {
      var article = document.createElement('article');
      article.className = 'quran-verse';
      article.id = 'quran-verse-' + verse.id;

      var arabic = document.createElement('p');
      arabic.className = 'quran-arabic';
      (verse.words || []).forEach(function (word) {
        if (word.char_type_name !== 'word') return;
        var wordElement = document.createElement('span');
        wordElement.className = 'quran-word';
        wordElement.setAttribute('data-word-position', String(word.position));
        wordElement.textContent = word.text_uthmani || word.text || '';
        arabic.appendChild(wordElement);
        arabic.appendChild(document.createTextNode(' '));
      });
      var number = document.createElement('span');
      number.className = 'quran-ayah-number';
      number.textContent = String(verse.verse_number);
      arabic.appendChild(number);
      if (verse.sajdah_number) {
        var sajdahMarker = document.createElement('button');
        sajdahMarker.className = 'quran-sajdah-marker quran-animation-trigger';
        sajdahMarker.type = 'button';
        sajdahMarker.setAttribute('aria-label', 'Show animated reflection for Sajdah verse ' + verse.verse_key);
        sajdahMarker.setAttribute('aria-expanded', 'false');
        sajdahMarker.title = 'Sajdah verse';
        sajdahMarker.textContent = '\u06E9';
        sajdahMarker.addEventListener('click', function () {
          toggleVerseAnimation(article, verse, sajdahMarker);
        });
        arabic.appendChild(sajdahMarker);
      }
      article.appendChild(arabic);

      var translation = document.createElement('p');
      translation.className = 'quran-translation';
      translation.lang = 'en';
      translation.textContent = cleanTranslation(verse.translations && verse.translations[0] && verse.translations[0].text) ||
        'English translation unavailable.';
      article.appendChild(translation);
      var animationButton = document.createElement('button');
      animationButton.className = 'btn ghost quran-verse-animation-trigger quran-animation-trigger';
      animationButton.type = 'button';
      animationButton.textContent = 'Animate this ayah';
      animationButton.setAttribute('aria-label', 'Show animation for ayah ' + verse.verse_key);
      animationButton.setAttribute('aria-expanded', 'false');
      animationButton.addEventListener('click', function () {
        toggleVerseAnimation(article, verse, animationButton);
      });
      article.appendChild(animationButton);
      fragment.appendChild(article);
    });
    versesElement.textContent = '';
    versesElement.appendChild(fragment);
    activeVerseElement = null;
    activeWordElement = null;
  }

  function loadChapter(id, continuePlayback) {
    var requestToken = ++loadToken;
    isLoadingChapter = true;
    updateCaveStoryButtons();
    if (!continuePlayback) {
      isPlaying = false;
      storyPlaybackMode = null;
      storyEndIndex = -1;
      quranAudio.pause();
      verseIndex = -1;
      hidePlaybackStory();
    }
    playButton.disabled = true;
    pauseButton.disabled = true;
    setStatus('Loading Arabic text, translation, and recitation…');
    versesElement.textContent = '';

    return fetchJson(versePageUrl(id, 1)).then(function (firstPage) {
      var allVerses = firstPage.verses || [];
      var totalPages = Math.max(1, Number(firstPage.pagination && firstPage.pagination.total_pages) || 1);
      var pageRequests = [];
      for (var page = 2; page <= totalPages; page++) {
        pageRequests.push(fetchJson(versePageUrl(id, page)).then(function (data) {
          return data.verses || [];
        }));
      }
      return Promise.all(pageRequests).then(function (remainingPages) {
        remainingPages.forEach(function (pageVerses) {
          allVerses = allVerses.concat(pageVerses);
        });
        return allVerses;
      });
    }).then(function (chapterVerses) {
      if (requestToken !== loadToken) return false;
      if (!chapterVerses.length) throw new Error('No verses were returned for this surah.');
      isLoadingChapter = false;
      chapterId = id;
      verseIndex = -1;
      verses = chapterVerses.sort(function (a, b) { return a.verse_number - b.verse_number; });
      renderVerses();
      updatePlaybackButtons();
      var chapter = chapterById(id);
      setStatus(chapter.name_simple + ' loaded — ' + verses.length + ' verses. Press Play Quran to begin.');
      return true;
    }).catch(function (error) {
      if (requestToken === loadToken) {
        isLoadingChapter = false;
        isPlaying = false;
        hidePlaybackStory();
        updatePlaybackButtons();
        setStatus('Could not load this surah. Check your internet connection and try again.');
        console.error('Could not load Quran chapter ' + id + '.', error);
      }
      return false;
    });
  }

  function setActiveVerse(verse, wordPosition) {
    var article = document.getElementById('quran-verse-' + verse.id);
    if (!article) return;
    if (activeVerseElement !== article) {
      if (activeVerseElement) activeVerseElement.classList.remove('is-active');
      article.classList.add('is-active');
      activeVerseElement = article;
      if (isPlaying) updatePlaybackStory(verse);
    }
    var wordElement = wordPosition == null
      ? null
      : article.querySelector('[data-word-position="' + wordPosition + '"]');
    if (wordElement !== activeWordElement) {
      if (activeWordElement) activeWordElement.classList.remove('is-active');
      if (wordElement) wordElement.classList.add('is-active');
      activeWordElement = wordElement;
      if (wordElement && isPlaying) {
        var bounds = wordElement.getBoundingClientRect();
        var controls = document.querySelector('.quran-controls');
        var visibleTop = controls ? controls.getBoundingClientRect().bottom + 8 : 0;
        if (bounds.top < visibleTop || bounds.bottom > window.innerHeight) {
          wordElement.scrollIntoView({ block: 'center' });
        }
      }
    }
  }

  function highlightCurrentWord() {
    var verse = verses[verseIndex];
    if (!verse) return;
    var segments = verse.audio && verse.audio.segments || [];
    var position = null;
    var timeMs = quranAudio.currentTime * 1000;
    for (var index = 0; index < segments.length; index++) {
      var segment = segments[index];
      if (segment.length >= 4 && timeMs >= segment[2] && timeMs <= segment[3]) {
        position = segment[1];
        break;
      }
    }
    setActiveVerse(verse, position);
  }

  function updatePlaybackButtons() {
    playButton.disabled = !verses.length || isPlaying;
    pauseButton.disabled = !verses.length || !isPlaying;
    updateCaveStoryButtons();
  }

  function showPlaybackError(error) {
    isPlaying = false;
    hidePlaybackStory();
    updatePlaybackButtons();
    setStatus('Recitation could not play. Check your connection, then press Play Quran to retry.');
    console.error('Quran recitation playback failed.', error);
  }

  function playVerse(index) {
    if (!isPlaying) return;
    var verse = verses[index];
    if (!verse || !verse.audio || !verse.audio.url) {
      showPlaybackError(new Error('Audio is unavailable for verse ' + (verse ? verse.verse_key : '')));
      return;
    }
    verseIndex = index;
    var firstSegment = verse.audio.segments && verse.audio.segments[0];
    setActiveVerse(verse, firstSegment && firstSegment.length >= 4 ? firstSegment[1] : null);
    quranAudio.src = new URL(verse.audio.url, AUDIO_BASE).href;
    quranAudio.load();
    var playRequest;
    try {
      playRequest = quranAudio.play();
    } catch (error) {
      showPlaybackError(error);
      return;
    }
    if (playRequest && typeof playRequest.catch === 'function') {
      playRequest.catch(function (error) {
        if (isPlaying) showPlaybackError(error);
      });
    }
  }

  function playNextVerse() {
    if (!isPlaying) return;
    if (storyPlaybackMode === 'cave' && verseIndex >= storyEndIndex) {
      isPlaying = false;
      storyPlaybackMode = null;
      storyEndIndex = -1;
      hidePlaybackStory();
      updatePlaybackButtons();
      caveStoryStatus.textContent = 'Story complete. Play story to listen again.';
      setStatus('The Companions of the Cave story recitation has finished.');
      return;
    }
    if (verseIndex + 1 < verses.length) {
      playVerse(verseIndex + 1);
      return;
    }
    if (chapterId >= chapters.length) {
      isPlaying = false;
      verseIndex = -1;
      hidePlaybackStory();
      updatePlaybackButtons();
      setStatus('The complete Quran recitation has finished.');
      return;
    }
    var nextChapterId = chapterId + 1;
    surahSelect.value = String(nextChapterId);
    loadChapter(nextChapterId, true).then(function (loaded) {
      if (loaded && isPlaying) playVerse(0);
    });
  }

  surahSelect.addEventListener('change', function () {
    if (surahSelect.value) {
      caveStoryLoadToken++;
      isLoadingCaveStory = false;
      loadChapter(Number(surahSelect.value), false);
      updateCaveStoryButtons();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tool-nav-button, .service-card'), function (button) {
    button.addEventListener('click', function () {
      if (button.getAttribute('data-tab') === 'quran') {
        initializeReader();
      } else {
        caveStoryLoadToken++;
        if (isLoadingCaveStory) {
          loadToken++;
          isLoadingChapter = false;
        }
        isLoadingCaveStory = false;
        if (isPlaying) pauseRecitation();
        storyPlaybackMode = null;
        storyEndIndex = -1;
        updatePlaybackButtons();
      }
    });
  });

  playButton.addEventListener('click', function () {
    if (!verses.length || isPlaying) return;
    if (storyPlaybackMode === 'cave') {
      playCaveStory();
      return;
    }
    isPlaying = true;
    updatePlaybackButtons();
    if (verseIndex >= 0 && !quranAudio.ended && quranAudio.src) {
      updatePlaybackStory(verses[verseIndex]);
      quranAudio.play().catch(function (error) {
        if (isPlaying) showPlaybackError(error);
      });
    } else {
      playVerse(0);
    }
  });
  pauseButton.addEventListener('click', function () {
    pauseRecitation();
  });
  caveStoryPlayButton.addEventListener('click', playCaveStory);
  caveStoryPauseButton.addEventListener('click', pauseRecitation);

  quranAudio.addEventListener('timeupdate', highlightCurrentWord);
  quranAudio.addEventListener('playing', function () {
    var verse = verses[verseIndex];
    var chapter = chapterById(chapterId);
    if (verse && chapter) setStatus('Playing ' + chapter.name_simple + ', verse ' + verse.verse_number + ' of ' + verses.length + '.');
  });
  quranAudio.addEventListener('ended', playNextVerse);
  quranAudio.addEventListener('error', function () {
    if (isPlaying) showPlaybackError(quranAudio.error || new Error('Audio request failed.'));
  });
}());
