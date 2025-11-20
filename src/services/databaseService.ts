/**
 * 데이터베이스 서비스
 * Supabase 사용 (환경 변수 설정 시) 또는 localStorage 폴백
 */

import { supabase } from './supabaseClient'

// Supabase 사용 여부 확인
const USE_SUPABASE = !!(import.meta as any).env?.VITE_SUPABASE_URL && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY && supabase !== null

// 디버깅용 로그
if (USE_SUPABASE) {
  console.log('✅ Supabase 사용 중:', (import.meta as any).env?.VITE_SUPABASE_URL)
} else {
  console.log('⚠️ Supabase 미사용, localStorage 사용 중')
}

// 데이터베이스 테이블 타입 정의
export interface User {
  id: string
  email: string
  password: string // 실제로는 해시된 비밀번호
  name: string
  avatar?: string
  createdAt: number
  lastLoginAt?: number
}

export interface Crew {
  id: string
  name: string
  maxMembers: number | null
  currentMembers: number
  exerciseType: string
  exerciseConfig: {
    type: string
    sets: number
    reps: number
    restTime: number
  }
  alarm?: {
    enabled: boolean
    time: string
    repeatType: 'daily' | 'weekly' | 'custom'
    repeatDays?: number[]
  }
  createdAt: number
  createdBy: string
  memberIds: string[]
  videoShareEnabled: boolean // 영상 공유 활성화 여부
  audioShareEnabled: boolean // 음성 공유 활성화 여부
  recommendations: number // 추천수
}

export interface CrewMember {
  id: string
  crewId: string
  userId: string
  joinedAt: number
  role: 'owner' | 'member'
  videoEnabled: boolean // 개인 영상 공유 상태
  audioEnabled: boolean // 개인 음성 공유 상태
}

export interface JoggingCrew {
  id: string
  name: string
  maxMembers: number | null
  currentMembers: number
  targetDistance?: number // km
  targetTime?: number // 분
  alarm?: {
    enabled: boolean
    time: string
    repeatType: 'daily' | 'weekly' | 'custom'
    repeatDays?: number[]
  }
  videoShareEnabled: boolean
  audioShareEnabled: boolean
  createdAt: number
  createdBy: string
  memberIds: string[]
}

export interface ChatMessage {
  id: string
  crewId: string
  userId: string
  userName: string
  message: string
  timestamp: number
  type: 'text' | 'system'
}

export interface JoggingSession {
  id: string
  userId: string
  crewId?: string // 함께 조깅 모드일 경우
  mode: 'alone' | 'together'
  distance: number
  averageSpeed: number
  averageTime: number
  route: Array<{ lat: number; lng: number; timestamp: number }>
  startTime: number
  endTime?: number
  completed: boolean
  score?: number // AI 분석 점수
}

export interface ExerciseSession {
  id: string
  userId: string
  crewId?: string
  mode: 'single' | 'crew'
  config: {
    type: string
    sets: number
    reps: number
    restTime: number
  }
  startTime: number
  endTime?: number
  counts: Array<{
    count: number
    timestamp: number
    poseScore: number
    image?: string
    setNumber: number
  }>
  bestScore?: {
    score: number
    image: string
    timestamp: number
  }
  worstScore?: {
    score: number
    image: string
    timestamp: number
  }
  averageScore: number
  completed: boolean
}

class DatabaseService {
  private initialized = false

  // 데이터베이스 초기화
  async initialize(): Promise<void> {
    if (this.initialized) {
      // 이미 초기화되었어도 테스트 사용자는 확인
      await this.ensureTestUsers()
      return
    }

    // localStorage에 데이터베이스가 없으면 초기화
    if (!localStorage.getItem('db_initialized')) {
      this.initDatabase()
      localStorage.setItem('db_initialized', 'true')
    }

    // 테스트 사용자 확인 및 생성
    await this.ensureTestUsers()

    // 테스트 크루 확인 및 생성
    await this.ensureTestCrews()

    this.initialized = true
  }

  // 데이터베이스 초기화 (빈 데이터)
  private initDatabase(): void {
    const tables = {
      users: [],
      crews: [],
      crew_members: [],
      jogging_crews: [],
      jogging_sessions: [],
      exercise_sessions: [],
      chats: [],
    }

    Object.entries(tables).forEach(([key, value]) => {
      localStorage.setItem(`db_${key}`, JSON.stringify(value))
    })
  }

  // 초기 테스트 사용자 확인 및 생성
  private async ensureTestUsers(): Promise<void> {
    const testUsers = [
      { email: 'bap@healthpangpang.com', password: '123456', name: '밥' },
      { email: 'banchan@healthpangpang.com', password: '123456', name: '반찬' },
      { email: 'meng@healthpangpang.com', password: '123456', name: '맹' },
    ]

    // initialize()가 완료된 후에만 실행되므로 직접 테이블에 접근
    const users = this.readTable<User>('users')

    for (const user of testUsers) {
      // 이미 존재하는지 확인
      const existing = users.find((u) => u.email === user.email)
      if (!existing) {
        // createUser를 호출하지 않고 직접 추가 (순환 호출 방지)
        const newUser: User = {
          email: user.email,
          password: btoa(user.password), // base64 인코딩 (authService의 hashPassword와 동일)
          name: user.name,
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
        }
        users.push(newUser)
      }
    }

    // 변경사항 저장
    if (users.length > 0) {
      this.writeTable('users', users)
    }
  }

