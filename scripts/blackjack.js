// --- Elementi DOM ---
const messageEl      = document.getElementById("message-el");
const dealerSumEl    = document.getElementById("dealer-sum-el");
const dealerCardsEl  = document.getElementById("dealer-cards-el");
const playerHandsEl  = document.getElementById("player-hands-el");
const playerBalanceEl = document.getElementById("player-balance-el");
const currentBetEl   = document.getElementById("current-bet-el");

const confirmBetBtn = document.getElementById("confirm-bet-btn");
const clearBtn      = document.getElementById("clear-btn");
const hitBtn        = document.getElementById("hit-btn");
const standBtn      = document.getElementById("stand-btn");
const doubleBtn     = document.getElementById("double-btn");
const splitBtn      = document.getElementById("split-btn");

const bettingArea  = document.getElementById("betting-area");
const actionsArea  = document.getElementById("actions-area");

// --- Stato ---
let deck         = [];
let dealerHand   = [];
let dealerSum    = 0;
let currentBet   = 0;
let roundTotalBet = 0; // somma di tutte le puntate nella mano (base + double + split)
let playerHands  = [];
let playerBets   = [];
let playerSums   = [];
let activeHandIndex = 0;
let isRoundOver  = true;

let playerBalance = (typeof getBalanceLocal === 'function') ? getBalanceLocal() : 0;
let _tavoloConfig = { limite_min: 5, limite_max: 1000 };
let _sessionStart = null;

// --- Init ---
async function init() {
    const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (!user) {
        alert("Devi accedere per giocare!");
        window.location.href = "login.html";
        return;
    }
    if (typeof syncBalanceOnLoad === 'function') {
        syncBalanceOnLoad().then(b => { playerBalance = b; updateUI(); });
    }
    if (typeof getTavoloConfig === 'function') {
        _tavoloConfig = await getTavoloConfig('BlackJack');
        if (_tavoloConfig?.attivo === false) {
            alert("Il tavolo BlackJack è momentaneamente chiuso.");
            window.location.href = "giochi.html";
            return;
        }
        if (typeof applyTavoloUI === 'function') applyTavoloUI(_tavoloConfig);
    }
    updateUI();
}

// --- Gestori eventi ---
bettingArea.addEventListener("click", (e) => {
    if (e.target.classList.contains("chip") && !e.target.classList.contains('disabled')) {
        const value = e.target.dataset.value;
        if (value === 'all-in') placeBetChip(playerBalance);
        else placeBetChip(parseInt(value));
    }
});

confirmBetBtn.addEventListener("click", () => { if (!confirmBetBtn.disabled) startNewRound(); });
clearBtn.addEventListener("click",      () => { if (!clearBtn.disabled) clearBets(); });

hitBtn.addEventListener("click",    () => actionHandler(performHitLogic));
standBtn.addEventListener("click",  () => actionHandler(stand));
doubleBtn.addEventListener("click", () => actionHandler(doubleDown));
splitBtn.addEventListener("click",  () => actionHandler(splitHand));

function actionHandler(actionFn) {
    if (isRoundOver) return;
    actionFn();
}

// --- Logica puntate ---
function clearBets() {
    playerBalance += currentBet;
    currentBet = 0;
    updateUI();
}

function placeBetChip(amount) {
    if (amount > playerBalance) amount = playerBalance;
    if (amount <= 0) return;
    currentBet += amount;
    playerBalance -= amount;
    updateUI();
}

// --- Round ---
function startNewRound() {
    if (currentBet === 0) return;
    if (currentBet < _tavoloConfig.limite_min) {
        messageEl.textContent = `Puntata minima: €${_tavoloConfig.limite_min}`;
        return;
    }
    if (currentBet > _tavoloConfig.limite_max) {
        messageEl.textContent = `Puntata massima: €${_tavoloConfig.limite_max}`;
        return;
    }
    _sessionStart = Date.now();

    isRoundOver = false;
    roundTotalBet = currentBet;
    messageEl.textContent = "Partita iniziata!";

    createDeck();
    shuffleDeck();

    playerHands = [[drawCard(), drawCard()]];
    playerBets  = [currentBet];
    dealerHand  = [drawCard(), drawCard()];
    activeHandIndex = 0;

    // Il currentBet è già stato sottratto da playerBalance in placeBetChip
    bettingArea.classList.add('hidden');
    actionsArea.classList.remove('hidden');

    updateGameState();

    if (playerSums[0] === 21) setTimeout(stand, 500);
}

