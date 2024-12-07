// src/frontend/src/components/Login.tsx
import React, { useState, useContext } from 'react';
import SHA256 from 'crypto-js/sha256.js';
import { useNavigate } from 'react-router-dom';
import './Styling//Login.css';
import { AuthContext } from '../AuthContext.js'; // Import AuthContext
import { jwtDecode } from 'jwt-decode'; // Correct import statement
import './Styling/Login.css';

interface DecodedToken {
  isAdmin: boolean;
  userGroup: string;
  exp: number;
  usageCount: number;
}

/**
 * Login component for user authentication.
 * 
 * This component renders a login form that allows users to enter their username and password.
 * Upon submission, it sends a request to the backend to authenticate the user.
 * 
 * @component
 * @returns {JSX.Element} The rendered login component.
 * 
 * @example
 * <Login />
 * 
 * @remarks
 * - Uses `useState` to manage the username and password state.
 * - Uses `useNavigate` from `react-router-dom` for navigation after successful login.
 * - Uses `useContext` to access the `AuthContext` for login functionality.
 * - Constructs the backend URL dynamically based on the current host.
 * - Handles the login action by sending a PUT request to the backend.
 * - Decodes the authentication token to extract user information.
 * - Redirects to the home page upon successful login.
 * - Displays an alert in case of authentication failure or errors.
 * 
 * @function
 * @name constructBackendUrl
 * @param {string} path - The path to append to the backend URL.
 * @returns {string} The constructed backend URL.
 * 
 * @function
 * @name handleLogin
 * @returns {Promise<void>} A promise that resolves when the login action is complete.
 * 
 * @typedef {Object} DecodedToken
 * @property {boolean} isAdmin - Indicates if the user is an admin.
 * @property {string} userGroup - The user group of the authenticated user.
 */
const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext); // Use AuthContext

  // Dynamically construct the backend URL based on the current host
  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  // Handle the login action
  const handleLogin = async () => {
    try {
      const requestBody = JSON.stringify({
        User: {
          name: username,
          isAdmin: false,
        },
        Secret: {
          password: password,
        },
      });
      const backendUrl = constructBackendUrl('/authenticate');
  
      const response = await fetch(backendUrl, { // Explicitly use the full URL
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', 
        },
        body: requestBody,
      });
        
      if (response.status === 200) {
        const authToken = await response.text();

        // Decode the token to extract isAdmin information
        const decodedToken = jwtDecode<DecodedToken>(authToken);
        const isAdmin = decodedToken.isAdmin;
        const userGroup = decodedToken.userGroup;
        
        login(isAdmin, username, authToken, userGroup);
        navigate('/'); // Redirect to Home or another page upon successful login
      } else {
        const errorData = await response.text();
        console.error('Authentication failed:', errorData);
        alert(`Login failed: ${errorData} \nError: ${response.status}`);
      }
    } catch (error) {
      console.error('Error during authentication:', error);
      alert(error);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          Username:
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginLeft: '10px' }}
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginLeft: '13px' }}
          />
        </label>
        <button type="button" onClick={handleLogin}>
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;