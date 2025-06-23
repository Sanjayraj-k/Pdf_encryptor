
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
