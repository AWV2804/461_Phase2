// src/frontend/src/components/Rate.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import Rate from '../../src/frontend/src/components/Rate';

describe('Rate Component', () => {
    const renderComponent = (x_authorization: string | null) => {
        render(
            <AuthContext.Provider
                value={{
                    isLoggedIn: true,
                    isAdmin: false,
                    username: 'testUser',
                    userGroup: '',
                    logout: vi.fn(),
                    login: vi.fn(),
                    x_authorization: x_authorization,
                }}
            >
                <Rate />
            </AuthContext.Provider>
        );
    };

    test('renders Rate component correctly', () => {
        renderComponent('test-token');
        expect(screen.getByText(/Rate a Package/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Package ID:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Get Rating/i })).toBeInTheDocument();
    });

    test('disables Get Rating button when Package ID is empty', () => {
        renderComponent('test-token');
        const button = screen.getByRole('button', { name: /Get Rating/i });
        expect(button).toBeDisabled();
    });

    test('enables Get Rating button when Package ID is entered', () => {
        renderComponent('test-token');
        const input = screen.getByPlaceholderText(/Enter Package ID/i);
        const button = screen.getByRole('button', { name: /Get Rating/i });
        fireEvent.change(input, { target: { value: '12345' } });
        expect(button).toBeEnabled();
    });
});