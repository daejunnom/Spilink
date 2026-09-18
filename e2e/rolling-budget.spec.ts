import { test, expect } from '@playwright/test';
test('low-APM live packets vary and the rolling budget matches exported attacks',async({page})=>{
  test.setTimeout(60000);
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.addInitScript(()=>{Object.defineProperty(crypto,'getRandomValues',{value:(a:Uint32Array)=>{a.fill(0);return a;}});localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:10,gravity:0,lockTime:3600,cancelCorrection:false,targetingGrace:false,garbageSpeed:36000}));});
  await page.goto('./');await page.getByTestId('start').click();
  await page.clock.runFor(120000);
  await page.getByTestId('stats-button').click();
  const recent=Number(await page.getByTestId('recent-attack-budget').textContent());
  expect(recent).toBeGreaterThan(0);expect(recent).toBeLessThanOrEqual(10);
  await expect(page.getByTestId('remaining-attack-budget')).toHaveText((10-recent).toFixed(1));
  await page.clock.runFor(90000);await expect(page.getByTestId('recent-attack-budget')).toHaveText(String(recent));
  await page.getByTestId('close-panel').click();await page.getByTestId('replay-button').click();
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'.ttr 저장',exact:true}).click();const file=await promise;
  const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk as Buffer);const json=JSON.parse(Buffer.concat(chunks).toString());
  const attacks=json.spilink.attacks.filter((e:{amount:number})=>e.amount>0);
  expect(attacks.some((e:{amount:number})=>e.amount>1)).toBe(true);
  const sum=attacks.filter((e:{frame:number})=>e.frame>json.replay.frames-3600&&e.frame<=json.replay.frames).reduce((n:number,e:{amount:number})=>n+e.amount,0);expect(sum).toBe(recent);
  expect(json.spilink.attackSource.version).toBe('rolling-1');expect(json.spilink.attackSource.virtualSenders).toBe(false);
});
for(const locale of ['en-US','ko-KR','ja-JP'])test(`rolling budget description is localized in ${locale}`,async({browser})=>{
  const context=await browser.newContext({locale}),page=await context.newPage();
  try{await page.goto('http://127.0.0.1:4173/Spilink/');await page.getByTestId('settings-button').click();
    await expect(page.getByTestId('incoming-apm')).toHaveAttribute('step','0.1');
    const text=locale==='ko-KR'?'최근 60초':locale==='ja-JP'?'直近60秒':'trailing 60 seconds';await expect(page.locator('.drawer-body')).toContainText(text);
    await page.getByTestId('close-panel').click();await page.getByTestId('stats-button').click();await expect(page.getByTestId('recent-attack-budget')).toHaveText('0');
  }finally{await context.close();}
});
