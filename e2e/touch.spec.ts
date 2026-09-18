import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page){await page.addInitScript(()=>localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,safelock:false})));await page.goto('http://127.0.0.1:4173/Spilink/');await page.getByTestId('start').click();}
for(const [width,height] of [[320,568],[390,844],[667,375],[844,390]])test(`mobile touch controls and keyboard fit ${width}x${height}`,async({browser},info)=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,locale:'en-US',viewport:{width,height}});const page=await context.newPage();
  try{await setup(page);await expect(page.getByTestId('touch-controls')).toBeVisible();await expect(page.locator('[data-touch-control]')).toHaveCount(8);
    const box=await page.getByTestId('touch-hardDrop').boundingBox();await page.touchscreen.tap(box!.x+box!.width/2,box!.y+box!.height/2);await expect(page.getByTestId('pieces')).toHaveText('1');
    await page.keyboard.press('Space');await expect(page.getByTestId('pieces')).toHaveText('2');
    const positions=await page.locator('[data-touch-control],.board-surface,.bottom-deck,.top-tools').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom};}));
    for(const r of positions){expect(r.left).toBeGreaterThanOrEqual(0);expect(r.top).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width+.1);expect(r.bottom).toBeLessThanOrEqual(height+.1);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.screenshot({path:info.outputPath(`touch-${width}x${height}.png`)});
  }finally{await context.close();}
});
test('touch drag editor persists portrait positions without producing pieces',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,locale:'en-US',viewport:{width:390,height:844}});const page=await context.newPage();
  try{await setup(page);await page.getByTestId('settings-button').click();await page.getByTestId('touch-settings').locator('summary').first().click();await page.getByTestId('touch-edit').click();
    await expect(page.getByTestId('status')).toHaveText('Paused');const button=page.getByTestId('touch-moveLeft'),b=(await button.boundingBox())!;
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+65,b.y+b.height/2+15,{steps:8});await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('spilink.touch.v1')!).layouts.portrait.moveLeft?.x)).toBeGreaterThan(0);
    expect((await button.boundingBox())!.x).toBeGreaterThan(b.x+30);expect(await page.getByTestId('pieces').textContent()).toBe('0');const stored=await page.evaluate(()=>localStorage.getItem('spilink.touch.v1'));await page.getByTestId('touch-done').click();await page.reload();expect(await page.evaluate(()=>localStorage.getItem('spilink.touch.v1'))).toBe(stored);
    await page.setViewportSize({width:844,height:390});expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('spilink.touch.v1')!).layouts.landscape)).toEqual({});
  }finally{await context.close();}
});
test('touch hide/show and invalid storage do not disable keyboard',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('spilink.touch.v1','{"version":1,"mode":"on","size":-1}'));await setup(page);await expect(page.getByTestId('touch-controls')).toHaveCount(0);
  await page.getByTestId('settings-button').click();await page.getByTestId('touch-settings').locator('summary').first().click();await page.getByTestId('touch-mode').selectOption('on');await page.getByTestId('close-panel').click();await page.keyboard.press('Escape');await expect(page.getByTestId('touch-controls')).toBeVisible();await page.keyboard.press('Space');await expect(page.getByTestId('pieces')).toHaveText('1');
});
test('touch multi-pointer holds release on cancel, lost capture, and settings pause',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,locale:'en-US',viewport:{width:390,height:844}});const page=await context.newPage();
  try{await setup(page);const client=await context.newCDPSession(page);const l=(await page.getByTestId('touch-moveLeft').boundingBox())!,r=(await page.getByTestId('touch-rotateCW').boundingBox())!;
    const points=[{x:l.x+l.width/2,y:l.y+l.height/2,id:1},{x:r.x+r.width/2,y:r.y+r.height/2,id:2}];
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await expect(page.getByTestId('touch-moveLeft')).toHaveClass(/held/);await expect(page.getByTestId('touch-rotateCW')).toHaveClass(/held/);
    await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('.touch-key.held')).toHaveCount(0);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points.slice(0,1)});await page.getByTestId('settings-button').click();await expect(page.locator('.touch-key.held')).toHaveCount(0);await expect(page.getByTestId('status')).toHaveText('Paused');await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  }finally{await context.close();}
});
