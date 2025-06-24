const express = require("express");
const cors = require("cors");
const Docker = require("dockerode");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const docker = new Docker();

app.use(cors());
app.use(express.json());

const languageConfigs = {
  c: {
    image: "gcc:latest",
    extension: ".c",
    compile: ["gcc", "-o", "/code/temp", "/code/temp.c"],
    run: ["/code/temp"],
  },
  cpp: {
    image: "gcc:latest",
    extension: ".cpp",
    compile: ["g++", "-o", "/code/temp", "/code/temp.cpp"],
    run: ["/code/temp"],
  },
  java: {
    image: "openjdk:11",
    extension: ".java",
    compile: ["javac", "/code/Solution.java"],
    run: ["java", "-cp", "/code", "Solution"],
  },
  python: {
    image: "python:3.9-slim",
    extension: ".py",
    run: ["python", "/code/solution.py"],
  },
};

// Problem database with test cases
const problems = {
  "add-two-numbers": {
    title: "Add Two Numbers",
    difficulty: "Easy",
    acceptance: "85.2%",
    description: "Given two integers num1 and num2, return the sum of the two integers.",
    examples: [
      { input: "num1 = 12, num2 = 5", output: "17" },
      { input: "num1 = -10, num2 = 4", output: "-6" }
    ],
    constraints: ["-100 <= num1, num2 <= 100"],
    testCases: [
      { input: [12, 5], expected: 17 },
      { input: [-10, 4], expected: -6 },
      { input: [0, 0], expected: 0 },
      { input: [100, -100], expected: 0 },
      { input: [-50, -25], expected: -75 }
    ],
    functionSignature: {
      java: "public int addTwoNumbers(int num1, int num2)",
      python: "def add_two_numbers(num1, num2):",
      cpp: "int addTwoNumbers(int num1, int num2)",
      c: "int addTwoNumbers(int num1, int num2)"
    }
  }
};

const codeTemplates = {
  "add-two-numbers": {
    java: `public int addTwoNumbers(int num1, int num2) {
    // Write your code here
    return 0;
}`,
    python: `def add_two_numbers(num1, num2):
    # Write your code here
    return 0`,
    cpp: `int addTwoNumbers(int num1, int num2) {
    // Write your code here
    return 0;
}`,
    c: `int addTwoNumbers(int num1, int num2) {
    // Write your code here
    return 0;
}`
  }
};

// Get problem details
app.get("/problem/:problemId", (req, res) => {
  const { problemId } = req.params;
  const problem = problems[problemId];
  
  if (!problem) {
    return res.status(404).json({ error: "Problem not found" });
  }
  
  res.json(problem);
});

// Get code template
app.get("/problem/:problemId/template/:language", (req, res) => {
  const { problemId, language } = req.params;
  
  if (!problems[problemId]) {
    return res.status(404).json({ error: "Problem not found" });
  }
  
  if (!codeTemplates[problemId] || !codeTemplates[problemId][language]) {
    return res.status(404).json({ error: "Template not found" });
  }
  
  res.json({ template: codeTemplates[problemId][language] });
});

// Run code with test cases
app.post("/run", async (req, res) => {
  const { code, language, problemId } = req.body;

  if (!code || !language || !problemId || !languageConfigs[language]) {
    return res.status(400).json({ error: "Invalid request parameters" });
  }

  if (!problems[problemId]) {
    return res.status(400).json({ error: "Problem not found" });
  }

  const problem = problems[problemId];
  const testCases = problem.testCases.slice(0, 2); // Run only first 2 test cases for "Run"

  try {
    const results = await runTestCases(code, language, problemId, testCases);
    res.json({ testResults: results });
  } catch (error) {
    console.error("Run error:", error);
    res.status(500).json({ error: "Execution failed: " + error.message });
  }
});

// Submit code with all test cases
app.post("/submit", async (req, res) => {
  const { code, language, problemId } = req.body;

  if (!code || !language || !problemId || !languageConfigs[language]) {
    return res.status(400).json({ error: "Invalid request parameters" });
  }

  if (!problems[problemId]) {
    return res.status(400).json({ error: "Problem not found" });
  }

  const problem = problems[problemId];
  const testCases = problem.testCases; // Run all test cases for "Submit"

  try {
    const results = await runTestCases(code, language, problemId, testCases);
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    const accepted = passedTests === totalTests;

    res.json({
      accepted,
      passedTests,
      totalTests,
      testResults: results,
      executionTime: "3ms", // Mock values
      memory: "1.5MB",
      submissionId: "sub_" + Date.now()
    });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ error: "Submission failed: " + error.message });
  }
});

async function runTestCases(userCode, language, problemId, testCases) {
  const problem = problems[problemId];
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      const result = await executeTestCase(userCode, language, problemId, testCase, i + 1);
      results.push(result);
    } catch (error) {
      results.push({
        id: i + 1,
        input: testCase.input.join(", "),
        expectedOutput: testCase.expected.toString(),
        actualOutput: "Runtime Error: " + error.message,
        passed: false,
        executionTime: "0ms",
        memory: "0MB"
      });
    }
  }

  return results;
}

