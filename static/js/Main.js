let isManager = false;
let currentPlayerId = null;
let socket = null;

async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error("Erro na requisição: " + response.status);
        return response.json();
    } catch (error) {
        alert("Erro de conexão: " + error.message);
        throw error;
    }
}

async function createRoom() {
    const roomName = document.getElementById('roomName').value;
    const password = document.getElementById('roomPassword').value;
    const playerName = document.getElementById('playerName').value;

    if (!roomName || !password || !playerName) return alert("Preencha todos os campos!");

    const response = await fetchJSON("/create_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, password, playerName })
    });

    if (response.error) return alert(response.error);
    isManager = true;
    currentPlayerId = response.playerId;
    enterGame("manager");
}

async function joinRoom() {
    const roomName = document.getElementById('joinRoomName').value;
    const password = document.getElementById('joinRoomPassword').value;
    const role = document.getElementById('accessType').value;
    const playerName = document.getElementById('joinPlayerName').value;

    if (!roomName || !password || !playerName) return alert("Preencha todos os campos!");

    const response = await fetchJSON("/Entrar_Sala", {  // Alterado de /join_room para /Entrar_Sala
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, password, role, playerName })
    });

    if (response.error) return alert(response.error);
    isManager = role === "manager";
    currentPlayerId = response.playerId;
    enterGame(role);
}

async function sairDaSala() {
    if (currentPlayerId || sessionStorage.getItem("role")) {
        const isObserver = sessionStorage.getItem("role") === "observer";
        await fetchJSON("/Sair_Sala", {  // Alterado de /leave_room para /Sair_Sala
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayerId, isObserver })
        });
    }
    if (socket) {
        socket.disconnect();
    }

    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
    isManager = false;
    currentPlayerId = null;
    sessionStorage.removeItem("role");
    document.getElementById("roomName").value = "";
    document.getElementById("roomPassword").value = "";
    document.getElementById("joinRoomName").value = "";
    document.getElementById("joinRoomPassword").value = "";
    document.getElementById("playerName").value = "";
    document.getElementById("joinPlayerName").value = "";
}

let lastPlayerCount = 0;

function updateBalances(data) {
    const state = data.state;
    const observers = data.observers;

    let balancesHTML = `<h2>Saldo Geral: ${state.financial_balance} Racunes</h2>`;
    balancesHTML += `<span>👁️ Observadores: ${observers}</span>`;

    for (let player in state.players) {
        balancesHTML += `
            <div class="player-balance">
                <h3>${state.players[player].name}</h3>
                <div>Saldo: ${state.players[player].balance} Racunes</div>
            </div>
        `;
    }
    document.getElementById("balances").innerHTML = balancesHTML;
    updatePlayerSelects(state.players);

    const currentPlayerCount = Object.keys(state.players).length;
    if (currentPlayerCount !== lastPlayerCount) {
        initializeResources(state.players);
        lastPlayerCount = currentPlayerCount;
    } else {
        for (let player in state.players) {
            const res = state.players[player].resources;
            const spans = {
                combustivel: document.querySelector(`#resources span[data-player="${player}"][data-resource="combustivel"]`),
                combustivel_salto: document.querySelector(`#resources span[data-player="${player}"][data-resource="combustivel_salto"]`),
                escudo_quantico: document.querySelector(`#resources span[data-player="${player}"][data-resource="escudo_quantico"]`),
                motor_salto: document.querySelector(`#resources span[data-player="${player}"][data-resource="motor_salto"]`)
            };
            if (spans.combustivel) spans.combustivel.textContent = `COMBUSTIVEL: ${res.combustivel}`;
            if (spans.combustivel_salto) spans.combustivel_salto.textContent = `COMBUSTIVEL SALTO: ${res.combustivel_salto}`;
            if (spans.escudo_quantico) spans.escudo_quantico.textContent = `ESCUDO QUANTICO: ${res.escudo_quantico}`;
            if (spans.motor_salto) spans.motor_salto.textContent = `MOTOR SALTO: ${res.motor_salto}`;
        }
    }
}

