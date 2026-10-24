import { Button, Icon } from '@weasel-js/labkit';
import './IconButton.css';

type IconName = Parameters<typeof Icon>[0]['name'];

/** The glyphs the lab's icon buttons draw, from the kit's icon table. */
export const GLYPHS = {
  remove: 'trash',
  up: 'ui:arrowUp' as IconName,
  down: 'ui:arrowDown' as IconName,
  undo: 'core:undo' as IconName,
  redo: 'core:redo' as IconName,
  add: 'ui:add' as IconName,
  loop: 'ui:loop' as IconName,
  rewind: 'ui:rewind' as IconName,
  image: 'core:image' as IconName,
  play: 'ui:play' as IconName,
  pause: 'ui:pause' as IconName,
  stepBack: 'ui:stepBack' as IconName,
  stepForward: 'ui:stepForward' as IconName,
};

/**
 * A chromeless button showing only a glyph; `label` names it and is its tooltip. With
 * `pressed`, it is a toggle that stays down while on.
 */
export function IconButton({
  glyph,
  label,
  onClick,
  disabled,
  pressed,
}: {
  glyph: keyof typeof GLYPHS;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Button
      iconOnly
      ariaLabel={label}
      tooltip={label}
      variant="ghost"
      size="md"
      className="compose-icon-button"
      disabled={disabled}
      pressed={pressed}
      onClick={onClick}
    >
      {glyph === 'remove' ? <Trash /> : <Icon name={GLYPHS[glyph] as IconName} />}
    </Button>
  );
}

/** A trash can, which the kit's icon table lacks. */
function Trash() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v5M9.2 6.5v5" />
    </svg>
  );
}
