import type { Session } from './session.ts';
export type SavedReplay = ReturnType<Session['exportReplay']>;
export async function downloadReplay(replay: SavedReplay, format: 'ttr' | 'ttrx'): Promise<void> {
  const source = new TextEncoder().encode(JSON.stringify(replay));
  if (source.byteLength > 32 * 1024 * 1024) throw new Error('저장 파일이 미리보기의 32MB 한도를 초과했습니다.');
  const bytes = format === 'ttrx' ? (await import('tetr-ttrx')).encode_ttr(source) : source;
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: format === 'ttr' ? 'application/json' : 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `spilink-${replay.spilink.settings.seed}-${replay.spilink.summary.pieces}.${format}`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
