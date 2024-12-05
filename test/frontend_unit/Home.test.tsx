import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import Home from '../../src/frontend/src/components/Home';

describe('Home Component', () => {
    it('should contain links with correct text and href attributes', () => {
        const { getByText } = render(
            <Router>
                <Home />
            </Router>
        );

        const links = [
            { text: '1. Search for Packages', href: '/search' },
            { text: '2. Upload a Package', href: '/upload' },
        ];

        links.forEach(link => {
            const element = getByText(link.text);
            expect(element).not.toBeNull();
            expect(element.getAttribute('href')).toBe(link.href);
        });
    });
});