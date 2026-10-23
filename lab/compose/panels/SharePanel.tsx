import { Button } from '@weasel-js/labkit';
import { useState } from 'react';
import { encode, toCode } from '../share.js';
import { hasPrevious, restorePrevious } from '../storage.js';
import { compose, opened } from '../store.js';
import './SharePanel.css';

// The clipboard may refuse (a headless browser, an insecure origin), so each also shows.
const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

/** Export: the composition as a link, or as a `createMarquee` call. */
export function SharePanel() {
  const [link, setLink] = useState('');
  const [code, setCode] = useState<string | null>(null);
  return (
    <section className="compose-share" aria-label="share">
      <header className="compose-share-head">
        <h2 className="compose-heading">share</h2>
        <Button
          size="sm"
          onClick={() => {
            const url = `${location.origin}${location.pathname}${location.search}#${encode(compose.get())}`;
            setLink(url);
            copy(url);
          }}
        >
          copy link
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const text = toCode(compose.get());
            setCode(text);
            copy(text);
          }}
        >
          copy as code
        </Button>
        {hasPrevious() && (
          <Button
            size="sm"
            tooltip="swap back the draft this link replaced; this one is kept as the previous"
            onClick={() => {
              if (restorePrevious()) location.reload();
            }}
          >
            restore previous draft
          </Button>
        )}
      </header>
      <input
        id="link"
        className="compose-share-link"
        type="text"
        readOnly
        aria-label="link to this composition"
        placeholder="the link shows here"
        value={link}
        onFocus={(e) => e.currentTarget.select()}
      />
      {code !== null && (
        <textarea
          id="code"
          className="compose-share-code"
          readOnly
          aria-label="this composition as code"
          rows={12}
          value={code}
        />
      )}
      {opened.unreadable && (
        <p className="compose-warning">This link could not be read; your draft is unchanged.</p>
      )}
      {opened.dropped.length > 0 && (
        <p className="compose-warning">Left out of the link: {opened.dropped.join('; ')}.</p>
      )}
    </section>
  );
}
