const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuração CORS para produção e desenvolvimento
const io = new Server(server, {
  cors: {
    origin: [
      "https://gamegaia.netlify.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"]
  }
});

// Estrutura para armazenar salas
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);

  // Criar sala
  socket.on('create-room', ({ roomName, password }) => {
    try {
      const roomId = roomName.toLowerCase().trim();
      console.log(`Tentativa de criar sala: ${roomId}`);

      if (rooms.has(roomId)) {
        throw new Error('Nome da sala já está em uso!');
      }

      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      
      rooms.set(roomId, {
        password: hashedPassword,
        players: new Set([socket.id]),
        state: {
          1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
          2: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
          3: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
          4: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }}
        }
      });

      socket.join(roomId);
      console.log(`Sala criada: ${roomId} por ${socket.id}`);
      socket.emit('room-created', roomId);
      
    } catch (error) {
      console.error(`Erro ao criar sala: ${error.message}`);
      socket.emit('creation-error', error.message);
    }
  });

  // Entrar em sala (CORRIGIDO)
  socket.on('join-room', ({ roomName, password }) => {
    const roomId = roomName.toLowerCase().trim();
    console.log(`Tentativa de entrar na sala: ${roomId} por ${socket.id}`);

    const room = rooms.get(roomId);
    if (!room) {
      const error = 'Sala não encontrada!';
      console.error(error);
      return socket.emit('join-error', error);
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedPassword !== room.password) {
      const error = 'Senha incorreta!';
      console.error(error);
      return socket.emit('join-error', error);
    }

    socket.join(roomId);
    room.players.add(socket.id);
    console.log(`Jogador ${socket.id} entrou na sala ${roomId}`);
    socket.emit('room-joined', room.state);
    io.to(roomId).emit('state-update', room.state);
  }); // ← Correção aplicada aqui

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    rooms.forEach((room, roomId) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        console.log(`Jogador ${socket.id} removido da sala ${roomId}`);
        
        if (room.players.size === 0) {
          rooms.delete(roomId);
          console.log(`Sala ${roomId} destruída por falta de jogadores`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
