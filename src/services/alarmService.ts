import { AlarmConfig } from '@/types'

/**
 * 예약 알림 서비스
 * 1시간 전, 10분 전, 1분 전 알림 및 예약 시간 알림 처리
 */
class AlarmService {
  private alarms: Map<string, NodeJS.Timeout> = new Map()
  private alarmConfigs: Map<string, AlarmConfig & { exerciseConfig: any }> = new Map()

  /**
   * 알람 설정
   */
  setAlarm(
    id: string,
    alarmConfig: AlarmConfig,
    exerciseConfig: any,
    onNotify: (message: string, type: 'info' | 'warning' | 'start') => void,
    onStart: () => void
  ): void {
    // 기존 알람 제거
    this.clearAlarm(id)

    if (!alarmConfig.enabled) {
      return
    }

    // 알람 설정 저장
    this.alarmConfigs.set(id, { ...alarmConfig, exerciseConfig })

    const [hours, minutes] = alarmConfig.time.split(':').map(Number)
    const alarmTime = new Date()
    alarmTime.setHours(hours, minutes, 0, 0)

    // 오늘 날짜가 지났으면 내일로 설정
    if (alarmTime.getTime() < Date.now()) {
      alarmTime.setDate(alarmTime.getDate() + 1)
    }

    const now = Date.now()
    const alarmTimestamp = alarmTime.getTime()
    const timeUntilAlarm = alarmTimestamp - now

    // 1시간 전 알림 (3600000ms = 1시간)
    const oneHourBefore = timeUntilAlarm - 3600000
    if (oneHourBefore > 0) {
      const timeout1 = setTimeout(() => {
        onNotify('운동 예약 시간까지 1시간 남았습니다!', 'info')
      }, oneHourBefore)
      this.alarms.set(`${id}_1h`, timeout1)
    }

    // 10분 전 알림 (600000ms = 10분)
    const tenMinutesBefore = timeUntilAlarm - 600000
    if (tenMinutesBefore > 0) {
      const timeout2 = setTimeout(() => {
        onNotify('운동 예약 시간까지 10분 남았습니다!', 'warning')
      }, tenMinutesBefore)
      this.alarms.set(`${id}_10m`, timeout2)
    }

    // 1분 전 알림 (60000ms = 1분)
    const oneMinuteBefore = timeUntilAlarm - 60000
    if (oneMinuteBefore > 0) {
      const timeout3 = setTimeout(() => {
        onNotify('운동 예약 시간까지 1분 남았습니다!', 'warning')
      }, oneMinuteBefore)
      this.alarms.set(`${id}_1m`, timeout3)
    }

    // 예약 시간 알림
    if (timeUntilAlarm > 0) {
      const timeout4 = setTimeout(() => {
        onNotify('운동 시간입니다!', 'start')
        // 사용자 선택 대기 (onStart는 사용자가 선택할 때 호출)
      }, timeUntilAlarm)
      this.alarms.set(`${id}_start`, timeout4)
    }

    // 반복 설정 처리
    if (alarmConfig.repeatType === 'daily') {
      // 매일 반복
      this.scheduleDailyRepeat(id, alarmConfig, exerciseConfig, onNotify, onStart)
    } else if (alarmConfig.repeatType === 'weekly') {
      // 매주 반복
      this.scheduleWeeklyRepeat(id, alarmConfig, exerciseConfig, onNotify, onStart)
    } else if (alarmConfig.repeatType === 'custom' && alarmConfig.repeatDays) {
      // 사용자 지정 요일 반복
      this.scheduleCustomRepeat(id, alarmConfig, exerciseConfig, onNotify, onStart)
    }
  }

  /**
   * 매일 반복
   */
  private scheduleDailyRepeat(
    id: string,
    alarmConfig: AlarmConfig,
    exerciseConfig: any,
    onNotify: (message: string, type: 'info' | 'warning' | 'start') => void,
    onStart: () => void
  ): void {
    // 다음 날 같은 시간에 알람 설정
    const nextDay = new Date()
    nextDay.setDate(nextDay.getDate() + 1)
    const [hours, minutes] = alarmConfig.time.split(':').map(Number)
    nextDay.setHours(hours, minutes, 0, 0)

    const timeout = setTimeout(() => {
      this.setAlarm(`${id}_repeat`, alarmConfig, exerciseConfig, onNotify, onStart)
    }, nextDay.getTime() - Date.now())

    this.alarms.set(`${id}_repeat`, timeout)
  }

  /**
   * 매주 반복
   */
  private scheduleWeeklyRepeat(
    id: string,
    alarmConfig: AlarmConfig,
    exerciseConfig: any,
    onNotify: (message: string, type: 'info' | 'warning' | 'start') => void,
    onStart: () => void
  ): void {
    // 다음 주 같은 요일 같은 시간에 알람 설정
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const [hours, minutes] = alarmConfig.time.split(':').map(Number)
    nextWeek.setHours(hours, minutes, 0, 0)

    const timeout = setTimeout(() => {
      this.setAlarm(`${id}_repeat`, alarmConfig, exerciseConfig, onNotify, onStart)
    }, nextWeek.getTime() - Date.now())

    this.alarms.set(`${id}_repeat`, timeout)
  }

  /**
   * 사용자 지정 요일 반복
   */
  private scheduleCustomRepeat(
    id: string,
    alarmConfig: AlarmConfig,
    exerciseConfig: any,
    onNotify: (message: string, type: 'info' | 'warning' | 'start') => void,
    onStart: () => void
  ): void {
    if (!alarmConfig.repeatDays || alarmConfig.repeatDays.length === 0) {
      return
    }

    // 다음 지정된 요일 찾기
    const today = new Date().getDay() // 0 = 일요일, 6 = 토요일
    let daysUntilNext = 7

    for (const day of alarmConfig.repeatDays) {
      let diff = day - today
      if (diff <= 0) diff += 7
      if (diff < daysUntilNext) {
        daysUntilNext = diff
      }
    }

    const nextDay = new Date()
    nextDay.setDate(nextDay.getDate() + daysUntilNext)
    const [hours, minutes] = alarmConfig.time.split(':').map(Number)
    nextDay.setHours(hours, minutes, 0, 0)

    const timeout = setTimeout(() => {
      this.setAlarm(`${id}_repeat`, alarmConfig, exerciseConfig, onNotify, onStart)
    }, nextDay.getTime() - Date.now())

    this.alarms.set(`${id}_repeat`, timeout)
  }

  /**
   * 알람 제거
   */
  clearAlarm(id: string): void {
    // 관련된 모든 타임아웃 제거
    for (const [key, timeout] of this.alarms.entries()) {
      if (key.startsWith(id)) {
        clearTimeout(timeout)
        this.alarms.delete(key)
      }
    }
    this.alarmConfigs.delete(id)
  }

  /**
   * 모든 알람 제거
   */
  clearAllAlarms(): void {
    for (const timeout of this.alarms.values()) {
      clearTimeout(timeout)
    }
    this.alarms.clear()
    this.alarmConfigs.clear()
  }
}

export const alarmService = new AlarmService()

