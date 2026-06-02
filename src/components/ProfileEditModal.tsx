import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { X, User, Mail, Check, AlertCircle } from "lucide-react";

const EMOJIS = ["👽", "🤓", "😎", "😜", "⚽", "🏆", "🔥", "👑", "🦄", "🦁", "🦖", "🍕"];
const JERSEY_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
  "#000000",
  "#14b8a6",
  "#06b6d4"
];

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  initialProfile: {
    username: string;
    avatar_type: "emoji" | "jersey";
    avatar_value: string;
  };
  onSave: (updated: {
    username: string;
    avatar_type: "emoji" | "jersey";
    avatar_value: string;
  }) => void;
}

export default function ProfileEditModal({
  isOpen,
  onClose,
  email,
  initialProfile,
  onSave,
}: ProfileEditModalProps) {
  const [username, setUsername] = useState(initialProfile.username);
  const [avatarType, setAvatarType] = useState<"emoji" | "jersey">(initialProfile.avatar_type);
  const [avatarValue, setAvatarValue] = useState(initialProfile.avatar_value);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUsername(initialProfile.username);
      setAvatarType(initialProfile.avatar_type);
      setAvatarValue(initialProfile.avatar_value);
      setErrorMsg("");
    }
  }, [isOpen, initialProfile]);

  if (!isOpen) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!username.trim()) {
      setErrorMsg("Le pseudo ne peut pas être vide.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Update Auth meta
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          avatar_type: avatarType,
          avatar_value: avatarValue,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // 2. Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: authData.user.id,
          username: username.trim(),
          avatar_type: avatarType,
          avatar_value: avatarValue,
        }, { onConflict: 'id' });

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error("Ce pseudo est déjà pris par un autre joueur.");
        } else {
          throw new Error(profileError.message);
        }
      }

      onSave({
        username: username.trim(),
        avatar_type: avatarType,
        avatar_value: avatarValue,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden transform animate-scale-up">
        {/* Header */}
        <div className="relative bg-emerald-700 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Modifier mon profil</h2>
            <p className="text-emerald-100 text-xs mt-0.5">Personnalise tes informations de jeu</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-700 p-3.5 rounded-xl text-xs border border-rose-100 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Readonly email */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-left flex items-center gap-3">
            <div className="bg-slate-200 text-slate-500 p-2 rounded-lg">
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Adresse e-mail (liée)</span>
              <span className="block text-sm text-gray-600 font-medium truncate">{email}</span>
            </div>
          </div>

          {/* Username Input */}
          <div className="text-left">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Pseudo de champion
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 hover:border-gray-300 outline-none transition text-sm font-semibold text-gray-800"
              placeholder="Ex: Zizou98"
            />
          </div>

          {/* Avatar Selection */}
          <div className="text-left">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Style de l'avatar
            </label>
            
            {/* Avatar Type Selector tabs */}
            <div className="flex gap-2.5 mb-3">
              <button
                type="button"
                onClick={() => setAvatarType("emoji")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  avatarType === "emoji" 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-500/30 shadow-xs" 
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/55"
                }`}
              >
                😄 Emojis
              </button>
              <button
                type="button"
                onClick={() => setAvatarType("jersey")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  avatarType === "jersey" 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-500/30 shadow-xs" 
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/55"
                }`}
              >
                👕 Maillots
              </button>
            </div>

            {/* Selection Grid */}
            <div className="grid grid-cols-5 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 max-h-[140px] overflow-y-auto">
              {avatarType === "emoji"
                ? EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatarValue(emoji)}
                      className={`aspect-square text-2xl flex items-center justify-center rounded-xl transition ${
                        avatarValue === emoji 
                          ? "bg-white shadow-md ring-2 ring-emerald-500 scale-105" 
                          : "hover:bg-gray-200"
                      }`}
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
                      className={`aspect-square rounded-xl transition border-4 border-white shadow-sm flex items-center justify-center ${
                        avatarValue === color 
                          ? "ring-2 ring-emerald-500 scale-105" 
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                    >
                      {avatarValue === color && (
                        <Check className={`w-4 h-4 ${color === "#ffffff" ? "text-emerald-600" : "text-white"}`} />
                      )}
                    </button>
                  ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition duration-150 text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition duration-150 text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/10 cursor-pointer"
            >
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
