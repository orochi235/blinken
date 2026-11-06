// Copies the built lab (../dist-lab) into the built site, so the lab's pages keep the URLs they had
// before the site: compose.html, play.html and the rest beside the site's own. The lab's index.html,
// which only redirected to play, gives way to the site's home.
import { cpSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const lab = resolve(here, '../dist-lab');
const out = resolve(here, process.env.BLINKEN_SITE_OUT ?? 'dist');
if (!existsSync(lab)) throw new Error(`no built lab at ${lab}: run npm run lab:build first`);
cpSync(lab, out, {
  recursive: true,
  filter: (src) => !(src === resolve(lab, 'index.html') || basename(src) === '.DS_Store'),
});
console.log(`merged the lab into ${out}`);
