/** A number a setting is tuned by, with the range a control should offer and its default. */
export interface NumberParam {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly unit?: string;
}

/** A setting that is one of a fixed set of words. */
export interface ChoiceParam {
  readonly label: string;
  readonly choices: readonly string[];
  readonly value: string;
}

/** A setting that is a list of colors, as 0xRRGGBB numbers. */
export interface ColorsParam {
  readonly label: string;
  readonly colors: readonly number[];
}

export type Param = NumberParam | ChoiceParam | ColorsParam;
export type Params = Readonly<Record<string, Param>>;
export type ParamValue = number | string | readonly number[];

/** What a setting of each kind holds. */
export type ValueOf<P extends Param> = P extends NumberParam
  ? number
  : P extends ChoiceParam
    ? string
    : readonly number[];

export type Values<P extends Params> = { readonly [K in keyof P]: ValueOf<P[K]> };

const defaultOf = (param: Param): ParamValue => ('colors' in param ? param.colors : param.value);

/** A thing's defaults with `given` laid over them. */
export function values<P extends Params>(
  of: { readonly params: P },
  given: Partial<Values<P>> = {},
): Values<P> {
  const out: Record<string, ParamValue> = {};
  for (const [key, param] of Object.entries(of.params)) {
    out[key] = (given as Record<string, ParamValue | undefined>)[key] ?? defaultOf(param);
  }
  return out as Values<P>;
}
