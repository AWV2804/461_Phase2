// src/frontend/src/components/Update.tsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext.js';
import './Styling/Update.css';

/**
 * Update component allows users to update a package by providing metadata and data.
 * It uses the AuthContext to get the authorization token and sends a POST request to the backend.
 * 
 * @component
 * @example
 * return (
 *   <Update />
 * )
 * 
 * @returns {JSX.Element} The rendered component.
 * 
 * @remarks
 * The component maintains the state for metadata, data, and response message.
 * It validates the input to ensure either 'Content' or 'URL' is set, but not both.
 * 
 * @function constructBackendUrl
 * Constructs the backend URL using the current window location and environment variable for the backend port.
 * 
 * @function handleSubmit
 * Handles the form submission, validates the input, and sends a POST request to update the package.
 * 
 * @param {React.FormEvent} e - The form submission event.
 * 
 * @throws Will alert if the authorization token is missing or if both 'Content' and 'URL' are set or both are empty.
 * 
 * @async
 * @returns {Promise<void>} A promise that resolves when the form submission is handled.
 */
const Update: React.FC = () => {
  const { x_authorization } = useContext(AuthContext);
  const [metadata, setMetadata] = useState({ Name: '', Version: '', ID: '' });
  const [data, setData] = useState({ Name: '', Content: '', URL: '', debloat: false, JSProgram: '' });
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

    if ((data.Content && data.URL) || (!data.Content && !data.URL)) {
      alert("Either 'Content' or 'URL' must be set, but not both.");
      return;
    }

    try {
      const response = await fetch(constructBackendUrl(`/package/${metadata.ID}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': x_authorization,
        },
        body: JSON.stringify({ metadata, data }),
      });

      if (response.ok) {
        const result = await response.json();
        setResponseMessage(`Success: ${JSON.stringify(result)}`);
      } else {
        const errorData = await response.json();
        setResponseMessage(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating package:', error);
      setResponseMessage('Error updating package.');
    }
  };

  return (
    <div className="update-container">
      <h2>Update a Package</h2>
      <form className="update-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name:</label>
          <input
            type="text"
            value={metadata.Name}
            onChange={(e) => setMetadata({ ...metadata, Name: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Version:</label>
          <input
            type="text"
            value={metadata.Version}
            onChange={(e) => setMetadata({ ...metadata, Version: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>ID:</label>
          <input
            type="text"
            value={metadata.ID}
            onChange={(e) => setMetadata({ ...metadata, ID: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Content:</label>
          <textarea
            value={data.Content}
            onChange={(e) => setData({ ...data, Content: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>URL:</label>
          <input
            type="url"
            value={data.URL}
            onChange={(e) => setData({ ...data, URL: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Debloat:</label>
          <input
            type="checkbox"
            checked={data.debloat}
            onChange={(e) => setData({ ...data, debloat: e.target.checked })}
          />
        </div>
        <div className="form-group">
          <label>JS Program:</label>
          <textarea
            value={data.JSProgram}
            onChange={(e) => setData({ ...data, JSProgram: e.target.value })}
          />
        </div>
        <button type="submit" className="update-button">Update Package</button>
      </form>
      {responseMessage && <p>{responseMessage}</p>}
    </div>
  );
};

export default Update;