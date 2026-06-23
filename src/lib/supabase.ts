import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dummySupabase = new Proxy({} as any, {
  get(target, prop) {
    if (prop === 'isDummy') return true;
    if (prop === 'auth') {
      return new Proxy({} as any, {
        get(authTarget, authProp) {
          if (authProp === 'getSession') {
            return () => Promise.resolve({ data: { session: null }, error: null });
          }
          if (authProp === 'onAuthStateChange') {
            return () => ({ data: { subscription: { unsubscribe: () => {} } } });
          }
          if (authProp === 'getUser') {
            return () => Promise.resolve({ data: { user: null }, error: null });
          }
          return () => Promise.resolve({ data: null, error: new Error("Supabase is not configured") });
        }
      });
    }
    if (prop === 'from') {
      return () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured") }),
            then: (cb: any) => Promise.resolve({ data: [] }).then(cb),
          }),
          then: (cb: any) => Promise.resolve({ data: [] }).then(cb),
        }),
        insert: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured") }),
        upsert: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured") }),
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured") }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured") }),
        }),
      });
    }
    return () => {};
  }
});

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lockAcquireTimeout: 2000,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    }) 
  : dummySupabase;
