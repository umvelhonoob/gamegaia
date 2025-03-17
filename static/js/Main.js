let isManager = false;

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    return response.json();
}

let currentPlayerId = null; // Variável global para rastrear o ID do jogador atual

// Atualize createRoom e joinRoom para armazenar o playerId
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
    currentPlayerId = response.playerId; // Armazena o ID do jogador
    enterGame("manager");
}

async function joinRoom() {
    const roomName = document.getElementById('joinRoomName').value;
    const password = document.getElementById('joinRoomPassword').value;
    const role = document.getElementById('accessType').value;
    const playerName = document.getElementById('joinPlayerName').value;

    if (!roomName || !password || !playerName) return alert("Preencha todos os campos!");

    const response = await fetchJSON("/Entrar_Sala", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, password, role, playerName })
    });

    if (response.error) return alert(response.error);
    isManager = role === "manager";
    currentPlayerId = response.playerId; // Armazena o ID do jogador (null para observadores)
    enterGame(role);
}


async function sairDaSala() {
    if (currentPlayerId) {
        await fetchJSON("/Sair_Sala", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayerId })
        });
        await updateBalances(); // Força a atualização imediata após a saída
    }

    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
    isManager = false;
    currentPlayerId = null;

    // Limpa os campos de entrada
    document.getElementById("roomName").value = "";
    document.getElementById("roomPassword").value = "";
    document.getElementById("joinRoomName").value = "";
    document.getElementById("joinRoomPassword").value = "";
    document.getElementById("playerName").value = "";
    document.getElementById("joinPlayerName").value = "";
}

let lastPlayerCount = 0;

async function updateBalances() {
    const stateResponse = await fetchJSON("/get_state");
    const observerResponse = await fetchJSON("/get_observers");

    if (stateResponse.error) {
        console.error(stateResponse.error);
        return;
    }

    // Atualiza saldo geral e observadores
    let balancesHTML = `<h2>Saldo Geral: ${stateResponse.financial_balance} Racunes</h2>`;
    if (!observerResponse.error) {
        balancesHTML += `<span>👁️ Observadores: ${observerResponse.observers}</span>`;
    }

    // Atualiza a listagem de saldos
    for (let player in stateResponse.players) {
        balancesHTML += `
            <div class="player-balance">
                <h3>${stateResponse.players[player].name}</h3>
                <div>Saldo: ${stateResponse.players[player].balance} Racunes</div>
            </div>
        `;
    }
    document.getElementById("balances").innerHTML = balancesHTML;

    // Atualiza a lista de transferência
    updatePlayerSelects(stateResponse.players);

    // Verifica se o número de jogadores mudou (entrada ou saída)
    const currentPlayerCount = Object.keys(stateResponse.players).length;
    if (currentPlayerCount !== lastPlayerCount) {
        initializeResources(stateResponse.players); // Recria os recursos
        lastPlayerCount = currentPlayerCount;
    } else {
        // Atualiza apenas os números dos recursos existentes
        for (let player in stateResponse.players) {
            const res = stateResponse.players[player].resources;
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


// Função auxiliar para atualizar os selects de jogadores
// Função ajustada para usar nomes personalizados
function updatePlayerSelects(players) {
    const selects = ["fromPlayer", "toPlayer", "player"];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        select.innerHTML = ""; // Limpa as opções atuais
        
        // Itera sobre os jogadores e usa o nome personalizado
        for (let playerId in players) {
            const option = document.createElement("option");
            option.value = playerId; // O valor continua sendo o ID do jogador
            option.text = players[playerId].name; // O texto exibido é o nome personalizado
            select.appendChild(option);
        }
        
        // Restaura o valor selecionado, se ainda existir
        if (currentValue && players[currentValue]) {
            select.value = currentValue;
        }
    });
}

async function updateBalance(player, amount) {
    await fetchJSON("/update_balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, amount })
    });
    updateBalances();
}

async function resetGame() {
    await fetchJSON("/reset_game", { method: "POST" });
    updateBalances();
}

updateBalances();

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
                    ${isManager ? `<input type="number" id="input-${player}-motor_salto" placeholder="Quantidade">
                    
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
// Ajuste no enterGame para chamar a inicialização
function enterGame(role) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    
    const managerControls = document.querySelector(".manager-access");
    const managerInfo = document.getElementById("managerInfo");
    
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
            updatePlayerSelects(response.players); // Preenche os selects inicialmente
        }
    });
    
    startRealtimeUpdates();
}


function loginManager() {
    if (isManager) {
        alert("Você já está como gerente!");
        // Aqui você pode adicionar mais lógica para controles de gerente
    } else {
        alert("Acesso negado! Apenas gerentes podem usar esta função.");
    }
}
function reiniciarJogo() {
    if (isManager) {
        resetGame();
    } else {
        alert("Apenas o gerente pode reiniciar o jogo!");
    }
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
        // Gerente pode transferir livremente
        await updateBalance(fromPlayer, -amount);
        await updateBalance(toPlayer, amount);
    } else {
        // Não gerente só pode transferir de si mesmo
        if (fromPlayer !== currentPlayerId) {
            return alert("Você só pode transferir seu próprio saldo!");
        }
        
        // Verifica se o jogador tem saldo suficiente
        const stateResponse = await fetchJSON("/get_state");
        const playerBalance = stateResponse.players[fromPlayer].balance;
        if (playerBalance < amount) {
            return alert("Saldo insuficiente!");
        }

        await updateBalance(fromPlayer, -amount);
        await updateBalance(toPlayer, amount);
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

// Atualiza os saldos e recursos a cada segundo quando o jogo está ativo
function startRealtimeUpdates() {
    setInterval(() => {
        if (document.getElementById("gameContainer").style.display === "block") {
            updateBalances();
        }
    }, 1000); // 1000 ms = 1 segundo
}

// Inicia as atualizações em tempo real ao carregar a página
//startRealtimeUpdates();

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
    input.value = ""; // Limpa o campo
    updateBalances();
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
    input.value = ""; // Limpa o campo
    updateBalances();
}