import {test,expect} from '@playwright/test';
test('extended spawn area contains the whole piece and opaque warning crosses',async({page},info)=>{
  await page.addInitScript(()=>{const board=Array.from({length:40},()=>Array(10).fill('.'));board[20][4]='G';board[20][5]='G';localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,lockTime:3600,safelock:false,initialQueue:'OO',initialBoard:board.reverse().map(r=>r.join('')).join('\n')}));});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');await page.getByTestId('start').click();
  const canvas=page.getByTestId('board-canvas');await expect(canvas).toHaveAttribute('data-visible-rows','24');await expect(canvas).toHaveAttribute('data-spawn-warning-cells','4');
  const dimensions=await canvas.evaluate((c:HTMLCanvasElement)=>({width:c.width,height:c.height}));expect(dimensions.height/dimensions.width).toBeCloseTo(2.4,2);
  const red=await canvas.evaluate((c:HTMLCanvasElement)=>{const ctx=c.getContext('2d')!,cell=c.width/10;const pixels=ctx.getImageData(4*cell,cell,cell*2,cell*2).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>240&&pixels[i+1]<85&&pixels[i+2]<85&&pixels[i+3]===255)count++;return count;});expect(red).toBeGreaterThan(20);
  await page.screenshot({path:info.outputPath('spawn-warning.png')});
  for(let i=0;i<3;i++)await page.keyboard.press('ArrowLeft');await expect(canvas).toHaveAttribute('data-spawn-warning-cells','0');expect(errors).toEqual([]);
});
test('drawing with initial hold enabled never consumes the queue by itself',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,lockTime:3600,ihs:'hold',initialQueue:'IOT'})));
  await page.goto('./');await page.getByTestId('start').click();await page.keyboard.down('KeyC');await expect(page.getByTestId('hold-preview')).toHaveAttribute('data-locked','true');
  await page.waitForTimeout(250);await page.keyboard.up('KeyC');await page.getByTestId('stats-button').click();
  const holds=page.locator('dl>div').filter({has:page.locator('dt',{hasText:/^HOLDS$/})});await expect(holds.locator('dd')).toHaveText('1');
});
