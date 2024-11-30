// src/frontend/src/components/Reset.tsx
import React, { useContext } from 'react';
import { AuthContext } from '../AuthContext.js';
import './Styling/Reset.css';

const Reset: React.FC = () => {
  const { x_authorization } = useContext(AuthContext);
  console.log(x_authorization);

  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  const handleReset = async () => {
    if (!x_authorization) {
      alert('Authorization token is missing.');
      return;
    }

    const confirmation = window.confirm('Are you sure you want to reset the registry?');
    if (!confirmation) {
      return;
    }

    try {
      const response = await fetch(constructBackendUrl('/reset'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': x_authorization,
        },
      });

      if (response.ok) {
        const result = await response.text();
        alert(result);
      } else {
        const errorData = await response.text();
        alert(`Error: ${errorData}`);
      }
    } catch (error) {
      console.error('Error resetting registry:', error);
      alert('Error resetting registry.');
    }
  };

  return (
    <div className="reset-container">
      <h2>Reset Registry</h2>
      <button className="reset-button" onClick={handleReset}>Reset</button>
    </div>
  );
};

export default Reset;