import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Mail } from 'lucide-react';
// @ts-ignore
import logoImage from '../assets/images/pig_football_logo_1780308392869.png';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      setSuccessMsg('Lien magique envoyé ! Vérifie ta boîte mail.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue');
    } finally {
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 animate-in fade-in zoom-in-95 duration-500 overflow-y-auto pt-10 pb-10">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center ring-1 ring-emerald-50 my-auto">
        <div className="flex flex-col items-center mb-6">
          <img src={logoImage} alt="Mirfoot Logo" className="w-20 h-20 object-cover rounded-2xl shadow-md mb-3 bg-white" />
          <h1 className="text-3xl font-extrabold text-emerald-600 mb-0 tracking-tight">Mirfoot</h1>
          <div className="font-handwriting text-xl text-emerald-500 transform -rotate-3 mb-2">Halloufa world cup 2026</div>
          <p className="text-gray-500 text-sm font-medium">Rejoins tes amis et fais tes pronos !</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100 flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm mb-4 border border-emerald-100 flex items-center gap-2 text-left">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="ton@email.com"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm mt-2 flex justify-center items-center cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
               <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
            ) : null}
            Se Connecter
          </button>
        </form>
      </div>
      
      <div className="mt-8 text-center shrink-0 pb-4">
        <span className="text-[10px] text-gray-400">© 2026 Tous droits réservés NRINFRA</span>
      </div>
    </div>
  );
}
