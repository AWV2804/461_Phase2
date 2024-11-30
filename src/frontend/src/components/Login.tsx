// src/frontend/src/components/Login.tsx
import React, { useState, useContext } from 'react';
import SHA256 from 'crypto-js/sha256.js';
import { useNavigate } from 'react-router-dom';
import './Styling//Login.css';
import { AuthContext } from '../AuthContext.js'; // Import AuthContext

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const isAdminHash = `\"bearer ${SHA256('isAdmin=1').toString()}\"`;
  const isNotAdminHash = `\"bearer ${SHA256('isAdmin=0').toString()}\"`;
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
      console.log("BackendURL: ", backendUrl);
      console.log('Request Body:', requestBody); // Log the request body
  
      const response = await fetch(backendUrl, { // Explicitly use the full URL
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', 
        },
        body: requestBody,
      });
  
      console.log(username, password);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log('Authentication successful:', data.authToken);
        if (data.authToken === `${isAdminHash}`) {
          login(true, username, data.authToken);
          navigate('/'); // Redirect to Home or another page upon successful login
        } else if (data.authToken === `${isNotAdminHash}`) {
          login(false, username, data.authToken);
          navigate('/'); // Redirect to Home or another page upon successful login
        } else {
          alert('Hash return invalid');
        }
        
      } else {
        const errorData = await response.json();
        console.error('Authentication failed:', errorData.error);
        alert(`Login failed: ${errorData.error}`);
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
        <div style={{ margin: '10px 0' }}></div>
        {/* <button type="button" onClick={handleMakeAccount}>
          Make an account
        </button> */}
      </form>
    </div>
  );
};

export default Login;