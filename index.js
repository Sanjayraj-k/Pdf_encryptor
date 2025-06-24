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
    compile: ["javac", "/code/temp.java"],
    run: ["java", "-cp", "/code", "temp"],
  },
  python: {
    image: "python:3.9-slim",
    extension: ".py",
    run: ["python", "/code/temp.py"],
  },
};

app.post("/run", async (req, res) => {
  const { code, language, input } = req.body;

  if (!code || !language || !languageConfigs[language]) {
    return res.status(400).json({ error: "Invalid code or language" });
  }

  if (code.length > 10000) {
    return res.status(400).json({ error: "Code too large" });
  }

  const tempDir = path.join(__dirname, "temp");
  const fileName = `temp${languageConfigs[language].extension}`;
  const filePath = path.join(tempDir, fileName);

  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    // For Java, we need to modify the code to have the correct class name
    if (language === 'java') {
      const modifiedCode = code.replace(/public\s+class\s+\w+/, 'public class temp');
      await fs.writeFile(filePath, modifiedCode);
    } else {
      await fs.writeFile(filePath, code);
    }

    const config = languageConfigs[language];
    let output = "";
    let error = "";
    let compileError = "";

    // Compile if necessary (C, C++, Java)
    if (config.compile) {
      const compileResult = await runInDocker(config.image, config.compile, tempDir);
      if (compileResult.error) {
        compileError = compileResult.error;
        return res.json({ output: "", error: compileError });
      }
    }

    // Run the program
    const runResult = await runInDocker(config.image, config.run, tempDir, input);
    output = runResult.output || "";
    error = runResult.error || "";

    res.json({ output, error });
  } catch (err) {
    console.error("Execution error:", err);
    res.status(500).json({ error: "Execution failed: " + err.message });
  } finally {
    // Clean up temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
});

async function runInDocker(image, command, tempDir, input = "") {
  let container;
  
  try {
    // Create container
    container = await docker.createContainer({
      Image: image,
      Cmd: command,
      Tty: false,
      OpenStdin: !!input,
      StdinOnce: !!input,
      AttachStdin: !!input,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        Binds: [`${path.resolve(tempDir)}:/code:rw`],
        NetworkMode: "none",
        Memory: 128 * 1024 * 1024, // 128MB
        CpuPeriod: 100000,
        CpuQuota: 50000, // 50% CPU
        AutoRemove: false, // We'll remove manually
      },
      WorkingDir: "/code",
    });

    let output = "";
    let error = "";

    if (input && input.trim()) {
      // Handle input case with exec
      await container.start();
      
      // Create exec instance to run command with input
      const exec = await container.exec({
        Cmd: ['sh', '-c', `echo "${input.replace(/"/g, '\\"')}" | ${command.join(' ')}`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });
      
      // Collect output from stream
      let stdout = '';
      let stderr = '';
      
      await new Promise((resolve, reject) => {
        // Demux the stream to separate stdout and stderr
        const stdoutStream = new require('stream').PassThrough();
        const stderrStream = new require('stream').PassThrough();
        
        container.modem.demuxStream(stream, stdoutStream, stderrStream);
        
        stdoutStream.on('data', (chunk) => {
          stdout += chunk.toString();
        });
        
        stderrStream.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        
        stream.on('end', () => {
          output = stdout.trim();
          error = stderr.trim();
          resolve();
        });
        
        stream.on('error', reject);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Execution timeout'));
        }, 10000);
      });
      
    } else {
      // No input case - simple execution
      await container.start();
      
      // Wait for container to finish
      const result = await container.wait();
      
      // Get logs
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: false
      });

      // Parse Docker logs format (first 8 bytes are header)
      const logBuffer = Buffer.from(logs);
      let stdout = '';
      let stderr = '';
      let offset = 0;
      
      while (offset < logBuffer.length) {
        if (offset + 8 > logBuffer.length) break;
        
        const header = logBuffer.slice(offset, offset + 8);
        const streamType = header[0]; // 1 = stdout, 2 = stderr
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
      
      output = stdout.trim();
      error = stderr.trim();
      
      // If no proper parsing worked, fall back to simple string conversion
      if (!output && !error) {
        const allLogs = logs.toString();
        if (allLogs.includes('error') || allLogs.includes('Error') || allLogs.includes('Exception')) {
          error = allLogs;
        } else {
          output = allLogs;
        }
      }
    }

    return { output, error };

  } catch (err) {
    console.error("Docker execution error:", err);
    return { output: "", error: err.message || "Container execution failed" };
  } finally {
    // Clean up container
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (e) {
        console.error("Container cleanup error:", e);
      }
    }
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Supported languages:", Object.keys(languageConfigs));
});