import { useState } from 'react';

interface ErrorScreenProps {
  message: string;
  /** Dev builds: show the error text with a copy button. */
  showDetails: boolean;
  onMenu: () => void;
}

/** When a match fails (spec #2 §7.1, §8): what happened, Back to menu, and in dev builds the error text. */
export function ErrorScreen({ message, showDetails, onMenu }: ErrorScreenProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="screen error-screen live">
      <div className="backdrop" />
      <div className="error-panel panel">
        <h2 className="display">Something went wrong in this match</h2>
        <p>The match had to stop. Your profile and settings are safe.</p>
        {showDetails && (
          <div className="error-details">
            <pre>{message}</pre>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(message).then(() => setCopied(true));
              }}
            >
              {copied ? 'Copied' : 'Copy error'}
            </button>
          </div>
        )}
        <button type="button" className="btn primary" onClick={onMenu}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
