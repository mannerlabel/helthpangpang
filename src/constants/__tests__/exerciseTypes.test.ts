import { describe, it, expect } from 'vitest'
import {
  EXERCISE_TYPES,
  EXERCISE_TYPE_NAMES,
  EXERCISE_TYPE_ICONS,
  EXERCISE_TYPE_DESCRIPTIONS,
  EXERCISE_TYPE_OPTIONS,
  EXERCISE_TYPE_DETAILS,
} from '../exerciseTypes'
import { ExerciseType } from '@/types'

describe('exerciseTypes constants', () => {
  it('모든 운동 타입 상수가 정의되어 있어야 함', () => {
    expect(EXERCISE_TYPES.SQUAT).toBe('squat')
    expect(EXERCISE_TYPES.PUSHUP).toBe('pushup')
    expect(EXERCISE_TYPES.LUNGE).toBe('lunge')
    expect(EXERCISE_TYPES.CUSTOM).toBe('custom')
  })

  it('모든 운동 타입에 대한 이름이 정의되어 있어야 함', () => {
    expect(EXERCISE_TYPE_NAMES[EXERCISE_TYPES.SQUAT]).toBe('스쿼트')
    expect(EXERCISE_TYPE_NAMES[EXERCISE_TYPES.PUSHUP]).toBe('푸시업')
    expect(EXERCISE_TYPE_NAMES[EXERCISE_TYPES.LUNGE]).toBe('런지')
    expect(EXERCISE_TYPE_NAMES[EXERCISE_TYPES.CUSTOM]).toBe('종목 추가')
  })

  it('모든 운동 타입에 대한 아이콘이 정의되어 있어야 함', () => {
    expect(EXERCISE_TYPE_ICONS[EXERCISE_TYPES.SQUAT]).toBe('🦵')
    expect(EXERCISE_TYPE_ICONS[EXERCISE_TYPES.PUSHUP]).toBe('💪')
    expect(EXERCISE_TYPE_ICONS[EXERCISE_TYPES.LUNGE]).toBe('🚶')
    expect(EXERCISE_TYPE_ICONS[EXERCISE_TYPES.CUSTOM]).toBe('➕')
  })

  it('모든 운동 타입에 대한 설명이 정의되어 있어야 함', () => {
    expect(EXERCISE_TYPE_DESCRIPTIONS[EXERCISE_TYPES.SQUAT]).toBeTruthy()
    expect(EXERCISE_TYPE_DESCRIPTIONS[EXERCISE_TYPES.PUSHUP]).toBeTruthy()
    expect(EXERCISE_TYPE_DESCRIPTIONS[EXERCISE_TYPES.LUNGE]).toBeTruthy()
    expect(EXERCISE_TYPE_DESCRIPTIONS[EXERCISE_TYPES.CUSTOM]).toBeTruthy()
  })

  it('EXERCISE_TYPE_OPTIONS가 올바른 구조를 가져야 함', () => {
    expect(EXERCISE_TYPE_OPTIONS.length).toBeGreaterThan(0)
    EXERCISE_TYPE_OPTIONS.forEach((option) => {
      expect(option).toHaveProperty('value')
      expect(option).toHaveProperty('label')
      expect(typeof option.value).toBe('string')
      expect(typeof option.label).toBe('string')
    })
  })

  it('EXERCISE_TYPE_DETAILS가 모든 필드를 포함해야 함', () => {
    expect(EXERCISE_TYPE_DETAILS.length).toBeGreaterThan(0)
    EXERCISE_TYPE_DETAILS.forEach((detail) => {
      expect(detail).toHaveProperty('id')
      expect(detail).toHaveProperty('name')
      expect(detail).toHaveProperty('icon')
      expect(detail).toHaveProperty('description')
      expect(detail).toHaveProperty('recognitionGuide')
    })
  })

  it('모든 ExerciseType에 대한 매핑이 완전해야 함', () => {
    const allTypes: ExerciseType[] = ['squat', 'pushup', 'lunge', 'custom']
    allTypes.forEach((type) => {
      expect(EXERCISE_TYPE_NAMES[type]).toBeDefined()
      expect(EXERCISE_TYPE_ICONS[type]).toBeDefined()
      expect(EXERCISE_TYPE_DESCRIPTIONS[type]).toBeDefined()
    })
  })
})

