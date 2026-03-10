// --- Elementi DOM ---
const messageEl = document.getElementById("message-el");
const dealerSumEl = document.getElementById("dealer-sum-el");
const dealerCardsEl = document.getElementById("dealer-cards-el");
const playerHandsEl = document.getElementById("player-hands-el");
const playerBalanceEl = document.getElementById("player-balance-el");
const currentBetEl = document.getElementById("current-bet-el");

// Pulsanti
const confirmBetBtn = document.getElementById("confirm-bet-btn");
const clearBtn = document.getElementById("clear-btn");
const hitBtn = document.getElementById("hit-btn");
const standBtn = document.getElementById("stand-btn");
const doubleBtn = document.getElementById("double-btn");
const splitBtn = document.getElementById("split-btn");

const bettingArea = document.getElementById("betting-area");
const actionsArea = document.getElementById("actions-area");

// --- Variabili di Stato ---
let deck = [];
let dealerHand = [];
let dealerSum = 0;
let currentBet = 0;
let playerHands = []; 
let playerBets = [];  
let playerSums = [];
let activeHandIndex = 0;
let isRoundOver = true;

// Integrazione Auth
let currentUser = JSON.parse(localStorage.getItem("casino_current_user"));
let playerBalance = currentUser ? currentUser.balance : 0;

// --- Funzioni di Utilità per il Salvataggio ---
function saveGame() {
    if(currentUser) {
        currentUser.balance = playerBalance;
        localStorage.setItem("casino_current_user", JSON.stringify(currentUser));
        let allUsers = JSON.parse(localStorage.getItem("casino_users")) || [];
        let index = allUsers.findIndex(u => u.username === currentUser.username);
        if(index !== -1) {
            allUsers[index] = currentUser;
            localStorage.setItem("casino_users", JSON.stringify(allUsers));
        }
        if(typeof updateAuthUI === "function") updateAuthUI();
    }
}

// --- Inizializzazione ---
function init() {
    if(!currentUser) {
        alert("Devi accedere per giocare!");
        window.location.href = "../login.html";
        return;
    }
    updateUI();
}

// --- Gestori di Eventi ---
bettingArea.addEventListener("click", (e) => {
    if (e.target.classList.contains("chip") && !e.target.classList.contains('disabled')) {
        const value = e.target.dataset.value;
        if (value === 'all-in') placeBet(playerBalance);
        else placeBet(parseInt(value));
    }
});

confirmBetBtn.addEventListener("click", () => {
    if (!confirmBetBtn.disabled) startNewRound();
});

clearBtn.addEventListener("click", () => {
    if(!clearBtn.disabled) clearBets();
});

// Listeners per le azioni di gioco
hitBtn.addEventListener("click", () => actionHandler(performHitLogic));
standBtn.addEventListener("click", () => actionHandler(stand));
doubleBtn.addEventListener("click", () => actionHandler(doubleDown));
splitBtn.addEventListener("click", () => actionHandler(splitHand));

function actionHandler(actionFn) {
    if (isRoundOver) return;
    actionFn();
}

// --- Logica Principale del Gioco ---

function clearBets(){
    playerBalance += currentBet;
    currentBet = 0;
    saveGame();
    updateUI();
}

function startNewRound() {
    if (currentBet === 0) return;

    isRoundOver = false;
    messageEl.textContent = "Partita iniziata!";

    createDeck();
    shuffleDeck();

    // Distribuzione Iniziale
    playerHands = [[drawCard(), drawCard()]];
    playerBets = [currentBet];
    dealerHand = [drawCard(), drawCard()];
    
    activeHandIndex = 0;
    playerBalance -= currentBet;
    saveGame();

    bettingArea.classList.add('hidden');
    actionsArea.classList.remove('hidden');

    updateGameState();
    
    // Controllo Blackjack immediato del giocatore
    if (playerSums[0] === 21) {
        setTimeout(stand, 500);
    }
}

function updateGameState() {
    playerSums = playerHands.map(h => calculateSum(h));
    dealerSum = calculateSum(dealerHand);

    renderGame();
    updateButtonStates();
}

