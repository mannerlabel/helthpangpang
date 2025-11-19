import { ExerciseStrategy, ExerciseAnalysisResult } from './ExerciseStrategy'
import { Pose } from '@/types'
import { LungeCounter } from '@/utils/lungeCounter'

/**
 * 런지 전략 구현
 */
export class LungeStrategy implements ExerciseStrategy {
  private counter: LungeCounter = new LungeCounter()

  analyze(pose: Pose, currentCount: number, videoHeight?: number): ExerciseAnalysisResult {
    const result = this.counter.analyzeLunge(pose, currentCount)
    return {
      count: result.count,
      isComplete: result.isComplete,
      depth: result.depth,
      angle: result.angle,
      state: result.state,
      feedback: result.feedback,
    }
  }

  reset(): void {
    this.counter.reset()
  }

  generateFeedback(result: ExerciseAnalysisResult): string {
    return result.feedback || ''
  }
}

