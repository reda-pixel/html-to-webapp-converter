import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import ProjectAnalyzer from './components/ProjectAnalyzer';
import BuildPanel from './components/BuildPanel';
import DeployPanel from './components/DeployPanel';

function App() {
  const [projectId, setProjectId] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [buildData, setBuildData] = useState(null);
  const [currentStep, setCurrentStep] = useState('upload');
  const [error, setError] = useState(null);

  const handleFileUploaded = (data) => {
    console.log('✅ File uploaded:', data);
    setProjectId(data.projectId);
    setUploadedFile(data);
    setAnalysisData(null);
    setBuildData(null);
    setError(null);
    setCurrentStep('analyze');
  };

  const handleAnalysisComplete = (data) => {
    console.log('✅ Analysis complete:', data);
    setAnalysisData(data);
    setError(null);
    setCurrentStep('build');
  };

  const handleAnalysisError = (errorMsg) => {
    console.error('❌ Analysis error:', errorMsg);
    setError(errorMsg);
    setCurrentStep('analyze');
  };

  const handleBuildComplete = (data) => {
    console.log('✅ Build complete:', data);
    setBuildData(data);
    setError(null);
    setCurrentStep('deploy');
  };

  const handleBuildError = (errorMsg) => {
    console.error('❌ Build error:', errorMsg);
    setError(errorMsg);
    setCurrentStep('build');
  };

  const resetProject = () => {
    setProjectId(null);
    setUploadedFile(null);
    setAnalysisData(null);
    setBuildData(null);
    setCurrentStep('upload');
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🚀 محول HTML إلى WebApp</h1>
          <p>تحويل ملفات HTML إلى مشاريع ويب كاملة قابلة للتشغيل والبناء والنشر</p>
        </div>
      </header>

      <main className="app-main">
        <div className="steps-indicator">
          <div className={`step ${currentStep === 'upload' ? 'active' : 'completed'}`}>
            <span className="step-number">1</span>
            <span className="step-label">رفع الملف</span>
          </div>
          <div className={`step ${currentStep === 'analyze' ? 'active' : currentStep === 'build' || currentStep === 'deploy' ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">تحليل</span>
          </div>
          <div className={`step ${currentStep === 'build' ? 'active' : currentStep === 'deploy' ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">البناء</span>
          </div>
          <div className={`step ${currentStep === 'deploy' ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">النشر</span>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="close-btn">×</button>
          </div>
        )}

        <div className="content-wrapper">
          {currentStep === 'upload' && (
            <FileUpload onUploadComplete={handleFileUploaded} />
          )}
          
          {currentStep === 'analyze' && projectId && uploadedFile && (
            <ProjectAnalyzer 
              projectId={projectId}
              filePath={uploadedFile.path}
              onAnalysisComplete={handleAnalysisComplete}
              onError={handleAnalysisError}
            />
          )}
          
          {currentStep === 'build' && projectId && analysisData && (
            <BuildPanel 
              projectId={projectId}
              analysisData={analysisData}
              onBuildComplete={handleBuildComplete}
              onError={handleBuildError}
            />
          )}
          
          {currentStep === 'deploy' && projectId && buildData && (
            <DeployPanel 
              projectId={projectId}
              buildData={buildData}
              onReset={resetProject}
            />
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2024 HTML to WebApp Converter | Built with ❤️ by Reda Pixel</p>
      </footer>
    </div>
  );
}

export default App;