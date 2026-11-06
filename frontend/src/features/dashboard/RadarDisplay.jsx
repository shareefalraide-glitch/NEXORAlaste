import React, { useEffect, useRef } from 'react';

// Decorative demo only: the sweep and dots do not represent live monitoring.
// Native browser animation stays independent of requestAnimationFrame; a timer
// based on elapsed time takes over if animation is unavailable or stalls.
export default function RadarDisplay() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current,
      sweep = root?.querySelector('.radar-sweep'),
      pulses = [...(root?.querySelectorAll('.radar-signal-pulse') || [])];
    if (!root || !sweep || pulses.length !== 3) return undefined;
    const duration = 3200,
      pulseDuration = 1650;
    let animations = [],
      mode = 'native',
      running = null,
      disposed = false,
      monitor = 0,
      timer = 0,
      manualStart = performance.now(),
      manualAngle = 0,
      lastTransform = '',
      lastChange = performance.now();
    const clearTimers = () => {
      if (monitor) clearTimeout(monitor);
      if (timer) clearTimeout(timer);
      monitor = 0;
      timer = 0;
    };
    const visible = () => {
      const r = root.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.right > 0 &&
        r.bottom > 0 &&
        r.left < innerWidth &&
        r.top < innerHeight
      );
    };
    const angle = () => {
      const matrix = getComputedStyle(sweep).transform.match(/^matrix\(([^)]+)\)$/);
      if (!matrix) return 0;
      const values = matrix[1].split(',').map(Number);
      return (Math.atan2(values[1], values[0]) * 180) / Math.PI;
    };
    const paint = () => {
      timer = 0;
      if (disposed || !running || mode !== 'manual') return;
      const elapsed = Math.max(0, performance.now() - manualStart);
      sweep.style.transform = `rotate(${manualAngle + (elapsed * 360) / duration}deg)`;
      pulses.forEach((pulse, index) => {
        const phase = ((elapsed + (index * pulseDuration) / 3) % pulseDuration) / pulseDuration;
        pulse.style.transform = `scale(${(0.65 + phase * 1.65).toFixed(3)})`;
        pulse.style.opacity = (0.85 * (1 - phase)).toFixed(3);
      });
      timer = setTimeout(paint, 33);
    };
    const activateManualMotion = () => {
      if (disposed || mode === 'manual') return;
      const current = angle();
      clearTimers();
      animations.forEach(a => a.cancel());
      animations = [];
      mode = 'manual';
      root.dataset.engine = 'manual';
      manualAngle = current;
      manualStart = performance.now();
      if (running) paint();
    };
    const check = () => {
      monitor = 0;
      if (disposed || !running || mode !== 'native') return;
      const current = getComputedStyle(sweep).transform,
        now = performance.now();
      if (current !== lastTransform) {
        lastTransform = current;
        lastChange = now;
      } else if (now - lastChange >= 1600) {
        activateManualMotion();
        return;
      }
      monitor = setTimeout(check, 500);
    };
    try {
      if (typeof sweep.animate !== 'function' || pulses.some(p => typeof p.animate !== 'function'))
        throw Error('animation unavailable');
      animations.push(
        sweep.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
          duration,
          iterations: Infinity,
          easing: 'linear',
        }),
      );
      pulses.forEach((pulse, index) =>
        animations.push(
          pulse.animate(
            [
              { transform: 'scale(.65)', opacity: 0.85 },
              { transform: 'scale(2.3)', opacity: 0 },
            ],
            {
              duration: pulseDuration,
              delay: (-index * pulseDuration) / 3,
              iterations: Infinity,
              easing: 'ease-out',
            },
          ),
        ),
      );
    } catch {
      animations.forEach(a => a.cancel());
      animations = [];
      mode = 'manual';
      root.dataset.engine = 'manual';
    }
    const refresh = () => {
      if (disposed) return;
      const shouldRun = visible() && !document.hidden;
      if (shouldRun === running) return;
      running = shouldRun;
      root.dataset.motion = running ? 'animated' : 'offscreen';
      clearTimers();
      if (!running) {
        if (mode === 'native') animations.forEach(a => a.pause());
        return;
      }
      if (mode === 'native') {
        animations.forEach(a => a.play());
        lastTransform = getComputedStyle(sweep).transform;
        lastChange = performance.now();
        monitor = setTimeout(check, 500);
      } else {
        manualStart = performance.now();
        manualAngle = angle();
        paint();
      }
    };
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      disposed = true;
      clearTimers();
      animations.forEach(a => a.cancel());
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="radar-display"
      data-testid="overview-radar"
      data-motion="animated"
      data-engine="native"
      role="img"
      aria-label="رادار توضيحي متحرك؛ النقاط شكلية وليست رصدًا حيًا"
      dir="ltr"
    >
      <div className="radar-scope" aria-hidden="true">
        <span className="radar-ring radar-ring-outer" />
        <span className="radar-ring radar-ring-middle" />
        <span className="radar-ring radar-ring-inner" />
        <span className="radar-axis radar-axis-h" />
        <span className="radar-axis radar-axis-v" />
        <span className="radar-sweep" />
        <span className="radar-crosshair" />
        <span className="radar-mark radar-mark-top">N</span>
        <span className="radar-mark radar-mark-bottom">S</span>
        {[
          ['68%', '29%', 'cyan'],
          ['31%', '42%', 'blue'],
          ['65%', '73%', 'amber'],
        ].map(([x, y, tone]) => (
          <span className={`radar-signal ${tone}`} style={{ '--x': x, '--y': y }} key={tone}>
            <i className="radar-signal-pulse" />
            <i className="radar-signal-core" />
          </span>
        ))}
      </div>
    </div>
  );
}
