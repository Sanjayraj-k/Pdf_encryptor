from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import re
from datetime import datetime, timedelta
import tempfile
from werkzeug.utils import secure_filename
import PyPDF2
import docx
import random
import threading
from dotenv import load_dotenv

# --- LangChain & Groq Imports ---
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from pydantic import BaseModel, Field

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
AUDIO_FOLDER = 'audio'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# --- AI & TTS Initialization ---
try:
    llm = ChatGroq(
        temperature=0.7, 
        model_name="llama3-8b-8192", 
        api_key=os.getenv("GROK_API_KEY")
    )
    import pyttsx3
    tts_engine = pyttsx3.init()
    voices = tts_engine.getProperty('voices')
    for voice in voices:
        if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
            tts_engine.setProperty('voice', voice.id)
            break
    tts_engine.setProperty('rate', 175)
    tts_engine.setProperty('volume', 0.9)
except Exception as e:
    print(f"Error initializing AI or TTS: {e}")
    llm = None
    tts_engine = None

# --- Interview State Management ---
interview_sessions = {}
INTERVIEW_PHASES = {
    'self_intro': {'name': 'Getting to Know You', 'questions_count': 2, 'next_phase': 'skills'},
    'skills': {'name': 'Skills Exploration', 'questions_count': 3, 'next_phase': 'projects'},
    'projects': {'name': 'Project Highlights', 'questions_count': 3, 'next_phase': 'experience'},
    'experience': {'name': 'Experience Review', 'questions_count': 2, 'next_phase': 'complete'}
}


