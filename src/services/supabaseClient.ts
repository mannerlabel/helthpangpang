import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = '❌ Supabase environment variables not found. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.'
  console.error(errorMsg)
  
  // iOS에서 키보드가 나타나는 것을 방지하기 위해 alert 대신 console.error만 사용
  // 사용자에게는 조용히 오류를 로깅하고, databaseService에서 처리하도록 함
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    console.warn('⚠️ HTTPS 연결이 필요합니다. 현재 프로토콜:', window.location.protocol)
    console.warn('   WebRTC와 카메라 접근을 위해서는 HTTPS가 필요합니다.')
  }
  
  // 에러를 throw하지 않고 null을 반환 (databaseService에서 처리)
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null

// Supabase Realtime은 채널 구독 시 자동으로 연결됩니다
// 연결 상태는 채널 구독 시 확인합니다

