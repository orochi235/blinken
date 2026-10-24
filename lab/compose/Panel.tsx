import { MotifFrame } from '@weasel-js/ui';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import type { ReactNode } from 'react';
import './Panel.css';

/** The bar's tint: light enough that the frame inks its title dark, muted so it doesn't glare. */
export const PANEL_TINT = { space: 'srgb', coords: [0.72, 0.72, 0.77] } as const;

/** A 0xRRGGBB color as a frame tint. */
export const tintOf = (hex: number) => ({
  space: 'srgb',
  coords: [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((c) => c / 255),
});

const TOP = stereo({ side: 'top', labelAlign: 'start' });

/**
 * A top-level pane of the lab: a stereo frame whose bar runs along the top, carrying the title and
 * whatever controls the pane puts beside it. `className` lays out its body.
 */
export function Panel({
  title,
  actions,
  className,
  tint = PANEL_TINT,
  children,
}: {
  title: ReactNode;
  /** The bar's color, which the frame inks its title against. Default the lab's muted gray. */
  tint?: { space: string; coords: readonly number[] };
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <MotifFrame
      motif={TOP}
      role="region"
      tint={tint}
      title={title}
      actions={actions && <span className="compose-panel-actions">{actions}</span>}
      className="compose-panel"
    >
      <div className={className}>{children}</div>
    </MotifFrame>
  );
}
