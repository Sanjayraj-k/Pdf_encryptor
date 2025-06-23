from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import bcrypt
import re

app = Flask(__name__)
# This allows your React app at localhost:5173 to communicate with your Flask server
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

# --- Database Connection ---
# Make sure your MongoDB server is running
mongo_uri = "mongodb://localhost:27017/"
client = MongoClient(mongo_uri)
db = client['hrDashboard']  # The database name

# --- Helper Functions ---
def is_valid_email(email):
    """Validates email format."""
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email)

# --- Authentication Endpoints ---

@app.route('/api/signup', methods=['POST'])
def signup():
    """Registers a new HR user."""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        if not is_valid_email(email):
            return jsonify({"error": "Invalid email format"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long"}), 400
        if db.users.find_one({"email": email}):
            return jsonify({"error": "Email already registered"}), 409

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user = {"email": email, "hashedPassword": hashed_password, "createdAt": datetime.utcnow()}
        db.users.insert_one(user)
        
        user_response = {"email": user["email"], "createdAt": user["createdAt"]}
        return jsonify({"message": "User registered successfully", "user": user_response}), 201
    except Exception as e:
        app.logger.error(f"Signup error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Logs in an HR user."""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = db.users.find_one({"email": email})
        if not user or not bcrypt.checkpw(password.encode('utf-8'), user['hashedPassword'].encode('utf-8')):
            return jsonify({"error": "Invalid email or password"}), 401
        
        user_response = {"email": user["email"], "id": str(user["_id"])}
        return jsonify({"message": "Login successful", "user": user_response}), 200
    except Exception as e:
        app.logger.error(f"Login error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

# --- Candidate Login Endpoint ---
@app.route('/api/candidate/login', methods=['POST'])
def candidate_login():
    """Logs in a candidate (student) user."""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Find student in the database using email only
        student = db.students.find_one({"email": email})
        if not student or not bcrypt.checkpw(password.encode('utf-8'), student['password'].encode('utf-8')):
            return jsonify({"error": "Invalid credentials"}), 401

        # Prepare response (exclude password)
        student_response = {
            "id": str(student["_id"]),
            "name": student["name"],
            "email": student["email"],
            "role": student["role"],
            "rollNo": student["rollNo"],
            "status": student["status"]
        }
        # Simulate a token (replace with JWT in production)
        token = "dummy-token"

        return jsonify({
            "message": "Login successful",
            "student": student_response,
            "token": token
        }), 200
    except Exception as e:
        app.logger.error(f"Candidate login error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

# --- Roles Endpoints (Scoped to HR User) ---

@app.route('/api/roles', methods=['GET'])
def get_roles():
    """Gets all roles created by a specific HR user."""
    hr_email = request.args.get('hrEmail')
    if not hr_email:
        return jsonify({"error": "hrEmail query parameter is required"}), 400
    
    try:
        roles_cursor = db.roles.find({"hrEmail": hr_email})
        roles_list = []
        for role in roles_cursor:
            role['_id'] = str(role['_id'])  # Convert ObjectId for JSON compatibility
            roles_list.append(role)
        return jsonify(roles_list), 200
    except Exception as e:
        app.logger.error(f"Get roles error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/roles', methods=['POST'])
def create_role():
    """Creates a new role and associates it with the logged-in HR user."""
    try:
        data = request.get_json()
        hr_email = data.get("hrEmail")
        
        if not hr_email:
            return jsonify({"error": "hrEmail is required to create a role"}), 400

        # Basic validation for required fields
        required_fields = ["title", "description", "date", "maxStudents", "seatsAvailable", "package"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Missing one of required fields: {required_fields}"}), 400

        role = {
            "hrEmail": hr_email,
            "title": data.get("title"),
            "description": data.get("description"),
            "date": data.get("date"),
            "duration": data.get("duration", "60"),
            "maxStudents": int(data.get("maxStudents")),
            "seatsAvailable": int(data.get("seatsAvailable")),
            "package": data.get("package"),
            "studentsCount": 0,
            "status": "Draft",
            "createdAt": datetime.utcnow()
        }
        result = db.roles.insert_one(role)
        role['_id'] = str(result.inserted_id)
        return jsonify(role), 201
    except Exception as e:
        app.logger.error(f"Create role error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

# --- Students Endpoints (Scoped to HR User) ---

@app.route('/api/students', methods=['GET'])
def get_students():
    """Gets all students added by a specific HR user."""
    hr_email = request.args.get('hrEmail')
    if not hr_email:
        return jsonify({"error": "hrEmail query parameter is required"}), 400
        
    try:
        # Find students, excluding the sensitive password field from the result
        students_cursor = db.students.find({"hrEmail": hr_email}, {'password': 0})
        students_list = []
        for student in students_cursor:
            student['_id'] = str(student['_id'])
            students_list.append(student)
        return jsonify(students_list), 200
    except Exception as e:
        app.logger.error(f"Get students error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/students', methods=['POST'])
def create_student():
    """Creates a new student and associates them with the logged-in HR user."""
    try:
        data = request.get_json()
        hr_email = data.get("hrEmail")

        if not hr_email:
            return jsonify({"error": "hrEmail is required to add a student"}), 400
        
        required_fields = ["name", "email", "rollNo", "role", "password"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Missing one of required fields: {required_fields}"}), 400
        
        if db.students.find_one({"email": data.get("email")}):
            return jsonify({"error": "A student with this email already exists"}), 409

        hashed_password = bcrypt.hashpw(data.get("password").encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        student = {
            "hrEmail": hr_email,
            "name": data.get("name"),
            "email": data.get("email"),
            "rollNo": data.get("rollNo"),
            "role": data.get("role"),
            "password": hashed_password,
            "status": "Eligible",
            "createdAt": datetime.utcnow()
        }
        result = db.students.insert_one(student)
        student['_id'] = str(result.inserted_id)
        del student['password']  # Never send the password hash back in the response
        return jsonify(student), 201
    except Exception as e:
        app.logger.error(f"Create student error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500
    
@app.route('/api/get-random-questions', methods=['GET'])
def get_random_questions():
    """Fetches a random set of questions from the aptitude collection."""
    try:
        # Get the total number of questions in the aptitude collection
        total_questions = db.aptitude.count_documents({})
        if total_questions == 0:
            return jsonify({"error": "No questions available in the aptitude collection"}), 404

        # Determine how many questions to fetch (e.g., 5, or use a query parameter)
        num_questions = min(request.args.get('count', default=5, type=int), total_questions)
        
        # Fetch random questions using aggregate with $sample
        pipeline = [{"$sample": {"size": num_questions}}]
        questions = list(db.aptitude.aggregate(pipeline))

        # Convert ObjectId to string for JSON compatibility
        for question in questions:
            question['_id'] = str(question['_id'])

        return jsonify(questions), 200
    except Exception as e:
        app.logger.error(f"Get random questions error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/submit-results', methods=['POST'])
def submit_results():
    """Stores quiz results for a candidate, including user details, score, percentage, and round."""
    try:
        data = request.get_json()
        candidate_data = data.get("candidate")
        score = data.get("score")
        percentage = data.get("percentage")
        total_questions = data.get("total_questions")
        round_number = data.get("round")

        # Validate required fields
        required_fields = ["id", "email", "rollNo", "role", "status"]
        if not candidate_data or not all(field in candidate_data for field in required_fields):
            return jsonify({"error": "Missing required candidate data fields: id, email, rollNo, role, status"}), 400
        if score is None or percentage is None or total_questions is None or round_number is None:
            return jsonify({"error": "Missing required fields: score, percentage, total_questions, or round"}), 400

        # Prepare quiz result document
        quiz_result = {
            "candidate_id": candidate_data["id"],
            "email": candidate_data["email"],
            "rollNo": candidate_data["rollNo"],
            "role": candidate_data["role"],
            "status": candidate_data["status"],
            "score": int(score),
            "percentage": float(percentage),
            "total_questions": int(total_questions),
            "round": int(round_number),
            "submittedAt": datetime.utcnow()
        }

        # Insert into quiz_results collection
        result = db.quiz_results.insert_one(quiz_result)
        quiz_result['_id'] = str(result.inserted_id)

        return jsonify({
            "message": "Quiz results stored successfully",
            "quiz_result": quiz_result
        }), 201
    except Exception as e:
        app.logger.error(f"Submit results error: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
