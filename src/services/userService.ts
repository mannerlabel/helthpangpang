/**
 * 사용자 서비스
 * 회원탈퇴 등 사용자 관련 기능
 */

import { supabase } from './supabaseClient'
import { authService } from './authService'

class UserService {
  // 회원탈퇴
  async deactivateAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        return { success: false, error: '로그인이 필요합니다.' }
      }

      const { error } = await supabase
        .from('users')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        console.error('회원탈퇴 실패:', error)
        return { success: false, error: error.message }
      }

      // 로그아웃 처리
      await authService.logout()

      return { success: true }
    } catch (error: any) {
      console.error('회원탈퇴 중 오류:', error)
      return { success: false, error: error.message || '회원탈퇴 중 오류가 발생했습니다.' }
    }
  }
}

export const userService = new UserService()

