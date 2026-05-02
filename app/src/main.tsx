import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirstRunModal } from './components/FirstRunModal';
import { useSettingsStore } from './store/useSettingsStore';
import './styles.css';

function Root() {
  const hasCompletedFirstRun = useSettingsStore((s) => s.hasCompletedFirstRun);
  // Local state lets us close the modal even if the store update is async.
  const [dismissed, setDismissed] = useState(false);
  const showModal = !hasCompletedFirstRun && !dismissed;
  return (
    <ErrorBoundary>
      {showModal && <FirstRunModal onClose={() => setDismissed(true)} />}
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