async function executeTestCase(userCode, language, problemId, testCase, testId) {
  const tempDir = path.join(__dirname, "temp", `test_${Date.now()}_${testId}`);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    const fullCode = generateFullCode(userCode, language, problemId, testCase);
    const config = languageConfigs[language];
    const fileName = language === 'java' ? 'Solution.java' : `solution${config.extension}`;
    const filePath = path.join(tempDir, fileName);
    
    await fs.writeFile(filePath, fullCode);

    // Compile if necessary
    if (config.compile) {
      const compileResult = await runInDocker(config.image, config.compile, tempDir);
      if (compileResult.error) {
        throw new Error("Compilation Error: " + compileResult.error);
      }
    }

    // Run the program
    const runResult = await runInDocker(config.image, config.run, tempDir);
    
    if (runResult.error) {
      throw new Error(runResult.error);
    }

    const actualOutput = runResult.output.trim();
    const expectedOutput = testCase.expected.toString();
    const passed = actualOutput === expectedOutput;

    return {
      id: testId,
      input: testCase.input.join(", "),
      expectedOutput,
      actualOutput,
      passed,
      executionTime: "2ms", // Mock timing
      memory: "1.2MB"
    };

  } finally {
    // Clean up
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
}

function generateFullCode(userCode, language, problemId, testCase) {
  const problem = problems[problemId];
  
  switch (language) {
    case 'java':
      return `import java.util.*;

public class Solution {
    ${userCode}
    
    public static void main(String[] args) {
        Solution solution = new Solution();
        ${generateJavaTestCall(problemId, testCase)}
    }
}`;

    case 'python':
      return `${userCode}

if __name__ == "__main__":
    ${generatePythonTestCall(problemId, testCase)}`;

    case 'cpp':
      return `#include <iostream>
#include <vector>
#include <string>
using namespace std;

${userCode}

int main() {
    ${generateCppTestCall(problemId, testCase)}
    return 0;
}`;

    case 'c':
      return `#include <stdio.h>
#include <stdlib.h>

${userCode}

int main() {
    ${generateCTestCall(problemId, testCase)}
    return 0;
}`;

    default:
      throw new Error("Unsupported language");
  }
}

function generateJavaTestCall(problemId, testCase) {
  switch (problemId) {
    case 'add-two-numbers':
      return `int result = solution.addTwoNumbers(${testCase.input[0]}, ${testCase.input[1]});
        System.out.println(result);`;
    default:
      throw new Error("Unknown problem");
  }
}

function generatePythonTestCall(problemId, testCase) {
  switch (problemId) {
    case 'add-two-numbers':
      return `result = add_two_numbers(${testCase.input[0]}, ${testCase.input[1]})
    print(result)`;
    default:
      throw new Error("Unknown problem");
  }
}

function generateCppTestCall(problemId, testCase) {
  switch (problemId) {
    case 'add-two-numbers':
      return `int result = addTwoNumbers(${testCase.input[0]}, ${testCase.input[1]});
    cout << result << endl;`;
    default:
      throw new Error("Unknown problem");
  }
}

function generateCTestCall(problemId, testCase) {
  switch (problemId) {
    case 'add-two-numbers':
      return `int result = addTwoNumbers(${testCase.input[0]}, ${testCase.input[1]});
    printf("%d\\n", result);`;
    default:
      throw new Error("Unknown problem");
  }
}

async function runInDocker(image, command, tempDir, input = "") {
  let container;
  
  try {
    container = await docker.createContainer({
      Image: image,
      Cmd: command,
      Tty: false,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        Binds: [`${path.resolve(tempDir)}:/code:rw`],
        NetworkMode: "none",
        Memory: 128 * 1024 * 1024, // 128MB
        CpuPeriod: 100000,
        CpuQuota: 50000, // 50% CPU
        AutoRemove: false,
      },
      WorkingDir: "/code",
    });

    await container.start();
    
    // Wait for container to finish with timeout
    const result = await Promise.race([
      container.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), 10000)
      )
    ]);
    
    // Get logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: false
    });

    const { stdout, stderr } = parseLogs(logs);
    
    return { 
      output: stdout.trim(), 
      error: stderr.trim() 
    };

  } catch (err) {
    console.error("Docker execution error:", err);
    return { output: "", error: err.message || "Container execution failed" };
  } finally {
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (e) {
        console.error("Container cleanup error:", e);
      }
    }
  }
}

function parseLogs(logs) {
  const logBuffer = Buffer.from(logs);
  let stdout = '';
  let stderr = '';
  let offset = 0;
  
  while (offset < logBuffer.length) {
    if (offset + 8 > logBuffer.length) break;
    
    const header = logBuffer.slice(offset, offset + 8);
    const streamType = header[0];
    const size = header.readUInt32BE(4);
    
    if (offset + 8 + size > logBuffer.length) break;
    
    const content = logBuffer.slice(offset + 8, offset + 8 + size).toString();
    
    if (streamType === 1) {
      stdout += content;
    } else if (streamType === 2) {
      stderr += content;
    }
    
    offset += 8 + size;
  }
  
  // Fallback parsing if header parsing fails
  if (!stdout && !stderr) {
    const allLogs = logs.toString();
    if (allLogs.includes('error') || allLogs.includes('Error') || allLogs.includes('Exception')) {
      stderr = allLogs;
    } else {
      stdout = allLogs;
    }
  }
  
  return { stdout, stderr };
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Supported languages:", Object.keys(languageConfigs));
  console.log("Available problems:", Object.keys(problems));
});
