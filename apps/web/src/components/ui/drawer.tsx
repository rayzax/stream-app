import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

// Mobile bottom-sheet drawer (vaul) — used for Player's "other live games",
// Admin's game picker on small screens, and detail/filter sheets. Native-
// feeling swipe-to-dismiss, styled to the app's surfaces/tokens.

export function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root shouldScaleBackground {...props} />;
}

export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;

export function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <DrawerPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)]',
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-4 pb-2', className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn('font-display text-lg font-bold', className)} {...props} />;
}
