import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirstRunModal } from './components/FirstRunModal';
import { PlaybookModal } from './components/PlaybookModal';
import { useSettingsStore } from './store/useSettingsStore';
import './styles.css';

function Root() {
  const hasCompletedFirstRun = useSettingsStore((s) => s.hasCompletedFirstRun);
  const hasSeenPlaybook = useSettingsStore((s) => s.hasSeenPlaybook);
  // Local state lets us close each modal even if the store update is async.
  const [firstRunDismissed, setFirstRunDismissed] = useState(false);
  const [playbookDismissed, setPlaybookDismissed] = useState(false);
  const showFirstRun = !hasCompletedFirstRun && !firstRunDismissed;
  // Sprint 26 (Task 26.4): playbook mounts AFTER FirstRunModal closes — we
  // gate it on `!showFirstRun` so the two modals are sequential, not stacked.
  const showPlaybook = !showFirstRun && !hasSeenPlaybook && !playbookDismissed;
  return (
    <ErrorBoundary>
      {showFirstRun && <FirstRunModal onClose={() => setFirstRunDismissed(true)} />}
      {showPlaybook && <PlaybookModal onClose={() => setPlaybookDismissed(true)} />}
      <App />
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
