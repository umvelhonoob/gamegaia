from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import hashlib
import json

# Configuração do Flask e Flask-SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="https://gamegaia.netlify.app")

# Estado inicial padrão
initial_state = {
    "1": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
    "2": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
    "3": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
    "4": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}}
}

# Dicionário para armazenar as salas
rooms = {}

# Função para hashear a senha
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# Evento de conexão do Socket.IO
@socketio.on('connect')
def handle_connect():
    print(f"Cliente conectado: {request.sid}")

# Evento de desconexão do Socket.IO
@socketio.on('disconnect')
def handle_disconnect():
    print(f"Cliente desconectado: {request.sid}")
    for room_id, room in list(rooms.items()):
        if request.sid in room["players"]:
            room["players"].remove(request.sid)
            if len(room["players"]) == 0:
                del rooms[room_id]
                print(f"Sala {room_id} removida por inatividade")

# Evento para criar uma sala
@socketio.on('create-room')
def handle_create_room(data):
    try:
        # Validação dos dados
        if not data or not isinstance(data, dict):
            raise ValueError("Formato de dados inválido")

        room_name = data.get("roomName")
        password = data.get("password")

        if not room_name or not isinstance(room_name, str) or not room_name.strip():
            raise ValueError("Nome da sala deve ser um texto válido")

        if not password or not isinstance(password, str) or len(password.strip()) < 4:
            raise ValueError("Senha deve ter pelo menos 4 caracteres")

        room_id = room_name.lower().strip()

        if room_id in rooms:
            raise ValueError(f"Sala '{room_id}' já existe")

        # Cria uma nova sala
        rooms[room_id] = {
            "id": room_id,
            "password": hash_password(password),
            "state": json.loads(json.dumps(initial_state)),  # Deep copy do estado inicial
            "players": set([request.sid]),
            "manager": request.sid,
            "createdAt": datetime.now().isoformat()
        }

        join_room(room_id)
        print(f"Sala {room_id} criada com sucesso")
        emit("room-created", {
            "status": "success",
            "roomId": room_id,
            "transport": "websocket"  # Simulação do transporte
        })

    except Exception as error:
        print(f"Erro na criação da sala: {str(error)}")
        emit("server-error", {
            "code": "CREATE_ERROR",
            "message": str(error),
            "details": {
                "inputRequirements": {
                    "roomName": "string (não vazio)",
                    "password": "string (mínimo 4 caracteres)"
                },
                "received": data
            }
        })

# Evento para entrar em uma sala
@socketio.on('join-room')
def handle_join_room(data):
    try:
        # Validação dos dados
        if not data or not isinstance(data, dict):
            raise ValueError("Formato de dados inválido")

        room_name = data.get("roomName")
        password = data.get("password")

        if not room_name or not isinstance(room_name, str) or not room_name.strip():
            raise ValueError("Nome da sala inválido")

        room_id = room_name.lower().strip()
        room = rooms.get(room_id)

        if not room:
            raise ValueError("Sala não encontrada")

        if not password or not isinstance(password, str) or hash_password(password) != room["password"]:
            raise ValueError("Credenciais inválidas")

        join_room(room_id)
        room["players"].add(request.sid)

        print(f"Jogador {request.sid} entrou na sala {room_id}")
        emit("state-update", room["state"])

    except Exception as error:
        print(f"Erro no acesso: {str(error)}")
        emit("server-error", {
            "code": "JOIN_ERROR",
            "message": str(error),
            "details": {
                "inputRequirements": {
                    "roomName": "string (não vazio)",
                    "password": "string (válida)"
                },
                "received": data
            }
        })

# Evento para atualizar o estado da sala
@socketio.on('state-update')
def handle_state_update(new_state):
    try:
        room_id = list(request.sid_rooms)[1]  # Obtém a sala atual do cliente
        if not room_id or room_id not in rooms:
            return

        room = rooms[room_id]
        if request.sid == room["manager"]:
            room["state"] = new_state
            emit("state-update", new_state, to=room_id)
            print(f"Estado da sala {room_id} atualizado")

    except Exception as error:
        print(f"Erro na sincronização: {str(error)}")

# Iniciar o servidor
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=10000)