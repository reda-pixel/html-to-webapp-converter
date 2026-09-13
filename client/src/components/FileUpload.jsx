import React, { useState } from 'react';
import axios from 'axios';
import './FileUpload.css';

function FileUpload({ onUploadComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await uploadFile(files[0]);
    }
  };

  const handleChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUploadComplete(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ في الرفع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-upload">
      <div
        className={`upload-area ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <h2>رفع ملف HTML أو ZIP</h2>
        <p>اسحب الملف هنا أو انقر للاختيار</p>
        <input
          type="file"
          accept=".html,.zip"
          onChange={handleChange}
          disabled={loading}
          className="file-input"
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label">
          {loading ? 'جاري الرفع...' : 'اختر ملفًا'}
        </label>
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="file-info">
        <p>✅ الملفات المدعومة: HTML, ZIP</p>
        <p>✅ الحد الأقصى للحجم: 50 MB</p>
      </div>
    </div>
  );
}

export default FileUpload;
