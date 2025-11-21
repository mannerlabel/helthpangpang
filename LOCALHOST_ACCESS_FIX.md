# localhost 접속 시 인증서 오류 해결 방법

## 문제 상황

`https://localhost:3000`으로 접속하면 `NET::ERR_CERT_COMMON_NAME_INVALID` 오류가 발생합니다.

**원인**: SSL 인증서가 `vinedev.monster` 도메인용으로 발급되어 있어서 `localhost`와 일치하지 않습니다.

## 해결 방법

### 방법 1: 실제 도메인으로 접속 (권장)

브라우저에서 다음 주소로 접속하세요:

```
https://vinedev.monster:3000
```

**필수 조건:**
- DNS 설정: `vinedev.monster`가 서버 IP로 설정되어 있어야 함
- 방화벽: 포트 3000이 열려있어야 함

### 방법 2: hosts 파일 수정 (로컬 개발용)

Windows에서 `localhost`를 `vinedev.monster`로 매핑:

1. **관리자 권한으로 메모장 실행**
2. **hosts 파일 열기**: `C:\Windows\System32\drivers\etc\hosts`
3. **다음 줄 추가**:
   ```
   127.0.0.1 vinedev.monster
   ```
4. **파일 저장**
5. **브라우저에서 접속**: `https://vinedev.monster:3000`

이제 `localhost` 대신 `vinedev.monster`로 접속하면 인증서 오류 없이 접속됩니다.

### 방법 3: 브라우저에서 인증서 경고 무시 (개발 환경에서만)

⚠️ **주의**: 개발 환경에서만 사용하세요. 프로덕션에서는 사용하지 마세요.

1. Chrome에서 "고급" 버튼 클릭
2. "안전하지 않음으로 이동" 또는 "계속 진행" 클릭
3. 인증서 경고를 무시하고 접속

**Chrome 경고 메시지:**
- "연결이 비공개로 설정되어 있지 않습니다"
- "고급" → "localhost로 이동(안전하지 않음)" 클릭

### 방법 4: HTTP로 접속 (카메라 접근 불가)

개발 환경에서 카메라를 사용하지 않는다면 HTTP로 접속:

```bash
# vite.config.ts에서 HTTPS 비활성화하거나
# 환경 변수 설정
VITE_USE_HTTPS=false npm run dev
```

그 후 `http://localhost:3000`으로 접속

⚠️ **주의**: HTTP로 접속하면 카메라 접근이 불가능합니다. 브라우저 보안 정책상 카메라는 HTTPS에서만 접근 가능합니다.

## 권장 방법

**외부 접속이 목적이라면:**
- ✅ 방법 1 사용: `https://vinedev.monster:3000`으로 접속

**로컬 개발이 목적이라면:**
- ✅ 방법 2 사용: hosts 파일 수정 후 `https://vinedev.monster:3000`으로 접속
- 또는 방법 3 사용: 브라우저에서 경고 무시 (개발 환경에서만)

## 확인 사항

접속 전 다음을 확인하세요:

1. **서버 실행 중인지 확인**
   ```bash
   npm run server
   ```

2. **인증서 파일 존재 확인**
   - `ssl/vinedev.monster-key.pem`
   - `ssl/vinedev.monster-chain.pem`

3. **포트 3000 열려있는지 확인**
   - 방화벽 설정 확인
   - 다른 프로그램이 포트를 사용하지 않는지 확인

## 추가 정보

- 인증서는 `vinedev.monster` 도메인용으로만 유효합니다
- `localhost`로 접속하려면 localhost용 인증서가 필요합니다
- 카메라 접근을 위해서는 HTTPS가 필수입니다

