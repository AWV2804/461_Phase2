// test/frontend/login.test.ts
import dotenv from 'dotenv';
import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

dotenv.config();

describe('Login Tests', () => {
    let driver: WebDriver;
    const admin_username = process.env.TEST_USERNAME_ADMIN || 'athar';
    const admin_password = process.env.TEST_PASSWORD || 'athar';
    const newUsername = 'newTestUs12332er';
    const newPassword = 'newTestPassword';

    beforeAll(async () => {
        const options = new chrome.Options();
        options.addArguments('--headless'); // Run in headless mode
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

            await driver.get(`http://localhost:${process.env.PORT}/login`); // Replace with your frontend URL

            const usernameInput = await driver.findElement(By.css('input[type="text"]'));
            const passwordInput = await driver.findElement(By.css('input[type="password"]'));
            const loginButton = await driver.findElement(By.css('button[type="button"]'));
    
            await usernameInput.sendKeys(admin_username);
            await passwordInput.sendKeys(admin_password);
            await loginButton.click();
    
            // Wait for redirection to homepage
            await driver.wait(async () => {
                const currentUrl = await driver.getCurrentUrl();
                return currentUrl === `http://localhost:${process.env.PORT}/`;
            }, 5000);
    
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
            const usernameInput_notadmin = await driver.findElement(By.css('input[data-testid="username-input"]'));
            const passwordInput_notadmin = await driver.findElement(By.css('input[data-testid="password-input"]'));
            const confirmPasswordInput_notadmin = await driver.findElement(By.css('input[data-testid="confirm-password-input"]'));
    
            await usernameInput_notadmin.sendKeys(newUsername);
            await passwordInput_notadmin.sendKeys(newPassword);
            await confirmPasswordInput_notadmin.sendKeys(newPassword);
    
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

    afterAll(async () => {
        await driver.get(`http://localhost:${process.env.PORT}/login`); // Replace with your frontend URL

        const usernameInput = await driver.findElement(By.css('input[type="text"]'));
        const passwordInput = await driver.findElement(By.css('input[type="password"]'));
        const loginButton = await driver.findElement(By.css('button[type="button"]'));

        await usernameInput.sendKeys(admin_username);
        await passwordInput.sendKeys(admin_password);
        await loginButton.click();

        // Wait for redirection to homepage
        await driver.wait(async () => {
            const currentUrl = await driver.getCurrentUrl();
            return currentUrl === `http://localhost:${process.env.PORT}/`;
        }, 5000);

        // Delete the non-admin account
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
        const usernameInputToDelete = await driver.findElement(By.css('input[placeholder="Enter username"]'));
        await usernameInputToDelete.sendKeys(newUsername);

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
        await driver.quit();
    });


    test('Login with valid non-admin credentials', async () => {
        

        // Logout
        await driver.get(`http://localhost:${process.env.PORT}/login`);

        const usernameInput = await driver.findElement(By.css('input[type="text"]'));
        const passwordInput = await driver.findElement(By.css('input[type="password"]'));
        const loginButton = await driver.findElement(By.css('button[type="button"]'));

        await usernameInput.sendKeys(newUsername);
        await passwordInput.sendKeys(newPassword);
        await loginButton.click();

        // Verify "Logged in as:" text
        const loggedInAsElement = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Logged in as: ${newUsername}')]`)),
            5000
        );
        expect(await loggedInAsElement.isDisplayed()).toBe(true);

        // Verify admin status
        // Adjust the selector based on how "Admin" or "Not Admin" is rendered
        const adminElement = await driver.wait(
            until.elementLocated(By.xpath(`//*[contains(text(), 'Not Admin')]`)),
            5000
        );
        expect(await adminElement.isDisplayed()).toBe(true);
    });

    test('Verify non-admin can access non-admin pages', async () => {
        const links = [
            { text: '1. Search for Packages', href: '/search' },
            { text: '4. Calculate Cost of a Package', href: '/cost' },
            { text: '5. Check Rating of a Package', href: '/rate' },
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

    test('Verify non-admin cannot access admin pages', async () => {
        const links = [
            { text: '2. Upload a Package', href: '/upload' },
            { text: '3. Update a Package', href: '/update' },
            { text: '6. Reset Registry', href: '/reset' },
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
                expect(alertText).toContain("You must be an admin to view this page.");
                await alert.accept();
        }
    });
});