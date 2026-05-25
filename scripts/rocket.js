'use strict';

/* ════════════════════════════════════════════════════════
   ROCKET CASH — Logica di gioco completa
   - Canvas animato con traiettoria razzo
   - Stati: WAITING → FLYING → CRASHED / CASHOUT
   - Integrazione con localStorage (saldo utente)
   - Live list simulata, Stats, Storia round
════════════════════════════════════════════════════════ */

/* ─── Stato globale ─── */
const STATE = {
    WAITING:  'waiting',
    FLYING:   'flying',
    CRASHED:  'crashed',
    CASHOUT:  'cashout',
};

let gameState      = STATE.WAITING;
let currentMult    = 1.00;
let crashPoint     = 1.00;
let betPlaced      = false;
let betAmount      = 0;
let cashedOut      = false;
let countdown      = 5;
let countdownTimer = null;
let flyTimer       = null;
let historyData    = [];   // array di crash points passati

/* ─── Stats personali ─── */
let myStats = {
    rounds:   0,
    wins:     0,
    bestMult: 0,
    profit:   0,
    history:  [],
};

/* ─── Canvas ─── */
let canvas, ctx;
let rocketX = 0, rocketY = 0;
let trailPoints = [];
let animFrame = null;
let flyStartTime = null;
let rocketImg = null;

/* ─── Live players simulati ─── */
const FAKE_PLAYERS = ['Marco_R', 'LuckyMax', 'Star99', 'ProGamer', 'VIPKing', 'CoolBet', 'NightOwl', 'AceHigh'];
let liveBets = [];

/* (multiplayer rimosso - solo modalità singolo) */

/* ════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════ */
let _tavoloRocket = { limite_min: 1, limite_max: 1000 };
let _rocketSessionStart = null;

document.addEventListener('authReady', async () => {
    canvas = document.getElementById('gameCanvas');
    ctx    = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    rocketImg = new Image(48, 48);

    if (typeof getTavoloConfig === 'function') {
        _tavoloRocket = await getTavoloConfig('Rocket Cash');
        if (_tavoloRocket?.attivo === false) {
            alert("Il tavolo Rocket Cash è momentaneamente chiuso.");
            window.location.href = "giochi.html";
            return;
        }
        if (typeof applyTavoloUI === 'function') applyTavoloUI(_tavoloRocket);
    }

    for (let i = 0; i < 12; i++) {
        historyData.push(generateCrashPoint());
    }
    renderHistory();
    renderLiveList(false);
    renderStats();

    initVip();
    startJackpot();
    startWaiting();
});

/* ─── Resize canvas ─── */
function resizeCanvas() {
    const wrap = canvas.parentElement;
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    if (gameState !== STATE.FLYING) drawIdle();
}

/* ════════════════════════════════════════════════════════
   GENERAZIONE CRASH POINT
   Formula tipo Bustabit: usa hash per sembrare provably fair
════════════════════════════════════════════════════════ */
function generateCrashPoint() {
    // Distribuzione: ~33% crash < 1.5x, ~50% tra 1.5x e 5x, ~17% > 5x
    const r = Math.random();
    if (r < 0.33)  return +(1 + Math.random() * 0.5).toFixed(2);
    if (r < 0.80)  return +(1.5 + Math.random() * 4).toFixed(2);
    if (r < 0.95)  return +(5 + Math.random() * 15).toFixed(2);
    return +(20 + Math.random() * 80).toFixed(2);
}

/* ════════════════════════════════════════════════════════
   FASE: WAITING (conto alla rovescia)
════════════════════════════════════════════════════════ */
function startWaiting() {
    gameState   = STATE.WAITING;
    currentMult = 1.00;
    cashedOut   = false;
    betPlaced   = false;
    betAmount   = 0;
    trailPoints = [];
    countdown   = 5;
    liveBets    = [];

    crashPoint = generateCrashPoint();
    setMultDisplay('Prossimo round tra ' + countdown + 's', 'state-waiting');
    setMainBtn('bet');
    setBetResult('', 'neutral');
    renderLiveList(false);
    drawIdle();

    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        countdown--;
        setMultDisplay('Prossimo round tra ' + countdown + 's', 'state-waiting');
        if (countdown <= 0) {
            clearInterval(countdownTimer);
            simulateLiveBets();
            startFlying();
        }
    }, 1000);
}

