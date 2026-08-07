/* ==========================================================================
   單字配對 Game Engine & Logic
   ========================================================================== */

// Card Definitions: 4 English words and 4 matching images
const CARD_DATA = [
    { id: 'apple', type: 'word', text: 'Apple', phonetic: '/ˈæpl/' },
    { id: 'apple', type: 'image', imgSrc: 'images/apple.jpg', caption: 'Apple 蘋果' },
    { id: 'cat', type: 'word', text: 'Cat', phonetic: '/kæt/' },
    { id: 'cat', type: 'image', imgSrc: 'images/cat.jpg', caption: 'Cat 貓咪' },
    { id: 'rocket', type: 'word', text: 'Rocket', phonetic: '/ˈrɑːkɪt/' },
    { id: 'rocket', type: 'image', imgSrc: 'images/rocket.jpg', caption: 'Rocket 火箭' },
    { id: 'guitar', type: 'word', text: 'Guitar', phonetic: '/ɡɪˈtɑːr/' },
    { id: 'guitar', type: 'image', imgSrc: 'images/guitar.jpg', caption: 'Guitar 吉他' }
];

// Game State
let cards = [];
let flippedCards = [];
let matchedCount = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('wordmatch_best_score') || '0', 10);
let isProcessing = false;

// Timer State
let timerInterval = null;
let startTime = null;
let elapsedMs = 0;
let isTimerRunning = false;

// Scoring & Combo State
let combo = 0;
let flipStartTime = null;

// Audio Config
let soundEnabled = true;
let audioCtx = null;

// DOM Elements
const landingScreen = document.getElementById('landing-screen');
const gameContainer = document.getElementById('game-container');
const qrContainer = document.getElementById('qr-container');
const startGameBtn = document.getElementById('start-game-btn');
const homeBtn = document.getElementById('home-btn');

const cardsGrid = document.getElementById('cards-grid');
const timerDisplay = document.getElementById('timer-display');
const scoreDisplay = document.getElementById('score-display');
const bestScoreDisplay = document.getElementById('best-score-display');
const comboBadge = document.getElementById('combo-badge');
const comboText = document.getElementById('combo-text');
const restartBtn = document.getElementById('restart-btn');
const soundBtn = document.getElementById('sound-btn');

// Modal Elements
const winModal = document.getElementById('win-modal');
const modalRestartBtn = document.getElementById('modal-restart-btn');
const finalTimeDisplay = document.getElementById('final-time');
const speedBonusDisplay = document.getElementById('speed-bonus');
const finalScoreDisplay = document.getElementById('final-score');
const starsContainer = document.getElementById('stars-container');

// Confetti Canvas
const confettiCanvas = document.getElementById('confetti-canvas');
let confettiCtx = confettiCanvas.getContext('2d');
let particles = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    bestScoreDisplay.textContent = bestScore;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Landing Screen Triggers: Enter Game on QR Code or Start Button Click
    if (qrContainer) {
        qrContainer.addEventListener('click', enterGameFromLanding);
    }
    if (startGameBtn) {
        startGameBtn.addEventListener('click', enterGameFromLanding);
    }
    if (homeBtn) {
        homeBtn.addEventListener('click', returnToLandingScreen);
    }

    // Controls Event Listeners
    restartBtn.addEventListener('click', () => {
        playSound('click');
        initGame();
    });

    modalRestartBtn.addEventListener('click', () => {
        playSound('click');
        winModal.classList.add('hidden');
        initGame();
    });

    soundBtn.addEventListener('click', toggleSound);
});

/* ==========================================================================
   Screen Navigation (Landing <-> Game)
   ========================================================================== */
function enterGameFromLanding() {
    playSound('click');
    landingScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    initGame();
}

function returnToLandingScreen() {
    playSound('click');
    stopTimer();
    gameContainer.classList.add('hidden');
    landingScreen.classList.remove('hidden');
}

/* ==========================================================================
   Game Initialization & Shuffling
   ========================================================================== */
