import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// C:/env/.env 파일에서 환경 변수 로드
const customEnvPath = 'C:/env/.env'
if (existsSync(customEnvPath)) {
  config({ path: customEnvPath })
  console.log(`환경 변수를 ${customEnvPath}에서 로드했습니다.`)
} else {
  console.warn(`환경 변수 파일을 찾을 수 없습니다: ${customEnvPath}`)
  console.warn('프로젝트 루트의 .env 파일을 사용합니다.')
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Vite의 기본 env 로드 + 커스텀 경로의 env 병합
  const env = loadEnv(mode, process.cwd(), '')
    
  // 커스텀 경로의 env 파일이 있으면 우선 사용
  if (existsSync(customEnvPath)) {
    const customEnv = config({ path: customEnvPath }).parsed || {}
    Object.keys(customEnv).forEach((key) => {
      if (key.startsWith('VITE_')) {
        process.env[key] = customEnv[key]
      }
    })
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/features': path.resolve(__dirname, './src/features'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/assets': path.resolve(__dirname, './src/assets'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0', // 외부 접근 허용 (ngrok 사용 시 필요)
      open: true,
      // ngrok 및 외부 접근 허용
      allowedHosts: [
        '.ngrok.io',
        '.ngrok-free.app',
        '.ngrok.app',
        'localhost',
        '127.0.0.1',
      ],
      // 또는 모든 호스트 허용 (개발 환경에서만 사용)
      // strictPort: false,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  }
})

