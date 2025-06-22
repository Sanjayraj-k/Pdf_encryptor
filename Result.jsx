import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const QuizResultsPage = () => {
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      console.log('Starting fetchResults...');

      // Check for navigation state first
      const { score, total_questions } = location.state || {};
      if (score !== undefined && total_questions !== undefined) {
        console.log('Using navigation state:', { score, total_questions });
      }

      // Fetch full results to get question details
      try {
        const response = await fetch('http://localhost:5000/api/get-latest-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_email: 'shimal@example.com' }),
        });
        console.log('Result response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch results: ${errorText}`);
        }
        const data = await response.json();
        console.log('Result data:', data);

        if (!data || !data.question_results) {
          throw new Error('Invalid result data');
        }

        setQuizResult({
          score: data.score,
          total_questions: data.total_questions,
          percentage: data.percentage,
          question_results: data.question_results.map(result => ({
            question: result.question,
            user_answer: result.selected,
            correct_answer: result.correct_answer,
            is_correct: result.is_correct
          }))
        });
      } catch (err) {
        console.error('Error in fetchResults:', err);
        setError(`Failed to load quiz results: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [location.state]);

  const handleRetakeQuiz = () => {
    navigate('/googleform');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="ml-4 text-lg font-semibold text-gray-700">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-gray-100">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Results</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={() => fetchResults()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!quizResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-gray-100">
        <AlertCircle size={48} className="text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Results Found</h2>
        <p className="text-gray-600 mb-6">No quiz results are available at this time.</p>
        <button
          onClick={handleRetakeQuiz}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Take Quiz
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6">
            <h1 className="text-3xl font-bold text-white">Aptitude Test Results</h1>
            <div className="flex items-center mt-4 space-x-6">
              <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
                <span className="text-white font-medium mr-2">Score:</span>
                <span className="text-white font-bold text-xl">{quizResult.score} / {quizResult.total_questions}</span>
              </div>
              <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
                <span className="text-white font-medium mr-2">Percentage:</span>
                <span className="text-white font-bold text-xl">{quizResult.percentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Question Breakdown</h2>
            <div className="space-y-4">
              {quizResult.question_results.map((result, index) => (
                <div
                  key={index}
                  className={`border-l-4 ${
                    result.is_correct ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  } rounded-lg p-4 shadow-sm transition-all duration-200 hover:shadow-md`}
                >
                  <div className="flex items-start mb-3">
                    <div className="flex-shrink-0 mr-3 mt-1">
                      {result.is_correct ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-800">
                        {index + 1}. {result.question}
                      </h3>
                    </div>
                  </div>
                  <div className="ml-9 space-y-2">
                    <div className="flex items-start">
                      <span className="text-gray-600 font-medium mr-2 min-w-[100px]">Your Answer:</span>
                      <span className={result.is_correct ? 'text-green-700' : 'text-red-700'}>
                        {result.user_answer || 'Not answered'}
                      </span>
                    </div>
                    {!result.is_correct && (
                      <div className="flex items-start">
                        <span className="text-gray-600 font-medium mr-2 min-w-[100px]">Correct Answer:</span>
                        <span className="text-green-700">{result.correct_answer}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-lg font-medium text-gray-700 mb-4">
            {quizResult.percentage >= 70
              ? 'Excellent work! You passed the aptitude test with flying colors!'
              : 'Good effort! Review the questions and try again to improve your score.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuizResultsPage;