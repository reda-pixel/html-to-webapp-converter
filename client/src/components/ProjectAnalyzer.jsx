import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProjectAnalyzer.css';

function ProjectAnalyzer({ projectId, fileInfo, onAnalysisComplete }) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    analyzeProject();
  }, [projectId]);

  const analyzeProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/analyze', {
        projectId,
        filePath: fileInfo.path
      });
      setAnalysis(response.data);
      setTimeout(() => onAnalysisComplete(response.data), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ في التحليل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="project-analyzer">
      <h2>تحليل المشروع</h2>
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>جاري تحليل ملفات المشروع...</p>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
      {analysis && (
        <div className="analysis-result">
          <p>تم التحليل بنجاح ✓</p>
          <p>المشروع جاهز للبناء</p>
        </div>
      )}
    </div>
  );
}

export default ProjectAnalyzer;
