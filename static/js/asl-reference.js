/* ─── ASL Alphabet Reference Guide ─── */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('asl-reference');
  if (!section || typeof HAND_POSES === 'undefined') return;

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const FAV_KEY = 'asl_ref_favs';
  const LEARN_KEY = 'asl_ref_learned';

  let favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  let learned = JSON.parse(localStorage.getItem(LEARN_KEY) || '[]');
  let recentlyViewed = [];
  let activeFilter = 'all';
  let searchQuery = '';

  let quizActive = false;
  let quizScore = 0;
  let quizTotal = 0;

  const descriptions = {
    A: 'Fist with thumb resting on the side of the index finger. A compact, closed hand shape.',
    B: 'All four fingers extended upright together, thumb folded across the palm. Open hand.',
    C: 'Hand curved into a C-shape, fingers slightly spread. Resembles holding a cup.',
    D: 'Index finger pointing up, thumb resting on middle finger knuckle, other fingers curled.',
    E: 'All fingers curled downward, thumb pressed against the fingertips. Closed fist variant.',
    F: 'Thumb and index finger form a circle, other three fingers extended upward.',
    G: 'Index finger pointing forward, thumb parallel beside it, other fingers curled into palm.',
    H: 'Index and middle fingers extended together sideways, thumb resting on curled ring/pinky.',
    I: 'Pinky finger extended upward, all other fingers curled into a fist, thumb over them.',
    J: 'Pinky traces a J shape — start like I, then curve downward in a hook motion.',
    K: 'Index and middle fingers up, thumb placed between them, ring and pinky curled.',
    L: 'Index finger up, thumb out at 90°, forming an L shape. Other fingers curled.',
    M: 'All fingers curled, thumb tucked over the top of the curled fingers.',
    N: 'Similar to M but thumb rests between the middle and ring fingers.',
    O: 'All fingertips touch together forming an O shape. Hand curves inward.',
    P: 'Index finger forward, thumb pointing down, middle finger extended forward slightly.',
    Q: 'Index and thumb point downward, hand angled. Like G but pointing down.',
    R: 'Index and middle fingers crossed over each other, other fingers curled into palm.',
    S: 'Fist with thumb wrapped over the curled fingers. Rounded fist shape.',
    T: 'Thumb inserted between the curled index and middle fingers, rest in fist.',
    U: 'Index and middle fingers extended together upward, thumb resting on ring finger.',
    V: 'Index and middle fingers spread apart in a V shape (peace sign), other fingers curled.',
    W: 'Three fingers (index, middle, ring) spread apart, thumb and pinky curled.',
    X: 'Index finger bent into a hook shape, other fingers curled into a fist.',
    Y: 'Thumb and pinky extended outward, other fingers curled. "Phone me" gesture.',
    Z: 'Index finger traces a Z shape in the air. Start horizontal, diagonal down, horizontal.'
  };

  const tips = {
    A: 'Keep your thumb firmly against the side of your index finger. Practice making a tight fist.',
    B: 'Keep fingers pressed together and straight. Thumb should be tucked firmly across the palm.',
    C: 'Keep a relaxed curve — imagine holding a small ball. Don\'t collapse the fingers.',
    D: 'Index finger should be straight and tall. Rest thumb on the middle finger knuckle firmly.',
    E: 'Fingertips should touch the base of the thumb. Keep the fist compact.',
    F: 'Pinch thumb and index fingertip firmly. Keep the other three fingers straight and together.',
    G: 'Keep palm facing sideways. Index finger points forward, thumb runs parallel beside it.',
    H: 'Keep two extended fingers together. Palm should face forward with fingers horizontal.',
    I: 'Pinky must be straight up. Secure the other fingers with your thumb on top.',
    J: 'Start with pinky up, then trace a smooth downward curve. Fluid motion is key.',
    K: 'Keep index and middle straight. Thumb should clearly rest between them, not to the side.',
    L: 'The classic L shape. Make sure index and thumb form a perfect 90° angle.',
    M: 'Fold all fingers over the thumb. The knuckles should be visible at the top.',
    N: 'Focus on the thumb placement — it goes between middle and ring fingers.',
    O: 'All fingertips should meet precisely. Round the hand like holding a small tube.',
    P: 'Hand points downward. Index finger extends, thumb points down, middle finger bends.',
    Q: 'Like a downward G. Point index and thumb toward the ground with the hand angled.',
    R: 'Cross index over middle finger. Others should be securely curled into the palm.',
    S: 'Make a smooth fist with the thumb wrapped across the curled fingers for a round shape.',
    T: 'Slide the thumb between the index and middle fingers. Hide the other fingers.',
    U: 'Keep index and middle pressed tightly together. Others curled securely.',
    V: 'The classic peace sign. Keep a clear V gap between index and middle fingers.',
    W: 'Three fingers should be visibly spread. Keep thumb and pinky curled away.',
    X: 'Bend only the index finger at the middle joint. Keep the rest in a firm fist.',
    Y: 'Extend thumb and pinky wide. Keep the middle three fingers pressed down firmly.',
    Z: 'Visualize the letter Z. Trace the path: across, diagonal down, across. Smooth motion.'
  };

  const difficulty = {
    A: 'easy', B: 'easy', C: 'easy', D: 'easy', E: 'medium',
    F: 'medium', G: 'medium', H: 'medium', I: 'easy', J: 'hard',
    K: 'medium', L: 'easy', M: 'hard', N: 'hard', O: 'easy',
    P: 'hard', Q: 'hard', R: 'medium', S: 'easy', T: 'hard',
    U: 'easy', V: 'easy', W: 'medium', X: 'medium', Y: 'easy', Z: 'hard'
  };

  const GRID = document.getElementById('asl-grid');
  const SEARCH = document.getElementById('asl-search');
  const FILTERS = document.getElementById('asl-filters');
  const RECENT = document.getElementById('asl-recent');
  const MODAL = document.getElementById('asl-modal');
  const QUIZ_OVERLAY = document.getElementById('asl-quiz');
  const STAT_FAVS = document.getElementById('asl-stat-favs');
  const STAT_LEARNED = document.getElementById('asl-stat-learned');

  function getFilterGroup(letter) {
    const i = LETTERS.indexOf(letter);
    if (i <= 5) return 'a-f';
    if (i <= 11) return 'g-l';
    if (i <= 17) return 'm-r';
    return 's-z';
  }

  function getFiltered() {
    return LETTERS.filter(l => {
      if (activeFilter !== 'all' && getFilterGroup(l) !== activeFilter) return false;
      if (searchQuery && !l.toLowerCase().includes(searchQuery)) return false;
      return true;
    });
  }

  function render() {
    const items = getFiltered();
    GRID.innerHTML = items.map(l => {
      const isFav = favorites.includes(l);
      const isLearned = learned.includes(l);
      const diff = difficulty[l] || 'medium';
      return `<div class="asl-card${isFav ? ' favorited' : ''}${isLearned ? ' learned' : ''}" data-letter="${l}" data-diff="${diff}" title="${descriptions[l]}">
        <div class="asl-card-visual"><img src="reference/asl_${l.toLowerCase()}.png" alt="${l}" class="asl-card-img" loading="lazy"><span class="asl-card-letter-badge">${l}</span>
          <button class="asl-card-fav" data-letter="${l}"><i class="fa${isFav ? 's' : 'r'} fa-star"></i></button>
        </div>
        <div class="asl-card-body">
          <div class="asl-card-letter">${l}</div>
          <div class="asl-card-name">Letter ${l}</div>
          <div class="asl-card-progress"><span class="asl-card-progress-dot ${isLearned ? 'learned' : (recentlyViewed.includes(l) ? 'practicing' : 'new')}"></span></div>
        </div>
      </div>`;
    }).join('');

    document.querySelectorAll('.asl-card-fav').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleFav(btn.dataset.letter);
      });
    });

    document.querySelectorAll('.asl-card').forEach(card => {
      card.addEventListener('click', () => openModal(card.dataset.letter));
    });

    updateStats();
  }

  function updateStats() {
    if (STAT_FAVS) STAT_FAVS.textContent = favorites.length;
    if (STAT_LEARNED) STAT_LEARNED.textContent = learned.length;
  }

  function toggleFav(letter) {
    const idx = favorites.indexOf(letter);
    if (idx > -1) favorites.splice(idx, 1);
    else favorites.push(letter);
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    render();
  }

  function markLearned(letter) {
    if (!learned.includes(letter)) {
      learned.push(letter);
      localStorage.setItem(LEARN_KEY, JSON.stringify(learned));
      updateStats();
    }
  }

  function addRecent(letter) {
    recentlyViewed = recentlyViewed.filter(r => r !== letter);
    recentlyViewed.unshift(letter);
    if (recentlyViewed.length > 6) recentlyViewed.pop();
    renderRecent();
    render();
  }

  function renderRecent() {
    if (!RECENT) return;
    if (!recentlyViewed.length) {
      RECENT.innerHTML = '';
      return;
    }
    RECENT.innerHTML = `<span class="asl-recent-label"><i class="fas fa-history"></i> Recent:</span>
      ${recentlyViewed.map(r => `<span class="asl-recent-chip" data-letter="${r}">${r} <i class="fas fa-times" style="font-size:0.6rem;opacity:0.6;"></i></span>`).join('')}`;
    RECENT.querySelectorAll('.asl-recent-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        if (e.target.closest('.fa-times')) return;
        openModal(chip.dataset.letter);
      });
    });
  }

  /* ─── Search ─── */
  if (SEARCH) {
    SEARCH.addEventListener('input', () => {
      searchQuery = SEARCH.value.toLowerCase().trim();
      render();
    });
  }

  /* ─── Filters ─── */
  if (FILTERS) {
    FILTERS.addEventListener('click', e => {
      const btn = e.target.closest('.asl-filter-btn');
      if (!btn) return;
      FILTERS.querySelectorAll('.asl-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  }

  /* ─── Random Practice ─── */
  const randomBtn = document.getElementById('asl-random');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      const unlearned = LETTERS.filter(l => !learned.includes(l));
      const pool = unlearned.length ? unlearned : LETTERS;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      openModal(pick);
    });
  }

  /* ─── Quiz ─── */
  const quizBtn = document.getElementById('asl-quiz-btn');
  if (quizBtn) {
    quizBtn.addEventListener('click', startQuiz);
  }

  function startQuiz() {
    if (!QUIZ_OVERLAY) return;
    quizActive = true;
    quizScore = 0;
    quizTotal = 0;
    QUIZ_OVERLAY.classList.add('open');
    nextQuestion();
  }

  function nextQuestion() {
    if (!QUIZ_OVERLAY) return;
    const options = LETTERS.sort(() => Math.random() - 0.5).slice(0, 4);
    const answer = options[Math.floor(Math.random() * options.length)];
    const card = QUIZ_OVERLAY.querySelector('.asl-quiz-card');
    card.innerHTML = `
      <div style="margin-bottom:12px;"><img src="reference/asl_${answer.toLowerCase()}.png" alt="${answer}" style="width:80px;height:auto;border-radius:8px;"></div>
      <div class="asl-quiz-hint">Which letter is this?</div>
      <div class="asl-quiz-options" id="quiz-options">
        ${options.sort(() => Math.random() - 0.5).map(o => `<button class="asl-quiz-opt" data-letter="${o}">${o}</button>`).join('')}
      </div>
      ${quizTotal > 0 ? `<div class="asl-quiz-score">Score: <strong>${quizScore}</strong> / ${quizTotal}</div>` : ''}
      <button class="asl-quiz-close" id="quiz-exit">Exit Quiz</button>
    `;

    quizTotal++;

    card.querySelectorAll('.asl-quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const isCorrect = btn.dataset.letter === answer;
        if (isCorrect) quizScore++;
        card.querySelectorAll('.asl-quiz-opt').forEach(b => {
          b.disabled = true;
          if (b.dataset.letter === answer) b.classList.add('correct');
          else if (b === btn && !isCorrect) b.classList.add('wrong');
        });
        markLearned(answer);
        addRecent(answer);
        setTimeout(nextQuestion, 1200);
      });
    });

    card.querySelector('#quiz-exit').addEventListener('click', endQuiz);
  }

  function endQuiz() {
    if (!QUIZ_OVERLAY) return;
    quizActive = false;
    QUIZ_OVERLAY.classList.remove('open');
  }

  /* ─── Modal ─── */
  function openModal(letter) {
    if (!MODAL || !letter) return;
    addRecent(letter);
    markLearned(letter);

    MODAL.querySelector('.asl-modal-visual').innerHTML = `
      <span class="asl-modal-letter-badge">${letter}</span><img src="reference/asl_${letter.toLowerCase()}.png" alt="${letter}" class="asl-modal-img" loading="lazy">`;
    MODAL.querySelector('.asl-modal-letter-name').textContent = `Letter ${letter}`;
    MODAL.querySelector('.asl-modal-desc').textContent = descriptions[letter] || '';
    const p = HAND_POSES[letter];
    MODAL.querySelector('#modal-fingers').textContent = (p && p.txt) || descriptions[letter] || '';
    MODAL.querySelector('#modal-tip').textContent = tips[letter] || 'Practice the motion slowly and steadily.';

    const favBtn = MODAL.querySelector('#modal-fav-btn');
    const isFav = favorites.includes(letter);
    favBtn.innerHTML = `<i class="fa${isFav ? 's' : 'r'} fa-star"></i> ${isFav ? 'Favorited' : 'Favorite'}`;
    favBtn.onclick = () => { toggleFav(letter); openModal(letter); };

    MODAL.querySelector('#modal-practice-btn').onclick = () => {
      endQuiz();
      closeModal();
    };

    MODAL.classList.add('open');
  }

  function closeModal() {
    if (!MODAL) return;
    MODAL.classList.remove('open');
  }

  if (MODAL) {
    MODAL.querySelector('.asl-modal-close').addEventListener('click', closeModal);
    MODAL.addEventListener('click', e => { if (e.target === MODAL) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModal(); endQuiz(); }
    });
  }

  if (QUIZ_OVERLAY) {
    QUIZ_OVERLAY.addEventListener('click', e => { if (e.target === QUIZ_OVERLAY) endQuiz(); });
  }

  /* ─── Init ─── */
  render();
  renderRecent();
});
