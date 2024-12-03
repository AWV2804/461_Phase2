// src/frontend/src/components/Manage.tsx
import React, { useContext, useState } from 'react';
import { AuthContext } from '../AuthContext.js';
import { useNavigate } from 'react-router-dom';
import './Styling/Manage.css';

const Manage: React.FC = () => {
  const { isAdmin, username, x_authorization, logout } = useContext(AuthContext);
  const [targetUsername, setTargetUsername] = useState('');
  const navigate = useNavigate();

  const constructBackendUrl = (path: string): string => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      isAdmin
        ? `Are you sure you want to delete the account "${targetUsername}"?`
        : 'Are you sure you want to delete your account?'
    );
    if (!confirmDelete) return;

    const deleteUrl = constructBackendUrl('/delete-account');
    const usernameToDelete = isAdmin ? targetUsername : username;
    try {
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': x_authorization || '',
        },
        body: JSON.stringify({
          username: username,
          usernameToDelete: usernameToDelete,
          isAdmin: isAdmin,
        }),
      });
      const data = await response.json();
      if (response.status === 200) {
        alert(data.message || 'Account deleted successfully.');
        if (!isAdmin) {
          logout();
          navigate('/login');
        } else {
          setTargetUsername('');
        }
      } else {
        alert(`Failed to delete user`);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('An error occurred while deleting the account.');
    }
  };

  return (
    <div className="manage-container">
      {isAdmin ? (
        <div className="manage-form">
          <h2>Delete User Account</h2>
          <div className="form-group">
            <label>
              Username to Delete:
              <input
                type="text"
                placeholder="Enter username"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                required
              />
            </label>
          </div>
          <button
            onClick={handleDelete}
            disabled={!targetUsername}
            className="delete-button"
          >
            Delete Account
          </button>
        </div>
      ) : (
        <div className="manage-form">
          <h2>Delete Your Account</h2>
          <button onClick={handleDelete} className="delete-button">
            Delete My Account
          </button>
        </div>
      )}
    </div>
  );
};

export default Manage;