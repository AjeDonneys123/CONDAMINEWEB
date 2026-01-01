import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Récupération sécurisée de l'utilisateur connecté
  const user = JSON.parse(localStorage.getItem("player") || "{}");
  const isConnected = !!user.id;
  
  // Est-ce un prof ?
  const isProf = user.id === 'prof' || (user.firstName === 'Jean' && user.lastName === 'Vuillet');
  
  // On affiche le bouton "Retour Prof" seulement si on est prof et PAS sur le dashboard
  const showBackToProf = isProf && location.pathname !== '/dashboard';

  const handleLogout = () => {
    localStorage.removeItem("player");
    navigate('/');
  };

  return (
    <header>
      <div className="header-left">
        <h1 onClick={() => navigate('/')} style={{cursor:'pointer'}}>Plateforme Condamine</h1>
      </div>
      
      <div className="header-right">
        
        {/* Bouton pour revenir au Dashboard Prof */}
        {showBackToProf && (
            <button 
                onClick={() => navigate('/dashboard')}
                style={{
                    backgroundColor: '#f59e0b', 
                    color: 'white', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    fontWeight: 'bold',
                    marginRight: '10px'
                }}
            >
                🎓 Prof
            </button>
        )}

        <button className="pause-btn">🐞 Bug / Pause</button>
        
        {isConnected && (
            <>
                <div style={{fontWeight:'bold', color:'#334155', marginLeft: '10px'}}>
                    {user.firstName} {user.lastName}
                </div>
                <button 
                    onClick={handleLogout} 
                    style={{
                        marginLeft: '10px', 
                        padding: '6px 10px', 
                        border: '1px solid #cbd5e1', 
                        background: 'white', 
                        borderRadius: '5px'
                    }}
                >
                    Déconnexion
                </button>
            </>
        )}
      </div>
    </header>
  );
}

