import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProjectAnalyzer.css';

function ProjectAnalyzer({ projectId, filePath, onAnalysisComplete, onError }) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [analysisLog, setAnalysisLog] = useState([]);

  useEffect(() => {
    analyzeProject();
  }, [projectId, filePath]);

  const analyzeProject = async () => {
    setLoading(true);
    setError(null);
    setAnalysisLog([]);
    
    try {
      console.log('🔍 Starting project analysis...');
      addLog('🔍 جاري تحليل المشروع...');
      
      const response = await axios.post('/api/analyze', {
        projectId,
        filePath
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'فشل التحليل');
      }

      console.log('✅ Analysis successful:', response.data.data);
      addLog('✅ تم التحليل بنجاح!');
      
      setAnalysis(response.data.data);
      
      setTimeout(() => {
        onAnalysisComplete(response.data.data);
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'خطأ في التحليل';
      console.error('❌ Analysis error:', errorMsg);
      addLog(`❌ خطأ: ${errorMsg}`);
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message) => {
    setAnalysisLog(prev => [...prev, message]);
  };

  return (
    <div className="project-analyzer">
      <h2>📊 تحليل المشروع</h2>
      
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>جاري تحليل ملفات المشروع...</p>
        </div>
      )}

      {analysisLog.length > 0 && (
        <div className="analysis-log">
          <h3>سجل التحليل:</h3>
          <div className="log-content">
            {analysisLog.map((log, i) => (
              <div key={i} className="log-line">{log}</div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
          <button onClick={analyzeProject} className="retry-btn">إعادة محاولة</button>
        </div>
      )}

      {analysis && !loading && (
        <div className="analysis-result">
          <div className="result-grid">
            <div className="result-card">
              <h4>🎯 نوع المشروع</h4>
              <p>{analysis.projectInfo.framework}</p>
            </div>
            <div className="result-card">
              <h4>🔧 أداة البناء</h4>
              <p>{analysis.projectInfo.buildTool}</p>
            </div>
            <div className="result-card">
              <h4>📦 مدير الحزم</h4>
              <p>{analysis.projectInfo.packageManager}</p>
            </div>
            <div className="result-card">
              <h4>📁 إجمالي الملفات</h4>
              <p>{analysis.fileStructure.totalFiles}</p>
            </div>
          </div>

          {analysis.buildConfig.command && (
            <div className="build-command">
              <h4>⚙️ أمر البناء:</h4>
              <code>{analysis.buildConfig.command}</code>
            </div>
          )}

          {analysis.buildConfig.dependencies && (
            <div className="dependencies-info">
              <h4>📚 المكتبات:</h4>
              <p>Dependencies: {analysis.buildConfig.dependencies.count}</p>
              <p>Dev Dependencies: {analysis.buildConfig.dependencies.devCount}</p>
            </div>
          )}

          <p className="analysis-complete">✅ تم التحليل بنجاح - الانتقال للبناء...</p>
        </div>
      )}
    </div>
  );
}

export default ProjectAnalyzer;