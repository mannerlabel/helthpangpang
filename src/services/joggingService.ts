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

  async startTracking(): Promise<JoggingData> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation을 지원하지 않는 브라우저입니다.')
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.startTime = Date.now()
          this.totalPauseTime = 0
          this.lastRouteRecordTime = this.startTime
          this.route = [
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: this.startTime,
            },
          ]

          this.currentData = {
            distance: 0,
            averageSpeed: 0,
            averageTime: 0,
            route: this.route,
            startTime: this.startTime,
          }

          // 위치 추적 시작
          this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (this.currentData && !this.isPaused) {
                const now = Date.now()
                const newPoint = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  timestamp: now,
                }

                // 거리 계산은 항상 수행 (속도 계산을 위해)
                const lastPoint = this.route[this.route.length - 1]
                const distance = this.calculateDistance(
                  lastPoint.lat,
                  lastPoint.lng,
                  newPoint.lat,
                  newPoint.lng
                )

                this.currentData.distance += distance

                // 경로 기록은 30초 간격으로만 수행 (데이터 크기 최적화)
                const timeSinceLastRecord = now - this.lastRouteRecordTime
                if (timeSinceLastRecord >= this.ROUTE_RECORD_INTERVAL) {
                  this.route.push(newPoint)
                  this.currentData.route = [...this.route]
                  this.lastRouteRecordTime = now
                }

                // 현재 시간 업데이트 (일시정지 시간 제외)
                this.currentData.averageTime = now - this.startTime - this.totalPauseTime

                // 현재 속도 계산 (마지막 두 지점 간 거리와 시간 사용)
                // 경로에 기록되지 않았어도 거리 계산은 수행되므로, 마지막 경로 지점과 현재 지점 사용
                let currentSpeed = 0
                if (this.route.length >= 1) {
                  const lastRoutePoint = this.route[this.route.length - 1]
                  const timeDiff = (now - lastRoutePoint.timestamp) / 1000 / 3600 // 시간 단위
                  const distanceDiff = this.calculateDistance(
                    lastRoutePoint.lat,
                    lastRoutePoint.lng,
                    newPoint.lat,
                    newPoint.lng
                  )
                  if (timeDiff > 0) {
                    currentSpeed = distanceDiff / timeDiff
                  }
                }

                // 평균 속도 계산 (일시정지 시간 제외)
                const activeTime = this.currentData.averageTime / 1000 / 3600 // 시간 단위
                if (activeTime > 0) {
                  this.currentData.averageSpeed = this.currentData.distance / activeTime
                } else {
                  // 시작 직후에는 현재 속도 사용
                  this.currentData.averageSpeed = currentSpeed
                }
              }
            },
            (error) => {
              console.error('위치 추적 오류:', error)
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          )

          resolve(this.currentData)
        },
        (error) => {
          reject(new Error(`위치 정보를 가져올 수 없습니다: ${error.message}`))
        }
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
    const activeTime = currentTime / 1000 / 3600 // 시간 단위
    if (activeTime > 0 && this.currentData.distance > 0) {
      this.currentData.averageSpeed = this.currentData.distance / activeTime
    } else if (this.route.length >= 2) {
      // 시작 직후에는 마지막 두 지점 간 현재 속도 사용
      const lastTwoPoints = this.route.slice(-2)
      const timeDiff = (lastTwoPoints[1].timestamp - lastTwoPoints[0].timestamp) / 1000 / 3600 // 시간 단위
      const distanceDiff = this.calculateDistance(
        lastTwoPoints[0].lat,
        lastTwoPoints[0].lng,
        lastTwoPoints[1].lat,
        lastTwoPoints[1].lng
      )
      if (timeDiff > 0) {
        this.currentData.averageSpeed = distanceDiff / timeDiff
      }
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

