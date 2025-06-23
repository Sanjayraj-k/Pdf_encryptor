import React, { useRef, useEffect, useState } from 'react';
import * as monaco from 'monaco-editor';

const questions = [
  {
    id: 1,
    title: "Add Two Numbers",
    difficulty: "Easy",
    acceptance: "72.5%",
    description: "Write a function that adds two numbers and returns the result.",
    examples: [
      { input: "a = 2, b = 3", output: "5" },
      { input: "a = -1, b = 1", output: "0" }
    ],
    constraints: [
      "The numbers will be integers.",
      "The sum will not exceed the range of a 32-bit integer."
    ],
    defaultCode: {
      javascript: `/**\n * @param {number} a\n * @param {number} b\n * @return {number}\n */\nvar add = function(a, b) {\n    \n};`,
      python: `class Solution:\n    def add(self, a: int, b: int) -> int:\n        `,
      java: `class Solution {\n    public int add(int a, int b) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    int add(int a, int b) {\n        \n    }\n};`,
      c: `int add(int a, int b) {\n    \n}`
    }
  },
  {
    id: 2,
    title: "Reverse String",
    difficulty: "Easy",
    acceptance: "85.3%",
    description: "Write a function that reverses a string in-place.",
    examples: [
      { input: "['h','e','l','l','o']", output: "['o','l','l','e','h']" },
      { input: "['H','a','n','n','a','h']", output: "['h','a','n','n','a','H']" }
    ],
    constraints: [
      "Modify the input array in-place with O(1) extra memory.",
      "All characters are printable ASCII characters."
    ],
    defaultCode: {
      javascript: `/**\n * @param {character[]} s\n * @return {void} Do not return anything, modify s in-place instead.\n */\nvar reverseString = function(s) {\n    \n};`,
      python: `class Solution:\n    def reverseString(self, s: List[str]) -> None:\n        """\n        Do not return anything, modify s in-place instead.\n        """\n        `,
      java: `class Solution {\n    public void reverseString(char[] s) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void reverseString(vector<char>& s) {\n        \n    }\n};`,
      c: `void reverseString(char* s, int sSize) {\n    \n}`
    }
  },
  {
    id: 3,
    title: "Two Sum",
    difficulty: "Easy",
    acceptance: "45.7%",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" }
    ],
    constraints: [
      "You may assume each input would have exactly one solution.",
      "You may not use the same element twice."
    ],
    defaultCode: {
      javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};`,
      python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        `,
      java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};`,
      c: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    \n}`
    }
  }
];

