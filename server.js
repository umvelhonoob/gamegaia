const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

// Estado inicial padrão
const initialState = {
    1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    2: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    3: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    4: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }}
};

const app = express();
const server = http.createServer(app);

// 1ª Melhoria: Configuração do CORS ampliada
const io = new Server(server, {
    cors: {
        origin: "*", // Permite todas origens
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["websocket", "polling"]
});

// Configurações
const PORT = process.env.PORT || 10000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

// Funções auxiliares
const hashPassword = (pass) => 
    crypto.createHash('sha256').update(pass).digest('hex');

// Sistema de salas
io.on('connection', (socket) => {
    // 2ª Melhoria: Logs de conexão aprimorados
    console.log("Cliente conectado:", socket.id);
    
    socket.onAny((event, ...args) => {
        console.log(`Evento recebido: ${event}`, args);
    });

    // Criar sala com log detalhado
    socket.on('create-room', (data) => {
        console.log("Criando sala:", data);
        
        try {
            const roomId = data.roomName.toLowerCase().trim();
            
            if (!data.roomName || !data.password) {
                throw new Error('Preencha todos os campos!');
            }

            if (rooms.has(roomId)) {
                throw new Error('Nome da sala já em uso!');
            }

            const newRoom = {
                id: roomId,
                password: hashPassword(data.password),
                state: JSON.parse(JSON.stringify(initialState)),
                players: new Set([socket.id]),
                manager: socket.id,
                createdAt: Date.now()
            };

            rooms.set(roomId, newRoom);
            socket.join(roomId);

            console.log(`Sala ${roomId} criada com sucesso`);
            socket.emit('room-created', { status: "success", roomId });

        } catch (error) {
            console.error("Erro na criação:", error);
            socket.emit('server-error', {
                code: 'CREATE_ERROR',
                message: error.message
            });
        }
    });

    // Restante do código mantido com melhorias...
    // [Manter as outras funções igual do código anterior]
});

// Client-Side (Adicionar no arquivo index.html dentro da tag <script>):
/*
const socket = io("https://seuservidor.com");

socket.on("connect", () => {
    console.log("Conectado:", socket.id);
});

socket.on("connect_error", (err) => {
    console.log("Erro de conexão:", err.message);
});
*/

server.listen(PORT, () => 
    console.log(`Servidor rodando na porta ${PORT}`)); // Corrigido o callback
