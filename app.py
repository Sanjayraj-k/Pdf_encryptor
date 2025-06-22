from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)
app.config["MONGO_URI"] = "mongodb://localhost:27017/mockauth"

mongo = PyMongo(app)

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    user = mongo.db.users.find_one({"email": email, "auth_method": "email"})
    
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"message": "Invalid email or password"}), 401 # 401 Unauthorized

    return jsonify({"message": "Login successful"}), 200

if __name__ == "__main__":
    app.run(debug=True, port=5000)