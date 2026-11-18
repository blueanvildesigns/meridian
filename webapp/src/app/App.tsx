import { GearIcon, InfoIcon, LogoMark } from '../ui/icons';
import styles from './App.module.css';

// Pending confirmation (docs/decisions-log.md D21): taken from the old marketing site.
export const KOFI_URL = 'https://ko-fi.com/grahamtholomew';

export function App() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <LogoMark />
          <h1 className={styles.wordmark}>Meridian</h1>
        </div>
        <div className={styles.headerActions}>
          {/* Settings and About dialogs arrive in M6. */}
          <button type="button" className={styles.iconButton} aria-label="Settings">
            <GearIcon size={22} />
          </button>
          <button type="button" className={styles.iconButton} aria-label="About Meridian">
            <InfoIcon size={22} />
          </button>
        </div>
      </header>

      <main className={styles.main} aria-label="Clocks">
        {/* Clock list arrives in M3. */}
      </main>

      <footer className={styles.footer}>
        <span>Meridian is a Blue Anvil Designs project.</span>
        <span className={styles.footerLinks}>
          <button type="button" className={styles.linkButton}>
            About
          </button>
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
            Support on Ko-fi
          </a>
        </span>
      </footer>
    </div>
  );
}