/* ════════════════════════════════════════════════════════
   FASE: FLYING (moltiplicatore in crescita)
════════════════════════════════════════════════════════ */
function startFlying() {
    gameState    = STATE.FLYING;
    currentMult  = 1.00;
    flyStartTime = performance.now();
    trailPoints  = [];

    // Se l'utente ha piazzato la puntata, blocca il bottone per cashout
    if (betPlaced) {
        setMainBtn('cashout');
    } else {
        setMainBtn('waiting'); // troppo tardi per puntare
    }

    cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(flyLoop);
}

function flyLoop(timestamp) {
    const elapsed = (timestamp - flyStartTime) / 1000; // secondi

    // Crescita moltiplicatore: curva esponenziale dolce
    currentMult = Math.pow(Math.E, elapsed * 0.22);
    currentMult = +currentMult.toFixed(2);

    // Auto cashout
    const acCheck = document.getElementById('autoCashoutCheck');
    const acVal   = parseFloat(document.getElementById('autoCashoutVal').value) || 2.00;
    if (betPlaced && !cashedOut && acCheck?.checked && currentMult >= acVal) {
        doCashout();
        // non return: il loop continua ad animare fino al crash naturale
    }

    // Crash?
    if (currentMult >= crashPoint) {
        doCrash();
        return;
    }

    // Aggiorna display
    setMultDisplay(currentMult.toFixed(2) + 'x', 'state-flying');

    // Aggiorna live bots
    updateLiveBotsCashout(currentMult);

    // Disegna frame
    drawFlying(elapsed);

    animFrame = requestAnimationFrame(flyLoop);
}

/* ════════════════════════════════════════════════════════
   CRASH
════════════════════════════════════════════════════════ */
function doCrash() {
    cancelAnimationFrame(animFrame);
    gameState = STATE.CRASHED;

    setMultDisplay('💥 CRASH a ' + currentMult.toFixed(2) + 'x', 'state-crash');
    setMainBtn('bet');

    if (betPlaced && !cashedOut) {
        setBetResult('❌ Perso €' + betAmount.toFixed(2), 'loss');
        const _duration = _rocketSessionStart ? Math.round((Date.now() - _rocketSessionStart) / 1000) : 0;
        _rocketSessionStart = null;
        if (typeof recordGame === 'function') {
            recordGame({ game: 'Rocket Cash', bet: betAmount, payout: 0, duration: _duration });
        }
        saveGameResult(false, currentMult, -betAmount);
    }

    // Aggiungi alla storia
    historyData.unshift(+currentMult.toFixed(2));
    if (historyData.length > 20) historyData.pop();
    renderHistory();
    renderLiveListAfterCrash();

    drawCrash();

    // Prossimo round
    setTimeout(() => startWaiting(), 3000);
}

/* ════════════════════════════════════════════════════════
   CASHOUT
════════════════════════════════════════════════════════ */
function doCashout() {
    if (!betPlaced || cashedOut || gameState !== STATE.FLYING) return;
    cashedOut = true;

    const winAmount = +(betAmount * currentMult).toFixed(2);
    const profit    = +(winAmount - betAmount).toFixed(2);

    setMultDisplay('✅ Cashout a ' + currentMult.toFixed(2) + 'x', 'state-cashout');
    setMainBtn('waiting');
    setBetResult('✅ +€' + winAmount.toFixed(2) + ' (x' + currentMult.toFixed(2) + ')', 'win');

    const _duration = _rocketSessionStart ? Math.round((Date.now() - _rocketSessionStart) / 1000) : 0;
    _rocketSessionStart = null;
    if (typeof recordGame === 'function') {
        recordGame({ game: 'Rocket Cash', bet: betAmount, payout: winAmount, duration: _duration });
    }
    saveGameResult(true, currentMult, profit);
    updateLiveBotsCashoutMe(currentMult, winAmount);

}

