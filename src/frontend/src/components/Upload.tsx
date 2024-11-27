// src/frontend/src/components/Upload.tsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext';
import './Styling/Upload.css';

const Upload: React.FC = () => {
  const { x_authorization } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [debloat, setDebloat] = useState(false);
  const [jsProgram, setJsProgram] = useState('');
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!x_authorization) {
      alert('Authorization token is missing.');
      return;
    }

    if ((content && url) || (!content && !url)) {
      alert("Either 'Content' or 'URL' must be set, but not both.");
      return;
    }

    const requestBody = {
      Name: name,
      Content: content || undefined,
      URL: url || undefined,
      debloat,
      JSProgram: jsProgram,
    };

    try {
      const response = await fetch(constructBackendUrl('/package'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': x_authorization,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        setResponseMessage(`Success: ${JSON.stringify(result)}`);
      } else {
        const errorData = await response.json();
        setResponseMessage(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error uploading package:', error);
      setResponseMessage('Error uploading package.');
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload or Ingest a New Package</h2>
      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Content:</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>URL:</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Debloat:</label>
          <input
            type="checkbox"
            checked={debloat}
            onChange={(e) => setDebloat(e.target.checked)}
          />
        </div>
        <div className="form-group">
          <label>JS Program:</label>
          <textarea
            value={jsProgram}
            onChange={(e) => setJsProgram(e.target.value)}
          />
        </div>
        <button type="submit" className="upload-button">Upload</button>
      </form>
      {responseMessage && <p>{responseMessage}</p>}
    </div>
  );
};

export default Upload;