function initGame() {
    // Reset State
    stopTimer();
    elapsedMs = 0;
    timerDisplay.textContent = '00:00.0';
    score = 0;
    matchedCount = 0;
    combo = 0;
    flippedCards = [];
    isProcessing = false;
    isTimerRunning = false;

    updateScoreDisplay();
    updateComboDisplay();

    // Fisher-Yates Shuffle
    cards = shuffleArray([...CARD_DATA]);

    // Render Cards Grid
    renderGrid();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderGrid() {
    cardsGrid.innerHTML = '';

    cards.forEach((card, index) => {
        const cardElem = document.createElement('div');
        cardElem.classList.add('card');
        cardElem.dataset.index = index;
        cardElem.dataset.id = card.id;
        cardElem.dataset.type = card.type;

        // Front Content HTML
        let frontHTML = '';
        if (card.type === 'word') {
            frontHTML = `
                <div class="card-word-wrapper">
                    <span class="word-main">${card.text}</span>
                    <span class="word-phonetic">${card.phonetic}</span>
                    <button class="speaker-btn" title="發音" onclick="event.stopPropagation(); speakWord('${card.text}')">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                </div>
            `;
        } else {
            frontHTML = `
                <div class="card-image-wrapper">
                    <img src="${card.imgSrc}" alt="${card.caption}" class="card-image" loading="lazy">
                    <span class="card-caption">${card.caption}</span>
                </div>
            `;
        }

        cardElem.innerHTML = `
            <div class="card-face card-back">
                <div class="card-pattern">
                    <i class="fa-solid fa-cat"></i>
                </div>
            </div>
            <div class="card-face card-front">
                ${frontHTML}
            </div>
        `;

        cardElem.addEventListener('click', () => handleCardClick(cardElem, card));
        cardsGrid.appendChild(cardElem);
    });
}

/* ==========================================================================
   Card Flip & Matching Core Logic
   ========================================================================== */
function handleCardClick(cardElem, card) {
    if (isProcessing) return;
    if (cardElem.classList.contains('flipped') || cardElem.classList.contains('matched')) return;

    // Start Stopwatch on first card click
    if (!isTimerRunning) {
        startTimer();
    }

    // Play Flip Sound & Speech if word card
    playSound('flip');
    if (card.type === 'word') {
        speakWord(card.text);
    }

    // Flip Card
    cardElem.classList.add('flipped');
    flippedCards.push({ elem: cardElem, data: card });

    if (flippedCards.length === 1) {
        flipStartTime = Date.now();
    } else if (flippedCards.length === 2) {
        isProcessing = true;
        checkMatch();
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;
    const matchTime = Date.now() - flipStartTime;

    // Match criteria: Same ID but different card types (word <-> image)
    const isMatch = card1.data.id === card2.data.id && card1.data.type !== card2.data.type;

    if (isMatch) {
        // Successful Match
        setTimeout(() => {
            card1.elem.classList.add('matched');
            card2.elem.classList.add('matched');
            
            playSound('match');
            matchedCount++;
            combo++;

            // Calculate Dynamic Score with Time Decay & Combo Multiplier
            let baseScore = 100;
            let timeBonus = 0;
            
            if (matchTime < 2000) timeBonus = 200;
            else if (matchTime < 4000) timeBonus = 120;
            else if (matchTime < 6000) timeBonus = 60;

            let comboMultiplier = 1 + (combo - 1) * 0.5;
            let earnedPoints = Math.round((baseScore + timeBonus) * comboMultiplier);
            
            score += earnedPoints;
            updateScoreDisplay();
            updateComboDisplay();

            // Floating Score Popup
            showFloatingScore(card2.elem, `+${earnedPoints}`);

            // Pronounce English word on match
            const wordCard = card1.data.type === 'word' ? card1.data : card2.data;
            speakWord(wordCard.text);

            flippedCards = [];
            isProcessing = false;

            // Check Win Condition (4 matched pairs = 8 cards)
            if (matchedCount === 4) {
                setTimeout(handleWin, 600);
            }
        }, 400);

    } else {
        // Incorrect Match
        setTimeout(() => {
            card1.elem.classList.add('wrong');
            card2.elem.classList.add('wrong');
            playSound('wrong');
            
            // Penalty
            combo = 0;
            score = Math.max(0, score - 10);
            updateScoreDisplay();
            updateComboDisplay();

            setTimeout(() => {
                card1.elem.classList.remove('flipped', 'wrong');
                card2.elem.classList.remove('flipped', 'wrong');
                flippedCards = [];
                isProcessing = false;
            }, 650);
        }, 500);
    }
}

/* ==========================================================================
   Timer & Score Handlers
   ========================================================================== */
function startTimer() {
    isTimerRunning = true;
    startTime = Date.now() - elapsedMs;
    timerInterval = setInterval(() => {
        elapsedMs = Date.now() - startTime;
        timerDisplay.textContent = formatTime(elapsedMs);
    }, 50);
}

function stopTimer() {
    isTimerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((ms % 1000) / 100);

    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}.${tenths}`;
}

function updateScoreDisplay() {
    scoreDisplay.textContent = score;
    if (score > bestScore) {
        bestScore = score;
        bestScoreDisplay.textContent = bestScore;
        localStorage.setItem('wordmatch_best_score', bestScore.toString());
    }
}

function updateComboDisplay() {
    if (combo >= 2) {
        comboText.textContent = `COMBO x${combo}`;
        comboBadge.classList.remove('hidden');
    } else {
        comboBadge.classList.add('hidden');
    }
}

function showFloatingScore(targetElem, text) {
    const rect = targetElem.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'floating-score';
    popup.textContent = text;
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top + 20}px`;
    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 900);
}

