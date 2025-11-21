# 운동 세션 저장 테스트 가이드

## 문제 상황
- 현재 사용자(`banchan@healthpangpang.com`)의 세션이 0개
- 다른 사용자들의 세션은 4개 존재
- 사용자 정보는 Supabase에 올바르게 등록되어 있음

## 테스트 방법

### 1. 운동 완료 후 저장 확인

1. **운동 시작**
   - 싱글 모드 또는 크루 모드로 운동 시작
   - 운동을 완료 (최소 1회 이상 카운트)

2. **결과 페이지에서 저장 확인**
   - ResultPage에서 "저장" 버튼 클릭
   - 브라우저 콘솔(F12)에서 다음 로그 확인:
     ```
     💾 운동 세션 저장 시작:
     💾 Supabase에 저장 시도:
     ✅ Supabase 저장 성공:
     ✅ 운동 세션 저장 완료:
     🔍 저장 후 확인:
     ```

3. **저장 확인**
   - 브라우저 콘솔에서 `checkSupabaseData()` 실행
   - "3️⃣ 현재 사용자의 세션 확인" 결과 확인
   - 세션이 1개 이상 있어야 함

### 2. 로그 확인 포인트

저장 과정에서 다음을 확인하세요:

1. **사용자 ID 매핑**
   ```
   originalUserId: [localStorage ID 또는 UUID]
   mappedUserId: [Supabase UUID]
   userIdMatch: true/false
   ```
   - `userIdMatch`가 `false`이면 매핑 문제

2. **저장 성공 확인**
   ```
   sessionId: [생성된 세션 ID]
   userId: [저장된 user_id]
   completed: true
   ```
   - `userId`가 현재 사용자 ID와 일치해야 함
   - `completed`가 `true`여야 함

3. **저장 후 확인**
   ```
   foundSessions: [조회된 세션 수]
   latestSessionId: [최신 세션 ID]
   matches: true/false
   ```
   - `matches`가 `true`이면 저장 성공

### 3. 문제 해결

#### 저장이 안 되는 경우

1. **콘솔 에러 확인**
   - 빨간색 에러 메시지 확인
   - 특히 `❌ Supabase 운동 세션 저장 실패:` 메시지

2. **네트워크 탭 확인**
   - F12 → Network 탭
   - `exercise_sessions` 관련 요청 확인
   - 상태 코드가 200이어야 함

3. **Supabase 직접 확인**
   - Supabase 대시보드 → Table Editor → `exercise_sessions`
   - 최신 행 확인
   - `user_id`가 현재 사용자 ID와 일치하는지 확인

#### user_id가 잘못 저장되는 경우

1. **getSupabaseUserId 함수 확인**
   - `databaseService.ts`의 `getSupabaseUserId` 함수
   - localStorage 사용자 ID를 Supabase UUID로 변환

2. **수동 수정 (임시)**
   - Supabase SQL Editor에서:
   ```sql
   -- 잘못된 user_id를 현재 사용자로 변경
   UPDATE exercise_sessions
   SET user_id = '6e1fd630-69f5-48cb-8f1f-c0a8aa5d5c53'
   WHERE id = '세션_ID';
   ```

### 4. 예상 결과

정상적으로 저장되면:
- ✅ 콘솔에 "✅ 운동 세션 저장 완료" 메시지
- ✅ `checkSupabaseData()` 실행 시 현재 사용자 세션 1개 이상
- ✅ HomePage에 운동 내역 표시

## 다음 단계

운동을 완료한 후:
1. 브라우저 콘솔 로그 확인
2. `checkSupabaseData()` 실행하여 세션 확인
3. 문제가 있으면 로그를 공유해주세요

