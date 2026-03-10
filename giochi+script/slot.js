document.addEventListener("DOMContentLoaded", () => {
    // --- CONFIGURAZIONE ---
    const ROWS = 3;
    const COLUMNS = 5;
    const SPIN_DURATION_NORMAL = 1000;
    const SPIN_DURATION_TURBO = 100;
  
    const SYMBOLS = ["zeus", "ade", "poseidone", "10", "J", "Q", "K", "A", "scatter", "jolly"];
  
    // 60 LINEE DI PAGAMENTO
    // 0 = Alto, 1 = Centro, 2 = Basso
    const PAYLINES = [
        // --- 1. LE LINEE DRITTE (Base) ---
        [1, 1, 1, 1, 1], // Centro
        [0, 0, 0, 0, 0], // Alto
        [2, 2, 2, 2, 2], // Basso
  
        // --- 2. LE V E V INVERTITE ---
        [0, 1, 2, 1, 0], // V
        [2, 1, 0, 1, 2], // V Invertita
        [0, 1, 2, 2, 2], // V che rimane bassa
        [2, 1, 0, 0, 0], // V inv che rimane alta
  
        // --- 3. RICHIESTA UTENTE (I "Serpenti" Basso-Centro-Basso...) ---
        // Caso "10 rossi": Basso -> Centro -> Basso
        [2, 1, 2, 1, 2], // ZigZag Basso-Alto regolare
        [2, 1, 2, 2, 2], // Basso-Centro-Basso-Basso-Basso (Specifico!)
        [2, 1, 2, 1, 1], // Basso-Centro-Basso-Centro-Centro
        [2, 1, 2, 2, 1], 
  
        // Caso "J": Basso -> Centro -> Basso -> Basso
        [2, 1, 2, 2, 0], 
        
        // Caso "J alternativo": Basso -> Centro -> Centro -> Basso
        [2, 1, 1, 2, 2], // (Specifico!)
        [2, 1, 1, 2, 1],
        [2, 1, 1, 1, 2],
  
        // --- 4. I "SERPENTI" ALTI (Speculari a quelli bassi per bilanciare) ---
        [0, 1, 0, 1, 0], // ZigZag Alto-Basso regolare
        [0, 1, 0, 0, 0], // Alto-Centro-Alto-Alto-Alto
        [0, 1, 0, 1, 1], 
        [0, 1, 0, 0, 1],
        [0, 1, 1, 0, 0], // Alto-Centro-Centro-Alto-Alto
        [0, 1, 1, 0, 1],
  
        // --- 5. DIAGONALI ESTESE ---
        [0, 0, 1, 2, 2], // Alto -> Basso
        [2, 2, 1, 0, 0], // Basso -> Alto
        [0, 1, 1, 1, 0], // Ciotola Alta piccola
        [2, 1, 1, 1, 2], // Ciotola Bassa piccola
  
        // --- 6. VARIE CONNESSIONI COMUNI ---
        [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
        [1, 0, 1, 0, 1], [1, 2, 1, 2, 1],
        [0, 2, 0, 2, 0], [2, 0, 2, 0, 2],
        [0, 2, 2, 2, 0], [2, 0, 0, 0, 2],
        [1, 0, 1, 2, 1], [1, 2, 1, 0, 1],
        [0, 0, 1, 2, 1], [2, 2, 1, 0, 1],
        [0, 1, 2, 1, 1], [2, 1, 0, 1, 1],
        [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
        [0, 0, 0, 1, 2], [2, 2, 2, 1, 0],
        [0, 1, 2, 0, 1], [2, 1, 0, 2, 1],
        [0, 2, 0, 2, 1], [2, 0, 2, 0, 1],
        [1, 0, 2, 0, 1], [1, 2, 0, 2, 1],
        [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
        [1, 1, 0, 0, 1], [1, 1, 2, 2, 1],
        [1, 0, 0, 0, 0], [1, 2, 2, 2, 2]
    ];
  
    const PAYTABLE = {
        zeus:      { 2: 5,  3: 50, 4: 200, 5: 1000 },
        poseidone: { 2: 3,  3: 30, 4: 100, 5: 500 },
        ade:       { 2: 2,  3: 20, 4: 80,  5: 400 },
        A:         { 3: 10, 4: 40, 5: 150 },
        K:         { 3: 8,  4: 30, 5: 100 },
        Q:         { 3: 5,  4: 20, 5: 80 },
        J:         { 3: 4,  4: 15, 5: 60 },
        10:        { 3: 3,  4: 10, 5: 50 },
        scatter:   { 3: 0, 4: 0, 5: 0 },
        jolly:     { 3: 50, 4: 200, 5: 1000 }
    };
  
    // --- STATO ---
    let currentUser = JSON.parse(localStorage.getItem("casino_current_user"));
    let balance = currentUser ? currentUser.balance : 0;
    let bet = 10;
    let freeSpins = 0;
    let currentMultiplier = 1;
    let isSpinning = false;
    let isTurbo = false;
    let weightedSymbols = [];
    let slots = []; 
  
    // --- DOM ---
    const slotGrid = document.getElementById("slot-grid");
    const balanceDisplay = document.getElementById("balance-display");
    const betDisplay = document.getElementById("bet-display");
    const spinButton = document.getElementById("spin-button");
    const betPlusButton = document.getElementById("bet-plus-button");
    const betMinusButton = document.getElementById("bet-minus-button");
    const turboButton = document.getElementById("turbo-button");
    const messageBar = document.getElementById("message-bar");
    
    let multiplierDisplay = document.getElementById("multiplier-badge");
  
    // --- FUNZIONI ---
  
    function generateWeightedSymbolList() {
        weightedSymbols = [];
        const weights = {
            zeus: 2, poseidone: 3, ade: 4,
            A: 8, K: 10, Q: 15, J: 20, 10: 25,
            scatter: 3,
            jolly: 4
        };
        for (const symbol in weights) {
            for (let i = 0; i < weights[symbol]; i++) weightedSymbols.push(symbol);
        }
    }
  
    function updateDisplay() {
        if(balanceDisplay) balanceDisplay.textContent = balance.toFixed(2);
        if(betDisplay) betDisplay.textContent = bet;
  
        if(multiplierDisplay) {
            multiplierDisplay.textContent = `x${currentMultiplier}`;
            if(currentMultiplier > 1) multiplierDisplay.classList.add("active");
            else multiplierDisplay.classList.remove("active");
        }
  
        if (freeSpins > 0) {
            spinButton.innerHTML = `FREE: ${freeSpins}`;
            spinButton.classList.add("free-mode");
            const cabinet = document.querySelector('.slot-cabinet');
            if(cabinet) cabinet.classList.add("bonus-mode");
            if(betPlusButton) betPlusButton.disabled = true;
            if(betMinusButton) betMinusButton.disabled = true;
        } else {
            spinButton.innerHTML = "GIRA";
            spinButton.classList.remove("free-mode");
            const cabinet = document.querySelector('.slot-cabinet');
            if(cabinet) cabinet.classList.remove("bonus-mode");
            if(betPlusButton) betPlusButton.disabled = false;
            if(betMinusButton) betMinusButton.disabled = false;
        }
    }
  
    function adjustBet(amount) {
        if (isSpinning || freeSpins > 0) return;
        const newBet = bet + amount;
        if (newBet >= 10 && newBet <= balance) {
            bet = newBet;
            updateDisplay();
        }
    }
  
    function toggleTurbo() {
        isTurbo = !isTurbo;
        const btn = document.getElementById("turbo-button");
        if(btn) btn.classList.toggle("active");
    }
  
    function checkResult(symbolGrid) {
        let totalWin = 0;
        let scatterCount = 0;
        
        // DIVIDIAMO LA PUNTATA PER 60 LINEE
        const lineBet = bet / 60; 
  
        // 1. Conta Scatter
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLUMNS; c++) {
                if (symbolGrid[r][c] === 'scatter') scatterCount++;
            }
        }
  
        if (scatterCount >= 3) {
            let winSpins = 5; 
            if (scatterCount > 3) winSpins = 10;
            if (scatterCount === 5) winSpins = 20;
            
            freeSpins += winSpins;
            setTimeout(() => alert(`🎰 BONUS! ${scatterCount} Scatter! Vinti ${winSpins} Giri Gratis x3!`), 200);
        }
  
        // 2. Controllo 60 Linee
        PAYLINES.forEach((linePath, lineIndex) => {
            let symbolsOnLine = linePath.map((row, col) => symbolGrid[row][col]);
            
            let targetSymbol = null;
            for(let s of symbolsOnLine) {
                if(s !== 'jolly' && s !== 'scatter') {
                    targetSymbol = s;
                    break;
                }
            }
            if(!targetSymbol) targetSymbol = 'jolly'; 
  
            let matchCount = 0;
            
            for (let i = 0; i < symbolsOnLine.length; i++) {
                let currentSym = symbolsOnLine[i];
                if (currentSym === targetSymbol || (currentSym === 'jolly' && targetSymbol !== 'scatter')) {
                    matchCount++;
                } else {
                    break;
                }
            }
  
            if (matchCount > 0 && PAYTABLE[targetSymbol] && PAYTABLE[targetSymbol][matchCount]) {
                let multiplier = PAYTABLE[targetSymbol][matchCount];
                totalWin += lineBet * multiplier;
                
                for(let k=0; k<matchCount; k++) {
                    let r = linePath[k]; 
                    let c = k;
                    highlightCell(r, c);
                }
            }
        });
  
        totalWin = totalWin * currentMultiplier;
        return Math.floor(totalWin * 100) / 100;
    }
  
    function highlightCell(r, c) {
        if(slots[r] && slots[r][c]) {
            const cell = slots[r][c].parentElement;
            if(cell) cell.classList.add("win-glow");
        }
    }
  
    function clearHighlights() {
        document.querySelectorAll('.slot-cell').forEach(cell => cell.classList.remove("win-glow"));
    }
  
    function spin() {
        if (!currentUser) { alert("Accedi per giocare!"); return; }
        if (isSpinning) return;
        if (freeSpins === 0 && balance < bet) { alert("Saldo insufficiente!"); return; }
  
        isSpinning = true;
        spinButton.disabled = true;
        clearHighlights();
        
        if(messageBar) {
            messageBar.textContent = freeSpins > 0 ? `BONUS ATTIVO! VINCITE x${currentMultiplier}` : "Gira...";
            messageBar.classList.remove("win-active");
        }
  
        if (freeSpins > 0) {
            freeSpins--;
            currentMultiplier = 3; 
        } else {
            balance -= bet;
            currentMultiplier = 1;
        }
        
        updateDisplay();
  
        if (!isTurbo) document.querySelectorAll('.slot-cell').forEach(cell => cell.classList.add('spinning'));
  
        const duration = isTurbo ? SPIN_DURATION_TURBO : SPIN_DURATION_NORMAL;
  
        setTimeout(() => {
            const finalGrid = [];
            for (let i = 0; i < ROWS; i++) {
                finalGrid[i] = [];
                for (let j = 0; j < COLUMNS; j++) {
                    const rand = Math.floor(Math.random() * weightedSymbols.length);
                    const sym = weightedSymbols[rand];
                    finalGrid[i][j] = sym;
                    
                    if(slots[i][j]) slots[i][j].src = `../images/${sym}.png`;
                }
            }
  
            if (!isTurbo) document.querySelectorAll('.slot-cell').forEach(cell => cell.classList.remove('spinning'));
  
            const win = checkResult(finalGrid);
            
            if (win > 0) {
                balance += win;
                if(messageBar) {
                    messageBar.innerHTML = `<span style="color:#fff">VINTI</span> <span style="font-size:1.5rem; color:#FFD700">€${win.toFixed(2)}</span>`;
                    messageBar.classList.add("win-active");
                }
                if (typeof updateGameStats === "function") updateGameStats("Slot Machine", win);
            } else {
                 if(messageBar) messageBar.textContent = freeSpins > 0 ? "Continua..." : "Ritenta!";
                 if (freeSpins === 0 && typeof updateGameStats === "function") updateGameStats("Slot Machine", -bet);
            }
  
            saveBalance();
            updateDisplay();
            
            const userBar = document.getElementById("userBar");
            if(userBar) userBar.innerHTML = `<span>Ciao, <b>${currentUser.username}</b> | Saldo: €${balance.toFixed(0)}</span>`;
  
            isSpinning = false;
            spinButton.disabled = false;
            
            if(freeSpins === 0 && currentMultiplier > 1) {
                currentMultiplier = 1;
                updateDisplay();
            } else if(freeSpins > 0) {
                updateDisplay();
            }
  
        }, duration);
    }
  
    function saveBalance() {
        if(currentUser) {
            currentUser.balance = balance;
            localStorage.setItem("casino_current_user", JSON.stringify(currentUser));
            let allUsers = JSON.parse(localStorage.getItem("casino_users")) || [];
            let idx = allUsers.findIndex(u => u.username === currentUser.username);
            if(idx !== -1) {
                allUsers[idx] = currentUser;
                localStorage.setItem("casino_users", JSON.stringify(allUsers));
            }
        }
    }
  
    function init() {
        if(!slotGrid) return; 
        slotGrid.innerHTML = "";
        slots = [];
        
        for (let i = 0; i < ROWS; i++) {
            slots[i] = [];
            for (let j = 0; j < COLUMNS; j++) {
                const cell = document.createElement("div");
                cell.classList.add("slot-cell");
                const img = document.createElement("img");
                img.src = "../images/10.png"; 
                cell.appendChild(img);
                slotGrid.appendChild(cell);
                slots[i][j] = img; 
            }
        }
  
        generateWeightedSymbolList();
        
        if(!document.getElementById("multiplier-badge")) {
            const controls = document.getElementById("controls");
            if(controls) {
                const badge = document.createElement("div");
                badge.id = "multiplier-badge";
                badge.className = "multiplier-badge";
                badge.textContent = "x1";
                const actions = document.querySelector(".actions") || controls.lastElementChild;
                controls.insertBefore(badge, actions);
                multiplierDisplay = badge;
            }
        }
  
        updateDisplay();
  
        if(spinButton) spinButton.addEventListener("click", spin);
        const turboBtn = document.getElementById("turbo-button");
        if(turboBtn) turboBtn.addEventListener("click", toggleTurbo);
        if(betPlusButton) betPlusButton.addEventListener("click", () => adjustBet(10));
        if(betMinusButton) betMinusButton.addEventListener("click", () => adjustBet(-10));
    }
  
    init();
  });