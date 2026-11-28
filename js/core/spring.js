export const STIFFNESS = 170;
export const DAMPING = 14;

export function stepSpring(channel, target, dt) {
  let remaining = dt;
  while (remaining > 0.0001) {
    const step = remaining > 0.008 ? 0.008 : remaining;
    const accel = -STIFFNESS * (channel.value - target) - DAMPING * channel.velocity;
    channel.velocity += accel * step;
    channel.value += channel.velocity * step;
    remaining -= step;
  }
}
