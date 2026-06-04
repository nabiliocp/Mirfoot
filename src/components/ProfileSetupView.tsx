import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
// @ts-ignore
import logoImage from "../assets/images/pig_football_logo_1780308392869.png";

const EMOJIS = ["👽", "🤓", "😎", "😜", "⚽", "🏆", "🔥", "👑", "🦁", "🦖", "🦄", "🍕"];
const JERSEY_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
  "#000000",
];

const POPULAR_CLUBS = [
  "Paris Saint-Germain (PSG)",
  "Olympique de Marseille (OM)",
  "Real Madrid",
  "FC Barcelone",
  "Manchester City",
  "FC Bayern Munich",
  "Juventus",
  "Liverpool FC",
  "Chelsea",
  "Arsenal",
  "Inter Milan",
  "AC Milan",
  "Atletico Madrid",
  "Borussia Dortmund",
  "Manchester United",
  "Olympique Lyonnais (OL)",
  "AS Monaco",
  "RC Lens",
  "Lille OSC",
  "OGC Nice",
  "Saint-Étienne",
  "SL Benfica",
  "Sporting CP",
  "Ajax Amsterdam",
  "Al-Nassr",
  "Al-Hilal"
].sort();

const POPULAR_NATIONALS = [
  "France",
  "Maroc",
  "Algérie",
  "Tunisie",
  "Sénégal",
  "Côte d'Ivoire",
  "Cameroun",
  "Égypte",
  "Mali",
  "Espagne",
  "Italie",
  "Allemagne",
  "Angleterre",
  "Portugal",
  "Belgique",
  "Pays-Bas",
  "Brésil",
  "Argentine",
  "Croatie",
  "Uruguay",
  "Japon",
  "Suisse"
].sort();

