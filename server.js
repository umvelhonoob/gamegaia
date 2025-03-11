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
const io = new Server(server, {
    cors: {
        origin: ["https://gamegaia.netlify.app", "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
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
    console.log(`Nova conexão: ${socket.id}`);

    // Log de eventos para debug
    socket.onAny((event, ...args) => {
        console.log(`Evento recebido: ${event}`, args);
    });

    // Criar sala
    socket.on('create-room', ({ roomName, password }) => {
        try {
            const roomId = roomName.toLowerCase().trim();
            
            if (!roomName || !password) {
                throw new Error('Preencha todos os campos!');
            }

            if (rooms.has(roomId)) {
                throw new Error('Nome da sala já em uso!');
            }

            const newRoom = {
                id: roomId,
                password: hashPassword(password),
                state: JSON.parse(JSON.stringify(initialState)),
                players: new Set([socket.id]),
                manager: socket.id,
                createdAt: Date.now()
            };

            rooms.set(roomId, newRoom);
            socket.join(roomId);

            console.log(`Sala criada: ${roomId}`);
            socket.emit('room-created', roomId);

        } catch (error) {
            console.error(error);
            socket.emit('server-error', {
                code: 'CREATE_ERROR',
                message: error.message
            });
        }
    });

    // Entrar na sala
    socket.on('join-room', ({ roomName, password }) => {
        try {
            const roomId = roomName.toLowerCase().trim();
            const room = rooms.get(roomId);

            if (!room) {
                throw new Error('Sala não encontrada!');
            }

            if (hashPassword(password) !== room.password) {
                throw new Error('Senha incorreta!');
            }

            socket.join(roomId);
            room.players.add(socket.id);

            // Enviar estado atual para o novo jogador
            socket.emit('state-update', room.state);
            console.log(`Jogador ${socket.id} entrou na sala ${roomId}`);

        } catch (error) {
            console.error(error);
            socket.emit('server-error', {
                code: 'JOIN_ERROR',
                message: error.message
            });
        }
    });

    // Sincronização de estado
    socket.on('state-update', (newState) => {
        const roomId = [...socket.rooms][1];
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            if (socket.id === room.manager) {
                room.state = newState;
                socket.to(roomId).emit('state-update', newState);
            }
        }
    });

    // Gerenciar desconexões
    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                if (room.players.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Sala ${roomId} removida por inatividade`);
                }
            }
        });
    });
});

server.listen(PORT, (10000) => 
    console.log(`Servidor rodando na porta ${PORT}`));
