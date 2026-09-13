import React, { useState } from 'react';
import axios from 'axios';
import './DeployPanel.css';

function DeployPanel({ projectId, projectData }) {
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deployStatus, setDeployStatus] = useState(null);
  const [deployUrl, setDeployUrl] = useState(null);
  const [showTokenInput, setShowTokenInput] = useState(false);

  const handleDeploy = async () => {
    if (!accessToken) {
      setError('يرجى إدخال Netlify Access Token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/deploy/netlify', {
        projectId,
        accessToken
      });
      setDeployStatus('success');
      setDeployUrl(response.data.deployUrl);
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ في النشر');
      setDeployStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deploy-panel">
      <h2>نشر المشروع</h2>

      <div className="deploy-options">
        <div className="deploy-option">
          <h3>📥 تحميل الملفات</h3>
          <p>قم بتحميل المشروع المبني كملف ZIP</p>
          <button className="deploy-btn secondary-btn">تحميل ZIP</button>
        </div>

        <div className="deploy-option">
          <h3>🚀 نشر إلى Netlify</h3>
          <p>انشر مشروعك مباشرة إلى Netlify</p>
          <button
            className="deploy-btn primary-btn"
            onClick={() => setShowTokenInput(!showTokenInput)}
          >
            نشر الآن
          </button>
        </div>
      </div>

      {showTokenInput && (
        <div className="token-input-section">
          <input
            type="password"
            placeholder="أدخل Netlify Access Token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="token-input"
          />
          <button
            className="deploy-btn primary-btn"
            onClick={handleDeploy}
            disabled={loading}
          >
            {loading ? '⏳ جاري النشر...' : '✓ تأكيد النشر'}
          </button>
          <p className="token-help">
            احصل على التوكن من <a href="https://app.netlify.com/user/applications" target="_blank" rel="noopener noreferrer">Netlify Settings</a>
          </p>
        </div>
      )}

      {deployStatus === 'success' && deployUrl && (
        <div className="success-section">
          <div className="success-message">✅ تم النشر بنجاح!</div>
          <div className="deploy-url">
            <p>رابط موقعك:</p>
            <a href={deployUrl} target="_blank" rel="noopener noreferrer">
              {deployUrl}
            </a>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default DeployPanel;