function updateGameState() {
    playerSums = playerHands.map(h => calculateSum(h));
    dealerSum  = calculateSum(dealerHand);
    renderGame();
    updateButtonStates();
}

function renderGame() {
    playerBalanceEl.textContent = "€" + playerBalance.toFixed(2);

    const totalActiveBet = playerBets.reduce((a, b) => a + b, 0);
    currentBetEl.textContent = "€" + (isRoundOver ? currentBet : totalActiveBet).toFixed(2);

    // Banco
    dealerCardsEl.innerHTML = "";
    if (isRoundOver) {
        dealerSumEl.textContent = dealerSum;
        dealerHand.forEach(card => renderCard(card, dealerCardsEl));
    } else {
        dealerSumEl.textContent = "?";
        renderCard(dealerHand[0], dealerCardsEl);
        renderHiddenCard(dealerCardsEl);
    }

    // Giocatore
    playerHandsEl.innerHTML = "";
    playerHands.forEach((hand, index) => {
        const handDiv = document.createElement("div");
        handDiv.className = `player-hand ${index === activeHandIndex && !isRoundOver ? 'active-hand' : ''}`;

        const sum = playerSums[index];
        handDiv.innerHTML = `<div style="margin-bottom:5px; color:#FFD700; font-size:0.9rem;">Mano ${index+1} (Puntata: €${playerBets[index]})</div>`;

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'cards-display';
        cardsDiv.style.minHeight = "80px";
        hand.forEach(card => renderCard(card, cardsDiv));

        const infoDiv = document.createElement("div");
        infoDiv.style.textAlign = "center";
        infoDiv.innerHTML = `<strong>Totale: ${sum}</strong>`;

        handDiv.appendChild(cardsDiv);
        handDiv.appendChild(infoDiv);
        playerHandsEl.appendChild(handDiv);
    });
}

function performHitLogic() {
    playerHands[activeHandIndex].push(drawCard());
    updateGameState();
    if (playerSums[activeHandIndex] > 21) {
        messageEl.textContent = "Sballato!";
        setTimeout(stand, 800);
    }
}

function stand() {
    if (activeHandIndex < playerHands.length - 1) {
        activeHandIndex++;
        if (playerHands[activeHandIndex].length === 1) {
            playerHands[activeHandIndex].push(drawCard());
        }
        updateGameState();
    } else {
        endRoundLogic();
    }
}

function dealerTurn() {
    while (calculateSum(dealerHand) < 17) dealerHand.push(drawCard());
    dealerSum = calculateSum(dealerHand);
}

function endRoundLogic() {
    isRoundOver = true;
    dealerTurn();
    updateGameState();

    let totalWon = 0;
    let feedback = "";

    playerHands.forEach((hand, i) => {
        const pSum = playerSums[i];
        const dSum = dealerSum;
        const bet  = playerBets[i];
        const isBJ = (pSum === 21 && hand.length === 2);

        if (pSum > 21) {
            feedback += `Mano ${i+1}: Perso. `;
        } else if (dSum > 21 || pSum > dSum) {
            const win = isBJ ? bet * 2.5 : bet * 2;
            totalWon += win;
            feedback += `Mano ${i+1}: Vinto €${win.toFixed(2)}! `;
        } else if (pSum === dSum) {
            totalWon += bet;
            feedback += `Mano ${i+1}: Pareggio. `;
        } else {
            feedback += `Mano ${i+1}: Perso. `;
        }
    });

    playerBalance += totalWon;
    messageEl.textContent = feedback;

    // Sincronizza con il DB: invia il netto della mano
    if (typeof recordGame === 'function') {
        const duration = _sessionStart ? Math.round((Date.now() - _sessionStart) / 1000) : 0;
        recordGame({ game: 'Blackjack', bet: roundTotalBet, payout: totalWon, duration }).then(b => {
            if (b !== null) { playerBalance = b; updateUI(); }
        });
        _sessionStart = null;
    }

    currentBet = 0;
    bettingArea.classList.remove('hidden');
    actionsArea.classList.add('hidden');
    updateUI();
}

