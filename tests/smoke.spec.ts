// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Smoke Test Suite', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear errors before each test
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('Login and navigate to core routes, check performance', async ({ page }) => {
    // Log in
    await page.goto('/login');
    // We assume there's a login form. We might need to handle actual login details 
    // or assume auto-login in dev/test environment if applicable.
    // If there's an email/password field:
    try {
      if (await page.isVisible('input[type="email"]')) {
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
      }
    } catch (e) {
      // In case we are already authenticated or use a different login flow
    }

    const routes = ['/dashboard', '/clients', '/employees', '/estimates', '/schedules'];

    for (const route of routes) {
      await page.goto(route);
      
      // Wait for content to be somewhat visible
      await page.waitForLoadState('networkidle');

      // Ensure FCP is under 1.5s
      const fcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntriesByName('first-contentful-paint');
            if (entries.length > 0) {
              resolve(entries[0].startTime);
            }
          }).observe({ type: 'paint', buffered: true });
        });
      });

      // Ensure FCP is valid and less than 1500ms
      expect(fcp).toBeLessThan(1500);
      
      // No console errors
      expect(consoleErrors.length).toBe(0);
    }
  });

  test('Global search returns results within 500ms', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Assume there is a search input, usually with placeholder "Search..." or name="search"
    // Adjust selector to match actual app
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    
    // If a search input exists, test it
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      
      const startTime = Date.now();
      
      // Wait for the response or loading indicator to disappear, we'll wait for networkidle
      // or assume some search results element appears.
      await page.waitForResponse(response => response.url().includes('/api/search') && response.status() === 200, { timeout: 2000 }).catch(() => null);
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThanOrEqual(500);
    }
  });
});