function updatePlayerSelects(players) {
    const selects = ["fromPlayer", "toPlayer", "player"];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        select.innerHTML = "";
        for (let playerId in players) {
            const option = document.createElement("option");
            option.value = playerId;
            option.text = players[playerId].name;
            select.appendChild(option);
        }
        if (currentValue && players[currentValue]) {
            select.value = currentValue;
        }
    });
}

function initializeResources(players) {
    let resourcesHTML = "";
    for (let player in players) {
        const res = players[player].resources;
        resourcesHTML += `
            <div class="resource-item">
                <h3 class="resource-title">${players[player].name}</h3>
                <div class="resource-control">
                    <span data-player="${player}" data-resource="combustivel">COMBUSTIVEL: ${res.combustivel}</span>
                    ${isManager ? `
                    <input type="number" id="input-${player}-combustivel" placeholder="Quantidade">
                    <div class="resource-buttons">
                        <button onclick="adicionarRecurso('${player}', 'combustivel')">+</button>
                        <button onclick="removerRecurso('${player}', 'combustivel')">-</button>
                    </div>
                    ` : ''}
                </div>
                <div class="resource-control">
                    <span data-player="${player}" data-resource="combustivel_salto">COMBUSTIVEL SALTO: ${res.combustivel_salto}</span>
                    ${isManager ? `
                    <input type="number" id="input-${player}-combustivel_salto" placeholder="Quantidade">
                    <div class="resource-buttons">
                        <button onclick="adicionarRecurso('${player}', 'combustivel_salto')">+</button>
                        <button onclick="removerRecurso('${player}', 'combustivel_salto')">-</button>
                    </div>
                    ` : ''}
                </div>
                <div class="resource-control">
                    <span data-player="${player}" data-resource="escudo_quantico">ESCUDO QUANTICO: ${res.escudo_quantico}</span>
                    ${isManager ? `
                    <input type="number" id="input-${player}-escudo_quantico" placeholder="Quantidade">
                    <div class="resource-buttons">
                        <button onclick="adicionarRecurso('${player}', 'escudo_quantico')">+</button>
                        <button onclick="removerRecurso('${player}', 'escudo_quantico')">-</button>
                    </div>
                    ` : ''}
                </div>
                <div class="resource-control">
                    <span data-player="${player}" data-resource="motor_salto">MOTOR SALTO: ${res.motor_salto}</span>
                    ${isManager ? `
                    <input type="number" id="input-${player}-motor_salto" placeholder="Quantidade">
                    <div class="resource-buttons">
                        <button onclick="adicionarRecurso('${player}', 'motor_salto')">+</button>
                        <button onclick="removerRecurso('${player}', 'motor_salto')">-</button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    document.getElementById("resources").innerHTML = resourcesHTML || "<p>Sem jogadores na sala.</p>";
}

function enterGame(role) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    
    const managerControls = document.querySelector(".manager-access");
    const managerInfo = document.getElementById("managerInfo");
    
    sessionStorage.setItem("role", role);
    if (role === "manager") {
        managerControls.style.display = "block";
        managerInfo.style.display = "block";
        const roomName = document.getElementById("roomName").value;
        const password = document.getElementById("roomPassword").value;
        document.getElementById("roomNameDisplay").textContent = roomName;
        document.getElementById("roomPasswordDisplay").textContent = password;
    } else {
        managerControls.style.display = "none";
        managerInfo.style.display = "none";
    }
    
    fetchJSON("/get_state").then(response => {
        if (!response.error) {
            initializeResources(response.players);
            updatePlayerSelects(response.players);
        }
    });
    
    // Inicia a conexão Socket.IO
    socket = io.connect(`https://${window.location.host}`);
    socket.on("connect", () => {
        console.log("Conectado ao Socket.IO");
    });
    socket.on("update", (data) => {
        updateBalances(data);
    });
    socket.on("error", (data) => {
        alert(data.message);
        sairDaSala();
    });
    socket.on("disconnect", () => {
        console.log("Desconectado do Socket.IO");
        sairDaSala();
    });
}