function _addLivePlayerEvent(username, mult, amount) {
    const list = document.getElementById('live-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'live-item live-win';
    row.innerHTML = `<span class="live-name">@${username}</span><span class="live-mult">${mult.toFixed(2)}x</span><span class="live-amount">+€${amount.toFixed(2)}</span>`;
    list.prepend(row);
    setTimeout(() => row.remove(), 8000);
}

/* ════════════════════════════════════════════════════════
   GESTIONE PULSANTE PRINCIPALE
════════════════════════════════════════════════════════ */
function handleMainButton() {
    // Se in volo → CASHOUT
    if (gameState === STATE.FLYING && betPlaced && !cashedOut) {
        doCashout();
        return;
    }

    // Se in attesa → PUNTA
    if (gameState !== STATE.WAITING) return;

    const input  = document.getElementById('betInput');
    const mainBtn = document.getElementById('mainBtn');
    const amount = parseFloat(input.value);

    const _rMin = _tavoloRocket?.limite_min ?? 1;
    const _rMax = _tavoloRocket?.limite_max ?? 1000;
    if (isNaN(amount) || amount < _rMin) {
        setBetResult(`⚠ Puntata minima: €${_rMin}`, 'loss');
        return;
    }
    if (amount > _rMax) {
        setBetResult(`⚠ Puntata massima: €${_rMax}`, 'loss');
        return;
    }

    // Controlla saldo locale
    const localBal = getUserBalance();
    if (localBal <= 0) {
        setBetResult('⚠ Saldo insufficiente. Ricarica il conto.', 'loss');
        return;
    }
    if (amount > localBal) {
        setBetResult('⚠ Saldo insufficiente (hai €' + localBal.toFixed(2) + ')', 'loss');
        return;
    }

    // Deduci localmente per aggiornare display subito (DB sync avviene via recordGame alla fine)
    betAmount = amount;
    betPlaced = true;
    _rocketSessionStart = Date.now();
    document.dispatchEvent(new CustomEvent('balanceUpdate', { detail: { balance: localBal - amount } }));
    setBetResult('✔ Puntata di €' + betAmount.toFixed(2) + ' piazzata!', 'win');
    setMainBtn('waiting');
}

/* ════════════════════════════════════════════════════════
   CONTROLLI PUNTATA
════════════════════════════════════════════════════════ */
function addBet(n)   {
    const inp = document.getElementById('betInput');
    inp.value = Math.min(5000, (parseFloat(inp.value) || 0) + n);
}
function setBet(n)   { document.getElementById('betInput').value = n; }
function halveBet()  {
    const inp = document.getElementById('betInput');
    inp.value = Math.max(1, Math.floor((parseFloat(inp.value) || 2) / 2));
}
function doubleBet() {
    const inp = document.getElementById('betInput');
    inp.value = Math.min(5000, (parseFloat(inp.value) || 1) * 2);
}
function allIn() {
    const bal = typeof getBalanceLocal === 'function' ? getBalanceLocal() : getUserBalance();
    document.getElementById('betInput').value = bal.toFixed(2);
}

/* ════════════════════════════════════════════════════════
   CANVAS DRAWING
════════════════════════════════════════════════════════ */
function drawIdle() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Griglia
    drawGrid(W, H, 'rgba(212,175,55,0.06)');

    // Testo centrale
    ctx.fillStyle = 'rgba(212,175,55,0.12)';
    ctx.font = 'bold 18px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PIAZZA LA TUA PUNTATA', W / 2, H / 2);
}

function drawFlying(elapsed) {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Griglia
    drawGrid(W, H, 'rgba(212,175,55,0.06)');

    // Calcola posizione razzo lungo curva
    const progress = Math.min(elapsed / 10, 0.92); // max 92% del canvas in 10s
    const px = 60 + progress * (W - 120);
    const py = H - 60 - progress * progress * (H - 120); // curva quadratica

    // Salva punti trail
    trailPoints.push({ x: px, y: py });
    if (trailPoints.length > 120) trailPoints.shift();

    // Disegna trail (scia)
    if (trailPoints.length > 2) {
        ctx.beginPath();
        ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
        for (let i = 1; i < trailPoints.length; i++) {
            ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
        }
        // Gradiente scia: trasparente → oro/giallo
        const grad = ctx.createLinearGradient(
            trailPoints[0].x, trailPoints[0].y,
            trailPoints[trailPoints.length - 1].x, trailPoints[trailPoints.length - 1].y
        );
        grad.addColorStop(0, 'rgba(255,215,0,0)');
        grad.addColorStop(1, 'rgba(255,215,0,0.7)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // Razzo (emoji su canvas)
    ctx.save();
    ctx.translate(px, py);
    // Inclinazione in base alla direzione
    const angle = trailPoints.length > 5
        ? Math.atan2(
            trailPoints[trailPoints.length - 1].y - trailPoints[trailPoints.length - 5].y,
            trailPoints[trailPoints.length - 1].x - trailPoints[trailPoints.length - 5].x
          )
        : -Math.PI / 4;
    ctx.rotate(angle);
    ctx.font = '36px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', 0, 0);
    ctx.restore();

    // Glow sotto il razzo
    const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, 30);
    glowGrad.addColorStop(0, 'rgba(255,215,0,0.25)');
    glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fill();

    // Label moltiplicatore vicino al razzo (piccolo)
    ctx.fillStyle = 'rgba(255,215,0,0.7)';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(currentMult.toFixed(2) + 'x', px, py - 22);
}

