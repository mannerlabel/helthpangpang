import { JoggingData } from '@/types'

class JoggingService {
  private watchId: number | null = null
  private currentData: JoggingData | null = null
  private route: Array<{ lat: number; lng: number; timestamp: number }> = []
  private isPaused: boolean = false
  private pauseStartTime: number | null = null
  private totalPauseTime: number = 0 // 총 일시정지 시간 (ms)
  private startTime: number = 0 // 추적 시작 시간
  private lastRouteRecordTime: number = 0 // 마지막 경로 기록 시간 (30초 간격 기록용)
  private readonly ROUTE_RECORD_INTERVAL = 30000 // 경로 기록 간격 (30초, ms)
  private lastPosition: { lat: number; lng: number; timestamp: number } | null = null // 이전 위치 (속도 계산용)

  async startTracking(): Promise<JoggingData> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation을 지원하지 않는 브라우저입니다.')
    }

    return new Promise((resolve, reject) => {
      // 즉시 초기 데이터 생성 (위치 정보는 나중에 업데이트)
      this.startTime = Date.now()
      this.totalPauseTime = 0
      this.lastRouteRecordTime = this.startTime
      
      // 초기 데이터를 먼저 생성하여 즉시 반환
      this.currentData = {
        distance: 0,
        averageSpeed: 0,
        averageTime: 0,
        route: [],
        startTime: this.startTime,
      }

      // 위치 정보는 비동기로 가져오되, 즉시 resolve하여 시작 지연 최소화
      const positionOptions = {
        enableHighAccuracy: false, // PC에서는 false로 설정하여 빠른 시작
        timeout: 10000, // 10초
        maximumAge: 60000, // 1분 이내 캐시된 위치 허용
      }

      // 위치 업데이트 핸들러 (공통 함수)
      const handlePositionUpdate = (pos: GeolocationPosition) => {
        if (this.currentData && !this.isPaused) {
          const now = Date.now()
          const newPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: now,
          }

          // 첫 위치인 경우 초기화
          if (this.route.length === 0) {
            this.route = [newPoint]
            this.lastPosition = newPoint
            if (this.currentData) {
              this.currentData.route = this.route
            }
          } else {
            // 거리 계산은 이전 위치와 현재 위치 간 거리를 사용 (정확도 향상)
            if (this.lastPosition) {
              const distance = this.calculateDistance(
                this.lastPosition.lat,
                this.lastPosition.lng,
                newPoint.lat,
                newPoint.lng
              )

              // GPS 오차로 인한 이상치 필터링 (너무 큰 거리는 제외, 예: 1km 이상)
              if (distance < 1.0) {
                this.currentData.distance += distance
              }
            }

            // 이전 위치 업데이트 (속도 계산을 위해 항상 업데이트)
            this.lastPosition = newPoint

            // 경로 기록은 30초 간격으로만 수행 (데이터 크기 최적화)
            const timeSinceLastRecord = now - this.lastRouteRecordTime
            if (timeSinceLastRecord >= this.ROUTE_RECORD_INTERVAL) {
              this.route.push(newPoint)
              this.currentData.route = [...this.route]
              this.lastRouteRecordTime = now
            }
          }

          // 현재 시간 업데이트 (일시정지 시간 제외)
          this.currentData.averageTime = now - this.startTime - this.totalPauseTime

          // 현재 속도 계산 (이전 위치와 현재 위치 간 거리와 시간 사용)
          let currentSpeed = 0
          if (this.lastPosition && this.route.length >= 1) {
            // 마지막으로 기록된 경로 지점과 현재 지점 간 시간 차이
            const lastRoutePoint = this.route[this.route.length - 1]
            const timeDiff = (now - lastRoutePoint.timestamp) / 1000 / 3600 // 시간 단위 (시간)
            
            if (timeDiff > 0) {
              // 마지막 경로 지점과 현재 지점 간 거리
              const distanceDiff = this.calculateDistance(
                lastRoutePoint.lat,
                lastRoutePoint.lng,
                newPoint.lat,
                newPoint.lng
              )
              currentSpeed = distanceDiff / timeDiff
            }
          }

          // 평균 속도 계산 (일시정지 시간 제외)
          // 평균 속도 = 총 거리 / 총 시간 (활동 시간)
          const activeTime = this.currentData.averageTime / 1000 / 3600 // 시간 단위 (시간)
          if (activeTime > 0 && this.currentData.distance > 0) {
            this.currentData.averageSpeed = this.currentData.distance / activeTime
          } else if (currentSpeed > 0) {
            // 시작 직후에는 현재 속도 사용
            this.currentData.averageSpeed = currentSpeed
          } else {
            this.currentData.averageSpeed = 0
          }
        }
      }

      // 위치 추적 시작 (getCurrentPosition 성공 여부와 관계없이)
      this.watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
          console.error('위치 추적 오류:', error)
        },
        positionOptions
      )

      // 즉시 resolve하여 시작 지연 최소화
      if (this.currentData) {
        resolve(this.currentData)
      }

      // 초기 위치 정보는 비동기로 가져오기 (선택적)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // 위치 정보를 받으면 업데이트 (이미 watchPosition이 시작되었으므로 중복 업데이트 방지)
          if (this.route.length === 0) {
            const initialPoint = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: this.startTime,
            }
            this.route = [initialPoint]
            this.lastPosition = initialPoint
            if (this.currentData) {
              this.currentData.route = this.route
            }
          }
        },
        (error) => {
          // 위치 정보를 가져오지 못해도 추적은 계속됨 (watchPosition이 이미 시작됨)
          console.warn('초기 위치 정보를 가져오지 못했습니다. 추적은 계속됩니다:', error)
        },
        positionOptions
      )
    })
  }

  stopTracking(): JoggingData | null {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }

    // 일시정지 중이면 일시정지 해제
    if (this.isPaused && this.pauseStartTime) {
      this.totalPauseTime += Date.now() - this.pauseStartTime
      this.isPaused = false
      this.pauseStartTime = null
    }

    if (this.currentData) {
      this.currentData.endTime = Date.now()
      const data = { ...this.currentData }
      this.currentData = null
      this.route = []
      this.lastPosition = null
      this.totalPauseTime = 0
      this.isPaused = false
      this.pauseStartTime = null
      this.lastRouteRecordTime = 0
      return data
    }

    return null
  }

  pauseTracking(): void {
    if (this.currentData && !this.isPaused) {
      this.isPaused = true
      this.pauseStartTime = Date.now()
    }
  }

  resumeTracking(): void {
    if (this.currentData && this.isPaused && this.pauseStartTime) {
      this.totalPauseTime += Date.now() - this.pauseStartTime
      this.isPaused = false
      this.pauseStartTime = null
    }
  }

  getIsPaused(): boolean {
    return this.isPaused
  }

  getCurrentData(): JoggingData | null {
    if (!this.currentData) return null
    
    // 실시간으로 시간과 속도 업데이트 (일시정지 시간 제외)
    const currentTime = Date.now() - this.startTime - this.totalPauseTime
    this.currentData.averageTime = currentTime
    
    // 평균 속도 재계산 (일시정지 시간 제외)
    // 평균 속도 = 총 거리 / 총 시간 (활동 시간)
    const activeTime = currentTime / 1000 / 3600 // 시간 단위 (시간)
    if (activeTime > 0 && this.currentData.distance > 0) {
      this.currentData.averageSpeed = this.currentData.distance / activeTime
    } else if (this.lastPosition && this.route.length >= 1) {
      // 시작 직후에는 마지막 경로 지점과 현재 위치 간 속도 사용
      const lastRoutePoint = this.route[this.route.length - 1]
      const timeDiff = (Date.now() - lastRoutePoint.timestamp) / 1000 / 3600 // 시간 단위 (시간)
      if (timeDiff > 0) {
        const distanceDiff = this.calculateDistance(
          lastRoutePoint.lat,
          lastRoutePoint.lng,
          this.lastPosition.lat,
          this.lastPosition.lng
        )
        this.currentData.averageSpeed = distanceDiff / timeDiff
      } else {
        this.currentData.averageSpeed = 0
      }
    } else {
      this.currentData.averageSpeed = 0
    }
    
    return { ...this.currentData }
  }

  // 두 지점 간 거리 계산 (km)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371 // 지구 반경 (km)
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }
}

export const joggingService = new JoggingService()

