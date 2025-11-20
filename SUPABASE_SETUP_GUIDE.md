# Supabase 대시보드에서 SQL 실행 가이드

## 1단계: Supabase 대시보드 접속

1. 브라우저에서 https://supabase.com 접속
2. 로그인 후 프로젝트 선택: **HealthPangPang** (또는 https://irmaleosbdhykjacaegw.supabase.co)

## 2단계: SQL Editor 열기

1. 왼쪽 사이드바에서 **SQL Editor** 클릭
   - 또는 직접 URL: https://supabase.com/dashboard/project/irmaleosbdhykjacaegw/sql/new

## 3단계: SQL 실행 순서

### 방법 1: 전체 한 번에 실행 (권장)

1. `SUPABASE_SQL_SETUP.sql` 파일 열기
2. 전체 내용 복사 (Ctrl+A → Ctrl+C)
3. Supabase SQL Editor에 붙여넣기 (Ctrl+V)
4. **RUN** 버튼 클릭 (또는 Ctrl+Enter)

### 방법 2: 단계별 실행 (안전)

#### 1단계: 사용자만 먼저 생성
1. `SUPABASE_INITIAL_USERS.sql` 파일 열기
2. 내용 복사 후 SQL Editor에 붙여넣기
3. **RUN** 버튼 클릭
4. 결과 확인: "INSERT 0 3" 또는 "INSERT 0 0" (이미 존재하는 경우)

#### 2단계: 나머지 실행
1. `SUPABASE_SQL_SETUP.sql` 파일 열기
2. 전체 내용 복사 후 SQL Editor에 붙여넣기
3. **RUN** 버튼 클릭

## 4단계: 실행 결과 확인

1. SQL Editor 하단의 **Results** 탭에서 실행 결과 확인
2. 에러가 없다면 "Success. No rows returned" 또는 테이블 목록이 표시됩니다
3. 에러가 있다면 에러 메시지를 확인하고 수정 후 다시 실행

## 5단계: 테이블 확인

1. 왼쪽 사이드바에서 **Table Editor** 클릭
2. 생성된 테이블들이 목록에 표시되는지 확인:
   - users (3명의 테스트 사용자)
   - crews (9개의 테스트 크루)
   - crew_members (각 크루의 크루장)
   - jogging_crews
   - chat_messages
   - exercise_sessions
   - jogging_sessions

## 6단계: 데이터 확인

### 사용자 확인
```sql
SELECT * FROM users;
```
- 3명의 사용자(밥, 반찬, 맹)가 생성되어 있어야 합니다.

### 크루 확인
```sql
SELECT c.name, u.name as creator, c.current_members 
FROM crews c 
JOIN users u ON c.created_by = u.id 
ORDER BY c.created_at;
```
- 9개의 크루가 생성되어 있어야 합니다.

### 크루 멤버 확인
```sql
SELECT c.name as crew_name, u.name as member_name, cm.role 
FROM crew_members cm 
JOIN crews c ON cm.crew_id = c.id 
JOIN users u ON cm.user_id = u.id;
```
- 각 크루의 크루장이 추가되어 있어야 합니다.

## 7단계: Realtime 활성화 (선택사항)

실시간 동기화를 사용하려면:

1. 왼쪽 사이드바에서 **Database** → **Replication** 클릭
2. 다음 테이블들에 대해 Realtime 토글을 **ON**으로 설정:
   - `crews`
   - `crew_members`
   - `chat_messages`

## 문제 해결

### 에러: "relation already exists"
- 테이블이 이미 존재한다는 의미입니다. `CREATE TABLE IF NOT EXISTS`를 사용했으므로 무시해도 됩니다.

### 에러: "permission denied"
- RLS 정책이 제대로 설정되지 않았을 수 있습니다. 모든 CREATE POLICY 문을 다시 실행해보세요.

### 에러: "syntax error"
- SQL 문법 오류입니다. SQL 파일의 내용을 다시 확인하세요.

### 에러: "duplicate key value violates unique constraint"
- 사용자나 크루가 이미 존재합니다. `ON CONFLICT DO NOTHING` 또는 `WHERE NOT EXISTS`로 중복을 방지하므로 무시해도 됩니다.

### 사용자가 생성되지 않음
- `SUPABASE_INITIAL_USERS.sql` 파일을 먼저 실행해보세요.
- 또는 `SUPABASE_SQL_SETUP.sql`에서 사용자 생성 부분만 따로 실행해보세요.

## 참고

- SQL Editor는 여러 개의 쿼리를 한 번에 실행할 수 있습니다
- 각 쿼리는 세미콜론(;)으로 구분됩니다
- 실행 후 결과는 하단의 Results 탭에서 확인할 수 있습니다
- 사용자 생성은 `SUPABASE_INITIAL_USERS.sql` 파일로 따로 실행할 수 있습니다
