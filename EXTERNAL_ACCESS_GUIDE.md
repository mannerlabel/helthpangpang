# 외부 HTTPS 접속 가이드

## 카메라 접근을 위한 HTTPS 필수 사항

브라우저 보안 정책상 **카메라/마이크 접근은 HTTPS 또는 localhost에서만 가능**합니다.

외부 도메인으로 접속하여 카메라를 사용하려면 **반드시 HTTPS**가 필요합니다.

## 현재 설정

✅ **HTTPS 활성화됨**
- 인증서: `ssl/vinedev.monster-key.pem`, `ssl/vinedev.monster-chain.pem`
- 서버 바인딩: `0.0.0.0` (모든 네트워크 인터페이스)
- 포트: 3000

## 접속 방법

### 1. 외부에서 접속 (권장)

```
https://vinedev.monster:3000
```

**필수 조건:**
- 도메인 DNS가 서버 IP로 설정되어 있어야 함
- 방화벽에서 포트 3000이 열려있어야 함
- 인증서가 정상적으로 설치되어 있어야 함

### 2. 로컬에서 접속

```
https://localhost:3000
```

⚠️ **주의**: 인증서가 `vinedev.monster`용이므로 브라우저에서 인증서 경고가 발생합니다.
- "고급" → "안전하지 않음으로 이동" 클릭하여 접속 가능
- 개발 환경에서만 사용 권장

## 서버 실행

### 개발 서버 (Vite)
```bash
npm run dev
```

### 프로덕션 서버
```bash
npm run build
npm run server:prod
```

## 네트워크 설정 확인

### 1. 방화벽 설정 (Windows)

```powershell
# 인바운드 규칙 추가
New-NetFirewallRule -DisplayName "HTTPS Server Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

또는 Windows 방화벽 GUI에서:
- 제어판 → Windows Defender 방화벽 → 고급 설정
- 인바운드 규칙 → 새 규칙
- 포트 선택 → TCP → 특정 로컬 포트: 3000
- 연결 허용 → 모든 프로필 선택

### 2. 라우터 포트 포워딩 (필요시)

외부 인터넷에서 접속하려면:
- 라우터 관리 페이지 접속
- 포트 포워딩 설정
- 외부 포트: 3000 (또는 원하는 포트)
- 내부 IP: 서버의 로컬 IP
- 내부 포트: 3000
- 프로토콜: TCP

### 3. DNS 설정

도메인 `vinedev.monster`가 서버의 공인 IP로 설정되어 있어야 합니다.

```
A 레코드: vinedev.monster → [서버 공인 IP]
```

## 테스트 방법

### 1. 로컬 테스트
```bash
curl -k https://localhost:3000
```

### 2. 외부 접속 테스트
```bash
curl -k https://vinedev.monster:3000
```

### 3. 브라우저에서 테스트
1. `https://vinedev.monster:3000` 접속
2. 카메라 권한 요청 확인
3. 카메라 접근 성공 여부 확인

## 문제 해결

### 인증서 오류 발생 시

**ERR_CERT_COMMON_NAME_INVALID**
- 원인: 접속 도메인과 인증서 도메인이 불일치
- 해결: `vinedev.monster`로 접속하거나 hosts 파일 수정

**ERR_CONNECTION_REFUSED**
- 원인: 방화벽이 포트를 차단하거나 서버가 실행되지 않음
- 해결: 방화벽 설정 확인 및 서버 실행 상태 확인

**카메라 접근 불가**
- 원인: HTTP로 접속하거나 인증서 오류
- 해결: HTTPS로 접속하고 인증서 경고를 수락

## 보안 고려사항

1. **프로덕션 환경**: 포트 3000 대신 표준 HTTPS 포트(443) 사용 권장
2. **리버스 프록시**: Nginx나 Apache를 앞단에 두고 SSL 종료 권장
3. **방화벽**: 필요한 IP만 허용하도록 설정
4. **인증서**: Let's Encrypt 등 무료 인증서 사용 권장

## 포트 변경 (선택사항)

표준 HTTPS 포트(443)를 사용하려면:

```bash
# 환경 변수로 포트 지정
PORT=443 npm run dev
```

⚠️ **주의**: 443 포트는 관리자 권한이 필요할 수 있습니다.

