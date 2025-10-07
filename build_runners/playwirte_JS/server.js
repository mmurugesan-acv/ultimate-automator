import express from "express";
import { spawn } from "child_process";
import fs from "fs";

const app = express();

// Log buffer to store recent logs
const logBuffer = [];
const MAX_LOG_BUFFER = 100;
let sseClients = [];

// Override console.log to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: message
  };
  
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
  
  // Broadcast to SSE clients
  broadcastToSSEClients(logEntry);
  
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: message
  };
  
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
  
  // Broadcast to SSE clients
  broadcastToSSEClients(logEntry);
  
  originalConsoleError.apply(console, args);
};

function broadcastToSSEClients(logEntry) {
  const data = JSON.stringify(logEntry);
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      // Remove dead clients
      const index = sseClients.indexOf(client);
      if (index > -1) {
        sseClients.splice(index, 1);
      }
    }
  });
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

app.get("/stream.mjpeg", (req, res) => {
  console.log("New client connected to MJPEG stream");
  
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'keep-alive'
  });

  setTimeout(() => {
    console.log("Starting streaming service");
    
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

    ffmpeg.on('error', (err) => {
      console.error('Stream service got disconneted:', err);
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

  }, 3000);
});


app.post("/run-script", async (req, res) => {
  const { repository, githubToken, testConfig } = req.body;
  
  console.log('Received test run request:', { repository: repository?.name, testConfig });
  
  res.json({ 
    status: "started", 
    streamUrl: `/stream.mjpeg`,
    repository: repository?.name 
  });

  try {
    // Clone the repository
    if (repository?.clone_url) {
      console.log('Cloning repository:', repository.clone_url);
      
      // Remove existing directory if it exists
      const repoDir = `cloned-repo`;
      if (fs.existsSync(repoDir)) {
        fs.rmSync(repoDir, { recursive: true, force: true });
      }

      // Determine clone URL based on repository privacy
      let cloneUrl = repository.clone_url;
      
      // For private repositories, use token-authenticated URL
      if (repository.private && githubToken) {
        cloneUrl = repository.clone_url.replace(
          'https://github.com/',
          `https://${githubToken}@github.com/`
        );
        console.log('Using authenticated clone for private repository');
      }

      // Clone the repository
      const cloneProcess = spawn("git", [
        "clone",
        cloneUrl,
        repoDir
      ], { stdio: "inherit" });

      cloneProcess.on("close", (code) => {
        if (code === 0) {
          console.log('Repository cloned successfully');
          
          // Copy .env file to cloned repository if it exists
          const envSourcePath = '.env';
          const envDestPath = `${repoDir}/.env`;
          
          if (fs.existsSync(envSourcePath)) {
            try {
              fs.copyFileSync(envSourcePath, envDestPath);
              console.log('.env file copied to cloned repository');
            } catch (error) {
              console.error('Failed to copy .env file:', error);
            }
          } else {
            console.log('No .env file found in current directory');
          }
          
          // Create ultimate_automator folder and test file with provided code
          createTestFile(repoDir, testConfig);
          
          // Install dependencies if package.json exists
          const packageJsonPath = `${repoDir}/package.json`;
          if (fs.existsSync(packageJsonPath)) {
            console.log('Installing dependencies...');
            const npmInstall = spawn("npm", ["install"], { 
              cwd: repoDir,
              stdio: "inherit" 
            });

            npmInstall.on("close", (installCode) => {
              if (installCode === 0) {
                console.log('Dependencies installed successfully');
                
                // Install Playwright browsers for the cloned repo
                console.log('Installing Playwright browsers for cloned repository...');
                const playwrightInstall = spawn("npx", ["playwright", "install"], { 
                  cwd: repoDir,
                  stdio: "inherit" 
                });

                playwrightInstall.on("close", (browserInstallCode) => {
                  if (browserInstallCode === 0) {
                    console.log('Playwright browsers installed successfully');
                  } else {
                    console.log('Playwright browser install failed, but continuing...');
                  }
                  runTests(repoDir);
                });

                playwrightInstall.on("error", (error) => {
                  console.error('Playwright install error:', error);
                  runTests(repoDir);
                });
              } else {
                console.error('Failed to install dependencies');
              }
            });
          } else {
            console.log('No package.json found, running tests directly');
          }
        } else {
          console.error('Failed to clone repository, exit code:', code);
        }
      });

      cloneProcess.on("error", (error) => {
        console.error('Git clone error:', error);
      });
    } else {
      // Fallback to default repository
      console.log('No repository specified, using default');
    }
  } catch (error) {
    console.error('Error in run-script:', error);
  }
});

function createTestFile(directory, testConfig) {
  try {
    // Create ultimate_automator folder
    const testFolderPath = `${directory}/ultimate_automator`;
    if (!fs.existsSync(testFolderPath)) {
      fs.mkdirSync(testFolderPath, { recursive: true });
      console.log('Created ultimate_automator folder');
    }
    
    // Create UA_E2E.spec.js file with the test code
    const testFilePath = `${testFolderPath}/UA_E2E.spec.js`;
    
    let testCode = '';
    if (testConfig && testConfig.code) {
      // Use provided code and replace \n with actual newlines
      testCode = testConfig.code.replace(/\\n/g, '\n');
    } else {
      return;
    }
    
    fs.writeFileSync(testFilePath, testCode, 'utf8');
    console.log(`Created test file: ${testFilePath}`);
    console.log('Test code written successfully');
    
  } catch (error) {
    console.error('Error creating test file:', error);
  }
}

function runTests(directory) {
  console.log(`Running tests in directory: ${directory}`);
  
  // Run Playwright tests specifically for ultimate_automator folder
  const testCommand = `export DISPLAY=:99 && cd ${directory} && npx playwright test --headed`;
  
  spawn("bash", ["-c", testCommand], { 
    stdio: "inherit",
    env: { ...process.env, DISPLAY: ":99" }
  });
}

// SSE endpoint for real-time logs
app.get("/logs", (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send recent logs
  logBuffer.forEach(log => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  // Add client to list
  sseClients.push(res);

  // Remove client when connection closes
  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index > -1) {
      sseClients.splice(index, 1);
    }
  });
});

app.listen(3000, () => console.log("Playwright server running on port 3000"));
