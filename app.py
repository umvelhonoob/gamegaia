from flask import Flask, request, jsonify, render_template, session
import json
import threading
import time

app = Flask(__name__)
app.secret_key = "SUA_SECRET_KEY_AQUI"

# Estrutura das salas
rooms = {}

# Estrutura inicial do jogo
initial_state = {
    "players": {},
    "rules": {"maxPlayers": 4, "startBalance": 1000},
    "financial_balance": 0,
    "last_active": time.time()
}

# Limpeza automática de salas inativas ou vazias
def remove_inactive_rooms():
    while True:
        current_time = time.time()
        for room in list(rooms.keys()):
            # Condição 1: Inatividade por 1 hora
            inactive = current_time - rooms[room]["last_active"] > 3600
            # Condição 2: Nenhum jogador e nenhum observador
            empty = (not rooms[room]["state"]["players"] and rooms[room].get("observer_count", 0) == 0)
            
            if inactive or empty:
                del rooms[room]
                print(f"Sala {room} removida: {'inativa' if inactive else 'vazia'}")
        
        time.sleep(600)  # Checa a cada 10 minutos
# Inicia a thread de limpeza
threading.Thread(target=remove_inactive_rooms, daemon=True).start()

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
        return jsonify({"error": "Sala já existe!"})

    rooms[room_name] = {
        "password": password,
        "state": json.loads(json.dumps(initial_state)),
        "manager": "1",
        "observer_count": 0  # Inicializa o contador de observadores
    }
    
    rooms[room_name]["state"]["players"]["1"] = {
        "name": player_name or "Jogador 1",
        "balance": 1000,
        "resources": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}
    }
    rooms[room_name]["state"]["financial_balance"] += 1000
    
    session["room"] = room_name
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
            "balance": 1000,
            "resources": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}
        }
        rooms[room_name]["state"]["financial_balance"] += 1000
    else:
        rooms[room_name]["observer_count"] = rooms[room_name].get("observer_count", 0) + 1

    if role == "manager" and rooms[room_name]["manager"] is None:
        rooms[room_name]["manager"] = next_player_id

    session["room"] = room_name
    rooms[room_name]["last_active"] = time.time()
    return jsonify({"message": "Entrou na sala!", "roomName": room_name, "playerId": next_player_id if role != "observer" else None})

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
    # Aqui, assumimos que observadores não estão em "players". Para rastrear observadores, precisaríamos de uma lista separada.
    # Por simplicidade, vamos simular com um contador fictício ou implementar uma lista de observadores.
    observer_count = rooms[room_name].get("observer_count", 0)
    return jsonify({"observers": observer_count})


@app.route("/update_balance", methods=["POST"])
def update_balance():
    data = request.json
    room_name = session.get("room")
    player = str(data.get("player"))
    amount = int(data.get("amount"))

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if player not in rooms[room_name]["state"]["players"]:
        rooms[room_name]["state"]["players"][player] = {"balance": 1000, "resources": {}}

    rooms[room_name]["state"]["players"][player]["balance"] += amount
    rooms[room_name]["state"]["financial_balance"] += amount
    rooms[room_name]["last_active"] = time.time()

    return jsonify({"message": "Saldo atualizado!", "new_balance": rooms[room_name]["state"]["players"][player]["balance"]})



@app.route("/reset_game", methods=["POST"])
def reset_game():
    room_name = session.get("room")

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    rooms[room_name]["state"] = json.loads(json.dumps(initial_state))
    rooms[room_name]["last_active"] = time.time()
    return jsonify({"message": "Jogo reiniciado!"})



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
        rooms[room_name]["state"]["players"][player]["resources"][resource] = 0  # Impede valores negativos
    rooms[room_name]["last_active"] = time.time()

    return jsonify({"message": "Recurso atualizado!"})

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
        rooms[room_name]["state"]["financial_balance"] -= rooms[room_name]["state"]["players"][player_id]['balance']
        del rooms[room_name]["state"]["players"][player_id]
        if rooms[room_name]["manager"] == player_id and rooms[room_name]["state"]["players"]:
            next_manager = next(iter(rooms[room_name]["state"]["players"]), None)
            rooms[room_name]["manager"] = next_manager

    # Se não houver mais jogadores, destrói a sala imediatamente
        if not rooms[room_name]["state"]["players"]:
            del rooms[room_name]
            session.pop("room", None)
            print(f"Sala {room_name} destruída: todos os jogadores saíram")
            return jsonify({"message": "Sala destruída, todos os jogadores saíram!"})
        
    rooms[room_name]["last_active"] = time.time()
    return jsonify({"message": "Jogador removido da sala!"})

if __name__ == "__main__":
    app.run(debug=True)
