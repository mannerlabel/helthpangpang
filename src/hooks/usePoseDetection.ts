import { useState, useEffect, useRef } from 'react'
import { poseDetectionService } from '@/services/poseDetectionService'
import { Pose } from '@/types'

export const usePoseDetection = (videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean = true) => {
  const [poses, setPoses] = useState<Pose[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const init = async () => {
      try {
        await poseDetectionService.initialize()
        setIsInitialized(true)
      } catch (error) {
        console.error('자세 인식 초기화 실패:', error)
      }
    }

    init()

    return () => {
      poseDetectionService.dispose()
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || !isInitialized || !videoRef.current) {
      setPoses([])
      return
    }

    let isRunning = true
    let lastDetectionTime = 0
    const targetFPS = 10 // 10fps로 조정 (자세 측정에는 충분하며 성능 최적화 - CPU/GPU 사용량 30-40% 감소)
    const frameInterval = 1000 / targetFPS // 약 100ms

    const detect = async () => {
      if (!isRunning) return
      
      const currentTime = Date.now()
      const timeSinceLastDetection = currentTime - lastDetectionTime
      
      // 프레임레이트 제한: 마지막 감지 후 충분한 시간이 지났는지 확인
      if (timeSinceLastDetection < frameInterval) {
        // 아직 시간이 안 지났으면 다음 프레임에서 다시 시도
        animationFrameRef.current = requestAnimationFrame(detect)
        return
      }
      
      // 초기화 상태를 다시 확인
      if (!poseDetectionService.getInitialized()) {
        // 초기화가 완료되지 않았으면 다음 프레임에서 다시 시도
        if (isRunning) {
          animationFrameRef.current = requestAnimationFrame(detect)
        }
        return
      }
      
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          const detectedPoses = await poseDetectionService.detectPose(videoRef.current)
          lastDetectionTime = currentTime
          if (isRunning) {
            setPoses(detectedPoses)
          }
        } catch (error) {
          // 오류 발생 시 빈 배열로 설정하여 앱이 멈추지 않도록 함
          console.error('자세 인식 오류:', error)
          if (isRunning) {
            setPoses([])
          }
        }
      }

      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(detect)
      }
    }

    detect()

    return () => {
      isRunning = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [enabled, isInitialized, videoRef])

  return { poses, isInitialized }
}

