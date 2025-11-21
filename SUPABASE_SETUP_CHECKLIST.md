# Supabase 설정 체크리스트

## 1. 환경 변수 확인

`.env` 파일에 다음이 있어야 합니다:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 2. 테이블 생성

`SUPABASE_SQL_SETUP.sql` 파일의 모든 내용을 Supabase SQL Editor에서 실행하세요.

### 필수 테이블 목록:
- ✅ `users`
- ✅ `crews`
- ✅ `crew_members`
- ✅ `jogging_crews`
- ✅ `chat_messages`
- ✅ `exercise_sessions` (analysis 컬럼 포함)
- ✅ `jogging_sessions`
- ✅ `single_goals`
- ✅ `jogging_goals`

## 3. RLS 정책 확인

모든 테이블에 RLS가 활성화되어 있고, 다음 정책이 설정되어 있어야 합니다:
```sql
CREATE POLICY "Enable all operations for all users" ON [table_name] FOR ALL USING (true) WITH CHECK (true);
```

## 4. 테이블 및 정책 테스트

`SUPABASE_TABLE_TEST.sql` 파일을 Supabase SQL Editor에서 실행하여:
- 모든 테이블이 존재하는지 확인
- RLS가 활성화되어 있는지 확인
- 모든 정책이 설정되어 있는지 확인
- 인덱스가 생성되어 있는지 확인
- 외래 키 제약 조건이 올바른지 확인

## 5. 데이터베이스 서비스 확인

앱을 실행하고 브라우저 콘솔에서 다음 메시지를 확인:
- ✅ `✅ Supabase 사용 중: [URL]` - 정상
- ❌ `❌ Supabase가 설정되지 않았습니다.` - 환경 변수 확인 필요

## 6. 주요 기능 테스트

다음 기능들이 Supabase에서 정상 작동하는지 확인:
- [ ] 사용자 로그인/회원가입
- [ ] 싱글 모드 목표 생성/수정/삭제
- [ ] 크루 생성/수정/삭제
- [ ] 조깅 목표 생성/수정/삭제
- [ ] 조깅 크루 생성/수정/삭제
- [ ] 운동 세션 저장
- [ ] 운동 세션 조회 (홈 화면 그래프)
- [ ] 채팅 메시지 저장/조회

## 7. 에러 처리

모든 데이터베이스 작업이 실패하면:
- 콘솔에 에러 메시지가 표시됩니다
- 사용자에게 적절한 에러 메시지가 표시됩니다
- localStorage 폴백은 더 이상 사용되지 않습니다

## 문제 해결

### "Supabase가 설정되지 않았습니다" 에러
1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 환경 변수 이름이 정확한지 확인 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
3. 앱을 재시작

### 테이블이 없다는 에러
1. `SUPABASE_SQL_SETUP.sql`을 Supabase SQL Editor에서 실행
2. `SUPABASE_TABLE_TEST.sql`로 테이블 존재 확인

### RLS 정책 에러
1. Supabase 대시보드 → Authentication → Policies 확인
2. 모든 테이블에 "Enable all operations for all users" 정책이 있는지 확인

