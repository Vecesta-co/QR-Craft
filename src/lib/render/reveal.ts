/**
 * Shared reveal cursor for instanced block materials. The construction engine
 * applies blocks in build-plan order; this value is the number of placements
 * applied so far. A negative value shows only pre-existing terrain.
 */
export const revealState = {
  applied: 0,
  total: 0,
};

/** The uniform object shared by every instanced block material. */
export const revealUniform = { value: 0 };

export function resetReveal(total: number): void {
  revealState.applied = 0;
  revealState.total = total;
  revealUniform.value = 0;
}
