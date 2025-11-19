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

    const detect = async () => {
      if (!isRunning) return
      
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

