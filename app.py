from flask import Flask, request, jsonify, render_template, session
import json

app = Flask(__name__)
app.secret_key = "SUA_SECRET_KEY_AQUI"  # Mantenha sua secret key original

# Estado inicial do jogo
initial_state = {
    "players": {
        "1": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
        "2": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
        "3": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
        "4": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}}
    }
}

rooms = {}  # Estrutura para armazenar salas dinamicamente


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/create_room", methods=["POST"])
def create_room():
    data = request.json
    room_name = data.get("roomName")
    password = data.get("password")

    if room_name in rooms:
        return jsonify({"error": "Sala já existe!"}), 400

    rooms[room_name] = {"password": password, "state": json.loads(json.dumps(initial_state))}
    return jsonify({"message": "Sala criada com sucesso!", "roomName": room_name})


@app.route("/join_room", methods=["POST"])
def join_room():
    data = request.json
    room_name = data.get("roomName")
    password = data.get("password")
    role = data.get("role")

    if room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if role == "player" and rooms[room_name]["password"] != password:
        return jsonify({"error": "Senha incorreta!"}), 403

    session["room"] = room_name
    return jsonify({"message": "Entrou na sala!", "roomName": room_name})


@app.route("/get_state", methods=["GET"])
def get_state():
    room_name = session.get("room")

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    return jsonify(rooms[room_name]["state"])


@app.route("/update_balance", methods=["POST"])
def update_balance():
    data = request.json
    room_name = session.get("room")
    player = str(data.get("player"))
    amount = int(data.get("amount"))

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    rooms[room_name]["state"]["players"][player]["balance"] += amount
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

    rooms[room_name]["state"]["players"][player]["recursos"][resource] += amount
    return jsonify({"message": "Recurso atualizado!"})


@app.route("/reset_game", methods=["POST"])
def reset_game():
    room_name = session.get("room")

    if not room_name or room_name not in rooms:
        return jsonify({"error": "Sala não encontrada!"}), 404

    rooms[room_name]["state"] = json.loads(json.dumps(initial_state))
    return jsonify({"message": "Jogo reiniciado!"})


if __name__ == "__main__":
    app.run(debug=True)
