import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Configuration
// ============================================

const TEST_CONFIG = {
  backendPort: 5000,
  backendUrl: 'http://localhost:5000',
  apiUrl: 'http://localhost:5000/api',
  testProjectPath: path.join(__dirname, 'test-project', 'index.html'),
  timeout: 60000
};

// ============================================
// Utilities
// ============================================

const log = (msg, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString('ar-SA');
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${timestamp}] ${msg}${colors.reset}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const spawnProcess = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, child });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

const killProcess = (child) => {
  return new Promise((resolve) => {
    if (child && child.kill) {
      child.kill('SIGTERM');
      setTimeout(resolve, 1000);
    } else {
      resolve();
    }
  });
};

const checkPortAvailable = async (port) => {
  try {
    await axios.get(`http://localhost:${port}/health`, { timeout: 2000 });
    return true;
  } catch (error) {
    return false;
  }
};

const waitForPort = async (port, maxWait = 30000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await axios.get(`http://localhost:${port}/health`, { timeout: 2000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Port not ready yet
    }
    await sleep(1000);
  }
  return false;
};

// ============================================
// Test Suite
// ============================================

class TestWorkflow {
  constructor() {
    this.results = [];
    this.serverProcess = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async startBackend() {
    log('🚀 شغّل Backend Server...', 'info');
    
    try {
      // Check if port is already in use
      const portAvailable = await checkPortAvailable(TEST_CONFIG.backendPort);
      if (portAvailable) {
        log('✅ Backend already running on port ' + TEST_CONFIG.backendPort, 'success');
        return true;
      }
    } catch (error) {
      // Port not available, start server
    }

    try {
      const result = await spawnProcess('npm', ['run', 'dev:server'], {
        cwd: __dirname,
        stdio: 'pipe'
      });
      
      this.serverProcess = result.child;
      
      // Wait for server to start
      log('⏳ انتظر بدء Server...', 'info');
      const ready = await waitForPort(TEST_CONFIG.backendPort);
      
      if (ready) {
        log('✅ Backend Server جاهز!', 'success');
        return true;
      } else {
        log('❌ فشل بدء Backend Server', 'error');
        return false;
      }
    } catch (error) {
      log(`❌ خطأ في بدء Backend: ${error.message}`, 'error');
      return false;
    }
  }

  async testUpload() {
    log('\n📤 اختبار Upload...', 'info');
    
    try {
      // Verify test file exists
      if (!fs.existsSync(TEST_CONFIG.testProjectPath)) {
        throw new Error(`ملف الاختبار غير موجود: ${TEST_CONFIG.testProjectPath}`);
      }

      const fileStats = fs.statSync(TEST_CONFIG.testProjectPath);
      log(`📁 حجم الملف: ${(fileStats.size / 1024).toFixed(2)} KB`, 'info');

      // Upload file
      const formData = new FormData();
      formData.append('file', fs.createReadStream(TEST_CONFIG.testProjectPath));

      const response = await axios.post(`${TEST_CONFIG.apiUrl}/upload`, formData, {
        headers: formData.getHeaders(),
        timeout: TEST_CONFIG.timeout
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error('Upload API returned error');
      }

      const uploadData = response.data.data;
      this.projectId = uploadData.projectId;
      this.uploadedFilePath = uploadData.path;

      log(`✅ Upload نجح!`, 'success');
      log(`   Project ID: ${this.projectId}`, 'info');
      log(`   File Path: ${this.uploadedFilePath}`, 'info');

      this.recordTest('Upload', true, 'File uploaded successfully');
      return true;
    } catch (error) {
      log(`❌ فشل Upload: ${error.message}`, 'error');
      this.recordTest('Upload', false, error.message);
      return false;
    }
  }

  async testAnalyze() {
    log('\n🔍 اختبار Analyze...', 'info');
    
    try {
      if (!this.projectId || !this.uploadedFilePath) {
        throw new Error('Project ID or file path not available from upload');
      }

      const response = await axios.post(`${TEST_CONFIG.apiUrl}/analyze`, {
        projectId: this.projectId,
        filePath: this.uploadedFilePath
      }, {
        timeout: TEST_CONFIG.timeout
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(response.data.error || 'Analysis failed');
      }

      this.analysisData = response.data.data;

      log(`✅ Analyze نجح!`, 'success');
      log(`   Framework: ${this.analysisData.projectInfo.framework}`, 'info');
      log(`   Build Tool: ${this.analysisData.projectInfo.buildTool}`, 'info');
      log(`   Total Files: ${this.analysisData.fileStructure.totalFiles}`, 'info');
      log(`   HTML Files: ${this.analysisData.fileStructure.byType.html.length}`, 'info');
      log(`   CSS Files: ${this.analysisData.fileStructure.byType.css.length}`, 'info');
      log(`   JS Files: ${this.analysisData.fileStructure.byType.js.length}`, 'info');

      this.recordTest('Analyze', true, `Detected ${this.analysisData.projectInfo.framework}`);
      return true;
    } catch (error) {
      log(`❌ فشل Analyze: ${error.message}`, 'error');
      this.recordTest('Analyze', false, error.message);
      return false;
    }
  }

  async testBuild() {
    log('\n🔨 اختبار Build...', 'info');
    
    try {
      if (!this.projectId || !this.analysisData) {
        throw new Error('Analysis data not available');
      }

      log('⏳ جاري البناء (قد يستغرق بعض الوقت)...', 'info');

      const response = await axios.post(`${TEST_CONFIG.apiUrl}/build`, {
        projectId: this.projectId,
        analysisData: this.analysisData
      }, {
        timeout: 120000 // 2 minutes for build
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(response.data.error || 'Build failed');
      }

      this.buildData = response.data.data;

      log(`✅ Build نجح!`, 'success');
      log(`   Output Directory: ${this.buildData.outputDirectory}`, 'info');
      log(`   Total Files: ${this.buildData.outputVerification.files.length}`, 'info');
      log(`   Has HTML: ${this.buildData.outputVerification.hasIndexHtml ? '✅' : '❌'}`, 'info');
      log(`   Has Assets: ${this.buildData.outputVerification.hasAssets ? '✅' : '❌'}`, 'info');
      log(`   ZIP Path: ${this.buildData.zipPath}`, 'info');

      this.recordTest('Build', true, 'Build completed successfully');
      return true;
    } catch (error) {
      log(`❌ فشل Build: ${error.message}`, 'error');
      this.recordTest('Build', false, error.message);
      return false;
    }
  }

  async verifyOutput() {
    log('\n✔️ التحقق من Output...', 'info');
    
    try {
      if (!this.buildData || !this.buildData.outputDirectory) {
        throw new Error('Build data not available');
      }

      const outputDir = this.buildData.outputDirectory;

      if (!fs.existsSync(outputDir)) {
        throw new Error(`Output directory does not exist: ${outputDir}`);
      }

      log(`📁 Output Directory: ${outputDir}`, 'info');

      // Check for required files
      const requiredFiles = ['index.html', 'styles.css', 'script.js'];
      const missingFiles = [];
      const foundFiles = [];

      for (const file of requiredFiles) {
        const filePath = path.join(outputDir, file);
        if (fs.existsSync(filePath)) {
          const fileSize = fs.statSync(filePath).size;
          foundFiles.push(file);
          log(`   ✅ ${file} (${fileSize} bytes)`, 'success');
        } else {
          missingFiles.push(file);
          log(`   ❌ ${file} - NOT FOUND`, 'error');
        }
      }

      if (missingFiles.length > 0) {
        throw new Error(`Missing files: ${missingFiles.join(', ')}`);
      }

      // List all files in output
      const allFiles = fs.readdirSync(outputDir);
      log(`\n📋 جميع الملفات في Output (${allFiles.length}):`, 'info');
      allFiles.forEach(file => {
        const filePath = path.join(outputDir, file);
        const isDir = fs.statSync(filePath).isDirectory();
        log(`   ${isDir ? '📁' : '📄'} ${file}`, 'info');
      });

      this.recordTest('Verify Output', true, `All required files found: ${foundFiles.join(', ')}`);
      return true;
    } catch (error) {
      log(`❌ فشل التحقق: ${error.message}`, 'error');
      this.recordTest('Verify Output', false, error.message);
      return false;
    }
  }

  recordTest(name, passed, message) {
    this.testResults.tests.push({
      name,
      passed,
      message
    });
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  async stopBackend() {
    if (this.serverProcess) {
      log('\n🛑 إيقاف Backend Server...', 'info');
      await killProcess(this.serverProcess);
      log('✅ Backend Server توقف', 'success');
    }
  }

  printResults() {
    log('\n' + '='.repeat(70), 'info');
    log('📊 نتائج الاختبار', 'info');
    log('='.repeat(70), 'info');

    this.testResults.tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      log(`${status} | ${test.name}: ${test.message}`, test.passed ? 'success' : 'error');
    });

    log('\n' + '='.repeat(70), 'info');
    log(`📈 النتيجة النهائية: ${this.testResults.passed}/${this.testResults.tests.length} نجح`, 
        this.testResults.failed === 0 ? 'success' : 'warning');
    log('='.repeat(70), 'info');

    if (this.testResults.failed === 0) {
      log('\n🎉 جميع الاختبارات نجحت!', 'success');
      return 0;
    } else {
      log(`\n⚠️  ${this.testResults.failed} اختبار فشل`, 'error');
      return 1;
    }
  }

  async run() {
    log('\n' + '='.repeat(70), 'info');
    log('🧪 بدء اختبار التدفق الكامل (Upload → Analyze → Build)', 'info');
    log('='.repeat(70), 'info');

    try {
      // Start Backend
      const backendStarted = await this.startBackend();
      if (!backendStarted) {
        log('❌ فشل بدء Backend - إيقاف الاختبار', 'error');
        return 1;
      }

      // Wait a bit for server to fully initialize
      await sleep(2000);

      // Run tests
      const uploadSuccess = await this.testUpload();
      if (!uploadSuccess) {
        log('❌ Upload فشل - إيقاف الاختبار', 'error');
        await this.stopBackend();
        return this.printResults();
      }

      const analyzeSuccess = await this.testAnalyze();
      if (!analyzeSuccess) {
        log('❌ Analyze فشل - إيقاف الاختبار', 'error');
        await this.stopBackend();
        return this.printResults();
      }

      const buildSuccess = await this.testBuild();
      if (!buildSuccess) {
        log('❌ Build فشل - إيقاف الاختبار', 'error');
        await this.stopBackend();
        return this.printResults();
      }

      const verifySuccess = await this.verifyOutput();

      // Stop Backend
      await this.stopBackend();

      // Print results
      return this.printResults();
    } catch (error) {
      log(`\n❌ خطأ في الاختبار: ${error.message}`, 'error');
      await this.stopBackend();
      return 1;
    }
  }
}

// ============================================
// Run Test Suite
// ============================================

const tester = new TestWorkflow();
tester.run().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  log(`❌ خطأ غير متوقع: ${error.message}`, 'error');
  process.exit(1);
});
