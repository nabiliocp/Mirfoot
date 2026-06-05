import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Mail, Lock, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
// @ts-ignore
import logoImage from '../assets/images/pig_football_logo_1780308392869.png';

export default function LoginView() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false); // for Google login
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account consent'
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de la connexion avec Google.');
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formattedEmail = email.trim();

    if (isSignUp) {
      if (password !== confirmPassword) {
        setErrorMsg("Les mots de passe ne correspondent pas.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: formattedEmail,
          password,
        });
        if (error) throw error;
        
        if (data.session) {
          setSuccessMsg("Inscription réussie ! Connexion automatique...");
        } else {
          setSuccessMsg("Compte créé avec succès ! Veuillez vérifier votre boîte de réception pour valider votre email avant de vous connecter.");
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Une erreur est survenue lors de l'inscription.");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: formattedEmail,
          password,
        });
        if (error) throw error;
        setSuccessMsg("Connexion réussie ! Redirection...");
      } catch (err: any) {
        setErrorMsg(err.message || "Identifiants incorrects. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!supabase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-100 max-w-md w-full space-y-4 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-2" />
          <h2 className="text-xl font-bold">Configuration Supabase requise</h2>
          <p className="text-sm">
            Pour activer la connexion, veuillez ajouter <strong>VITE_SUPABASE_URL</strong> et <strong>VITE_SUPABASE_ANON_KEY</strong> dans les Secrets de AI Studio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 animate-in fade-in zoom-in-95 duration-500 overflow-y-auto">
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center ring-1 ring-emerald-50/50">
        <div className="flex flex-col items-center mb-6">
          <img src={logoImage} alt="Mirfoot Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-2xl shadow-md mb-3 bg-white" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mb-0.5 tracking-tight">Mirfoot</h1>
          <div className="font-handwriting text-lg sm:text-xl text-emerald-500 transform -rotate-3 mb-3">Halloufa world cup 2026</div>
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Rejoins tes amis, participe aux défis et fais tes pronostics !</p>
        </div>

        {/* Mode Selector Tab */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !isSignUp ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isSignUp ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Inscription
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs mb-4 border border-red-100 flex items-start gap-2.5 text-left animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs mb-4 border border-emerald-100 flex items-start gap-2.5 text-left animate-in slide-in-from-top-1 font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0 animate-ping" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {/* Email input */}
          <div className="text-left">
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-gray-400 mb-1 pl-1">
              Adresse Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-semibold text-gray-800 text-xs transition"
                placeholder="Ex: nabil@example.com"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="text-left">
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-gray-400 mb-1 pl-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-semibold text-gray-800 text-xs transition"
                placeholder="Entrez votre mot de passe"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password field (Sign Up only) */}
          {isSignUp && (
            <div className="text-left animate-in slide-in-from-top-2 duration-200">
              <label className="block text-[10px] uppercase tracking-wider font-extrabold text-gray-400 mb-1 pl-1">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-semibold text-gray-800 text-xs transition"
                  placeholder="Confirmez votre mot de passe"
                />
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isSignUp ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isSignUp ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        {/* Separator */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs font-semibold uppercase">
            <span className="bg-white px-3 text-gray-400 text-[10px] tracking-wider">Ou</span>
          </div>
        </div>

        {/* Google Sign In listed gracefully at the bottom */}
        <div className="space-y-4">
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 font-bold py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer hover:border-gray-400 hover:bg-gray-50 active:scale-[0.98] text-gray-700 text-xs sm:text-sm"
          >
            {authLoading ? (
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38C16.88,16.51,14.77,18,12,18a6,6,0,1,1,6-6,5.83,5.83,0,0,1-.52,2.37l2.1,1.63A8.93,8.93,0,0,0,21,12,8.79,8.79,0,0,0,21.35,11.1Z" fill="#4285F4" />
                  <path d="M12,18a6,6,0,0,1-6-6,5.89,5.89,0,0,1,.13-1.25L4,9.12a9,9,0,0,0,8,11.58,8.8,8.8,0,0,0,5.92-2.15l-2.1-1.63A5.9,5.9,0,0,1,12,18Z" fill="#34A853" />
                  <path d="M6.13,10.75A5.89,5.89,0,0,1,6,12a5.83,5.83,0,0,1,.13-1.25L4,9.12a8.88,8.88,0,0,0,0,5.76l2.13-1.63A5.89,5.89,0,0,1,6.13,10.75Z" fill="#FBBC05" />
                  <path d="M12,6A5.86,5.86,0,0,1,16.14,7.65l2.05-2.05A8.85,8.85,0,0,0,12,3,9,9,0,0,0,4,9.12l2.13,1.63A5.89,5.89,0,0,1,12,6Z" fill="#EA4335" />
                </g>
              </svg>
            )}
            Se connecter avec Google
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center shrink-0 pb-4">
        <span className="text-[10px] text-gray-400">© 2026 Tous droits réservés NRINFRA</span>
      </div>
    </div>
  );
}
