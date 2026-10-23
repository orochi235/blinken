import { Button, Icon } from '@weasel-js/labkit';

type IconName = Parameters<typeof Icon>[0]['name'];

/** The glyphs the lab's icon buttons draw, from the kit's icon table. */
export const GLYPHS = {
  remove: 'ui:close' as IconName,
  up: 'ui:arrowUp' as IconName,
  down: 'ui:arrowDown' as IconName,
};

/** A small chromeless button showing only a glyph; `label` names it and is its tooltip. */
export function IconButton({
  glyph,
  label,
  onClick,
  disabled,
}: {
  glyph: keyof typeof GLYPHS;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      iconOnly
      ariaLabel={label}
      tooltip={label}
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={GLYPHS[glyph]} size={14} />
    </Button>
  );
}
