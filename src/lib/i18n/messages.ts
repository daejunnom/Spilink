import { messages as commonMessages } from './common-messages.ts';
export const messages = {
  ...commonMessages,
  "pressure.warning": {"en":"Incoming large attack: level {level}, {amount} lines", "ko":"대형 공격 예고: {level}단계, {amount}줄", "ja":"大攻撃の予告：レベル{level}、{amount}ライン"},
  "pressure.pacingHint": {"en":"APM is the average generated damage per minute, before receiver adjustments. One decimal is supported. Packets and intervals vary; fractional budgets become a chance of one extra line. A small maximum packet uses shorter intervals. The first-attack delay does not bank a large burst.", "ko":"APM은 수신 보정 전 분당 평균 생성 공격량이며 소수 첫째 자리까지 지원합니다. 양과 간격은 조금씩 달라지고, 시간별 예산의 소수는 1줄 추가 확률로 처리합니다. 단일 공격 상한이 작으면 간격이 짧아집니다. 첫 공격 대기 중 대량 공격을 적립하지 않습니다.", "ja":"APMは受信補正前の1分あたりの平均生成攻撃量で、小数第1位まで対応します。量と間隔は変動し、時間ごとの小数予算は1ライン追加の確率になります。単発上限が小さい場合は間隔を短くします。開始待機中に大攻撃を蓄積しません。"},
  "pressure.warningHint": {"en":"The top exclamation mark previews a large incoming attack, not a count of players targeting you.", "ko":"상단 느낌표는 대형 수신 공격의 예고이며, 나를 타겟팅하는 플레이어 수가 아닙니다.", "ja":"上部の感嘆符は大攻撃の予告であり、自分を狙うプレイヤー数ではありません。"},
  "replay.externalInfo": {"en": "External and older Spilink replays can be inspected, preserved and converted. Only matching Spilink v3 records are simulated; unsupported versions are not silently reinterpreted.", "ko": "외부·이전 Spilink 기록은 검사·원문 보존·변환을 지원합니다. 자체 재생은 일치하는 Spilink v3 기록만 지원하며, 이전 규칙을 임의로 바꿔 재생하지 않습니다.", "ja": "外部・旧Spilink記録は検査・原文保存・変換に対応します。独自再生は一致するSpilink v3記録のみで、旧ルールを無断で置き換えません。"},
  "hold.locked": {"en": "Hold unavailable until the next piece spawns", "ko": "다음 미노 출현 전까지 재홀드 불가", "ja": "次のミノが出現するまで再ホールド不可"},
  "hold.available": {"en": "Hold available", "ko": "홀드 가능", "ja": "ホールド可能"},
  "replay.mismatch": {"en": "Replay state mismatch", "ko": "리플레이 상태 불일치", "ja": "リプレイ状態の不一致"},
  "setup.clutch": {"en": "Clutch Clear rescue after a line clear", "ko": "줄 삭제 후 클러치 클리어 허용", "ja": "ライン消去後のクラッチクリア"},
  "setup.noLockout": {"en": "Allow locking fully above the visible field", "ko": "가시 필드 위에서의 고정 허용", "ja": "表示範囲より上での固定を許可"},
  "setup.noLockoutHint": {"en": "Blocked spawns and full buffer ceilings still end the game.", "ko": "출현 위치가 막히거나 버퍼 최상단이 가득 차면 여전히 종료됩니다.", "ja": "出現位置の衝突やバッファ最上段の充満では終了します。"},
  "setup.pcRule": {"en": "Apply Season 2 PC B2B (+1, no duplicate)", "ko": "시즌 2 PC B2B 적용 (+1, 중복 없음)", "ja": "シーズン2の全消しB2Bを適用（+1・重複なし）"},
  "garbage.timing": {"en": "Garbage travel and entry time", "ko": "가비지 트래블·진입 시간", "ja": "ガベージ到達・せり上がり時間"},
  "garbage.flight": {"en": "Flight to field (frames)", "ko": "필드 도착까지 비행 (프레임)", "ja": "フィールド到達までの飛行（フレーム）"},
  "garbage.phase": {"en": "One warning stage (frames; blank = floor)", "ko": "경고 한 단계 (프레임, 빈칸 = 층 연동)", "ja": "警告1段階（フレーム・空欄＝階連動）"},
  "garbage.minimum": {"en": "Base ready time at selected floor: {frames} frames ({seconds}s)", "ko": "선택한 층의 기본 상승 준비 시간: {frames}프레임 ({seconds}초)", "ja": "選択階の基本準備時間：{frames}フレーム（{seconds}秒）"},
  "garbage.timingHint": {"en": "Flight and warning stages are separate. Queues, large attacks, cancellation, combos and entry intervals can change the actual rise time. Zero flight is a practice override.", "ko": "비행과 경고 단계는 별개입니다. 대기열·대형 공격·상쇄·콤보·상승 간격에 따라 실제 상승 시점은 달라집니다. 비행 0은 연습용 설정입니다.", "ja": "飛行と警告は別の段階です。待ち行列・大攻撃・相殺・コンボ・せり上がり間隔により実際の時刻は変わります。飛行0は練習用設定です。"},
  "garbage.resetTiming": {"en": "Restore timing defaults", "ko": "시간 기본값 복원", "ja": "時間設定を初期値に戻す"},
} as const;
export type MessageKey = keyof typeof messages;
