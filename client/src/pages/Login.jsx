import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    classroom: '',
    password: '' // Nouveau champ
  });
  
  const [isProfAttempt, setIsProfAttempt] = useState(false);

  // Détection automatique du Professeur en temps réel
  useEffect(() => {
    const f = formData.firstName.trim().toLowerCase();
    const l = formData.lastName.trim().toLowerCase();
    if (f === 'jean' && l === 'vuillet') {
        setIsProfAttempt(true);
        // On pré-remplit une classe "virtuelle" pour passer la validation
        setFormData(prev => ({ ...prev, classroom: 'Professeur' }));
    } else {
        setIsProfAttempt(false);
    }
  }, [formData.firstName, formData.lastName]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation spécifique
    if (!isProfAttempt && !formData.classroom) return alert("Choisis ta classe !");
    if (isProfAttempt && !formData.password) return alert("Mot de passe requis !");

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if(data.ok) {
        localStorage.setItem("player", JSON.stringify(data));
        navigate('/dashboard'); 
      } else {
        alert("Erreur: " + (data.error || "Connexion refusée"));
      }
    } catch(err) {
      console.error(err);
      alert("Serveur injoignable.");
    }
  };

  return (
    <div className="card">
      <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>👋 Connexion</h2>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>
        {isProfAttempt ? "Accès Enseignant Détecté" : "Prénom, Nom et Classe."}
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="row">
          <div className="col form-group">
            <label className="form-label">Prénom</label>
            <input name="firstName" className="form-input" placeholder="Ex : Jeanne" required value={formData.firstName} onChange={handleChange} />
          </div>
          <div className="col form-group">
            <label className="form-label">Nom</label>
            <input name="lastName" className="form-input" placeholder="Ex : Martin" required value={formData.lastName} onChange={handleChange} />
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="col form-group">
            
            {/* Si c'est Jean Vuillet -> Affiche Mot de passe. Sinon -> Affiche Classe */}
            {isProfAttempt ? (
                <>
                    <label className="form-label" style={{color:'#f59e0b', fontWeight:'bold'}}>Mot de passe Professeur</label>
                    <input 
                        type="password"
                        name="password" 
                        className="form-input" 
                        placeholder="••••••••" 
                        style={{borderColor:'#f59e0b'}}
                        value={formData.password}
                        onChange={handleChange}
                    />
                </>
            ) : (
                <>
                    <label className="form-label">Classe</label>
                    <select name="classroom" className="form-select" value={formData.classroom} onChange={handleChange}>
                        <option value="" disabled>Choisis ta classe...</option>
                        <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                        <option value="2A">2de A</option><option value="2CD">2de CD</option>
                    </select>
                </>
            )}

          </div>
          <div className="col form-group">
            <button type="submit" className="btn-primary" style={isProfAttempt ? {backgroundColor:'#f59e0b'} : {}}>
                {isProfAttempt ? "Valider l'accès" : "Commencer"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