/* ==========================================================================
   Victory / Win Handler
   ========================================================================== */
function handleWin() {
    stopTimer();
    playSound('victory');

    // Calculate Completion Speed Bonus
    let completionBonus = 0;
    if (elapsedMs < 12000) completionBonus = 500;
    else if (elapsedMs < 20000) completionBonus = 300;
    else if (elapsedMs < 30000) completionBonus = 150;

    score += completionBonus;
    updateScoreDisplay();

    // Populate Modal Details
    finalTimeDisplay.textContent = formatTime(elapsedMs);
    speedBonusDisplay.textContent = `+${completionBonus}`;
    finalScoreDisplay.textContent = score;

    // Calculate Stars (1 to 3 stars based on score/time)
    let starCount = 1;
    if (score >= 900 || elapsedMs <= 15000) starCount = 3;
    else if (score >= 600 || elapsedMs <= 25000) starCount = 2;

    renderStars(starCount);

    // Show Modal & Launch Confetti
    winModal.classList.remove('hidden');
    launchConfetti();
}

function renderStars(count) {
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star, idx) => {
        if (idx < count) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

/* ==========================================================================
   Web Speech API & Web Audio Synthesizer
   ========================================================================== */
function speakWord(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Cancel ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = soundBtn.querySelector('i');
    if (soundEnabled) {
        icon.className = 'fa-solid fa-volume-high';
        soundBtn.style.color = 'var(--text-main)';
    } else {
        icon.className = 'fa-solid fa-volume-xmark';
        soundBtn.style.color = 'var(--accent-rose)';
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'flip') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);

        } else if (type === 'match') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);

        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(180, now + 0.12);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);

        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);

        } else if (type === 'victory') {
            // Victory Fanfare Triad
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const subOsc = ctx.createOscillator();
                const subGain = ctx.createGain();
                subOsc.type = 'triangle';
                subOsc.frequency.setValueAtTime(freq, now + i * 0.12);
                subGain.gain.setValueAtTime(0.2, now + i * 0.12);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
                subOsc.connect(subGain);
                subGain.connect(ctx.destination);
                subOsc.start(now + i * 0.12);
                subOsc.stop(now + i * 0.12 + 0.4);
            });
        }
    } catch (e) {
        console.warn('Audio synth error:', e);
    }
}

/* ==========================================================================
   Canvas Particle Confetti Engine
   ========================================================================== */
function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}

function launchConfetti() {
    particles = [];
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#06b6d4', '#10b981', '#f59e0b'];

    for (let i = 0; i < 90; i++) {
        particles.push({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.7) * 16,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 10,
            opacity: 1
        });
    }

    animateConfetti();
}

function animateConfetti() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let active = false;

    particles.forEach(p => {
        if (p.opacity > 0) {
            active = true;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35; // Gravity
            p.rotation += p.vRot;
            p.opacity -= 0.012;

            confettiCtx.save();
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            confettiCtx.globalAlpha = Math.max(0, p.opacity);
            confettiCtx.fillStyle = p.color;
            confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            confettiCtx.restore();
        }
    });

    if (active) {
        requestAnimationFrame(animateConfetti);
    }
}
