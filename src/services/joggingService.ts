import { JoggingData } from '@/types'

class JoggingService {
  private watchId: number | null = null
  private currentData: JoggingData | null = null
  private route: Array<{ lat: number; lng: number; timestamp: number }> = []
  private isPaused: boolean = false
  private pauseStartTime: number | null = null
  private totalPauseTime: number = 0 // 총 일시정지 시간 (ms)

  async startTracking(): Promise<JoggingData> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation을 지원하지 않는 브라우저입니다.')
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const startTime = Date.now()
          this.route = [
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: startTime,
            },
          ]

          this.currentData = {
            distance: 0,
            averageSpeed: 0,
            averageTime: 0,
            route: this.route,
            startTime,
          }

          // 위치 추적 시작
          this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (this.currentData && !this.isPaused) {
                const newPoint = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  timestamp: Date.now(),
                }

                // 거리 계산 (Haversine formula)
                const lastPoint = this.route[this.route.length - 1]
                const distance = this.calculateDistance(
                  lastPoint.lat,
                  lastPoint.lng,
                  newPoint.lat,
                  newPoint.lng
                )

                this.currentData.distance += distance
                this.route.push(newPoint)
                this.currentData.route = [...this.route]

                // 평균 속도 계산 (일시정지 시간 제외)
                const activeTime = (Date.now() - startTime - this.totalPauseTime) / 1000 / 3600 // 시간
                this.currentData.averageSpeed =
                  this.currentData.distance / activeTime || 0
                this.currentData.averageTime = Date.now() - startTime - this.totalPauseTime
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
    return this.currentData ? { ...this.currentData } : null
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

