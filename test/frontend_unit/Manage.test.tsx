// src/frontend/src/components/Manage.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import Manage from '../../src/frontend/src/components/Manage';
import { BrowserRouter } from 'react-router-dom';

describe('Manage Component', () => {
    const renderComponent = (isAdmin: boolean, username: string) => {
        render(
            <AuthContext.Provider
                value={{
                    isLoggedIn: true,
                    isAdmin: isAdmin,
                    username: username,
                    userGroup: '',
                    logout: vi.fn(),
                    login: vi.fn(),
                    x_authorization: 'token',
                }}
            >
                <BrowserRouter>
                    <Manage />
                </BrowserRouter>
            </AuthContext.Provider>
        );
    };

    test('renders Delete User Account form for admin users', () => {
        renderComponent(true, 'adminUser');
        expect(screen.getByText(/Delete User Account/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Username to Delete:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete Account/i })).toBeInTheDocument();
    });

    test('renders Delete Your Account section for non-admin users', () => {
        renderComponent(false, 'regularUser');
        expect(screen.getByText(/Delete Your Account/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete My Account/i })).toBeInTheDocument();
    });
});