function doubleDown() {
    const bet = playerBets[activeHandIndex];
    if (playerBalance < bet) { alert("Saldo insufficiente per raddoppiare!"); return; }

    playerBalance -= bet;
    roundTotalBet += bet;
    playerBets[activeHandIndex] += bet;

    playerHands[activeHandIndex].push(drawCard());
    updateGameState();
    setTimeout(stand, 800);
}

function splitHand() {
    const hand = playerHands[activeHandIndex];
    const bet  = playerBets[activeHandIndex];

    if (playerBalance < bet) { alert("Saldo insufficiente per dividere!"); return; }

    playerBalance -= bet;
    roundTotalBet += bet;

    const card1 = hand[0];
    const card2 = hand[1];

    playerHands[activeHandIndex] = [card1, drawCard()];
    playerHands.splice(activeHandIndex + 1, 0, [card2, drawCard()]);
    playerBets.splice(activeHandIndex + 1, 0, bet);

    updateGameState();
}

// --- Carte ---
function createDeck() {
    const suits  = ['♥','♦','♣','♠'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    deck = [];
    suits.forEach(s => values.forEach(v => deck.push({ suit: s, value: v })));
}
function shuffleDeck() { deck.sort(() => Math.random() - 0.5); }
function drawCard() {
    if (deck.length === 0) { createDeck(); shuffleDeck(); }
    return deck.pop();
}
function getCardValue(card) {
    if (!card) return 0;
    if (['J','Q','K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
}
function calculateSum(hand) {
    let sum = 0; let aces = 0;
    hand.forEach(c => { sum += getCardValue(c); if (c.value === 'A') aces++; });
    while (sum > 21 && aces > 0) { sum -= 10; aces--; }
    return sum;
}

// --- Render ---
function renderCard(card, container) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerText = card.value + card.suit;
    div.classList.add(['♥','♦'].includes(card.suit) ? 'red-card' : 'black-card');
    container.appendChild(div);
}
function renderHiddenCard(container) {
    const div = document.createElement("div");
    div.className = "card hidden-card";
    div.innerText = "?";
    container.appendChild(div);
}

// --- UI ---
function updateUI() {
    playerBalanceEl.textContent = "€" + playerBalance.toFixed(2);
    currentBetEl.textContent    = "€" + currentBet.toFixed(2);

    // Aggiorna anche la nav-bar saldo
    document.querySelectorAll('.nav-balance-amount').forEach(el => {
        el.textContent = '€' + playerBalance.toLocaleString('it-IT', { minimumFractionDigits: 2 });
    });

    document.querySelectorAll(".chips-panel .chip").forEach(c => {
        const val = c.dataset.value === 'all-in' ? playerBalance : parseInt(c.dataset.value);
        c.classList.toggle('disabled', val > playerBalance || !isRoundOver || val <= 0);
    });

    confirmBetBtn.disabled = (currentBet === 0 || !isRoundOver);
    clearBtn.disabled      = (currentBet === 0 || !isRoundOver);
    updateButtonStates();
}

function updateButtonStates() {
    if (isRoundOver) { splitBtn.disabled = true; doubleBtn.disabled = true; return; }

    const hand  = playerHands[activeHandIndex];
    const sum   = playerSums[activeHandIndex];
    const bet   = playerBets[activeHandIndex];

    splitBtn.disabled  = !(hand.length === 2 && getCardValue(hand[0]) === getCardValue(hand[1]) && playerBalance >= bet);
    doubleBtn.disabled = !(hand.length === 2 && playerBalance >= bet);
    hitBtn.disabled    = (sum >= 21);
    standBtn.disabled  = false;
}

// Avvio — aspetta che auth.js abbia verificato la sessione
document.addEventListener('authReady', init);
