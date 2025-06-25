import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, MicOff, Send, FileText, User, MessageCircle, Volume2, Loader2, Pause, Play, ChevronDown, ChevronUp, Star, Trophy, Target } from 'lucide-react';

const HRInterviewApp = () => {
  const [currentPhase, setCurrentPhase] = useState('upload');
  const [sessionId, setSessionId] = useState(null);
  const [resume, setResume] = useState(null);
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [extractedProjects, setExtractedProjects] = useState([]);
  const [extractedExperiences, setExtractedExperiences] = useState([]);
  const [userResponse, setUserResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [currentPhase2, setCurrentPhase2] = useState('self_intro');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const [averageScore, setAverageScore] = useState(0);
  const [lastScore, setLastScore] = useState(null);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const conversationEndRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5000';

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript + ' ';
          else interimTranscript += transcript;
        }
        if (finalTranscript) {
          setUserResponse(prev => prev + finalTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        if (isRecording) {
          try {
            recognition.start();
          } catch (err) {
            console.error('Recognition restart error:', err);
            setIsRecording(false);
          }
        }
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn('Web Speech API not supported.');
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Recognition cleanup error:', err);
        }
      }
    };
  }, [isRecording]);

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setResume(file);
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('resume', file);
        const response = await fetch(`${API_BASE_URL}/upload-resume`, { 
          method: 'POST', 
          body: formData 
        });
        const data = await response.json();
        
        if (response.ok) {
          setSessionId(data.session_id);
          setExtractedSkills(data.skills || []);
          setExtractedProjects(data.projects || []);
          setExtractedExperiences(data.experiences || []);
          setQuestionNumber(data.question_number || 1);
          setTotalQuestions(data.total_questions || 10);
          setCurrentPhase2(data.phase || 'self_intro');
          
          // Set initial conversation with HR's first question
          const initialConversation = [{
            type: 'hr',
            message: data.initial_question,
            audioFile: data.audio_file,
            timestamp: new Date().toISOString()
          }];
          setConversation(initialConversation);
          
          if (data.audio_file) {
            playAudio(data.audio_file);
          }
          setCurrentPhase('interview');
        } else {
          alert(`Error: ${data.error || 'Failed to process resume'}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload resume. Please check your connection and try again.');
      } finally {
        setIsUploading(false);
        // Reset file input
        event.target.value = '';
      }
    }
  };

  const playAudio = (audioFile) => {
    if (audioFile) {
      // Stop current audio if playing
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      
      const audio = new Audio(`${API_BASE_URL}/get-audio/${audioFile}`);
      setCurrentAudio(audio);
      setIsPlaying(true);
      
      audio.play().catch(err => {
        console.error('Audio play error:', err);
        setIsPlaying(false);
        setCurrentAudio(null);
      });
      
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
      };
      
      audio.onerror = (err) => {
        console.error('Audio error:', err);
        setIsPlaying(false);
        setCurrentAudio(null);
      };
      
      audioRef.current = audio;
    }
  };

  const toggleAudio = () => {
    if (currentAudio) {
      if (isPlaying) {
        currentAudio.pause();
        setIsPlaying(false);
      } else {
        currentAudio.play().catch(err => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
          setCurrentAudio(null);
        });
        setIsPlaying(true);
      }
    }
  };

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      setIsRecording(true);
      setUserResponse(''); // Clear previous response when starting new recording
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Recognition start error:', err);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      setIsRecording(false);
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Recognition stop error:', err);
      }
    }
  };

  const submitResponse = async () => {
    if (userResponse.trim() && !isSubmitting) {
      setIsSubmitting(true);
      const newUserMessage = {
        type: 'user',
        message: userResponse.trim(),
        timestamp: new Date().toISOString()
      };
      
      // Add user message to conversation immediately
      const updatedConversation = [...conversation, newUserMessage];
      setConversation(updatedConversation);
      const currentResponse = userResponse.trim();
      setUserResponse(''); // Clear input immediately
      
      try {
        const response = await fetch(`${API_BASE_URL}/submit-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            session_id: sessionId, 
            response: currentResponse 
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Update user message with score and feedback
          const userMessageWithScore = {
            ...newUserMessage,
            score: data.response_score,
            feedback: data.response_feedback
          };
          
          // Add HR response
          const hrMessage = {
            type: 'hr',
            message: data.hr_response,
            audioFile: data.audio_file,
            timestamp: new Date().toISOString()
          };
          
          const finalConversation = [
            ...updatedConversation.slice(0, -1), // Remove the temporary user message
            userMessageWithScore, // Add user message with score
            hrMessage // Add HR response
          ];
          
          setConversation(finalConversation);
          setCurrentPhase2(data.phase);
          setQuestionNumber(data.question_number);
          setTotalQuestions(data.total_questions);
          setLastScore(data.response_score);
          
          // Calculate average score from all user messages with scores
          const scoredMessages = finalConversation.filter(msg => 
            msg.type === 'user' && msg.score !== undefined
          );
          if (scoredMessages.length > 0) {
            const avgScore = scoredMessages.reduce((sum, msg) => sum + msg.score, 0) / scoredMessages.length;
            setAverageScore(Math.round(avgScore));
          }
          
          // Play audio response
          if (data.audio_file) {
            playAudio(data.audio_file);
          }
          
          // Check if interview is complete
          if (data.interview_complete) {
            setCurrentPhase('complete');
          }
        } else {
          alert(`Error: ${data.error || 'Failed to submit response'}`);
          // Restore user input if there was an error
          setUserResponse(currentResponse);
          // Remove the user message that was added optimistically
          setConversation(conversation);
        }
      } catch (error) {
        console.error('Submit error:', error);
        alert('Failed to submit response. Please check your connection and try again.');
        // Restore user input if there was an error
        setUserResponse(currentResponse);
        // Remove the user message that was added optimistically
        setConversation(conversation);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitResponse();
    }
  };

  const toggleFeedback = (index) => {
    setExpandedFeedback(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 80) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getPhaseDisplayName = (phase) => {
    const phaseNames = {
      'self_intro': 'Getting to Know You',
      'skills': 'Skills Exploration',
      'projects': 'Project Highlights',
      'experience': 'Experience Review'
    };
    return phaseNames[phase] || phase;
  };

  const resetInterview = () => {
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // Stop any recording
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Reset all state
    setCurrentPhase('upload');
    setConversation([]);
    setSessionId(null);
    setResume(null);
    setExtractedSkills([]);
    setExtractedProjects([]);
    setExtractedExperiences([]);
    setQuestionNumber(0);
    setTotalQuestions(0);
    setCurrentPhase2('self_intro');
    setUserResponse('');
    setIsRecording(false);
    setIsSubmitting(false);
    setCurrentAudio(null);
    setIsPlaying(false);
    setExpandedFeedback({});
    setAverageScore(0);
    setLastScore(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">AI HR Interview Platform</h1>
          <p className="text-gray-600">A realistic interview experience with Sarah Johnson</p>
        </div>

        {currentPhase === 'upload' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Upload Your Resume</h2>
              <p className="text-gray-600">Let's get started—please upload your resume to begin the interview!</p>
            </div>
            
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 mb-4 hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleResumeUpload}
                className="hidden"
                id="resume-upload"
                disabled={isUploading}
              />
              <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center space-y-4">
                <Upload className="w-12 h-12 text-blue-400" />
                <span className="text-lg text-gray-600">
                  {isUploading ? 'Processing...' : 'Click to upload your resume'}
                </span>
                <span className="text-sm text-gray-400">Supports PDF, DOC, DOCX, TXT (Max 16MB)</span>
              </label>
            </div>
            
            {isUploading && (
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-2" />
                <span className="text-sm text-blue-600">Processing your resume and generating questions...</span>
              </div>
            )}
            
            {extractedSkills.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Extracted Skills Preview:</h3>
                <div className="flex flex-wrap gap-2">
                  {extractedSkills.slice(0, 8).map((skill, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                      {skill}
                    </span>
                  ))}
                  {extractedSkills.length > 8 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                      +{extractedSkills.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {currentPhase === 'interview' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* HR Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
              <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
                <User className="w-12 h-12 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold text-white">Sarah Johnson</h2>
              <p className="text-blue-100">Senior HR Manager</p>
              
              {/* Progress and Phase Info */}
              <div className="mt-4 space-y-2">
                <div className="px-4 py-2 bg-white/20 rounded-lg inline-block">
                  <span className="text-sm text-white">
                    {getPhaseDisplayName(currentPhase2)} • Question {questionNumber} of {totalQuestions}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                  ></div>
                </div>
                
                {/* Score Display */}
                {averageScore > 0 && (
                  <div className="flex items-center justify-center space-x-4 text-sm text-white">
                    <div className="flex items-center">
                      <Trophy className="w-4 h-4 mr-1" />
                      <span>Average: {averageScore}/100</span>
                    </div>
                    {lastScore && (
                      <div className="flex items-center">
                        <Target className="w-4 h-4 mr-1" />
                        <span>Last: {lastScore}/100</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Conversation Area */}
            <div className="p-6 h-96 overflow-y-auto bg-gray-50">
              {conversation.map((msg, index) => (
                <div key={index} className={`mb-4 ${msg.type === 'hr' ? 'text-left' : 'text-right'}`}>
                  <div className={`inline-block max-w-3xl p-4 rounded-lg ${
                    msg.type === 'hr' 
                      ? 'bg-blue-500 text-white rounded-bl-none' 
                      : 'bg-white text-gray-800 shadow-md rounded-br-none border border-gray-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {msg.type === 'hr' && <MessageCircle className="w-4 h-4 mt-1 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                        
                        {/* Score and Feedback for User Messages */}
                        {msg.type === 'user' && msg.score !== undefined && (
                          <div className="mt-3">
                            <div className={`inline-flex items-center text-sm font-semibold px-3 py-1 rounded-full border ${getScoreColor(msg.score)}`}>
                              <Star className="w-3 h-3 mr-1" />
                              Score: {msg.score}/100
                            </div>
                            
                            {msg.feedback && (
                              <div className="mt-2">
                                <button 
                                  onClick={() => toggleFeedback(index)} 
                                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                                >
                                  {expandedFeedback[index] ? 'Hide Feedback' : 'Show Feedback'}
                                  {expandedFeedback[index] 
                                    ? <ChevronUp className="w-4 h-4 ml-1" /> 
                                    : <ChevronDown className="w-4 h-4 ml-1" />
                                  }
                                </button>
                                {expandedFeedback[index] && (
                                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                                    {msg.feedback}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Audio Replay for HR Messages */}
                        {msg.type === 'hr' && msg.audioFile && (
                          <button 
                            onClick={() => playAudio(msg.audioFile)} 
                            className="mt-2 flex items-center text-sm text-blue-100 hover:text-blue-300 transition-colors"
                          >
                            <Volume2 className="w-4 h-4 mr-1" /> 
                            Replay Audio
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator for HR response */}
              {isSubmitting && (
                <div className="text-left mb-4">
                  <div className="inline-block max-w-3xl p-4 rounded-lg bg-blue-500 text-white rounded-bl-none">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Sarah is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={conversationEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={userResponse}
                    onChange={(e) => setUserResponse(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isRecording ? "Recording in progress..." : "Share your thoughts or use voice input..."}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    disabled={isSubmitting || isRecording}
                  />
                </div>
                
                <div className="flex flex-col space-y-2">
                  <button 
                    onClick={isRecording ? stopRecording : startRecording} 
                    disabled={isSubmitting}
                    className={`p-3 rounded-lg transition-colors ${
                      isRecording 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:bg-gray-100'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  
                  <button 
                    onClick={submitResponse} 
                    disabled={!userResponse.trim() || isSubmitting || isRecording} 
                    className="p-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white transition-colors"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Recording Indicator */}
              {isRecording && (
                <div className="mt-2 text-center">
                  <span className="text-sm text-red-600 animate-pulse flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-600 rounded-full mr-2 animate-pulse"></div>
                    Recording... Speak clearly and press stop when finished
                  </span>
                </div>
              )}
              
              {/* Audio Controls */}
              {currentAudio && (
                <div className="mt-4 flex justify-center items-center space-x-2">
                  <button 
                    onClick={toggleAudio} 
                    className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="text-sm text-gray-600">
                    {isPlaying ? 'Playing Sarah\'s Response...' : 'Replay Sarah\'s Response'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPhase === 'complete' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Interview Complete!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for completing the interview! Sarah will review your responses and get back to you soon.
            </p>
            
            {/* Final Score Summary */}
            {averageScore > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Your Performance Summary</h3>
                <div className="flex items-center justify-center space-x-4">
                  <div className={`px-4 py-2 rounded-lg border ${getScoreColor(averageScore)}`}>
                    <div className="flex items-center">
                      <Trophy className="w-5 h-5 mr-2" />
                      <span className="font-semibold">Overall Score: {averageScore}/100</span>
                    </div>
                  </div>
                </div>
                
                <p className="mt-2 text-sm text-gray-600">
                  {averageScore >= 90 ? 'Excellent performance! You demonstrated strong communication skills and relevant experience.' :
                   averageScore >= 80 ? 'Great job! Your responses showed good understanding and relevant examples.' :
                   averageScore >= 70 ? 'Good effort! Consider providing more specific examples in future interviews.' :
                   'Keep practicing! Focus on providing more detailed responses with concrete examples.'}
                </p>
              </div>
            )}
            
            <button
              onClick={resetInterview}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Start New Interview
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRInterviewApp;