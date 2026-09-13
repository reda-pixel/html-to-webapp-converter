import React, { useState } from 'react';
import axios from 'axios';
import './BuildPanel.css';

function BuildPanel({ projectId, analysisData, onBuildComplete, onError }) {
  const [loading, setLoading] = useState(false);
  const [buildLog, setBuildLog] = useState([]);
  const [error, setError] = useState(null);
  const [buildStatus, setBuildStatus] = useState(null);
  const [buildData, setBuildData] = useState(null);

  const handleBuild = async () => {
    setLoading(true);
    setError(null);
    setBuildLog([]);
    setBuildStatus('building');
    addLog('🔨 جاري بناء المشروع...');

    try {
      console.log('🏗️ Starting build process...');
      console.log('Analysis data:', analysisData);
      
      addLog(`📌 نوع المشروع: ${analysisData.projectInfo.framework}`);
      addLog(`🔧 أداة البناء: ${analysisData.projectInfo.buildTool}`);
      addLog(`📦 مدير الحزم: ${analysisData.projectInfo.packageManager}`);
      
      const response = await axios.post('/api/build', {
        projectId,
        analysisData
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'فشل البناء');
      }

      const result = response.data.data;
      console.log('✅ Build successful:', result);
      
      if (result.buildLog && Array.isArray(result.buildLog)) {
        result.buildLog.forEach(line => addLog(line));
      }

      addLog('✅ تم البناء بنجاح!');
      addLog(`📁 مجلد Output: ${result.outputDirectory}`);
      addLog(`📦 ZIP: ${result.zipPath}`);
      
      setBuildData(result);
      setBuildStatus('success');
      
      setTimeout(() => {
        onBuildComplete(result);
      }, 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'خطأ في البناء';
      console.error('❌ Build error:', errorMsg);
      addLog(`❌ خطأ في البناء: ${errorMsg}`);
      
      if (err.response?.data?.buildLog) {
        err.response.data.buildLog.forEach(line => addLog(line));
      }
      
      setError(errorMsg);
      setBuildStatus('failed');
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message) => {
    setBuildLog(prev => [...prev, message]);
    console.log(`📝 ${message}`);
  };

  return (
    <div className="build-panel">
      <h2>🔨 بناء المشروع</h2>
      
      <button
        className="build-button"
        onClick={handleBuild}
        disabled={loading}
      >
        {loading ? '⏳ جاري البناء...' : '🚀 ابدأ البناء'}
      </button>

      {buildLog.length > 0 && (
        <div className="build-log">
          <h3>سجل البناء (Build Log):</h3>
          <div className="log-content">
            {buildLog.map((line, i) => (
              <div key={i} className="log-line">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {buildStatus === 'success' && buildData && (
        <div className="success-message">
          ✅ تم البناء بنجاح!
          <div className="build-summary">
            <p><strong>مجلد Output:</strong> {buildData.outputDirectory}</p>
            <p><strong>ملفات:</strong> {buildData.outputVerification.files.length}</p>
            <p><strong>يحتوي على HTML:</strong> {buildData.outputVerification.hasIndexHtml ? '✅ نعم' : '❌ لا'}</p>
            <p><strong>يحتوي على Assets:</strong> {buildData.outputVerification.hasAssets ? '✅ نعم' : '❌ لا'}</p>
          </div>
          <p className="next-step">الانتقال لمرحلة النشر...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
          <button onClick={handleBuild} className="retry-btn">إعادة محاولة</button>
        </div>
      )}
    </div>
  );
}

export default BuildPanel;