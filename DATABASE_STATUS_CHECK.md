# 데이터베이스 저장 상태 확인 가이드

## 현재 상태 확인 방법

### 1. 브라우저 콘솔에서 확인

개발자 도구(F12)를 열고 콘솔 탭에서 다음을 확인하세요:

1. **Supabase 사용 여부 확인**
   - 앱 시작 시 다음 메시지가 표시됩니다:
     - `✅ Supabase 사용 중: [URL]` → Supabase 사용 중
     - `⚠️ Supabase 미사용, localStorage 사용 중` → localStorage 사용 중

2. **운동 세션 저장 시 로그 확인**
   - 운동 완료 후 콘솔에서 다음 로그를 확인:
     - `📊 운동 세션 저장 시작:` → 저장 시작
     - `💾 Supabase에 저장 시도:` → Supabase 저장 시도
     - `✅ Supabase 저장 성공:` → Supabase 저장 성공
     - `💾 localStorage에 저장:` → localStorage 저장 (Supabase 미사용 또는 실패 시)

3. **운동 세션 조회 시 로그 확인**
   - 홈페이지나 결과 페이지에서 다음 로그를 확인:
     - `📖 운동 세션 조회 시작:` → 조회 시작
     - `🔍 Supabase에서 조회 시도:` → Supabase 조회 시도
     - `✅ Supabase 조회 성공:` → Supabase 조회 성공
     - `🔍 localStorage에서 조회:` → localStorage 조회 (Supabase 미사용 또는 실패 시)

### 2. localStorage 확인

브라우저 개발자 도구에서:

1. **Application 탭** (Chrome) 또는 **Storage 탭** (Firefox) 열기
2. **Local Storage** → 현재 사이트 선택
3. 다음 키를 확인:
   - `db_exercise_sessions` → 운동 세션 데이터 (Supabase 미사용 시)

### 3. Supabase 테이블 확인

Supabase가 사용 중인 경우:

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **Table Editor** 열기
   - 왼쪽 사이드바에서 "Table Editor" 클릭
   - `exercise_sessions` 테이블이 있는지 확인

3. **SQL Editor**에서 확인
   ```sql
   SELECT COUNT(*) FROM exercise_sessions;
   SELECT * FROM exercise_sessions ORDER BY end_time DESC LIMIT 10;
   ```

### 4. 환경 변수 확인

프로젝트 루트의 `.env` 파일 확인:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

이 파일이 없거나 값이 없으면 localStorage를 사용합니다.

## 문제 해결

### Supabase 테이블이 없는 경우

1. `SUPABASE_SQL_SETUP.sql` 파일 열기
2. Supabase 대시보드의 SQL Editor에서 실행
3. `exercise_sessions` 테이블이 생성되었는지 확인

### 데이터가 localStorage에만 저장되는 경우

1. `.env` 파일 확인
2. Supabase 환경 변수가 올바른지 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### 데이터가 저장되지 않는 경우

1. 브라우저 콘솔에서 에러 메시지 확인
2. 네트워크 탭에서 Supabase 요청 확인
3. Supabase RLS 정책 확인

