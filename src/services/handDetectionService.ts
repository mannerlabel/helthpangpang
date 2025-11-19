import * as handDetection from '@tensorflow-models/hand-pose-detection'
import '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import { HandDetection } from '@/types'

class HandDetectionService {
  private detector: handDetection.HandDetector | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await tf.ready()

      const model = handDetection.SupportedModels.MediaPipeHands
      const detectorConfig: handDetection.MediaPipeHandsMediaPipeModelConfig = {
        runtime: 'mediapipe',
        modelType: 'full',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
        maxHands: 2,
      }

      this.detector = await handDetection.createDetector(model, detectorConfig)
      this.isInitialized = true
    } catch (error) {
      throw new Error(`손 인식 초기화 실패: ${error}`)
    }
  }

  async detectHands(video: HTMLVideoElement): Promise<HandDetection[]> {
    if (!this.detector) {
      throw new Error('손 인식기가 초기화되지 않았습니다.')
    }

    try {
      const hands = await this.detector.estimateHands(video)
      
      return hands.map((hand) => {
        // 인덱스 손가락 끝 위치 (버튼 클릭 감지용)
        const indexFinger = hand.keypoints.find(
          (kp) => kp.name === 'index_finger_tip'
        )

        return {
          detected: true,
          position: indexFinger
            ? { x: indexFinger.x, y: indexFinger.y }
            : undefined,
          confidence: hand.score || 0,
        }
      })
    } catch (error) {
      throw new Error(`손 인식 실패: ${error}`)
    }
  }

  // 버튼 영역과 손가락 위치가 겹치는지 확인
  checkButtonClick(
    handPosition: { x: number; y: number },
    buttonRect: { x: number; y: number; width: number; height: number },
    videoWidth: number,
    videoHeight: number
  ): boolean {
    // 비디오 좌표를 화면 좌표로 변환
    const screenX = (handPosition.x / videoWidth) * window.innerWidth
    const screenY = (handPosition.y / videoHeight) * window.innerHeight

    return (
      screenX >= buttonRect.x &&
      screenX <= buttonRect.x + buttonRect.width &&
      screenY >= buttonRect.y &&
      screenY <= buttonRect.y + buttonRect.height
    )
  }

  dispose(): void {
    if (this.detector) {
      this.detector.dispose()
      this.detector = null
      this.isInitialized = false
    }
  }
}

export const handDetectionService = new HandDetectionService()

