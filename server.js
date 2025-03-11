const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://gamegaia.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Banco de dados em memória
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);

  // Criar sala (corrigido)
  socket.on('create-room', ({ roomName, password }) => {
    try {
      const roomId = roomName.toLowerCase().trim();
      
      if (rooms.has(roomId)) {
        throw new Error('Nome da sala já está em uso!');
      }

      const hashedPassword = crypto.createHash('sha256')
        .update(password)
        .digest('hex');

      const newRoom = {
        id: roomId,
        password: hashedPassword,
        players: new Set([socket.id]),
        state: criarEstadoInicial()
      };

      rooms.set(roomId, newRoom);
      socket.join(roomId);

      console.log(`Sala criada: ${roomId}`);
      socket.emit('room-created', roomId);
      socket.broadcast.emit('room-list-update', Array.from(rooms.keys()));

    } catch (error) {
      console.error(`Erro: ${error.message}`);
      socket.emit('creation-error', error.message);
    }
  });

  // Entrar na sala (corrigido)
  socket.on('join-room', ({ roomId, password }) => {
    try {
      const room = rooms.get(roomId.toLowerCase().trim());
      
      if (!room) throw new Error('Sala não existe!');
      
      const hashedPassword = crypto.createHash('sha256')
        .update(password)
        .digest('hex');

      if (hashedPassword !== room.password) {
        throw new Error('Senha incorreta!');
      }

      socket.join(roomId);
      room.players.add(socket.id);
      
      console.log(`Jogador ${socket.id} entrou na ${roomId}`);
      socket.emit('room-joined', room.state);
      io.to(roomId).emit('state-update', room.state);

    } catch (error) {
      socket.emit('join-error', error.message);
    }
  });

  // Resto do código...
});

function criarEstadoInicial() {
  return {
    1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
    // ... outros jogadores
  };
}

server.listen(10000, () => console.log('Servidor rodando na porta 10000'));
