import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import ProjectAnalyzer from './components/ProjectAnalyzer';
import BuildPanel from './components/BuildPanel';
import DeployPanel from './components/DeployPanel';

function App() {
  const [projectId, setProjectId] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [currentStep, setCurrentStep] = useState('upload');
  const [projectData, setProjectData] = useState(null);

  const handleFileUploaded = (data) => {
    setProjectId(data.projectId);
    setFileInfo(data);
    setCurrentStep('analyze');
  };

  const handleProjectAnalyzed = (data) => {
    setProjectData(data);
    setCurrentStep('build');
  };

  const handleBuildComplete = (data) => {
    setProjectData(prev => ({ ...prev, buildData: data }));
    setCurrentStep('deploy');
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
          <div className={`step ${currentStep === 'upload' ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">رفع الملف</span>
          </div>
          <div className={`step ${currentStep === 'analyze' ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">تحليل</span>
          </div>
          <div className={`step ${currentStep === 'build' ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">البناء</span>
          </div>
          <div className={`step ${currentStep === 'deploy' ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">النشر</span>
          </div>
        </div>

        <div className="content-wrapper">
          {currentStep === 'upload' && (
            <FileUpload onUploadComplete={handleFileUploaded} />
          )}
          {currentStep === 'analyze' && projectId && (
            <ProjectAnalyzer 
              projectId={projectId} 
              fileInfo={fileInfo}
              onAnalysisComplete={handleProjectAnalyzed}
            />
          )}
          {currentStep === 'build' && projectId && (
            <BuildPanel 
              projectId={projectId}
              projectData={projectData}
              onBuildComplete={handleBuildComplete}
            />
          )}
          {currentStep === 'deploy' && projectId && (
            <DeployPanel 
              projectId={projectId}
              projectData={projectData}
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
