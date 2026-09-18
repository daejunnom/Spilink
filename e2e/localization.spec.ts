import {test,expect} from '@playwright/test';
for(const [locale,label,status] of [['en-US','Settings','Ready'],['ko-KR','설정','시작 준비'],['ja-JP','設定','準備完了'],['fr-FR','Settings','Ready']]){
  test(`browser locale ${locale} selects localized UI`,async({browser},info)=>{
    const context=await browser.newContext({locale,viewport:{width:390,height:844}});const page=await context.newPage();
    try{await page.goto('http://127.0.0.1:4173/Spilink/');await expect(page.getByTestId('settings-button')).toHaveText(label);await expect(page.getByTestId('status')).toHaveText(status);
      await page.getByTestId('settings-button').click();await expect(page.getByTestId('language-select')).toBeVisible();
      await page.getByTestId('language-select').selectOption('ja');await expect(page.getByTestId('settings-button')).toHaveText('設定');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ja');
      await page.screenshot({path:info.outputPath(`${locale}.png`)});
    }finally{await context.close();}
  });
}
test('button and key restarts always use a new seed',async({page})=>{
  await page.goto('./');await page.getByTestId('settings-button').click();await page.getByTestId('incoming-apm').fill('0');await page.getByTestId('gravity').fill('0');await page.getByTestId('close-panel').click();await page.getByTestId('start').click();
  const seed=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('spilink.settings.v1')!).seed);
  const first=await seed();await page.getByTestId('restart').click();const second=await seed();expect(second).not.toBe(first);
  await page.keyboard.press('KeyR');await expect.poll(seed).not.toBe(second);
  expect(await page.locator('.play-actions button').count()).toBe(5);
});
test('garbage meter follows yellow orange red simulation phases',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,initialPending:3,garbageSpeed:0,garbagePhase:60})));
  await page.goto('./');await page.getByTestId('start').click();const segment=page.locator('.meter-segment').first();
  await expect(segment).toHaveAttribute('data-urgency','waiting');await expect(segment).toHaveAttribute('data-urgency','warning',{timeout:5000});await expect(segment).toHaveAttribute('data-urgency','ready',{timeout:5000});
  await page.keyboard.press('Escape');const frames=await segment.getAttribute('title');await page.waitForTimeout(100);expect(await segment.getAttribute('title')).toBe(frames);
});
for(const locale of ['en-US','ja-JP'])for(const [width,height] of [[320,568],[640,480],[844,390],[1440,900]])test(`localized layout ${locale} ${width}x${height}`,async({browser},info)=>{
  const context=await browser.newContext({locale,viewport:{width,height}});const page=await context.newPage();
  try{await page.goto('http://127.0.0.1:4173/Spilink/');await expect(page.getByTestId('start')).toBeVisible();await page.waitForTimeout(100);
    const boxes=await page.locator('.top-tools, .board-surface, .bottom-deck').evaluateAll(items=>items.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
    for(const b of boxes){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(width);expect(b.bottom).toBeLessThanOrEqual(height);}
    await page.screenshot({path:info.outputPath(`${locale}-${width}x${height}.png`)});
  }finally{await context.close();}
});
