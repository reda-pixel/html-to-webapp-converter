import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { promises as fsPromises } from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Build State Storage (In-memory for now)
// ============================================

const buildState = new Map();

// ============================================
// Utilities
// ============================================

const executeCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: process.platform === 'win32',
      ...options
    };

    const child = spawn(command, args, defaultOptions);
    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
};

const findOutputDirectory = async (projectRoot, possibleDirs = ['dist', 'build', '.next', 'out', '_dist']) => {
  console.log(`🔍 Searching for output directory in: ${projectRoot}`);
  
  for (const dir of possibleDirs) {
    const fullPath = path.join(projectRoot, dir);
    try {
      const stats = await fsPromises.stat(fullPath);
      if (stats.isDirectory()) {
        const files = await fsPromises.readdir(fullPath);
        if (files.length > 0) {
          console.log(`✅ Found output directory: ${dir}`);
          return fullPath;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }

  // Check if any of these directories exist (even if empty)
  for (const dir of possibleDirs) {
    const fullPath = path.join(projectRoot, dir);
    try {
      const stats = await fsPromises.stat(fullPath);
      if (stats.isDirectory()) {
        console.log(`⚠️  Output directory exists but might be empty: ${dir}`);
        return fullPath;
      }
    } catch (error) {
      // Directory doesn't exist
    }
  }

  throw new Error(`Output directory not found. Checked: ${possibleDirs.join(', ')}`);
};

const verifyOutputContents = async (outputDir) => {
  console.log(`📋 Verifying output contents in: ${outputDir}`);
  
  const contents = {
    hasIndexHtml: false,
    hasAssets: false,
    files: [],
    errors: []
  };

  try {
    const files = await fsPromises.readdir(outputDir, { recursive: true });
    contents.files = files;

    // Check for index.html or main HTML file
    const htmlFiles = files.filter(f => f.toLowerCase().endsWith('.html'));
    if (htmlFiles.length === 0) {
      contents.errors.push('No HTML files found in output');
    } else {
      contents.hasIndexHtml = true;
      console.log(`✅ Found ${htmlFiles.length} HTML file(s)`);
    }

    // Check for assets (JS, CSS, images, etc.)
    const assetFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.json'].includes(ext);
    });

    if (assetFiles.length > 0) {
      contents.hasAssets = true;
      console.log(`✅ Found ${assetFiles.length} asset file(s)`);
    }

    return contents;
  } catch (error) {
    console.error(`❌ Error verifying output: ${error.message}`);
    contents.errors.push(error.message);
    return contents;
  }
};

const createOutputZip = async (outputDir, projectId) => {
  return new Promise((resolve, reject) => {
    try {
      const zipFileName = `${projectId}-built.zip`;
      const zipPath = path.join(path.dirname(outputDir), zipFileName);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      console.log(`📦 Creating ZIP archive: ${zipFileName}`);

      output.on('close', () => {
        console.log(`✅ ZIP created successfully: ${zipFileName} (${archive.pointer()} bytes)`);
        resolve(zipPath);
      });

      archive.on('error', (err) => {
        console.error(`❌ ZIP creation error: ${err.message}`);
        reject(err);
      });

      archive.pipe(output);
      archive.directory(outputDir, false);
      archive.finalize();
    } catch (error) {
      console.error(`❌ Error creating ZIP: ${error.message}`);
      reject(error);
    }
  });
};

const installDependencies = async (projectRoot, packageManager = 'npm') => {
  console.log(`\n📥 Installing dependencies using ${packageManager}...`);
  console.log(`${'='.repeat(60)}`);

  try {
    let command, args;

    if (packageManager === 'yarn') {
      command = 'yarn';
      args = ['install'];
    } else if (packageManager === 'pnpm') {
      command = 'pnpm';
      args = ['install'];
    } else {
      // Default to npm
      command = 'npm';
      args = ['install'];
    }

    console.log(`🚀 Running: ${command} ${args.join(' ')}`);
    const result = await executeCommand(command, args, { cwd: projectRoot });
    
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Dependencies installed successfully!\n`);
    return result;
  } catch (error) {
    console.error(`${'='.repeat(60)}`);
    console.error(`❌ Failed to install dependencies: ${error.message}\n`);
    throw error;
  }
};

const executeBuildCommand = async (projectRoot, buildCommand, packageManager = 'npm') => {
  console.log(`\n🔨 Building project...`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🚀 Build command: ${buildCommand}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // If buildCommand is a script from package.json, run it through package manager
    let command, args;

    if (buildCommand.startsWith('npm run') || buildCommand.startsWith('yarn run') || buildCommand.startsWith('pnpm run')) {
      // Extract script name
      const scriptName = buildCommand.split(' ').pop();
      if (packageManager === 'yarn') {
        command = 'yarn';
        args = ['run', scriptName];
      } else if (packageManager === 'pnpm') {
        command = 'pnpm';
        args = ['run', scriptName];
      } else {
        command = 'npm';
        args = ['run', scriptName];
      }
    } else if (buildCommand.includes(' ')) {
      // Multi-word command
      const parts = buildCommand.split(' ');
      command = parts[0];
      args = parts.slice(1);
    } else {
      // Single command
      command = buildCommand;
      args = [];
    }

    const result = await executeCommand(command, args, { cwd: projectRoot });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Build completed successfully!\n`);
    return result;
  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(`❌ Build failed: ${error.message}\n`);
    throw error;
  }
};

const buildSimpleProject = async (projectRoot) => {
  console.log(`\n📄 Building simple HTML/CSS/JS project...`);
  console.log(`${'='.repeat(60)}`);
  console.log(`No build system detected. Copying files to 'dist' directory.\n`);

  try {
    const srcDir = projectRoot;
    const distDir = path.join(projectRoot, 'dist');

    // Create dist directory
    await fsPromises.mkdir(distDir, { recursive: true });
    console.log(`📁 Created output directory: dist`);

    // Copy all files except node_modules, .git, etc.
    const files = await fsPromises.readdir(srcDir, { recursive: true, withFileTypes: true });
    
    let copiedCount = 0;
    for (const file of files) {
      const srcPath = path.join(file.parentPath || srcDir, file.name);
      const relativePath = path.relative(srcDir, srcPath);

      // Skip certain directories and files
      if (
        relativePath.startsWith('node_modules') ||
        relativePath.startsWith('.git') ||
        relativePath.startsWith('dist') ||
        relativePath.startsWith('build') ||
        relativePath.startsWith('.') ||
        file.isDirectory()
      ) {
        continue;
      }

      const destPath = path.join(distDir, relativePath);
      const destDirPath = path.dirname(destPath);

      await fsPromises.mkdir(destDirPath, { recursive: true });
      await fsPromises.copyFile(srcPath, destPath);
      copiedCount++;
    }

    console.log(`✅ Copied ${copiedCount} files to dist directory`);
    console.log(`${'='.repeat(60)}\n`);
    
    return { success: true, outputDir: distDir };
  } catch (error) {
    console.error(`${'='.repeat(60)}`);
    console.error(`❌ Simple build failed: ${error.message}\n`);
    throw error;
  }
};

// ============================================
// Main Build Function
// ============================================

const buildProject = async (projectId, projectData) => {
  const buildLog = [];
  const logLine = (msg) => {
    console.log(msg);
    buildLog.push(msg);
  };

  try {
    logLine(`\n${'='.repeat(70)}`);
    logLine(`🏗️  STARTING BUILD PROCESS FOR PROJECT: ${projectId}`);
    logLine(`${'='.repeat(70)}\n`);

    const projectInfo = projectData.projectInfo;
    const buildConfig = projectData.buildConfig;
    const projectRoot = projectData.projectRoot;
    const buildCommand = buildConfig.command;
    const packageManager = projectInfo.packageManager;

    // Verify project root exists
    if (!fs.existsSync(projectRoot)) {
      throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    logLine(`📂 Project Root: ${projectRoot}`);
    logLine(`🎯 Framework: ${projectInfo.framework}`);
    logLine(`🔧 Build Tool: ${projectInfo.buildTool}`);
    logLine(`📦 Package Manager: ${packageManager}`);
    logLine(`\n`);

    let outputDir;

    // If it's a simple HTML/CSS/JS project without package.json
    if (!projectInfo.isNodeProject && projectInfo.buildTool === 'manual') {
      logLine(`🔍 Detected: Simple HTML/CSS/JS project (no build system)`);
      const result = await buildSimpleProject(projectRoot);
      outputDir = result.outputDir;
    } else {
      // Node.js project with build system
      if (!buildCommand) {
        throw new Error('No build command found in package.json or configuration');
      }

      // Install dependencies
      try {
        await installDependencies(projectRoot, packageManager);
      } catch (error) {
        logLine(`⚠️  Warning: Failed to install dependencies: ${error.message}`);
        logLine(`Attempting to build anyway...\n`);
      }

      // Execute build command
      await executeBuildCommand(projectRoot, buildCommand, packageManager);

      // Find output directory
      outputDir = await findOutputDirectory(projectRoot);
    }

    // Verify output contents
    const outputVerification = await verifyOutputContents(outputDir);
    
    if (outputVerification.errors.length > 0) {
      logLine(`\n⚠️  Output Verification Warnings:`);
      outputVerification.errors.forEach(err => logLine(`  - ${err}`));
    }

    if (!outputVerification.hasIndexHtml) {
      logLine(`\n❌ Output directory does not contain any HTML files!`);
      throw new Error('Build output is invalid: no HTML files found');
    }

    // Create ZIP of output
    const zipPath = await createOutputZip(outputDir, projectId);

    const buildResult = {
      success: true,
      projectId,
      outputDirectory: outputDir,
      zipPath,
      outputVerification,
      buildLog,
      timestamp: new Date().toISOString(),
      message: `✅ Build completed successfully! Output: ${path.basename(outputDir)}`
    };

    logLine(`\n${'='.repeat(70)}`);
    logLine(`✅ BUILD SUCCESSFUL!`);
    logLine(`📁 Output Directory: ${outputDir}`);
    logLine(`📦 Files: ${outputVerification.files.length}`);
    logLine(`📋 HTML Files: ${outputVerification.hasIndexHtml ? '✅' : '❌'}`);
    logLine(`🎨 Assets: ${outputVerification.hasAssets ? '✅' : '⚠️'}`);
    logLine(`🗜️  ZIP Created: ${zipPath}`);
    logLine(`${'='.repeat(70)}\n`);

    // Store build state
    buildState.set(projectId, buildResult);

    return buildResult;
  } catch (error) {
    console.error(`\n${'='.repeat(70)}`);
    console.error(`❌ BUILD FAILED!`);
    console.error(`Error: ${error.message}`);
    console.error(`${'='.repeat(70)}\n`);

    buildLog.push(`\n${'='.repeat(70)}`);
    buildLog.push(`❌ BUILD FAILED`);
    buildLog.push(`Error: ${error.message}`);
    buildLog.push(`${'='.repeat(70)}`);

    const buildResult = {
      success: false,
      projectId,
      error: error.message,
      buildLog,
      timestamp: new Date().toISOString()
    };

    buildState.set(projectId, buildResult);
    throw error;
  }
};

// ============================================
// Express Route Handlers
// ============================================

router.post('/', async (req, res) => {
  try {
    const { projectId, analysisData } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required',
        code: 'MISSING_PROJECT_ID'
      });
    }

    if (!analysisData) {
      return res.status(400).json({
        success: false,
        error: 'analysisData is required (from analyze endpoint)',
        code: 'MISSING_ANALYSIS_DATA'
      });
    }

    console.log(`\n🔔 Build request received for project: ${projectId}`);

    // Execute build
    const result = await buildProject(projectId, analysisData);

    res.json({
      success: true,
      projectId,
      data: result
    });
  } catch (error) {
    console.error(`\n❌ Build endpoint error: ${error.message}`);
    console.error(error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      code: 'BUILD_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get build status
router.get('/status/:projectId', (req, res) => {
  const { projectId } = req.params;
  const buildData = buildState.get(projectId);

  if (!buildData) {
    return res.status(404).json({
      success: false,
      error: 'Build not found for this project',
      code: 'BUILD_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    projectId,
    data: buildData
  });
});

export default router;
