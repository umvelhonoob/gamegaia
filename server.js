const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuração CORS aprimorada
const io = new Server(server, {
  cors: {
    origin: [
      "https://gamegaia.netlify.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Estrutura para armazenar salas
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`\n=== Novo jogador conectado: ${socket.id} ===`);

  // Monitorar todos os eventos
  socket.onAny((event, ...args) => {
    console.log(`\n📡 [${socket.id}] Evento recebido: ${event}`, args);
  });

  // Criar sala
  socket.on('create-room', ({ roomName, password }) => {
    try {
      console.log(`\n🛠 Tentativa de criação de sala por ${socket.id}`);
      console.log('📦 Dados recebidos:', { roomName, password });

      // Validação robusta
      if (!roomName?.trim() || !password?.trim()) {
        throw new Error('Nome da sala e senha são obrigatórios!');
      }

      const roomId = roomName.toLowerCase().trim();
      
      if (rooms.has(roomId)) {
        throw new Error(`Sala '${roomId}' já existe!`);
      }

      // Criptografia segura
      const hashedPassword = crypto.createHash('sha256')
        .update(password)
        .digest('hex');

      // Criar nova sala
      const newRoom = {
        password: hashedPassword,
        players: new Set([socket.id]),
        state: {
          1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
          2: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
          3: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
          4: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }}
        }
      };

      rooms.set(roomId, newRoom);
      socket.join(roomId);

      console.log(`\n✅ Sala criada com sucesso: ${roomId}`);
      console.log('📊 Salas ativas:', Array.from(rooms.keys()));
      
      socket.emit('room-created', { 
        roomId,
        players: Array.from(newRoom.players)
      });

    } catch (error) {
      console.error(`\n❌ Erro na criação da sala: ${error.message}`);
      socket.emit('creation-error', {
        code: 'CREATE_ROOM_FAILED',
        message: error.message
      });
    }
  });

  // Entrar em sala (melhorado)
  socket.on('join-room', ({ roomName, password }) => {
    try {
      console.log(`\n🔑 Tentativa de acesso à sala por ${socket.id}`);
      
      const roomId = roomName?.toLowerCase()?.trim();
      if (!roomId) throw new Error('Nome da sala inválido!');

      const room = rooms.get(roomId);
      if (!room) throw new Error(`Sala '${roomId}' não encontrada!`);

      // Verificação de senha
      const hashedInput = crypto.createHash('sha256')
        .update(password?.trim() || '')
        .digest('hex');

      if (hashedInput !== room.password) {
        throw new Error('Senha incorreta!');
      }

      // Adicionar jogador à sala
      socket.join(roomId);
      room.players.add(socket.id);

      console.log(`\n🎮 Jogador ${socket.id} entrou na sala ${roomId}`);
      console.log(`👥 Jogadores na sala: ${Array.from(room.players).join(', ')}`);

      socket.emit('room-joined', {
        roomId,
        state: room.state,
        players: Array.from(room.players)
      });

      io.to(roomId).emit('player-joined', {
        playerId: socket.id,
        players: Array.from(room.players)
      });

    } catch (error) {
      console.error(`\n❌ Erro ao entrar na sala: ${error.message}`);
      socket.emit('join-error', {
        code: 'JOIN_ROOM_FAILED',
        message: error.message
      });
    }
  });

  // Gerenciamento de desconexão
  socket.on('disconnect', () => {
    console.log(`\n⚠️ Jogador desconectado: ${socket.id}`);
    
    rooms.forEach((room, roomId) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        console.log(`\n🗑 Jogador ${socket.id} removido da sala ${roomId}`);

        // Notificar outros jogadores
        io.to(roomId).emit('player-left', {
          playerId: socket.id,
          players: Array.from(room.players)
        });

        // Limpar sala vazia
        if (room.players.size === 0) {
          rooms.delete(roomId);
          console.log(`\n💥 Sala ${roomId} destruída por inatividade`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor iniciado na porta ${PORT}`);
  console.log(`🔒 Modo seguro: ${process.env.NODE_ENV === 'production' ? 'Ativado' : 'Desenvolvimento'}`);
});