  // 초기 테스트 크루 확인 및 생성
  private async ensureTestCrews(): Promise<void> {
    const users = this.readTable<User>('users')
    const crews = this.readTable<Crew>('crews')

    // 테스트 사용자 찾기
    const bap = users.find((u) => u.email === 'bap@healthpangpang.com')
    const banchan = users.find((u) => u.email === 'banchan@healthpangpang.com')
    const meng = users.find((u) => u.email === 'meng@healthpangpang.com')

    if (!bap || !banchan || !meng) {
      // 사용자가 아직 생성되지 않았으면 크루 생성 건너뛰기
      return
    }

    // 밥의 크루 3개
    const bapCrews: Array<Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
      {
        name: '아침 스쿼트 크루',
        maxMembers: 20,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 3, reps: 10, restTime: 10 },
        alarm: { enabled: true, time: '06:00', repeatType: 'daily' },
        createdBy: bap.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
      {
        name: '저녁 푸시업 크루',
        maxMembers: null,
        exerciseType: 'pushup',
        exerciseConfig: { type: 'pushup', sets: 4, reps: 15, restTime: 15 },
        alarm: { enabled: true, time: '19:00', repeatType: 'daily' },
        createdBy: bap.id,
        videoShareEnabled: false,
        audioShareEnabled: true,
      },
      {
        name: '주말 런지 크루',
        maxMembers: 15,
        exerciseType: 'lunge',
        exerciseConfig: { type: 'lunge', sets: 3, reps: 12, restTime: 10 },
        alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
        createdBy: bap.id,
        videoShareEnabled: true,
        audioShareEnabled: false,
      },
    ]

