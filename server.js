const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://gamegaia.netlify.app",
    methods: ["GET", "POST"]
  }
});

// Configurações
const PORT = process.env.PORT || 10000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

// Função de hash para senhas
const hashPassword = (pass) => 
  crypto.createHash('sha256').update(pass).digest('hex');

io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);

  // Criar sala
  socket.on('create-room', ({ name, password }) => {
    const roomId = name.toLowerCase().trim();
    
    if (rooms.has(roomId)) {
      socket.emit('error', 'Nome da sala já em uso!');
      return;
    }

    rooms.set(roomId, {
      password: hashPassword(password),
      state: JSON.stringify({
        1: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
        2: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
        3: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }},
        4: { balance: 1000, recursos: { combustivel: 0, combustivel_salto: 0, escudo_quantico: 0, motor_salto: 0 }}
      }),
      players: new Set()
    });

    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  // server.js (parte crítica corrigida)
io.on('connection', (socket) => {
  console.log(`\n=== Nova conexão: ${socket.id} ===`);

  // Verificar todos os eventos recebidos
  socket.onAny((event, ...args) => {
    console.log(`\n📡 Evento recebido: ${event}`, args);
  });

  // Criar sala (versão corrigida)
  socket.on('create-room', ({ roomName, password }) => {
    try {
      console.log(`\n🛠 Tentativa de criação: ${roomName}`);
      
      // Validação rigorosa
      if (!roomName?.trim() || !password?.trim()) {
        throw new Error('Nome/senha inválidos');
      }

      const roomId = roomName.toLowerCase().trim();
      
      if (rooms.has(roomId)) {
        throw new Error(`Sala ${roomId} já existe!`);
      }

      // Criptografia segura
      const hashedPass = crypto.createHash('sha256')
        .update(password)
        .digest('hex');

      // Criar nova sala
      const newRoom = {
        id: roomId,
        password: hashedPass,
        players: new Set([socket.id]),
        state: JSON.parse(JSON.stringify(initialState)),
        createdAt: Date.now()
      };

      rooms.set(roomId, newRoom);
      socket.join(roomId);

      console.log(`\n✅ Sala criada: ${roomId}`);
      console.log('🔑 Senha hash:', hashedPass);
      
      // Notificar sucesso
      socket.emit('room-created', {
        roomId,
        players: Array.from(newRoom.players)
      });

    } catch (error) {
      console.error(`\n❌ Erro na criação: ${error.message}`);
      socket.emit('creation-error', {
        code: 'CREATE_FAILED',
        message: error.message
      });
    }
  });

  // Entrar na sala (versão corrigida)
  socket.on('join-room', ({ roomName, password }) => {
    try {
      const roomId = roomName?.toLowerCase()?.trim();
      console.log(`\n🔑 Tentativa de acesso: ${roomId}`);

      if (!roomId) throw new Error('Nome da sala inválido');
      
      const room = rooms.get(roomId);
      if (!room) throw new Error('Sala não encontrada');

      // Verificar senha
      const hashedInput = crypto.createHash('sha256')
        .update(password?.trim() || '')
        .digest('hex');

      if (hashedInput !== room.password) {
        throw new Error('Senha incorreta');
      }

      // Entrar na sala
      socket.join(roomId);
      room.players.add(socket.id);

      console.log(`\n🎮 Jogador ${socket.id} entrou`);
      console.log(`👥 Jogadores: ${Array.from(room.players).join(', ')}`);

      // Atualizar todos os clientes
      io.to(roomId).emit('state-update', room.state);

    } catch (error) {
      console.error(`\n❌ Erro de acesso: ${error.message}`);
      socket.emit('join-error', {
        code: 'JOIN_FAILED',
        message: error.message
      });
    }
  });
});

  // Resto do código do servidor (manter igual ao anterior)
});

server.listen(PORT, () => console.log(`Servidor rodando na porta ${10000}`));