async function updateBalance(player, amount) {
    await fetchJSON("/update_balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, amount })
    });
}

async function resetGame() {
    await fetchJSON("/reset_game", { method: "POST" });
}

async function adicionarRecurso(player, resource) {
    if (!isManager) return alert("Apenas o gerente pode alterar recursos!");
    const input = document.getElementById(`input-${player}-${resource}`);
    const amount = parseInt(input.value) || 0;
    if (amount <= 0) return alert("Digite uma quantidade válida!");
    await fetchJSON("/update_resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, resource, amount })
    });
    input.value = "";
}

async function removerRecurso(player, resource) {
    if (!isManager) return alert("Apenas o gerente pode alterar recursos!");
    const input = document.getElementById(`input-${player}-${resource}`);
    const amount = parseInt(input.value) || 0;
    if (amount <= 0) return alert("Digite uma quantidade válida!");
    await fetchJSON("/update_resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, resource, amount: -amount })
    });
    input.value = "";
}

async function depositar() {
    if (!isManager) return alert("Apenas o gerente pode fazer depósitos!");
    const player = document.getElementById("player").value;
    const amount = parseInt(document.getElementById("amount").value);
    if (!amount || amount <= 0) return alert("Digite uma quantidade válida!");
    await updateBalance(player, amount);
}

async function retirar() {
    if (!isManager) return alert("Apenas o gerente pode fazer retiradas!");
    const player = document.getElementById("player").value;
    const amount = parseInt(document.getElementById("amount").value);
    if (!amount || amount <= 0) return alert("Digite uma quantidade válida!");
    await updateBalance(player, -amount);
}

async function transferir() {
    const fromPlayer = document.getElementById("fromPlayer").value;
    const toPlayer = document.getElementById("toPlayer").value;
    const amount = parseInt(document.getElementById("transferAmount").value);

    if (!amount || amount <= 0) return alert("Digite uma quantidade válida!");
    if (fromPlayer === toPlayer) return alert("Escolha jogadores diferentes!");

    if (isManager) {
        await updateBalance(fromPlayer, -amount);
        await updateBalance(toPlayer, amount);
    } else {
        if (fromPlayer !== currentPlayerId) {
            return alert("Você só pode transferir seu próprio saldo!");
        }
        const stateResponse = await fetchJSON("/get_state");
        const playerBalance = stateResponse.players[fromPlayer].balance;
        if (playerBalance < amount) {
            return alert("Saldo insuficiente!");
        }
        await updateBalance(fromPlayer, -amount);
        await updateBalance(toPlayer, amount);
    }
}

function loginManager() {
    if (isManager) {
        alert("Você já está como gerente!");
    } else {
        alert("Acesso negado! Apenas gerentes podem usar esta função.");
    }
}

async function depositarTodos() {
    if (!isManager) return alert("Apenas o gerente pode fazer depósitos!");
    const amount = parseInt(document.getElementById("depositAllAmount").value);
    if (!amount || amount <= 0) return alert("Digite uma quantidade válida!");
    await fetchJSON("/deposit_all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
    });
    document.getElementById("depositAllAmount").value = "";
}
function reiniciarJogo() {
    if (isManager) {
        resetGame();
    } else {
        alert("Apenas o gerente pode reiniciar o jogo!");
    }
}

let calcInput = "";
function clearCalc() {
    calcInput = "";
    document.getElementById("calcInput").value = "";
}

function addToCalc(value) {
    calcInput += value;
    document.getElementById("calcInput").value = calcInput;
}

function calculate() {
    try {
        calcInput = eval(calcInput).toString();
        document.getElementById("calcInput").value = calcInput;
    } catch (e) {
        alert("Erro na cálculo!");
        clearCalc();
    }
}

function toggleForms() {
    const createForm = document.getElementById("createForm");
    const joinForm = document.getElementById("joinForm");
    if (createForm.classList.contains("hidden")) {
        createForm.classList.remove("hidden");
        joinForm.classList.add("hidden");
    } else {
        createForm.classList.add("hidden");
        joinForm.classList.remove("hidden");
    }
}