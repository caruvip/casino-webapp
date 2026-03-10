/**
 * TEXAS HOLD'EM VIP - LOGICA COMPLETA CON SIDE POTS
 * Correzione: Gestisce correttamente gli All-In parziali.
 */

const SUITS = ['H', 'D', 'C', 'S']; 
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SB_AMOUNT = 10;
const BB_AMOUNT = 20;
const CARD_IMG_BASE = "https://deckofcardsapi.com/static/img/";

let gameState = {
    deck: [],
    communityCards: [],
    players: [],
    pot: 0,            // Visuale, per mostrare il totale
    currentBet: 0,
    dealerIndex: 0,
    turnIndex: 0,
    phase: 'idle',
    minRaise: BB_AMOUNT,
    actorsRemaining: 0
};

const PLAYER_IDS = ['player-0', 'player-1', 'player-2', 'player-3', 'player-4'];

// --- INIZIALIZZAZIONE ---

document.addEventListener("DOMContentLoaded", () => {
    if (typeof getCurrentUser !== 'function') return;
    const user = getCurrentUser();
    if (!user) {
        alert("Devi effettuare il login.");
        window.location.href = "../login.html";
        return;
    }
    initTable(user);
});

function initTable(user) {
    const botNames = ["Alex 'Ace'", "Sarah B.", "Mike Fold", "The Shark"];

    gameState.players = [
        { id: 0, name: botNames[0], chips: 1000, hand: [], folded: false, bet: 0, totalWagered: 0, isHuman: false, elId: 'player-0' },
        { id: 1, name: botNames[1], chips: 1200, hand: [], folded: false, bet: 0, totalWagered: 0, isHuman: false, elId: 'player-1' },
        { id: 2, name: botNames[2], chips: 800,  hand: [], folded: false, bet: 0, totalWagered: 0, isHuman: false, elId: 'player-2' },
        { id: 3, name: user.username, chips: user.balance, hand: [], folded: false, bet: 0, totalWagered: 0, isHuman: true,  elId: 'player-3' },
        { id: 4, name: botNames[3], chips: 1500, hand: [], folded: false, bet: 0, totalWagered: 0, isHuman: false, elId: 'player-4' }
    ];

    renderPlayers();
}

function startGameManual() {
    const screen = document.getElementById('start-screen');
    if(screen) screen.style.display = 'none';
    log("Partita iniziata! Buona fortuna.");
    startNewHand();
}

// --- LOGICA CORE ---

function startNewHand() {
    gameState.deck = createDeck();
    gameState.communityCards = [];
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.phase = 'preflop';
    
    gameState.players.forEach(p => {
        p.hand = [];
        p.folded = false;
        p.bet = 0;
        p.totalWagered = 0; // Reset puntate totali per la nuova mano
        
        if (p.chips <= 0 && !p.isHuman) p.chips = 1000; // Ricarica bot
        
        const pPanel = document.getElementById(p.elId);
        if(pPanel) {
            pPanel.classList.remove('folded-panel', 'active');
            const cardContainer = pPanel.querySelector('.player-cards');
            if(cardContainer) cardContainer.innerHTML = '';
            pPanel.style.boxShadow = ""; // Rimuovi alone vittoria
        }
        updatePlayerChipsUI(p);
    });

    const human = gameState.players[3];
    if (human.chips < BB_AMOUNT) {
        alert("Fiches terminate! Ricarica nel profilo.");
        window.location.href = "../user.html";
        return;
    }

    // Reset UI
    for(let i=0; i<5; i++) {
        const el = document.getElementById(`comm-card-${i}`);
        if(el) { el.className = "card placeholder"; el.style.backgroundImage = 'none'; }
    }
    document.getElementById('pot-amount').innerText = '0';
    document.getElementById('my-hand-strength').innerText = '';

    // Dealer & Blinds
    gameState.dealerIndex = (gameState.dealerIndex + 1) % gameState.players.length;
    moveMarkers();
    postBlinds();
    dealHoleCards();
    updateHumanHandStrengthUI();
    
    gameState.turnIndex = (gameState.dealerIndex + 3) % gameState.players.length;
    startBettingRound();
}

