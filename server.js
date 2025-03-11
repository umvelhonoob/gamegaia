const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Estado inicial padrão
const initialState = {
    1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    2: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    3: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    4: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }}
};

const app = express();
const server = http.createServer(app);

// Configuração WebSocket aprimorada
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Configurações
const PORT = process.env.PORT || 10000;
const rooms = new Map();

// Middleware de segurança
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Funções auxiliares
const hashPassword = (pass) => 
    crypto.createHash('sha256').update(pass).digest('hex');

// Monitoramento de erros de conexão
io.engine.on("connection_error", (err) => {
    console.error("Erro de Conexão WebSocket:", {
        code: err.code,
        message: err.message,
        context: err.context,
        headers: err.req?.headers
    });
});

// Sistema de salas
io.on('connection', (socket) => {
    console.log("Cliente conectado:", socket.id);
    console.log("Protocolo:", socket.conn.transport.name);

    // Log de eventos
    socket.onAny((event, ...args) => {
        console.log(`[${socket.id}] Evento: ${event}`, args);
    });

    // Atualizar transporte
    socket.conn.on("upgrade", () => {
        console.log(`[${socket.id}] Upgrade para: ${socket.conn.transport.name}`);
    });

    // Criar sala
    socket.on('create-room', (data) => {
        console.log("Criando sala:", JSON.stringify(data, null, 2));
        
        try {
            if (!data?.roomName?.trim() || !data?.password?.trim()) {
                throw new Error('Credenciais inválidas');
            }

            const roomId = data.roomName.toLowerCase().trim();
            
            if (rooms.has(roomId)) {
                throw new Error('Sala já existe');
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

            console.log(`Sala ${roomId} criada`);
            socket.emit('room-created', { 
                status: "success",
                roomId,
                transport: socket.conn.transport.name
            });

        } catch (error) {
            console.error("Erro criação sala:", error.stack);
            socket.emit('server-error', {
                code: 'CREATE_ERROR',
                message: error.message,
                details: {
                    input: data,
                    timestamp: Date.now()
                }
            });
        }
    });

    // Restante das funções...
});

// Client-Side (index.html):
/*
const socket = io("https://seuservidor.com", {
    path: "/socket.io/",
    transports: ["websocket"],
    upgrade: false,
    reconnectionDelay: 1000,
    reconnectionAttempts: 3,
    auth: {
        token: localStorage.getItem('token')
    }
});

// Debug avançado
socket.on("connect", () => {
    console.log("Conectado:", socket.id, "Protocolo:", socket.io.engine.transport.name);
});

socket.on("connect_error", (err) => {
    console.error("Erro Conexão:", {
        code: err.code,
        message: err.message,
        context: err.context
    });
});
*/

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${10000}`);
    console.log("Modo:", process.env.NODE_ENV || "development");
    console.log("WebSocket:", io.engine.opts);
});
