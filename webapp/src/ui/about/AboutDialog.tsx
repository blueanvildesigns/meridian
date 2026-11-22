// About (spec 4.6; canvas About, AboutPhone): who made Meridian, Ko-fi, where data lives, and the
// credits GeoNames' licence requires (plus OurAirports', which isn't required, M4-1). A dialog on
// wide screens, a full sheet on phones. The storage banner's "What can I do?" opens it on
// "Your data stays with you".

import { useId } from 'react';
import { KOFI_URL } from '../../app/links';
import { CITY_DATA_DATE } from '../../cities/zoneData';
import { formatShortDate } from '../../time/format';
import buttons from '../buttons.module.css';
import { Dialog } from '../dialog/Dialog';
import { CloseIcon, HeartIcon, LogoMark } from '../icons';
import styles from './AboutDialog.module.css';

/** The board's link; the domain showed a parked page when M6 was built (M6 decisions). */
export const SITE_URL = 'https://blueanvildesigns.com';

/** "2026-11-18" → "Nov 18, 2026". */
function dataDate(iso: string): string {
  const [year = 0, month = 0, day = 0] = iso.split('-').map(Number);
  return formatShortDate({ year, month, day });
}

function External({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
      {children}
    </a>
  );
}

export interface AboutDialogProps {
  /** Start on "Your data stays with you" (the storage banner's help link, D19). */
  focusData?: boolean;
  /** GitHub's bug form with the diagnostics filled in (`bugReportUrl()`). */
  reportUrl: string;
  onClose: () => void;
}

export function AboutDialog({ focusData = false, reportUrl, onClose }: AboutDialogProps) {
  const id = useId();
  return (
    <Dialog labelledBy={`${id}-title`} onClose={onClose} fit className={styles.dialog}>
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={styles.title}>
            About
          </h2>
          <button
            type="button"
            className={`${buttons.icon} ${styles.close}`}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon size={22} />
          </button>
        </div>

        <div className={styles.brand}>
          <span className={styles.logo}>
            <LogoMark size={48} />
          </span>
          <div>
            <p className={styles.name}>Meridian</p>
            <p className={styles.tagline}>
              A world clock for planning across time zones · Version {__APP_VERSION__} (
              {__BUILD_SHA__})
            </p>
          </div>
        </div>

        <section className={styles.section} aria-labelledby={`${id}-maker`}>
          <h3 id={`${id}-maker`} className={styles.sectionTitle}>
            Made by Blue Anvil Designs
          </h3>
          <p className={styles.text}>
            Built and maintained by Graham.{' '}
            <External href={SITE_URL}>blueanvildesigns.com</External>
          </p>
        </section>

        <p className={styles.support}>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttons.primary} ${styles.kofi}`}
          >
            <HeartIcon size={18} />
            Support on Ko-fi
          </a>
        </p>

        <section className={styles.section} aria-labelledby={`${id}-data`}>
          <h3
            id={`${id}-data`}
            className={styles.sectionTitle}
            tabIndex={-1}
            {...(focusData ? { 'data-autofocus': true } : {})}
          >
            Your data stays with you
          </h3>
          <p className={styles.text}>
            Your cities and settings are saved in this browser only. Meridian has no accounts and
            sends nothing to a server.
          </p>
          {/* Not drawn: the help the storage banner links to (D19). */}
          <p className={styles.text}>
            If Meridian says it can’t save, this browser is blocking site data, as private browsing
            often does. Allow site data for this site, or use a normal window, to keep your cities.
          </p>
        </section>

        {/* Not drawn (docs/archive/2026-11-21-bug-reporting.md): styled like the sections around it. */}
        <section className={styles.section} aria-labelledby={`${id}-bug`}>
          <h3 id={`${id}-bug`} className={styles.sectionTitle}>
            Found a bug?
          </h3>
          <p className={styles.text}>
            <External href={reportUrl}>Report a bug</External> on GitHub. The form opens with
            Meridian’s version, your browser, time zone and time format filled in, so you can check
            them before you send. Your cities aren’t included.
          </p>
        </section>

        <section className={styles.section} aria-labelledby={`${id}-credits`}>
          <h3 id={`${id}-credits`} className={styles.sectionTitle}>
            Credits
          </h3>
          <p className={styles.text}>
            City names, locations and time zones come from{' '}
            <External href="https://www.geonames.org/">GeoNames</External> (
            <External href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</External>
            ), as of {dataDate(CITY_DATA_DATE)}. Airport codes come from{' '}
            <External href="https://ourairports.com/">OurAirports</External> (public domain). Time
            zone rules come from your browser, so daylight saving changes stay current.
          </p>
          <p className={styles.text}>Free and open source under the MIT license.</p>
        </section>

        <div className={styles.footer}>
          <button type="button" className={`${buttons.primary} ${styles.done}`} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
