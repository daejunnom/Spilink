import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decode_ttrx, ttrx_source_extension } from 'tetr-ttrx';

test('starts with 400-piece default and accepts real keyboard input', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('continue-toggle')).not.toBeChecked();
  await expect(page.getByTestId('ttrx-toggle')).not.toBeChecked();
  await page.getByTestId('incoming-apm').fill('0');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('status')).toContainText('연습 중');
  await expect(page.getByTestId('gravity')).toBeDisabled();
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('pieces')).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('status')).toHaveText('일시정지');
  await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('continuation and handling survive reload after starting', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('continue-toggle').check();
  await page.getByTestId('gravity').fill('0');
  await page.getByTestId('incoming-apm').fill('0');
  await page.getByTestId('start').click();
  await page.reload();
  await expect(page.getByTestId('continue-toggle')).toBeChecked();
  await expect(page.getByTestId('gravity')).toHaveValue('0');
  await expect(page.getByTestId('incoming-apm')).toHaveValue('0');
});

test('browser exports real TTR and TTRX with matching recorded data', async ({ page }, info) => {
  await page.goto('./');
  await page.getByTestId('incoming-apm').fill('0');
  await page.getByTestId('ttrx-toggle').check();
  await page.getByTestId('start').click();
  await page.waitForTimeout(150); await page.keyboard.press('Space');
  await expect(page.getByTestId('pieces')).toHaveText('1');
  const ttrEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '.ttr 저장', exact: true }).click();
  const ttr = await ttrEvent; const ttrPath = info.outputPath('record.ttr'); await ttr.saveAs(ttrPath);
  expect(ttr.suggestedFilename()).toMatch(/\.ttr$/);
  const original = JSON.parse(await readFile(ttrPath, 'utf8'));
  expect(original.spilink.officialPlayback).toBe(false);
  expect(original.replay.events.some((e: { type: string }) => e.type === 'keydown')).toBe(true);
  const ttrxEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '.ttrx 저장', exact: true }).click();
  const ttrx = await ttrxEvent; const path = info.outputPath('record.ttrx'); await ttrx.saveAs(path);
  const bytes = new Uint8Array(await readFile(path));
  expect(ttrx_source_extension(bytes)).toBe('ttr');
  const decoded = JSON.parse(new TextDecoder().decode(decode_ttrx(bytes)));
  expect(decoded.spilink.summary).toEqual(original.spilink.summary);
  expect(decoded.replay.events).toEqual(original.replay.events);
  expect(decoded.spilink.ticks).toBeGreaterThan(0);
});

test('narrow layout fits and settings capture does not leak game input', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('./');
  await expect(page.getByTestId('start')).toBeVisible();
  await page.getByText('핸들링과 키 설정', { exact: true }).click();
  await page.getByRole('button', { name: '홀드 C', exact: true }).click();
  await page.keyboard.press('KeyV');
  await expect(page.getByRole('button', { name: '홀드 V', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
