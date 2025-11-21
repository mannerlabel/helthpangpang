# SSL 인증서 설정 가이드

## 문제 상황

`ERR_CERT_COMMON_NAME_INVALID` 오류가 발생하는 경우, 인증서의 도메인과 접속하는 도메인이 일치하지 않아서 발생합니다.

현재 인증서는 `vinedev.monster` 도메인용으로 발급되었습니다.

## 해결 방법

### 방법 1: 개발 환경에서는 HTTP 사용 (권장)

개발 환경에서는 HTTP를 사용하고, 프로덕션에서만 HTTPS를 사용합니다.

```bash
# 개발 서버 실행 (HTTP)
npm run dev
# http://localhost:3000 으로 접속
```

### 방법 2: 실제 도메인으로 접속

인증서가 발급된 실제 도메인으로 접속합니다.

```bash
# hosts 파일 수정 (Windows: C:\Windows\System32\drivers\etc\hosts)
127.0.0.1 vinedev.monster

# 그 후 브라우저에서 접속
https://vinedev.monster:3000
```

### 방법 3: 환경 변수로 HTTPS 강제 사용

개발 환경에서도 HTTPS를 사용하려면 환경 변수를 설정합니다.

**C:/env/.env** 파일에 추가:
```env
VITE_USE_HTTPS=true
```

그 후 서버 재시작:
```bash
npm run dev
```

⚠️ **주의**: `localhost`로 접속하면 여전히 인증서 오류가 발생합니다. `vinedev.monster`로 접속해야 합니다.

### 방법 4: localhost용 Self-Signed 인증서 생성

개발 환경용 localhost 인증서를 생성할 수 있습니다 (OpenSSL 필요):

```bash
# localhost용 인증서 생성
openssl req -x509 -newkey rsa:4096 -keyout ssl/localhost-key.pem -out ssl/localhost-cert.pem -days 365 -nodes -subj "/CN=localhost"

# 코드에서 localhost 인증서 우선 사용하도록 수정 필요
```

## 현재 설정

- **개발 모드**: 기본적으로 HTTP 사용 (인증서 오류 방지)
- **프로덕션 모드**: HTTPS 사용 (실제 도메인 필요)
- **인증서 파일**: `ssl/vinedev.monster-key.pem`, `ssl/vinedev.monster-chain.pem`

## 권장 사항

1. **로컬 개발**: HTTP 사용 (`npm run dev`)
2. **프로덕션 배포**: 실제 도메인(`vinedev.monster`)으로 HTTPS 사용
3. **테스트**: hosts 파일 수정 후 실제 도메인으로 접속

