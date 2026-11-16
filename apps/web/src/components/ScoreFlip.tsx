import { AnimatePresence, m } from 'motion/react';

/**
 * Short slide+fade when a score value changes, instead of a jarring
 * layout jump. transform/opacity only, 180ms — inside the motion budget.
 * Respects prefers-reduced-motion via the <MotionConfig> each consuming
 * page provides (Main.tsx, Player.tsx) — not mounted at the app root, so
 * pages that never show a score never load Motion at all.
 */
export function ScoreFlip({ value }: { value: string | number }) {
  return (
    <span className="relative inline-block overflow-hidden align-baseline" style={{ minWidth: '1ch' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="inline-block"
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
