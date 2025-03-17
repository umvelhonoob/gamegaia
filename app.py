from flask import Flask, request, jsonify, render_template, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import threading
import time

app = Flask(__name__)
app.secret_key = "SUA_SECRET_KEY_AQUI"  # Substitua por uma chave segura
socketio = SocketIO(app, cors_allowed_origins="*")  # Permite conexões do Render

# Estrutura das salas
rooms = {}

# Estrutura inicial do jogo
initial_state = {
    "players": {},
    "rules": {"maxPlayers": 4, "startBalance": 0},
    "financial_balance": 0,
    "last_active": time.time()
}

# Limpeza automática de salas inativas
def remove_inactive_rooms():
    while True:
        current_time = time.time()
        for room in list(rooms.keys()):
            if current_time - rooms[room]["last_active"] > 3600:  # 1 hora
                del rooms[room]
                print(f"Sala {room} removida por inatividade")
        time.sleep(600)

threading.Thread(target=remove_inactive_rooms, daemon=True).start()

# Função para notificar clientes conectados
def notify_clients(room_name):
    state = rooms[room_name]["state"]
    observer_count = rooms[room_name].get("observer_count", 0)
    socketio.emit("update", {"state": state, "observers": observer_count}, room=room_name)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/create_room", methods=["POST"])
def create_room():
    data = request.json
    room_name = data.get("roomName")
    password = data.get("password")
    player_name = data.get("playerName")

    if room_name in rooms:
        return jsonify({"error": "Sala já existe!"}), 400

    rooms[room_name] = {
        "password": password,
        "state": json.loads(json.dumps(initial_state)),
        "manager": "1",
        "observer_count": 0
    }
    rooms[room_name]["state"]["players"]["1"] = {
        "name": player_name or "Jogador 1",
        "balance": 0,
        "resources": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}
    }
    rooms[room_name]["state"]["financial_balance"] += 0
    
    session["room"] = room_name
    rooms[room_name]["last_active"] = time.time()
    return jsonify({"message": "Sala criada!", "roomName": room_name, "playerId": "1"})

@app.route("/Entrar_Sala", methods=["POST"])
def Entrar_Sala():
    data = request.json
    room_name = data.get("roomName")
    password = data.get("password")
    role = data.get("role")
    player_name = data.get("playerName")

    if room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if rooms[room_name]["password"] != password:
        return jsonify({"error": "Senha incorreta!"}), 403

    if len(rooms[room_name]["state"]["players"]) >= rooms[room_name]["state"]["rules"]["maxPlayers"]:
        return jsonify({"error": "Sala cheia!"}), 403

    next_player_id = str(len(rooms[room_name]["state"]["players"]) + 1)
    if role != "observer":
        rooms[room_name]["state"]["players"][next_player_id] = {
            "name": player_name or f"Jogador {next_player_id}",
            "balance": 0,
            "resources": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}
        }
        rooms[room_name]["state"]["financial_balance"] += 0
    else:
        rooms[room_name]["observer_count"] = rooms[room_name].get("observer_count", 0) + 1

    if role == "manager" and rooms[room_name]["manager"] is None:
        rooms[room_name]["manager"] = next_player_id

    session["room"] = room_name
    rooms[room_name]["last_active"] = time.time()
    notify_clients(room_name)
    return jsonify({"message": "Entrou na sala!", "roomName": room_name, "playerId": next_player_id if role != "observer" else None})

@app.route("/Sair_Sala", methods=["POST"])
def Sair_Sala():
    room_name = session.get("room")
    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    data = request.json
    player_id = data.get("playerId")
    is_observer = data.get("isObserver", False)

    if is_observer:
        rooms[room_name]["observer_count"] = max(0, rooms[room_name].get("observer_count", 0) - 1)
    elif player_id and player_id in rooms[room_name]["state"]["players"]:
        rooms[room_name]["state"]["financial_balance"] -= rooms[room_name]["state"]["players"][player_id]["balance"]
        del rooms[room_name]["state"]["players"][player_id]
        if not rooms[room_name]["state"]["players"]:
            del rooms[room_name]
            session.pop("room", None)
            print(f"Sala {room_name} destruída: todos os jogadores saíram")
            return jsonify({"message": "Sala destruída, todos os jogadores saíram!"})
        
        if rooms[room_name]["manager"] == player_id and rooms[room_name]["state"]["players"]:
            next_manager = next(iter(rooms[room_name]["state"]["players"]), None)
            rooms[room_name]["manager"] = next_manager

    rooms[room_name]["last_active"] = time.time()
    notify_clients(room_name)
    return jsonify({"message": "Jogador removido da sala!"})

