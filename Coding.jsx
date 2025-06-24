import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, Clock, Trophy, Code, FileText, RefreshCw } from 'lucide-react';

const CompetitiveCodingPlatform = () => {
  const [activeTab, setActiveTab] = useState('problem');
  const [language, setLanguage] = useState('java');
  const [code, setCode] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [problem, setProblem] = useState(null);
  const [problemId, setProblemId] = useState('add-two-numbers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = 'http://localhost:5000';

  const languages = [
    { value: 'java', label: 'Java', icon: '☕' },
    { value: 'python', label: 'Python', icon: '🐍' },
    { value: 'cpp', label: 'C++', icon: '⚡' },
    { value: 'c', label: 'C', icon: '🔧' }
  ];

  // Sample problem data for testing (since your backend might not have the problem endpoint yet)
  const sampleProblem = {
    title: "Add Two Numbers",
    difficulty: "Easy",
    acceptance: "85.2%",
    description: "Given two integers num1 and num2, return the sum of the two integers.",
    examples: [
      {
        input: "num1 = 12, num2 = 5",
        output: "17"
      },
      {
        input: "num1 = -10, num2 = 4",
        output: "-6"
      }
    ],
    constraints: [
      "-100 <= num1, num2 <= 100"
    ]
  };

  // Load problem data on component mount
  useEffect(() => {
    loadProblem();
  }, [problemId]);

  // Load template when language changes
  useEffect(() => {
    if (problem && language) {
      loadTemplate();
    }
  }, [language, problem]);

  const loadProblem = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch from your backend first
      try {
        const response = await fetch(`${API_BASE}/problem/${problemId}`);
        if (response.ok) {
          const problemData = await response.json();
          setProblem(problemData);
        } else {
          throw new Error('Backend endpoint not available');
        }
      } catch (backendError) {
        // Fallback to sample data if backend is not ready
        console.warn('Using sample problem data:', backendError.message);
        setProblem(sampleProblem);
      }
    } catch (err) {
      setError('Failed to load problem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async () => {
    try {
      const response = await fetch(`${API_BASE}/problem/${problemId}/template/${language}`);
      if (response.ok) {
        const data = await response.json();
        setCode(data.template);
      } else {
        // Set default templates if backend doesn't have template endpoint
        const defaultTemplates = {
          java: `public class Solution {
    public int addTwoNumbers(int num1, int num2) {
        // Write your code here
        return 0;
    }
}`,
          python: `def add_two_numbers(num1, num2):
    # Write your code here
    return 0`,
          cpp: `#include <iostream>
using namespace std;

int addTwoNumbers(int num1, int num2) {
    // Write your code here
    return 0;
}`,
          c: `#include <stdio.h>

int addTwoNumbers(int num1, int num2) {
    // Write your code here
    return 0;
}`
        };
        setCode(defaultTemplates[language] || '// Write your code here');
      }
    } catch (err) {
      console.error('Failed to load template:', err);
      // Set a basic template as fallback
      setCode('// Write your code here');
    }
  };

  const handleRun = async () => {
    if (!code.trim()) {
      setError('Please write some code first');
      return;
    }
    
    setIsRunning(true);
    setActiveTab('results');
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          input: '' // You can modify this to include test inputs
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run code');
      }

      const data = await response.json();
      
      // Since your backend returns { output, error }, we'll simulate test results
      const mockTestResults = [
        {
          id: 1,
          input: "12, 5",
          expectedOutput: "17",
          actualOutput: data.output || data.error || "No output",
          passed: data.output === "17",
          executionTime: "2ms",
          memory: "1.2MB"
        }
      ];
      
      setTestResults(mockTestResults);
      setSubmissionResult(null);
      
    } catch (error) {
      setError('Run failed: ' + error.message);
      setTestResults([]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please write some code first');
      return;
    }
    
    setIsRunning(true);
    setActiveTab('results');
    setError(null);
    
    try {
      // For now, we'll use the same run endpoint since submit endpoint might not be implemented
      const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          input: ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit code');
      }

      const data = await response.json();
      
      // Mock submission result
      const mockSubmissionResult = {
        passed: !data.error && data.output,
        totalTests: 2,
        passedTests: !data.error && data.output ? 2 : 0,
        executionTime: "3ms",
        memory: "1.5MB",
        submissionId: "sub_" + Date.now()
      };
      
      setSubmissionResult(mockSubmissionResult);
      
      // Mock test results for submission
      const mockTestResults = [
        {
          id: 1,
          input: "12, 5",
          expectedOutput: "17",
          actualOutput: data.output || data.error || "No output",
          passed: data.output === "17",
          executionTime: "2ms",
          memory: "1.2MB"
        },
        {
          id: 2,
          input: "-10, 4",
          expectedOutput: "-6",
          actualOutput: data.output || data.error || "No output",
          passed: data.output === "-6",
          executionTime: "2ms",
          memory: "1.2MB"
        }
      ];
      
      setTestResults(mockTestResults);
      
    } catch (error) {
      setError('Submission failed: ' + error.message);
      setSubmissionResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  const renderProblemTab = () => {
    if (loading) {
      return (
        <div className="p-6 bg-white flex items-center justify-center">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading problem...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 bg-white">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 font-medium">Error</span>
            </div>
            <p className="text-red-600 mt-2">{error}</p>
            <button 
              onClick={loadProblem}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (!problem) return null;

    return (
      <div className="p-6 bg-white">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{problem.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            problem.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
            problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {problem.difficulty}
          </span>
          <span className="text-sm text-gray-600">Acceptance: {problem.acceptance}</span>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-gray-700 leading-relaxed">{problem.description}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Examples:</h3>
            {problem.examples.map((example, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg mb-3">
                <div className="mb-2">
                  <span className="font-medium text-gray-700">Input: </span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{example.input}</code>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Output: </span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{example.output}</code>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Constraints:</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {problem.constraints.map((constraint, index) => (
                <li key={index}>{constraint}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderTestResults = () => (
    <div className="p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
        {submissionResult && (
          <div className="flex items-center gap-2">
            {submissionResult.passed ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={`font-medium ${submissionResult.passed ? 'text-green-700' : 'text-red-700'}`}>
              {submissionResult.passed ? 'Accepted' : 'Wrong Answer'}
            </span>
          </div>
        )}
      </div>

      {submissionResult && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Test Cases: </span>
              <span className="font-medium">{submissionResult.passedTests}/{submissionResult.totalTests} passed</span>
            </div>
            <div>
              <span className="text-gray-600">Runtime: </span>
              <span className="font-medium">{submissionResult.executionTime}</span>
            </div>
            <div>
              <span className="text-gray-600">Memory: </span>
              <span className="font-medium">{submissionResult.memory}</span>
            </div>
          </div>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="space-y-3">
          {testResults.map((result) => (
            <div key={result.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Test Case {result.id}</span>
                <div className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                    {result.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium text-gray-700">Input: </span>
                  <code className="bg-gray-100 px-2 py-1 rounded">{result.input}</code>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Expected: </span>
                  <code className="bg-gray-100 px-2 py-1 rounded">{result.expectedOutput}</code>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Actual: </span>
                  <code className={`px-2 py-1 rounded ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                    {result.actualOutput}
                  </code>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 mt-2">
                  <span>Runtime: {result.executionTime}</span>
                  <span>Memory: {result.memory}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 font-medium">Error</span>
          </div>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex h-screen">
        {/* Left Panel - Problem Description */}
        <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('problem')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'problem' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Description
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'results' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Results
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'problem' ? renderProblemTab() : renderTestResults()}
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="w-1/2 bg-white flex flex-col">
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Code className="w-5 h-5 text-gray-600" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {languages.map(lang => (
                    <option key={lang.value} value={lang.value}>
                      {lang.icon} {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {isRunning ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isRunning}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {isRunning ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4" />
                  )}
                  Submit
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-gray-900">
            <div className="h-full p-4">
              <div className="bg-gray-800 rounded-lg h-full">
                <div className="flex items-center justify-between p-3 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-gray-400 text-sm">
                    {language}.{language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'cpp' ? 'cpp' : 'c'}
                  </span>
                </div>
                <div className="p-4">
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-96 bg-transparent text-green-400 font-mono text-sm resize-none outline-none"
                    placeholder="Write your code here..."
                    style={{
                      fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                      lineHeight: '1.5'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitiveCodingPlatform;