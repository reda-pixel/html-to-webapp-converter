import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cheerio from 'cheerio';
import unzipper from 'unzipper';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// File System Utilities
// ============================================

const readDirRecursive = async (dir, fileList = []) => {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const relativePath = path.relative(path.dirname(dir), fullPath);
    
    if (file.isDirectory()) {
      // Skip common directories
      if (!['node_modules', '.git', 'dist', 'build', '.next', 'out'].includes(file.name)) {
        await readDirRecursive(fullPath, fileList);
      }
    } else {
      fileList.push({
        name: file.name,
        path: fullPath,
        relativePath,
        size: file.size || 0
      });
    }
  }
  
  return fileList;
};

// ============================================
// Project Type Detection
// ============================================

const detectProjectType = (files, projectRoot) => {
  const fileNames = new Set(files.map(f => f.name.toLowerCase()));
  const detections = {
    hasPackageJson: fileNames.has('package.json'),
    hasViteConfig: fileNames.has('vite.config.js') || fileNames.has('vite.config.ts'),
    hasWebpack: fileNames.has('webpack.config.js'),
    hasNextConfig: fileNames.has('next.config.js'),
    hasNuxtConfig: fileNames.has('nuxt.config.js'),
    hasGulpfile: fileNames.has('gulpfile.js'),
    hasGruntfile: fileNames.has('gruntfile.js'),
    hasReact: fileNames.has('package.json'), // Will check content
    hasVue: fileNames.has('package.json'), // Will check content
    hasAngular: fileNames.has('package.json'), // Will check content
    hasTypeScript: false,
    hasTSConfig: fileNames.has('tsconfig.json'),
    hasJSXFiles: false,
    hasTSXFiles: false,
  };

  // Check for TS/TSX/JSX files
  files.forEach(file => {
    const ext = path.extname(file.name).toLowerCase();
    if (ext === '.ts') detections.hasTypeScript = true;
    if (ext === '.tsx') detections.hasTSXFiles = true;
    if (ext === '.jsx') detections.hasJSXFiles = true;
  });

  return detections;
};

const determineFramework = (detections, packageJson) => {
  let framework = 'Plain HTML/CSS/JS';
  let buildTool = 'manual';
  let packageManager = 'npm';

  if (!detections.hasPackageJson) {
    return { framework, buildTool, packageManager };
  }

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const depNames = Object.keys(deps).map(d => d.toLowerCase());

  // Detect build tools
  if (detections.hasViteConfig) buildTool = 'vite';
  else if (detections.hasWebpack) buildTool = 'webpack';
  else if (detections.hasNextConfig) buildTool = 'next';
  else if (detections.hasNuxtConfig) buildTool = 'nuxt';
  else if (detections.hasGulpfile) buildTool = 'gulp';
  else if (detections.hasGruntfile) buildTool = 'grunt';

  // Detect frameworks
  if (depNames.includes('react') || depNames.includes('react-dom')) {
    framework = 'React';
    if (buildTool === 'manual') buildTool = 'vite';
  } else if (depNames.includes('vue')) {
    framework = 'Vue';
    if (buildTool === 'manual') buildTool = 'vite';
  } else if (depNames.includes('angular')) {
    framework = 'Angular';
    if (buildTool === 'manual') buildTool = 'webpack';
  } else if (depNames.includes('next')) {
    framework = 'Next.js';
    buildTool = 'next';
  } else if (depNames.includes('nuxt')) {
    framework = 'Nuxt';
    buildTool = 'nuxt';
  } else if (depNames.includes('svelte')) {
    framework = 'Svelte';
  }

  // Detect package manager from lock files
  if (packageJson.pnpm) packageManager = 'pnpm';
  else if (packageJson.yarn) packageManager = 'yarn';

  return { framework, buildTool, packageManager };
};

const getBuildCommand = (packageJson, framework, buildTool) => {
  const scripts = packageJson.scripts || {};
  let command = null;

  // Check if build script exists
  if (scripts.build) {
    command = scripts.build;
  } else if (buildTool === 'vite') {
    command = 'vite build';
  } else if (buildTool === 'webpack') {
    command = 'webpack';
  } else if (buildTool === 'next') {
    command = 'next build';
  } else if (buildTool === 'nuxt') {
    command = 'nuxt build';
  } else if (buildTool === 'gulp') {
    command = 'gulp';
  } else if (buildTool === 'grunt') {
    command = 'grunt';
  }

  return command;
};

// ============================================
// Asset Detection
// ============================================

const categorizeAssets = (files) => {
  const assets = {
    html: [],
    css: [],
    js: [],
    jsx: [],
    ts: [],
    tsx: [],
    images: [],
    svg: [],
    fonts: [],
    json: [],
    media: [],
    other: []
  };

  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.tiff'];
  const fontExts = ['.ttf', '.otf', '.woff', '.woff2', '.eot'];
  const mediaExts = ['.mp4', '.mp3', '.wav', '.webm', '.m4a', '.mov', '.avi'];

  files.forEach(file => {
    const ext = path.extname(file.name).toLowerCase();
    const relativePath = file.relativePath;

    if (ext === '.html') assets.html.push(relativePath);
    else if (ext === '.css') assets.css.push(relativePath);
    else if (ext === '.jsx') assets.jsx.push(relativePath);
    else if (ext === '.tsx') assets.tsx.push(relativePath);
    else if (ext === '.ts') assets.ts.push(relativePath);
    else if (ext === '.js') assets.js.push(relativePath);
    else if (ext === '.svg') assets.svg.push(relativePath);
    else if (ext === '.json') assets.json.push(relativePath);
    else if (imageExts.includes(ext)) assets.images.push(relativePath);
    else if (fontExts.includes(ext)) assets.fonts.push(relativePath);
    else if (mediaExts.includes(ext)) assets.media.push(relativePath);
    else assets.other.push(relativePath);
  });

  return assets;
};

// ============================================
// HTML Analysis
// ============================================

const analyzeHTMLFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(content);

    const analysis = {
      title: $('title').text() || 'No title',
      meta: {
        description: $('meta[name="description"]').attr('content') || '',
        viewport: $('meta[name="viewport"]').attr('content') || '',
        charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content') || ''
      },
      linkedResources: {
        stylesheets: [],
        scripts: [],
        images: [],
        fonts: [],
        other: []
      }
    };

    // Extract stylesheets
    $('link[rel="stylesheet"], link[type="text/css"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) analysis.linkedResources.stylesheets.push(href);
    });

    // Extract scripts
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) analysis.linkedResources.scripts.push(src);
    });

    // Extract images
    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && !src.startsWith('data:')) analysis.linkedResources.images.push(src);
    });

    // Extract fonts
    $('@font-face, link[href*="fonts"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) analysis.linkedResources.fonts.push(href);
    });

    // Count elements
    analysis.elementCounts = {
      headings: $('h1, h2, h3, h4, h5, h6').length,
      paragraphs: $('p').length,
      links: $('a').length,
      images: $('img').length,
      forms: $('form').length,
      tables: $('table').length
    };

    return analysis;
  } catch (error) {
    console.error(`❌ Error analyzing HTML file: ${error.message}`);
    return null;
  }
};

// ============================================
// Package.json Analysis
// ============================================

const analyzePackageJson = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading package.json: ${error.message}`);
    return null;
  }
};

// ============================================
// ZIP Extraction and Analysis
// ============================================

const extractAndAnalyzeZip = async (zipPath, extractDir) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📦 Extracting ZIP: ${path.basename(zipPath)}`);
      
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', () => {
          console.log(`✅ ZIP extracted successfully to: ${extractDir}`);
          resolve(extractDir);
        })
        .on('error', (err) => {
          console.error(`❌ Error extracting ZIP: ${err.message}`);
          reject(err);
        });
    } catch (error) {
      console.error(`❌ Error processing ZIP: ${error.message}`);
      reject(error);
    }
  });
};

// ============================================
// Main Analysis Function
// ============================================

