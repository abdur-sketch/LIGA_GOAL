export type RealtimeMessage = {
  sequence: bigint;
  topic: string;
  payload: unknown;
};

export function reconnectMessages(
  snapshot: RealtimeMessage,
  messages: RealtimeMessage[],
  lastSequence?: bigint,
) {
  if (lastSequence === undefined) return [snapshot];
  const missed = messages
    .filter((message) => message.sequence > lastSequence)
    .sort((a, b) => Number(a.sequence - b.sequence));
  return missed.length ? missed : [snapshot];
}
