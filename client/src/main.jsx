// @signatures: SafetyNet
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 🛡️ AIRBAG DE SÉCURITÉ (Error Boundary)
class SafetyNet extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleEmergencyRevert = async () => {
    try {
        await fetch('/api/system/revert', { method: 'POST' });
        setTimeout(() => window.location.reload(), 1000);
    } catch(e) { alert("Serveur injoignable. Vérifiez le terminal."); }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
            position: 'fixed', inset: 0, background: '#450a0a', color: 'white', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            fontFamily: 'monospace', padding: '20px', textAlign: 'center', zIndex: 999999
        }}>
            <h1 style={{fontSize: '3rem', margin: 0}}>💥 CRASH CRITIQUE</h1>
            <p style={{color: '#fca5a5', margin: '20px 0'}}>L'application a planté au démarrage.</p>
            <pre style={{background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '10px', maxWidth: '800px', overflow: 'auto'}}>
                {this.state.error?.toString()}
            </pre>
            <button 
                onClick={this.handleEmergencyRevert}
                style={{
                    marginTop: '40px', padding: '20px 40px', fontSize: '1.5rem', fontWeight: '900',
                    background: '#ef4444', color: 'white', border: '4px solid white', borderRadius: '20px',
                    cursor: 'pointer', textTransform: 'uppercase'
                }}
            >
                🚑 REVERT D'URGENCE (SAUVER LE PROJET)
            </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SafetyNet>
      <App />
    </SafetyNet>
  </React.StrictMode>
);
