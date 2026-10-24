/** How many bits hold any of `n` choices: 0 for one, 1 for two, 3 for five to eight. */
export const widthOf = (n: number) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)));

/** Writes values packed bit by bit, most significant first, into bytes. */
export class BitWriter {
  private bytes: number[] = [];
  private bit = 0;

  /** `v`, an integer from 0 below 2^`width`, in `width` bits. */
  uint(v: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) {
      if (this.bit === 0) this.bytes.push(0);
      const last = this.bytes.length - 1;
      if (Math.floor(v / 2 ** i) % 2)
        this.bytes[last] = (this.bytes[last] as number) | (0x80 >> this.bit);
      this.bit = (this.bit + 1) % 8;
    }
  }

  flag(on: boolean): void {
    this.uint(on ? 1 : 0, 1);
  }

  /** Any count, four bits at a time, each group led by whether another follows. */
  count(v: number): void {
    const groups: number[] = [];
    do {
      groups.unshift(v % 16);
      v = Math.floor(v / 16);
    } while (v > 0);
    groups.forEach((g, i) => {
      this.flag(i < groups.length - 1);
      this.uint(g, 4);
    });
  }

  /** Any safe integer, folded so small negatives stay short. */
  int(v: number): void {
    this.count(v < 0 ? -2 * v - 1 : 2 * v);
  }

  float(v: number): void {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, v);
    for (let i = 0; i < 8; i++) this.uint(view.getUint8(i), 8);
  }

  text(s: string): void {
    const utf8 = new TextEncoder().encode(s);
    this.count(utf8.length);
    for (const b of utf8) this.uint(b, 8);
  }

  done(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** Reads what a BitWriter wrote, throwing a RangeError past the end. */
export class BitReader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}

  uint(width: number): number {
    let v = 0;
    for (let i = 0; i < width; i++, this.at++) {
      const byte = this.bytes[this.at >> 3];
      if (byte === undefined) throw new RangeError('bree: read past the end of a link');
      v = v * 2 + ((byte >> (7 - (this.at & 7))) & 1);
    }
    return v;
  }

  flag(): boolean {
    return this.uint(1) === 1;
  }

  /** One of `n` choices, throwing a RangeError for a number past them. */
  index(n: number): number {
    const i = this.uint(widthOf(n));
    if (i >= n) throw new RangeError('bree: a link names a choice that does not exist');
    return i;
  }

  count(): number {
    let v = 0;
    let more = true;
    while (more) {
      more = this.flag();
      v = v * 16 + this.uint(4);
      if (v > Number.MAX_SAFE_INTEGER) throw new RangeError('bree: a count in a link is too big');
    }
    return v;
  }

  int(): number {
    const v = this.count();
    return v % 2 ? -(v + 1) / 2 : v / 2;
  }

  float(): number {
    const view = new DataView(new ArrayBuffer(8));
    for (let i = 0; i < 8; i++) view.setUint8(i, this.uint(8));
    return view.getFloat64(0);
  }

  text(): string {
    const n = this.count();
    if (n > this.bytes.length) throw new RangeError('bree: read past the end of a link');
    const utf8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) utf8[i] = this.uint(8);
    return new TextDecoder('utf-8', { fatal: true }).decode(utf8);
  }
}
