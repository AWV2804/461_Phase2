import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setupDriver } from '../../selenium.config.js';
import { By, until, WebDriver } from 'selenium-webdriver';
import dotenv from 'dotenv';

dotenv.config();
describe('Home Page End to End', () => {
    let driver: WebDriver;

    beforeAll(async () => {
        driver = await setupDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Load Home Page and Check Title', async () => {
        await driver.get(`http://localhost:${process.env.PORT}/`);
        const title = await driver.getTitle();
        expect(title).toBe('Package Rating Interface');
    });

    test('Check Home Page Links', async () => {
        await driver.get(`http://localhost:${process.env.PORT}/`);
        const links = [
            { text: '1. Search for Packages', href: '/search' },
            { text: '2. Upload a Package', href: '/upload' },
            { text: '3. Update a Package', href: '/update' },
            { text: '4. Calculate Cost of a Package', href: '/cost' },
            { text: '5. Check Rating of a Package', href: '/rate' },
            { text: '6. Reset Registry', href: '/reset' },
            { text: '7. Manage Accounts', href: '/manage' },
        ];

        for (const link of links) {
            const element = await driver.wait(until.elementLocated(By.linkText(link.text)), 5000);
            const href = await element.getAttribute('href');
            expect(href).toContain(link.href);
        }
    });
});