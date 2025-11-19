/**
 * 운동 타입 상수 정의
 * 모든 운동 타입 관련 상수와 매핑을 중앙화하여 관리
 * 타입은 이 상수에서 추출되므로 여기가 단일 진실 공급원(Single Source of Truth)
 */
export const EXERCISE_TYPES = {
  SQUAT: 'squat',
  PUSHUP: 'pushup',
  LUNGE: 'lunge',
  CUSTOM: 'custom',
} as const

/**
 * 운동 타입 (상수에서 추출)
 */
export type ExerciseType = typeof EXERCISE_TYPES[keyof typeof EXERCISE_TYPES]

/**
 * 운동 타입 한글 이름 매핑
 */
export const EXERCISE_TYPE_NAMES: Record<ExerciseType, string> = {
  squat: '스쿼트',
  pushup: '푸시업',
  lunge: '런지',
  custom: '종목 추가',
}

/**
 * 운동 타입 아이콘 매핑
 */
export const EXERCISE_TYPE_ICONS: Record<ExerciseType, string> = {
  squat: '🦵',
  pushup: '💪',
  lunge: '🚶',
  custom: '➕',
}

/**
 * 운동 타입 설명 매핑
 */
export const EXERCISE_TYPE_DESCRIPTIONS: Record<ExerciseType, string> = {
  squat: '무릎을 구부려 엉덩이를 낮추는 동작',
  pushup: '팔을 구부려 몸을 내렸다 올리는 동작',
  lunge: '한 발을 앞으로 내밀어 무릎을 구부리는 동작',
  custom: '사용자 정의 운동 종목',
}

/**
 * 운동 타입 인식 가이드 매핑
 */
export const EXERCISE_TYPE_RECOGNITION_GUIDES: Record<ExerciseType, string> = {
  squat: '• 무릎 각도가 140도 이하로 구부려져야 인식됩니다\n• 엉덩이가 무릎보다 낮아져야 카운트됩니다\n• 발은 어깨 너비만큼 벌리고, 무릎이 발가락을 넘지 않도록 주의하세요',
  pushup: '• 팔꿈치 각도가 100도 이하로 구부려져야 인식됩니다\n• 팔을 완전히 펴면(130도 이상) 카운트됩니다\n• 어깨, 팔꿈치, 손목이 일직선이 되도록 유지하세요\n• 몸통을 곧게 유지하고 엉덩이가 올라가지 않도록 주의하세요',
  lunge: '• 앞 무릎이 90도 정도로 구부려져야 인식됩니다\n• 뒷 무릎이 바닥에 거의 닿을 정도로 내려가야 카운트됩니다\n• 앞 무릎이 발가락을 넘지 않도록 주의하세요\n• 상체를 곧게 유지하세요',
  custom: '',
}

/**
 * 운동 타입 선택 옵션 (드롭다운 등에서 사용)
 */
export const EXERCISE_TYPE_OPTIONS = [
  { value: EXERCISE_TYPES.SQUAT, label: EXERCISE_TYPE_NAMES.squat },
  { value: EXERCISE_TYPES.PUSHUP, label: EXERCISE_TYPE_NAMES.pushup },
  { value: EXERCISE_TYPES.LUNGE, label: EXERCISE_TYPE_NAMES.lunge },
] as const

/**
 * 운동 타입 상세 정보 (아이콘, 이름, 설명, 가이드 포함)
 */
export const EXERCISE_TYPE_DETAILS = [
  {
    id: EXERCISE_TYPES.SQUAT,
    name: EXERCISE_TYPE_NAMES.squat,
    icon: EXERCISE_TYPE_ICONS.squat,
    description: EXERCISE_TYPE_DESCRIPTIONS.squat,
    recognitionGuide: EXERCISE_TYPE_RECOGNITION_GUIDES.squat,
  },
  {
    id: EXERCISE_TYPES.PUSHUP,
    name: EXERCISE_TYPE_NAMES.pushup,
    icon: EXERCISE_TYPE_ICONS.pushup,
    description: EXERCISE_TYPE_DESCRIPTIONS.pushup,
    recognitionGuide: EXERCISE_TYPE_RECOGNITION_GUIDES.pushup,
  },
  {
    id: EXERCISE_TYPES.LUNGE,
    name: EXERCISE_TYPE_NAMES.lunge,
    icon: EXERCISE_TYPE_ICONS.lunge,
    description: EXERCISE_TYPE_DESCRIPTIONS.lunge,
    recognitionGuide: EXERCISE_TYPE_RECOGNITION_GUIDES.lunge,
  },
  {
    id: EXERCISE_TYPES.CUSTOM,
    name: EXERCISE_TYPE_NAMES.custom,
    icon: EXERCISE_TYPE_ICONS.custom,
    description: EXERCISE_TYPE_DESCRIPTIONS.custom,
    recognitionGuide: EXERCISE_TYPE_RECOGNITION_GUIDES.custom,
  },
] as const

