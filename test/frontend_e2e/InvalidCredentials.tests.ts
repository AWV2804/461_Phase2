// test/frontend/login.test.ts
import dotenv from 'dotenv';
import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

dotenv.config();

describe('Login Tests', () => {
    let driver: WebDriver;

    beforeAll(async () => {
        const options = new chrome.Options();
        options.addArguments('--headless'); // Run in headless mode
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Login with invalid username', async () => {
        await driver.get(`http://localhost:${process.env.PORT}/login`); // Replace with your frontend URL
        const usernameInput = await driver.findElement(By.css('input[type="text"]'));
        const passwordInput = await driver.findElement(By.css('input[type="password"]'));
        const loginButton = await driver.findElement(By.css('button[type="button"]'));

        await usernameInput.sendKeys('invaliduser');
        await passwordInput.sendKeys('wrongpassword');
        await loginButton.click();

        await driver.wait(until.alertIsPresent(), 5000);
                const alert = driver.switchTo().alert();
                const alertText = await alert.getText();
                expect(alertText).toContain("Login failed: Invalid username");
                await alert.accept();
    });
});

describe('Logged Out Protected Routes Tests', () => {
    let driver: WebDriver;

    beforeAll(async () => {
        const options = new chrome.Options();
        options.addArguments('--headless'); // Run in headless mode
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Verify none of the links are accessible when logged out', async () => {
        await driver.get(`http://localhost:${process.env.PORT}`);
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
            const linkElement = await driver.wait(
                until.elementLocated(By.linkText(link.text)),
                5000
            );
            expect(await linkElement.isDisplayed()).toBe(true);
            await linkElement.click();
            
            await driver.wait(until.alertIsPresent(), 5000);
                const alert = driver.switchTo().alert();
                const alertText = await alert.getText();
                expect(alertText).toContain("You must be logged in to view this page.");
                await alert.accept();

            await driver.get(`http://localhost:${process.env.PORT}/`);
            }
    });
});