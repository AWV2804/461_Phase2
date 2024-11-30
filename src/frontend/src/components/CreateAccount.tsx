// src/frontend/src/components/CreateAccount.tsx
import React, { useState } from 'react';
import SHA256 from 'crypto-js/sha256.js';
import './Styling/Login.css';
import { useNavigate } from 'react-router-dom';


const CreateAccount: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

    // Dynamically construct the backend URL based on the current host
    const constructBackendUrl = (path: string): string => {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
      };

    // Handle the create account action
    const handleCreateAccount = async () => {
    //const hashedPassword = hashPassword(password);
    try {
      const backendUrl = constructBackendUrl('/create-account');

      const response = await fetch(backendUrl, { // Adjust the URL based on your backend setup
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          isAdmin,
        }),
      });
      
      const data = await response.json();
      
      if (response.status === 201) {
        alert(`Account created successfully for user: ${username} with admin: ${isAdmin}!`);
        // Reset fields
        setUsername('');
        setPassword('');
        setIsAdmin(false);
        navigate('/'); // Redirect to Home or another page upon successful login
      } else {
        alert(data.error || 'Failed to create account.');
      }
    } catch (err) {
      console.error('Error creating account:', err);
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
        <label>
            Admin:
            <input
            type="checkbox"
            style={{ marginLeft: '10px' }}
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            />
        </label>
        <button type="button" onClick={handleCreateAccount}>
          Create Account
        </button>
      </form>
    </div>
  );
};

export default CreateAccount;