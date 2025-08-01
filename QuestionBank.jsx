import React, { useState, useEffect } from 'react';
import { Search, Download, FileText, Loader2 } from 'lucide-react';
import axios from 'axios';

const InterviewPlatform = () => {
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    company: '',
    difficulty: '',
    search: ''
  });

  // Fetch questions from backend
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Replace with your actual backend API endpoint
      const response = await axios.get('http://localhost:8000/api/questions');
      
      if (response.data.success) {
        setQuestions(response.data.questions);
        setFilteredQuestions(response.data.questions);
      } else {
        setError('Failed to fetch questions');
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Real-time date formatting
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Filter questions based on current filters
  useEffect(() => {
    let filtered = questions;

    if (filters.category) {
      filtered = filtered.filter(q => q.category === filters.category);
    }
    if (filters.company) {
      filtered = filtered.filter(q => q.company === filters.company);
    }
    if (filters.difficulty) {
      filtered = filtered.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters.search) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        q.experience.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredQuestions(filtered);
  }, [questions, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const handleDownloadPDF = async (pdfUrl, pdfName) => {
    try {
      // If pdfUrl is null or empty, show message
      if (!pdfUrl) {
        alert('No PDF available for this question.');
        return;
      }

      // For demo purposes, show alert
      alert(`Downloading: ${pdfName}\nURL: ${pdfUrl}`);
      
      // Real implementation would be:
      // const response = await axios.get(pdfUrl, { responseType: 'blob' });
      // const url = window.URL.createObjectURL(new Blob([response.data]));
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = pdfName;
      // document.body.appendChild(link);
      // link.click();
      // document.body.removeChild(link);
      // window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 bg-green-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Hard': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const uniqueCategories = [...new Set(questions.map(q => q.category))];
  const uniqueCompanies = [...new Set(questions.map(q => q.company))];
  const difficulties = ['Easy', 'Medium', 'Hard'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Questions Library</h1>
          <p className="text-gray-600">Browse and download interview questions with detailed guides</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <p className="text-gray-600">Loading questions...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-red-600">⚠️</div>
              <div>
                <p className="text-red-800 font-medium">Error loading questions</p>
                <p className="text-red-600 text-sm">{error}</p>
                <button 
                  onClick={fetchQuestions}
                  className="mt-2 text-red-600 hover:text-red-800 underline text-sm"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content when not loading and no error */}
        {!loading && !error && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Category Filter */}
                <div>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Category</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Company Filter */}
                <div>
                  <select
                    value={filters.company}
                    onChange={(e) => handleFilterChange('company', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Company</option>
                    {uniqueCompanies.map(company => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <select
                    value={filters.difficulty}
                    onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Difficulty Level</option>
                    {difficulties.map(diff => (
                      <option key={diff} value={diff}>{diff}</option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="mb-4">
              <p className="text-gray-600">
                Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <p className="text-gray-500">No questions found matching your filters.</p>
                </div>
              ) : (
                filteredQuestions.map((question) => (
                  <div key={question.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-3">{question.title}</h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                              {question.category}
                            </span>
                            <span className="text-gray-600">Asked at {question.company}</span>
                            <span className={`px-3 py-1 rounded-full ${getDifficultyColor(question.difficulty)}`}>
                              Difficulty: {question.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-gray-500 text-sm ml-4">
                          {formatTimeAgo(question.lastUpdated)}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Approach & Key Points:</h4>
                        <p className="text-gray-700">{question.experience}</p>
                      </div>

                      {/* PDF Download Section - Only show if PDF is available */}
                      {question.pdfUrl && question.pdfName && (
                        <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="text-blue-600" size={24} />
                            <div>
                              <p className="font-medium text-gray-900">Study Guide Available</p>
                              <p className="text-sm text-gray-600">{question.pdfName}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadPDF(question.pdfUrl, question.pdfName)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <Download size={16} />
                            Download PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-gray-500 text-sm">
              <p>Questions are updated regularly. Check back for new content.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InterviewPlatform;