// src/frontend/src/components/Reset.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import Reset from '../../src/frontend/src/components/Reset';

describe('Reset Component', () => {
    const renderComponent = (authValue: any) => {
        render(
            <AuthContext.Provider value={authValue}>
                <Reset />
            </AuthContext.Provider>
        );
    };

    test('renders Reset Registry header and Reset button', () => {
        const authValue = {
            isLoggedIn: true,
            isAdmin: true,
            username: 'testuser',
            userGroup: '',
            logout: vi.fn(),
            login: vi.fn(),
            x_authorization: 'token',
        };

        renderComponent(authValue);

        expect(screen.getByText(/Reset Registry/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });
});