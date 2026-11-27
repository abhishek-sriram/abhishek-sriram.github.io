/* expo.out, inlined so canvas and ruler math never call GSAP. */
export function settleUnit(amount) {
  return amount >= 1 ? 1 : 1 - 2 ** (-10 * amount);
}
