import type { Locale } from '../i18n/index.ts';
const messages={
  title:{en:'Touch controls',ko:'터치 조작',ja:'タッチ操作'},
  mode:{en:'Show touch buttons',ko:'터치 버튼 표시',ja:'タッチボタンの表示'},
  auto:{en:'Automatic (touch device)',ko:'자동 (터치 기기)',ja:'自動（タッチ端末）'},
  on:{en:'Always show',ko:'항상 표시',ja:'常に表示'},off:{en:'Hide',ko:'숨기기',ja:'非表示'},
  info:{en:'Keyboard controls stay active. Hold arrows for DAS/ARR and soft drop; use multiple fingers to move and rotate together.',ko:'키보드도 계속 사용할 수 있습니다. 방향 버튼을 길게 누르면 DAS/ARR·소프트드롭이 적용되며, 여러 손가락으로 이동과 회전을 함께 조작할 수 있습니다.',ja:'キーボードも引き続き使えます。方向ボタンの長押しでDAS/ARR・ソフトドロップが働き、複数の指で移動と回転を同時に操作できます。'},
  size:{en:'Button size',ko:'버튼 크기',ja:'ボタンサイズ'},opacity:{en:'Button opacity',ko:'버튼 불투명도',ja:'ボタンの不透明度'},
  edit:{en:'Move buttons on screen',ko:'화면에서 버튼 이동',ja:'画面上でボタンを移動'},
  editing:{en:'Drag buttons to move them. Play is paused.',ko:'버튼을 드래그해 이동하세요. 플레이는 일시정지됩니다.',ja:'ボタンをドラッグして移動します。プレイは一時停止中です。'},
  done:{en:'Finish layout',ko:'배치 완료',ja:'配置を完了'},reset:{en:'Reset this layout',ko:'현재 방향 배치 초기화',ja:'現在の向きの配置をリセット'},
  portrait:{en:'Portrait layout',ko:'세로 화면 배치',ja:'縦画面の配置'},landscape:{en:'Landscape layout',ko:'가로 화면 배치',ja:'横画面の配置'},
  positions:{en:'Fine-tune positions',ko:'위치 미세 조정',ja:'位置の微調整'},
  x:{en:'Horizontal position (%)',ko:'가로 위치 (%)',ja:'横位置（%）'},y:{en:'Vertical position (%)',ko:'세로 위치 (%)',ja:'縦位置（%）'},
  saved:{en:'Saved on this device; portrait and landscape positions are independent.',ko:'이 기기에 저장됩니다. 세로·가로 배치는 각각 보존됩니다.',ja:'この端末に保存します。縦・横の配置は別々に保持されます。'},
  storage:{en:'Touch settings work now, but this browser could not save them.',ko:'터치 설정은 적용됐지만 브라우저에 저장하지 못했습니다.',ja:'タッチ設定は反映されましたが、ブラウザーに保存できませんでした。'},
  invalid:{en:'Invalid touch settings were ignored. Default layout is active.',ko:'잘못된 터치 설정을 무시하고 기본 배치를 적용했습니다.',ja:'無効なタッチ設定を無視し、初期配置を適用しました。'},
  fitted:{en:'Buttons fit the available space. Position editing never sends game input.',ko:'버튼은 가용 공간에 맞춰 표시됩니다. 배치 편집 중에는 게임 입력이 발생하지 않습니다.',ja:'ボタンは使用可能な領域に収まります。配置編集中にゲーム操作は送信されません。'}
} satisfies Record<string,Record<Locale,string>>;
export type TouchMessageKey=keyof typeof messages;
export const touchTranslator=(locale:Locale)=>(key:TouchMessageKey)=>messages[key][locale];
