import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../../src/frontend/src/App';
import { AuthContext } from '../../src/frontend/src/AuthContext';
import { describe, test, expect, vi } from 'vitest';

describe('App Component', () => {
    const renderWithRouter = (
        ui: React.ReactElement,
        { route = '/' } = {}
    ) => {
        window.history.pushState({}, 'Test page', route);
        return render(ui, { wrapper: MemoryRouter });
    };

    test('renders Home link', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>
        );
        expect(screen.getByText(/Home/i)).toBeInTheDocument();
    });

    test('renders Login link when not logged in', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>
        );
        expect(screen.getByText(/Login/i)).toBeInTheDocument();
    });

    test('renders Logout button and username when logged in', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>
        );
        
    });

    test('renders Create Account link for admin', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>
        );
    });

    test('does not render Create Account link for non-admin', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>
        );
        expect(screen.queryByText(/Create Account/i)).not.toBeInTheDocument();
    });

    test('navigates to Login page when Login link is clicked', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>
        );
        const loginLink = screen.getByText(/Login/i);
        fireEvent.click(loginLink);
    });

    test('renders protected Upload route for admin users', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>,
            { route: '/upload' }
        );
        expect(screen.getByText(/Upload/i)).toBeInTheDocument(); // Assuming Upload component has text 'Upload'
    });

    test('does not render protected Upload route for non-admin users', () => {
        renderWithRouter(
            <AuthContext.Provider value={{ isLoggedIn: false, isAdmin: false, username: '', userGroup: '', logout: vi.fn(), login: vi.fn(), x_authorization: '' }}>
                <App />
            </AuthContext.Provider>,
            { route: '/upload' }
        );
    });
});