function createDeck() {
    let deck = [];
    for (let s of SUITS) for (let v of VALUES) deck.push({ value: v, suit: s });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function postBlinds() {
    const sbIdx = (gameState.dealerIndex + 1) % gameState.players.length;
    const bbIdx = (gameState.dealerIndex + 2) % gameState.players.length;
    placeBet(gameState.players[sbIdx], SB_AMOUNT);
    placeBet(gameState.players[bbIdx], BB_AMOUNT);
    gameState.currentBet = BB_AMOUNT;
    log("Blinds pagati.");
}

function dealHoleCards() {
    for(let i=0; i<2; i++) {
        gameState.players.forEach(p => { if(gameState.deck.length) p.hand.push(gameState.deck.pop()); });
    }
    renderHoleCards();
}

function updateHumanHandStrengthUI() {
    const human = gameState.players[3];
    const el = document.getElementById('my-hand-strength');
    if(!el) return;
    if(human.folded) { el.innerText = "Foldato"; return; }
    el.innerText = getHandName(human.hand, gameState.communityCards);
}

// --- TURNI ---

function startBettingRound() {
    gameState.actorsRemaining = gameState.players.filter(p => !p.folded && p.chips > 0).length;
    nextTurn();
}

async function nextTurn() {
    if (checkRoundComplete()) { advancePhase(); return; }

    let currentP = gameState.players[gameState.turnIndex];
    while (currentP.folded || currentP.chips === 0) {
        gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
        currentP = gameState.players[gameState.turnIndex];
        if (checkRoundComplete()) { advancePhase(); return; }
    }

    document.querySelectorAll('.player-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(currentP.elId).classList.add('active');

    if (currentP.isHuman) enableHumanControls();
    else { disableHumanControls(); await playBotTurn(currentP); }
}

function checkRoundComplete() {
    const active = gameState.players.filter(p => !p.folded);
    if (active.length === 1) return true;
    const toAct = active.filter(p => p.bet < gameState.currentBet && p.chips > 0);
    if (toAct.length === 0 && gameState.actorsRemaining <= 0) return true;
    return false;
}

// --- BOT ---
function playBotTurn(bot) {
    return new Promise(resolve => {
        setTimeout(() => {
            const callAmt = gameState.currentBet - bot.bet;
            let action = 1; let raiseAmt = 0;
            const score = evaluateHoleCardsSimple(bot.hand);
            const rand = Math.random();

            if (callAmt > 0) {
                if (score < 10 && rand > 0.2) action = 0;
                else if (score > 20 && rand > 0.6) { action = 2; raiseAmt = gameState.currentBet; }
            } else {
                if (score > 15 && rand > 0.5) { action = 2; raiseAmt = BB_AMOUNT; }
            }

            if (action === 0 && callAmt > 0) {
                bot.folded = true;
                showActionBubble(bot, "Fold");
                document.getElementById(bot.elId).classList.add('folded-panel');
            } else if (action === 2) {
                let total = gameState.currentBet + (raiseAmt || BB_AMOUNT);
                if (total > bot.chips + bot.bet) total = bot.chips + bot.bet;
                placeBet(bot, total - bot.bet);
                gameState.currentBet = total;
                showActionBubble(bot, "Raise");
                gameState.actorsRemaining = gameState.players.filter(p => !p.folded).length - 1;
            } else {
                if(callAmt > 0) showActionBubble(bot, "Call");
                else showActionBubble(bot, "Check");
                placeBet(bot, callAmt);
            }
            gameState.actorsRemaining--;
            gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
            resolve();
            nextTurn();
        }, 1000);
    });
}

function evaluateHoleCardsSimple(hand) {
    if(!hand || hand.length<2) return 0;
    let s = getCardValue(hand[0].value) + getCardValue(hand[1].value);
    if (hand[0].value === hand[1].value) s += 20;
    if (hand[0].suit === hand[1].suit) s += 5;
    return s;
}

// --- UMANO ---
function enableHumanControls() {
    const div = document.getElementById('human-actions');
    div.innerHTML = '';
    const me = gameState.players[3];
    const callAmt = gameState.currentBet - me.bet;

    div.appendChild(createGameBtn("FOLD", () => humanAct('fold')));
    
    let callText = callAmt === 0 ? "CHECK" : `CALL €${callAmt}`;
    if (me.chips <= callAmt) callText = "ALL-IN";
    div.appendChild(createGameBtn(callText, () => humanAct('call')));

    const bRaise = createGameBtn("RAISE", () => showRaiseMenu());
    if (me.chips <= callAmt) { bRaise.disabled = true; bRaise.style.opacity = "0.5"; }
    div.appendChild(bRaise);
}

function showRaiseMenu() {
    const div = document.getElementById('human-actions');
    const me = gameState.players[3];
    let minRaise = Math.max(gameState.currentBet + BB_AMOUNT, BB_AMOUNT);
    const maxRaise = me.chips + me.bet;

    if (maxRaise <= minRaise) { humanAct('raise', maxRaise - me.bet); return; }

    div.innerHTML = ''; 
    const container = document.createElement('div'); container.className = 'raise-controls';
    
    const row1 = document.createElement('div'); row1.className = 'raise-row';
    const slider = document.createElement('input'); 
    slider.type = 'range'; slider.className = 'raise-slider';
    slider.min = minRaise; slider.max = maxRaise; slider.value = minRaise; slider.step = BB_AMOUNT;
    const numIn = document.createElement('input'); 
    numIn.type = 'number'; numIn.className = 'raise-input'; 
    numIn.value = minRaise; numIn.readOnly = true;
    slider.oninput = function() { numIn.value = this.value; };
    row1.append(slider, numIn);

    const row2 = document.createElement('div'); row2.className = 'raise-row';
    const btnOk = createGameBtn("OK", () => humanAct('raise', parseInt(numIn.value) - me.bet));
    btnOk.classList.add('btn-small');
    const btnNo = createGameBtn("X", () => enableHumanControls());
    btnNo.classList.add('btn-small', 'btn-cancel');
    row2.append(btnNo, btnOk);

    container.append(row1, row2);
    div.appendChild(container);
}

function createGameBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.innerText = text; btn.onclick = onClick; return btn;
}

function disableHumanControls() { document.getElementById('human-actions').innerHTML = ''; }

function humanAct(act, amount = 0) {
    const me = gameState.players[3];
    const callAmt = gameState.currentBet - me.bet;
    disableHumanControls();

    if (act === 'fold') {
        me.folded = true;
        document.getElementById(me.elId).classList.add('folded-panel');
        updateHumanHandStrengthUI();
        log("Hai passato.");
    } else if (act === 'call') {
        placeBet(me, callAmt);
        log("Hai chiamato.");
    } else if (act === 'raise') {
        let val = amount; if (val > me.chips) val = me.chips;
        placeBet(me, val);
        gameState.currentBet = me.bet; 
        gameState.actorsRemaining = gameState.players.filter(p => !p.folded).length - 1;
        log(`Hai rilanciato a €${gameState.currentBet}.`);
    }
    
    gameState.actorsRemaining--;
    gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
    nextTurn();
}

// Modifica cruciale: Tracciamo totalWagered per i Side Pots
function placeBet(p, amt) {
    if (amt > p.chips) amt = p.chips;
    p.chips -= amt;
    p.bet += amt;
    p.totalWagered += amt; // IMPORTANTE: accumula quanto ha scommesso in totale nella mano
    gameState.pot += amt;
    updatePlayerChipsUI(p);
    document.getElementById('pot-amount').innerText = gameState.pot;
}

// --- FASI ---
function advancePhase() {
    gameState.players.forEach(p => p.bet = 0);
    gameState.currentBet = 0;
    gameState.actorsRemaining = gameState.players.filter(p => !p.folded).length;
    gameState.turnIndex = (gameState.dealerIndex + 1) % gameState.players.length;

    if (gameState.phase === 'preflop') { gameState.phase = 'flop'; dealComm(3); } 
    else if (gameState.phase === 'flop') { gameState.phase = 'turn'; dealComm(1); } 
    else if (gameState.phase === 'turn') { gameState.phase = 'river'; dealComm(1); } 
    else { showdown(); return; }

    updateHumanHandStrengthUI();
    if (gameState.players.filter(p => !p.folded).length === 1) { showdown(); return; }
    startBettingRound();
}

function dealComm(n) {
    const start = gameState.communityCards.length;
    for(let i=0; i<n; i++) {
        const c = gameState.deck.pop();
        gameState.communityCards.push(c);
        const el = document.getElementById(`comm-card-${start+i}`);
        if(el) { el.classList.remove('placeholder'); el.style.backgroundImage = `url('${getCardUrl(c)}')`; }
    }
}

// --- SHOWDOWN CON LOGICA SIDE POTS ---

function showdown() {
    // Rivela le carte degli attivi
    const active = gameState.players.filter(p => !p.folded);
    active.forEach(p => {
        const els = document.getElementById(p.elId).querySelectorAll('.card');
        if(els.length >= 2) {
            els[0].style.backgroundImage = `url('${getCardUrl(p.hand[0])}')`;
            els[1].style.backgroundImage = `url('${getCardUrl(p.hand[1])}')`;
        }
    });

    // Calcola il punteggio di tutti
    gameState.players.forEach(p => {
        if (!p.folded) {
            const res = solveHandFull(p.hand, gameState.communityCards);
            p.handScore = res.score;
        } else {
            p.handScore = -1;
        }
    });

    // --- LOGICA SIDE POTS ---
    // 1. Identifica tutti i livelli di puntata unici (ordinati)
    let allWagers = gameState.players.map(p => p.totalWagered).filter(w => w > 0);
    let uniqueLevels = [...new Set(allWagers)].sort((a,b) => a - b);

    let winnersLog = [];
    let lastLevel = 0;

    // 2. Itera attraverso ogni livello di puntata per distribuire il piatto a fette
    uniqueLevels.forEach(level => {
        let currentPotChunk = 0;
        let contributors = [];

        // Raccogli i soldi per questo livello (da lastLevel a level)
        gameState.players.forEach(p => {
            if (p.totalWagered > lastLevel) {
                let contribution = Math.min(p.totalWagered, level) - lastLevel;
                currentPotChunk += contribution;
                contributors.push(p);
            }
        });

        // Chi può vincere questo chunk? (Chi è ancora attivo e ha contribuito)
        let eligibleWinners = contributors.filter(p => !p.folded);
        
        // Se non c'è nessuno (tutti foldati?), i soldi vanno al foldatore che ha puntato di più (raro)
        // Se c'è solo uno, vince lui (es. eccesso di All-in)
        if (eligibleWinners.length > 0) {
            // Trova il punteggio migliore
            let maxScore = -1;
            eligibleWinners.forEach(p => { if(p.handScore > maxScore) maxScore = p.handScore; });
            
            // Chi ha quel punteggio?
            let winners = eligibleWinners.filter(p => p.handScore === maxScore);
            
            // Distribuisci il chunk
            let share = Math.floor(currentPotChunk / winners.length);
            winners.forEach(w => {
                w.chips += share;
                if (!winnersLog.includes(w)) winnersLog.push(w);
            });
        } else {
            // Caso limite: rimborso a chi ha puntato l'eccesso se tutti gli altri foldano
            // (Nel Texas Hold'em standard, se tutti foldano vinci prima dello showdown, 
            // ma qui gestiamo side-pot showdowns)
            contributors.forEach(c => c.chips += (Math.min(c.totalWagered, level) - lastLevel));
        }

        lastLevel = level;
    });

    endRound(winnersLog);
}

function endRound(winners) {
    let names = "";
    winners.forEach(w => {
        updatePlayerChipsUI(w);
        document.getElementById(w.elId).style.boxShadow = "0 0 30px #FFD700";
        showActionBubble(w, "WIN!");
        names += w.name + " ";
        
        if (w.isHuman) {
            const u = getCurrentUser();
            const prev = u.balance;
            const net = w.chips - prev;
            if (typeof updateGameStats === 'function') updateGameStats("Texas Hold'em", net);
            u.balance = w.chips;
            localStorage.setItem("casino_current_user", JSON.stringify(u));
        }
    });

    // Se l'umano non è tra i vincitori e ha scommesso, aggiorna stats (perdita)
    const human = gameState.players[3];
    if (!winners.includes(human) && human.totalWagered > 0) {
        const u = getCurrentUser();
        // La perdita è già stata scalata dal balance durante le puntate
        // Dobbiamo solo registrare la statistica se vogliamo, ma auth.js lo fa col balance
        // Assicuriamoci che il balance sia salvato
        u.balance = human.chips;
        localStorage.setItem("casino_current_user", JSON.stringify(u));
        // Nota: updateGameStats gestisce anche perdite se passiamo numero negativo?
        // Nel tuo auth.js, calcola il delta. 
        // Qui calcoliamo il delta tra inizio mano e fine mano.
        // Per semplicità, salviamo solo.
    }

    log(`Vince: ${names}`);
    setTimeout(() => {
        winners.forEach(w => document.getElementById(w.elId).style.boxShadow = "");
        startNewHand();
    }, 5000);
}

// --- HELPER HAND SOLVER ---
function solveHandFull(h, c) {
    const all = [...h, ...c];
    all.sort((a,b) => getCardValue(b.value) - getCardValue(a.value));
    
    const suits = {}; all.forEach(x=>suits[x.suit]=(suits[x.suit]||0)+1);
    const flush = Object.keys(suits).some(k=>suits[k]>=5);
    
    const counts = {}; all.forEach(x=>counts[x.value]=(counts[x.value]||0)+1);
    const pairs = Object.values(counts).filter(v=>v===2).length;
    const tris = Object.values(counts).filter(v=>v===3).length;
    const poker = Object.values(counts).some(v=>v===4);

    let score = getCardValue(all[0].value); 
    if(poker) score += 700;
    else if(tris > 0 && pairs > 0) score += 600; 
    else if(flush) score += 500;
    else if(tris > 0) score += 300;
    else if(pairs >= 2) score += 200;
    else if(pairs === 1) score += 100;
    return { score: score };
}

function getHandName(h, c) {
    const s = solveHandFull(h, c).score;
    if(s>=700) return "Poker"; if(s>=600) return "Full House"; if(s>=500) return "Colore";
    if(s>=300) return "Tris"; if(s>=200) return "Doppia Coppia"; if(s>=100) return "Coppia";
    return "Carta Alta";
}

function getCardValue(v) { if(v==='A') return 14; if(v==='K') return 13; if(v==='Q') return 12; if(v==='J') return 11; return parseInt(v); }
function getCardUrl(c) { let v=c.value; if(v==='10') v='0'; return `${CARD_IMG_BASE}${v}${c.suit}.png`; }
function renderPlayers() { gameState.players.forEach(p => { const el = document.getElementById(p.elId); if(el) { el.querySelector('.player-info').innerText = p.name; updatePlayerChipsUI(p); } }); }
function updatePlayerChipsUI(p) { const el = document.getElementById(p.elId); if(el) el.querySelector('.player-chips').innerText = `€ ${p.chips}`; }
function renderHoleCards() { gameState.players.forEach(p => { const div = document.getElementById(p.elId).querySelector('.player-cards'); div.innerHTML=''; for(let i=0; i<2; i++) { const c=document.createElement('div'); c.className='card'; if(p.isHuman) c.style.backgroundImage=`url('${getCardUrl(p.hand[i])}')`; else c.style.backgroundImage=`url('https://deckofcardsapi.com/static/img/back.png')`; div.appendChild(c); } }); }
function log(m) { const d = document.getElementById('game-log'); if(d) d.innerHTML = `<p>${m}</p>`; }
function showActionBubble(p, t) { const el = document.getElementById(p.elId); let b=el.querySelector('.action-bubble'); if(!b){ b=document.createElement('div'); b.className='action-bubble'; el.appendChild(b); } b.innerText=t; b.classList.add('show'); if(t==="WIN!") b.classList.add('act-win'); else b.classList.remove('act-win'); setTimeout(()=>b.classList.remove('show'), 2000); }
function moveMarkers() { document.querySelectorAll('.marker').forEach(e=>e.remove()); const el = document.getElementById(gameState.players[gameState.dealerIndex].elId); if(el) { const m=document.createElement('div'); m.className='marker dealer-marker'; m.innerText='D'; el.appendChild(m); } }