import os
import tempfile
import json
import random
from typing import TypedDict, List, Dict
import PyPDF2
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.retrievers.multi_query import MultiQueryRetriever
from langgraph.graph import END, StateGraph
from werkzeug.utils import secure_filename
import cv2
import numpy as np
import base64
import time
import logging
import sys
from math import hypot
from bson.objectid import ObjectId
from datetime import datetime
import traceback
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {"origins": "http://localhost:5173"},
    r"/start-exam": {"origins": "http://localhost:5173"},
    r"/process-frame": {"origins": "http://localhost:5173"},
    r"/end-exam": {"origins": "http://localhost:5173"},
    r"/toggle_alerts": {"origins": "http://localhost:5173"},
    r"/api/health": {"origins": "http://localhost:5173"},
    r"/api/get-random-questions": {"origins": "http://localhost:5173"},
    r"/api/submit-results": {"origins": "http://localhost:5173"},
    r"/api/get-latest-result": {"origins": "http://localhost:5173"}
})

# MongoDB Configuration
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
try:
    client = MongoClient(MONGO_URI)
    db = client["mockauth"]
    users_collection = db["users"]
    quiz_collection = db["aptitudequestions"]
    classroom_collection = db["classrooms"]
    results_collection = db["results"]
    print("MongoDB connection successful")
except Exception as e:
    print(f"MongoDB connection failed: {str(e)}")

# API Keys & Config
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "your_api_key")
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), "eduquiz_uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

load_dotenv()

# Load aptitude questions into MongoDB if not present
def load_aptitude_questions():
    questions_path = os.path.join(os.path.dirname(__file__), "aptitude_questions.json")
    if not quiz_collection.find_one({"source": "aptitude_questions"}):
        try:
            with open(questions_path, 'r') as f:
                questions = json.load(f)
            quiz_data = {
                "title": "Aptitude Quiz",
                "questions": questions,
                "source": "aptitude_questions",
                "createdDate": datetime.now()
            }
            quiz_collection.insert_one(quiz_data)
            print("Aptitude questions loaded into MongoDB")
        except Exception as e:
            print(f"Failed to load aptitude questions: {str(e)}")

load_aptitude_questions()

# --- LAZY LOADING IMPLEMENTATION ---
llm = None
embeddings = None
face_cascade = None
eye_cascade = None

def get_llm():
    global llm
    if llm is None:
        print("Initializing ChatGroq for the first time...")
        try:
            llm = ChatGroq(
                temperature=0.2,
                model_name="meta-llama/llama-4-maverick-17b-128e-instruct",
                api_key=GROQ_API_KEY
            )
            print("ChatGroq initialized successfully")
        except Exception as e:
            print(f"ChatGroq initialization failed: {str(e)}")
            raise
    return llm

def get_embeddings():
    global embeddings
    if embeddings is None:
        print("Initializing HuggingFaceEmbeddings for the first time...")
        try:
            embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            print("HuggingFaceEmbeddings initialized successfully")
        except Exception as e:
            print(f"HuggingFaceEmbeddings initialization failed: {str(e)}")
            raise
    return embeddings

def get_face_cascade():
    global face_cascade
    if face_cascade is None:
        print("Loading face cascade model...")
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if face_cascade.empty():
            raise RuntimeError("Failed to load face cascade model")
    return face_cascade

def get_eye_cascade():
    global eye_cascade
    if eye_cascade is None:
        print("Loading eye cascade model...")
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        if eye_cascade.empty():
            raise RuntimeError("Failed to load eye cascade model")
    return eye_cascade
# --- END OF LAZY LOADING IMPLEMENTATION ---

# Set up logging for face tracking
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for face tracking
ALERT_ENABLED = True
looking_away = False
looking_away_start_time = 0
alert_threshold = 3.0
last_alert_time = 0
alert_cooldown = 10.0
warnings = 0
max_warnings = 10
long_blink_count = 0

# Default user setup
default_user = {
    "name": "Shimal",
    "role": "admin",
    "email": "shimal@example.com",
    "password": generate_password_hash("123456")
}

