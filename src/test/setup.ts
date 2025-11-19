/**
 * 테스트 환경 설정
 */
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 각 테스트 후 cleanup
afterEach(() => {
  cleanup()
})

// 전역 matcher 확장
declare global {
  namespace Vi {
    interface Assertion {
      // 필요시 커스텀 matcher 추가
    }
  }
}

