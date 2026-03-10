document.addEventListener('DOMContentLoaded', () => {
    initGame();
});

// --- STATO DEL GIOCO ---
let currentUser = JSON.parse(localStorage.getItem("casino_current_user"));
let bankValue = currentUser ? currentUser.balance : 0;
let currentBetTotal = 0;
let selectedChipValue = 5;

// Gestione Puntate
let bets = {}; 
let betHistoryStack = [];
let lastRoundBets = {};

// ORDINE ESATTO RUOTA EUROPEA (Senso Orario partendo dallo 0)
const WHEEL_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Mappatura Colori per logica vincita
const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function initGame() {
    if(!currentUser) { 
        alert("Accedi per giocare!"); 
        window.location.href = "../login.html"; 
        return; 
    }
    generateNumbersGrid();
    updateHUD();
}

function generateNumbersGrid() {
    const board = document.getElementById('betting-board');
    // Genera celle 1-36
    for(let i=1; i<=36; i++) {
        const el = document.createElement('div');
        const isRed = RED_NUMS.includes(i);
        el.className = `bet-spot number-cell ${isRed ? 'red' : 'black'}`;
        el.innerText = i;
        el.dataset.id = i.toString();
        
        // Layout Griglia
        let row;
        if (i % 3 === 0) row = 1;      
        else if (i % 3 === 2) row = 2; 
        else row = 3;                  
        
        el.style.gridColumn = Math.ceil(i/3) + 1;
        el.style.gridRow = row;
        
        el.onclick = () => placeBet(i.toString(), 35);
        
        const overlay = document.createElement('div');
        overlay.className = 'bet-overlay';
        el.appendChild(overlay);
        
        board.appendChild(el);
    }
}

function selectChip(val) {
    selectedChipValue = val;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    const target = val === 'all-in' ? document.querySelector('.chip.all-in') : document.querySelector(`.chip[data-value="${val}"]`);
    if(target) target.classList.add('selected');
}

// --- LOGICA PUNTATA ---
function placeBet(betId, payoutRatio, amountOverride = null) {
    let amount = (amountOverride !== null) ? amountOverride : (selectedChipValue === 'all-in' ? bankValue : selectedChipValue);
    
    if(amount > bankValue) { message("Saldo insufficiente!"); return; }
    if(amount <= 0) return;

    bankValue -= amount;
    currentBetTotal += amount;
    
    if(!bets[betId]) bets[betId] = { amount: 0, payout: payoutRatio };
    bets[betId].amount += amount;

    if(amountOverride === null) betHistoryStack.push({ id: betId, amount: amount });

    updateSpotUI(betId);
    updateHUD();
}

function updateSpotUI(betId) {
    let el;
    if(!isNaN(betId)) {
        if(betId == '0') el = document.querySelector('.number-0');
        else el = document.querySelector(`.number-cell[data-id="${betId}"]`);
    } else {
        // Cerca puntate esterne tramite data-id
        el = document.querySelector(`.bet-spot[data-id="${betId}"]`);
    }

    if(el) {
        const ov = el.querySelector('.bet-overlay');
        if(bets[betId] && bets[betId].amount > 0) {
            ov.innerText = bets[betId].amount;
            ov.classList.add('active');
        } else {
            ov.classList.remove('active');
            ov.innerText = "";
        }
    }
}

// --- FUNZIONI CONTROLLO ---
function undoLastBet() {
    if(betHistoryStack.length === 0) return;
    const lastAction = betHistoryStack.pop();
    const betId = lastAction.id;
    
    bets[betId].amount -= lastAction.amount;
    bankValue += lastAction.amount;
    currentBetTotal -= lastAction.amount;
    
    if(bets[betId].amount <= 0) delete bets[betId];
    
    updateSpotUI(betId);
    updateHUD();
}

function rebet() {
    if(Object.keys(lastRoundBets).length === 0) { message("Nessuna puntata precedente."); return; }
    let cost = 0;
    for(let k in lastRoundBets) cost += lastRoundBets[k].amount;
    if(cost > bankValue) { message("Saldo insufficiente."); return; }
    
    clearBets();
    for(let k in lastRoundBets) placeBet(k, lastRoundBets[k].payout, lastRoundBets[k].amount);
    betHistoryStack = [];
}

function doubleBets() {
    if(currentBetTotal === 0) return;
    if(currentBetTotal > bankValue) { message("Saldo insufficiente."); return; }
    Object.keys(bets).forEach(key => placeBet(key, bets[key].payout, bets[key].amount));
    betHistoryStack = [];
}

