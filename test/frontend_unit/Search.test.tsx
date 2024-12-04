// src/frontend/src/components/Search.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Search from '../../src/frontend/src/components/Search';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import { vi } from 'vitest';

describe('Search Component', () => {
    const renderComponent = () => {
        render(
            <AuthContext.Provider value={{ 
                x_authorization: 'test-token', 
                isLoggedIn: true, 
                isAdmin: false, 
                username: 'test-user', 
                userGroup: 'test-group',
                login: vi.fn(),
                logout: vi.fn(),
            }}>
                <Search />
            </AuthContext.Provider>
        );
    };

    test('renders Search Packages heading', () => {
        renderComponent();
        expect(screen.getByText(/Search Packages/i)).toBeInTheDocument();
    });

    test('renders search form elements', () => {
        renderComponent();
        expect(screen.getByLabelText(/Package Name or Regex:/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Use Regular Expression/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument();
    });

    test('renders without crashing', () => {
        renderComponent();
        expect(screen.getByText(/Search Packages/i)).toBeInTheDocument();
    });
});