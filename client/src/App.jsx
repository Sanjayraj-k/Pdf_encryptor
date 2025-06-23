import { useState } from "react";
import axios from "axios";
import CodeEditor from "./Editor";
import "./App.css";

function App() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/run", {
        code,
        language,
        input,
      });
      setOutput(response.data.output || response.data.error || "No output");
    } catch (error) {
      setOutput("Error: Failed to execute code");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Online Code Editor</h1>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        style={{ marginBottom: "10px" }}
      >
        <option value="c">C</option>
        <option value="cpp">C++</option>
        <option value="java">Java</option>
        <option value="python">Python</option>
      </select>
      <CodeEditor code={code} setCode={setCode} language={language} />
      <div style={{ margin: "10px 0" }}>
        <textarea
          placeholder="Input for your program"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ width: "100%", height: "100px", marginBottom: "10px" }}
        />
        <button onClick={handleRun} disabled={loading}>
          {loading ? "Running..." : "Run Code"}
        </button>
      </div>
      <textarea
        placeholder="Output"
        value={output}
        readOnly
        style={{ width: "100%", height: "100px" }}
      />
    </div>
  );
}
export default App;