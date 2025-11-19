import { CameraConfig, CameraState } from '@/types/camera'

class CameraService {
  private stream: MediaStream | null = null

  async initialize(config: CameraConfig): Promise<MediaStream> {
    try {
      console.log('카메라 초기화 시작...', config)
      
      // 기존 스트림이 있으면 먼저 정리
      if (this.stream) {
        this.stop()
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: config.width },
          height: { ideal: config.height },
          facingMode: config.facingMode,
          frameRate: config.frameRate || 30,
        },
        audio: false,
      }

      console.log('카메라 제약 조건:', constraints)
      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('카메라 스트림 획득 성공:', {
        tracks: this.stream.getTracks().length,
        videoTracks: this.stream.getVideoTracks().length,
      })
      
      // 스트림 이벤트 리스너 추가
      this.stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          console.log('비디오 트랙 종료됨')
        }
        track.onmute = () => {
          console.warn('비디오 트랙 음소거됨')
        }
        track.onunmute = () => {
          console.log('비디오 트랙 음소거 해제됨')
        }
      })
      
      return this.stream
    } catch (error) {
      console.error('카메라 초기화 오류:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
        } else if (error.name === 'NotFoundError') {
          throw new Error('카메라를 찾을 수 없습니다.')
        } else if (error.name === 'NotReadableError') {
          throw new Error('카메라에 접근할 수 없습니다. 다른 애플리케이션에서 사용 중일 수 있습니다.')
        }
      }
      throw new Error(`카메라 초기화 실패: ${error}`)
    }
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
  }

  async switchCamera(): Promise<MediaStream> {
    const currentFacingMode = this.stream
      ?.getVideoTracks()[0]
      .getSettings().facingMode

    this.stop()

    const newFacingMode: 'user' | 'environment' =
      currentFacingMode === 'user' ? 'environment' : 'user'

    return this.initialize({
      width: 1280,
      height: 720,
      facingMode: newFacingMode,
    })
  }
}

export const cameraService = new CameraService()