const analyzeProject = async (filePath, isZip = false) => {
  try {
    let projectRoot = filePath;
    let isExtracted = false;

    // If ZIP file, extract it first
    if (isZip) {
      const extractDir = path.join(path.dirname(filePath), 'extracted_' + Date.now());
      await fs.promises.mkdir(extractDir, { recursive: true });
      projectRoot = await extractAndAnalyzeZip(filePath, extractDir);
      isExtracted = true;
      console.log(`📂 Project root set to: ${projectRoot}`);
    }

    // Read all project files
    console.log(`📄 Reading project structure...`);
    const allFiles = await readDirRecursive(projectRoot);
    console.log(`✅ Found ${allFiles.length} files`);

    // Detect project type
    console.log(`🔍 Detecting project type...`);
    const detections = detectProjectType(allFiles, projectRoot);

    // Read package.json if exists
    let packageJson = null;
    let framework = 'Plain HTML/CSS/JS';
    let buildTool = 'manual';
    let packageManager = 'npm';
    let buildCommand = null;
    let dependencies = { runtime: {}, dev: {} };

    if (detections.hasPackageJson) {
      console.log(`📦 Found package.json, analyzing...`);
      const packageJsonPath = allFiles.find(f => f.name === 'package.json')?.path;
      if (packageJsonPath) {
        packageJson = analyzePackageJson(packageJsonPath);
        
        if (packageJson) {
          dependencies = {
            runtime: packageJson.dependencies || {},
            dev: packageJson.devDependencies || {}
          };

          // Determine framework and build tool
          const frameworkInfo = determineFramework(detections, packageJson);
          framework = frameworkInfo.framework;
          buildTool = frameworkInfo.buildTool;
          packageManager = frameworkInfo.packageManager;
          buildCommand = getBuildCommand(packageJson, framework, buildTool);

          console.log(`✅ Framework detected: ${framework}`);
          console.log(`✅ Build tool: ${buildTool}`);
          console.log(`✅ Build command: ${buildCommand}`);
        }
      }
    }

    // Categorize assets
    console.log(`📊 Categorizing assets...`);
    const assets = categorizeAssets(allFiles);

    // Analyze main HTML file(s)
    let htmlAnalysis = null;
    if (assets.html.length > 0) {
      const mainHtmlPath = allFiles.find(f => 
        f.name === 'index.html' || (f.relativePath.includes(f.name) && f.name.endsWith('.html'))
      )?.path;

      if (mainHtmlPath) {
        console.log(`📝 Analyzing main HTML file: ${path.basename(mainHtmlPath)}`);
        htmlAnalysis = analyzeHTMLFile(mainHtmlPath);
      }
    }

    // Detect output directory
    const outputDirs = allFiles
      .filter(f => ['dist', 'build', '.next', 'out', '_dist'].some(dir => f.relativePath.includes(dir)))
      .map(f => path.dirname(f.relativePath))
      .filter((value, index, self) => self.indexOf(value) === index);

    console.log(`✅ Analysis complete!`);

    return {
      success: true,
      projectInfo: {
        framework,
        buildTool,
        packageManager,
        isNodeProject: detections.hasPackageJson,
        hasTypeScript: detections.hasTypeScript || detections.hasTSConfig,
        isExtracted,
        extractedPath: isExtracted ? projectRoot : null
      },
      buildConfig: {
        command: buildCommand,
        packageJson: packageJson ? {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          main: packageJson.main,
          scripts: packageJson.scripts || {},
          engines: packageJson.engines || {}
        } : null,
        dependencies: {
          count: Object.keys(dependencies.runtime).length,
          devCount: Object.keys(dependencies.dev).length,
          list: dependencies
        }
      },
      fileStructure: {
        totalFiles: allFiles.length,
        totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
        byType: assets
      },
      htmlAnalysis,
      outputDirectories: outputDirs.length > 0 ? outputDirs : ['dist', 'build'],
      configFiles: {
        hasViteConfig: detections.hasViteConfig,
        hasWebpackConfig: detections.hasWebpack,
        hasTsConfig: detections.hasTSConfig,
        hasNextConfig: detections.hasNextConfig,
        hasNuxtConfig: detections.hasNuxtConfig
      },
      projectRoot,
      message: `✅ Project analyzed successfully! Framework: ${framework}, Build Tool: ${buildTool}`
    };
  } catch (error) {
    console.error(`❌ Analysis failed: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      error: error.message,
      details: error.stack
    };
  }
};

// ============================================
// Express Route Handler
// ============================================

router.post('/', async (req, res) => {
  try {
    const { projectId, filePath } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required',
        code: 'MISSING_PROJECT_ID'
      });
    }

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required',
        code: 'MISSING_FILE_PATH'
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `File not found: ${filePath}`,
        code: 'FILE_NOT_FOUND'
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 Starting Analysis for Project: ${projectId}`);
    console.log(`📁 File: ${filePath}`);
    console.log(`${'='.repeat(60)}\n`);

    // Determine if file is ZIP
    const isZip = filePath.toLowerCase().endsWith('.zip');
    const isHtml = filePath.toLowerCase().endsWith('.html');

    if (!isZip && !isHtml) {
      return res.status(400).json({
        success: false,
        error: 'File must be HTML or ZIP',
        code: 'INVALID_FILE_TYPE',
        receivedType: path.extname(filePath)
      });
    }

    // Analyze project
    const analysis = await analyzeProject(filePath, isZip);

    if (!analysis.success) {
      return res.status(500).json({
        success: false,
        error: analysis.error,
        details: process.env.NODE_ENV === 'development' ? analysis.details : undefined,
        code: 'ANALYSIS_FAILED'
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Analysis Complete!`);
    console.log(`${'='.repeat(60)}\n`);

    res.json({
      success: true,
      projectId,
      data: analysis
    });
  } catch (error) {
    console.error(`\n❌ Unexpected error: ${error.message}`);
    console.error(error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
