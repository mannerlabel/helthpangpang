import { useState, useEffect, useRef } from 'react'
import { cameraService } from '@/services/cameraService'
import { CameraConfig, CameraState } from '@/types/camera'

export const useCamera = (config: CameraConfig) => {
  const [state, setState] = useState<CameraState>({
    isActive: false,
    stream: null,
    error: null,
  })
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return () => {
      cameraService.stop()
    }
  }, [])

  const start = async () => {
    try {
      const stream = await cameraService.initialize(config)
      
      // video 요소가 준비될 때까지 대기
      const setVideoStream = (video: HTMLVideoElement) => {
        // srcObject를 직접 DOM 속성으로 설정 (React prop 경고 방지)
        if ('srcObject' in video) {
          (video as any).srcObject = stream
        } else {
          // 구형 브라우저 지원
          const videoElement = video as HTMLVideoElement & { src?: string }
          videoElement.src = URL.createObjectURL(stream as any)
        }
      }
      
      if (videoRef.current) {
        setVideoStream(videoRef.current)
        try {
          await videoRef.current.play()
        } catch (playError) {
          console.warn('비디오 재생 오류:', playError)
        }
      } else {
        // video 요소가 아직 마운트되지 않은 경우, 약간의 지연 후 재시도
        setTimeout(async () => {
          if (videoRef.current) {
            setVideoStream(videoRef.current)
            try {
              await videoRef.current.play()
            } catch (playError) {
              console.warn('비디오 재생 오류:', playError)
            }
          }
        }, 100)
      }
      
      setState({
        isActive: true,
        stream,
        error: null,
      })
    } catch (error) {
      console.error('카메라 시작 오류:', error)
      setState({
        isActive: false,
        stream: null,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      })
    }
  }

  const stop = () => {
    cameraService.stop()
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setState({
      isActive: false,
      stream: null,
      error: null,
    })
  }

  const switchCamera = async () => {
    try {
      const stream = await cameraService.switchCamera()
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setState((prev) => ({
        ...prev,
        stream,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : '카메라 전환 실패',
      }))
    }
  }

  return {
    state,
    videoRef,
    start,
    stop,
    switchCamera,
  }
}

