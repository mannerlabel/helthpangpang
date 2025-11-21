import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not found. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.')
  // 에러를 throw하지 않고 null을 반환 (databaseService에서 처리)
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

