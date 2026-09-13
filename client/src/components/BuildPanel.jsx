import React, { useState } from 'react';
import axios from 'axios';
import './BuildPanel.css';

function BuildPanel({ projectId, projectData, onBuildComplete }) {
  const [loading, setLoading] = useState(false);
  const [buildLog, setBuildLog] = useState([]);
  const [error, setError] = useState(null);
  const [buildStatus, setBuildStatus] = useState(null);

  const handleBuild = async () => {
    setLoading(true);
    setError(null);
    setBuildLog([]);
    setBuildStatus('building');

    try {
      const response = await axios.post('/api/build', { projectId });
      setBuildLog(prev => [...prev, response.data.message]);
      setBuildStatus('success');
      setTimeout(() => onBuildComplete(response.data), 1500);
    } catch (err) {
      setBuildStatus('failed');
      setError(err.response?.data?.error || 'حدث خطأ في البناء');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="build-panel">
      <h2>بناء المشروع</h2>
      <button
        className="build-button"
        onClick={handleBuild}
        disabled={loading}
      >
        {loading ? '⏳ جاري البناء...' : '🔨 بدء البناء'}
      </button>

      {buildLog.length > 0 && (
        <div className="build-log">
          <h3>سجل البناء:</h3>
          <pre>
            {buildLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </pre>
        </div>
      )}

      {buildStatus === 'success' && (
        <div className="success-message">✅ تم البناء بنجاح!</div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default BuildPanel;
