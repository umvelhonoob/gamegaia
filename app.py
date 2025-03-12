from flask import Flask, request, jsonify, render_template
from datetime import datetime
import hashlib
import json

# Configuração do Flask
app = Flask(__name__)

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

# Rota de teste
@app.route('/test', methods=['GET'])
def test():
    return jsonify({"message": "Servidor funcionando!"})

    # Rota de teste
@app.route('/', methods=['GET'])
def test():
    return render_template ('Index.html')

# Rota para criar uma sala
@app.route('/create-room', methods=['POST'])
def create_room():
    try:
        data = request.get_json()
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
            "players": set(),
            "manager": None,
            "createdAt": datetime.now().isoformat()
        }

        return jsonify({
            "status": "success",
            "roomId": room_id,
            "message": f"Sala {room_id} criada com sucesso"
        })

    except Exception as error:
        return jsonify({
            "code": "CREATE_ERROR",
            "message": str(error),
            "details": {
                "inputRequirements": {
                    "roomName": "string (não vazio)",
                    "password": "string (mínimo 4 caracteres)"
                },
                "received": data
            }
        }), 400

# Rota para entrar em uma sala
@app.route('/join-room', methods=['POST'])
def join_room():
    try:
        data = request.get_json()
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

        # Adiciona o jogador à sala (simulação)
        room["players"].add("player_id")  # Substitua por um ID real do jogador

        return jsonify({
            "status": "success",
            "roomId": room_id,
            "state": room["state"],
            "message": f"Jogador entrou na sala {room_id}"
        })

    except Exception as error:
        return jsonify({
            "code": "JOIN_ERROR",
            "message": str(error),
            "details": {
                "inputRequirements": {
                    "roomName": "string (não vazio)",
                    "password": "string (válida)"
                },
                "received": data
            }
        }), 400

# Iniciar o servidor
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)