if not users_collection.find_one({"email": default_user["email"]}):
    users_collection.insert_one(default_user)
    print("✅ Default user inserted ")
else:
    print("ℹ️ Default user already exists.")

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    name = data.get("name")
    role = data.get("role")
    email = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})

    if not user:
        return jsonify({"message": "User not found"}), 401

    if user["name"] != name or user["role"] != role:
        return jsonify({"message": "Invalid name or role"}), 401

    if not check_password_hash(user["password"], password):
        return jsonify({"message": "Invalid password"}), 401

    return jsonify({"message": "Login successful"}), 200

# Endpoint to fetch 15 random questions
@app.route('/api/get-random-questions', methods=['GET'])
def get_random_questions():
    try:
        quiz = quiz_collection.find_one({"source": "aptitude_questions"})
        if not quiz or not quiz.get("questions"):
            return jsonify({"error": "No questions found in database"}), 404

        questions = quiz["questions"]
        random_questions = random.sample(questions, min(15, len(questions)))
        return jsonify({"questions": random_questions}), 200
    except Exception as e:
        logger.error(f"Error fetching random questions: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Endpoint to submit results
@app.route('/api/submit-results', methods=['POST'])
def submit_results():
    try:
        data = request.json
        answers = data.get("answers")  # {question_index: selected_option}
        questions = data.get("questions")  # List of questions for reference
        user_email = data.get("user_email", "shimal@example.com")

        if not answers or not questions:
            return jsonify({"error": "Missing answers or questions"}), 400

        score = 0
        results = []
        for idx, q in enumerate(questions):
            selected = answers.get(str(idx))
            is_correct = selected == q["answer"] if selected else False
            if is_correct:
                score += 1
            results.append({
                "question": q["question"],
                "selected": selected or "None",
                "correct_answer": q["answer"],
                "is_correct": is_correct
            })

        result_data = {
            "user_email": user_email,
            "score": score,
            "total_questions": len(questions),
            "results": results,
            "timestamp": datetime.now()
        }
        result_id = results_collection.insert_one(result_data).inserted_id

        return jsonify({"message": "Results submitted", "result_id": str(result_id), "score": score}), 200
    except Exception as e:
        logger.error(f"Error submitting results: {str(e)}")
        return jsonify({"error": str(e)}), 500

# New endpoint to fetch the latest result for a user
@app.route('/api/get-latest-result', methods=['POST'])
def get_latest_result():
    try:
        data = request.json
        user_email = data.get("user_email", "shimal@example.com")
        result = results_collection.find_one(
            {"user_email": user_email},
            sort=[("timestamp", -1)]
        )
        if not result:
            return jsonify({"error": "No results found for user"}), 404

        return jsonify({
            "score": result["score"],
            "total_questions": result["total_questions"],
            "percentage": (result["score"] / result["total_questions"] * 100) if result["total_questions"] > 0 else 0,
            "question_results": result["results"]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching latest result: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ... (Rest of the existing routes remain unchanged)
class GraphState(TypedDict):
    retriever: MultiQueryRetriever
    content: str
    difficulty: str
    num_questions: int
    questions: List[Dict]

def process_document(file_path, file_type=None):
    try:
        print(f"Processing document: {file_path} (type: {file_type})")
        if file_type == 'pdf':
            loader = PyPDFLoader(file_path)
        elif file_type in ['doc', 'docx']:
            loader = Docx2txtLoader(file_path)
        else:
            loader = TextLoader(file_path)
        documents = loader.load()
        content = " ".join([doc.page_content for doc in documents])
        print(f"Extracted content length: {len(content) if content else 0}")
        if not content:
            raise ValueError("Failed to extract content from the document")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(content)
        print(f"Number of chunks: {len(chunks)}")
        if not chunks:
            raise ValueError("No text chunks created from document")

        print("Creating FAISS vector store...")
        vectorstore = FAISS.from_texts(chunks, get_embeddings())
        base_retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

        print("Creating MultiQueryRetriever...")
        retriever = MultiQueryRetriever.from_llm(
            retriever=base_retriever,
            llm=get_llm(),
        )
        return retriever
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error in process_document: {error_details}")
        raise ValueError(f"Failed to process document: {str(e)}")

def retrieve_content(state: GraphState) -> GraphState:
    try:
        retriever = state.get("retriever")
        difficulty = state.get("difficulty", "medium")
        print(f"Retrieving content for difficulty: {difficulty}")

        if retriever is None:
            raise ValueError("Retriever object is missing")

        query = f"Information for {difficulty} difficulty quiz"
        docs = retriever.invoke(query)
        content = "\n\n".join([doc.page_content for doc in docs]) if docs else ""
        print(f"Retrieved content length: {len(content)}")
        if not content:
            raise ValueError("No relevant content retrieved")

        return {
            "retriever": retriever,
            "content": content,
            "difficulty": difficulty,
            "num_questions": state["num_questions"]
        }
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error in retrieve_content: {error_details}")
        raise ValueError(f"Failed to retrieve content: {str(e)}")

def generate_questions(state: GraphState) -> GraphState:
    try:
        content = state["content"]
        difficulty = state["difficulty"]
        num_questions = state["num_questions"]
        print(f"Generating {num_questions} questions (difficulty: {difficulty}, content length: {len(content)})")

        prompt = ChatPromptTemplate.from_template(""" 
        You are an expert quiz creator. Create {num_questions} quiz questions with the following parameters:
        
        1. Difficulty level: {difficulty}
        2. Each question should have four possible answers (A, B, C, D)
        3. Only use information found in the provided content
        
        Content:
        {content}
        
        Return the quiz in the following JSON format:
        
        [
            {{"question": "Question text",
              "options": [
                  "A. Option A",
                  "B. Option B", 
                  "C. Option C",
                  "D. Option D"
              ],
              "correct_answer": "A. Option A",
              "explanation": "Brief explanation of why this is correct"
            }}
        ]
        
        Only return the JSON without any additional explanation or text.
        """)

        parser = JsonOutputParser()
        chain = prompt | get_llm() | parser
        questions = chain.invoke({
            "content": content,
            "difficulty": difficulty,
            "num_questions": num_questions
        })
        print(f"Generated {len(questions) if questions else 0} questions")
        if not questions or not isinstance(questions, list):
            raise ValueError("No valid questions generated")

        for idx, question in enumerate(questions):
            if not all(key in question for key in ["question", "options", "correct_answer", "explanation"]):
                raise ValueError(f"Question {idx} is missing required fields")
            if len(question["options"]) != 4:
                raise ValueError(f"Question {idx} does not have exactly 4 options")
            if question["correct_answer"] not in question["options"]:
                raise ValueError(f"Question {idx} has a correct answer that is not in the options")

        return {"questions": questions}
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error in generate_questions: {error_details}")
        raise Exception(f"Failed to generate questions: {str(e)}")

def create_quiz_graph():
    workflow = StateGraph(GraphState)
    workflow.add_node("retrieve_content", retrieve_content)
    workflow.add_node("generate_questions", generate_questions)
    workflow.add_edge("retrieve_content", "generate_questions")
    workflow.add_edge("generate_questions", END)
    workflow.set_entry_point("retrieve_content")
    return workflow.compile()

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    print("Received request to generate quiz")
    if 'file' not in request.files and request.form.get('content_type') != 'youtube':
        print("Validation failed: No file provided")
        return jsonify({"error": "No file provided"}), 400

    content_type = request.form.get('content_type')
    difficulty = request.form.get('difficulty', 'medium')
    num_questions = request.form.get('num_questions', 3)
    class_name = request.form.get('class_name')
    year = request.form.get('year')
    teacher = request.form.get('teacher', 'default_teacher')

    if not class_name or not year:
        print("Validation failed: Required fields missing")
        return jsonify({"error": "Required fields missing"}), 400

    if difficulty not in ['easy', 'medium', 'hard']:
        print(f"Validation failed: Invalid difficulty: {difficulty}")
        return jsonify({"error": "Invalid difficulty level"}), 400

    try:
        num_questions = int(num_questions)
        if num_questions < 1 or num_questions > 20:
            print(f"Validation failed: Invalid number of questions: {num_questions}")
            return jsonify({"error": "Number of questions must be between 1 and 20"}), 400
    except ValueError:
        print(f"Validation failed: Invalid number of questions: {num_questions}")
        return jsonify({"error": "Number of questions must be a valid integer"}), 400

    file_path = None
    if content_type != 'youtube':
        file = request.files['file']
        file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if file_extension not in ['pdf', 'doc', 'docx']:
            print(f"Validation failed: Invalid file type: {file_extension}")
            return jsonify({"error": "Only PDF, DOC, DOCX files allowed"}), 400

        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try:
            file.save(file_path)
            print(f"Saved document to: {file_path}")
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"Failed to save file: {error_details}")
            return jsonify({"error": f"Failed to save file: {str(e)}"}), 500

    try:
        if content_type != 'youtube':
            retriever = process_document(file_path, file_extension)
        else:
            return jsonify({"error": "YouTube content type not supported in this version"}), 400

        quiz_graph = create_quiz_graph()
        result = quiz_graph.invoke({
            "retriever": retriever,
            "difficulty": difficulty,
            "num_questions": num_questions
        })

        if not result.get("questions") or not isinstance(result["questions"], list):
            print("Quiz generation failed: No valid questions generated")
            raise ValueError("No valid questions generated. The document may lack sufficient content for quiz generation.")

        generated_questions = result["questions"]
        print(f"Generated {len(generated_questions)} questions")

        quiz_data = {
            "title": f"Quiz for {class_name}",
            "questions": generated_questions,
            "createdDate": datetime.now(),
            "class_name": class_name,
            "year": year,
            "teacher": teacher
        }
        quiz_result = quiz_collection.insert_one(quiz_data)
        quiz_id = quiz_result.inserted_id
        print(f"Quiz saved to MongoDB with ID: {quiz_id}")

        classroom_data = {
            "name": class_name,
            "year": year,
            "teacher": teacher,
            "quizzes": [quiz_id],
            "createdDate": datetime.now(),
            "status": "active"
        }
        classroom_result = classroom_collection.insert_one(classroom_data)
        print(f"Classroom created with ID: {classroom_result.inserted_id}")

        return jsonify({
            "message": "Quiz and classroom created successfully",
            "quiz_id": str(quiz_id),
            "classroom_id": str(classroom_result.inserted_id),
            "quiz": generated_questions
        }), 201

    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error in generate_quiz: {error_details}")
        if 'quiz_id' in locals():
            quiz_collection.delete_one({"_id": quiz_id})
            print(f"Rolled back: Deleted quiz with ID: {quiz_id}")
        return jsonify({"error": str(e)}), 500

    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Temporary file removed: {file_path}")
            except Exception as e:
                print(f"Failed to remove temporary file {file_path}: {str(e)}")

def play_alert():
    global ALERT_ENABLED
    if ALERT_ENABLED:
        try:
            logger.info("Alert sound played (simulated)")
        except Exception as e:
            logger.error(f"Failed to play alert: {e}")
    logger.warning("ALERT: Not looking at camera!")

def detect_gaze(eye_frame):
    try:
        height, width = eye_frame.shape[:2]
        _, threshold_eye = cv2.threshold(eye_frame, 55, 255, cv2.THRESH_BINARY_INV)
        kernel = np.ones((3, 3), np.uint8)
        threshold_eye = cv2.morphologyEx(threshold_eye, cv2.MORPH_OPEN, kernel, iterations=1)
        contours, _ = cv2.findContours(threshold_eye, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        if len(contours) > 0:
            contour = max(contours, key=cv2.contourArea)
            if cv2.contourArea(contour) > 10:
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    pupil_cx = int(M["m10"] / M["m00"])
                    pupil_cy = int(M["m01"] / M["m00"])
                    relative_x = pupil_cx / width
                    if 0.3 <= relative_x <= 0.7:
                        return "center", relative_x
                    elif relative_x < 0.3:
                        return "left", relative_x
                    else:
                        return "right", relative_x
        return "center", 0.5
    except Exception as e:
        logger.error(f"Error in detect_gaze: {e}")
        return "center", 0.5

def process_image(image_data):
    global looking_away, looking_away_start_time, last_alert_time, warnings, long_blink_count
    try:
        img_bytes = base64.b64decode(image_data.split(',')[1])
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode image")
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        faces = get_face_cascade().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3)  # Adjusted parameters
        current_time = time.time()

        face_detected = len(faces) > 0
        looking_at_screen = False
        look_direction = "Unknown"
        eyes_closed = False
        blink_duration = 0
        violation_detected = False

        if not face_detected:
            if not looking_away:
                looking_away = True
                looking_away_start_time = current_time
            elif current_time - looking_away_start_time > alert_threshold:
                if current_time - last_alert_time > alert_cooldown:
                    play_alert()
                    last_alert_time = current_time
                    warnings += 1
                violation_detected = warnings >= max_warnings
        else:
            looking_away = False
            for (x, y, w, h) in faces:
                roi_gray = gray[y:y + h, x:x + w]
                eyes = get_eye_cascade().detectMultiScale(roi_gray, 1.1, 5)
                if len(eyes) == 0:
                    eyes_closed = True
                    blink_duration = current_time - (looking_away_start_time if looking_away else current_time)
                    if blink_duration > 2:
                        long_blink_count += 1
                else:
                    for (ex, ey, ew, eh) in eyes:
                        eye_frame = roi_gray[ey:ey + eh, ex:ex + ew]
                        direction, _ = detect_gaze(eye_frame)
                        look_direction = direction
                        looking_at_screen = direction == "center"
                        break
                if not looking_at_screen:
                    if not looking_away:
                        looking_away = True
                        looking_away_start_time = current_time
                    elif current_time - looking_away_start_time > alert_threshold:
                        if current_time - last_alert_time > alert_cooldown:
                            play_alert()
                            last_alert_time = current_time
                            warnings += 1
                        violation_detected = warnings >= max_warnings

        proctor_data = {
            "face_detected": face_detected,
            "looking_at_screen": looking_at_screen,
            "warnings": warnings,
            "max_warnings": max_warnings,
            "violation_detected": violation_detected,
            "look_direction": look_direction,
            "eyes_closed": eyes_closed,
            "blink_duration": blink_duration,
            "long_blink_count": long_blink_count,
            "head_pose": [0, 0, 0],
            "ear": 0
        }
        return proctor_data
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return {
            "face_detected": False, "looking_at_screen": False, "warnings": warnings,
            "max_warnings": max_warnings, "violation_detected": False, "look_direction": "Unknown",
            "eyes_closed": False, "blink_duration": 0, "long_blink_count": long_blink_count,
            "head_pose": [0, 0, 0], "ear": 0, "error": str(e)
        }

@app.route('/start-exam', methods=['POST'])
def start_exam():
    global warnings, long_blink_count
    warnings = 0
    long_blink_count = 0
    logger.info("Exam session started")
    return jsonify({"status": "Exam started"}), 200

@app.route('/process-frame', methods=['POST'])
def process_frame():
    try:
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data provided")
            return jsonify({"error": "No image data provided"}), 400
        proctor_data = process_image(data['image'])
        return jsonify(proctor_data), 200
    except Exception as e:
        logger.error(f"Error in process_frame: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/end-exam', methods=['POST'])
def end_exam():
    global warnings, long_blink_count
    warnings = 0
    long_blink_count = 0
    logger.info("Exam session ended")
    return jsonify({"status": "Exam ended"}), 200

@app.route('/toggle_alerts', methods=['GET'])
def toggle_alerts():
    global ALERT_ENABLED
    ALERT_ENABLED = not ALERT_ENABLED
    status = "enabled" if ALERT_ENABLED else "disabled"
    logger.info(f"Alerts {status}")
    return jsonify({"status": f"Alerts {status}"}), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    print("Health check requested")
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