export default function ProfileSetupView({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [username, setUsername] = useState("");
  const [favoriteClub, setFavoriteClub] = useState("");
  const [favoriteNational, setFavoriteNational] = useState("");
  const [avatarType, setAvatarType] = useState<"emoji" | "jersey">("emoji");
  const [avatarValue, setAvatarValue] = useState("👽");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Search/Dropdown overlay states
  const [isClubFocused, setIsClubFocused] = useState(false);
  const [isNationalFocused, setIsNationalFocused] = useState(false);

  // Filter lists based on input queries
  const filteredClubs = favoriteClub.trim() === ""
    ? POPULAR_CLUBS
    : POPULAR_CLUBS.filter(club => 
        club.toLowerCase().includes(favoriteClub.toLowerCase())
      );

  const filteredNationals = favoriteNational.trim() === ""
    ? POPULAR_NATIONALS
    : POPULAR_NATIONALS.filter(nat => 
        nat.toLowerCase().includes(favoriteNational.toLowerCase())
      );

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!username.trim()) {
      setErrorMsg("Le pseudo est obligatoire.");
      return;
    }
    if (!favoriteClub.trim()) {
      setErrorMsg("Le club de cœur est obligatoire.");
      return;
    }
    if (!favoriteNational.trim()) {
      setErrorMsg("L'équipe nationale de cœur est obligatoire.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    // Update auth metadata first
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: {
        username: username.trim(),
        avatar_type: avatarType,
        avatar_value: avatarValue,
        favorite_club: favoriteClub.trim(),
        favorite_national: favoriteNational.trim(),
        profile_completed: true,
      },
    });

    if (authError) {
      setErrorMsg(authError.message);
      setLoading(false);
      return;
    }

    // Explicitly upsert profile to double-ensure it exists and is correct
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: authData.user.id,
        username: username.trim(),
        avatar_type: avatarType,
        avatar_value: avatarValue,
        first_name: favoriteClub.trim(),     // favorite_club
        last_name: favoriteNational.trim(),   // favorite_national
      }, { onConflict: 'id' });

    setLoading(false);

    if (profileError) {
       if (profileError.code === '23505') {
         setErrorMsg("Ce pseudo est déjà pris.");
       } else {
         setErrorMsg("Erreur lors de l'enregistrement du profil: " + profileError.message);
       }
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-3 sm:p-4 bg-gray-50 flex-1">
      <div className="bg-white p-5 sm:p-7 rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full text-center">
        <div className="flex flex-col items-center mb-3">
          <img src={logoImage} alt="Mirfoot Logo" className="w-16 h-16 object-cover rounded-xl shadow-xs bg-white border border-gray-100" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mb-1 text-emerald-800">
          Complète ton profil !
        </h2>
        <p className="text-gray-500 mb-4 text-xs">
          Choisis ton pseudo, ton avatar et tes clubs pour être dans la compétition !
        </p>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-2.5 rounded-xl text-xs mb-3.5 border border-red-100 text-left">
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5 text-left">
          {/* Pseudo Input */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              ⚽️ Pseudo de joueur
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-gray-800 text-xs"
              placeholder="Ton pseudo (ex: Zizou98)"
              maxLength={20}
            />
          </div>

          {/* Club de cœur with Dynamic Autocomplete */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              ❤️ Club de cœur
            </label>
            <input
              type="text"
              required
              value={favoriteClub}
              onChange={(e) => {
                setFavoriteClub(e.target.value);
                setIsClubFocused(true);
              }}
              onFocus={() => {
                setIsClubFocused(true);
                setIsNationalFocused(false);
              }}
              onBlur={() => {
                setTimeout(() => setIsClubFocused(false), 200);
              }}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-gray-800 text-xs"
              placeholder="Sélectionne ou écris ton club (ex: PSG)"
              autoComplete="off"
            />
            
            {isClubFocused && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-36 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50">
                <div className="bg-gray-50 px-3 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Suggestions de clubs
                </div>
                {filteredClubs.length > 0 ? (
                  filteredClubs.map((club) => (
                    <button
                      key={club}
                      type="button"
                      onMouseDown={() => {
                        setFavoriteClub(club);
                        setIsClubFocused(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-xs font-semibold text-gray-700 transition border-b border-gray-50 last:border-0"
                    >
                      ⚽️ {club}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[11px] text-gray-400 italic">
                    Aucun club suggéré (saisie libre)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Équipe Nationale with Dynamic Autocomplete */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              🏆 Équipe nationale de cœur
            </label>
            <input
              type="text"
              required
              value={favoriteNational}
              onChange={(e) => {
                setFavoriteNational(e.target.value);
                setIsNationalFocused(true);
              }}
              onFocus={() => {
                setIsNationalFocused(true);
                setIsClubFocused(false);
              }}
              onBlur={() => {
                setTimeout(() => setIsNationalFocused(false), 200);
              }}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-gray-800 text-xs"
              placeholder="Sélectionne ou écris ton pays (ex: France)"
              autoComplete="off"
            />

            {isNationalFocused && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-36 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50">
                <div className="bg-gray-50 px-3 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Suggestions de sélections
                </div>
                {filteredNationals.length > 0 ? (
                  filteredNationals.map((nat) => (
                    <button
                      key={nat}
                      type="button"
                      onMouseDown={() => {
                        setFavoriteNational(nat);
                        setIsNationalFocused(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-xs font-semibold text-gray-700 transition border-b border-gray-50 last:border-0"
                    >
                      💪 {nat}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[11px] text-gray-400 italic">
                    Aucun pays suggéré (saisie libre)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Avatar Settings */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Style de ton avatar
            </label>
            <div className="flex justify-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAvatarType("emoji")}
                className={`flex-1 py-1 px-3 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${avatarType === "emoji" ? "bg-emerald-100 text-emerald-700 border border-emerald-500/20" : "bg-gray-100 text-gray-500 border border-transparent"}`}
              >
                😄 Emojis
              </button>
              <button
                type="button"
                onClick={() => setAvatarType("jersey")}
                className={`flex-1 py-1 px-3 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${avatarType === "jersey" ? "bg-emerald-100 text-emerald-700 border border-emerald-500/20" : "bg-gray-100 text-gray-500 border border-transparent"}`}
              >
                👕 Maillots
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1 px-2 py-2 bg-gray-50 rounded-2xl max-h-[85px] overflow-y-auto border border-gray-100/80">
              {avatarType === "emoji"
                ? EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatarValue(emoji)}
                      className={`aspect-square text-xl flex items-center justify-center rounded-lg transition ${avatarValue === emoji ? "bg-white shadow-md ring-2 ring-emerald-500 scale-105" : "hover:bg-gray-200"}`}
                    >
                      {emoji}
                    </button>
                  ))
                : JERSEY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarValue(color)}
                      style={{ backgroundColor: color }}
                      className={`aspect-square rounded-full transition border-2 border-white shadow-xs mx-auto w-6 h-6 ${avatarValue === color ? "ring-2 ring-emerald-500 scale-105" : "hover:scale-[1.03]"}`}
                    />
                  ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] mt-3"
          >
            {loading ? "Enregistrement..." : "Créer mon profil et Jouer !"}
          </button>
        </form>
      </div>
    </div>
  );
}
