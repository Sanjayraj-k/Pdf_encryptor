from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from bson import ObjectId

app = Flask(__name__)
CORS(app)

# MongoDB connection
try:
    # Connect to MongoDB (replace with your MongoDB connection string)
    client = MongoClient('mongodb://localhost:27017/')
    db = client['interview_platform']
    questions_collection = db['questions']
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")

# Sample data to populate the database
sample_questions = [
    {
        "title": "Tell me about yourself.",
        "category": "Behavioral",
        "company": "Apple",
        "difficulty": "Easy",
        "experience": "Focus on your professional journey, key achievements, and what you're looking for in your next role. Structure your answer using the present-past-future format.",
        "lastUpdated": datetime.now() - timedelta(minutes=7),
        "pdfUrl": "https://example.com/behavioral-questions-guide.pdf",
        "pdfName": "Behavioral Questions Guide.pdf"
    },
    {
        "title": "How do you approach troubleshooting and resolving unexpected system failures in a production environment?",
        "category": "System Design",
        "company": "Visa",
        "difficulty": "Hard",
        "experience": "Start with immediate containment, then systematic diagnosis using logs, monitoring tools, and gradual rollback strategies. Follow incident response protocols and document everything for post-mortem analysis.",
        "lastUpdated": datetime.now() - timedelta(hours=8),
        "pdfUrl": "https://example.com/system-design-troubleshooting.pdf",
        "pdfName": "System Design Troubleshooting Guide.pdf"
    },
    {
        "title": "What approaches would you use to manage a project that's falling behind schedule?",
        "category": "Technical",
        "company": "Amazon",
        "difficulty": "Hard",
        "experience": "Reassess scope and priorities, identify bottlenecks, consider adding resources or adjusting timeline. Communicate transparently with stakeholders about risks and mitigation strategies.",
        "lastUpdated": datetime.now() - timedelta(hours=9),
        "pdfUrl": "https://example.com/project-management-strategies.pdf",
        "pdfName": "Project Management Strategies.pdf"
    },
    {
        "title": "Explain the difference between REST and GraphQL APIs",
        "category": "Technical",
        "company": "Google",
        "difficulty": "Medium",
        "experience": "REST uses multiple endpoints with fixed data structures and standard HTTP methods. GraphQL uses a single endpoint with flexible queries, allowing clients to request exactly the data they need.",
        "lastUpdated": datetime.now() - timedelta(days=2),
        "pdfUrl": "https://example.com/api-design-patterns.pdf",
        "pdfName": "API Design Patterns.pdf"
    },
    {
        "title": "How do you handle conflicts in a team?",
        "category": "Behavioral",
        "company": "Microsoft",
        "difficulty": "Medium",
        "experience": "Listen actively to all perspectives, identify root causes, focus on solutions rather than blame. Facilitate open communication and find common ground that aligns with team objectives.",
        "lastUpdated": datetime.now() - timedelta(days=5),
        "pdfUrl": "https://example.com/team-collaboration-guide.pdf",
        "pdfName": "Team Collaboration Guide.pdf"
    },
    {
        "title": "What is your experience with microservices architecture?",
        "category": "System Design",
        "company": "Netflix",
        "difficulty": "Hard",
        "experience": "Microservices offer scalability and independent deployment but require careful service boundaries, API versioning, and distributed system considerations like eventual consistency.",
        "lastUpdated": datetime.now() - timedelta(days=3),
        "pdfUrl": "https://example.com/microservices-architecture.pdf",
        "pdfName": "Microservices Architecture Guide.pdf"
    },
    {
        "title": "Describe a time when you had to learn a new technology quickly",
        "category": "Behavioral",
        "company": "Facebook",
        "difficulty": "Medium",
        "experience": "Use the STAR method: Situation, Task, Action, Result. Focus on your learning process, resources used, and how you applied the knowledge successfully.",
        "lastUpdated": datetime.now() - timedelta(days=1),
        "pdfUrl": "https://example.com/learning-strategies.pdf",
        "pdfName": "Learning Strategies for Engineers.pdf"
    },
    {
        "title": "How would you design a URL shortener like bit.ly?",
        "category": "System Design",
        "company": "Twitter",
        "difficulty": "Hard",
        "experience": "Consider URL encoding algorithms, database design for scalability, caching strategies, analytics tracking, and handling high read/write ratios with appropriate data structures.",
        "lastUpdated": datetime.now() - timedelta(days=6),
        "pdfUrl": "https://example.com/url-shortener-design.pdf",
        "pdfName": "URL Shortener System Design.pdf"
    },
    {
        "title": "What is dependency injection and why is it useful?",
        "category": "Technical",
        "company": "Microsoft",
        "difficulty": "Medium",
        "experience": "Dependency injection is a design pattern where dependencies are provided to a class rather than created inside it. This improves testability, modularity, and loose coupling between components.",
        "lastUpdated": datetime.now() - timedelta(hours=12),
        "pdfUrl": None,
        "pdfName": None
    },
    {
        "title": "Explain the concept of eventual consistency in distributed systems",
        "category": "System Design",
        "company": "Amazon",
        "difficulty": "Hard",
        "experience": "Eventual consistency means that all replicas will eventually converge to the same state, but there may be temporary inconsistencies. This is often used in distributed databases for better availability and performance.",
        "lastUpdated": datetime.now() - timedelta(hours=4),
        "pdfUrl": None,
        "pdfName": None
    }
]

