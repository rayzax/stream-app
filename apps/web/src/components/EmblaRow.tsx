import useEmblaCarousel from 'embla-carousel-react';
import type { ReactNode } from 'react';

/**
 * Horizontal snap-scrolling row (league sections, poster rails). Headless —
 * Embla only manages scroll/snap behavior; all styling is ours. Touch-first,
 * no arrows on mobile (native swipe), optional on desktop via CSS only
 * (scrollbar stays visible there, which is enough affordance with a mouse).
 */
export default function EmblaRow({ children, className }: { children: ReactNode; className?: string }) {
  const [emblaRef] = useEmblaCarousel({ dragFree: true, containScroll: 'trimSnaps', align: 'start' });

  return (
    <div ref={emblaRef} className={`overflow-hidden ${className ?? ''}`}>
      <div className="flex gap-4 touch-pan-y">{children}</div>
    </div>
  );
}
