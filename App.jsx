import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ModelViewer from "./pages/ModelViewer";
import Login from "./pages/Login";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;