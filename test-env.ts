import dotenv from 'dotenv';
dotenv.config();

console.log("FOOTBALL_DATA_API_KEY:", process.env.FOOTBALL_DATA_API_KEY ? "EXISTS" : "MISSING");
console.log("API_FOOTBALL_KEY:", process.env.API_FOOTBALL_KEY ? "EXISTS" : "MISSING");
console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL ? "EXISTS" : "MISSING");
console.log("ACTIVE_API_PROVIDER:", process.env.ACTIVE_API_PROVIDER);
