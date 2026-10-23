import { Select, type SelectProps } from '@weasel-js/labkit';

/** The lab's one dropdown: its closed handle is the value as underlined text, with no box. */
export const PlainSelect = (props: SelectProps) => (
  <Select variant="bare" indicator="underline" width="fit" {...props} />
);
