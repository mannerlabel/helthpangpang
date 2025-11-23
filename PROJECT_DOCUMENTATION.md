# Health Pang Pang - 프로젝트 문서

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [데이터베이스 설정](#데이터베이스-설정)
3. [기능 가이드](#기능-가이드)
4. [문제 해결](#문제-해결)

---

## 프로젝트 개요

Health Pang Pang은 운동 추적 및 크루 운동을 위한 웹 애플리케이션입니다.

### 주요 기능
- **싱글 모드**: 개인 운동 추적
- **크루 모드**: 그룹 운동 및 실시간 채팅
- **조깅 모드**: 혼자 또는 함께 조깅 추적
- **AI 분석**: 운동 자세 분석 및 피드백

---

## 데이터베이스 설정

### Supabase 초기 설정

1. **Supabase 프로젝트 생성**
   - [Supabase](https://supabase.com)에서 새 프로젝트 생성
   - 프로젝트 URL과 anon key 확인

2. **데이터베이스 스키마 설정**
   - `DATABASE_SETUP.sql` 파일을 Supabase SQL Editor에서 실행
   - 모든 테이블, 인덱스, RLS 정책이 자동으로 생성됩니다

3. **환경 변수 설정**
   - `.env` 파일에 Supabase URL과 anon key 설정:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

### 테스트 사용자

기본 테스트 사용자 (비밀번호: 123456):
- `bap@healthpangpang.com` - 밥
- `banchan@healthpangpang.com` - 반찬
- `meng@healthpangpang.com` - 맹

---

## 기능 가이드

### 크루 모드
1. 크루 생성 또는 검색
2. 크루 입장
3. 운동 시작
4. 실시간 채팅 및 영상 공유
5. 운동 완료 후 결과 확인

### 조깅 모드
1. 혼자 또는 함께 모드 선택
2. 조깅 목표 설정
3. 조깅 시작 및 경로 추적
4. 완료 후 결과 확인

### 추천 기능
- 크루/조깅 크루 목록에서 별(⭐) 버튼으로 추천
- 운동 실행 중에도 추천 가능
- 한 계정당 크루당 1회만 추천 가능
- 추천 취소 후 재추천 가능

---

## 문제 해결

### 데이터베이스 연결 오류
- Supabase URL과 anon key 확인
- RLS 정책이 올바르게 설정되었는지 확인
- `DATABASE_SETUP.sql` 재실행

### 추천 기능 오류
- `FIX_RLS_POLICIES.sql` 섹션이 `DATABASE_SETUP.sql`에 포함되어 있는지 확인
- 추천 관련 테이블이 생성되었는지 확인

### 채팅 기능 오류
- `chat_messages` 테이블에 `jogging_crew_id` 컬럼이 있는지 확인
- RLS 정책이 올바르게 설정되었는지 확인

### 세션 저장 오류
- `exercise_sessions` 테이블의 `analysis` 컬럼 존재 확인
- 사용자 ID가 올바르게 매핑되었는지 확인

---

## 추가 리소스

### SQL 스크립트
- `DATABASE_SETUP.sql`: 전체 데이터베이스 설정 (모든 SQL 통합)

### 데이터 확인 쿼리
`DATABASE_SETUP.sql` 파일 하단의 유틸리티 쿼리 섹션 참조

---

## 버전 정보
- 현재 버전: v1.00.02
- 최종 업데이트: 2024년

---

## 문의 및 지원
프로젝트 관련 문의사항이 있으시면 개발팀에 연락해주세요.

