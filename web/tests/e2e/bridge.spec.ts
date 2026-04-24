import { test, expect } from '@playwright/test';

test('shows connected bridge state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('The Bazaar Local Service Bridge')).toBeVisible();
  await expect(page.getByText(/Protocol v1.0 verified\./)).toBeVisible();
  await expect(page.getByText(/Connected/)).toBeVisible();
});
