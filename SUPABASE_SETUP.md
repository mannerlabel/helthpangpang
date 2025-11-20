# Supabase 설정 가이드

## 1. .env 파일 생성

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```
VITE_SUPABASE_URL=https://irmaleosbdhykjacaegw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlybWFsZW9zYmRoeWtqYWNhZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODk1NjcsImV4cCI6MjA3OTE2NTU2N30.O2K9Imz7Q77Q7bugaOQBm4Esmg9Af3YEVZayJDmPzZs
```

## 2. Supabase 테이블 생성

Supabase 대시보드의 SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- Users 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Crews 테이블
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_members INTEGER,
  current_members INTEGER DEFAULT 0,
  exercise_type TEXT NOT NULL,
  exercise_config JSONB NOT NULL,
  alarm JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  member_ids UUID[] DEFAULT '{}',
  video_share_enabled BOOLEAN DEFAULT false,
  audio_share_enabled BOOLEAN DEFAULT false,
  recommendations INTEGER DEFAULT 0
);

-- Crew Members 테이블
CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  video_enabled BOOLEAN DEFAULT false,
  audio_enabled BOOLEAN DEFAULT false,
  UNIQUE(crew_id, user_id)
);

-- Jogging Crews 테이블
CREATE TABLE IF NOT EXISTS jogging_crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_members INTEGER,
  current_members INTEGER DEFAULT 0,
  target_distance NUMERIC,
  target_time INTEGER,
  alarm JSONB,
  video_share_enabled BOOLEAN DEFAULT false,
  audio_share_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  member_ids UUID[] DEFAULT '{}'
);

-- Chat Messages 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('text', 'system'))
);

-- Exercise Sessions 테이블
CREATE TABLE IF NOT EXISTS exercise_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'crew')),
  config JSONB NOT NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  counts JSONB DEFAULT '[]',
  best_score JSONB,
  worst_score JSONB,
  average_score NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false
);

-- Jogging Sessions 테이블
CREATE TABLE IF NOT EXISTS jogging_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  crew_id UUID REFERENCES jogging_crews(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('alone', 'together')),
  distance NUMERIC DEFAULT 0,
  average_speed NUMERIC DEFAULT 0,
  average_time INTEGER DEFAULT 0,
  route JSONB DEFAULT '[]',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  score NUMERIC
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_crews_created_by ON crews(created_by);
CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id ON crew_members(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_crew_id ON chat_messages(crew_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_user_id ON exercise_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_crew_id ON exercise_sessions(crew_id);

-- Row Level Security (RLS) 정책 설정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogging_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogging_sessions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 정책 설정 (개발용)
CREATE POLICY "Enable all operations for all users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for all users" ON crews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for all users" ON crew_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for all users" ON jogging_crews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for all users" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for all users" ON exercise_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for all users" ON jogging_sessions FOR ALL USING (true) WITH CHECK (true);
```

## 3. 실시간 구독 설정

Supabase의 Realtime 기능을 사용하려면 테이블에 Realtime을 활성화해야 합니다:

1. Supabase 대시보드 → Database → Replication
2. 다음 테이블들에 대해 Realtime 활성화:
   - `crews`
   - `crew_members`
   - `chat_messages`

## 4. 주의사항

- 프로덕션 환경에서는 RLS 정책을 더 엄격하게 설정해야 합니다.
- 현재 설정은 개발용으로 모든 사용자가 모든 데이터에 접근할 수 있습니다.

