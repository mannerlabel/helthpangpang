import { ExerciseType } from '@/types'
import { EXERCISE_TYPES } from '@/constants/exerciseTypes'
import { ExerciseStrategy } from './ExerciseStrategy'
import { SquatStrategy } from './SquatStrategy'
import { PushupStrategy } from './PushupStrategy'
import { LungeStrategy } from './LungeStrategy'

/**
 * 운동 전략 팩토리
 * 운동 타입에 따라 적절한 전략을 반환
 */
export class ExerciseStrategyFactory {
  private static strategies: Map<ExerciseType, ExerciseStrategy> = new Map()

  /**
   * 운동 타입에 맞는 전략 반환
   * @param exerciseType 운동 타입
   * @returns 운동 전략
   */
  static getStrategy(exerciseType: ExerciseType): ExerciseStrategy {
    // 캐시된 전략이 있으면 재사용
    if (this.strategies.has(exerciseType)) {
      return this.strategies.get(exerciseType)!
    }

    // 새 전략 생성
    let strategy: ExerciseStrategy
    switch (exerciseType) {
      case EXERCISE_TYPES.SQUAT:
        strategy = new SquatStrategy()
        break
      case EXERCISE_TYPES.PUSHUP:
        strategy = new PushupStrategy()
        break
      case EXERCISE_TYPES.LUNGE:
        strategy = new LungeStrategy()
        break
      default:
        // 기본 전략 (custom 등)
        strategy = new SquatStrategy() // 임시로 스쿼트 전략 사용
    }

    // 캐시에 저장
    this.strategies.set(exerciseType, strategy)
    return strategy
  }

  /**
   * 모든 전략 리셋
   */
  static resetAll(): void {
    this.strategies.forEach((strategy) => strategy.reset())
  }

  /**
   * 특정 전략 리셋
   */
  static reset(exerciseType: ExerciseType): void {
    const strategy = this.strategies.get(exerciseType)
    if (strategy) {
      strategy.reset()
    }
  }
}

