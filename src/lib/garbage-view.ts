import type { Packet, Receiver } from './garbage.ts';
export type Urgency = 'waiting' | 'warning' | 'ready';
export type GarbageSegment = { id: number; amount: number; urgency: Urgency; remainingFrames: number | null };
export function urgency(packet: Pick<Packet, 'active' | 'status'>): Urgency {
  if (!packet.active || packet.status === 'sleeping' || packet.status === 'caution') return 'waiting';
  return packet.status === 'spawn' ? 'ready' : 'warning';
}
/** Read-only view of the simulation queue; null means a predecessor must resolve first. */
export function garbageSegments(receiver: Receiver, frame: number): GarbageSegment[] {
  const rows: GarbageSegment[] = receiver.pending.map(packet => {
    const timer = receiver.timers.find(t => t.packet.id === packet.id && t.kind !== 'enter');
    let remaining: number | null = null;
    if (packet.active && packet.status === 'spawn') remaining = 0;
    else if (packet.status !== 'sleeping' && timer) {
      remaining = Math.max(0, timer.at - frame);
      if (timer.kind === 'hit') remaining += 2 * packet.delay;
      else if (packet.status === 'caution') remaining += packet.delay;
    }
    return { id: packet.id, amount: packet.amount, urgency: urgency(packet), remainingFrames: remaining };
  });
  // Continuous rows already passed all warning stages and await the placement gate.
  for (const row of receiver.continuous) rows.unshift({ id: -row.packetId - rows.length - 1, amount: 1, urgency: 'ready', remainingFrames: 0 });
  return rows;
}