function LeetCodeEditor() {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [lang, setLang] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [testCase, setTestCase] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userCode, setUserCode] = useState({});

  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const initialUserCode = {};
    questions.forEach(q => {
      initialUserCode[q.id] = q.defaultCode[lang] || '';
    });
    setUserCode(initialUserCode);
  }, [lang]);

  useEffect(() => {
    if (editorRef.current) {
      if (monacoRef.current) monacoRef.current.dispose();

      const codeToLoad = userCode[currentQuestion.id] || currentQuestion.defaultCode[lang] || '';
      
      monacoRef.current = monaco.editor.create(editorRef.current, {
        value: codeToLoad,
        language: lang === 'c' ? 'cpp' : lang,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: windowWidth > 992 },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        roundedSelection: true,
        padding: { top: 16 }
      });

      monacoRef.current.onDidChangeModelContent(() => {
        setUserCode(prev => ({
          ...prev,
          [currentQuestion.id]: monacoRef.current.getValue()
        }));
      });
    }

    return () => monacoRef.current?.dispose();
  }, [lang, windowWidth, currentQuestionIndex]);

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    setUserCode(prev => ({
      ...prev,
      [currentQuestion.id]: currentQuestion.defaultCode[newLang] || ''
    }));
  };

  const runCode = async () => {
    setIsLoading(true);
    setOutput('Running your code...');
    setIsSubmitted(false);
    
    try {
      const response = await fetch('http://localhost:5000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: monacoRef.current.getValue(),
          language: lang,
          question_id: currentQuestion.id,
          test_case: testCase
        })
      });
      const data = await response.json();
      if (data.error) {
        setOutput(`Error: ${data.error}`);
      } else {
        setOutput(data.output + (data.error ? `\nError: ${data.error}` : ''));
      }
    } catch (e) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const submitCode = async () => {
    setIsLoading(true);
    setOutput('Submitting your code...');
    setIsSubmitted(true);
    
    try {
      const response = await fetch('http://localhost:5000/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: monacoRef.current.getValue(),
          language: lang,
          question_id: currentQuestion.id
        })
      });
      const data = await response.json();
      if (data.error) {
        setOutput(`Error: ${data.error}`);
      } else {
        const results = data.results.map(r => 
          `${r.test_case}:\nInput: ${r.input}\nOutput: ${r.output}\n` +
          `Expected: ${r.expected}\nResult: ${r.passed ? '✅ Passed' : '❌ Failed'}` +
          (r.error ? `\nError: ${r.error}` : '')
        ).join('\n');
        setOutput(`${results}\n\nSubmission Result:\n${data.summary}`);
      }
    } catch (e) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setOutput('');
      setIsSubmitted(false);
      setTestCase('');
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setOutput('');
      setIsSubmitted(false);
      setTestCase('');
    }
  };

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: windowWidth < 768 ? 'column' : 'row',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      overflow: 'hidden'
    }}>
      <div style={{ 
        width: windowWidth < 768 ? '100%' : '40%',
        height: windowWidth < 768 ? '40%' : '100%',
        backgroundColor: 'white',
        overflowY: 'auto',
        borderRight: windowWidth >= 768 ? 'not-allowed' : 'none',
        borderBottom: windowWidth < 768 ? '1px solid #ddd' : 'none',
        padding: '16px',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#333', marginBottom: '8px' }}>{currentQuestion.id}.{currentQuestion.title}</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                style={{
                  padding: '4px 8px',
                  backgroundColor: currentQuestionIndex === 0 ? '#f5f5f5' : 'white',
                  color: currentQuestionIndex === 0 ? '#999' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                &lt;
              </button>
              <button 
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: currentQuestionIndex === questions.length - 1 ? '#f5f5f5' : 'white',
                  color: currentQuestionIndex === questions.length - 1 ? '#999' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: currentQuestionIndex === questions.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                &gt;
              </button>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            marginBottom: '16px'
          }}>
            <span style={{ 
              backgroundColor: '#e7f8f2',
              color: '#0a6640',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500'
            }}>{currentQuestion.difficulty}</span>
            <span style={{ 
              color: '#666',
              fontSize: '14px'
            }}>Acceptance: {currentQuestion.acceptance}</span>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#333', lineHeight: '1.5', marginBottom: '16px' }}>
            {currentQuestion.description}
          </p>
          
          {currentQuestion.examples.map((example, index) => (
            <div key={index} style={{ 
              backgroundColor: '#f6f6f6',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px'
            }}>
              <p style={{ fontWeight: '500', marginBottom: '8px' }}>Example {index + 1}:</p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '4px' }}>Input:</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '14px' }}>{example.input}</p>
                </div>
                <div>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '4px' }}>Output:</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '14px' }}>{example.output}</p>
                </div>
              </div>
            </div>
          ))}
          
          <div style={{ marginTop: '24px' }}>
            <p style={{ fontWeight: '500', marginBottom: '8px' }}>Constraints:</p>
            <ul style={{ 
              color: '#333',
              paddingLeft: '20px',
              margin: '0 0 16px 0'
            }}>
              {currentQuestion.constraints.map((constraint, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>{constraint}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: windowWidth < 768 ? '60%' : '100%',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: 'white',
          borderBottom: '1px solid #ddd'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              onClick={() => setActiveTab('description')}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 0',
                cursor: 'pointer',
                borderBottom: activeTab === 'description' ? '2px solid #ffa116' : 'none',
                color: activeTab === 'description' ? '#333' : '#666',
                fontWeight: activeTab === 'description' ? '500' : '400'
              }}
            >
              Description
            </button>
          </div>
          
          <select 
            value={lang} 
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              fontSize: '14px',
              color: '#333'
            }}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="c">C</option>
          </select>
        </div>
        
        <div 
          ref={editorRef} 
          style={{ 
            flex: 1,
            backgroundColor: '#1e1e1e',
            overflow: 'hidden'
          }} 
        />
        
        <div style={{ 
          height: windowWidth < 768 ? '40%' : '30%',
          backgroundColor: 'white',
          borderTop: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            display: 'flex',
            borderBottom: '1px solid #ddd',
            backgroundColor: '#f5f5f5'
          }}>
            <button 
              onClick={() => setActiveTab('testcase')}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: activeTab === 'testcase' ? '2px solid #ffa116' : 'none',
                color: activeTab === 'testcase' ? '#333' : '#666',
                fontWeight: activeTab === 'testcase' ? '500' : '400'
              }}
            >
              Testcase
            </button>
            <button 
              onClick={() => setActiveTab('result')}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: activeTab === 'result' ? '2px solid #ffa116' : 'none',
                color: activeTab === 'result' ? '#333' : '#666',
                fontWeight: activeTab === 'result' ? '500' : '400'
              }}
            >
              Result
            </button>
          </div>
          
          <div style={{ 
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            backgroundColor: 'white'
          }}>
            {activeTab === 'testcase' ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>Custom Testcase</p>
                  <textarea
                    value={testCase}
                    onChange={(e) => setTestCase(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      resize: 'none'
                    }}
                    placeholder={`Enter test case input (e.g., ${currentQuestion.examples[0].input})`}
                  />
                </div>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '14px' }}>
                {output || (isSubmitted ? 'No submission results yet' : 'No test results yet')}
              </div>
            )}
          </div>
          
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#f5f5f5',
            borderTop: '1px solid #ddd'
          }}>
            <button 
              onClick={runCode}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: isLoading ? '#e1e1e1' : 'white',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Running...' : 'Run'}
            </button>
            <button 
              onClick={submitCode}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: isLoading ? '#e1e1e1' : '#ffa116',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeetCodeEditor;
