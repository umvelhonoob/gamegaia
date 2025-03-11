const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuração de Segurança
const io = new Server(server, {
    cors: {
        origin: [
            "https://gamegaia.netlify.app",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
    }
});

// Banco de Dados em Memória
const rooms = new Map();
const sessions = new Map();

// Middlewares
io.use((socket, next) => {
    const sessionToken = socket.handshake.auth.session;
    if(sessionToken && sessions.has(sessionToken)) {
        socket.data.session = sessions.get(sessionToken);
    }
    next();
});

// Lógica Principal
io.on('connection', (socket) => {
    console.log(`Nova conexão: ${socket.id}`);

    // Gerenciamento de Salas
    socket.on('create-room', ({ roomName, password }) => {
        try {
            const roomId = roomName.toLowerCase().trim();
            if(rooms.has(roomId)) throw new Error('Sala já existe');

            const hashedPassword = crypto.createHash('sha256')
                .update(password)
                .digest('hex');

            const newRoom = {
                id: roomId,
                password: hashedPassword,
                players: new Set(),
                state: initializeGameState(),
                createdAt: Date.now()
            };

            rooms.set(roomId, newRoom);
            socket.emit('room-created', roomId);
            
        } catch (error) {
            socket.emit('server-error', {
                code: 'ROOM_CREATION_FAILED',
                message: error.message
            });
        }
    });

    // Sistema de Reconexão
    socket.on('rejoin-room', (roomId) => {
        if(rooms.has(roomId)) {
            socket.join(roomId);
            socket.emit('game-state', rooms.get(roomId).state);
        }
    });

    // Gerenciamento de Desconexão
    socket.on('disconnect', (reason) => {
        console.log(`Desconexão: ${socket.id} (${reason})`);
        rooms.forEach(room => {
            if(room.players.has(socket.id)) {
                room.players.delete(socket.id);
                io.to(room.id).emit('player-left', socket.id);
            }
        });
    });
});

// Funções Auxiliares
function initializeGameState() {
    return {
        1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
        2: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
        3: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
        4: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }}
    };
}

// Inicialização do Servidor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🟢 Servidor operacional na porta ${PORT}`);
    setInterval(cleanupRooms, 60 * 60 * 1000); // Limpeza horária
});

function cleanupRooms() {
    const now = Date.now();
    rooms.forEach((room, id) => {
        if(room.players.size === 0 && (now - room.createdAt) > 3600000) {
            rooms.delete(id);
            console.log(`Sala ${id} removida por inatividade`);
        }
    });
}
