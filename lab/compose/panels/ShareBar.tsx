import { Button } from '@weasel-js/labkit';
import { Dialog } from '@weasel-js/ui';
import { useState } from 'react';
import { embedOf } from '../embed.js';
import { useHardware } from '../hardware.js';
import { encode, playable, toCode } from '../share.js';
import { useComposeStore } from '../store.js';
import { FileButtons } from './FileButtons.js';
import './ShareBar.css';

// The clipboard may refuse (a headless browser, an insecure origin), so each also shows.
const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

type Shown = { title: string; text: string; code: boolean } | null;

/** Export in the lab's top bar: the composition as a file, a link, or a `createMarquee` call. */
export function ShareBar() {
  const compose = useComposeStore();
  const { opened } = compose;
  const [shown, setShown] = useState<Shown>(null);
  const [hardware] = useHardware();
  const show = (title: string, text: string, code: boolean) => {
    copy(text);
    setShown({ title, text, code });
  };
  return (
    <fieldset className="compose-share" aria-label="share">
      {opened.unreadable && (
        <span className="compose-warning">
          This link could not be read; your draft is unchanged.
        </span>
      )}
      {opened.dropped.length > 0 && (
        <span className="compose-warning">Left out of the link: {opened.dropped.join('; ')}.</span>
      )}
      <FileButtons />
      <Button
        size="sm"
        onClick={() =>
          show(
            'link copied',
            `${location.origin}${location.pathname}${location.search}#${encode(compose.get())}`,
            false,
          )
        }
      >
        copy link
      </Button>
      <Button
        size="sm"
        tooltip="A link that plays this composition on the player page, with nothing to edit."
        onClick={() =>
          show(
            'player link copied',
            new URL(`play#${encode(playable(compose.get()))}`, location.href).href,
            false,
          )
        }
      >
        copy player link
      </Button>
      <Button size="sm" onClick={() => show('code copied', toCode(compose.get()), true)}>
        copy as code
      </Button>
      <Button
        size="sm"
        tooltip="HTML that plays this composition on any page, on this sign's hardware, through the blinken-player script (npm run compile)."
        onClick={() => show('embed copied', embedOf(compose.get(), hardware), true)}
      >
        copy embed
      </Button>
      {compose.hasPrevious() && (
        <Button
          size="sm"
          tooltip="swap in the last draft a link replaced, keeping this one at the back; press again to step further back through the last five"
          onClick={compose.restorePrevious}
        >
          restore previous draft
        </Button>
      )}
      <Dialog
        isOpen={shown !== null}
        onOpenChange={(open) => {
          if (!open) setShown(null);
        }}
        title={shown?.title}
      >
        <textarea
          className={shown?.code ? 'compose-share-text is-code' : 'compose-share-text'}
          readOnly
          aria-label={shown?.code ? 'this composition as code' : 'link to this composition'}
          rows={shown?.code ? 14 : 3}
          value={shown?.text ?? ''}
          onFocus={(e) => e.currentTarget.select()}
        />
      </Dialog>
    </fieldset>
  );
}
