'use strict';

/* ═══════════════════════════════════════════════════════════════
   TEXAS HOLD'EM — complete rewrite
═══════════════════════════════════════════════════════════════ */

const SB = 10;
const BB = 20;
const SUITS_SYM = { H: '♥', D: '♦', C: '♣', S: '♠' };
const CARD_BASE  = 'https://deckofcardsapi.com/static/img/';

/* ── state ───────────────────────────────────────────────────── */
let G = {
    deck: [], players: [], community: [],
    pot: 0, currentBet: 0,
    dealerIdx: 0, turnIdx: 0,
    phase: 'idle',      // idle|preflop|flop|turn|river|showdown
    actorsLeft: 0,
};

/* each player: { id, name, chips, hand[], folded, bet, wagered, isHuman, seat } */

let _sessionStart  = 0;
let _handStartChips = 0;
let _timerInt = null;
let _tavoloConfig = { limite_min: 5, limite_max: 1000 };

/* ── boot ────────────────────────────────────────────────────── */
document.addEventListener('authReady', async () => {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) { window.location.href = 'login.html'; return; }

    if (typeof getTavoloConfig === 'function') {
        _tavoloConfig = await getTavoloConfig('Poker');
        if (_tavoloConfig?.attivo === false) {
            alert('Il tavolo Poker è momentaneamente chiuso.');
            window.location.href = 'giochi.html';
            return;
        }
    }
    if (typeof syncBalanceOnLoad === 'function') await syncBalanceOnLoad();

    const bal = typeof getBalanceLocal === 'function' ? getBalanceLocal() : (user.balance ?? 1000);
    _buildTable(user, bal);
});

/* ── table init ──────────────────────────────────────────────── */
function _buildTable(user, heroChips) {
    const bots = [
        { id: 0, name: "Alex 'Ace'", chips: 1000 },
        { id: 1, name: 'Sara B.',    chips: 1200 },
        { id: 2, name: 'Mike Fold',  chips:  800 },
        { id: 4, name: 'The Shark',  chips: 1500 },
    ];
    G.players = [
        { ...bots[0], seat: 0, hand: [], folded: false, bet: 0, wagered: 0, isHuman: false },
        { ...bots[1], seat: 1, hand: [], folded: false, bet: 0, wagered: 0, isHuman: false },
        { ...bots[2], seat: 2, hand: [], folded: false, bet: 0, wagered: 0, isHuman: false },
        { id: 99, name: user.username || 'Tu', chips: heroChips, seat: 3, hand: [], folded: false, bet: 0, wagered: 0, isHuman: true },
        { ...bots[3], seat: 4, hand: [], folded: false, bet: 0, wagered: 0, isHuman: false },
    ];

    const input = document.getElementById('buyInInput');
    if (input) {
        input.min  = _tavoloConfig.limite_min  || 50;
        input.max  = _tavoloConfig.limite_max  || 5000;
    }

    _renderAllSeats();
    _setLog('Benvenuto al Tavolo VIP — Premi "Nuova Mano" per iniziare');
}

/* ── new hand ────────────────────────────────────────────────── */
function startNewHand() {
    const hero = _hero();
    if (!hero) return;

    const input = document.getElementById('buyInInput');
    const buyin = input ? +input.value : 500;

    if (hero.chips <= 0 || hero.chips < BB) {
        if (buyin > 0 && typeof getBalanceLocal === 'function' && getBalanceLocal() >= buyin) {
            hero.chips = buyin;
        } else {
            _setLog('Fiches esaurite. Ricarica nel profilo.');
            window.location.href = 'user.html';
            return;
        }
    }

    // reset bots with low chips
    G.players.forEach(p => { if (!p.isHuman && p.chips < BB) p.chips = 1000; });

    _handStartChips  = hero.chips;
    _sessionStart    = Date.now();

    // reset state
    G.deck      = _shuffle(_buildDeck());
    G.community = [];
    G.pot       = 0;
    G.currentBet= 0;
    G.phase     = 'preflop';
    G.players.forEach(p => { p.hand = []; p.folded = false; p.bet = 0; p.wagered = 0; });

    // reset UI
    _clearSeatStates();
    _resetCommunity();
    _setPot(0);
    _setPhase('');

    G.dealerIdx = (G.dealerIdx + 1) % G.players.length;
    _drawMarkers();
    _postBlinds();
    _dealHole();

    // first to act: UTG = dealer+3
    G.turnIdx = (G.dealerIdx + 3) % G.players.length;
    G.actorsLeft = G.players.length;

    _showControlsPanel(false);
    _setLog('Carte distribuite. Inizio puntate pre-flop.');
    _nextTurn();
}

