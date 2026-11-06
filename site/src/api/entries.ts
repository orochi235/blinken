import { type Word, words } from '../nav';
import { arrow, body, call, generics, join, type Tok, tok, type as typeOf, width } from './print';
import {
  CONSTRUCTOR,
  type Comment,
  exports,
  KIND,
  type Node,
  type Part,
  type Signature,
} from './typedoc';

/** A doc comment for display, as paragraphs. */
export type Doc = Part[][];

/** One row of a field or parameter table. */
export interface Row {
  name: string;
  /** A member's bare name, which its anchor `api-<Entry>.<key>` is built from. */
  key?: string;
  method?: boolean;
  type: Tok[];
  doc: Doc;
  deprecated: boolean;
}

export interface Entry {
  name: string;
  kind: string;
  word: string;
  signature: Tok[];
  doc: Doc;
  deprecated: boolean;
  members: Row[];
  params: Row[];
}

/** Breaks parts into paragraphs at blank lines, keeping code spans whole. */
export function paragraphs(parts: Part[]): Doc {
  const out: Part[][] = [[]];
  for (const part of parts) {
    if (part.kind !== 'text') {
      out[out.length - 1]?.push(part);
      continue;
    }
    part.text.split(/\n{2,}/).forEach((text, i) => {
      if (i) out.push([]);
      if (text) out[out.length - 1]?.push({ kind: 'text', text });
    });
  }
  return out.filter((para) => para.some((x) => x.text.trim()));
}

const deprecated = (c: Comment | undefined) => !!c?.blockTags?.some((b) => b.tag === '@deprecated');

function wordOf(c: Comment | undefined): string | undefined {
  const tag = c?.blockTags?.find((b) => b.tag === '@category');
  return tag?.content
    .map((p) => p.text)
    .join('')
    .trim();
}

/** The page each module's exports are filed under, by its path in `src/`; a directory takes everything in it. */
const FILED: Record<string, Word> = {
  'marquee.ts': 'sign',
  'marquee-api.ts': 'sign',
  'color.ts': 'sign',
  'pass.ts': 'sign',
  'border.ts': 'sign',
  'render/': 'sign',
  'program.ts': 'program',
  'effects.ts': 'effect',
  'builtins.ts': 'effect',
  'tuning.ts': 'effect',
  'orders.ts': 'effect',
  'params.ts': 'effect',
  'pieces.ts': 'pieces',
  'moves/': 'pieces',
  'modulators/': 'pieces',
  'layers.ts': 'layers',
  'faces.ts': 'text',
  'font.ts': 'text',
  'grid.ts': 'grids',
  'defects.ts': 'hardware',
  'optics.ts': 'hardware',
  'readout/': 'readouts',
  'thumbnail.ts': 'thumbnails',
  'ticker.ts': 'thumbnails',
  'board.ts': 'mix',
  'draw.ts': 'mix',
  'planes.ts': 'mix',
};

/** Exports filed apart from their module's page. */
const MOVED: Record<string, Word> = {
  LayerSpec: 'layers',
  LayerName: 'layers',
  LAYERS: 'layers',
  layerOf: 'layers',
  play: 'mix',
  cueLayer: 'mix',
  cueBorder: 'mix',
  BorderVoice: 'mix',
  SignColumns: 'mix',
};

function fileOf(n: Node): Word | undefined {
  const moved = MOVED[n.name];
  if (moved) return moved;
  const file = n.sources?.[0]?.fileName.replace(/^.*?src\//, '');
  if (!file) return undefined;
  const key = Object.keys(FILED).find((k) => (k.endsWith('/') ? file.startsWith(k) : file === k));
  return key ? FILED[key] : undefined;
}

function member(c: Node): Row {
  const sig = c.signatures?.[0];
  const comment = sig?.comment ?? c.comment;
  return {
    name: `${c.flags?.isReadonly ? 'readonly ' : ''}${c.name}${c.flags?.isOptional ? '?' : ''}`,
    key: c.name,
    method: !!sig,
    type: sig ? arrow(sig) : typeOf(c.type),
    doc: paragraphs(comment?.summary ?? []),
    deprecated: deprecated(comment),
  };
}

/** A function's parameters worth a table: those with their own doc, and the fields of any inline object. */
function params(sig: Signature): Row[] {
  return (sig.parameters ?? []).flatMap((x): Row[] => {
    const fields = x.type?.type === 'reflection' ? (x.type.declaration?.children ?? []) : [];
    if (fields.length)
      return fields.map((f) => ({ ...member(f), name: `${x.name}.${member(f).name}` }));
    if (!x.comment) return [];
    const opt = x.flags?.isOptional || x.defaultValue ? '?' : '';
    return [
      {
        name: `${x.name}${opt}`,
        type: typeOf(x.type),
        doc: paragraphs(x.comment.summary ?? []),
        deprecated: false,
      },
    ];
  });
}

function signature(n: Node, kind: string): Tok[] {
  const sig = n.signatures?.[0];
  const intro = (kw: string) => [tok('kw', kw), tok('punct', ' '), tok('name', n.name)];
  if (kind === 'function' && sig) {
    const lead = intro('function');
    return [...lead, ...call(sig, width(lead))];
  }
  if (kind === 'type') {
    const lead = [...intro('type'), ...generics(n.typeParameters), tok('punct', ' = ')];
    return [...lead, ...body(n.type, width(lead))];
  }
  if (kind === 'const') return [...intro('const'), tok('punct', ': '), ...typeOf(n.type)];
  const ext = n.extendedTypes?.length
    ? [
        tok('punct', ' '),
        tok('kw', 'extends'),
        tok('punct', ' '),
        ...join(n.extendedTypes.map(typeOf), ', '),
      ]
    : [];
  return [
    ...intro(kind === 'class' ? 'class' : 'interface'),
    ...generics(n.typeParameters),
    ...ext,
  ];
}

function entry(n: Node): Entry {
  const kind = KIND[n.kind] ?? 'export';
  const sig = n.signatures?.[0];
  const comment = sig?.comment ?? n.comment;
  const word = wordOf(n.comment) ?? wordOf(sig?.comment) ?? fileOf(n);
  if (!word)
    throw new Error(`site: ${n.name} has no page: add its module to FILED or tag it @category`);
  if (!words.some((w) => w.slug === word))
    throw new Error(`site: ${n.name} is filed under ${word}, which is not a page`);
  const hasMembers = kind === 'interface' || kind === 'class';
  return {
    name: n.name,
    kind,
    word,
    signature: signature(n, kind),
    doc: paragraphs(comment?.summary ?? []),
    deprecated: deprecated(comment),
    members: hasMembers
      ? (n.children ?? []).filter((c) => c.kind !== CONSTRUCTOR && !c.inheritedFrom).map(member)
      : [],
    params: kind === 'function' && sig ? params(sig) : [],
  };
}

export const entries: Entry[] = exports.map(entry).sort((a, b) => a.name.localeCompare(b.name));

export const entriesFor = (word: string): Entry[] => entries.filter((e) => e.word === word);
