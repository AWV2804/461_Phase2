// src/frontend/src/components/Upload.tsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext.js';
import './Styling/Upload.css';

/**
 * Upload component allows users to upload or ingest a new package by providing
 * necessary details such as name, content, URL, debloat option, and a JavaScript program.
 * 
 * @component
 * @example
 * return (
 *   <Upload />
 * )
 * 
 * @returns {JSX.Element} The rendered Upload component.
 * 
 * @remarks
 * - The component uses `AuthContext` to get the authorization token.
 * - Either 'Content' or 'URL' must be set, but not both.
 * - The backend URL is constructed using the current window location and an environment variable for the port.
 * 
 * @function
 * @name Upload
 * 
 * @hook
 * @name useContext
 * @description Retrieves the authorization token from `AuthContext`.
 * 
 * @hook
 * @name useState
 * @description Manages the state for name, content, URL, debloat option, JavaScript program, and response message.
 * 
 * @param {React.FormEvent} e - The form submission event.
 * 
 * @throws Will throw an error if the fetch request fails.
 * 
 * @returns {Promise<void>} A promise that resolves when the form submission is handled.
 */
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