    // 반찬의 크루 3개
    const banchanCrews: Array<Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
      {
        name: '올데이 스쿼트',
        maxMembers: 30,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 5, reps: 20, restTime: 20 },
        alarm: { enabled: true, time: '08:00', repeatType: 'daily' },
        createdBy: banchan.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
      {
        name: '푸시업 챌린지',
        maxMembers: null,
        exerciseType: 'pushup',
        exerciseConfig: { type: 'pushup', sets: 3, reps: 25, restTime: 10 },
        alarm: { enabled: true, time: '07:30', repeatType: 'daily' },
        createdBy: banchan.id,
        videoShareEnabled: false,
        audioShareEnabled: false,
      },
      {
        name: '점심 운동 크루',
        maxMembers: 10,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 2, reps: 15, restTime: 5 },
        alarm: { enabled: true, time: '12:00', repeatType: 'daily' },
        createdBy: banchan.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
    ]

    // 맹의 크루 3개
    const mengCrews: Array<Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
      {
        name: '저녁 런지 크루',
        maxMembers: 25,
        exerciseType: 'lunge',
        exerciseConfig: { type: 'lunge', sets: 4, reps: 10, restTime: 15 },
        alarm: { enabled: true, time: '20:00', repeatType: 'daily' },
        createdBy: meng.id,
        videoShareEnabled: true,
        audioShareEnabled: false,
      },
      {
        name: '주중 운동 크루',
        maxMembers: null,
        exerciseType: 'pushup',
        exerciseConfig: { type: 'pushup', sets: 3, reps: 20, restTime: 12 },
        alarm: { enabled: true, time: '18:30', repeatType: 'custom' },
        createdBy: meng.id,
        videoShareEnabled: false,
        audioShareEnabled: true,
      },
      {
        name: '초보자 크루',
        maxMembers: 15,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 2, reps: 8, restTime: 20 },
        alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
        createdBy: meng.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
    ]

    // 모든 크루 생성
    const allCrews = [...bapCrews, ...banchanCrews, ...mengCrews]
    const existingCrewNames = new Set(crews.map((c) => c.name))

    for (const crewData of allCrews) {
      // 이미 존재하는 크루는 건너뛰기
      if (existingCrewNames.has(crewData.name)) {
        continue
      }

      // createCrew를 호출하지 않고 직접 추가 (순환 호출 방지)
      const newCrew: Crew = {
        ...crewData,
        id: `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now() - Math.random() * 86400000 * 30, // 최근 30일 내 랜덤 시간
        currentMembers: 1,
        memberIds: [crewData.createdBy],
        recommendations: Math.floor(Math.random() * 50), // 0-49 랜덤 추천수
      }
      crews.push(newCrew)

      // 크루 멤버도 추가 (크루장)
      const members = this.readTable<CrewMember>('crew_members')
      const newMember: CrewMember = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        crewId: newCrew.id,
        userId: crewData.createdBy,
        joinedAt: newCrew.createdAt,
        role: 'owner',
        videoEnabled: false,
        audioEnabled: false,
      }
      members.push(newMember)
      this.writeTable('crew_members', members)
    }

    // 변경사항 저장
    if (crews.length > 0) {
      this.writeTable('crews', crews)
    }
  }


  // 테이블 읽기
  private readTable<T>(tableName: string): T[] {
    try {
      const data = localStorage.getItem(`db_${tableName}`)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error(`Error reading table ${tableName}:`, error)
      return []
    }
  }

  // 테이블 쓰기
  private writeTable<T>(tableName: string, data: T[]): void {
    try {
      localStorage.setItem(`db_${tableName}`, JSON.stringify(data))
    } catch (error) {
      console.error(`Error writing table ${tableName}:`, error)
      throw error
    }
  }

  // ============ User 관련 ============
  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    // initialize()는 외부에서 호출되므로 여기서는 호출하지 않음 (순환 호출 방지)
    if (!this.initialized) {
      await this.initialize()
    }
    const users = this.readTable<User>('users')
    const newUser: User = {
      ...user,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    }
    users.push(newUser)
    this.writeTable('users', users)
    return newUser
  }

  async getUserById(id: string): Promise<User | null> {
    await this.initialize()
    
    // UUID 형식인지 확인
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    if (USE_SUPABASE && supabase && uuidRegex.test(id)) {
      // Supabase에서 UUID로 사용자 찾기
      try {
        const { data: supabaseUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error || !supabaseUser) {
          console.error('Supabase getUserById 실패:', error)
          // localStorage에서도 찾아보기
          const users = this.readTable<User>('users')
          return users.find((u) => u.id === id) || null
        }
        
        // Supabase 사용자를 User 형식으로 변환
        return this.mapSupabaseUser(supabaseUser)
      } catch (e) {
        console.error('getUserById Supabase 오류:', e)
        // localStorage에서도 찾아보기
        const users = this.readTable<User>('users')
        return users.find((u) => u.id === id) || null
      }
    }
    
    // localStorage에서 찾기
    const users = this.readTable<User>('users')
    return users.find((u) => u.id === id) || null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.initialize()
    const users = this.readTable<User>('users')
    return users.find((u) => u.email === email) || null
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await this.initialize()
    const users = this.readTable<User>('users')
    const index = users.findIndex((u) => u.id === id)
    if (index === -1) return null
    users[index] = { ...users[index], ...updates }
    this.writeTable('users', users)
    return users[index]
  }

  // ============ Crew 관련 ============
  async createCrew(crew: Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>): Promise<Crew> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    const newCrew: Crew = {
      ...crew,
      id: `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      currentMembers: 1,
      memberIds: [crew.createdBy],
      recommendations: 0,
    }
    crews.push(newCrew)
    this.writeTable('crews', crews)

    // 크루 멤버 추가
    await this.addCrewMember(newCrew.id, crew.createdBy, 'owner')

    return newCrew
  }

  async getCrewById(id: string): Promise<Crew | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      const { data: crew, error } = await supabase
        .from('crews')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('크루 조회 에러:', error)
        if (error.code === 'PGRST116') {
          // 결과가 없음
          return null
        }
        throw error
      }

      if (!crew) return null

      // 실시간으로 멤버 수 계산
      const { data: members } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', id)

      const actualMemberCount = members?.length || 0
      const actualMemberIds = members?.map(m => m.user_id) || []

      // 멤버 수가 다르면 업데이트
      if (crew.current_members !== actualMemberCount || 
          JSON.stringify((crew.member_ids || []).sort()) !== JSON.stringify(actualMemberIds.sort())) {
        try {
          await supabase
            .from('crews')
            .update({
              current_members: actualMemberCount,
              member_ids: actualMemberIds.length > 0 ? actualMemberIds : [],
            })
            .eq('id', id)
        } catch (updateError: any) {
          console.warn('크루 멤버 수 업데이트 실패:', updateError)
          // current_members만 업데이트 시도
          try {
            await supabase
              .from('crews')
              .update({
                current_members: actualMemberCount,
              })
              .eq('id', id)
          } catch (e) {
            console.warn('current_members 업데이트도 실패:', e)
          }
        }
      }

      return this.mapSupabaseCrew({
        ...crew,
        current_members: actualMemberCount,
        member_ids: actualMemberIds,
      })
    } else {
    const crews = this.readTable<Crew>('crews')
      const crew = crews.find((c) => c.id === id)
      if (!crew) return null
      
      // 실시간으로 멤버 수 계산하여 반환
      const members = this.readTable<CrewMember>('crew_members')
      const crewMembers = members.filter((m) => m.crewId === id)
      const actualMemberCount = crewMembers.length
      const actualMemberIds = crewMembers.map((m) => m.userId)
      
      // 실제 멤버 수와 저장된 멤버 수가 다르면 업데이트
      if (crew.currentMembers !== actualMemberCount || 
          JSON.stringify(crew.memberIds.sort()) !== JSON.stringify(actualMemberIds.sort())) {
        await this.updateCrew(id, {
          currentMembers: actualMemberCount,
          memberIds: actualMemberIds,
        })
        return { ...crew, currentMembers: actualMemberCount, memberIds: actualMemberIds }
      }
      
      return crew
    }
  }

  async getCrewsByUserId(userId: string): Promise<Crew[]> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      console.log('getCrewsByUserId - userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        // localStorage 사용자 정보에서 email 가져오기
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            // Supabase에서 email로 사용자 찾기
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError) {
              console.warn('Supabase 사용자를 찾을 수 없음:', userError)
              return [] // Supabase에 사용자가 없으면 빈 배열 반환
            }
            
            if (supabaseUser) {
              supabaseUserId = supabaseUser.id
              console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
            } else {
              return [] // Supabase에 사용자가 없으면 빈 배열 반환
            }
          }
        }
      }
      
      // 사용자가 멤버인 크루 조회
      const { data: memberRecords, error } = await supabase
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', supabaseUserId)

      if (error) {
        console.error('crew_members 조회 에러:', error)
        throw error
      }
      
      console.log('멤버 레코드:', memberRecords)
      if (!memberRecords || memberRecords.length === 0) return []

      const crewIds = memberRecords.map(m => m.crew_id)
      console.log('크루 ID 목록:', crewIds)
      
      const { data: crews, error: crewsError } = await supabase
        .from('crews')
        .select('*')
        .in('id', crewIds)

      if (crewsError) {
        console.error('crews 조회 에러:', crewsError)
        throw crewsError
      }
      
      console.log('조회된 크루:', crews)

      // 각 크루의 실시간 멤버 수 계산
      if (!supabase) throw new Error('Supabase client not initialized')
      const supabaseClient = supabase // 지역 변수로 할당하여 null 체크 우회
      
      const crewsWithMembers = await Promise.all(
        (crews || []).map(async (crew) => {
          const { data: members } = await supabaseClient
            .from('crew_members')
            .select('user_id')
            .eq('crew_id', crew.id)

          const actualMemberCount = members?.length || 0
          const actualMemberIds = members?.map(m => m.user_id) || []

          // member_ids 업데이트는 선택적으로 (에러 발생 시 무시)
          if (crew.current_members !== actualMemberCount || 
              JSON.stringify((crew.member_ids || []).sort()) !== JSON.stringify(actualMemberIds.sort())) {
            try {
              await supabaseClient
                .from('crews')
                .update({
                  current_members: actualMemberCount,
                  member_ids: actualMemberIds.length > 0 ? actualMemberIds : [],
                })
                .eq('id', crew.id)
            } catch (updateError: any) {
              // member_ids 업데이트 실패는 무시하고 current_members만 업데이트 시도
              console.warn('member_ids 업데이트 실패, current_members만 업데이트:', updateError)
              try {
                await supabaseClient
                  .from('crews')
                  .update({
                    current_members: actualMemberCount,
                  })
                  .eq('id', crew.id)
              } catch (e) {
                console.warn('current_members 업데이트도 실패:', e)
              }
            }
          }

          return this.mapSupabaseCrew({
            ...crew,
            current_members: actualMemberCount,
            member_ids: actualMemberIds,
          })
        })
      )

      return crewsWithMembers
    } else {
    const crews = this.readTable<Crew>('crews')
      const members = this.readTable<CrewMember>('crew_members')
      
      // 실시간으로 멤버 수 계산하여 반환
      return crews
        .filter((c) => c.memberIds.includes(userId))
        .map((crew) => {
          const crewMembers = members.filter((m) => m.crewId === crew.id)
          const actualMemberCount = crewMembers.length
          const actualMemberIds = crewMembers.map((m) => m.userId)
          
          // 실제 멤버 수와 저장된 멤버 수가 다르면 업데이트
          if (crew.currentMembers !== actualMemberCount || 
              JSON.stringify(crew.memberIds.sort()) !== JSON.stringify(actualMemberIds.sort())) {
            this.updateCrew(crew.id, {
              currentMembers: actualMemberCount,
              memberIds: actualMemberIds,
            })
            return { ...crew, currentMembers: actualMemberCount, memberIds: actualMemberIds }
          }
          return crew
        })
    }
  }

  async getAllCrews(): Promise<Crew[]> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      console.log('Supabase에서 크루 목록 가져오기 시작')
      const { data: crews, error } = await supabase
        .from('crews')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase 크루 조회 에러:', error)
        console.error('에러 상세:', error.message, error.code, error.details, error.hint)
        throw error
      }
      
      console.log('Supabase에서 가져온 크루 수:', crews?.length || 0)
      if (crews && crews.length > 0) {
        console.log('첫 번째 크루 샘플:', crews[0])
      }

      // 각 크루의 실시간 멤버 수 계산
      if (!supabase) throw new Error('Supabase client not initialized')
      const supabaseClient = supabase // 지역 변수로 할당하여 null 체크 우회
      
      const crewsWithMembers = await Promise.all(
        (crews || []).map(async (crew) => {
          const { data: members } = await supabaseClient
            .from('crew_members')
            .select('user_id')
            .eq('crew_id', crew.id)

          const actualMemberCount = members?.length || 0
          const actualMemberIds = members?.map(m => m.user_id) || []

          // member_ids 업데이트는 선택적으로 (에러 발생 시 무시)
          if (crew.current_members !== actualMemberCount || 
              JSON.stringify((crew.member_ids || []).sort()) !== JSON.stringify(actualMemberIds.sort())) {
            try {
              await supabaseClient
                .from('crews')
                .update({
                  current_members: actualMemberCount,
                  member_ids: actualMemberIds.length > 0 ? actualMemberIds : [],
                })
                .eq('id', crew.id)
            } catch (updateError: any) {
              // member_ids 업데이트 실패는 무시하고 current_members만 업데이트 시도
              console.warn('member_ids 업데이트 실패, current_members만 업데이트:', updateError)
              try {
                await supabaseClient
                  .from('crews')
                  .update({
                    current_members: actualMemberCount,
                  })
                  .eq('id', crew.id)
              } catch (e) {
                console.warn('current_members 업데이트도 실패:', e)
              }
            }
          }

          return this.mapSupabaseCrew({
            ...crew,
            current_members: actualMemberCount,
            member_ids: actualMemberIds,
          })
        })
      )

      return crewsWithMembers
    } else {
      const crews = this.readTable<Crew>('crews')
      const members = this.readTable<CrewMember>('crew_members')
      
      // 실시간으로 멤버 수 계산하여 반환
      return crews.map((crew) => {
        const crewMembers = members.filter((m) => m.crewId === crew.id)
        const actualMemberCount = crewMembers.length
        const actualMemberIds = crewMembers.map((m) => m.userId)
        
        // 실제 멤버 수와 저장된 멤버 수가 다르면 업데이트
        if (crew.currentMembers !== actualMemberCount || 
            JSON.stringify(crew.memberIds.sort()) !== JSON.stringify(actualMemberIds.sort())) {
          this.updateCrew(crew.id, {
            currentMembers: actualMemberCount,
            memberIds: actualMemberIds,
          })
          return { ...crew, currentMembers: actualMemberCount, memberIds: actualMemberIds }
        }
        return crew
      })
    }
  }

  async updateCrew(id: string, updates: Partial<Crew>): Promise<Crew | null> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    const index = crews.findIndex((c) => c.id === id)
    if (index === -1) return null
    crews[index] = { ...crews[index], ...updates }
    this.writeTable('crews', crews)
    return crews[index]
  }

  async deleteCrew(id: string): Promise<boolean> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    const filtered = crews.filter((c) => c.id !== id)
    this.writeTable('crews', filtered)
    return filtered.length < crews.length
  }

  async incrementCrewRecommendations(crewId: string): Promise<number> {
    await this.initialize()
    const crew = await this.getCrewById(crewId)
    if (!crew) return 0
    const updated = await this.updateCrew(crewId, { recommendations: crew.recommendations + 1 })
    return updated?.recommendations || 0
  }

  // ============ CrewMember 관련 ============
  async addCrewMember(crewId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<CrewMember> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      // Supabase 사용
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('addCrewMember - crewId:', crewId, 'userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError || !supabaseUser) {
              throw new Error('Supabase에 사용자가 등록되어 있지 않습니다. 먼저 로그인해주세요.')
            }
            
            supabaseUserId = supabaseUser.id
            console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
          }
        }
      }
      
      // 이미 멤버인지 확인
      const { data: existingMembers, error: checkError } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)

      if (checkError) {
        console.error('멤버 확인 에러:', checkError)
        // 에러가 있어도 계속 진행 (중복 체크는 선택사항)
      }

      if (existingMembers && existingMembers.length > 0) {
        return this.mapSupabaseCrewMember(existingMembers[0])
      }

      // 크루 존재 확인 및 멤버 제한 확인
      const crew = await this.getCrewById(crewId)
      if (!crew) {
        throw new Error('크루를 찾을 수 없습니다.')
      }
      if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
        throw new Error('크루 인원이 가득 찼습니다.')
      }

      // 멤버 추가
      const { data: newMember, error } = await supabase
        .from('crew_members')
        .insert({
          crew_id: crewId,
          user_id: supabaseUserId,
          role,
          video_enabled: false,
          audio_enabled: false,
        })
        .select()
        .single()

      if (error) {
        console.error('crew_members 삽입 에러:', error)
        throw error
      }

      // 크루의 멤버 수 업데이트
      const { data: allMembers } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId)

      if (allMembers) {
        try {
          await supabase
            .from('crews')
            .update({
              current_members: allMembers.length,
              member_ids: allMembers.map(m => m.user_id),
            })
            .eq('id', crewId)
        } catch (updateError: any) {
          console.warn('크루 멤버 수 업데이트 실패:', updateError)
          // current_members만 업데이트 시도
          try {
            await supabase
              .from('crews')
              .update({
                current_members: allMembers.length,
              })
              .eq('id', crewId)
          } catch (e) {
            console.warn('current_members 업데이트도 실패:', e)
          }
        }
      }

      return this.mapSupabaseCrewMember(newMember)
    } else {
      // localStorage 사용
      // 이미 멤버인지 확인
    const members = this.readTable<CrewMember>('crew_members')
      const existingMember = members.find((m) => m.crewId === crewId && m.userId === userId)
      if (existingMember) {
        // 이미 멤버인 경우 기존 멤버 정보 반환
        return existingMember
      }

      // 크루 존재 확인 및 멤버 제한 확인
      const crew = await this.getCrewById(crewId)
      if (!crew) {
        throw new Error('크루를 찾을 수 없습니다.')
      }
      if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
        throw new Error('크루 인원이 가득 찼습니다.')
      }

    const newMember: CrewMember = {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      crewId,
      userId,
      joinedAt: Date.now(),
      role,
      videoEnabled: false,
      audioEnabled: false,
    }
    members.push(newMember)
    this.writeTable('crew_members', members)

      // 크루의 멤버 수를 실시간으로 계산하여 업데이트
      const allCrewMembers = this.readTable<CrewMember>('crew_members')
      const crewMembers = allCrewMembers.filter((m) => m.crewId === crewId)
      const actualMemberCount = crewMembers.length
      const actualMemberIds = crewMembers.map((m) => m.userId)
      
      await this.updateCrew(crewId, {
        currentMembers: actualMemberCount,
        memberIds: actualMemberIds,
      })

    return newMember
    }
  }

  async removeCrewMember(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('removeCrewMember - crewId:', crewId, 'userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError || !supabaseUser) {
              console.warn('Supabase 사용자를 찾을 수 없음:', userError)
              // Supabase에 사용자가 없으면 localStorage로 폴백
    const members = this.readTable<CrewMember>('crew_members')
    const filtered = members.filter((m) => !(m.crewId === crewId && m.userId === userId))
    this.writeTable('crew_members', filtered)
              return filtered.length < members.length
            }
            
            supabaseUserId = supabaseUser.id
            console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
          }
        }
      }
      
      // 멤버 삭제
      const { error } = await supabase
        .from('crew_members')
        .delete()
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)

      if (error) {
        console.error('crew_members 삭제 에러:', error)
        throw error
      }

    // 크루의 멤버 수 업데이트
      const { data: allMembers } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId)

      if (allMembers) {
        try {
          await supabase
            .from('crews')
            .update({
              current_members: allMembers.length,
              member_ids: allMembers.map(m => m.user_id),
            })
            .eq('id', crewId)
        } catch (updateError: any) {
          console.warn('크루 멤버 수 업데이트 실패:', updateError)
          // current_members만 업데이트 시도
          try {
            await supabase
              .from('crews')
              .update({
                current_members: allMembers.length,
              })
              .eq('id', crewId)
          } catch (e) {
            console.warn('current_members 업데이트도 실패:', e)
          }
        }
      }

      return true
    } else {
      const members = this.readTable<CrewMember>('crew_members')
      const filtered = members.filter((m) => !(m.crewId === crewId && m.userId === userId))
      this.writeTable('crew_members', filtered)

      // 크루의 멤버 수를 실시간으로 계산하여 업데이트
      const crewMembers = filtered.filter((m) => m.crewId === crewId)
      const actualMemberCount = crewMembers.length
      const actualMemberIds = crewMembers.map((m) => m.userId)
      
      await this.updateCrew(crewId, {
        currentMembers: actualMemberCount,
        memberIds: actualMemberIds,
      })

    return filtered.length < members.length
    }
  }

  async getCrewMembers(crewId: string): Promise<CrewMember[]> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      const { data, error } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId)
      
      if (error) {
        console.error('crew_members 조회 에러:', error)
        throw error
      }
      return (data || []).map(m => this.mapSupabaseCrewMember(m))
    } else {
    const members = this.readTable<CrewMember>('crew_members')
    return members.filter((m) => m.crewId === crewId)
    }
  }

  async updateCrewMember(crewId: string, userId: string, updates: Partial<CrewMember>): Promise<CrewMember | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('updateCrewMember - crewId:', crewId, 'userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError || !supabaseUser) {
              console.warn('Supabase 사용자를 찾을 수 없음:', userError)
              // Supabase에 사용자가 없으면 localStorage로 폴백
    const members = this.readTable<CrewMember>('crew_members')
    const index = members.findIndex((m) => m.crewId === crewId && m.userId === userId)
    if (index === -1) return null
    members[index] = { ...members[index], ...updates }
    this.writeTable('crew_members', members)
    return members[index]
            }
            
            supabaseUserId = supabaseUser.id
            console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
          }
        }
      }
      
      const updateData: any = {}
      if (updates.videoEnabled !== undefined) updateData.video_enabled = updates.videoEnabled
      if (updates.audioEnabled !== undefined) updateData.audio_enabled = updates.audioEnabled
      if (updates.role !== undefined) updateData.role = updates.role

      const { data, error } = await supabase
        .from('crew_members')
        .update(updateData)
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)
        .select()
        .single()

      if (error) {
        console.error('crew_members 업데이트 에러:', error)
        throw error
      }
      return data ? this.mapSupabaseCrewMember(data) : null
    } else {
      const members = this.readTable<CrewMember>('crew_members')
      const index = members.findIndex((m) => m.crewId === crewId && m.userId === userId)
      if (index === -1) return null
      members[index] = { ...members[index], ...updates }
      this.writeTable('crew_members', members)
      return members[index]
    }
  }

  // ============ JoggingCrew 관련 ============
  async createJoggingCrew(crew: Omit<JoggingCrew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds'>): Promise<JoggingCrew> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const newCrew: JoggingCrew = {
      ...crew,
      id: `jcrew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      currentMembers: 1,
      memberIds: [crew.createdBy],
    }
    crews.push(newCrew)
    this.writeTable('jogging_crews', crews)
    return newCrew
  }

  async getJoggingCrewById(id: string): Promise<JoggingCrew | null> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    return crews.find((c) => c.id === id) || null
  }

  async getJoggingCrewsByUserId(userId: string): Promise<JoggingCrew[]> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    return crews.filter((c) => c.memberIds.includes(userId))
  }

  async getAllJoggingCrews(): Promise<JoggingCrew[]> {
    await this.initialize()
    return this.readTable<JoggingCrew>('jogging_crews')
  }

  async updateJoggingCrew(id: string, updates: Partial<JoggingCrew>): Promise<JoggingCrew | null> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const index = crews.findIndex((c) => c.id === id)
    if (index === -1) return null
    crews[index] = { ...crews[index], ...updates }
    this.writeTable('jogging_crews', crews)
    return crews[index]
  }

  async joinJoggingCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    const crew = await this.getJoggingCrewById(crewId)
    if (!crew) return false
    if (crew.maxMembers && crew.currentMembers >= crew.maxMembers) return false
    if (crew.memberIds.includes(userId)) return false

    await this.updateJoggingCrew(crewId, {
      currentMembers: crew.currentMembers + 1,
      memberIds: [...crew.memberIds, userId],
    })
    return true
  }

  async leaveJoggingCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    const crew = await this.getJoggingCrewById(crewId)
    if (!crew) return false

    await this.updateJoggingCrew(crewId, {
      currentMembers: crew.currentMembers - 1,
      memberIds: crew.memberIds.filter((id) => id !== userId),
    })
    return true
  }

  // ============ Chat 관련 ============
  async addChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('addChatMessage - crewId:', message.crewId, 'userId:', message.userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = message.userId
      
      // 시스템 메시지인 경우 특별 처리
      // 시스템 메시지는 실제 사용자 ID를 사용하거나, 시스템 사용자를 생성해야 함
      // 여기서는 시스템 메시지를 보낸 사용자(현재 사용자)의 ID를 사용
      if (message.userId === 'system') {
        // 시스템 메시지는 현재 로그인한 사용자의 ID를 사용
        const currentUser = authService.getCurrentUser()
        if (currentUser) {
          // 현재 사용자의 UUID 찾기
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (uuidRegex.test(currentUser.id)) {
            supabaseUserId = currentUser.id
          } else {
            // localStorage ID인 경우 email로 UUID 찾기
            const userStr = localStorage.getItem(`user_${currentUser.id}`)
            if (userStr) {
              const user = JSON.parse(userStr)
              if (user.email) {
                const { data: supabaseUser } = await supabase
                  .from('users')
                  .select('id')
                  .eq('email', user.email)
                  .single()
                
                if (supabaseUser) {
                  supabaseUserId = supabaseUser.id
                } else {
                  // Supabase에 사용자가 없으면 localStorage로 폴백
    const messages = this.readTable<ChatMessage>('chats')
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }
    messages.push(newMessage)
    this.writeTable('chats', messages)
    return newMessage
                }
              }
            }
          }
        } else {
          // 현재 사용자가 없으면 localStorage로 폴백
          const messages = this.readTable<ChatMessage>('chats')
          const newMessage: ChatMessage = {
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          }
          messages.push(newMessage)
          this.writeTable('chats', messages)
          return newMessage
        }
      } else {
        // UUID 형식이 아니면 email로 사용자 찾기
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(message.userId)) {
          const userStr = localStorage.getItem(`user_${message.userId}`)
          if (userStr) {
            const user = JSON.parse(userStr)
            if (user.email) {
              const { data: supabaseUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', user.email)
                .single()
              
              if (userError || !supabaseUser) {
                console.warn('Supabase 사용자를 찾을 수 없음:', userError)
                // Supabase에 사용자가 없으면 localStorage로 폴백
                const messages = this.readTable<ChatMessage>('chats')
                const newMessage: ChatMessage = {
                  ...message,
                  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  timestamp: Date.now(),
                }
                messages.push(newMessage)
                this.writeTable('chats', messages)
                return newMessage
              }
              
              supabaseUserId = supabaseUser.id
              console.log('Supabase 사용자 ID 매핑:', message.userId, '->', supabaseUserId)
            }
          }
        }
      }
      
      // 시스템 메시지의 경우 중복 체크 (최근 10초 이내 동일한 메시지가 있는지 확인)
      if (message.type === 'system') {
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString()
        const { data: recentMessages } = await supabase
          .from('chat_messages')
          .select('id, message, timestamp')
          .eq('crew_id', message.crewId)
          .eq('type', 'system')
          .eq('message', message.message)
          .gte('timestamp', tenSecondsAgo)
          .order('timestamp', { ascending: false })
          .limit(1)
        
        if (recentMessages && recentMessages.length > 0) {
          console.log('⚠️ 중복 시스템 메시지 감지, 저장 건너뜀:', message.message)
          // 최근 메시지를 반환 (중복 저장 방지)
          const recentMsg = recentMessages[0]
          return {
            id: recentMsg.id,
            crewId: message.crewId,
            userId: message.userId,
            userName: message.userName,
            message: recentMsg.message,
            timestamp: new Date(recentMsg.timestamp).getTime(),
            type: message.type,
          }
        }
      }
      
      // 메시지 삽입
      const { data: newMessage, error } = await supabase
        .from('chat_messages')
        .insert({
          crew_id: message.crewId,
          user_id: supabaseUserId,
          user_name: message.userName,
          message: message.message,
          type: message.type,
        })
        .select()
        .single()

      if (error) {
        console.error('chat_messages 삽입 에러:', error)
        throw error
      }

      return {
        id: newMessage.id,
        crewId: newMessage.crew_id,
        userId: message.userId, // 원본 userId 유지
        userName: newMessage.user_name,
        message: newMessage.message,
        timestamp: new Date(newMessage.timestamp).getTime(),
        type: newMessage.type as 'text' | 'system',
      }
    } else {
      const messages = this.readTable<ChatMessage>('chats')
      const newMessage: ChatMessage = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      }
      messages.push(newMessage)
      this.writeTable('chats', messages)
      return newMessage
    }
  }

  async getChatMessages(crewId: string, limit?: number): Promise<ChatMessage[]> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('crew_id', crewId)
        .order('timestamp', { ascending: true })

      if (limit) {
        query = query.limit(limit)
      }

      const { data: messages, error } = await query

      if (error) {
        console.error('chat_messages 조회 에러:', error)
        throw error
      }

      // Supabase 메시지를 로컬 형식으로 변환
      // userId는 원본을 유지하기 위해 users 테이블에서 조회 필요
      const chatMessages: ChatMessage[] = []
      
      for (const msg of messages || []) {
        // 시스템 메시지인 경우
        if (msg.user_id === '00000000-0000-0000-0000-000000000000') {
          chatMessages.push({
            id: msg.id,
            crewId: msg.crew_id,
            userId: 'system',
            userName: msg.user_name,
            message: msg.message,
            timestamp: new Date(msg.timestamp).getTime(),
            type: msg.type as 'text' | 'system',
          })
        } else {
          // 일반 메시지인 경우, userId는 원본을 찾기 어려우므로 Supabase user_id를 그대로 사용
          // 또는 users 테이블에서 email로 찾아서 매핑
          chatMessages.push({
            id: msg.id,
            crewId: msg.crew_id,
            userId: msg.user_id, // Supabase UUID 사용
            userName: msg.user_name,
            message: msg.message,
            timestamp: new Date(msg.timestamp).getTime(),
            type: msg.type as 'text' | 'system',
          })
        }
      }

      return chatMessages
    } else {
    const messages = this.readTable<ChatMessage>('chats')
    const filtered = messages.filter((m) => m.crewId === crewId).sort((a, b) => a.timestamp - b.timestamp)
    return limit ? filtered.slice(-limit) : filtered
    }
  }

  // ============ JoggingSession 관련 ============
  async createJoggingSession(session: Omit<JoggingSession, 'id'>): Promise<JoggingSession> {
    await this.initialize()
    const sessions = this.readTable<JoggingSession>('jogging_sessions')
    const newSession: JoggingSession = {
      ...session,
      id: `jsession_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    sessions.push(newSession)
    this.writeTable('jogging_sessions', sessions)
    return newSession
  }

  async getJoggingSessionById(id: string): Promise<JoggingSession | null> {
    await this.initialize()
    const sessions = this.readTable<JoggingSession>('jogging_sessions')
    return sessions.find((s) => s.id === id) || null
  }

  async updateJoggingSession(id: string, updates: Partial<JoggingSession>): Promise<JoggingSession | null> {
    await this.initialize()
    const sessions = this.readTable<JoggingSession>('jogging_sessions')
    const index = sessions.findIndex((s) => s.id === id)
    if (index === -1) return null
    sessions[index] = { ...sessions[index], ...updates }
    this.writeTable('jogging_sessions', sessions)
    return sessions[index]
  }

  // ============ ExerciseSession 관련 ============
  async createExerciseSession(session: Omit<ExerciseSession, 'id'>): Promise<ExerciseSession> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = session.userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(session.userId)) {
          supabaseUserId = await this.getSupabaseUserId(session.userId)
        }
        
        // Supabase에 저장
        const { data, error } = await supabase
          .from('exercise_sessions')
          .insert({
            user_id: supabaseUserId,
            crew_id: session.crewId || null,
            mode: session.mode,
            config: session.config,
            start_time: new Date(session.startTime).toISOString(),
            end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
            counts: session.counts,
            best_score: session.bestScore || null,
            worst_score: session.worstScore || null,
            average_score: session.averageScore,
            completed: session.completed,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 운동 세션 저장 실패:', error)
          throw error
        }
        
        // Supabase 데이터를 로컬 형식으로 변환
        return this.mapSupabaseExerciseSession(data)
      } catch (e) {
        console.error('Supabase 운동 세션 저장 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 저장 (Supabase 미사용 또는 실패 시)
    const sessions = this.readTable<ExerciseSession>('exercise_sessions')
    const newSession: ExerciseSession = {
      ...session,
      id: `esession_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    sessions.push(newSession)
    this.writeTable('exercise_sessions', sessions)
    return newSession
  }

  async getExerciseSessionById(id: string): Promise<ExerciseSession | null> {
    await this.initialize()
    const sessions = this.readTable<ExerciseSession>('exercise_sessions')
    return sessions.find((s) => s.id === id) || null
  }

  async updateExerciseSession(id: string, updates: Partial<ExerciseSession>): Promise<ExerciseSession | null> {
    await this.initialize()
    const sessions = this.readTable<ExerciseSession>('exercise_sessions')
    const index = sessions.findIndex((s) => s.id === id)
    if (index === -1) return null
    sessions[index] = { ...sessions[index], ...updates }
    this.writeTable('exercise_sessions', sessions)
    return sessions[index]
  }

  // Supabase 데이터 매핑 헬퍼 함수들
  private mapSupabaseUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      password: user.password,
      name: user.name,
      avatar: user.avatar,
      createdAt: new Date(user.created_at).getTime(),
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at).getTime() : undefined,
    }
  }

  private mapSupabaseCrew(crew: any): Crew {
    return {
      id: crew.id,
      name: crew.name,
      maxMembers: crew.max_members,
      currentMembers: crew.current_members,
      exerciseType: crew.exercise_type,
      exerciseConfig: crew.exercise_config,
      alarm: crew.alarm,
      createdAt: new Date(crew.created_at).getTime(),
      createdBy: crew.created_by,
      memberIds: crew.member_ids || [],
      videoShareEnabled: crew.video_share_enabled,
      audioShareEnabled: crew.audio_share_enabled,
      recommendations: crew.recommendations || 0,
    }
  }

  private mapSupabaseCrewMember(member: any): CrewMember {
    return {
      id: member.id,
      crewId: member.crew_id,
      userId: member.user_id,
      joinedAt: new Date(member.joined_at).getTime(),
      role: member.role,
      videoEnabled: member.video_enabled,
      audioEnabled: member.audio_enabled,
    }
  }

  private mapSupabaseExerciseSession(session: any): ExerciseSession {
    return {
      id: session.id,
      userId: session.user_id,
      crewId: session.crew_id || undefined,
      mode: session.mode,
      config: session.config,
      startTime: new Date(session.start_time).getTime(),
      endTime: session.end_time ? new Date(session.end_time).getTime() : undefined,
      counts: session.counts || [],
      bestScore: session.best_score || undefined,
      worstScore: session.worst_score || undefined,
      averageScore: session.average_score || 0,
      completed: session.completed || false,
    }
  }
}

export const databaseService = new DatabaseService()

