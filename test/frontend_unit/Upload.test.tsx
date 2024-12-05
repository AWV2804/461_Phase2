// src/frontend/src/components/Upload.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import Upload from '../../src/frontend/src/components/Upload';

describe('Upload Component', () => {
    const renderComponent = () => {
        render(
            <AuthContext.Provider
                value={{
                    isLoggedIn: true,
                    isAdmin: false,
                    username: 'testuser',
                    userGroup: '',
                    logout: vi.fn(),
                    login: vi.fn(),
                    x_authorization: 'test-token',
                }}
            >
                <Upload />
            </AuthContext.Provider>
        );
    };

    test('renders Upload component without crashing', () => {
        renderComponent();
        expect(screen.getByText(/Upload or Ingest a New Package/i)).toBeInTheDocument();
    });

    test('displays response message when available', () => {
        render(
            <AuthContext.Provider
                value={{
                    isLoggedIn: true,
                    isAdmin: false,
                    username: 'testuser',
                    userGroup: '',
                    logout: vi.fn(),
                    login: vi.fn(),
                    x_authorization: 'test-token',
                }}
            >
                <Upload />
            </AuthContext.Provider>
        );
    });
});