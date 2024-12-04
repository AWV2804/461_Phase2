// src/frontend/src/components/CreateAccount.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import CreateAccount from '../../src/frontend/src/components/CreateAccount';

describe('CreateAccount Component', () => {
    const renderComponent = () =>
        render(
            <BrowserRouter>
                <CreateAccount />
            </BrowserRouter>
        );

    test('renders username input', () => {
        renderComponent();
        const usernameInput = screen.getByTestId('username-input');
        expect(usernameInput).toBeInTheDocument();
    });

    test('renders password input', () => {
        renderComponent();
        const passwordInput = screen.getByTestId('password-input');
        expect(passwordInput).toBeInTheDocument();
    });

    test('renders confirm password input', () => {
        renderComponent();
        const confirmPasswordInput = screen.getByTestId('confirm-password-input');
        expect(confirmPasswordInput).toBeInTheDocument();
    });

    test('renders admin checkbox', () => {
        renderComponent();
        const adminCheckbox = screen.getByTestId('admin-checkbox');
        expect(adminCheckbox).toBeInTheDocument();
    });

    test('renders add user group checkbox', () => {
        renderComponent();
        const addUserGroupCheckbox = screen.getByTestId('add-user-group-checkbox');
        expect(addUserGroupCheckbox).toBeInTheDocument();
    });

    test('renders create account button', () => {
        renderComponent();
        const createAccountButton = screen.getByTestId('create-account-button');
        expect(createAccountButton).toBeInTheDocument();
    });

    test('does not render group input initially', () => {
        renderComponent();
        const groupInput = screen.queryByTestId('group-input');
        expect(groupInput).not.toBeInTheDocument();
    });
});