# Supabase Realtime 채널 구독 문제 해결 가이드

## 문제: 채널 구독 실패

채널 구독이 실패하는 경우, 다음을 순서대로 확인하세요.

## 1. Realtime Settings 확인

Supabase 대시보드 → Realtime → Settings에서 확인:

- ✅ **Enable Realtime service**: ON
- ✅ **Allow public access**: ON
- ✅ **Max events per second**: 100 (또는 적절한 값)
- ✅ **Max presence events per second**: 100 (또는 적절한 값)

**중요**: "Allow public access"가 ON이면 Broadcast 채널은 별도 정책 없이 사용 가능합니다.

## 2. 환경 변수 확인

브라우저 콘솔에서 확인:

```javascript
// 환경 변수 확인
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '설정됨' : '없음')
```

또는 `C:/env/.env` 파일 확인:
- `VITE_SUPABASE_URL`이 올바르게 설정되어 있는지
- `VITE_SUPABASE_ANON_KEY`가 올바르게 설정되어 있는지

## 3. Realtime 연결 상태 확인

브라우저 콘솔에서 다음 로그 확인:

```
🔍 Supabase Realtime 연결 상태: 연결됨
```

또는:

```
🔍 Supabase Realtime 연결 상태: 연결 중
```

만약 "연결 안 됨"이면:
- 네트워크 연결 확인
- Supabase 프로젝트 상태 확인
- 방화벽/프록시 설정 확인

## 4. 채널 구독 로그 확인

브라우저 콘솔에서 다음 로그 확인:

### 성공 시:
```
📡 채널 구독 상태 변화: crew_..._signaling - SUBSCRIBED
✅ Subscribed to channel: crew_..._signaling
이제부터 실시간 데이터 수신 및 송신이 가능합니다.
```

### 실패 시:
```
📡 채널 구독 상태 변화: crew_..._signaling - CLOSED
또는
📡 채널 구독 상태 변화: crew_..._signaling - TIMED_OUT
또는
📡 채널 구독 상태 변화: crew_..._signaling - CHANNEL_ERROR
```

## 5. 채널 이름 확인

채널 이름이 올바른 형식인지 확인:

- ✅ 형식: `crew_{crewId}_signaling`
- ✅ 예: `crew_98018821-f6a9-4dd7-89a0-1b7ed7b74e5e_signaling`
- ✅ 길이: 200자 이하
- ✅ 특수 문자: `-`, `_`만 사용 (코드에서 자동으로 sanitize됨)

## 6. WebSocket 연결 확인

브라우저 개발자 도구 → Network 탭에서 확인:

1. **WebSocket 연결 확인**
   - `wss://` 프로토콜로 연결되는지 확인
   - 연결 상태가 "101 Switching Protocols"인지 확인

2. **연결 URL 확인**
   - `wss://{project-ref}.supabase.co/realtime/v1/websocket` 형식인지 확인

## 7. 일반적인 오류 및 해결 방법

### 오류: "Channel closed during subscription"

**원인**:
- Realtime 서비스가 비활성화됨
- 네트워크 연결 문제
- 채널 이름 형식 오류

**해결**:
1. Realtime Settings에서 "Enable Realtime service" 확인
2. 네트워크 연결 확인
3. 채널 이름 형식 확인

### 오류: "Channel subscription timed out"

**원인**:
- 네트워크 연결 지연
- Supabase 서버 응답 지연

**해결**:
1. 네트워크 연결 확인
2. 잠시 후 재시도
3. Supabase 프로젝트 상태 확인

### 오류: "Channel error"

**원인**:
- 채널 이름 형식 오류
- Realtime 설정 오류

**해결**:
1. 채널 이름 형식 확인
2. Realtime Settings 확인
3. 브라우저 콘솔의 상세 에러 메시지 확인

### 오류: "Supabase client not initialized"

**원인**:
- 환경 변수가 설정되지 않음
- Supabase 클라이언트 초기화 실패

**해결**:
1. `C:/env/.env` 파일 확인
2. `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY` 확인
3. 브라우저 새로고침

## 8. 디버깅 팁

### 브라우저 콘솔에서 직접 테스트

```javascript
// Supabase 클라이언트 확인
import { supabase } from './src/services/supabaseClient'
console.log('Supabase client:', supabase)

// 채널 구독 테스트
const testChannel = supabase.channel('test_channel')
testChannel.subscribe((status) => {
  console.log('Test channel status:', status)
})
```

### 네트워크 탭에서 WebSocket 메시지 확인

1. 브라우저 개발자 도구 → Network 탭
2. "WS" 필터 선택 (WebSocket)
3. 채널 구독 시도
4. WebSocket 연결 확인 및 메시지 확인

## 9. 추가 리소스

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting)
- [Supabase Channel Patterns](https://supabase.com/docs/guides/realtime/channels)

## 10. 여전히 문제가 해결되지 않으면

1. **Supabase 대시보드 확인**
   - 프로젝트 상태 확인
   - Realtime 서비스 상태 확인
   - 최근 변경 사항 확인

2. **코드 확인**
   - `src/services/signalingService.ts` 확인
   - `src/services/supabaseClient.ts` 확인
   - 브라우저 콘솔의 전체 에러 로그 확인

3. **커뮤니티 지원**
   - Supabase Discord 커뮤니티
   - Supabase GitHub Issues

