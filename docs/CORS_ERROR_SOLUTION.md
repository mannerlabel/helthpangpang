# CORS 및 Supabase 오류 해결 가이드

## 오류 설명

### 1. CORS 오류
```
Access to fetch at 'https://irmaleosbdhykjacaegw.supabase.co/rest/v1/...' 
from origin 'https://vinedev.monster:7677' 
has been blocked by CORS policy
```

**원인**: Supabase가 `https://vinedev.monster:7677` 도메인을 허용하지 않음

**해결 방법**:
1. **Supabase 대시보드에서 CORS 설정 확인**
   - Supabase 프로젝트 → Settings → API
   - "Allowed Origins" 또는 "CORS" 설정 확인
   - `https://vinedev.monster:7677` 추가

2. **Supabase는 기본적으로 모든 도메인을 허용하지만**, 다음을 확인:
   - 프로젝트가 활성화되어 있는지
   - API 키가 올바른지
   - 네트워크 방화벽이 요청을 차단하지 않는지

### 2. 500 Internal Server Error

**원인**: Supabase 서버 측 오류
- RLS (Row Level Security) 정책 문제
- 데이터베이스 쿼리 오류
- 권한 문제

**해결 방법**:
1. **Supabase 대시보드에서 로그 확인**
   - Supabase 프로젝트 → Logs → API Logs
   - 500 오류의 상세 내용 확인

2. **RLS 정책 확인**
   - Supabase 프로젝트 → Authentication → Policies
   - `users`, `crew_recommendations`, `crew_recommendation_cancels` 테이블의 RLS 정책 확인
   - 필요한 경우 정책 수정 또는 비활성화 (개발 환경에서만)

3. **데이터베이스 쿼리 확인**
   - SQL Editor에서 직접 쿼리 실행하여 오류 확인
   - 예: `SELECT * FROM users WHERE id = '6832311e-ce4e-4bde-9912-d37cf9c05c0e'`

### 3. TypeError: Failed to fetch

**원인**: 위의 CORS 또는 500 오류로 인한 네트워크 요청 실패

**해결 방법**: 위의 CORS 및 500 오류를 먼저 해결

## 즉시 확인 사항

### 1. Supabase 프로젝트 상태 확인
```bash
# Supabase 대시보드에서 확인:
- 프로젝트가 활성화되어 있는지
- API 키가 올바른지
- 데이터베이스가 정상 작동하는지
```

### 2. 환경 변수 확인
`.env` 파일 또는 `C:/env/.env` 파일 확인:
```env
VITE_SUPABASE_URL=https://irmaleosbdhykjacaegw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. 네트워크 연결 확인
브라우저 개발자 도구 → Network 탭에서:
- 요청이 실제로 전송되는지 확인
- 응답 헤더 확인 (CORS 헤더 포함 여부)
- 500 오류의 상세 내용 확인

## 임시 해결 방법 (개발 환경)

### RLS 정책 비활성화 (개발 환경에서만)
Supabase 대시보드 → Authentication → Policies에서:
- 각 테이블의 RLS를 일시적으로 비활성화하여 테스트
- **주의**: 프로덕션 환경에서는 절대 사용하지 마세요!

### CORS 우회 (개발 환경에서만)
개발 서버를 프록시로 사용하거나, 브라우저 확장 프로그램 사용
- **주의**: 프로덕션 환경에서는 사용하지 마세요!

## 권장 해결 순서

1. **Supabase 대시보드에서 CORS 설정 확인 및 수정**
2. **Supabase 로그에서 500 오류 원인 확인**
3. **RLS 정책 확인 및 수정**
4. **환경 변수 재확인**
5. **브라우저 캐시 및 쿠키 삭제 후 재시도**

## 추가 리소스

- [Supabase CORS 문서](https://supabase.com/docs/guides/api/cors)
- [Supabase RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase API 문서](https://supabase.com/docs/reference/javascript/introduction)

