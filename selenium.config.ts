// selenium.config.ts
import { Builder, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

export const setupDriver = async (): Promise<WebDriver> => {
    const options = new chrome.Options();
    options.addArguments('--headless'); // Run in headless mode
    options.addArguments('--disable-gpu'); // Disables GPU for headless mode
    options.addArguments('--window-size=1920,1080'); // Sets window size
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    return driver;
};