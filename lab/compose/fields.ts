import {
  defaultOf,
  fits,
  type NumberParam,
  ORDERS,
  type Order,
  type Params,
  type ParamValue,
} from '@/index.js';
import { type BitReader, type BitWriter, widthOf } from './bits.js';
import { HEX, isSeed } from './readers.js';
import { LAG } from './state.js';

/* Numbers, settings and orders in bits: each number a count of its setting's steps. */

const stepsOf = (p: NumberParam) => Math.round((p.max - p.min) / p.step);
const onStep = (p: NumberParam, k: number) => Number((p.min + k * p.step).toPrecision(12));
const same = (a: ParamValue, b: ParamValue) => JSON.stringify(a) === JSON.stringify(b);

/** A number as its count of `p`'s steps; one off its steps or range escapes to a full float. */
export function writeNumber(w: BitWriter, p: NumberParam, v: number): void {
  const steps = stepsOf(p);
  const k = Math.round((v - p.min) / p.step);
  if (k >= 0 && k <= steps && onStep(p, k) === v) w.uint(k, widthOf(steps + 2));
  else {
    w.uint(steps + 1, widthOf(steps + 2));
    w.float(v);
  }
}

export function readNumber(r: BitReader, p: NumberParam): number {
  const k = r.index(stepsOf(p) + 2);
  return k === stepsOf(p) + 1 ? r.float() : onStep(p, k);
}

/** Each of `params` that differs from `base`'s or its own default, flagged in the params' order. */
export function writeParams(
  w: BitWriter,
  params: Params,
  given: Readonly<Record<string, ParamValue>> | undefined,
  base: Readonly<Record<string, ParamValue>> = {},
): void {
  for (const [key, p] of Object.entries(params)) {
    const v = given?.[key];
    const kept = v !== undefined && fits(p, v) && !same(v, base[key] ?? defaultOf(p));
    w.flag(kept);
    if (!kept) continue;
    if ('colors' in p) {
      w.count((v as number[]).length);
      for (const c of v as number[]) writeNumber(w, HEX, c);
    } else if ('choices' in p) w.uint(p.choices.indexOf(v as string), widthOf(p.choices.length));
    else writeNumber(w, p, v as number);
  }
}

export function readParams(r: BitReader, params: Params): Record<string, ParamValue> | undefined {
  const out: Record<string, ParamValue> = {};
  for (const [key, p] of Object.entries(params)) {
    if (!r.flag()) continue;
    if ('colors' in p) out[key] = Array.from({ length: r.count() }, () => readNumber(r, HEX));
    else if ('choices' in p) out[key] = p.choices[r.index(p.choices.length)] as string;
    else out[key] = readNumber(r, p);
  }
  return Object.keys(out).length ? out : undefined;
}

export function writeOrder(w: BitWriter, order: Order | undefined): void {
  w.flag(order !== undefined);
  if (!order) return;
  w.uint(ORDERS.indexOf(order.by), widthOf(ORDERS.length));
  w.flag(order.lag !== undefined);
  if (order.lag !== undefined) writeNumber(w, LAG, order.lag);
  const seed = isSeed(order.seed) ? order.seed : undefined;
  w.flag(seed !== undefined);
  if (seed !== undefined) w.int(seed);
}

export function readOrder(r: BitReader): Order | undefined {
  if (!r.flag()) return undefined;
  const by = ORDERS[r.index(ORDERS.length)] as Order['by'];
  const lag = r.flag() ? readNumber(r, LAG) : undefined;
  const seed = r.flag() ? r.int() : undefined;
  return { by, ...(lag !== undefined && { lag }), ...(seed !== undefined && { seed }) };
}
