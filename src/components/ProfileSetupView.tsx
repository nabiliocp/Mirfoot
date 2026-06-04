import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

const EMOJIS = ["👽", "🤓", "😎", "😜", "⚽", "🏆", "🔥", "👑"];
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

export default function ProfileSetupView({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [username, setUsername] = useState("");
  const [favoriteClub, setFavoriteClub] = useState("");
  const [avatarType, setAvatarType] = useState<"emoji" | "jersey">("emoji");
  const [avatarValue, setAvatarValue] = useState("👽");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

    setLoading(true);
    setErrorMsg("");

    // Update auth metadata first
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: {
        username,
        avatar_type: avatarType,
        avatar_value: avatarValue,
        favorite_club: favoriteClub,
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
        username,
        avatar_type: avatarType,
        avatar_value: avatarValue,
        favorite_club: favoriteClub,
      }, { onConflict: 'id' });

    setLoading(false);

    if (profileError) {
       // If it's a "duplicate username" error, handle it
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 flex-1">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4 text-emerald-800">
          Complète ton profil !
        </h2>
        <p className="text-gray-500 mb-6 text-sm">
          Choisis comment tes potes te verront dans le classement.
        </p>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100 text-left">
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 text-left">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Pseudo
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ton pseudo (ex: Zizou98)"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Club de cœur
            </label>
            <input
              type="text"
              required
              value={favoriteClub}
              onChange={(e) => setFavoriteClub(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ton club (ex: PSG, OM, Real)"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Avatar
            </label>
            <div className="flex justify-center gap-4 mb-4">
              <button
                type="button"
                onClick={() => setAvatarType("emoji")}
                className={`py-2 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer hover:scale-105 ${avatarType === "emoji" ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-500" : "bg-gray-100 text-gray-500 border-2 border-transparent"}`}
              >
                Emoji
              </button>
              <button
                type="button"
                onClick={() => setAvatarType("jersey")}
                className={`py-2 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer hover:scale-105 ${avatarType === "jersey" ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-500" : "bg-gray-100 text-gray-500 border-2 border-transparent"}`}
              >
                Maillot
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl">
              {avatarType === "emoji"
                ? EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatarValue(emoji)}
                      className={`aspect-square text-3xl flex items-center justify-center rounded-xl transition ${avatarValue === emoji ? "bg-white shadow-sm ring-2 ring-emerald-500 scale-110" : "hover:bg-gray-200"}`}
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
                      className={`aspect-square rounded-full transition border-4 border-white shadow-sm ${avatarValue === color ? "ring-2 ring-emerald-500 scale-110" : "hover:scale-105"}`}
                    />
                  ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Enregistrement..." : "C'est parti !"}
          </button>
        </form>
      </div>
    </div>
  );
}
