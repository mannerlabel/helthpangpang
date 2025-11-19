import { ExerciseStrategy, ExerciseAnalysisResult } from './ExerciseStrategy'
import { Pose } from '@/types'
import { PushupCounter } from '@/utils/pushupCounter'

/**
 * 푸시업 전략 구현
 */
export class PushupStrategy implements ExerciseStrategy {
  private counter: PushupCounter = new PushupCounter()

  analyze(pose: Pose, currentCount: number, videoHeight?: number): ExerciseAnalysisResult {
    const height = videoHeight || 720
    const result = this.counter.analyzePushup(pose, currentCount, height)
    return {
      count: result.count,
      isComplete: result.isComplete,
      depth: result.depth,
      state: result.state,
    }
  }

  reset(): void {
    this.counter.reset()
  }

  generateFeedback(result: ExerciseAnalysisResult): string {
    if (result.isComplete) {
      return '푸시업 완료!'
    } else {
      const counter = this.counter as any
      const state = counter.state
      
      if (state === 'up') {
        return '팔을 더 구부려주세요'
      } else if (state === 'down') {
        return '팔을 더 펴주세요'
      } else {
        return '정상 자세'
      }
    }
  }
}

