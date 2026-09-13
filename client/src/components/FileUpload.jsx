import React, { useState } from 'react';
import axios from 'axios';
import './FileUpload.css';

function FileUpload({ onUploadComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    const validTypes = ['text/html', 'application/zip', 'application/x-zip-compressed'];
    if (!validTypes.includes(file.type)) {
      setError('يجب أن يكون الملف HTML أو ZIP');
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('حجم الملف يتجاوز الحد الأقصى (50 MB)');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('📤 Uploading file:', file.name);
      
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(progress);
          console.log(`Upload progress: ${progress}%`);
        }
      });

      console.log('✅ File uploaded successfully');
      onUploadComplete(response.data.data);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'خطأ في الرفع';
      console.error('❌ Upload error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
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
          {loading ? `جاري الرفع... ${uploadProgress}%` : 'اختر ملفاً'}
        </label>
      </div>
      
      {loading && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
        </div>
      )}
      
      {error && <div className="error-message">❌ {error}</div>}
      
      <div className="file-info">
        <p>✅ الملفات المدعومة: HTML, ZIP</p>
        <p>✅ الحد الأقصى للحجم: 50 MB</p>
      </div>
    </div>
  );
}

export default FileUpload;