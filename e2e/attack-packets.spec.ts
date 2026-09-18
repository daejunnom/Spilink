import { test, expect } from '@playwright/test';
for(const [locale,text] of [['en-US','Current per-send limit: 8'],['ko-KR','현재 한 번에 보내는 상한: 수신 보정 전 8줄'],['ja-JP','現在の1回の上限：受信補正前で8ライン']])test(`per-send limit is automatic, editable and localized in ${locale}`,async({browser})=>{
  const context=await browser.newContext({locale}),page=await context.newPage();
  try{
    await page.goto('http://127.0.0.1:4173/Spilink/');await page.getByTestId('settings-button').click();
    await page.getByTestId('incoming-apm').fill('150');await expect(page.getByTestId('attack-packet-hint')).toContainText(text);
    const cap=page.getByTestId('attack-packet-cap');await expect(cap).toHaveValue('');
    await cap.fill('4');await expect(page.getByTestId('attack-packet-hint')).toContainText('4');
    const save=locale==='ko-KR'?'저장':locale==='ja-JP'?'保存':'Save';
    await page.locator('.panel-actions').getByRole('button',{name:new RegExp(save)}).first().click();
    await page.reload();await page.getByTestId('settings-button').click();await expect(page.getByTestId('attack-packet-cap')).toHaveValue('4');
    await page.getByTestId('attack-packet-cap').fill('');await expect(page.getByTestId('attack-packet-hint')).toContainText(text);
  }finally{await context.close();}
});
test('150 APM replay contains separate packets of at most eight lines',async({page})=>{
  test.setTimeout(60000);
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.addInitScript(()=>{
    Object.defineProperty(crypto,'getRandomValues',{value:(a:Uint32Array)=>{a.fill(0);return a;}});
    localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:150,gravity:0,lockTime:3600,cancelCorrection:false,targetingGrace:false,garbageSpeed:36000}));
  });
  await page.goto('./');await page.getByTestId('start').click();await page.clock.runFor(24000);
  await page.getByTestId('replay-button').click();const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'.ttr 저장',exact:true}).click();const file=await downloading;
  const stream=await file.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk as Buffer);
  const json=JSON.parse(Buffer.concat(chunks).toString()),attacks=json.spilink.attacks.filter((e:{amount:number})=>e.amount>0);
  expect(attacks.length).toBeGreaterThan(3);expect(attacks.every((e:{amount:number})=>e.amount<=8)).toBe(true);
  expect(attacks.some((e:{amount:number})=>e.amount===8)).toBe(true);
  expect(new Set(attacks.map((e:{frame:number})=>e.frame)).size).toBe(attacks.length);
  const native=json.replay.events.filter((e:any)=>e.type==='ige'&&e.data.type==='interaction');expect(native.length).toBe(attacks.length);
  expect(native.map((e:any)=>[e.frame,e.data.data.amt])).toEqual(attacks.map((e:any)=>[e.frame,e.amount]));
});
