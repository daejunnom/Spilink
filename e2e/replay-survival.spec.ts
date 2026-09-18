import {test,expect,type Page} from '@playwright/test';
import {Session} from '../src/lib/session';
import {DEFAULT_CONFIG} from '../src/lib/config';
async function settings(page:Page){await page.getByTestId('settings-button').click();}
function holdReplay(){const s=new Session({...DEFAULT_CONFIG,gravity:0,incomingApm:0,safelock:false,initialQueue:'IOT'});s.start();s.tick([{frame:0,type:'keydown',data:{key:'hold',subframe:0}},{frame:0,type:'keyup',data:{key:'hold',subframe:.1}}]);for(let n=0;n<4;n++)s.tick();s.stop();return s.exportReplay();}
async function load(page:Page,value:unknown){await page.goto('./');await page.getByTestId('replay-button').click();await page.getByTestId('import-file').setInputFiles({name:'fixture.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});}
test('travel timing defaults can be edited and independently restored',async({page})=>{
  await page.goto('./');await settings(page);await page.getByTestId('garbage-timing').locator('summary').click();
  await expect(page.getByTestId('flight-frames')).toHaveValue('20');await expect(page.getByTestId('phase-frames')).toHaveValue('');await expect(page.getByTestId('rise-frames')).toHaveValue('5');await expect(page.getByTestId('clear-delay-frames')).toHaveValue('12');await expect(page.getByTestId('travel-total')).toContainText('140');
  await page.getByTestId('flight-frames').fill('60');await page.getByTestId('phase-frames').fill('30');await expect(page.getByTestId('travel-total')).toContainText('120');
  await page.getByRole('button',{name:'설정 저장',exact:true}).click();await page.reload();await settings(page);await page.getByTestId('garbage-timing').locator('summary').click();await expect(page.getByTestId('flight-frames')).toHaveValue('60');
  await page.getByTestId('reset-timing').click();await expect(page.getByTestId('flight-frames')).toHaveValue('20');await expect(page.getByTestId('phase-frames')).toHaveValue('');
});
test('hold preview is greyed out after hold and becomes available after next spawn',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('spilink.settings.v1',JSON.stringify({incomingApm:0,gravity:0,safelock:false})));await page.goto('./');await page.getByTestId('start').click();
  await page.keyboard.press('KeyC');await expect(page.getByTestId('hold-preview')).toHaveAttribute('data-locked','true');await expect(page.getByTestId('hold-preview')).toHaveClass(/hold-locked/);
  await page.keyboard.press('Space');await expect(page.getByTestId('hold-preview')).toHaveAttribute('data-locked','false');
});
test('saved replay restores the hold lock indication',async({page})=>{
  await load(page,holdReplay());await page.getByRole('button',{name:'가져온 기록 재생',exact:true}).click();await expect(page.getByTestId('status')).toContainText('세션 종료');await expect(page.getByTestId('hold-preview')).toHaveAttribute('data-locked','true');await expect(page.getByTestId('hold-preview')).toHaveClass(/hold-locked/);
});
test('replay end mismatch is not presented as a normal result',async({page})=>{
  const value=holdReplay();value.spilink.expectedEnd!.board[0][0]='gb';await load(page,value);await page.getByRole('button',{name:'가져온 기록 재생',exact:true}).click();await expect(page.getByTestId('status')).toContainText('리플레이 상태 불일치');
});
test('old rule revision remains available for preservation but not silently simulated',async({page})=>{
  const value=holdReplay();(value.spilink as any).version=2;(value.spilink as any).profile='practice-2';await load(page,value);await expect(page.getByRole('button',{name:'가져온 기록 재생',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'원본 형식 저장',exact:true})).toBeEnabled();
});
