# 에러 분석 및 해결 방법

## 1. 음성 출력 오류: interrupted

### 원인
- `speechSynthesis.cancel()`이 호출되면서 이전 음성이 중단됨
- 여러 음성이 빠르게 연속으로 호출될 때 발생
- 카운트다운 음성("다섯", "넷", "셋", "둘", "하나", "시작!")이 빠르게 연속 호출되면서 이전 음성이 중단됨

### 해결 방법
- `interrupted` 에러는 정상적인 동작입니다 (이전 음성을 취소하고 새 음성을 재생하기 때문)
- 에러 로그를 경고(warning)로 변경하거나, `interrupted` 에러는 무시하도록 처리

## 2. Supabase API 키 조회 406 에러

### 원인
```
GET https://irmaleosbdhykjacaegw.supabase.co/rest/v1/api_keys?select=api_key%2Cis_active&key_type=eq.llm&is_active=eq.true 406 (Not Acceptable)
```

- `api_keys` 테이블이 존재하지 않거나
- RLS 정책이 잘못 설정되어 있거나
- 컬럼명이 잘못되었을 수 있음

### 해결 방법
- `api_keys` 테이블이 생성되어 있는지 확인
- RLS 정책 확인 및 수정
- 에러가 발생해도 기본 분석을 반환하도록 처리 (이미 구현됨)

## 3. AI 분석 API 호출 실패 (ERR_CONNECTION_REFUSED)

### 원인
```
POST http://localhost:8000/api/analyze net::ERR_CONNECTION_REFUSED
```

- 로컬 AI 분석 서버가 실행되지 않음
- `VITE_AI_API_URL` 환경 변수가 `http://localhost:8000`으로 설정되어 있음

### 해결 방법
- 로컬 AI 분석 서버를 실행하거나
- 환경 변수를 제거하여 OpenAI API를 직접 사용하도록 설정
- 에러가 발생해도 기본 분석을 반환하도록 처리 (이미 구현됨)

## 4. UUID 형식 에러 (22P02)

### 원인
```
invalid input syntax for type uuid: "session_1764212958380"
```

- 조깅 세션 ID가 `jsession_` 또는 `session_` 형식으로 생성됨
- Supabase의 `exercise_sessions` 테이블은 UUID 형식의 ID를 기대함
- `getExerciseSessionById`에서 조깅 세션 ID를 조회하려고 할 때 발생

### 해결 방법
- 조깅 세션은 `jogging_sessions` 테이블에 저장되므로, `exercise_sessions`에서 조회하지 않도록 수정
- `ResultPage`에서 조깅 세션인 경우 `getExerciseSessionById`를 호출하지 않도록 수정

