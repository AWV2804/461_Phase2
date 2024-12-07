// src/frontend/src/components/Rate.tsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext.js';
import './Styling/Rate.css';

/**
 * Rate component allows users to rate a package by providing a package ID.
 * It fetches the rating data from the backend and displays the result.
 *
 * @component
 * @example
 * return (
 *   <Rate />
 * )
 *
 * @returns {JSX.Element} The Rate component.
 *
 * @remarks
 * This component uses the `AuthContext` to get the authorization token.
 * It constructs the backend URL using the current window location and a specified backend port.
 * The rating data is fetched from the backend using a GET request.
 *
 * @function
 * @name Rate
 *
 * @typedef {Object} RatingResult
 * @property {string} metric - The name of the metric.
 * @property {number} score - The score of the metric.
 * @property {number} latency - The latency of the metric.
 *
 * @state {string} packageId - The ID of the package to be rated.
 * @state {RatingResult | null} ratingResult - The result of the rating fetch.
 * @state {boolean} loading - Indicates if the rating fetch is in progress.
 * @state {string | null} error - The error message if the rating fetch fails.
 *
 * @function
 * @name constructBackendUrl
 * @description Constructs the backend URL using the current window location and a specified backend port.
 * @param {string} path - The path to be appended to the backend URL.
 * @returns {string} The constructed backend URL.
 *
 * @function
 * @name handleRate
 * @description Handles the rating fetch process. Sets loading state, fetches the rating data, and updates the state with the result or error.
 * @returns {Promise<void>} A promise that resolves when the rating fetch is complete.
 */
const Rate: React.FC = () => {
  const { x_authorization } = useContext(AuthContext);
  const [packageId, setPackageId] = useState('');
  const [ratingResult, setRatingResult] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  const rateUrl = constructBackendUrl(`/package/${encodeURIComponent(packageId)}/rate`);
  const handleRate = async () => {
    setLoading(true);
    setError(null);
    setRatingResult(null);

    try {
      const response = await fetch(rateUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-authorization': x_authorization || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRatingResult(data);
      } else {
        const errorText = await response.text();
        setError(errorText || 'Failed to retrieve rating.');
      }
    } catch (err) {
      console.error('Error fetching rating:', err);
      setError('An error occurred while fetching the rating.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rate-container">
      <h2>Rate a Package</h2>
      <div className="form-group">
        <label>
          Package ID:
          <input
            type="text"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            placeholder="Enter Package ID"
          />
        </label>
      </div>
      <button onClick={handleRate} disabled={!packageId || loading}>
        {loading ? 'Rating...' : 'Get Rating'}
      </button>
      {error && <div className="error-message">{error}</div>}
      {ratingResult && (
        <div className="result-container">
          <h3>Package Rating:</h3>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Score</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ratingResult).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{typeof value === 'object' && value !== null ? value.score : value}</td>
                  <td>{typeof value === 'object' && value !== null ? value.latency : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Rate;