function clearBets() {
    bankValue += currentBetTotal;
    currentBetTotal = 0;
    Object.keys(bets).forEach(key => { bets[key].amount = 0; updateSpotUI(key); });
    bets = {};
    betHistoryStack = [];
    updateHUD();
}

// --- SPIN & CALCOLO VINCITA ---
function spinWheel() {
    if(currentBetTotal === 0) { message("Punta qualcosa!"); return; }
    
    const spinBtn = document.getElementById('spin-btn');
    spinBtn.disabled = true;
    lastRoundBets = JSON.parse(JSON.stringify(bets));
    
    message("Rien ne va plus!");

    // 1. Determina Numero Vincente
    const winNum = Math.floor(Math.random() * 37);
    
    // 2. Calcola Rotazione
    const sliceDeg = 360 / 37;
    const index = WHEEL_NUMBERS.indexOf(winNum);
    const targetAngle = 360 - (index * sliceDeg);
    const extraSpins = 360 * 10;
    const finalRotation = extraSpins + targetAngle;
    
    const wheel = document.getElementById('wheel');
    const ball = document.getElementById('ball-container');
    
    // Reset transizioni per sicurezza
    wheel.style.transition = "transform 4s cubic-bezier(0.15, 0, 0.2, 1)";
    ball.style.transition = "transform 4s cubic-bezier(0.15, 0, 0.2, 1)";
    
    // Applica Rotazioni
    wheel.style.transform = `rotate(${finalRotation}deg)`;
    ball.style.transform = `rotate(-${360 * 3}deg)`; 

    // 3. Risolvi gioco alla fine dell'animazione
    setTimeout(() => { 
        resolveGame(winNum); 
        spinBtn.disabled = false;
        
        // Reset silenzioso
        setTimeout(() => {
            wheel.style.transition = "none";
            wheel.style.transform = `rotate(${targetAngle}deg)`;
            ball.style.transition = "none";
            ball.style.transform = "rotate(0deg)";
        }, 1000);

    }, 4000);
}

function resolveGame(n) {
    let totalWin = 0;
    
    for(let betId in bets) {
        const bet = bets[betId];
        const amt = bet.amount;
        let won = false;
        
        // Logica Vincita
        if(betId === n.toString()) won = true;
        else if(betId === 'red' && RED_NUMS.includes(n)) won = true;
        else if(betId === 'black' && !RED_NUMS.includes(n) && n !== 0) won = true;
        else if(betId === 'even' && n !== 0 && n % 2 === 0) won = true;
        else if(betId === 'odd' && n !== 0 && n % 2 !== 0) won = true;
        else if(betId === '1-18' && n >= 1 && n <= 18) won = true;
        else if(betId === '19-36' && n >= 19 && n <= 36) won = true;
        else if(betId === '1st12' && n >= 1 && n <= 12) won = true;
        else if(betId === '2nd12' && n >= 13 && n <= 24) won = true;
        else if(betId === '3rd12' && n >= 25 && n <= 36) won = true;
        else if(betId === 'col1' && n % 3 === 1) won = true;
        else if(betId === 'col2' && n % 3 === 2) won = true;
        else if(betId === 'col3' && n % 3 === 0 && n !== 0) won = true;
        
        if(won) totalWin += amt * bet.payout + amt;
    }
    
    bankValue += totalWin;
    
    // Aggiorna Display Numero
    const winDisp = document.getElementById('winning-number-display');
    winDisp.innerText = n;
    const isRed = RED_NUMS.includes(n);
    winDisp.style.backgroundColor = n === 0 ? '#006600' : (isRed ? '#d40000' : '#111');
    
    if(totalWin > 0) message(`VINTO €${totalWin}!`);
    else message(`Uscito ${n}.`);
    
    // Pulisci
    bets = {};
    betHistoryStack = [];
    currentBetTotal = 0;
    document.querySelectorAll('.bet-overlay').forEach(o => o.classList.remove('active'));
    
    saveData();
    updateHUD();
}

function saveData() {
    currentUser.balance = bankValue;
    localStorage.setItem("casino_current_user", JSON.stringify(currentUser));
}

function updateHUD() {
    document.getElementById('bank-value').innerText = "€" + bankValue;
    document.getElementById('current-bet').innerText = "€" + currentBetTotal;
    
    document.getElementById('undo-btn').disabled = (betHistoryStack.length === 0);
    document.getElementById('clear-btn').disabled = (currentBetTotal === 0);
    document.getElementById('rebet-btn').disabled = (Object.keys(lastRoundBets).length === 0 || currentBetTotal > 0);
    document.getElementById('double-btn').disabled = (currentBetTotal === 0);
}

function message(txt) { document.getElementById('message-area').innerText = txt; }