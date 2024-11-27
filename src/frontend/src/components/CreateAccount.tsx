// src/frontend/src/components/CreateAccount.tsx
import React, { useState } from 'react';
import SHA256 from 'crypto-js/sha256';
import './Styling/CreateAccount.css';
import { useNavigate } from 'react-router-dom';

const CreateAccount: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [addUserGroup, setAddUserGroup] = useState(false);
  const [userGroup, setUserGroup] = useState('');
  const navigate = useNavigate();

  // Dynamically construct the backend URL based on the current host
  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  // Handle the create account action
  const handleCreateAccount = async () => {
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const backendUrl = constructBackendUrl('/create-account');

      const requestBody = {
        username,
        password: SHA256(password).toString(),
        isAdmin,
        ...(addUserGroup && { userGroup }),
      };

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.status === 201) {
        alert(`Account created successfully for user: ${username} with admin: ${isAdmin}!`);
        // Reset fields
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setIsAdmin(false);
        setAddUserGroup(false);
        setUserGroup('');
        navigate('/'); // Redirect to Home or another page upon successful account creation
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
        <label className="form-label">
          Username:
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="form-input"
          />
        </label>
        <label className="form-label">
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
          />
        </label>
        <label className="form-label">
          Confirm Password:
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input"
          />
        </label>
        {addUserGroup && (
          <label className="form-label">
            Group:
            <input
              type="text"
              value={userGroup}
              onChange={(e) => setUserGroup(e.target.value)}
              className="form-input"
            />
          </label>
        )}
        <div className="checkbox-container">
          <label className="checkbox-label">
            Admin:
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="checkbox-input"
            />
          </label>
          <label className="checkbox-label">
            Add user to a group:
            <input
              type="checkbox"
              checked={addUserGroup}
              onChange={(e) => setAddUserGroup(e.target.checked)}
              className="checkbox-input"
            />
          </label>
        </div>
        <button type="button" onClick={handleCreateAccount} className="submit-button">
          Create Account
        </button>
      </form>
    </div>
  );
};

export default CreateAccount;