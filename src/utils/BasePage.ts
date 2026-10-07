import { Locator, Page, expect } from '@playwright/test';

export abstract class BasePage {

    constructor(protected readonly page: Page) { }

    // Navigation

    async navigate(url: string): Promise<void> {
        await this.page.goto(url);
    }

    async waitForUrl(urlFragment: string): Promise<void> {
        await this.page.waitForURL(url => url.href.includes(urlFragment));
    }

    // Element Actions

    async click(locator: Locator): Promise<void> {
        await locator.click();
    }

    async fill(locator: Locator, value: string): Promise<void> {
        await locator.fill(value);
    }

    async clearAndFill(locator: Locator, value: string): Promise<void> {
        await locator.clear();
        await locator.fill(value);
    }

    async selectByLabel(locator: Locator, label: string): Promise<void> {
        await locator.selectOption({ label });
    }

    async hover(locator: Locator): Promise<void> {
        await locator.hover();
    }

    // Element Retrieval

    async getText(locator: Locator): Promise<string> {
        return (await locator.textContent())?.trim() ?? '';
    }

    async getInputValue(locator: Locator): Promise<string> {
        return await locator.inputValue();
    }

    async isVisible(locator: Locator): Promise<boolean> {
        return await locator.isVisible();
    }

    // Wait Helpers

    async waitForVisible(locator: Locator): Promise<void> {
        await expect(locator).toBeVisible();
    }

    async waitForHidden(locator: Locator): Promise<void> {
        await expect(locator).toBeHidden();
    }

    async waitForEnabled(locator: Locator): Promise<void> {
        await expect(locator).toBeEnabled();
    }

    async waitForAngularReady(timeout: number = 20000): Promise<void> {
        try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
            await this.page.waitForFunction(() => {
                const spinners = Array.from(document.querySelectorAll('mat-spinner, .mat-progress-spinner, .spinner, .loading'));
                const busySpinner = spinners.some((element) => {
                    const style = window.getComputedStyle(element);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                });
                const overlay = document.querySelector('.cdk-overlay-backdrop, .mat-drawer-backdrop, .modal-backdrop');
                const blockingOverlay = overlay ? window.getComputedStyle(overlay as HTMLElement).display !== 'none' : false;
                return !busySpinner && !blockingOverlay;
            }, { timeout });
            await this.page.waitForTimeout(300);
        } catch {
            // Ignore transient Angular-loading issues and continue; the next locator/action will retry naturally.
        }
    }

    // Scroll Helpers

    async scrollIntoView(locator: Locator): Promise<void> {
        await locator.scrollIntoViewIfNeeded();
    }

    async scrollToBottom(): Promise<void> {
        await this.page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
    }

    // Popup Handling

    async waitForPopup(): Promise<Page> {
        return await this.page.waitForEvent('popup');
    }

    // Screenshot

    async takeScreenshot(name: string): Promise<void> {
        await this.page.screenshot({
            path: `test-results/screenshots/${name}.png`,
            fullPage: true
        });
    }

    async verifyCurrentLandingPageURL(expectedUrlPart: string): Promise<void> {
        await expect(this.page).toHaveURL(
            new RegExp(expectedUrlPart)
        );
    }
}