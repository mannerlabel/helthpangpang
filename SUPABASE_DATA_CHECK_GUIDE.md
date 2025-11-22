# Supabase 데이터 확인 가이드

## 방법 1: Supabase 대시보드에서 SQL 실행 (권장)

### 단계별 설명

1. **Supabase 대시보드 접속**
   - 브라우저에서 https://supabase.com/dashboard 접속
   - 로그인 (이메일/비밀번호)

2. **프로젝트 선택**
   - 대시보드에서 해당 프로젝트 클릭
   - 프로젝트 이름은 `.env` 파일의 `VITE_SUPABASE_URL`에서 확인 가능
     - 예: `https://your-project-id.supabase.co` → 프로젝트 ID는 `your-project-id`

3. **SQL Editor 열기**
   - 왼쪽 사이드바에서 "SQL Editor" 클릭
   - 또는 상단 메뉴에서 "SQL Editor" 선택

4. **SQL 파일 내용 복사**
   - `SUPABASE_DATA_CHECK.sql` 파일을 열어서 전체 내용 복사
   - 또는 필요한 쿼리만 선택하여 복사

5. **SQL 실행**
   - SQL Editor의 텍스트 영역에 복사한 SQL 붙여넣기
   - 우측 상단의 "Run" 버튼 클릭 (또는 `Ctrl+Enter` / `Cmd+Enter`)
   - 결과가 하단에 표시됨

6. **결과 확인**
   - 각 쿼리의 결과를 확인하여 데이터 상태 파악
   - 특히 다음을 확인:
     - `exercise_sessions` 테이블에 데이터가 있는지
     - `completed` 필드가 `true`인 세션이 있는지
     - 사용자 ID가 올바르게 저장되었는지

## 방법 2: 코드를 통한 자동 확인 (개발자용)

브라우저 콘솔에서 실행하거나, 별도의 확인 스크립트를 실행할 수 있습니다.

### 브라우저 콘솔에서 실행

1. 앱 실행 후 브라우저 개발자 도구 열기 (F12)
2. Console 탭 선택
3. 제공된 JavaScript 코드 실행

### Node.js 스크립트 실행

터미널에서 `node check-supabase-data.js` 실행

