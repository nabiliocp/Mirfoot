import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, User, Mail, Lock, Shirt } from 'lucide-react';
// @ts-ignore
import logoImage from '../assets/images/pig_football_logo_1780308392869.png';

const EMOJIS = ['👽', '🤓', '😎', '😜', '⚽', '🏆', '🔥', '👑'];
const JERSEY_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

export default function LoginView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarType, setAvatarType] = useState<'emoji' | 'jersey'>('emoji');
  const [avatarValue, setAvatarValue] = useState('👽');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) setErrorMsg(error.message);
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        setSuccessMsg('Lien magique envoyé ! Déconnecte-toi de cet onglet ou vérifie tes emails.');
      } else {
        if (!username.trim()) {
          throw new Error("Le pseudo (username) est obligatoire.");
        }
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username,
              first_name: firstName,
              last_name: lastName,
              avatar_type: avatarType,
              avatar_value: avatarValue
            }
          }
        });
        if (error) throw error;
        setSuccessMsg('Compte créé ! Un lien magique a été envoyé par email.');
      }
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
          <div className="font-handwriting text-xl text-emerald-500 transform -rotate-3 mb-2">Halloufa 2026</div>
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

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex justify-center items-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all shadow-sm mb-6 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
          </svg>
          Continuer avec Google
        </button>
        
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Ou avec un Lien Magique</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 text-left">
          {!isLogin && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pseudo (Obligatoire, unique)*</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ton pseudo dans le groupe"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Optionnel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Choisis ton Avatar</label>
                <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-lg">
                  <button type="button" onClick={() => { setAvatarType('emoji'); setAvatarValue(EMOJIS[0]); }} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${avatarType === 'emoji' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}>Emoji</button>
                  <button type="button" onClick={() => { setAvatarType('jersey'); setAvatarValue(JERSEY_COLORS[0]); }} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${avatarType === 'jersey' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}>Maillot</button>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2 justify-center">
                  {avatarType === 'emoji' ? (
                    EMOJIS.map(emoji => (
                      <button key={emoji} type="button" onClick={() => setAvatarValue(emoji)} className={`w-10 h-10 text-xl flex items-center justify-center rounded-lg transition ${avatarValue === emoji ? 'bg-emerald-100 ring-2 ring-emerald-500 scale-110' : 'hover:bg-gray-200 bg-white shadow-sm'}`}>
                        {emoji}
                      </button>
                    ))
                  ) : (
                    JERSEY_COLORS.map(color => (
                      <button key={color} type="button" onClick={() => setAvatarValue(color)} className={`w-10 h-10 flex items-center justify-center rounded-lg transition shadow-sm ${avatarValue === color ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: color }}>
                        <Shirt className={`w-5 h-5 ${color === '#ffffff' ? 'text-gray-800' : 'text-white'}`} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

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
            {isLogin ? 'Se Connecter' : 'Créer mon Compte'}
          </button>
        </form>
        
        <div className="mt-6 text-sm">
          <p className="text-gray-500">
            {isLogin ? "Tu n'as pas de compte ?" : "Tu as déjà un compte ?"}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="ml-1 text-emerald-600 font-bold hover:underline cursor-pointer"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-center shrink-0 pb-4">
        <span className="text-[10px] text-gray-400">© 2026 Tous droits réservés NRINFRA</span>
      </div>
    </div>
  );
}
