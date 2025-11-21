# 운동결과 데이터 출처 확인 가이드

## 현재 데이터 흐름

### 1. 데이터 저장 경로

**ResultPage.tsx** → `databaseService.createExerciseSession()` 호출

**databaseService.ts**에서:
- **Supabase 사용 시**: `exercise_sessions` 테이블에 저장
  - 테이블: `exercise_sessions`
  - 저장 위치: Supabase 데이터베이스
  - 확인 방법: Supabase 대시보드 → Table Editor → exercise_sessions

- **localStorage 사용 시**: `db_exercise_sessions` 키에 저장
  - 키: `localStorage.getItem('db_exercise_sessions')`
  - 저장 위치: 브라우저 localStorage
  - 확인 방법: 개발자 도구 → Application → Local Storage

### 2. 데이터 조회 경로

**HomePage.tsx** → `databaseService.getExerciseSessionsByUserId()` 호출

**databaseService.ts**에서:
- **Supabase 사용 시**: `exercise_sessions` 테이블에서 조회
  ```typescript
  supabase.from('exercise_sessions').select('*')
    .eq('user_id', supabaseUserId)
    .eq('completed', true)
  ```

- **localStorage 사용 시**: `db_exercise_sessions` 키에서 조회
  ```typescript
  localStorage.getItem('db_exercise_sessions')
  ```

### 3. Supabase 사용 여부 결정

**databaseService.ts** (11번째 줄):
```typescript
const USE_SUPABASE = !!(import.meta as any).env?.VITE_SUPABASE_URL 
  && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY 
  && supabase !== null
```

**조건:**
1. `.env` 파일에 `VITE_SUPABASE_URL`이 있어야 함
2. `.env` 파일에 `VITE_SUPABASE_ANON_KEY`가 있어야 함
3. `supabaseClient.ts`에서 supabase 객체가 null이 아니어야 함

### 4. 현재 상태 확인 방법

#### 브라우저 콘솔에서 확인:
1. 앱 시작 시:
   - `✅ Supabase 사용 중: [URL]` → Supabase 사용
   - `⚠️ Supabase 미사용, localStorage 사용 중` → localStorage 사용

2. 운동 세션 저장 시:
   - `💾 Supabase에 저장 시도:` → Supabase 저장 시도
   - `💾 localStorage에 저장:` → localStorage 저장

3. 운동 세션 조회 시:
   - `🔍 Supabase에서 조회 시도:` → Supabase 조회 시도
   - `🔍 localStorage에서 조회:` → localStorage 조회

#### localStorage 확인:
1. 개발자 도구(F12) 열기
2. Application 탭 (Chrome) 또는 Storage 탭 (Firefox)
3. Local Storage → 현재 사이트
4. `db_exercise_sessions` 키 확인

#### Supabase 확인:
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. Table Editor → `exercise_sessions` 테이블 확인
4. 또는 SQL Editor에서:
   ```sql
   SELECT COUNT(*) FROM exercise_sessions;
   SELECT * FROM exercise_sessions ORDER BY end_time DESC LIMIT 10;
   ```

### 5. 환경 변수 확인

프로젝트 루트에 `.env` 파일이 있는지 확인:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**주의**: `.env` 파일이 없거나 값이 없으면 localStorage를 사용합니다.

### 6. 데이터 저장 내용

**exercise_sessions 테이블/키에 저장되는 데이터:**
- `user_id`: 사용자 ID
- `crew_id`: 크루 ID (크루 모드인 경우)
- `mode`: 모드 ('single' 또는 'crew')
- `config`: 운동 설정 (type, sets, reps, restTime)
- `start_time`: 시작 시간
- `end_time`: 종료 시간
- `counts`: 카운트 배열 (각 카운트마다 angle, depth, state 포함)
- `best_score`: 최고 점수와 이미지
- `worst_score`: 최저 점수와 이미지
- `average_score`: 평균 점수
- `completed`: 완료 여부
- `analysis`: AI 분석 결과 (피드백 요약)

