# SSL 프로토콜 오류 해결 가이드

## 오류 설명

### ERR_SSL_PROTOCOL_ERROR
```
GET https://vinedev.monster:7677/vite.svg net::ERR_SSL_PROTOCOL_ERROR
GET https://vinedev.monster:7677/bgm/bgm1.mp3 net::ERR_SSL_PROTOCOL_ERROR 206 (Partial Content)
```

**의미**: SSL/TLS 연결이 실패했습니다.

**원인**:
1. SSL 인증서 파일이 없거나 손상됨
2. 인증서가 만료됨
3. 인증서와 도메인이 일치하지 않음
4. 포트 7677에서 SSL이 제대로 설정되지 않음
5. 공유기 포워딩 설정 문제

## 해결 방법

### 1. SSL 인증서 파일 확인

프로젝트 루트의 `ssl` 폴더에 다음 파일이 있는지 확인:
- `ssl/vinedev.monster-key.pem` (개인키)
- `ssl/vinedev.monster-chain.pem` (인증서 체인)

**파일이 없는 경우**:
```bash
# ssl 폴더 생성
mkdir ssl

# 인증서 파일을 ssl 폴더에 배치
# - vinedev.monster-key.pem
# - vinedev.monster-chain.pem
```

### 2. Vite 개발 서버 확인

`vite.config.ts`에서 SSL 설정이 올바른지 확인:
```typescript
https: (() => {
  const keyPath = path.resolve(__dirname, 'ssl/vinedev.monster-key.pem')
  const certPath = path.resolve(__dirname, 'ssl/vinedev.monster-chain.pem')
  
  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    }
  }
  return false // 인증서가 없으면 HTTP로 실행
})(),
```

**확인 사항**:
- 인증서 파일 경로가 올바른지
- 파일이 읽을 수 있는지
- 인증서가 유효한지

### 3. 포트 및 공유기 포워딩 확인

**현재 설정**:
- Vite 개발 서버: 포트 3000 (HTTPS)
- 공유기 포워딩: 외부 7677 → 내부 3000

**확인 사항**:
1. 공유기에서 포트 포워딩이 올바르게 설정되어 있는지
2. 포트 7677이 외부에서 접근 가능한지
3. 공유기가 SSL을 제대로 처리하는지

### 4. 임시 해결 방법

#### 옵션 A: HTTP로 접속 (개발 환경)
인증서 파일이 없으면 자동으로 HTTP로 실행됩니다:
```
http://vinedev.monster:7677
```

**주의**: 
- 카메라 접근이 불가능할 수 있습니다 (브라우저 보안 정책)
- WebRTC가 작동하지 않을 수 있습니다

#### 옵션 B: localhost로 접속
로컬 개발 시:
```
https://localhost:3000
```

#### 옵션 C: 자체 서명 인증서 생성 (개발 환경)
```bash
# OpenSSL 설치 필요
openssl req -x509 -newkey rsa:4096 -keyout ssl/vinedev.monster-key.pem -out ssl/vinedev.monster-chain.pem -days 365 -nodes

# 브라우저에서 "고급" → "계속 진행" 클릭 필요 (자체 서명 인증서 경고)
```

### 5. 프로덕션 서버 확인

`server.js`를 사용하는 경우:
- SSL 인증서 파일이 올바른지 확인
- 포트 3000에서 HTTPS가 제대로 실행되는지 확인
- 공유기 포워딩이 올바른지 확인

## 즉시 확인 사항

### 1. 인증서 파일 존재 확인
```bash
# 프로젝트 루트에서 실행
ls -la ssl/
# 또는 Windows에서
dir ssl
```

### 2. Vite 개발 서버 로그 확인
서버 시작 시 다음 메시지 확인:
- ✅ `🔒 HTTPS 서버 실행 중` → SSL 인증서가 있음
- ⚠️ `인증서 파일이 없어 HTTP로 실행됩니다` → SSL 인증서가 없음

### 3. 브라우저 콘솔 확인
- Network 탭에서 요청 상태 확인
- Security 탭에서 인증서 정보 확인

## 권장 해결 순서

1. **SSL 인증서 파일 확인** (`ssl` 폴더)
2. **Vite 개발 서버 재시작** (인증서 파일 추가 후)
3. **브라우저 캐시 삭제** 후 재접속
4. **공유기 포워딩 설정 확인** (포트 7677 → 3000)
5. **인증서 유효성 확인** (만료일, 도메인 일치 여부)

## 추가 리소스

- [Vite HTTPS 설정](https://vitejs.dev/config/server-options.html#server-https)
- [SSL 인증서 생성 가이드](https://letsencrypt.org/docs/)
- [자체 서명 인증서 생성](https://www.openssl.org/docs/man1.1.1/man1/req.html)


