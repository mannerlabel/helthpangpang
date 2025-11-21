# analysis 컬럼 추가 가이드

## 문제
Supabase 테이블에 `analysis` 컬럼이 없어서 운동 세션 저장이 실패합니다.

에러 메시지:
```
Could not find the 'analysis' column of 'exercise_sessions' in the schema cache
```

## 해결 방법

### 방법 1: Supabase 대시보드에서 SQL 실행 (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 "SQL Editor" 클릭

3. **SQL 실행**
   - `ADD_ANALYSIS_COLUMN.sql` 파일의 내용을 복사하여 붙여넣기
   - "Run" 버튼 클릭 (또는 `Ctrl+Enter`)

4. **확인**
   - 결과에서 "analysis 컬럼이 추가되었습니다." 메시지 확인
   - 또는 "analysis 컬럼이 이미 존재합니다." 메시지 확인

### 방법 2: Table Editor에서 수정

1. **Table Editor 열기**
   - 왼쪽 사이드바에서 "Table Editor" 클릭
   - `exercise_sessions` 테이블 선택

2. **컬럼 추가**
   - 우측 상단 "Add Column" 버튼 클릭
   - 컬럼 이름: `analysis`
   - 타입: `jsonb`
   - Nullable: 체크 (NULL 허용)
   - "Save" 클릭

## 확인

컬럼 추가 후:

1. **다시 운동 완료**
   - 운동을 완료하고 저장 버튼 클릭
   - 브라우저 콘솔에서 에러가 없는지 확인

2. **데이터 확인**
   - Supabase Table Editor에서 `exercise_sessions` 테이블 확인
   - `analysis` 컬럼에 데이터가 저장되었는지 확인

## 참고

- `analysis` 컬럼은 AI 분석 결과(피드백 요약)를 저장합니다
- 컬럼이 없어도 운동 세션은 저장되지만, AI 분석 결과는 저장되지 않습니다
- 컬럼을 추가한 후에는 모든 운동 세션에 AI 분석 결과가 저장됩니다

