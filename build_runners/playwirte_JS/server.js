import express from "express";
import { spawn } from "child_process";
import fs from "fs";

const app = express();

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

const TEST_FOLDER = "tests/external";
if (!fs.existsSync(TEST_FOLDER)) fs.mkdirSync(TEST_FOLDER, { recursive: true });

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

  }, 3000);
});

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
                  runTests(repoDir, testConfig);
                });

                playwrightInstall.on("error", (error) => {
                  console.error('Playwright install error:', error);
                  runTests(repoDir, testConfig);
                });
              } else {
                console.error('Failed to install dependencies');
              }
            });
          } else {
            console.log('No package.json found, running tests directly');
            runTests(repoDir, testConfig);
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
      runTests('playwright-basic-demo', testConfig);
    }
  } catch (error) {
    console.error('Error in run-script:', error);
  }
});

function runTests(directory, testConfig) {
  console.log(`Running tests in directory: ${directory}`);
  
  // Run Playwright tests
  const testCommand = `export DISPLAY=:99 && cd ${directory} && npx playwright test --headed`;
  
  spawn("bash", ["-c", testCommand], { 
    stdio: "inherit",
    env: { ...process.env, DISPLAY: ":99" }
  });
}

app.listen(3000, () => console.log("Playwright server running on port 3000"));