/* ── deck ────────────────────────────────────────────────────── */
function _buildDeck() {
    const vals = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['H','D','C','S'];
    const d = [];
    for (const s of suits) for (const v of vals) d.push({ v, s });
    return d;
}

function _shuffle(d) {
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

/* ── blinds & deal ───────────────────────────────────────────── */
function _postBlinds() {
    const n = G.players.length;
    _placeBet(G.players[(G.dealerIdx + 1) % n], SB);
    _placeBet(G.players[(G.dealerIdx + 2) % n], BB);
    G.currentBet = BB;
}

function _dealHole() {
    for (let r = 0; r < 2; r++) {
        G.players.forEach(p => { if (G.deck.length) p.hand.push(G.deck.pop()); });
    }
    G.players.forEach(p => _renderHole(p));
}

/* ── turn engine ─────────────────────────────────────────────── */
function _nextTurn() {
    if (_roundDone()) { _advancePhase(); return; }

    // skip folded / all-in
    let loops = 0;
    while ((G.players[G.turnIdx].folded || G.players[G.turnIdx].chips === 0) && loops < 10) {
        G.turnIdx = (G.turnIdx + 1) % G.players.length;
        loops++;
    }

    const p = G.players[G.turnIdx];

    // highlight active seat
    G.players.forEach(x => document.getElementById(`seat-${x.seat}`)?.classList.remove('active'));
    document.getElementById(`seat-${p.seat}`)?.classList.add('active');

    if (p.isHuman) {
        _enableHuman();
    } else {
        _disableHuman();
        setTimeout(() => _botAct(p), 900);
    }
}

function _roundDone() {
    const active = G.players.filter(p => !p.folded);
    if (active.length <= 1) return true;
    const needToAct = active.filter(p => p.chips > 0 && p.bet < G.currentBet);
    return needToAct.length === 0 && G.actorsLeft <= 0;
}

/* ── bot logic ───────────────────────────────────────────────── */
function _botAct(bot) {
    const callAmt = Math.max(0, G.currentBet - bot.bet);
    const score   = _scoreHole(bot.hand);
    const r       = Math.random();

    if (callAmt > bot.chips) {
        // all-in or fold
        if (score > 14 || r > 0.5) _doCall(bot);
        else _doFold(bot);
    } else if (callAmt > 0) {
        if (score < 10 && r > 0.25)        _doFold(bot);
        else if (score > 22 && r > 0.55)   _doRaise(bot, Math.min(G.currentBet + BB * 2, bot.chips + bot.bet));
        else                                _doCall(bot);
    } else {
        // no cost to stay
        if (score > 20 && r > 0.45)        _doRaise(bot, Math.min(BB * 2, bot.chips));
        else                                _doCheck(bot);
    }

    G.actorsLeft--;
    G.turnIdx = (G.turnIdx + 1) % G.players.length;
    _nextTurn();
}

/* ── actions ─────────────────────────────────────────────────── */
function _doFold(p) {
    p.folded = true;
    document.getElementById(`seat-${p.seat}`)?.classList.add('folded');
    _showAlabel(p, 'fold', 'FOLD');
}

function _doCheck(p) {
    _showAlabel(p, 'check', 'CHECK');
}

function _doCall(p) {
    const amt = Math.min(G.currentBet - p.bet, p.chips);
    _placeBet(p, amt);
    _showAlabel(p, 'call', amt === 0 ? 'CHECK' : `CALL €${amt}`);
}

function _doRaise(p, totalBet) {
    const additional = totalBet - p.bet;
    const actual = Math.min(additional, p.chips);
    _placeBet(p, actual);
    G.currentBet = p.bet;
    G.actorsLeft = G.players.filter(x => !x.folded).length;
    _showAlabel(p, 'raise', `RAISE €${p.bet}`);
}

/* ── human controls ──────────────────────────────────────────── */
function _enableHuman() {
    _stopTimer();
    const hero = _hero();
    if (!hero) return;
    const callAmt = Math.max(0, G.currentBet - hero.bet);

    _showControlsPanel(true);
    const row = document.getElementById('btnRow');
    row.innerHTML = '';

    const mkBtn = (txt, cls, fn) => {
        const b = document.createElement('button');
        b.textContent = txt; b.className = `pk-btn ${cls}`; b.onclick = fn;
        row.appendChild(b);
    };

    mkBtn('Fold', 'pk-btn-fold', humanFold);

    const callLabel = callAmt === 0 ? 'Check' : (hero.chips <= callAmt ? 'All-In' : `Call  €${callAmt}`);
    mkBtn(callLabel, 'pk-btn-call', humanCall);

    if (hero.chips > callAmt) mkBtn('Raise ▲', 'pk-btn-raise', openRaise);

    // hand strength
    const hs = document.getElementById('handStrength');
    if (hs) hs.textContent = _getHandName(hero.hand, G.community);

    // update buyin input with current chips
    _startTimer(hero.seat, 30, humanFold);
}

function _disableHuman() {
    _stopTimer();
    _showControlsPanel(false);
}

function humanFold()  { _stopTimer(); _doFold(_hero()); G.actorsLeft--; G.turnIdx = (G.turnIdx + 1) % G.players.length; _nextTurn(); }
function humanCall()  { _stopTimer(); _doCall(_hero()); G.actorsLeft--; G.turnIdx = (G.turnIdx + 1) % G.players.length; _nextTurn(); }

function humanRaise(amt) {
    _stopTimer();
    _doRaise(_hero(), _hero().bet + amt);
    G.turnIdx = (G.turnIdx + 1) % G.players.length;
    _nextTurn();
}

function openRaise() {
    _stopTimer();
    const hero = _hero();
    const panel = document.getElementById('raisePanel');
    const slider = document.getElementById('raiseSlider');
    const valEl  = document.getElementById('raiseVal');
    if (!panel || !slider || !hero) return;

    const minR = Math.max(G.currentBet + BB, BB);
    const maxR = hero.chips + hero.bet;
    slider.min   = minR;
    slider.max   = maxR;
    slider.value = minR;
    if (valEl) valEl.textContent = minR;

    panel.classList.remove('hidden');
    _setLog('Scegli importo rilancio');
}

function onSlider(v) {
    const el = document.getElementById('raiseVal');
    if (el) el.textContent = +v;
}

function applyPreset(type) {
    const hero   = _hero();
    const slider = document.getElementById('raiseSlider');
    const valEl  = document.getElementById('raiseVal');
    if (!slider || !hero) return;
    let val;
    if      (type === 'half')  val = Math.floor(G.pot / 2);
    else if (type === 'pot')   val = G.pot;
    else if (type === '2bb')   val = BB * 2;
    else if (type === 'allin') val = hero.chips + hero.bet;
    val = Math.min(Math.max(val, +slider.min), hero.chips + hero.bet);
    slider.value = val;
    if (valEl) valEl.textContent = val;
}

function confirmRaise() {
    const slider = document.getElementById('raiseSlider');
    if (!slider) return;
    const totalBet = +slider.value;
    const hero = _hero();
    if (!hero) return;
    const additional = totalBet - hero.bet;
    if (additional <= 0) { humanCall(); return; }
    closeRaise();
    humanRaise(additional);
}

function closeRaise() {
    document.getElementById('raisePanel')?.classList.add('hidden');
}

/* ── timer (SVG ring) ────────────────────────────────────────── */
function _startTimer(seat, seconds, onExpire) {
    _stopTimer();
    const prog = document.getElementById(`tprog-${seat}`);
    if (!prog) return;

    const C = 2 * Math.PI * 18;   // r=18, circumference ≈ 113
    prog.style.strokeDasharray  = C;
    prog.style.strokeDashoffset = 0;
    prog.style.stroke = '#22c55e';

    let elapsed = 0;
    _timerInt = setInterval(() => {
        elapsed++;
        const pct = elapsed / seconds;
        prog.style.strokeDashoffset = C * pct;
        if (pct > 0.75)      prog.style.stroke = '#ef4444';
        else if (pct > 0.5)  prog.style.stroke = '#f59e0b';
        if (elapsed >= seconds) {
            _stopTimer();
            prog.style.strokeDashoffset = C;
            if (onExpire) onExpire();
        }
    }, 1000);
}

function _stopTimer() {
    clearInterval(_timerInt);
    _timerInt = null;
    // reset all rings
    for (let i = 0; i < 5; i++) {
        const prog = document.getElementById(`tprog-${i}`);
        if (prog) { prog.style.strokeDashoffset = 113; prog.style.stroke = '#22c55e'; }
    }
}

/* ── phase / community ───────────────────────────────────────── */
function _advancePhase() {
    G.players.forEach(p => { p.bet = 0; _renderBetChip(p); });
    G.currentBet = 0;
    G.actorsLeft = G.players.filter(p => !p.folded && p.chips > 0).length;
    G.turnIdx    = (G.dealerIdx + 1) % G.players.length;

    const active = G.players.filter(p => !p.folded);
    if (active.length <= 1) { _showdown(); return; }

    if      (G.phase === 'preflop') { G.phase = 'flop';   _dealComm(3); }
    else if (G.phase === 'flop')    { G.phase = 'turn';   _dealComm(1); }
    else if (G.phase === 'turn')    { G.phase = 'river';  _dealComm(1); }
    else                            { _showdown(); return; }

    _setPhase(G.phase.toUpperCase());

    // update hero hand label
    const hero = _hero();
    const hs   = document.getElementById('handStrength');
    if (hs && hero && !hero.folded) hs.textContent = _getHandName(hero.hand, G.community);

    _disableHuman();
    _nextTurn();
}

function _dealComm(n) {
    const start = G.community.length;
    for (let i = 0; i < n; i++) {
        const card = G.deck.pop();
        G.community.push(card);
        const el = document.getElementById(`c${start + i}`);
        if (el) _renderCardInEl(el, card);
    }
}

/* ── showdown ────────────────────────────────────────────────── */
function _showdown() {
    G.phase = 'showdown';
    _setPhase('SHOWDOWN');
    _disableHuman();

    const active = G.players.filter(p => !p.folded);
    active.forEach(p => {
        _revealHole(p);
        p.handScore = _solveHand(p.hand, G.community);
    });
    G.players.filter(p => p.folded).forEach(p => { p.handScore = -1; });

    // side-pot distribution
    const levels = [...new Set(G.players.map(p => p.wagered).filter(w => w > 0))].sort((a, b) => a - b);
    let lastLevel = 0;
    const winnersSet = new Set();

    levels.forEach(level => {
        let chunk = 0;
        const contributors = [];
        G.players.forEach(p => {
            if (p.wagered > lastLevel) {
                chunk += Math.min(p.wagered, level) - lastLevel;
                contributors.push(p);
            }
        });
        const eligible = contributors.filter(p => !p.folded);
        if (eligible.length > 0) {
            const maxScore = Math.max(...eligible.map(p => p.handScore));
            const winners  = eligible.filter(p => p.handScore === maxScore);
            const share    = Math.floor(chunk / winners.length);
            winners.forEach(w => { w.chips += share; winnersSet.add(w); });
        }
        lastLevel = level;
    });

    const winnersList = [...winnersSet];

    // highlight winners
    winnersList.forEach(w => {
        document.getElementById(`seat-${w.seat}`)?.classList.add('winner');
        _showAlabel(w, 'allin', `WIN! ${_getHandName(w.hand, G.community)}`);
    });

    // update stacks
    G.players.forEach(p => _renderStack(p));

    // DB sync
    const hero = _hero();
    if (hero && typeof recordGame === 'function') {
        const duration = _sessionStart ? Math.round((Date.now() - _sessionStart) / 1000) : 0;
        const bet      = hero.wagered || 0;
        const payout   = Math.max(0, hero.chips - _handStartChips + bet);
        recordGame({ game: 'Poker', bet, payout, duration });
    }

    const names = winnersList.map(w => w.name).join(', ');
    _setLog(`Vince: ${names} — Prossima mano tra 5 secondi`);

    setTimeout(() => {
        document.querySelectorAll('.pk-seat').forEach(el => el.classList.remove('winner'));
        startNewHand();
    }, 5000);
}

/* ── hand scoring ────────────────────────────────────────────── */
function _solveHand(hole, comm) {
    const all = [...hole, ...comm];
    all.sort((a, b) => _cv(b.v) - _cv(a.v));

    const counts = {};
    all.forEach(c => { counts[c.v] = (counts[c.v] || 0) + 1; });
    const suits  = {};
    all.forEach(c => { suits[c.s]  = (suits[c.s]  || 0) + 1; });

    const pairs  = Object.values(counts).filter(v => v === 2).length;
    const tris   = Object.values(counts).filter(v => v === 3).length;
    const quad   = Object.values(counts).some(v => v === 4);
    const flush  = Object.values(suits).some(v => v >= 5);
    const vals   = all.map(c => _cv(c.v));
    const straight = _isStraight(vals);

    let score = _cv(all[0].v);
    if (straight && flush) score += 800;
    else if (quad)         score += 700;
    else if (tris && pairs > 0) score += 600;
    else if (flush)        score += 500;
    else if (straight)     score += 400;
    else if (tris)         score += 300;
    else if (pairs >= 2)   score += 200;
    else if (pairs === 1)  score += 100;

    return score;
}

function _isStraight(sorted) {
    const uniq = [...new Set(sorted)];
    for (let i = 0; i <= uniq.length - 5; i++) {
        if (uniq[i] - uniq[i + 4] === 4) return true;
    }
    // wheel: A-2-3-4-5
    if (uniq.includes(14) && uniq.includes(2) && uniq.includes(3) && uniq.includes(4) && uniq.includes(5)) return true;
    return false;
}

function _cv(v) {
    if (v === 'A') return 14; if (v === 'K') return 13;
    if (v === 'Q') return 12; if (v === 'J') return 11;
    return parseInt(v) || 0;
}

function _getHandName(hole, comm) {
    if (!hole || hole.length < 2) return '';
    const s = _solveHand(hole, comm);
    if (s >= 800) return 'Scala Reale / Straight Flush';
    if (s >= 700) return 'Poker';
    if (s >= 600) return 'Full House';
    if (s >= 500) return 'Colore (Flush)';
    if (s >= 400) return 'Scala (Straight)';
    if (s >= 300) return 'Tris';
    if (s >= 200) return 'Doppia Coppia';
    if (s >= 100) return 'Coppia';
    return 'Carta Alta';
}

function _scoreHole(hand) {
    if (!hand || hand.length < 2) return 0;
    let s = _cv(hand[0].v) + _cv(hand[1].v);
    if (hand[0].v === hand[1].v) s += 20;
    if (hand[0].s === hand[1].s) s += 5;
    return s;
}

/* ── bet helpers ─────────────────────────────────────────────── */
function _placeBet(p, amt) {
    amt = Math.min(amt, p.chips);
    if (amt <= 0) return;
    p.chips  -= amt;
    p.bet    += amt;
    p.wagered+= amt;
    G.pot    += amt;
    _setPot(G.pot);
    _renderStack(p);
    _renderBetChip(p);
}

/* ── card rendering ──────────────────────────────────────────── */
function _cardUrl(c) {
    let v = c.v; if (v === '10') v = '0';
    return `${CARD_BASE}${v}${c.s}.png`;
}

function _renderCardInEl(el, card) {
    const isRed = card.s === 'H' || card.s === 'D';
    el.className  = `pk-card ${isRed ? 'red' : 'black'}`;
    el.innerHTML  = `
        <div class="pk-corner-tl">${card.v}<br><small>${SUITS_SYM[card.s]}</small></div>
        <div class="pk-cs">${SUITS_SYM[card.s]}</div>
        <div class="pk-corner-br">${card.v}<br><small>${SUITS_SYM[card.s]}</small></div>`;
}

function _renderHole(p) {
    const hole = document.getElementById(`hole-${p.seat}`);
    if (!hole) return;
    const cards = hole.querySelectorAll('.pk-card');
    cards.forEach((el, i) => {
        if (p.isHuman && p.hand[i]) {
            _renderCardInEl(el, p.hand[i]);
        } else {
            el.className = 'pk-card pk-card-back';
            el.innerHTML = '';
        }
    });
}

function _revealHole(p) {
    const hole = document.getElementById(`hole-${p.seat}`);
    if (!hole || !p.hand.length) return;
    const cards = hole.querySelectorAll('.pk-card');
    cards.forEach((el, i) => { if (p.hand[i]) _renderCardInEl(el, p.hand[i]); });
}

/* ── seat UI helpers ─────────────────────────────────────────── */
function _renderAllSeats() {
    G.players.forEach(p => {
        const nameEl  = document.getElementById(`sname-${p.seat}`);
        const stackEl = document.getElementById(`stack-${p.seat}`);
        if (nameEl)  nameEl.textContent  = p.name;
        if (stackEl) stackEl.textContent = `€ ${p.chips}`;
    });
}

function _renderStack(p) {
    const el = document.getElementById(`stack-${p.seat}`);
    if (el) el.textContent = `€ ${p.chips}`;
}

function _renderBetChip(p) {
    const el = document.getElementById(`bchip-${p.seat}`);
    if (!el) return;
    if (p.bet > 0) { el.textContent = `€${p.bet}`; el.classList.add('visible'); }
    else           { el.classList.remove('visible'); el.textContent = ''; }
}

function _showAlabel(p, type, text) {
    const el = document.getElementById(`alabel-${p.seat}`);
    if (!el) return;
    el.textContent = text;
    el.className   = `pk-alabel ${type} show`;
    setTimeout(() => { el.classList.remove('show'); }, 2200);
}

function _drawMarkers() {
    for (let i = 0; i < G.players.length; i++) {
        const el = document.getElementById(`mkr-${i}`);
        if (el) el.innerHTML = '';
    }
    const n = G.players.length;
    const mk = (idx, cls, txt) => {
        const seat = G.players[idx % n].seat;
        const el   = document.getElementById(`mkr-${seat}`);
        if (!el) return;
        const m = document.createElement('div');
        m.className = `pk-marker ${cls}`;
        m.textContent = txt;
        el.appendChild(m);
    };
    mk(G.dealerIdx,     'mk-d',  'D');
    mk(G.dealerIdx + 1, 'mk-sb', 'SB');
    mk(G.dealerIdx + 2, 'mk-bb', 'BB');
}

function _clearSeatStates() {
    document.querySelectorAll('.pk-seat').forEach(el => {
        el.classList.remove('active', 'folded', 'winner');
    });
    G.players.forEach(p => {
        _renderBetChip(p);
        _renderStack(p);
        // reset hole cards to back
        const hole = document.getElementById(`hole-${p.seat}`);
        if (hole) hole.querySelectorAll('.pk-card').forEach(c => {
            c.className = 'pk-card pk-card-back'; c.innerHTML = '';
        });
    });
    const hs = document.getElementById('handStrength');
    if (hs) hs.textContent = '';
}

function _resetCommunity() {
    for (let i = 0; i < 5; i++) {
        const el = document.getElementById(`c${i}`);
        if (el) { el.className = 'pk-card pk-card-placeholder'; el.innerHTML = ''; }
    }
}

/* ── panel helpers ───────────────────────────────────────────── */
function _showControlsPanel(show) {
    const idle  = document.getElementById('idlePanel');
    const ctrl  = document.getElementById('controlsPanel');
    const raise = document.getElementById('raisePanel');
    if (idle)  idle.classList.toggle('hidden', show);
    if (ctrl)  ctrl.classList.toggle('hidden', !show);
    if (raise) raise.classList.add('hidden');
}

function _setPhase(txt) {
    const el = document.getElementById('phaseLabel');
    if (el) el.textContent = txt;
}

function _setPot(val) {
    const el = document.getElementById('potAmount');
    if (el) el.textContent = `€ ${val}`;
}

function _setLog(msg) {
    const el = document.getElementById('logBar');
    if (el) el.textContent = msg;
}

function _hero() { return G.players.find(p => p.isHuman); }
