import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Login() {
  const [form, setForm] = useState({
    name: "",
    role: "",
    email: "",
    password: ""
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/login", form);
      // Store user details in localStorage
      localStorage.setItem("user", JSON.stringify({
        name: form.name,
        role: form.role,
        email: form.email
      }));
      alert(res.data.message);
      navigate("/dashboard"); // Changed to a more appropriate route after login
    } catch (err) {
      alert(err.response?.data?.message || "An error occurred during login.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Enter your credentials
        </h2>
        <div className="space-y-4">
          <input
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            name="name"
            placeholder="Full Name"
            onChange={handleChange}
            value={form.name}
          />
          <input
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            name="role"
            placeholder="Role"
            onChange={handleChange}
            value={form.role}
          />
          <input
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            name="email"
            placeholder="Email Address"
            type="email"
            onChange={handleChange}
            value={form.email}
          />
          <input
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            name="password"
            type="password"
            placeholder="Password"
            onChange={handleChange}
            value={form.password}
          />
          <button
            className="w-full py-3 px-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105"
            onClick={handleLogin}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
