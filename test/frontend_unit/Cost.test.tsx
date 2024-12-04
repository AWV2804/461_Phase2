// test/frontend_unit/Cost.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Cost from '../../src/frontend/src/components/Cost';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom'; // Import this to extend matchers

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Cost Component', () => {
    const mockAuthContext = {
        x_authorization: 'test-token',
        isLoggedIn: true,
        isAdmin: false,
        username: 'test-user',
        userGroup: 'test-group',
        login: vi.fn(),
        logout: vi.fn(),
    };

    beforeEach(() => {
        mockFetch.mockClear();
    });

    test('renders Cost component', () => {
        render(
            <AuthContext.Provider value={mockAuthContext}>
                <Cost />
            </AuthContext.Provider>
        );

        expect(screen.getByText('Calculate Cost of a Package')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter Package ID')).toBeInTheDocument();
        expect(screen.getByText('Include Dependencies:')).toBeInTheDocument();
        expect(screen.getByText('Calculate Cost')).toBeInTheDocument();
    });
});