// A reserved public code, not a survey wave or a credential. Keep demo answers
// in component memory only; never send them to the response endpoint.
export const PARTICIPANT_DEMO_CODE = "GRACEDEMO";
export const isParticipantDemoCode = (code: unknown): boolean =>
  typeof code === "string" && code.trim().toUpperCase() === PARTICIPANT_DEMO_CODE;
export const PARTICIPANT_DEMO_META = {
  churchName: "Grace Fellowship Community Church",
  waveLabel: "Participant demo",
  isDemo: true,
};
