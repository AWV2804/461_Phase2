// Update.test.tsx

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { vi, describe, test, expect } from 'vitest';
import Update from '../../src/frontend/src/components/Update';
import { AuthContext } from '../../src/frontend/src/AuthContext';

const renderComponent = () => {
    return render(
        <AuthContext.Provider
            value={{
                isLoggedIn: true,
                isAdmin: true,
                username: 'testUser',
                userGroup: '',
                logout: vi.fn(),
                login: vi.fn(),
                x_authorization: 'token',
            }}
        >
            <Router>
                <Update />
            </Router>
        </AuthContext.Provider>
    );
};

describe('Update Component', () => {
    test('renders Update a Package heading', () => {
        renderComponent();
        expect(screen.getByText(/Update a Package/i)).toBeInTheDocument();
    });

    test('renders Update Package button', () => {
        renderComponent();
        expect(screen.getByRole('button', { name: /Update Package/i })).toBeInTheDocument();
    });

    test('does not display response message initially', () => {
        renderComponent();
        expect(screen.queryByText(/Success:/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Error:/i)).not.toBeInTheDocument();
    });
});