def initialize_database():
    """Initialize the database with sample data if it's empty"""
    try:
        # Check if collection is empty
        if questions_collection.count_documents({}) == 0:
            # Insert sample data
            questions_collection.insert_many(sample_questions)
            print("Database initialized with sample questions!")
        else:
            print("Database already contains data.")
    except Exception as e:
        print(f"Error initializing database: {e}")

@app.route('/api/questions', methods=['GET'])
def get_questions():
    """Get all questions from the database"""
    try:
        # Get all questions from MongoDB
        questions = list(questions_collection.find({}, {'_id': 0}))
        
        # Convert datetime objects to ISO strings for JSON serialization
        for question in questions:
            if 'lastUpdated' in question and isinstance(question['lastUpdated'], datetime):
                question['lastUpdated'] = question['lastUpdated'].isoformat()
        
        return jsonify({
            'success': True,
            'questions': questions,
            'count': len(questions)
        })
    except Exception as e:
        print(f"Error fetching questions: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch questions',
            'message': str(e)
        }), 500

@app.route('/api/questions/<question_id>', methods=['GET'])
def get_question_by_id(question_id):
    """Get a specific question by ID"""
    try:
        question = questions_collection.find_one({'_id': ObjectId(question_id)})
        if question:
            # Convert ObjectId to string and datetime to ISO string
            question['_id'] = str(question['_id'])
            if 'lastUpdated' in question and isinstance(question['lastUpdated'], datetime):
                question['lastUpdated'] = question['lastUpdated'].isoformat()
            
            return jsonify({
                'success': True,
                'question': question
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Question not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Failed to fetch question',
            'message': str(e)
        }), 500

@app.route('/api/questions', methods=['POST'])
def add_question():
    """Add a new question to the database"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'category', 'company', 'difficulty', 'experience']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Add timestamp
        data['lastUpdated'] = datetime.now()
        
        # Insert into database
        result = questions_collection.insert_one(data)
        
        return jsonify({
            'success': True,
            'message': 'Question added successfully',
            'question_id': str(result.inserted_id)
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Failed to add question',
            'message': str(e)
        }), 500

@app.route('/api/questions/<question_id>', methods=['PUT'])
def update_question(question_id):
    """Update an existing question"""
    try:
        data = request.get_json()
        data['lastUpdated'] = datetime.now()
        
        result = questions_collection.update_one(
            {'_id': ObjectId(question_id)},
            {'$set': data}
        )
        
        if result.matched_count > 0:
            return jsonify({
                'success': True,
                'message': 'Question updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Question not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Failed to update question',
            'message': str(e)
        }), 500

@app.route('/api/questions/<question_id>', methods=['DELETE'])
def delete_question(question_id):
    """Delete a question from the database"""
    try:
        result = questions_collection.delete_one({'_id': ObjectId(question_id)})
        
        if result.deleted_count > 0:
            return jsonify({
                'success': True,
                'message': 'Question deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Question not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Failed to delete question',
            'message': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        questions_collection.find_one()
        return jsonify({
            'success': True,
            'message': 'API is running and database is connected',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Database connection failed',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Initialize database with sample data
    initialize_database()
    
    # Run the Flask app on port 8000
    app.run(host='0.0.0.0', port=8000, debug=True) 