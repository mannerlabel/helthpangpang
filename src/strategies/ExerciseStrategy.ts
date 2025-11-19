import { Pose, PoseScore } from '@/types'

/**
 * 운동 분석 결과
 */
export interface ExerciseAnalysisResult {
  count: number
  isComplete: boolean
  depth?: number
  angle?: number
  state: string
  feedback?: string
}

/**
 * 운동 전략 인터페이스
 * 각 운동 타입별로 이 인터페이스를 구현
 */
export interface ExerciseStrategy {
  /**
   * 자세 분석 및 카운트
   * @param pose 자세 데이터
   * @param currentCount 현재 카운트
   * @param videoHeight 비디오 높이 (선택사항)
   * @returns 분석 결과
   */
  analyze(pose: Pose, currentCount: number, videoHeight?: number): ExerciseAnalysisResult

  /**
   * 카운터 리셋
   */
  reset(): void

  /**
   * 피드백 생성 (카운트가 완료되지 않았을 때)
   * @param result 분석 결과
   * @returns 피드백 메시지
   */
  generateFeedback(result: ExerciseAnalysisResult): string
}

