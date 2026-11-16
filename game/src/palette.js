// SABLE YARD — palette: every colour the yard, the teams and the HUD use.
// One place for the art direction: dusk purple-orange sky, warm lamps,
// rust red / olive / slate blue / teal containers, blue Vanguard, teal Wardens.
export const PAL = {
  // Sky and light
  skyTop: 0x2b1d4e,
  skyMid: 0x7a3b5e,
  skyLow: 0xe07b39,
  fog: 0x4a2c4a,
  sun: 0xffb36b,
  sunIntensity: 1.6,
  hemiSky: 0x8a6bb0,
  hemiGround: 0x3a2a24,
  rim: 0x7fb4ff,
  lamp: 0xffc06a,
  // Ground and structures
  concrete: 0x6f6a61,
  concreteDark: 0x55504a,
  rust: 0x8a4a28,
  containerRed: 0x9e3b2e,
  containerOlive: 0x6b6f3a,
  containerBlue: 0x3d5a78,
  containerTeal: 0x2e7a72,
  crateWood: 0x8a6a42,
  barrelYellow: 0xc79a2e,
  barrelGrey: 0x5a6068,
  sandbag: 0x9a8a68,
  fence: 0x8a929a,
  silo: 0x7a7f88,
  crane: 0xd8a03a,
  skyline: 0x241a33,
  windowLit: 0xffd27a,
  // Teams
  vanguard: 0x2f7fe0,
  vanguardDark: 0x1d4f96,
  vanguardStripe: 0x59a8ff,
  warden: 0x12b5a5,
  wardenDark: 0x0b6e64,
  wardenStripe: 0x3fe0c8,
  // Gear
  helmet: 0x3a3f35,
  vest: 0x2e2a24,
  skin: 0xc79a72,
  goggles: 0x14181f,
  mask: 0x22201c,
  gunMetal: 0x1e2126,
  gunGrip: 0x3a2c1e,
  boots: 0x241d16,
  // HUD and effects
  hudText: 0xf2ead8,
  hudDim: 0xb8a888,
  hudGood: 0x7ee08a,
  hudBad: 0xff5a4a,
  hudGold: 0xffc94a,
  tracer: 0xffd27a,
  spark: 0xffc46a,
  muzzle: 0xffe9a8,
  siteA: 0xffc94a,
  siteB: 0x59d8ff,
};

export function teamHex(team) {
  return team === 'vanguard' ? PAL.vanguard : PAL.warden;
}
export function teamDarkHex(team) {
  return team === 'vanguard' ? PAL.vanguardDark : PAL.wardenDark;
}
export function teamStripeHex(team) {
  return team === 'vanguard' ? PAL.vanguardStripe : PAL.wardenStripe;
}
export function css(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