# --- Resume Parsing (unchanged) ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_path):
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() or ""
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def extract_text_from_docx(file_path):
    text = ""
    try:
        doc = docx.Document(file_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
    except Exception as e:
        print(f"Error reading DOCX: {e}")
    return text

def extract_text_from_txt(file_path):
    text = ""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            text = file.read()
    except Exception as e:
        print(f"Error reading TXT: {e}")
    return text

def extract_resume_text(file_path, filename):
    ext = filename.rsplit('.', 1)[1].lower()
    if ext == 'pdf': return extract_text_from_pdf(file_path)
    if ext == 'docx': return extract_text_from_docx(file_path)
    if ext == 'txt': return extract_text_from_txt(file_path)
    return ""

def extract_details_from_resume(resume_text):
    skills = list(set(re.findall(r'(?i)\b(Python|Java|JavaScript|React|Node\.js|SQL|Git|Docker|AWS|Cloud|Agile|Scrum|LangChain|Razorpay)\b', resume_text)))[:15]
    projects_section = re.search(r'PROJECTS?([\s\S]*?)(?:EXPERIENCE|EDUCATION|SKILLS|$)', resume_text, re.IGNORECASE)
    projects = re.findall(r'^\s*[\*•-]\s*(.*)', projects_section.group(1) if projects_section else '', re.MULTILINE)[:5]
    experience_section = re.search(r'EXPERIENCE([\s\S]*?)(?:PROJECTS|EDUCATION|SKILLS|$)', resume_text, re.IGNORECASE)
    experiences = re.findall(r'^\s*[\*•-]\s*(.*)', experience_section.group(1) if experience_section else '', re.MULTILINE)[:5]
    return skills, projects, experiences

# --- New LangChain-Powered AI Functions ---
def generate_initial_question():
    return random.choice([
        "Hi! I'm Sarah, and I'm excited to learn more about you today. To start, could you please tell me about yourself and what led you to apply for this role?",
        "Hello, it's great to meet you. To get us started, could you walk me through your background and what you're passionate about in your field?",
    ])

def format_conversation_history(conversation):
    history = ""
    for msg in conversation:
        if msg['type'] == 'hr':
            history += f"Sarah (HR): {msg['message']}\n"
        else:
            history += f"Candidate: {msg['message']}\n"
    return history

def generate_contextual_question(session, last_user_response):
    if not llm: return "What is your greatest strength?"

    phase_info = INTERVIEW_PHASES[session['current_phase']]
    
    # *** MODIFIED PROMPT ***
    # This prompt is more aggressive about using the user's last response for the next question.
    prompt = ChatPromptTemplate.from_template(
        """You are Sarah, a friendly and professional HR manager. Your goal is to conduct a natural, engaging interview.
        
        **Current Interview Phase**: {phase_name}
        
        **Conversation History**:
        {history}

        **Your Task**:
        Your ABSOLUTE PRIORITY is to ask a follow-up question based on the candidate's last response.
        - **Candidate's Last Response**: "{last_response}"
        - If they mentioned a specific technology (like 'LangChain' or 'Razorpay'), a project, or an experience, ask a question that digs deeper into *that specific detail*.
        - Your question should be relevant to the current interview phase: {phase_name}.
        - **DO NOT** repeat questions from the history.
        - Respond with ONLY the question itself. Do not add any conversational filler like "I see" or "Thanks".

        Your next question:"""
    )

    chain = prompt | llm | StrOutputParser()
    
    question = chain.invoke({
        "phase_name": phase_info['name'],
        "history": format_conversation_history(session['conversation']),
        "last_response": last_user_response
    })

    return question.strip()

class Evaluation(BaseModel):
    score: int = Field(description="Score from 0-100 based on relevance, clarity, and depth.", ge=0, le=100)
    feedback: str = Field(description="2-3 sentences of constructive, encouraging feedback for the user to see after the interview.")

def evaluate_response(user_response, question):
    if not llm: return {'score': 75, 'feedback': 'Good response. Keep up the great work!'}
    
    parser = JsonOutputParser(pydantic_object=Evaluation)
    prompt = ChatPromptTemplate.from_template(
        """You are an expert HR evaluator. Evaluate the candidate's response to the question.
        
        **Evaluation Criteria**:
        - Relevance: Did they answer the question directly?
        - Clarity: Was the answer easy to understand?
        - Depth & STAR method: Did they provide specific examples, data, or stories (Situation, Task, Action, Result)?

        **Question Asked**: "{question}"
        **Candidate's Response**: "{response}"

        {format_instructions}
        """
    )
    chain = prompt | llm | parser

    try:
        evaluation = chain.invoke({
            "question": question,
            "response": user_response,
            "format_instructions": parser.get_format_instructions(),
        })
        return evaluation
    except Exception as e:
        print(f"Evaluation parsing error: {e}")
        return {'score': 78, 'feedback': 'Thank you for your response. Try to include more specific examples next time.'}

def text_to_speech(text, session_id):
    if not tts_engine: return None
    try:
        filename = f"hr_{session_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.mp3"
        filepath = os.path.join(AUDIO_FOLDER, filename)
        tts_engine.save_to_file(text, filepath)
        tts_engine.runAndWait()
        return filename
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

# --- Helper Functions (unchanged) ---
def calculate_total_questions():
    return sum(phase['questions_count'] for phase in INTERVIEW_PHASES.values())

def get_current_question_number(session):
    q_num = 1
    phase_order = list(INTERVIEW_PHASES.keys())
    current_phase_index = phase_order.index(session['current_phase'])
    
    for i in range(current_phase_index):
        q_num += INTERVIEW_PHASES[phase_order[i]]['questions_count']
    
    q_num += session['phase_question_count']
    return q_num

# --- API Endpoints ---
@app.route('/upload-resume', methods=['POST'])
def upload_resume():
    if 'resume' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['resume']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file'}), 400

    try:
        filename = secure_filename(file.filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=filename, dir=app.config['UPLOAD_FOLDER']) as tmp:
            file.save(tmp.name)
            resume_text = extract_resume_text(tmp.name, filename)
        os.unlink(tmp.name)

        if not resume_text.strip(): return jsonify({'error': 'Could not extract text from resume'}), 400

        skills, projects, experiences = extract_details_from_resume(resume_text)
        session_id = f"session_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        initial_question = generate_initial_question()
        
        session = {
            'resume_text': resume_text, 'skills': skills, 'projects': projects, 'experiences': experiences,
            'current_phase': 'self_intro', 'phase_question_count': 0, 'conversation': [],
            'last_question': initial_question, 'created_at': datetime.now()
        }
        session['conversation'].append({'type': 'hr', 'message': initial_question})
        interview_sessions[session_id] = session

        audio_file = text_to_speech(initial_question, session_id)

        return jsonify({
            'session_id': session_id, 'skills': skills, 'projects': projects, 'experiences': experiences,
            'initial_question': initial_question, 'audio_file': audio_file,
            'phase': 'self_intro', 'question_number': 1, 'total_questions': calculate_total_questions()
        })
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': f'Server error during upload: {e}'}), 500

@app.route('/submit-response', methods=['POST'])
def submit_response():
    data = request.json
    session_id = data.get('session_id')
    user_response = data.get('response', '').strip()

    if not session_id or session_id not in interview_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    if not user_response:
        return jsonify({'error': 'Empty response'}), 400

    session = interview_sessions[session_id]
    
    evaluation = evaluate_response(user_response, session['last_question'])
    
    session['conversation'].append({
        'type': 'user', 'message': user_response, 'score': evaluation['score'], 'feedback': evaluation['feedback']
    })

    current_phase_info = INTERVIEW_PHASES[session['current_phase']]
    session['phase_question_count'] += 1
    
    interview_complete = False
    # *** MODIFIED HR RESPONSE LOGIC ***
    # The hr_response is now *only* the next question or the closing statement.
    hr_response = "" 

    if session['phase_question_count'] >= current_phase_info['questions_count']:
        next_phase_key = current_phase_info['next_phase']
        if next_phase_key == 'complete':
            interview_complete = True
            hr_response = "Thank you for your time today! That concludes our interview. We'll review everything and be in touch soon. Have a great day!"
        else:
            session['current_phase'] = next_phase_key
            session['phase_question_count'] = 0
            # Generate the first question of the new phase
            hr_response = generate_contextual_question(session, user_response)
    else:
        # Continue in the same phase, generate next question
        hr_response = generate_contextual_question(session, user_response)

    if not interview_complete:
        session['last_question'] = hr_response
        session['conversation'].append({'type': 'hr', 'message': hr_response})
    
    audio_file = text_to_speech(hr_response, session_id)

    return jsonify({
        'hr_response': hr_response, 'audio_file': audio_file, 'interview_complete': interview_complete,
        'phase': session['current_phase'], 'question_number': get_current_question_number(session),
        'total_questions': calculate_total_questions(), 'response_score': evaluation['score'],
        'response_feedback': evaluation['feedback'] # We still send this for the UI
    })

@app.route('/get-audio/<filename>')
def get_audio(filename):
    try:
        return send_file(os.path.join(AUDIO_FOLDER, filename), mimetype='audio/mpeg')
    except FileNotFoundError:
        return jsonify({'error': 'Audio file not found'}), 404

def cleanup_old_files_and_sessions():
    now = datetime.now()
    for session_id in list(interview_sessions.keys()):
        if now - interview_sessions[session_id]['created_at'] > timedelta(hours=2):
            del interview_sessions[session_id]
    for filename in os.listdir(AUDIO_FOLDER):
        filepath = os.path.join(AUDIO_FOLDER, filename)
        if os.path.getmtime(filepath) < (now - timedelta(hours=2)).timestamp():
            os.remove(filepath)

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'active_sessions': len(interview_sessions)})

if __name__ == '__main__':
    cleanup_thread = threading.Timer(3600, cleanup_old_files_and_sessions)
    cleanup_thread.daemon = True
    cleanup_thread.start()
    
    app.run(debug=True, host='0.0.0.0', port=5000)