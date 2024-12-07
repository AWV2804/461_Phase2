// src/frontend/src/components/Cost.tsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext.js';
import './Styling/Cost.css';

/**
 * Cost component allows users to calculate the cost of a package, optionally including its dependencies.
 * 
 * @component
 * 
 * @example
 * return (
 *   <Cost />
 * )
 * 
 * @returns {JSX.Element} The rendered Cost component.
 * 
 * @remarks
 * This component uses the `AuthContext` to retrieve the authorization token and makes a GET request to the backend
 * to fetch the cost information. It handles loading state, error state, and displays the result in a table format.
 * 
 * @hook
 * - `useContext(AuthContext)` to get the authorization token.
 * - `useState` to manage package ID, include dependencies flag, cost result, loading state, and error state.
 * 
 * @function handleCalculate
 * Initiates the cost calculation by making a GET request to the backend.
 * 
 * @function constructBackendUrl
 * Constructs the backend URL for the cost calculation request.
 * 
 * @param {string} path - The path to append to the backend URL.
 * 
 * @returns {string} The constructed backend URL.
 * 
 * @throws Will set an error state if the fetch request fails.
 */
const Cost: React.FC = () => {
  const { x_authorization } = useContext(AuthContext);
  const [packageId, setPackageId] = useState('');
  const [includeDependencies, setIncludeDependencies] = useState(false);
  const [costResult, setCostResult] = useState<{ [key: string]: { standaloneCost?: number; totalCost: number } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setCostResult(null);
    
  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  const costUrl = constructBackendUrl(`/package/${encodeURIComponent(packageId)}/cost?dependency=${includeDependencies}`);
    try {
      const response = await fetch(costUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-authorization': x_authorization || '',
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        setCostResult(data);
      } else {
        const errorText = await response.text();
        setError(errorText || 'Failed to retrieve cost.');
      }
    } catch (err) {
      console.error('Error fetching cost:', err);
      setError('An error occurred while fetching the cost.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cost-container">
      <h2>Calculate Cost of a Package</h2>
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
      <div className="form-group">
        <label>
          Include Dependencies:
          <input
            type="checkbox"
            checked={includeDependencies}
            onChange={(e) => setIncludeDependencies(e.target.checked)}
          />
        </label>
      </div>
      <button onClick={handleCalculate} disabled={!packageId || loading}>
        {loading ? 'Calculating...' : 'Calculate Cost'}
      </button>
      {error && <div className="error-message">{error}</div>}
      {costResult && (
        <div className="result-container">
          <h3>Cost Result:</h3>
          <table>
            <thead>
              <tr>
                <th>Package ID</th>
                <th>Standalone Cost</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(costResult).map(([id, costs]) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>{costs.standaloneCost !== undefined ? costs.standaloneCost : 'N/A'}</td>
                  <td>{costs.totalCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Cost;