function drawCrash() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    drawGrid(W, H, 'rgba(239,68,68,0.06)');

    // Trail finale rosso
    if (trailPoints.length > 2) {
        ctx.beginPath();
        ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
        for (let i = 1; i < trailPoints.length; i++) {
            ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
        }
        ctx.strokeStyle = 'rgba(239,68,68,0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Esplosione
    const lp = trailPoints[trailPoints.length - 1] || { x: W / 2, y: H / 2 };
    const exGrad = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 60);
    exGrad.addColorStop(0, 'rgba(239,68,68,0.6)');
    exGrad.addColorStop(0.5, 'rgba(255,165,0,0.3)');
    exGrad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = exGrad;
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '42px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💥', lp.x, lp.y);
}

function drawGrid(W, H, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
}

/* ════════════════════════════════════════════════════════
   STORIA ROUND
════════════════════════════════════════════════════════ */
function renderHistory() {
    const bar = document.getElementById('historyBar');
    if (!bar) return;
    bar.innerHTML = historyData.map(cp => {
        let cls = cp >= 5 ? 'safe' : cp >= 2 ? 'mid' : 'crash';
        return `<span class="hist-pill ${cls}">${cp.toFixed(2)}x</span>`;
    }).join('');
}

/* ════════════════════════════════════════════════════════
   LIVE LIST (giocatori simulati)
════════════════════════════════════════════════════════ */
function simulateLiveBets() {
    liveBets = [];
    const n = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < n; i++) {
        liveBets.push({
            name:      FAKE_PLAYERS[Math.floor(Math.random() * FAKE_PLAYERS.length)],
            bet:       +(Math.random() * 200 + 5).toFixed(2),
            cashoutAt: +(1.2 + Math.random() * (crashPoint - 1)).toFixed(2),
            cashedOut: false,
            mult:      null,
        });
    }
    renderLiveList(true);
}

function updateLiveBotsCashout(mult) {
    liveBets.forEach(p => {
        if (!p.cashedOut && mult >= p.cashoutAt) {
            p.cashedOut = true;
            p.mult = +mult.toFixed(2);
        }
    });
    renderLiveList(true);
}

function updateLiveBotsCashoutMe(mult, win) {
    renderLiveList(true);
}

function renderLiveListAfterCrash() {
    // Segna come persi quelli che non hanno fatto cashout
    liveBets.forEach(p => {
        if (!p.cashedOut) p.mult = null;
    });
    renderLiveList(true);
}

function renderLiveList(showPlayers) {
    const list = document.getElementById('liveList');
    if (!list) return;

    if (!showPlayers || liveBets.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted);font-family:Cinzel,serif;font-size:11px;text-align:center;padding:20px;">Round in attesa...</div>';
        return;
    }

    list.innerHTML = liveBets.map(p => {
        let multHtml, cls;
        if (p.cashedOut) {
            cls = 'win';
            multHtml = `<span class="lmult win">+${(p.bet * p.mult - p.bet).toFixed(0)}€ (${p.mult}x)</span>`;
        } else if (gameState === STATE.CRASHED && !p.cashedOut) {
            cls = 'loss';
            multHtml = `<span class="lmult loss">💥 crash</span>`;
        } else {
            cls = 'live';
            multHtml = `<span class="lmult live">${currentMult.toFixed(2)}x</span>`;
        }
        return `<div class="rp-live-item">
            <span class="lname">@${p.name}</span>
            <span class="lbet">€${p.bet.toFixed(2)}</span>
            ${multHtml}
        </div>`;
    }).join('');
}

/* ════════════════════════════════════════════════════════
   STATS
════════════════════════════════════════════════════════ */
function saveGameResult(won, mult, profitDelta) {
    myStats.rounds++;
    if (won) myStats.wins++;
    myStats.profit = +(myStats.profit + profitDelta).toFixed(2);
    if (won && mult > myStats.bestMult) myStats.bestMult = mult;

    myStats.history.unshift({ won, mult: +mult.toFixed(2), profit: +profitDelta.toFixed(2) });
    if (myStats.history.length > 20) myStats.history.pop();

    renderStats();
}

