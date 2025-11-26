# Supabase Realtime Policies 설정 가이드

## 중요: Broadcast 채널은 정책이 필요하지 않을 수 있습니다

Supabase Realtime의 **Broadcast 채널**은 "Allow public access"가 활성화되어 있으면 **별도 정책 설정 없이** 사용할 수 있습니다.

현재 설정 확인:
- ✅ "Enable Realtime service": ON
- ✅ "Allow public access": ON

이 설정이 활성화되어 있으면, 채널 구독이 실패하는 원인은 다른 곳에 있을 수 있습니다.

## 해결 방법

### 방법 1: Realtime Settings 확인 (우선 확인)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **Realtime → Settings 이동**
   - 왼쪽 사이드바에서 "Realtime" 클릭
   - "Settings" 탭 선택

3. **설정 확인**
   - ✅ "Enable Realtime service": ON인지 확인
   - ✅ "Allow public access": ON인지 확인
   - ✅ Max events per second: 100 (또는 적절한 값)
   - ✅ Max presence events per second: 100 (또는 적절한 값)

### 방법 2: Realtime Policies 설정 (필요한 경우만)

**주의**: Broadcast 채널은 일반적으로 정책이 필요하지 않습니다. 하지만 특정 패턴의 채널에 대해 제한이 필요한 경우에만 설정하세요.

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **Realtime → Policies 이동**
   - 왼쪽 사이드바에서 "Realtime" 클릭
   - "Policies" 탭 선택

3. **정책 생성 (필요한 경우만)**
   - "Create policy" 버튼 클릭
   - 다음 설정 입력:
     - **Policy Name**: `Allow public access to signaling channels`
     - **Channel Pattern**: `crew_*_signaling`
     - **Access**: `PUBLIC` (또는 `AUTHENTICATED` - 인증된 사용자만)
     - **Operation**: `ALL` (또는 필요한 작업만 선택)

### 방법 3: 채널 구독 실패 원인 확인

정책이 문제가 아닐 수 있습니다. 다음을 확인하세요:

1. **환경 변수 확인**
   ```javascript
   // 브라우저 콘솔에서 확인
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '설정됨' : '없음')
   ```

2. **Realtime 연결 상태 확인**
   - 브라우저 콘솔에서 다음 로그 확인:
     - `🔍 Supabase Realtime 연결 상태: 연결됨` 또는 `연결 중`
     - `📡 채널 구독 상태 변화: ... - SUBSCRIBED`

3. **채널 이름 확인**
   - 채널 이름이 올바른 형식인지 확인:
     - 형식: `crew_{crewId}_signaling`
     - 예: `crew_98018821-f6a9-4dd7-89a0-1b7ed7b74e5e_signaling`
   - 채널 이름 길이가 200자를 초과하지 않는지 확인

4. **네트워크 연결 확인**
   - 브라우저 개발자 도구 → Network 탭에서 WebSocket 연결 확인
   - `wss://` 프로토콜로 연결되는지 확인

### 방법 3: Supabase CLI 사용 (선택사항)

```bash
# Supabase CLI 설치 후
supabase db push

# 또는 직접 SQL 실행
supabase db execute --file realtime_policies.sql
```

## 채널 이름 형식

현재 코드에서 사용하는 채널 이름 형식:
- `crew_{crewId}_signaling`
- 예: `crew_98018821-f6a9-4dd7-89a0-1b7ed7b74e5e_signaling`

정책에서 와일드카드 패턴 사용:
- `crew_*_signaling` - 모든 크루의 signaling 채널 허용

## 보안 고려사항

1. **Public vs Authenticated**
   - `PUBLIC`: 모든 사용자가 접근 가능 (개발 환경용)
   - `AUTHENTICATED`: 로그인한 사용자만 접근 가능 (프로덕션 권장)

2. **채널 이름 검증**
   - 현재 코드에서 `crewId`를 sanitize하여 안전한 채널 이름 생성
   - SQL injection 방지를 위해 채널 이름은 항상 검증 필요

3. **Rate Limiting**
   - Supabase Realtime Settings에서 설정한 제한 확인:
     - Max events per second: 100
     - Max presence events per second: 100

## 확인 방법

정책이 제대로 설정되었는지 확인:

1. **Supabase 대시보드**
   - Realtime → Policies에서 정책 목록 확인
   - `crew_*_signaling` 패턴이 보이는지 확인

2. **브라우저 콘솔**
   - 채널 구독 시도 후 다음 로그 확인:
     - `✅ Subscribed to channel: crew_..._signaling`
     - `이제부터 실시간 데이터 수신 및 송신이 가능합니다.`

3. **에러 로그**
   - 정책이 없으면 다음과 같은 에러가 발생할 수 있음:
     - `Channel closed during subscription`
     - `Failed to subscribe to channel`
     - `채널 구독 상태 확인: ... - 채널 없음`

## 추가 리소스

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime Policies](https://supabase.com/docs/guides/realtime/security)
- [Supabase Channel Patterns](https://supabase.com/docs/guides/realtime/channels)

