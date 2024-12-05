import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider, AuthContext } from '../../src/frontend/src/AuthContext';

describe('AuthContext', () => {
    it('should have default values', () => {
        render(
            <AuthProvider>
                <AuthContext.Consumer>
                    {(value) => (
                        <>
                            <span data-testid="isLoggedIn">{value.isLoggedIn.toString()}</span>
                            <span data-testid="isAdmin">{value.isAdmin.toString()}</span>
                            <span data-testid="username">{value.username}</span>
                            <span data-testid="x_authorization">{value.x_authorization}</span>
                        </>
                    )}
                </AuthContext.Consumer>
            </AuthProvider>
        );

        expect(screen.getByTestId('isLoggedIn').textContent).toBe('false');
        expect(screen.getByTestId('isAdmin').textContent).toBe('false');
        expect(screen.getByTestId('username').textContent).toBe('');
        expect(screen.getByTestId('x_authorization').textContent).toBe('');
    });

    it('should login correctly', () => {
        render(
            <AuthProvider>
                <AuthContext.Consumer>
                    {(value) => (
                        <>
                            <button onClick={() => value.login(true, 'testUser', 'testToken', 'testGroup')}>Login</button>
                            <span data-testid="isLoggedIn">{value.isLoggedIn.toString()}</span>
                            <span data-testid="isAdmin">{value.isAdmin.toString()}</span>
                            <span data-testid="username">{value.username}</span>
                            <span data-testid="x_authorization">{value.x_authorization}</span>
                        </>
                    )}
                </AuthContext.Consumer>
            </AuthProvider>
        );

        fireEvent.click(screen.getByText('Login'));

        expect(screen.getByTestId('isLoggedIn').textContent).toBe('true');
        expect(screen.getByTestId('isAdmin').textContent).toBe('true');
        expect(screen.getByTestId('username').textContent).toBe('testUser');
        expect(screen.getByTestId('x_authorization').textContent).toBe('testToken');
    });

    it('should logout correctly', () => {
        render(
            <AuthProvider>
                <AuthContext.Consumer>
                    {(value) => (
                        <>
                            <button onClick={() => value.login(true, 'testUser', 'testToken', 'testGroup')}>Login</button>
                            <button onClick={value.logout}>Logout</button>
                            <span data-testid="isLoggedIn">{value.isLoggedIn.toString()}</span>
                            <span data-testid="isAdmin">{value.isAdmin.toString()}</span>
                            <span data-testid="username">{value.username}</span>
                            <span data-testid="x_authorization">{value.x_authorization}</span>
                        </>
                    )}
                </AuthContext.Consumer>
            </AuthProvider>
        );

        fireEvent.click(screen.getByText('Login'));
        fireEvent.click(screen.getByText('Logout'));

        expect(screen.getByTestId('isLoggedIn').textContent).toBe('false');
        expect(screen.getByTestId('isAdmin').textContent).toBe('false');
        expect(screen.getByTestId('username').textContent).toBe('');
        expect(screen.getByTestId('x_authorization').textContent).toBe('');
    });
});