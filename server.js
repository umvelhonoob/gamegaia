const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://https://gamegaia.netlify.app",  // URL do Netlify
      "http://localhost:3000"          // Para testes locais
    ],
    methods: ["GET", "POST"],
    credentials: true
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

  // Resto do código do servidor (manter igual ao anterior)
});

server.listen(PORT, () => console.log(`Servidor rodando na porta ${10000}`));
