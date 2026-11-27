import React, { useEffect, useState } from 'react';
import './InstallAppButton.css';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export default function InstallAppButton({ compact = false }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [helpOpen, setHelpOpen] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  useEffect(() => {
    const capturePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      setInstalled(true);
      setHelpOpen(false);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setHelpOpen(true);
  };

  return (
    <>
      <button type="button" onClick={() => void install()} className={`install-app-button ${compact ? 'compact' : ''}`}>
        📱 {compact ? 'INSTALLER' : 'Installer CondaWeb sur mon téléphone'}
      </button>
      {helpOpen && (
        <div className="install-help-backdrop" role="dialog" aria-modal="true" aria-label="Installer CondaWeb">
          <div className="install-help-card">
            <button type="button" className="install-help-close" onClick={() => setHelpOpen(false)} aria-label="Fermer">×</button>
            <div className="install-help-icon">📱</div>
            <h2>Installer CondaWeb</h2>
            {isIos ? (
              <ol>
                <li>Ouvre cette page dans <strong>Safari</strong>.</li>
                <li>Appuie sur <strong>Partager</strong> <span className="install-share-icon">▢↑</span>.</li>
                <li>Choisis <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Ouvre le menu de ton navigateur <strong>⋮</strong>.</li>
                <li>Choisis <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</li>
                <li>Confirme avec <strong>Installer</strong>.</li>
              </ol>
            )}
            <p>L’icône CondaWeb apparaîtra ensuite avec tes autres applications.</p>
            <button type="button" className="install-help-ok" onClick={() => setHelpOpen(false)}>J’ai compris</button>
          </div>
        </div>
      )}
    </>
  );
}
