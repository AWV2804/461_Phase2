// test/frontend/Admin.tests.ts
import dotenv from 'dotenv';
import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import SHA256 from 'crypto-js/sha256.js';
import { ConsoleLogEntry } from 'selenium-webdriver/bidi/logEntries';

dotenv.config();

describe('Admin Tests', () => {
    let driver: WebDriver;
    const username = process.env.TEST_USERNAME_ADMIN || 'wrong';
    const password = process.env.TEST_PASSWORD || 'wrong';
    const newUsername = 'newTestUs123er';
    const newPassword = 'newTestPassword';
    
    const hashedUser = SHA256(username).toString();
    const hashedPW = SHA256(password).toString();
    
    console.log(`Hashed username: ${hashedUser}`);
    console.log(`Hashed password: ${hashedPW}`);

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

    beforeEach(async () => {
        await driver.get(`http://localhost:${process.env.PORT}/login`); // Replace with your frontend URL
        console.log(`Current URL: ${await driver.getCurrentUrl()}`);
        //await driver.get(`http://ec2-3-84-91-136.compute-1.amazonaws.com:8080/login`); // Replace with your frontend URL

        const usernameInput = await driver.findElement(By.css('input[type="text"]'));
        const passwordInput = await driver.findElement(By.css('input[type="password"]'));
        const loginButton = await driver.findElement(By.css('button[type="button"]'));

        await usernameInput.sendKeys(username);
        await passwordInput.sendKeys(password);
        await loginButton.click();
    });

    test('Verify header contains correct admin details', async () => {

        // Wait for redirection to homepage
        await driver.wait(async () => {
            const currentUrl = await driver.getCurrentUrl();
            //return currentUrl === `http://ec2-3-84-91-136.compute-1.amazonaws.com:8080/login`;
            return currentUrl === `http://localhost:${process.env.PORT}/login`;
        }, 5000);

        // Verify "Logged in as:" text
        const loggedInAsElement = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Logged in as: ${username}')]`)),
            5000
        );
        expect(await loggedInAsElement.isDisplayed()).toBe(true);

        // Verify admin status
        // Adjust the selector based on how "Admin" or "Not Admin" is rendered
        const adminElement = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Admin')]`)),
            5000
        );
        expect(await adminElement.isDisplayed()).toBe(true);
    });

    test('Create temporary test account', async () => {
        // Verify "Create Account" button is present
        const createAccountButton = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Create Account')]`)),
            5000
        );
        expect(await createAccountButton.isDisplayed()).toBe(true);

        // Click "Create Account" button
        await createAccountButton.click();

        // Wait for redirection to Create Account page
        await driver.wait(until.urlContains('/create-account'), 5000);

        // Enter username, password, and confirm password
        const usernameInput = await driver.findElement(By.css('input[data-testid="username-input"]'));
        const passwordInput = await driver.findElement(By.css('input[data-testid="password-input"]'));
        const confirmPasswordInput = await driver.findElement(By.css('input[data-testid="confirm-password-input"]'));


        await usernameInput.sendKeys(newUsername);
        await passwordInput.sendKeys(newPassword);
        await confirmPasswordInput.sendKeys(newPassword);

        // Submit the form
        const submitButton = await driver.findElement(By.css('button[data-testid="create-account-button"]'));
        await submitButton.click();

        // Wait for the alert to be present
        await driver.wait(until.alertIsPresent(), 5000);

        // Verify account creation success message
        const alertText = await driver.switchTo().alert().getText();
        expect(alertText).toContain(`Account created successfully for user: ${newUsername} with admin: false!`);
        await driver.switchTo().alert().accept();
    });

    test('Delete temporary test account', async () => {
        // Click on "Manage Accounts" from the Home page
        const manageAccountsButton = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Manage Accounts')]`)),
            5000
        );
        expect(await manageAccountsButton.isDisplayed()).toBe(true);
        await manageAccountsButton.click();

        // Verify "Delete User Account" text is present
        const deleteUserAccountText = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Delete User Account')]`)),
            5000
        );
        expect(await deleteUserAccountText.isDisplayed()).toBe(true);

        // Enter the new username in the input box
        const usernameInput = await driver.findElement(By.css('input[placeholder="Enter username"]'));
        await usernameInput.sendKeys(newUsername);

        // Click the delete button
        const deleteButton = await driver.findElement(By.css('button.delete-button'));
        await deleteButton.click();

        // Confirm the deletion in the popup
        await driver.wait(until.alertIsPresent(), 5000);
        const alertText = await driver.switchTo().alert().getText();
        expect(alertText).toContain(`Are you sure you want to delete the account "${newUsername}"?`);
        await driver.switchTo().alert().accept();

        // Verify account deletion success message
        await driver.wait(until.alertIsPresent(), 5000);
        const successAlertText = await driver.switchTo().alert().getText();
        expect(successAlertText).toContain('User deleted successfully');
        await driver.switchTo().alert().accept();
    });

    test('Verify navigation through all links ', async () => {
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
            await driver.wait(until.urlContains(link.href), 5000);

            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).toContain(link.href);

            // Wait for the Home button to be interactable
            const homeButton = await driver.wait(
                until.elementLocated(By.css('.nav-logo')),
                5000
            );
            await homeButton.click();
        }
    });

});