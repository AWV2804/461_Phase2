// src/frontend/src/components/Home.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Styling/Home.css';

const Home: React.FC = () => {
  return (
    <div style={{ paddingLeft: '20px' }}>
        <Link to="/search" className='home-link'>
            1. Search for Packages
        </Link>
        <Link to="/upload" className='home-link'>
            2. Upload a Package
        </Link>
        <Link to="/update" className="home-link">
            3. Update a Package
        </Link>
        <Link to="/cost" className="home-link">
            4. Calculate Cost of a Package
        </Link>
        <Link to="/rate" className="home-link">
            5. Check Rating of a Package
        </Link>
        <Link to="/reset" className="home-link">
            6. Reset Registry
        </Link>
        <Link to="/manage" className="home-link">
            7. Manage Accounts
        </Link>
    </div>
  );
};

export default Home;