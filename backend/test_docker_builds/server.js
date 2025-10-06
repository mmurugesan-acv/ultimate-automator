import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

const TEST_FOLDER = "tests/external";
if (!fs.existsSync(TEST_FOLDER)) fs.mkdirSync(TEST_FOLDER, { recursive: true });

app.get("/stream.mjpeg", (req, res) => {
  console.log("New client connected to MJPEG stream");
  
  // Set proper MJPEG headers
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'keep-alive'
  });

  // Give Xvfb time to start if needed
  setTimeout(() => {
    console.log("Starting FFmpeg for display :99");
    
    const ffmpeg = spawn("ffmpeg", [
      "-f", "x11grab",
      "-video_size", "1280x720", // Smaller size for better performance
      "-framerate", "5", // Lower framerate
      "-i", ":99",
      "-vf", "scale=800:600", // Scale down for web display
      "-q:v", "5", // Moderate quality
      "-f", "mjpeg",
      "-"
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let isActive = true;

    // Handle FFmpeg output
    ffmpeg.stdout.on('data', (data) => {
      if (isActive && !res.destroyed) {
        // Write boundary and headers for each frame
        res.write('--myboundary\r\n');
        res.write('Content-Type: image/jpeg\r\n');
        res.write(`Content-Length: ${data.length}\r\n\r\n`);
        res.write(data);
        res.write('\r\n');
      }
    });

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString();
      console.log("FFmpeg stderr:", message);
    });

    ffmpeg.on('error', (err) => {
      console.error('FFmpeg error:', err);
      isActive = false;
      if (!res.destroyed) {
        res.end();
      }
    });

    ffmpeg.on('exit', (code) => {
      console.log(`FFmpeg exited with code ${code}`);
      isActive = false;
      if (!res.destroyed) {
        res.end();
      }
    });

    // Clean up when client disconnects
    req.on('close', () => {
      console.log("Client disconnected from MJPEG stream");
      isActive = false;
      if (ffmpeg && !ffmpeg.killed) {
        ffmpeg.kill('SIGTERM');
      }
    });

    res.on('close', () => {
      console.log("Response closed");
      isActive = false;
      if (ffmpeg && !ffmpeg.killed) {
        ffmpeg.kill('SIGTERM');
      }
    });

  }, 3000); // Give more time for Xvfb to be ready
});

// Test endpoint to verify CORS
app.get("/test", (req, res) => {
  res.json({ message: "CORS is working!", timestamp: new Date().toISOString() });
});

// Debug endpoint to check Xvfb status
app.get("/debug", (req, res) => {
  const { spawn } = require("child_process");
  const xdpyinfo = spawn("xdpyinfo", ["-display", ":99"]);
  
  let output = "";
  let error = "";
  
  xdpyinfo.stdout.on("data", (data) => {
    output += data.toString();
  });
  
  xdpyinfo.stderr.on("data", (data) => {
    error += data.toString();
  });
  
  xdpyinfo.on("close", (code) => {
    res.json({
      displayStatus: code === 0 ? "Display :99 is active" : "Display :99 not found",
      exitCode: code,
      output: output.substring(0, 500), // Limit output
      error: error.substring(0, 500)
    });
  });
});

app.post("/run-script", (req, res) => {
  res.json({ status: "started", streamUrl: `/stream.mjpeg` });

  // Run Playwright tests in the background
  spawn("bash", ["-c", "export DISPLAY=:99 && cd playwright-basic-demo && npx playwright test tests-examples/demo-todo-app.spec.ts --headed"], { stdio: "inherit" });
});

app.listen(3000, () => console.log("Playwright server running on port 3000"));
