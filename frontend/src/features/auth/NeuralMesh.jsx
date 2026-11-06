import React, { useEffect, useRef } from 'react';

/**
 * The NeuralMesh globe from nexora-clean's Login.jsx. The same Fibonacci
 * sphere, proximity links, projection, colors, travelers and red nodes are
 * retained; theme selection, lifecycle and reduced motion are adapted here.
 * Everything is decorative and generated locally, not live network activity.
 */
export default function NeuralMesh({ theme, motionMode = 'auto', onMotionState }) {
  const canvasRef = useRef(null);
  const motionModeRef = useRef(motionMode);
  const refreshMotionRef = useRef(null);

  // A manual play/pause choice takes precedence until the login screen closes.
  // It does not change the operating system's motion preference.
  useEffect(() => {
    motionModeRef.current = motionMode;
    refreshMotionRef.current?.();
  }, [motionMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) {
      onMotionState?.('unavailable');
      return undefined;
    }

    // Keep random decorative details stable across theme changes, including
    // when the user's reduced-motion preference calls for a single frame.
    let seed = 82171;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = 190;
    const nodes = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = golden * i;
      nodes.push({
        x: Math.cos(angle) * radius,
        y,
        z: Math.sin(angle) * radius,
        red: false,
        phase: random() * 6.28,
      });
    }
    const redNodes = [17, 58, 101, 142, 169];
    redNodes.forEach(index => {
      nodes[index].red = true;
    });
    const pairs = [];
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const distance = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        if (distance < 0.155) pairs.push([i, j]);
      }
    }
    const travelers = Array.from({ length: 26 }, () => ({
      pair: Math.floor(random() * pairs.length),
      t: random(),
      speed: 0.004 + random() * 0.009,
    }));
    const flashes = [];
    const palettes = {
      dark: {
        edge: 'rgba(56,150,235,',
        edgeBase: 0.3,
        node: 'rgba(103,232,249,',
        nodeA0: 0.5,
        nodeA1: 0.3,
        glow: '#22d3ee',
        glowR: 7,
        travel: 'rgba(103,232,249,.95)',
        travelR: 9,
        fadeEnd: 'rgba(7,9,13,0)',
      },
      light: {
        edge: 'rgba(28,88,158,',
        edgeBase: 0.42,
        node: 'rgba(8,120,150,',
        nodeA0: 0.66,
        nodeA1: 0.3,
        glow: '#0e7490',
        glowR: 3,
        travel: 'rgba(8,120,150,.95)',
        travelR: 4,
        fadeEnd: 'rgba(247,249,252,0)',
      },
    };
    const palette = palettes[theme === 'light' ? 'light' : 'dark'];
    // Reuse tiny pre-rendered glow sprites rather than blurring every dot on
    // every frame, which is expensive on mobile and high-density displays.
    const makeGlowSprite = (fill, blur) => {
      const sprite = document.createElement('canvas');
      sprite.width = 64;
      sprite.height = 64;
      const brush = sprite.getContext('2d');
      brush.shadowColor = palette.glow;
      brush.shadowBlur = blur;
      brush.fillStyle = fill;
      brush.beginPath();
      brush.arc(32, 32, 6, 0, Math.PI * 2);
      brush.fill();
      return sprite;
    };
    const nodeSprite = makeGlowSprite(`${palette.node}1)`, 15);
    const travelerSprite = makeGlowSprite(palette.travel, 19);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let ratio = 1;
    let rotY = 0;
    let rotX = -0.18;
    let spin = 0.3;
    let elapsed = 0;
    let frame = 0;
    let preferencePoll = 0;
    let frameWatchdog = 0;
    let lastFrame = 0;
    // IntersectionObserver can report a false negative in an embedded
    // preview. Keep track of the element's local viewport separately.
    let onScreen = true;
    let locallyVisible = true;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let disposed = false;

    const motionState = () => {
      if (motionModeRef.current === 'on') return 'animated';
      if (motionModeRef.current === 'off') return 'paused';
      return reduced.matches ? 'reduced' : 'animated';
    };
    const isLocallyVisible = () => {
      const rect = parent.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      );
    };
    const canAnimate = () =>
      !disposed && motionState() === 'animated' && locallyVisible && !document.hidden;
    const setMotionState = () => {
      const state = motionState();
      canvas.dataset.motion = state;
      onMotionState?.(state, reduced.matches);
    };
    const stop = () => {
      if (frame && window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
      if (preferencePoll) window.clearTimeout(preferencePoll);
      if (frameWatchdog) window.clearTimeout(frameWatchdog);
      frame = 0;
      preferencePoll = 0;
      frameWatchdog = 0;
      lastFrame = 0;
    };
    const schedule = () => {
      if (!canAnimate()) return;
      if (!frame && window.requestAnimationFrame) frame = window.requestAnimationFrame(tick);
      // In some embedded or power-saving contexts animation frames can be
      // starved while timers still run. Recover without drawing twice normally.
      // When the host reports offscreen but local geometry says visible, keep
      // RAF alive and use a slower watchdog to avoid unnecessary background work.
      if (!frameWatchdog) frameWatchdog = window.setTimeout(watchFrames, onScreen ? 400 : 1200);
    };
    function watchFrames() {
      frameWatchdog = 0;
      if (!canAnimate()) return;
      const now = performance.now();
      if (!lastFrame || now - lastFrame > (onScreen ? 320 : 900)) {
        if (frame && window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
        frame = 0;
        tick(now);
      }
      schedule();
    }
    const draw = delta => {
      if (!width || !height) return;
      // A slightly gentler pace for rotation, tilt, travelers and pulses.
      const elapsedFrames = delta * 60 * 0.85;
      elapsed += delta * 0.82;
      // The reference's horizontal formula determines which way the mesh
      // turns and its tilt follows vertical pointer movement. Give that speed
      // a visible floor: the original formula has a pointer position that
      // cancels rotation altogether, contrary to the requested autoplay.
      const referenceSpin = 0.0021 + (pointerX - 0.5) * 0.012;
      const targetSpin =
        (referenceSpin < 0 ? -1 : 1) * (0.25 + 0.2 * Math.min(1, Math.abs(referenceSpin) / 0.0081));
      // Ease reversals instead of jumping abruptly; once settled, no pointer
      // position leaves the sphere at rest. The time-based easing also works
      // on throttled displays and in the timer fallback.
      spin += (targetSpin - spin) * (1 - Math.exp(-delta * 5));
      rotY += spin * delta;
      const targetX = -0.18 + (pointerY - 0.5) * 0.5;
      rotX += (targetX - rotX) * (1 - Math.pow(0.96, elapsedFrames));
      // Non-rendered diagnostics verify geometry rather than blinking dots.
      canvas.__nexoraRotation = rotY;
      canvas.__nexoraTilt = rotX;
      const cx = width / 2;
      const cy = height * 0.5;
      // Use more of the square canvas for the larger reference-style sphere,
      // while retaining a transparent safety inset for node glows and rings.
      const scale = Math.min(width, height) * 0.41;
      // Keep fine details legible instead of crowding together on phones.
      const detailScale = Math.max(0.5, Math.min(1, Math.min(width, height) / 380));
      const cosineY = Math.cos(rotY);
      const sineY = Math.sin(rotY);
      const cosineX = Math.cos(rotX);
      const sineX = Math.sin(rotX);
      const projected = nodes.map(node => {
        const x = node.x * cosineY + node.z * sineY;
        const z = -node.x * sineY + node.z * cosineY;
        const y2 = node.y * cosineX - z * sineX;
        const z2 = node.y * sineX + z * cosineX;
        const perspective = 2.6 / (2.6 + z2);
        return {
          sx: cx + x * scale * perspective,
          sy: cy + y2 * scale * perspective,
          z: z2,
          perspective,
        };
      });
      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.2);
      glow.addColorStop(0, `rgba(34,211,238,${(0.1 + 0.03 * Math.sin(elapsed * 1.4)).toFixed(3)})`);
      glow.addColorStop(0.45, 'rgba(59,130,246,.06)');
      glow.addColorStop(1, palette.fadeEnd);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Batch nearby-alpha paths. This preserves the reference's appearance
      // while avoiding hundreds of expensive stroke and glow operations per
      // frame on high-density screens and slower devices.
      const edgeBins = Array.from({ length: 33 }, () => []);
      for (const [i, j] of pairs) {
        const depth = (projected[i].z + projected[j].z) / 2;
        const alpha = Math.max(0.03, palette.edgeBase - depth * 0.16);
        const bucket = Math.max(1, Math.min(32, Math.round(alpha * 32)));
        edgeBins[bucket].push(i, j);
      }
      ctx.lineWidth = Math.max(0.35, Math.max(1 / ratio, 0.7) * detailScale);
      for (let bucket = 1; bucket < edgeBins.length; bucket += 1) {
        const bin = edgeBins[bucket];
        if (!bin.length) continue;
        ctx.strokeStyle = `${palette.edge}${(bucket / 32).toFixed(3)})`;
        ctx.beginPath();
        for (let k = 0; k < bin.length; k += 2) {
          const a = projected[bin[k]];
          const b = projected[bin[k + 1]];
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
        }
        ctx.stroke();
      }

      const drawSprite = (sprite, x, y, radius) => {
        const side = (64 / 6) * radius;
        ctx.drawImage(sprite, x - side / 2, y - side / 2, side, side);
      };
      for (const traveler of travelers) {
        traveler.t += traveler.speed * elapsedFrames;
        if (traveler.t >= 1) {
          traveler.t = 0;
          traveler.pair = Math.floor(random() * pairs.length);
        }
        const [i, j] = pairs[traveler.pair];
        const a = projected[i];
        const b = projected[j];
        const x = a.sx + (b.sx - a.sx) * traveler.t;
        const y = a.sy + (b.sy - a.sy) * traveler.t;
        drawSprite(travelerSprite, x, y, 1.9 * detailScale);
      }
      for (let i = 0; i < count; i += 1) {
        if (nodes[i].red) continue;
        const point = projected[i];
        const size = 2.6 * point.perspective * detailScale;
        ctx.globalAlpha = Math.min(1, palette.nodeA0 + palette.nodeA1 * point.perspective);
        drawSprite(nodeSprite, point.sx, point.sy, size);
      }
      ctx.globalAlpha = 1;
      for (const index of redNodes) {
        const point = projected[index];
        const node = nodes[index];
        const size = 3.4 * point.perspective * detailScale;
        const pulse = 0.55 + 0.45 * Math.sin(elapsed * 2.6 + node.phase);
        ctx.fillStyle = `rgba(255,77,95,${(0.55 + 0.45 * pulse).toFixed(2)})`;
        ctx.shadowColor = '#ff4d5f';
        ctx.shadowBlur = 13 * ratio * pulse * detailScale;
        ctx.strokeStyle = `rgba(255,77,95,${(0.35 * pulse).toFixed(2)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(point.sx, point.sy, size * (2.4 + pulse), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.sx, point.sy, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // Flash frequency, size and fade use the reference's 60fps values,
      // converted to elapsed time so display refresh rates do not change speed.
      if (delta > 0 && random() < 1 - Math.pow(1 - 0.012, elapsedFrames)) {
        flashes.push({
          index: redNodes[Math.floor(random() * redNodes.length)],
          radius: 0,
          alpha: 0.8,
        });
      }
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        const flash = flashes[i];
        const point = projected[flash.index];
        flash.radius += 0.9 * elapsedFrames;
        flash.alpha -= 0.028 * elapsedFrames;
        if (flash.alpha <= 0) {
          flashes.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(52,211,153,${flash.alpha.toFixed(2)})`;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 10 * ratio * detailScale;
        ctx.beginPath();
        ctx.arc(point.sx, point.sy, flash.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };
    function tick(time) {
      frame = 0;
      // Some browser emulators update MediaQueryList.matches before dispatching
      // its change event. Detect that on the next frame too.
      if (canvas.dataset.motion !== motionState()) {
        refresh();
        return;
      }
      if (!canAnimate()) return;
      // Draw at most ~30fps; stop entirely in hidden tabs and offscreen.
      if (lastFrame && time - lastFrame < 32) {
        schedule();
        return;
      }
      // Use real elapsed time even at low frame rates; the old 50ms cap
      // slowed the rotation 20× at one frame per second. A higher cap avoids
      // a huge jump after an exceptionally long foreground stall.
      const delta = lastFrame ? Math.min(Math.max((time - lastFrame) / 1000, 0), 2) : 0;
      lastFrame = time;
      draw(delta);
      schedule();
    }
    const pollPreference = () => {
      if (
        disposed ||
        document.hidden ||
        !locallyVisible ||
        motionModeRef.current !== 'auto' ||
        !reduced.matches ||
        preferencePoll
      )
        return;
      // A low-frequency fallback only while the image is static. It handles a
      // missing/delayed MediaQueryList change event without animating the mesh.
      preferencePoll = window.setTimeout(() => {
        preferencePoll = 0;
        if (disposed) return;
        if (motionModeRef.current !== 'auto' || !reduced.matches) refresh();
        else pollPreference();
      }, 500);
    };
    const refresh = () => {
      stop();
      setMotionState();
      // No rotation, pulsing, flashes or frame requests when paused/reduced.
      if (motionState() !== 'animated') flashes.length = 0;
      draw(0);
      schedule();
      pollPreference();
    };
    const resize = () => {
      const newWidth = parent.clientWidth;
      const newHeight = parent.clientHeight;
      const wasLocallyVisible = locallyVisible;
      locallyVisible = isLocallyVisible();
      // Decorative details remain crisp at 1.5× while limiting pixel work.
      const newRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const pixelWidth = Math.round(newWidth * newRatio);
      const pixelHeight = Math.round(newHeight * newRatio);
      if (
        width === newWidth &&
        height === newHeight &&
        ratio === newRatio &&
        canvas.width === pixelWidth &&
        canvas.height === pixelHeight
      ) {
        if (wasLocallyVisible !== locallyVisible) {
          if (canAnimate()) refresh();
          else stop();
        }
        return;
      }
      width = newWidth;
      height = newHeight;
      ratio = newRatio;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      refresh();
    };
    const visibilityChange = () => {
      if (document.hidden) stop();
      else {
        locallyVisible = isLocallyVisible();
        refresh();
      }
    };
    const viewportChange = () => {
      const visible = isLocallyVisible();
      if (visible === locallyVisible) return;
      locallyVisible = visible;
      if (canAnimate()) refresh();
      else stop();
    };
    const onPointerMove = event => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const rect = (parent.closest('.auth-aside') || parent).getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    const intersection =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(entries => {
            onScreen = entries.some(entry => entry.isIntersecting);
            viewportChange();
            if (canAnimate()) {
              // Do not freeze a locally visible globe solely on an embedded host's
              // false intersection report. Adjust the watchdog to the new state.
              if (frameWatchdog) window.clearTimeout(frameWatchdog);
              frameWatchdog = 0;
              schedule();
            } else stop();
          })
        : null;
    observer?.observe(parent);
    intersection?.observe(parent);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', viewportChange, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', visibilityChange);
    const onReducedMotionChange = () => {
      if (motionModeRef.current === 'auto') refresh();
      else setMotionState();
    };
    if (reduced.addEventListener) reduced.addEventListener('change', onReducedMotionChange);
    else reduced.addListener(onReducedMotionChange);
    refreshMotionRef.current = refresh;
    resize();
    setMotionState();

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      intersection?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', viewportChange);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', visibilityChange);
      if (refreshMotionRef.current === refresh) refreshMotionRef.current = null;
      if (reduced.removeEventListener) reduced.removeEventListener('change', onReducedMotionChange);
      else reduced.removeListener(onReducedMotionChange);
    };
  }, [theme, onMotionState]);

  return (
    <canvas ref={canvasRef} className="neural-mesh" data-testid="neural-mesh" aria-hidden="true" />
  );
}
