import Editor from "@monaco-editor/react";

function CodeEditor({ code, setCode, language }) {
  return (
    <Editor
      height="500px"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={setCode}
      options={{
        minimap: { enabled: false },
        fontSize: 16,
        automaticLayout: true,
      }}
    />
  );
}
export default CodeEditor;