# Eventos WebSocket
@socketio.on("connect")
def handle_connect():
    room_name = session.get("room")
    if room_name and room_name in rooms:
        join_room(room_name)
        notify_clients(room_name)
        print(f"Cliente conectado à sala {room_name}")
    else:
        emit("error", {"message": "Sala não encontrada!"})

@socketio.on("disconnect")
def handle_disconnect():
    room_name = session.get("room")
    if room_name and room_name in rooms:
        leave_room(room_name)
        print(f"Cliente desconectado da sala {room_name}")

# Outros endpoints
@app.route("/get_state", methods=["GET"])
def get_state():
    room_name = session.get("room")
    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"})
    return jsonify(rooms[room_name]["state"])

@app.route("/get_observers", methods=["GET"])
def get_observers():
    room_name = session.get("room")
    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"})
    return jsonify({"observers": rooms[room_name].get("observer_count", 0)})

@app.route("/update_balance", methods=["POST"])
def update_balance():
    data = request.json
    room_name = session.get("room")
    player = str(data.get("player"))
    amount = int(data.get("amount"))

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if player not in rooms[room_name]["state"]["players"]:
        return jsonify({"error": "Jogador não encontrado!"}), 404

    rooms[room_name]["state"]["players"][player]["balance"] += amount
    rooms[room_name]["state"]["financial_balance"] += amount
    rooms[room_name]["last_active"] = time.time()
    notify_clients(room_name)
    return jsonify({"message": "Saldo atualizado!", "new_balance": rooms[room_name]["state"]["players"][player]["balance"]})

@app.route("/update_resource", methods=["POST"])
def update_resource():
    data = request.json
    room_name = session.get("room")
    player = str(data.get("player"))
    resource = data.get("resource")
    amount = int(data.get("amount"))

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if player not in rooms[room_name]["state"]["players"]:
        return jsonify({"error": "Jogador não encontrado!"}), 404

    rooms[room_name]["state"]["players"][player]["resources"][resource] += amount
    if rooms[room_name]["state"]["players"][player]["resources"][resource] < 0:
        rooms[room_name]["state"]["players"][player]["resources"][resource] = 0
    rooms[room_name]["last_active"] = time.time()
    notify_clients(room_name)
    return jsonify({"message": "Recurso atualizado!"})

@app.route("/reset_game", methods=["POST"])
def reset_game():
    room_name = session.get("room")
    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    # Zera apenas os valores de recursos e dinheiro, mantendo os jogadores
    rooms[room_name]["state"]["financial_balance"] = 0
    for player_id in rooms[room_name]["state"]["players"]:
        rooms[room_name]["state"]["players"][player_id]["balance"] = 0
        rooms[room_name]["state"]["players"][player_id]["resources"] = {
            "combustivel": 0,
            "combustivel_salto": 0,
            "escudo_quantico": 0,
            "motor_salto": 0
        }

    rooms[room_name]["last_active"] = time.time()
    notify_clients(room_name)
    return jsonify({"message": "Valores de recursos e dinheiro zerados!"})


@app.route("/deposit_all", methods=["POST"])
def deposit_all():
    data = request.json
    room_name = session.get("room")
    amount = int(data.get("amount"))

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if amount <= 0:
        return jsonify({"error": "Quantidade deve ser positiva!"}), 400

    for player_id in rooms[room_name]["state"]["players"]:
        rooms[room_name]["state"]["players"][player_id]["balance"] += amount
        rooms[room_name]["state"]["financial_balance"] += amount

    rooms[room_name]["last_active"] = time.time()
    notify_clients(room_name)
    return jsonify({"message": f"Depositado {amount} para todos os jogadores!"})

if __name__ == "__main__":
    socketio.run(app, debug=True)