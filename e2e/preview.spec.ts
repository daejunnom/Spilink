import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decode_ttrx, ttrx_source_extension } from 'tetr-ttrx';
async function configure(page:Page){await page.getByTestId('settings-button').click();await page.getByTestId('incoming-apm').fill('0');await page.getByTestId('gravity').fill('0');}
async function close(page:Page){await page.getByTestId('close-panel').click();}
test('400 default, drawer settings, real input, undo and redo',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
  await expect(page.locator('header,footer,.intro')).toHaveCount(0);await configure(page);
  await expect(page.getByTestId('continue-toggle')).not.toBeChecked();await expect(page.getByTestId('ttrx-toggle')).not.toBeChecked();
  await close(page);await page.getByTestId('start').click();await expect(page.getByTestId('status')).toContainText('연습 중');
  await page.waitForTimeout(150);await page.keyboard.press('Space');await expect(page.getByTestId('pieces')).toHaveText('1');
  await page.keyboard.press('Escape');await expect(page.getByTestId('status')).toHaveText('일시정지');
  await page.getByTestId('undo').click();await expect(page.getByTestId('pieces')).toHaveText('0');
  await page.getByTestId('redo').click();await expect(page.getByTestId('pieces')).toHaveText('1');expect(errors).toEqual([]);
});
test('existing settings remain available and persist',async({page})=>{
  await page.goto('./');await configure(page);await page.getByTestId('continue-toggle').check();
  await page.getByText('핸들링과 키 설정',{exact:true}).click();await page.getByRole('button',{name:'홀드 C',exact:true}).click();await page.keyboard.press('KeyV');
  await expect(page.getByRole('button',{name:'홀드 V',exact:true})).toBeVisible();await page.getByRole('button',{name:'설정 저장',exact:true}).click();await page.reload();
  await page.getByTestId('settings-button').click();await expect(page.getByTestId('continue-toggle')).toBeChecked();await expect(page.getByTestId('gravity')).toHaveValue('0');
  await expect(page.getByTestId('incoming-apm')).toHaveValue('0');await page.getByText('고급 연습 설정',{exact:true}).click();await expect(page.getByText('가비지 캡',{exact:true})).toBeVisible();
});
test('TTR complete results, TTRX roundtrip and saved replay import',async({page},info)=>{
  await page.goto('./');await configure(page);await page.getByTestId('ttrx-toggle').check();await close(page);await page.getByTestId('start').click();await page.waitForTimeout(150);await page.keyboard.press('Space');
  await expect(page.getByTestId('pieces')).toHaveText('1');await page.getByTestId('replay-button').click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'.ttr 저장',exact:true}).click();const file=await download;const path=info.outputPath('record.ttr');await file.saveAs(path);
  const original=JSON.parse(await readFile(path,'utf8'));expect(original.replay.results.stats.clears).toBeTruthy();expect(original.replay.results.stats.zenith).toBeTruthy();expect(original.replay.results.stats.finaltime).toBeGreaterThan(0);expect(original.spilink.version).toBe(2);
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'.ttrx 저장',exact:true}).click();const binary=await event;const ttrxPath=info.outputPath('record.ttrx');await binary.saveAs(ttrxPath);
  const bytes=await readFile(ttrxPath);expect(ttrx_source_extension(bytes)).toBe('ttr');const restored=JSON.parse(new TextDecoder().decode(decode_ttrx(bytes)));expect(restored.replay).toEqual(original.replay);
  await page.getByTestId('import-file').setInputFiles(path);await expect(page.getByRole('button',{name:'가져온 기록 재생',exact:true})).toBeEnabled();await page.getByRole('button',{name:'가져온 기록 재생',exact:true}).click();await expect(page.getByTestId('pieces')).toHaveText('1');
});
const sizes=[[1920,1080],[1440,900],[1366,768],[1024,768],[900,600],[800,600],[640,480],[390,844],[360,640],[320,568],[844,390],[667,375]];
for(const [width,height] of sizes)test(`single-screen playing area ${width}x${height}`,async({page},info)=>{
  await page.setViewportSize({width,height});await page.goto('./');await expect(page.getByTestId('start')).toBeVisible();
  await page.waitForTimeout(100);
  const fits=await page.evaluate(()=>{const root=document.documentElement;const board=document.querySelector('[data-testid="game-surface"]')!.getBoundingClientRect();const deck=document.querySelector('.bottom-deck')!.getBoundingClientRect();const tools=document.querySelector('.top-tools')!.getBoundingClientRect();return {scrollX:root.scrollWidth>innerWidth,scrollY:root.scrollHeight>innerHeight,board:{left:board.left,top:board.top,right:board.right,bottom:board.bottom},deckBottom:deck.bottom,toolsRight:tools.right};});
  expect(fits.scrollX).toBe(false);expect(fits.scrollY).toBe(false);expect(fits.board.left).toBeGreaterThanOrEqual(0);expect(fits.board.top).toBeGreaterThanOrEqual(0);expect(fits.board.right).toBeLessThanOrEqual(width);expect(fits.board.bottom).toBeLessThanOrEqual(height);expect(fits.deckBottom).toBeLessThanOrEqual(height);expect(fits.toolsRight).toBeLessThanOrEqual(width);
  expect((await page.getByTestId('garbage-meter').boundingBox())!.width).toBeGreaterThanOrEqual(14);
  const meter=(await page.getByTestId('garbage-meter').boundingBox())!,line=(await page.getByTestId('cap-line').boundingBox())!;
  expect(Math.abs((meter.y+meter.height-line.y)/meter.height-.4)).toBeLessThan(.02);
  if(width===1440||width===390||height===390)await page.screenshot({path:info.outputPath(`${width}x${height}.png`)});
});
test('cap changes and fullscreen stay within viewport',async({page})=>{
  await page.goto('./');await page.getByTestId('settings-button').click();await page.getByText('고급 연습 설정',{exact:true}).click();await page.getByTestId('garbage-cap').fill('12');await page.getByRole('button',{name:'설정 저장',exact:true}).click();await close(page);
  await expect(page.getByTestId('cap-line')).toHaveAttribute('title','가비지 캡 12줄');await page.getByTestId('fullscreen-button').click();
  await expect(page.getByTestId('fullscreen-button')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.getByTestId('fullscreen-button').click();await expect(page.getByTestId('fullscreen-button')).toHaveAttribute('aria-pressed','false');
});
test('opening settings pauses and settings keystrokes never place a piece',async({page})=>{
  await page.goto('./');await configure(page);await close(page);await page.getByTestId('start').click();await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('status')).toHaveText('일시정지');await page.getByText('진행·공급·상승 설정',{exact:true}).click();await page.getByTestId('player-name').fill('local player');await page.keyboard.press('Space');await expect(page.getByTestId('pieces')).toHaveText('0');
});
