/**
 * Node.js HTTPS 프로덕션 서버
 * 빌드된 정적 파일을 HTTPS로 서빙합니다.
 */

import https from 'https'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// SSL 인증서 파일 경로
const keyPath = resolve(__dirname, 'ssl/vinedev.monster-key.pem')
const certPath = resolve(__dirname, 'ssl/vinedev.monster-chain.pem')

// 인증서 파일 존재 확인
if (!existsSync(keyPath) || !existsSync(certPath)) {
  console.error('❌ SSL 인증서 파일을 찾을 수 없습니다.')
  console.error(`   개인키 경로: ${keyPath}`)
  console.error(`   인증서 경로: ${certPath}`)
  console.error('   ssl 폴더에 인증서 파일을 배치해주세요.')
  process.exit(1)
}

// SSL 옵션 설정
const httpsOptions = {
  key: readFileSync(keyPath),
  cert: readFileSync(certPath),
}

// 포트 설정 (환경 변수 또는 기본값)
const PORT = process.env.PORT || 3000
let MODE = process.env.NODE_ENV || 'production'

// dist 폴더 확인하여 모드 자동 조정
const distPath = resolve(__dirname, 'dist')
if (MODE === 'production' && !existsSync(distPath)) {
  console.warn('⚠️  dist 폴더를 찾을 수 없습니다.')
  console.warn('   개발 모드로 전환합니다. (프로덕션 모드 사용 시: npm run build)')
  MODE = 'development'
}

// 서버 시작 함수
async function startServer() {
  // 프로덕션 모드: 정적 파일 서빙
  if (MODE === 'production') {
    try {
      const express = (await import('express')).default
      const app = express()

      // 정적 파일 서빙
      app.use(express.static(distPath))

      // 정적 파일 서빙
      app.use(express.static(distPath))

      // SPA 라우팅 지원: 모든 요청을 index.html로 리다이렉트
      app.get('*', (req, res) => {
        res.sendFile(join(distPath, 'index.html'))
      })

      // HTTPS 서버 생성
      const server = https.createServer(httpsOptions, app)

      server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 HTTPS 서버가 실행 중입니다:`)
        console.log(`   로컬 접속: https://localhost:${PORT}`)
        console.log(`   외부 접속: https://vinedev.monster:${PORT}`)
        console.log(`   모든 인터페이스: https://0.0.0.0:${PORT}`)
        console.log(`   모드: ${MODE}`)
        console.log(`   카메라 접근을 위해 HTTPS 필수입니다.`)
      })

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ 포트 ${PORT}가 이미 사용 중입니다.`)
        } else {
          console.error('❌ 서버 오류:', error)
        }
        process.exit(1)
      })
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        console.error('❌ Express를 설치해주세요: npm install express')
      } else {
        console.error('❌ 서버 시작 실패:', error)
      }
      process.exit(1)
    }
  } else {
    // 개발 모드: Vite 개발 서버와 연동
    try {
      const { createServer } = await import('vite')
      const viteServer = await createServer({
        server: {
          https: httpsOptions,
          port: PORT,
          host: '0.0.0.0',
        },
      })
      
      await viteServer.listen(PORT)
      console.log(`🚀 Vite HTTPS 개발 서버가 실행 중입니다:`)
      console.log(`   로컬 접속: https://localhost:${PORT}`)
      console.log(`   외부 접속: https://vinedev.monster:${PORT}`)
      console.log(`   모든 인터페이스: https://0.0.0.0:${PORT}`)
      console.log(`   모드: ${MODE}`)
      console.log(`   카메라 접근을 위해 HTTPS 필수입니다.`)
    } catch (error) {
      console.error('❌ Vite 서버 시작 실패:', error)
      process.exit(1)
    }
  }
}

// 서버 시작
startServer().catch((error) => {
  console.error('❌ 서버 시작 중 오류 발생:', error)
  process.exit(1)
})

