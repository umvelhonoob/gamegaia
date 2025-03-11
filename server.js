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

// Configuração WebSocket aprimorada
const io = new Server(server, {
    cors: {
        origin: "https://gamegaia.netlify.app",
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

// Função para validar o nome da sala
const validateRoomName = (roomName) => {
    if (typeof roomName !== 'string' || !roomName.trim()) {
        throw new Error('O nome da sala deve ser um texto válido.');
    }

    // Remove espaços em branco e converte para minúsculas
    const cleanedName = roomName.trim().toLowerCase();

    // Verifica se o nome contém apenas caracteres permitidos (opcional)
    const regex = /^[a-z0-9\-_ ]+$/i; // Apenas letras, números, hífens, underscores e espaços
    if (!regex.test(cleanedName)) {
        throw new Error('O nome da sala contém caracteres inválidos. Use apenas letras, números, hífens e underscores.');
    }

    return cleanedName;
};

// Função para validar a senha
const validatePassword = (password) => {
    if (typeof password !== 'string' || password.trim().length < 4) {
        throw new Error('A senha deve ter pelo menos 4 caracteres.');
    }
    return password.trim();
};

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

    // Criar sala (versão corrigida e segura)
    socket.on('create-room', (data) => {
        console.log("Dados recebidos:", JSON.stringify(data, null, 2));
        
        try {
            // Validação dos dados
            if (!data || typeof data !== 'object') {
                throw new Error('Formato de dados inválido.');
            }

            const { roomName, password } = data;

            // Validação do nome da sala
            const roomId = validateRoomName(roomName);

            // Validação da senha
            const cleanedPassword = validatePassword(password);

            // Verifica se a sala já existe
            if (rooms.has(roomId)) {
                throw new Error(`A sala '${roomId}' já existe. Escolha outro nome.`);
            }

            // Cria a nova sala
            const newRoom = {
                id: roomId,
                password: hashPassword(cleanedPassword), // Criptografa a senha
                state: JSON.parse(JSON.stringify(initialState)),
                players: new Set([socket.id]),
                manager: socket.id,
                createdAt: Date.now()
            };

            rooms.set(roomId, newRoom);
            socket.join(roomId);

            console.log(`Sala ${roomId} criada com sucesso`);
            socket.emit('room-created', { 
                status: "success",
                roomId,
                transport: socket.conn.transport.name
            });

        } catch (error) {
            console.error("Erro na criação da sala:", {
                error: error.message,
                stack: error.stack,
                receivedData: data
            });
            
            socket.emit('server-error', {
                code: 'CREATE_ERROR',
                message: error.message,
                details: {
                    inputRequirements: {
                        roomName: 'string (não vazio, apenas letras, números, hífens e underscores)',
                        password: 'string (mínimo 4 caracteres)'
                    },
                    received: data
                }
            });
        }
    });

    // Entrar na sala (versão corrigida)
    socket.on('join-room', (data) => {
        console.log("Tentativa de acesso:", JSON.stringify(data, null, 2));
        
        try {
            // Validação de dados
            if (!data || typeof data !== 'object') {
                throw new Error('Formato de dados inválido');
            }

            const { roomName, password } = data;
            
            // Verificações
            if (typeof roomName !== 'string' || !roomName.trim()) {
                throw new Error('Nome da sala inválido');
            }

            const roomId = roomName.toLowerCase().trim();
            const room = rooms.get(roomId);

            if (!room) {
                throw new Error('Sala não encontrada');
            }

            if (typeof password !== 'string' || hashPassword(password) !== room.password) {
                throw new Error('Credenciais inválidas');
            }

            socket.join(roomId);
            room.players.add(socket.id);

            console.log(`Jogador ${socket.id} entrou na sala ${roomId}`);
            socket.emit('state-update', room.state);

        } catch (error) {
            console.error("Erro no acesso:", {
                error: error.message,
                stack: error.stack,
                receivedData: data
            });
            
            socket.emit('server-error', {
                code: 'JOIN_ERROR',
                message: error.message,
                details: {
                    inputRequirements: {
                        roomName: 'string (não vazio)',
                        password: 'string (válida)'
                    },
                    received: data
                }
            });
        }
    });

    // Sincronização de estado
    socket.on('state-update', (newState) => {
        try {
            const roomId = [...socket.rooms][1];
            if (!roomId || !rooms.has(roomId)) return;

            const room = rooms.get(roomId);
            if (socket.id === room.manager) {
                room.state = newState;
                socket.to(roomId).emit('state-update', newState);
                console.log(`Estado da sala ${roomId} atualizado`);
            }
        } catch (error) {
            console.error("Erro na sincronização:", error);
        }
    });

    // Gerenciar desconexões
    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                console.log(`Jogador ${socket.id} desconectado da sala ${roomId}`);
                
                if (room.players.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Sala ${roomId} removida por inatividade`);
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log("Modo:", process.env.NODE_ENV || "development");
    console.log("WebSocket Config:", {
        transports: io.engine.opts.transports,
        pingTimeout: io.engine.opts.pingTimeout,
        cors: io.engine.opts.cors
    });
});
