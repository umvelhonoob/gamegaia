from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
import json

app = Flask(__name__)
app.secret_key = "SUA_SECRET_KEY_AQUI"

# Configuração do banco de dados SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///game.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# Modelo para salas no banco de dados
class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(50), nullable=False)
    state = db.Column(db.Text, nullable=False)  # Armazena JSON como string


# Estado inicial do jogo
initial_state = {
    "players": {
        "1": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
        "2": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
        "3": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}},
        "4": {"balance": 1000, "recursos": {"combustivel": 0, "combustivel_salto": 0, "escudo_quantico": 0, "motor_salto": 0}}
    }
}


@app.before_request
def create_tables():
    """Garante que as tabelas sejam criadas antes da primeira requisição"""
    db.create_all()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/create_room", methods=["POST"])
def create_room():
    data = request.json
    room_name = data.get("roomName")
    password = data.get("password")

    if Room.query.filter_by(name=room_name).first():
        return jsonify({"error": "Sala já existe!"}), 400

    new_room = Room(name=room_name, password=password, state=json.dumps(initial_state))
    db.session.add(new_room)
    db.session.commit()

    return jsonify({"message": "Sala criada com sucesso!", "roomName": room_name})


@app.route("/join_room", methods=["POST"])
def join_room():
    data = request.json
    room_name = data.get("roomName")
    password = data.get("password")
    role = data.get("role")

    room = Room.query.filter_by(name=room_name).first()
    if not room:
        return jsonify({"error": "Sala não encontrada!"}), 404

    if role == "player" and room.password != password:
        return jsonify({"error": "Senha incorreta!"}), 403

    session["room"] = room_name
    return jsonify({"message": "Entrou na sala!", "roomName": room_name})


@app.route("/get_state", methods=["GET"])
def get_state():
    room_name = session.get("room")
    if not room_name:
        return jsonify({"error": "Nenhuma sala selecionada!"}), 404

    room = Room.query.filter_by(name=room_name).first()
    if not room:
        return jsonify({"error": "Sala não encontrada!"}), 404

    return jsonify(json.loads(room.state))


@app.route("/update_balance", methods=["POST"])
def update_balance():
    data = request.json
    room_name = session.get("room")
    player = str(data.get("player"))
    amount = int(data.get("amount"))

    room = Room.query.filter_by(name=room_name).first()
    if not room:
        return jsonify({"error": "Sala não encontrada!"}), 404

    state = json.loads(room.state)
    state["players"][player]["balance"] += amount
    room.state = json.dumps(state)
    db.session.commit()

    return jsonify({"message": "Saldo atualizado!", "new_balance": state["players"][player]["balance"]})


@app.route("/update_resource", methods=["POST"])
def update_resource():
    data = request.json
    room_name = session.get("room")
    player = str(data.get("player"))
    resource = data.get("resource")
    amount = int(data.get("amount"))

    room = Room.query.filter_by(name=room_name).first()
    if not room:
        return jsonify({"error": "Sala não encontrada!"}), 404

    state = json.loads(room.state)
    state["players"][player]["recursos"][resource] += amount
    room.state = json.dumps(state)
    db.session.commit()

    return jsonify({"message": "Recurso atualizado!"})


@app.route("/reset_game", methods=["POST"])
def reset_game():
    room_name = session.get("room")

    room = Room.query.filter_by(name=room_name).first()
    if not room:
        return jsonify({"error": "Sala não encontrada!"}), 404

    room.state = json.dumps(initial_state)
    db.session.commit()

    return jsonify({"message": "Jogo reiniciado!"})


if __name__ == "__main__":
    app.run(debug=True)