function renderStats() {
    const el = id => document.getElementById(id);
    if (!el('statRounds')) return;

    el('statRounds').textContent  = myStats.rounds;
    el('statWinRate').textContent = myStats.rounds
        ? Math.round(myStats.wins / myStats.rounds * 100) + '%' : '0%';
    el('statBestMult').textContent = myStats.bestMult > 0
        ? myStats.bestMult.toFixed(2) + 'x' : '—';

    const pEl = el('statProfit');
    pEl.textContent = (myStats.profit >= 0 ? '+' : '') + '€' + myStats.profit.toFixed(2);
    pEl.style.color = myStats.profit >= 0 ? '#22c55e' : '#ef4444';

    const hist = el('statsHistory');
    if (hist) {
        hist.innerHTML = myStats.history.map(h => `
            <div class="rp-stat-hist-item ${h.won ? 'won' : 'lost'}">
                <span class="smult">${h.mult.toFixed(2)}x</span>
                <span class="sprofit">${h.profit >= 0 ? '+' : ''}€${h.profit.toFixed(2)}</span>
            </div>`).join('');
    }
}

/* ════════════════════════════════════════════════════════
   TAB SWITCHING
════════════════════════════════════════════════════════ */
function switchTab(tabId, el) {
    document.querySelectorAll('.rocket-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.rocket-tab-panel').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    const panel = document.getElementById('tab-' + tabId);
    if (panel) panel.classList.add('active');
}

/* ════════════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════════════ */
function setMultDisplay(text, stateClass) {
    const el = document.getElementById('multDisplay');
    if (!el) return;
    el.textContent = text;
    el.className = 'rocket-mult-value ' + (stateClass || '');
}

function setMainBtn(mode) {
    const btn = document.getElementById('mainBtn');
    if (!btn) return;
    btn.className = 'rp-main-btn';
    if (mode === 'bet') {
        btn.className += ' rp-btn-bet';
        btn.innerHTML = '🚀 &nbsp; PUNTA';
        btn.disabled  = false;
    } else if (mode === 'cashout') {
        btn.className += ' rp-btn-cashout';
        btn.innerHTML = '💰 &nbsp; CASHOUT!';
        btn.disabled  = false;
    } else {
        btn.className += ' rp-btn-waiting';
        btn.innerHTML = '⏳ &nbsp; ATTENDI...';
        btn.disabled  = true;
    }
}

function setBetResult(text, type) {
    const el = document.getElementById('betResult');
    if (!el) return;
    el.innerHTML   = text || '&nbsp;';
    el.className   = 'rp-result';
    if (type === 'win')  el.classList.add('rp-result-win');
    else if (type === 'loss') el.classList.add('rp-result-loss');
    else el.classList.add('rp-result-neutral');
}

/* Saldo — delega a balance.js */
function getUserBalance() {
    return typeof getBalanceLocal === 'function' ? getBalanceLocal() : 0;
}

function updateBalance(_delta) {
    // no-op: il saldo è gestito esclusivamente da balance.js e dal DB
}

/* ════════════════════════════════════════════════════════
   VIP & JACKPOT (copiati dagli altri giochi)
════════════════════════════════════════════════════════ */
function initVip() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    const levels = {
        standard: { name: 'Standard',  pct: 15, next: 'Silver'   },
        silver:   { name: 'Silver',    pct: 45, next: 'Gold'     },
        gold:     { name: 'Gold',      pct: 75, next: 'Platinum' },
        platinum: { name: 'Platinum',  pct: 95, next: 'Diamond'  },
    };
    const l = levels[user.vipLevel] || levels.standard;
    const vipName = document.getElementById('vipLevelName');
    const vipPct  = document.getElementById('vipPct');
    const vipFill = document.getElementById('vipFill');
    const vipInfo = document.getElementById('vipInfo');
    if (vipName) vipName.textContent = l.name;
    if (vipPct)  vipPct.textContent  = l.pct + '%';
    if (vipInfo) vipInfo.innerHTML   = `Mancano punti per il livello <strong>${l.next}</strong>`;
    if (vipFill) setTimeout(() => { vipFill.style.width = l.pct + '%'; }, 400);
}

function startJackpot() {
    let jackpot = 4290123.82;
    const jackpotEl = document.getElementById('jackpotAmt');
    if (!jackpotEl) return;
    setInterval(() => {
        jackpot += Math.random() * 9.5 + 0.5;
        jackpotEl.textContent = '€' + jackpot.toLocaleString('it-IT', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }, 2200);
}

/* ─── Utility ─── */
function id(x) { return document.getElementById(x); }
