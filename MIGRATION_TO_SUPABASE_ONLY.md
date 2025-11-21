# Supabase 전용 마이그레이션 가이드

## 변경 사항

모든 데이터베이스 작업이 이제 Supabase만 사용합니다. localStorage 폴백이 제거되었습니다.

## 주요 변경 함수

### 완료된 함수
- ✅ `createUser` - Supabase만 사용
- ✅ `getUserById` - Supabase만 사용
- ✅ `getUserByEmail` - Supabase만 사용
- ✅ `updateUser` - Supabase만 사용
- ✅ `createCrew` - Supabase만 사용
- ✅ `getCrewsByUserId` - Supabase만 사용
- ✅ `updateCrew` - Supabase만 사용
- ✅ `deleteCrew` - Supabase만 사용
- ✅ `createExerciseSession` - Supabase만 사용
- ✅ `getExerciseSessionsByUserId` - Supabase만 사용
- ✅ `getExerciseSessionById` - Supabase만 사용
- ✅ `updateExerciseSession` - Supabase만 사용

### 남은 작업
다음 함수들도 localStorage 폴백을 제거해야 합니다:
- `createSingleGoal`, `getSingleGoalsByUserId`, `updateSingleGoal`, `deleteSingleGoal`
- `createJoggingGoal`, `getJoggingGoalsByUserId`, `updateJoggingGoal`, `deleteJoggingGoal`
- `createJoggingCrew`, `getJoggingCrewsByUserId`, `updateJoggingCrew`, `deleteJoggingCrew`
- `createChatMessage`, `getChatMessages`
- `addCrewMember`, `removeCrewMember`, `updateCrewMember`
- 기타 모든 함수

## 패턴

모든 함수는 다음 패턴을 따릅니다:

```typescript
async functionName(...args): Promise<ReturnType> {
  await this.initialize()
  
  if (!USE_SUPABASE || !supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }
  
  try {
    // Supabase 작업
    const { data, error } = await supabase
      .from('table_name')
      .operation(...)
    
    if (error) {
      console.error('Supabase 작업 실패:', error)
      throw error
    }
    
    return data ? this.mapSupabaseData(data) : null
  } catch (e) {
    console.error('작업 중 오류:', e)
    throw e
  }
}
```

## 환경 변수 필수

`.env` 파일에 다음이 반드시 있어야 합니다:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

환경 변수가 없으면 앱이 시작되지 않습니다.

## 테이블 확인

`SUPABASE_TABLE_TEST.sql` 파일을 Supabase SQL Editor에서 실행하여 모든 테이블과 RLS 정책이 올바르게 설정되었는지 확인하세요.

