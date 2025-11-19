// 환경 변수 로드 유틸리티
// Vite는 빌드 타임에 C:/env/.env 파일을 로드합니다
// 클라이언트에서는 import.meta.env를 통해 접근합니다

export const loadEnv = () => {
  // Vite는 vite.config.ts에서 C:/env/.env 파일을 로드하므로
  // 여기서는 환경 변수 접근만 제공
  return {
    AI_API_URL: import.meta.env.VITE_AI_API_URL || '',
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
    OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',
  }
}

// Python 스타일의 dotenv 로드 (참고용)
// 실제로는 vite.config.ts에서 C:/env/.env 파일을 로드합니다
export const loadDotenv = (envPath: string = 'C:/env/.env') => {
  console.log(`환경 변수 파일 경로: ${envPath}`)
  console.log('Vite는 빌드 타임에 vite.config.ts를 통해 환경 변수를 로드합니다.')
  console.log('클라이언트에서는 import.meta.env를 통해 접근하세요.')
  
  return {
    AI_API_URL: import.meta.env.VITE_AI_API_URL || '',
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
    OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',
  }
}

