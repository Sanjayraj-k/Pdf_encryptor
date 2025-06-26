import { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Monitor, 
  Volume2, 
  Mic, 
  MicOff, 
  CheckCircle, 
  Flag,
  AlertCircle,
  AlertTriangle,
  Clock,
  Zap,
  Shield,
  Send,
  Play,
  Pause,
  XCircle // Added for Finish button
} from 'lucide-react';

// ====================================================================
//  WebCam Proctoring Component (No changes needed here)
// ====================================================================

const WebCam = () => {
  const [isActive, setIsActive] = useState(false);
  const [proctorData, setProctorData] = useState({
    face_detected: false,
    looking_at_screen: false,
    warnings: 0,
    max_warnings: 3,
    violation_detected: false,
    look_direction: 'Unknown',
    eyes_closed: false,
    long_blink_count: 0,
  });
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  // FIXED: Changed port from 6000 to 8000
  const apiUrl = 'http://localhost:8000/api';

  const startProctoring = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startFrameProcessing();
      setIsActive(true);
    } catch (err) {
      const errorMessage = `Proctoring failed to start: ${err.message}. Check camera permissions.`;
      setError(errorMessage);
      console.error('Error in startProctoring:', err);
      stopProctoring();
    }
  };

  const stopProctoring = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  };

  const startFrameProcessing = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        sendFrameToServer(imageData);
      }
    }, 500);
  };

  const sendFrameToServer = async (imageData) => {
    try {
      const response = await fetch(`${apiUrl}/process-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ image: imageData.split(',')[1] }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
      const data = await response.json();
      setProctorData(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Error processing frame:', err);
    }
  };

  useEffect(() => {
    startProctoring();
    return () => stopProctoring();
  }, []);

  const getStatusIcon = () => {
    if (proctorData.violation_detected) return <AlertCircle size={20} className="text-red-400" />;
    if (!proctorData.face_detected) return <AlertTriangle size={20} className="text-amber-400" />;
    if (proctorData.looking_at_screen) return <CheckCircle size={20} className="text-emerald-400" />;
    return <AlertTriangle size={20} className="text-amber-400" />;
  };
  
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-900 to-purple-900 bg-clip-text text-transparent">Proctoring Monitor</h2>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-medium text-gray-600">AI Protected</span>
          </div>
        </div>
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700"><AlertCircle className="mr-3 w-5 h-5" /><p className="text-sm">{error}</p></div>}
        <div className="space-y-4">
          <div className="relative">
            <div className={`relative aspect-video bg-gray-900 rounded-xl overflow-hidden transition-all duration-300 ${proctorData.violation_detected ? 'ring-4 ring-red-400 ring-opacity-50 shadow-lg shadow-red-400/20' : 'ring-2 ring-indigo-200 ring-opacity-30'}`}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              {proctorData.violation_detected && <div className="absolute inset-0 bg-gradient-to-t from-red-600/60 to-transparent flex items-center justify-center"><div className="text-center"><AlertCircle className="w-12 h-12 text-white mx-auto mb-2 animate-pulse" /><p className="text-white font-bold text-lg">VIOLATION DETECTED</p></div></div>}
              {!isActive && !error && <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 to-purple-900/80 flex items-center justify-center"><div className="text-center"><div className="relative"><Camera size={48} className="text-white/70 mx-auto mb-3" /><div className="absolute inset-0 animate-ping"><Camera size={48} className="text-white/30 mx-auto" /></div></div><p className="text-white/90 font-medium">Initializing AI Monitor...</p></div></div>}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">{getStatusIcon()}<span>Security Status</span></h3>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${proctorData.violation_detected ? 'bg-red-100 text-red-700' : proctorData.looking_at_screen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{proctorData.violation_detected ? 'Alert' : proctorData.looking_at_screen ? 'Secure' : 'Monitor'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"><span className="text-gray-600">Face Detected</span><div className={`w-2 h-2 rounded-full ${proctorData.face_detected ? 'bg-emerald-400' : 'bg-red-400'}`}></div></div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"><span className="text-gray-600">Screen Focus</span><div className={`w-2 h-2 rounded-full ${proctorData.looking_at_screen ? 'bg-emerald-400' : 'bg-amber-400'}`}></div></div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"><span className="text-gray-600">Warnings</span><span className={`font-medium ${proctorData.warnings > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{proctorData.warnings}/{proctorData.max_warnings}</span></div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"><span className="text-gray-600">Eye Closure</span><span className={`font-medium ${proctorData.long_blink_count > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{proctorData.long_blink_count}</span></div>
            </div>
            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100"><div className="flex items-center justify-between"><span className="text-gray-600 text-sm">Look Direction</span><span className="font-medium text-gray-900 text-sm">{proctorData.look_direction}</span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
//  Main Interview Component - Integrated with Backend
// ====================================================================

// ================== Full-Screen Helper Functions ==================
const openFullscreen = () => {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
  } else if (elem.mozRequestFullScreen) { /* Firefox */
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { /* IE/Edge */
    elem.msRequestFullscreen();
  }
};

const closeFullscreen = () => {
  if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
      document.webkitExitFullscreen();
    }
  }
};

export default function InterviewDashboard() {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionStatus, setQuestionStatus] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false); // New state for finish button
  const [examFinished, setExamFinished] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [evaluation, setEvaluation] = useState('');
  const [error, setError] = useState('');
  
  const recognitionRef = useRef(null);
  // FIXED: Changed port from 6000 to 8000
  const apiUrl = 'http://localhost:8000/api';

  useEffect(() => {
    let timer;
    if (interviewStarted && !examFinished) {
      timer = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [interviewStarted, examFinished]);

  // Effect to handle exiting full-screen when the exam is finished
  useEffect(() => {
    if (examFinished) {
      closeFullscreen();
    }
  }, [examFinished]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startInterview = async () => {
    try {
      setError('');
      const response = await fetch(`${apiUrl}/start`, { method: 'GET', credentials: 'include' });
      if (!response.ok) throw new Error(`Failed to start interview: ${response.statusText}`);
      const data = await response.json();
      setCurrentQuestion(data.question);
      setQuestionStatus(data.status);
      setQuestionNumber(data.question_number);
      setInterviewStarted(true);
      openFullscreen(); // Enter full-screen when interview starts
      speakText(data.question);
    } catch (err) {
      setError(`Failed to start interview: ${err.message}`);
      console.error('Error starting interview:', err);
    }
  };

  const submitAnswer = async () => {
    const finalTranscript = transcript.trim();
    if (!finalTranscript) return alert('Please provide an answer before submitting.');
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await fetch(`${apiUrl}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answer: finalTranscript }),
      });
      if (!response.ok) throw new Error(`Failed to submit answer: ${response.statusText}`);
      const data = await response.json();
      
      if (data.status === 'evaluation') {
        setEvaluation(data.evaluation);
        setExamFinished(true);
        await endExamSession();
      } else {
        setCurrentQuestion(data.question);
        setQuestionStatus(data.status);
        setQuestionNumber(data.question_number);
        setTranscript('');
        speakText(data.question);
      }
    } catch (err) {
      setError(`Failed to submit answer: ${err.message}`);
      console.error('Error submitting answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishInterview = async () => {
    if (!window.confirm("Are you sure you want to finish the interview? Your progress will be evaluated.")) return;

    setIsFinishing(true);
    setError('');
    const finalTranscript = transcript.trim(); // Get current transcript

    try {
        const response = await fetch(`${apiUrl}/finish`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            // BUG FIX: Send the final transcript along with the finish request
            body: JSON.stringify({ answer: finalTranscript }),
        });
        if (!response.ok) throw new Error(`Failed to finish interview: ${response.statusText}`);
        const data = await response.json();
        setEvaluation(data.evaluation);
        setExamFinished(true);
        await endExamSession();
    } catch (err) {
        setError(`Failed to finish interview: ${err.message}`);
        console.error('Error finishing interview:', err);
    } finally {
        setIsFinishing(false);
    }
  };

  const endExamSession = async () => {
    try {
      await fetch(`${apiUrl}/end-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ timeElapsed, completed: true }),
      });
    } catch (err) {
      console.error('Error ending exam session:', err);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) return window.speechSynthesis.cancel();
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser. Please use Chrome.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscriptChunk = '';
      let interimTranscriptChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptChunk += transcriptPart;
        } else {
          interimTranscriptChunk += transcriptPart;
        }
      }
      setTranscript(prev => {
        const base = prev.replace(/\[.*?\]\s*$/, '');
        const newText = (base ? base + ' ' : '') + finalTranscriptChunk;
        return newText + (interimTranscriptChunk ? ` [${interimTranscriptChunk}]` : '');
      });
    };
    recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    recognition.onend = () => {
      setIsListening(false);
      setTranscript(prev => prev.replace(/\[.*?\]\s*$/, '').trim());
    };
    return () => recognition?.stop();
  }, []);

  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  useEffect(() => () => window.speechSynthesis.cancel(), []);

  if (examFinished) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-2xl border border-white/20">
          <div className="text-center mb-6">
            <div className="relative"><CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6" /><div className="absolute inset-0 animate-ping"><CheckCircle className="w-20 h-20 text-emerald-300 mx-auto opacity-30" /></div></div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3">Interview Completed!</h2>
            <div className="text-emerald-600 text-sm">Time Taken: {formatTime(timeElapsed)}</div>
          </div>
          {evaluation && <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-100 text-left"><h3 className="text-lg font-semibold mb-4 text-gray-900">Your Evaluation</h3><div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{evaluation}</div></div>}
        </div>
      </div>
    );
  }

  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-2xl text-center border border-white/20">
          <div className="mb-6"><Zap className="w-16 h-16 text-indigo-600 mx-auto mb-4" /><h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-900 to-purple-900 bg-clip-text text-transparent mb-3">AI Interview Assistant</h1><p className="text-gray-600 leading-relaxed">Welcome to your AI-powered interview session. This system will ask you questions with real-time proctoring to ensure exam integrity.</p></div>
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"><div className="flex items-center text-red-700 justify-center"><AlertCircle className="mr-3 w-5 h-5" /><p className="text-sm">{error}</p></div></div>}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-gray-600"><Camera className="w-5 h-5" /><span>Camera access required for proctoring</span></div>
            <div className="flex items-center justify-center gap-2 text-gray-600"><Mic className="w-5 h-5" /><span>Microphone access for voice responses</span></div>
            <div className="flex items-center justify-center gap-2 text-gray-600"><Volume2 className="w-5 h-5" /><span>Audio enabled for question narration</span></div>
          </div>
          <button onClick={startInterview} className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:scale-105 transition-all duration-200 shadow-lg shadow-indigo-500/25"><Play className="w-5 h-5 inline mr-2" />Start Interview</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4"><Zap className="w-8 h-8 text-indigo-600" /><h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-900 to-purple-900 bg-clip-text text-transparent">AI Interview</h1><div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-indigo-100 rounded-full"><Clock className="w-4 h-4 text-indigo-600" /><span className="text-sm font-medium text-indigo-700">{formatTime(timeElapsed)}</span></div></div>
          <div className="flex items-center gap-3"><div className="text-sm text-gray-600">{questionStatus === 'intro' ? 'Introduction' : 'Project Discussion'}</div><div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">Question {questionNumber}</div></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1"><div className="flex items-center gap-2 mb-2"><span className="text-sm font-medium text-indigo-600">{questionStatus === 'intro' ? 'Introduction Phase' : 'Project Discussion'}</span><span className="text-xs text-gray-500">Question {questionNumber}</span></div><h2 className="text-lg font-semibold text-gray-900 leading-relaxed">{currentQuestion}</h2></div>
                <button onClick={() => speakText(currentQuestion)} disabled={isSpeaking} className={`ml-4 p-3 rounded-xl transition-all duration-200 ${isSpeaking ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-600 scale-105' : 'bg-white hover:bg-gray-50 text-gray-600 hover:scale-105'} shadow-md border border-gray-200`} title="Read question aloud">{isSpeaking ? <Pause className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
              </div>
            </section>
            <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">Your Answer</h3><button onClick={toggleSpeechRecognition} disabled={isSubmitting || isFinishing} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-white font-medium ${isListening ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/25 scale-105' : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:scale-105 shadow-lg shadow-blue-500/25'}`}>{isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}{isListening ? 'Stop Recording' : 'Start Recording'}</button></div>
              <div className="relative">
                <textarea
                  value={transcript.replace(/\[.*?\]\s*$/, '')}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="You can type your answer here, or use the voice recording button..."
                  className="w-full min-h-[250px] bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border-2 border-dashed border-gray-200 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                  disabled={isSubmitting || isFinishing}
                />
                <div className="absolute bottom-4 right-4 text-xs text-gray-500">
                  Word count: {transcript.replace(/\[.*?\]/g, '').trim().split(/\s+/).filter(Boolean).length}
                </div>
                {isListening && <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse"><div className="w-2 h-2 bg-white rounded-full"></div>Recording</div>}
              </div>
              <div className="flex justify-between items-center mt-6">
                <button onClick={finishInterview} disabled={isSubmitting || isFinishing} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-red-500 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 hover:scale-105 shadow-lg shadow-red-500/25"><XCircle className="w-4 h-4" />{isFinishing ? 'Finishing...' : 'Finish Interview'}</button>
                <div className="flex gap-4">
                  <button onClick={() => setTranscript('')} disabled={!transcript || isSubmitting || isFinishing} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 hover:bg-gray-300">Clear</button>
                  <button onClick={submitAnswer} disabled={!transcript || isSubmitting || isFinishing} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 hover:scale-105 shadow-lg shadow-emerald-500/25">{isSubmitting ? 'Submitting...' : 'Submit & Next'}<Send className="w-4 h-4" /></button>
                </div>
              </div>
            </section>
          </div>
          <aside className="lg:col-span-1"><WebCam /></aside>
        </div>
      </main>
    </div>
  );
}