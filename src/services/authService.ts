/**
 * 인증 서비스
 * 로그인, 회원가입, 세션 관리
 */

import { databaseService, User } from './databaseService'

// 간단한 비밀번호 해시 (실제로는 bcrypt 등 사용)
function hashPassword(password: string): string {
  // 실제 프로덕션에서는 bcrypt 사용
  return btoa(password) // 임시로 base64 인코딩
}

function verifyPassword(password: string, hashed: string): boolean {
  return btoa(password) === hashed
}

class AuthService {
  private currentUser: User | null = null

  // 현재 사용자 가져오기
  getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser

    // localStorage에서 세션 확인
    const userId = localStorage.getItem('current_user_id')
    if (userId) {
      // 세션 복원 (실제로는 서버에서 검증)
      const userStr = localStorage.getItem(`user_${userId}`)
      if (userStr) {
        this.currentUser = JSON.parse(userStr)
        return this.currentUser
      }
    }

    return null
  }

  // 로그인
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const user = await databaseService.getUserByEmail(email)
      if (!user) {
        return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
      }

      if (!verifyPassword(password, user.password)) {
        return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
      }

      // 세션 저장
      this.currentUser = user
      localStorage.setItem('current_user_id', user.id)
      localStorage.setItem(`user_${user.id}`, JSON.stringify(user))

      // 마지막 로그인 시간 업데이트
      await databaseService.updateUser(user.id, { lastLoginAt: Date.now() })

      return { success: true, user }
    } catch (error) {
      return { success: false, error: '로그인 중 오류가 발생했습니다.' }
    }
  }

  // 회원가입
  async register(email: string, password: string, name: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // 이메일 중복 확인
      const existingUser = await databaseService.getUserByEmail(email)
      if (existingUser) {
        return { success: false, error: '이미 사용 중인 이메일입니다.' }
      }

      // 사용자 생성
      const user = await databaseService.createUser({
        email,
        password: hashPassword(password),
        name,
      })

      // 자동 로그인
      this.currentUser = user
      localStorage.setItem('current_user_id', user.id)
      localStorage.setItem(`user_${user.id}`, JSON.stringify(user))

      return { success: true, user }
    } catch (error) {
      return { success: false, error: '회원가입 중 오류가 발생했습니다.' }
    }
  }

  // 로그아웃
  logout(): void {
    this.currentUser = null
    localStorage.removeItem('current_user_id')
  }

  // 로그인 상태 확인
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null
  }

  // 사용자 정보 업데이트
  async updateProfile(updates: Partial<User>): Promise<User | null> {
    const user = this.getCurrentUser()
    if (!user) return null

    const updated = await databaseService.updateUser(user.id, updates)
    if (updated) {
      this.currentUser = updated
      localStorage.setItem(`user_${updated.id}`, JSON.stringify(updated))
    }
    return updated
  }
}

export const authService = new AuthService()