function renderGame() {
    playerBalanceEl.textContent = "€" + playerBalance;
    
    const totalActiveBet = playerBets.reduce((a, b) => a + b, 0);
    currentBetEl.textContent = "€" + (isRoundOver ? currentBet : totalActiveBet);

    // Render del Banco
    dealerCardsEl.innerHTML = "";
    if (isRoundOver) {
        dealerSumEl.textContent = dealerSum;
        dealerHand.forEach(card => renderCard(card, dealerCardsEl));
    } else {
        dealerSumEl.textContent = "?";
        renderCard(dealerHand[0], dealerCardsEl);
        renderHiddenCard(dealerCardsEl);
    }

    // Render del Giocatore
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
    const hand = playerHands[activeHandIndex];
    hand.push(drawCard());
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
    while (calculateSum(dealerHand) < 17) {
        dealerHand.push(drawCard());
    }
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
        const bet = playerBets[i];
        const isBJ = (pSum === 21 && hand.length === 2);

        if (pSum > 21) {
            feedback += `Mano ${i+1}: Perso. `;
        } else if (dSum > 21 || pSum > dSum) {
            let win = isBJ ? bet * 2.5 : bet * 2;
            totalWon += win;
            feedback += `Mano ${i+1}: Vinto €${win.toFixed(2)}! `;
        } else if (pSum === dSum) {
            totalWon += bet; // Push
            feedback += `Mano ${i+1}: Pareggio. `;
        } else {
            feedback += `Mano ${i+1}: Perso. `;
        }
    });

    playerBalance += totalWon;
    currentBet = 0;
    saveGame();
    messageEl.textContent = feedback;
    
    bettingArea.classList.remove('hidden');
    actionsArea.classList.add('hidden');
    updateUI();
}

function doubleDown() {
    const bet = playerBets[activeHandIndex];
    if(playerBalance < bet) {
        alert("Saldo insufficiente per raddoppiare!"); return;
    }
    playerBalance -= bet;
    playerBets[activeHandIndex] += bet;
    saveGame();
    
    const hand = playerHands[activeHandIndex];
    hand.push(drawCard());
    updateGameState();
    
    // Il raddoppio forza lo stand
    setTimeout(stand, 800);
}

function splitHand() {
    const hand = playerHands[activeHandIndex];
    const bet = playerBets[activeHandIndex];
    
    if(playerBalance < bet) { alert("Saldo insufficiente per dividere!"); return; }
    
    playerBalance -= bet;
    saveGame();

    const card1 = hand[0];
    const card2 = hand[1];
    
    playerHands[activeHandIndex] = [card1, drawCard()];
    playerHands.splice(activeHandIndex + 1, 0, [card2, drawCard()]);
    playerBets.splice(activeHandIndex + 1, 0, bet);
    
    updateGameState();
}

// --- Utilità per le Carte ---
function createDeck() {
    const suits = ['♥', '♦', '♣', '♠']; 
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    deck = [];
    suits.forEach(s => values.forEach(v => deck.push({ suit: s, value: v })));
}
function shuffleDeck() {
    deck.sort(() => Math.random() - 0.5);
}
function drawCard() {
    if(deck.length === 0) {
        messageEl.textContent = "Rimescolo del mazzo...";
        createDeck();
        shuffleDeck();
    }
    return deck.pop();
}
function getCardValue(card) {
    if(!card) return 0;
    if(['J','Q','K'].includes(card.value)) return 10;
    if(card.value === 'A') return 11;
    return parseInt(card.value);
}
function calculateSum(hand) {
    let sum = 0; let aces = 0;
    hand.forEach(c => {
        sum += getCardValue(c);
        if(c.value === 'A') aces++;
    });
    while(sum > 21 && aces > 0) {
        sum -= 10; aces--;
    }
    return sum;
}

// --- Utilità di Render ---
function renderCard(card, container) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerText = card.value + card.suit;
    if(['♥', '♦'].includes(card.suit)) div.classList.add('red-card');
    else div.classList.add('black-card');
    container.appendChild(div);
}
function renderHiddenCard(container) {
    const div = document.createElement("div");
    div.className = "card hidden-card";
    div.innerText = "?";
    container.appendChild(div);
}

// --- Aggiornamento UI ---
function updateUI() {
    playerBalanceEl.textContent = "€" + playerBalance.toFixed(2);
    currentBetEl.textContent = "€" + currentBet.toFixed(2);
    
    const chips = document.querySelectorAll(".chips-panel .chip");
    chips.forEach(c => {
        const val = c.dataset.value === 'all-in' ? playerBalance : parseInt(c.dataset.value);
        if(val > playerBalance || !isRoundOver || val <= 0) {
            c.classList.add('disabled');
        } else {
            c.classList.remove('disabled');
        }
    });
    
    confirmBetBtn.disabled = (currentBet === 0 || !isRoundOver);
    clearBtn.disabled = (currentBet === 0 || !isRoundOver);
    updateButtonStates();
}

function updateButtonStates() {
    if(isRoundOver){
        splitBtn.disabled = true;
        doubleBtn.disabled = true;
        return;
    }
    const hand = playerHands[activeHandIndex];
    const sum = playerSums[activeHandIndex];
    const bet = playerBets[activeHandIndex];

    const canSplit = hand.length === 2 && getCardValue(hand[0]) === getCardValue(hand[1]);
    const canDouble = hand.length === 2 && playerBalance >= bet;

    splitBtn.disabled = !canSplit;
    doubleBtn.disabled = !canDouble;
    hitBtn.disabled = (sum >= 21);
    standBtn.disabled = (sum >= 21);
}

function placeBet(amount) {
    if(amount > playerBalance) amount = playerBalance;
    if (amount <= 0) return;
    currentBet += amount;
    updateUI();
}

// Avvio
init();
