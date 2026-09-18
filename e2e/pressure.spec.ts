import { test, expect } from '@playwright/test';
test('decimal APM is editable and survives settings persistence',async({page})=>{
  await page.goto('./');await page.getByTestId('settings-button').click();const input=page.getByTestId('incoming-apm');await expect(input).toHaveAttribute('step','0.1');await input.fill('45.7');
  await page.getByRole('button',{name:'설정 저장',exact:true}).click();await page.reload();await page.getByTestId('settings-button').click();await expect(page.getByTestId('incoming-apm')).toHaveValue('45.7');
});
test('top warning escalates through all four stages and freezes with the game clock',async({page},info)=>{
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));await page.addInitScript(()=>localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,initialPending:13,cancelCorrection:false,targetingGrace:false})));
  await page.goto('./');await page.getByTestId('start').click();const warning=page.getByTestId('attack-warning');
  await page.clock.runFor(200);await expect(warning).toHaveAttribute('data-level','1');await expect(warning.locator('[aria-hidden]')).toHaveText('!');await expect(warning).toHaveCSS('font-weight','900');
  await page.clock.runFor(200);await expect(warning).toHaveAttribute('data-level','2');await expect(warning.locator('[aria-hidden]')).toHaveText('!');
  await page.clock.runFor(200);await expect(warning).toHaveAttribute('data-level','3');await expect(warning.locator('[aria-hidden]')).toHaveText('!!');
  await page.clock.runFor(200);await expect(warning).toHaveAttribute('data-level','4');await expect(warning).toHaveCSS('color','rgb(238, 59, 56)');
  await page.screenshot({path:info.outputPath('warning-level-four.png')});
  await page.keyboard.press('Escape');await page.clock.runFor(10000);await expect(warning).toHaveAttribute('data-level','4');await page.keyboard.press('Escape');await page.clock.runFor(3000);await expect(warning).toHaveCount(0);
});
for(const [width,height]of [[320,568],[844,390]])test(`warning stays above mobile board and centred ${width}x${height}`,async({browser},info)=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width,height}}),page=await context.newPage();
  try{await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));await page.addInitScript(()=>localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,initialPending:13,cancelCorrection:false,targetingGrace:false})));await page.goto('http://127.0.0.1:4173/Spilink/');await page.getByTestId('start').click();await page.clock.runFor(800);
    const box=(await page.getByTestId('attack-warning').boundingBox())!,board=(await page.getByTestId('game-surface').boundingBox())!,tools=(await page.locator('.top-tools').boundingBox())!;
    expect(Math.abs(box.x+box.width/2-width/2)).toBeLessThan(2);expect(box.y).toBeGreaterThanOrEqual(tools.y+tools.height);expect(box.y+box.height).toBeLessThanOrEqual(board.y);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);await page.screenshot({path:info.outputPath(`warning-${width}x${height}.png`)});
  }finally{await context.close();}
});
