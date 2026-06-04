import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle } from 'lucide-react';
// @ts-ignore
import logoImage from '../assets/images/pig_football_logo_1780308392869.png';

export default function LoginView() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de la connexion avec Google.');
      setLoading(false);
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
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center ring-1 ring-emerald-50/50">
        <div className="flex flex-col items-center mb-8">
          <img src={logoImage} alt="Mirfoot Logo" className="w-24 h-24 object-cover rounded-2xl shadow-md mb-4 bg-white" />
          <h1 className="text-3xl font-extrabold text-emerald-600 mb-1 tracking-tight">Mirfoot</h1>
          <div className="font-handwriting text-xl text-emerald-500 transform -rotate-3 mb-4">Halloufa world cup 2026</div>
          <p className="text-gray-500 text-sm font-medium">Rejoins tes amis, participe aux défis et fais tes pronostics !</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm mb-6 border border-red-100 flex items-center gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer hover:border-gray-400 hover:bg-gray-50 active:scale-[0.98] text-gray-700"
          >
            {loading ? (
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
