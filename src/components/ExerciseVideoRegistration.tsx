import { useState, useEffect, useRef, useCallback } from 'react'
import { poseDetectionService } from '@/services/poseDetectionService'
import { calculateAngle, findKeypoint } from '@/utils/poseUtils'
import { Pose, PoseKeypoint } from '@/types'
import { ExerciseVideoPose } from '@/services/databaseService'
import PoseCanvas from '@/components/PoseCanvas'
import { audioService } from '@/services/audioService'

interface ExerciseVideoRegistrationProps {
  onComplete: (videoData: {
    title: string
    description?: string
    poseData: ExerciseVideoPose[]
    totalPoses: number
    durationSeconds: number
  }) => void
  onCancel: () => void
}

const ExerciseVideoRegistration = ({ onComplete, onCancel }: ExerciseVideoRegistrationProps) => {
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(8) // 초기값 8초 (유지 시간)
  const [isRecording, setIsRecording] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0) // 초 단위
  const [capturedPoses, setCapturedPoses] = useState<ExerciseVideoPose[]>([])
  const [showResults, setShowResults] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null) // 준비 카운트다운 (10초)
  const [currentPoses, setCurrentPoses] = useState<Pose[]>([]) // 실시간 포즈 데이터
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const poseCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const poseDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const handleStopTimeoutRef = useRef<NodeJS.Timeout | null>(null) // handleStop을 호출하는 setTimeout ID 저장
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [poseImageSize, setPoseImageSize] = useState<{ width: number; height: number } | null>(null)
  const poseImageRef = useRef<HTMLImageElement>(null)
  const isStoppingRef = useRef<boolean>(false) // 중복 호출 방지 플래그
  const [selectedPoseIndices, setSelectedPoseIndices] = useState<Set<number>>(new Set()) // 선택된 포즈 인덱스

  // 슬라이드 변경 시 이미지 크기 업데이트
  useEffect(() => {
    if (poseImageRef.current && capturedPoses[currentSlideIndex]?.image) {
      const img = new Image()
      img.onload = () => {
        setPoseImageSize({
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }
      img.src = capturedPoses[currentSlideIndex].image
    }
  }, [currentSlideIndex, capturedPoses])

  // 포즈 인식 초기화
  useEffect(() => {
    const initPoseDetection = async () => {
      try {
        await poseDetectionService.initialize()
      } catch (error) {
        console.error('포즈 인식 초기화 실패:', error)
        alert('포즈 인식을 초기화할 수 없습니다.')
      }
    }
    initPoseDetection()

    return () => {
      poseDetectionService.dispose()
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      if (poseDetectionIntervalRef.current) {
        clearInterval(poseDetectionIntervalRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (poseCaptureIntervalRef.current) {
        clearInterval(poseCaptureIntervalRef.current)
      }
      stopCamera()
    }
  }, [])

  // 카메라 시작
  const startCamera = async () => {
    try {
      // 기존 스트림이 있으면 먼저 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      // 비디오 요소 초기화
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current.pause()
      }
      
      // 잠시 대기 (카메라 정리 시간)
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // 비디오가 로드될 때까지 대기
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            resolve()
            return
          }
          
          const onLoadedMetadata = () => {
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata)
            videoRef.current?.removeEventListener('error', onError)
            videoRef.current?.play()
              .then(() => {
                // 비디오가 재생될 때까지 추가 대기
                setTimeout(() => resolve(), 100)
              })
              .catch(() => resolve())
          }
          
          const onError = () => {
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata)
            videoRef.current?.removeEventListener('error', onError)
            reject(new Error('비디오 로드 실패'))
          }
          
          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata)
          videoRef.current.addEventListener('error', onError)
          
          // 이미 로드되어 있으면 즉시 재생
          if (videoRef.current.readyState >= 2) {
            videoRef.current.play()
              .then(() => {
                setTimeout(() => resolve(), 100)
              })
              .catch(() => resolve())
          }
        })
      }
    } catch (error) {
      console.error('카메라 접근 실패:', error)
      alert('카메라에 접근할 수 없습니다.')
      throw error
    }
  }

  // 카메라 중지
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  // 포즈 분석 및 각도 계산
  const analyzePose = (pose: Pose): { angles: { [key: string]: number }; description: string; keyValues: string[] } => {
    const keypoints = pose.keypoints
    const angles: { [key: string]: number } = {}
    const descriptions: string[] = []
    const keyValues: string[] = []

    // 왼쪽 팔꿈치 각도
    const leftShoulder = findKeypoint(keypoints, 'left_shoulder')
    const leftElbow = findKeypoint(keypoints, 'left_elbow')
    const leftWrist = findKeypoint(keypoints, 'left_wrist')
    if (leftShoulder && leftElbow && leftWrist) {
      const angle = calculateAngle(
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: leftElbow.x, y: leftElbow.y },
        { x: leftWrist.x, y: leftWrist.y }
      )
      angles.left_elbow = Math.round(angle)
      descriptions.push(`왼팔각도 ${Math.round(angle)}도`)
      keyValues.push(`왼팔꿈치: ${Math.round(angle)}°`)
    }

    // 오른쪽 팔꿈치 각도
    const rightShoulder = findKeypoint(keypoints, 'right_shoulder')
    const rightElbow = findKeypoint(keypoints, 'right_elbow')
    const rightWrist = findKeypoint(keypoints, 'right_wrist')
    if (rightShoulder && rightElbow && rightWrist) {
      const angle = calculateAngle(
        { x: rightShoulder.x, y: rightShoulder.y },
        { x: rightElbow.x, y: rightElbow.y },
        { x: rightWrist.x, y: rightWrist.y }
      )
      angles.right_elbow = Math.round(angle)
      descriptions.push(`오른팔각도 ${Math.round(angle)}도`)
      keyValues.push(`오른팔꿈치: ${Math.round(angle)}°`)
    }

    // 왼쪽 무릎 각도
    const leftHip = findKeypoint(keypoints, 'left_hip')
    const leftKnee = findKeypoint(keypoints, 'left_knee')
    const leftAnkle = findKeypoint(keypoints, 'left_ankle')
    if (leftHip && leftKnee && leftAnkle) {
      const angle = calculateAngle(
        { x: leftHip.x, y: leftHip.y },
        { x: leftKnee.x, y: leftKnee.y },
        { x: leftAnkle.x, y: leftAnkle.y }
      )
      angles.left_knee = Math.round(angle)
      descriptions.push(`왼다리각도 ${Math.round(angle)}도`)
      keyValues.push(`왼무릎: ${Math.round(angle)}°`)
    }

    // 오른쪽 무릎 각도
    const rightHip = findKeypoint(keypoints, 'right_hip')
    const rightKnee = findKeypoint(keypoints, 'right_knee')
    const rightAnkle = findKeypoint(keypoints, 'right_ankle')
    if (rightHip && rightKnee && rightAnkle) {
      const angle = calculateAngle(
        { x: rightHip.x, y: rightHip.y },
        { x: rightKnee.x, y: rightKnee.y },
        { x: rightAnkle.x, y: rightAnkle.y }
      )
      angles.right_knee = Math.round(angle)
      descriptions.push(`오른다리각도 ${Math.round(angle)}도`)
      keyValues.push(`오른무릎: ${Math.round(angle)}°`)
    }

    // 왼쪽 어깨 각도 (목-어깨-팔꿈치)
    const nose = findKeypoint(keypoints, 'nose')
    if (nose && leftShoulder && leftElbow) {
      const angle = calculateAngle(
        { x: nose.x, y: nose.y },
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: leftElbow.x, y: leftElbow.y }
      )
      angles.left_shoulder = Math.round(angle)
      keyValues.push(`왼어깨: ${Math.round(angle)}°`)
    }

    // 오른쪽 어깨 각도 (목-어깨-팔꿈치)
    if (nose && rightShoulder && rightElbow) {
      const angle = calculateAngle(
        { x: nose.x, y: nose.y },
        { x: rightShoulder.x, y: rightShoulder.y },
        { x: rightElbow.x, y: rightElbow.y }
      )
      angles.right_shoulder = Math.round(angle)
      keyValues.push(`오른어깨: ${Math.round(angle)}°`)
    }

    // 목 각도 (왼쪽 어깨-목-오른쪽 어깨)
    if (nose && leftShoulder && rightShoulder) {
      const angle = calculateAngle(
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: nose.x, y: nose.y },
        { x: rightShoulder.x, y: rightShoulder.y }
      )
      angles.neck = Math.round(angle)
      keyValues.push(`목: ${Math.round(angle)}°`)
    }

    // 왼쪽 손목 각도 (팔꿈치-손목-어깨 방향 추정)
    // 손목의 각도는 팔꿈치-손목-어깨의 각도로 추정 (손목의 굽힘 정도)
    if (leftElbow && leftWrist && leftShoulder) {
      // 손목이 팔꿈치에서 얼마나 벗어났는지로 각도 계산
      const angle = calculateAngle(
        { x: leftElbow.x, y: leftElbow.y },
        { x: leftWrist.x, y: leftWrist.y },
        { x: leftShoulder.x, y: leftShoulder.y }
      )
      angles.left_wrist = Math.round(angle)
      keyValues.push(`왼손목: ${Math.round(angle)}°`)
    }

    // 오른쪽 손목 각도
    if (rightElbow && rightWrist && rightShoulder) {
      const angle = calculateAngle(
        { x: rightElbow.x, y: rightElbow.y },
        { x: rightWrist.x, y: rightWrist.y },
        { x: rightShoulder.x, y: rightShoulder.y }
      )
      angles.right_wrist = Math.round(angle)
      keyValues.push(`오른손목: ${Math.round(angle)}°`)
    }

    // 왼쪽 발목 각도 (무릎-발목-엉덩이 방향 추정)
    // 발목의 각도는 무릎-발목-엉덩이의 각도로 추정 (발목의 굽힘 정도)
    if (leftKnee && leftAnkle && leftHip) {
      const angle = calculateAngle(
        { x: leftKnee.x, y: leftKnee.y },
        { x: leftAnkle.x, y: leftAnkle.y },
        { x: leftHip.x, y: leftHip.y }
      )
      angles.left_ankle = Math.round(angle)
      keyValues.push(`왼발목: ${Math.round(angle)}°`)
    }

    // 오른쪽 발목 각도
    if (rightKnee && rightAnkle && rightHip) {
      const angle = calculateAngle(
        { x: rightKnee.x, y: rightKnee.y },
        { x: rightAnkle.x, y: rightAnkle.y },
        { x: rightHip.x, y: rightHip.y }
      )
      angles.right_ankle = Math.round(angle)
      keyValues.push(`오른발목: ${Math.round(angle)}°`)
    }

    // 어깨-엉덩이 각도 (자세 판단)
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2
      const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2
      const hipMidX = (leftHip.x + rightHip.x) / 2
      const hipMidY = (leftHip.y + rightHip.y) / 2
      const verticalAngle = Math.abs(Math.atan2(hipMidY - shoulderMidY, hipMidX - shoulderMidX) * 180 / Math.PI)
      angles.torso_angle = Math.round(verticalAngle)
      keyValues.push(`상체각도: ${Math.round(verticalAngle)}°`)
    }

    // 자세 판단
    const leftHipY = leftHip?.y || 0
    const rightHipY = rightHip?.y || 0
    const avgHipY = (leftHipY + rightHipY) / 2
    const noseY = nose?.y || 0

    if (noseY < avgHipY - 0.1) {
      descriptions.push('일어서기')
      keyValues.push('자세: 서있음')
    } else if (noseY > avgHipY + 0.1) {
      descriptions.push('앉기')
      keyValues.push('자세: 앉음')
    } else {
      keyValues.push('자세: 중립')
    }

    return {
      angles,
      description: descriptions.join(', ') || '자세 인식 중',
      keyValues,
    }
  }

  // 이미지 캡처 (canvas에서)
  const captureImage = (): string => {
    if (!canvasRef.current || !videoRef.current) return ''
    
    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return ''
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }

  // 실시간 포즈 인식 (오버레이용)
  const detectPoseRealtime = useCallback(async () => {
    if (!videoRef.current || !poseDetectionService.getInitialized()) return
    
    // 비디오가 준비되지 않았으면 스킵
    if (videoRef.current.readyState < 2) return // HAVE_CURRENT_DATA 이상이어야 함

    try {
      const poses = await poseDetectionService.detectPose(videoRef.current)
      setCurrentPoses(poses)
    } catch (error) {
      // 에러는 로그만 남기고 무시 (너무 많은 에러 로그 방지)
      if (error instanceof Error && !error.message.includes('back resource')) {
        console.error('포즈 인식 실패:', error)
      }
    }
  }, [])

  // 포즈 캡처 및 저장
  const capturePose = useCallback(async () => {
    if (!videoRef.current || !poseDetectionService.getInitialized()) return
    
    // 비디오가 준비되지 않았으면 스킵
    if (videoRef.current.readyState < 2) return // HAVE_CURRENT_DATA 이상이어야 함

    try {
      const poses = await poseDetectionService.detectPose(videoRef.current)
      if (poses.length > 0) {
        const pose = poses[0]
        const { angles, description, keyValues } = analyzePose(pose)
        const image = captureImage()

        // 유지 시간 계산 (현재 설정된 타이머 값)
        const holdDuration = minutes * 60 + seconds
        
        const poseData: ExerciseVideoPose = {
          timestamp: Date.now(),
          image,
          keypoints: pose.keypoints.map(kp => ({
            x: kp.x,
            y: kp.y,
            z: kp.z,
            score: kp.score,
            name: kp.name,
          })),
          angles,
          description: `${description} | ${keyValues.join(', ')} | 유지시간: ${holdDuration}초`, // 핵심 값 및 유지시간 포함
        }

        setCapturedPoses(prev => [...prev, poseData])
      }
    } catch (error) {
      // 에러는 로그만 남기고 무시 (너무 많은 에러 로그 방지)
      if (error instanceof Error && !error.message.includes('back resource')) {
        console.error('포즈 캡처 실패:', error)
      }
    }
  }, [])

  // 카운트다운 음성 출력
  const speakCountdown = (count: number) => {
    if ('speechSynthesis' in window) {
      // 이전 음성 취소
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(count.toString())
      utterance.lang = 'ko-KR'
      utterance.rate = 0.8
      speechSynthesis.speak(utterance)
    }
  }

  // 모든 인터벌 정리 함수
  const cleanupAll = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (poseDetectionIntervalRef.current) {
      clearInterval(poseDetectionIntervalRef.current)
      poseDetectionIntervalRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (poseCaptureIntervalRef.current) {
      clearInterval(poseCaptureIntervalRef.current)
      poseCaptureIntervalRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    // handleStop을 호출하는 setTimeout도 정리
    if (handleStopTimeoutRef.current) {
      clearTimeout(handleStopTimeoutRef.current)
      handleStopTimeoutRef.current = null
    }
    // 음성 취소
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    setCountdown(null)
    setIsRecording(false)
    setCurrentPoses([])
    stopCamera()
  }

  // 녹화 시작
  const handleStart = async () => {
    // 중복 호출 방지 플래그 리셋
    isStoppingRef.current = false
    
    const totalSeconds = minutes * 60 + seconds
    if (totalSeconds <= 0) {
      alert('타이머를 설정해주세요.')
      return
    }

    await startCamera()
    setCapturedPoses([])
    setCountdown(10) // 10초 준비 카운트다운 시작

    // 첫 카운트다운 음성 및 사운드 즉시 출력 (10)
    speakCountdown(10)
    audioService.playCountSound(10)

    // 준비 카운트다운
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          // 카운트다운 종료
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          
          // "시작" 음성 출력
          if ('speechSynthesis' in window) {
            speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance('시작')
            utterance.lang = 'ko-KR'
            speechSynthesis.speak(utterance)
          }
          
          // 실제 녹화 시작
          setIsRecording(true)
          setTimeRemaining(totalSeconds)

          // 첫 포즈 캡처 즉시 실행
          capturePose()

          // 타이머 카운트다운 (1초마다 정확히 감소)
          // 기존 interval이 있으면 먼저 정리
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          intervalRef.current = setInterval(() => {
            setTimeRemaining(prev => {
              // prev가 이미 0 이하이면 더 이상 감소하지 않음
              if (prev <= 0) {
                return 0
              }
              if (prev <= 1) {
                // 인터벌 정리
                if (intervalRef.current) {
                  clearInterval(intervalRef.current)
                  intervalRef.current = null
                }
                // 마지막 포즈 캡처 실행 (타이머 종료 직전)
                capturePose()
                // handleStop 호출 (한 번만 실행되도록 플래그로 보호)
                // 기존 timeout이 있으면 정리
                if (handleStopTimeoutRef.current) {
                  clearTimeout(handleStopTimeoutRef.current)
                  handleStopTimeoutRef.current = null
                }
                handleStopTimeoutRef.current = setTimeout(() => {
                  handleStopTimeoutRef.current = null
                  if (!isStoppingRef.current) {
                    handleStop()
                  }
                }, 100) // 포즈 캡처 완료를 위해 약간의 지연
                return 0
              }
              // 1초씩 정확히 감소
              return prev - 1
            })
          }, 1000)

          // 포즈 캡처 (2초마다, 첫 실행은 이미 했으므로 2초 후부터)
          poseCaptureIntervalRef.current = setInterval(() => {
            capturePose()
          }, 2000)

          // 실시간 포즈 인식 (오버레이용, 30fps)
          poseDetectionIntervalRef.current = setInterval(() => {
            detectPoseRealtime()
          }, 33) // 약 30fps

          return null
        }
        
        // 다음 카운트다운 값으로 음성 및 사운드 출력 (prev - 1이 다음에 표시될 값)
        const nextCount = prev - 1
        speakCountdown(nextCount)
        audioService.playCountSound(nextCount)
        
        return nextCount
      })
    }, 1000)
  }

  // 녹화 중지
  const handleStop = () => {
    // 중복 호출 방지
    if (isStoppingRef.current) {
      return
    }
    isStoppingRef.current = true
    
    // 먼저 모든 인터벌 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (poseCaptureIntervalRef.current) {
      clearInterval(poseCaptureIntervalRef.current)
      poseCaptureIntervalRef.current = null
    }
    if (poseDetectionIntervalRef.current) {
      clearInterval(poseDetectionIntervalRef.current)
      poseDetectionIntervalRef.current = null
    }
    
    cleanupAll()
    
    // "인식 끝" 음성 출력 (한 번만)
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance('인식 끝')
      utterance.lang = 'ko-KR'
      utterance.rate = 0.8
      // 플래그 리셋은 재실행 시에만 수행
      speechSynthesis.speak(utterance)
    }
    
    // 끝나는 효과음 (팡파레 사운드) - 한 번만
    audioService.playFanfareSound()
    
    // 결과 화면 표시
    setShowResults(true)
  }

  // 완료 처리
  const handleConfirm = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    // 선택된 포즈 필터링 (1개만)
    const selectedPoses = capturedPoses.filter((_, index) => selectedPoseIndices.has(index))

    if (selectedPoses.length === 0) {
      alert('저장할 포즈를 선택해주세요.')
      return
    }

    if (selectedPoses.length > 1) {
      alert('포즈는 1개만 선택할 수 있습니다.')
      return
    }

    try {
      const totalSeconds = minutes * 60 + seconds
      console.log('저장 시작:', { title, poseCount: selectedPoses.length, totalSeconds })
      
      // 저장 시 음성 메시지 출력: "ㅇㅇㅇ운동을 등록합니다."
      const trimmedTitle = title.trim()
      if ('speechSynthesis' in window && trimmedTitle) {
        speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(`${trimmedTitle}운동을 등록합니다.`)
        utterance.lang = 'ko-KR'
        utterance.rate = 0.8
        speechSynthesis.speak(utterance)
      }
      
      await onComplete({
        title: trimmedTitle,
        description: description.trim() || undefined,
        poseData: selectedPoses,
        totalPoses: selectedPoses.length,
        durationSeconds: totalSeconds,
      })
      
      console.log('저장 완료')
      
      // 저장 완료 후 결과 화면 닫기
      setShowResults(false)
      setTitle('')
      setDescription('')
      setCapturedPoses([])
      setSelectedPoseIndices(new Set())
      setCurrentSlideIndex(0)
    } catch (error) {
      console.error('저장 중 오류:', error)
      alert('저장 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  // 포즈 선택/해제 토글 (1개만 선택 가능)
  const togglePoseSelection = (index: number) => {
    setSelectedPoseIndices(prev => {
      const newSet = new Set<number>()
      // 이미 선택된 포즈를 다시 클릭하면 해제, 아니면 새로 선택 (1개만)
      if (prev.has(index)) {
        // 해제
        return newSet
      } else {
        // 새로 선택 (기존 선택 해제)
        newSet.add(index)
        return newSet
      }
    })
  }

  // 포맷된 시간 표시
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="bg-gray-800/90 rounded-2xl p-6 text-white">
      {!showResults ? (
        <>
          <h2 className="text-2xl font-bold mb-4">📊 포즈분석저장</h2>
          
          {/* 유지 시간 설정 */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">유지 시간</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="59"
                step="1"
                value={minutes}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setMinutes(0)
                    return
                  }
                  const numVal = parseInt(val, 10)
                  if (!isNaN(numVal)) {
                    setMinutes(Math.max(0, Math.min(59, numVal)))
                  }
                }}
                disabled={isRecording}
                className="w-20 px-3 py-2 bg-gray-700 rounded-lg text-center"
                placeholder="분"
              />
              <span className="text-xl">:</span>
              <input
                type="number"
                min="0"
                max="59"
                step="1"
                value={seconds}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setSeconds(0)
                    return
                  }
                  const numVal = parseInt(val, 10)
                  if (!isNaN(numVal)) {
                    setSeconds(Math.max(0, Math.min(59, numVal)))
                  }
                }}
                disabled={isRecording}
                className="w-20 px-3 py-2 bg-gray-700 rounded-lg text-center"
                placeholder="초"
              />
            </div>
            <div className="mt-2 text-sm text-gray-400">
              설정된 유지 시간: {formatTime(minutes * 60 + seconds)}
            </div>
          </div>

          {/* 카메라 미리보기 */}
          <div className="mb-6">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: '640px', aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {/* 포즈 인식 오버레이 */}
              {videoRef.current && videoRef.current.videoWidth > 0 && currentPoses.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <PoseCanvas
                    poses={currentPoses}
                    videoWidth={videoRef.current.videoWidth}
                    videoHeight={videoRef.current.videoHeight}
                    canvasWidth={videoRef.current.clientWidth}
                    canvasHeight={videoRef.current.clientHeight}
                  />
                </div>
              )}
              {/* 카운트다운 표시 */}
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                  <div className="text-white text-center">
                    <div className="text-8xl font-bold mb-4 animate-pulse">{countdown}</div>
                    <div className="text-xl">준비하세요</div>
                  </div>
                </div>
              )}
              {isRecording && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-lg font-bold">
                  ⏱️ {formatTime(timeRemaining)}
                </div>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 justify-center">
            {!isRecording ? (
              <button
                onClick={handleStart}
                disabled={minutes === 0 && seconds === 0}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                시작
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
              >
                중지
              </button>
            )}
            <button
              onClick={() => {
                cleanupAll()
                onCancel()
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
            >
              취소
            </button>
          </div>

          {/* 캡처된 포즈 수 표시 */}
          {isRecording && (
            <div className="mt-4 text-sm text-gray-400">
              캡처된 포즈: {capturedPoses.length}개
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">📊 인식 결과</h2>
          
          {/* 제목 및 설명 입력 */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg"
              placeholder="영상 제목을 입력하세요"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg"
              rows={3}
              placeholder="영상 설명을 입력하세요 (선택사항)"
            />
          </div>

          {/* 선택된 포즈 표시 */}
          {selectedPoseIndices.size > 0 && (
            <div className="mb-4">
              <div className="text-lg font-semibold text-blue-400">
                선택된 포즈: {Array.from(selectedPoseIndices)[0] + 1}번째 포즈
              </div>
            </div>
          )}

          {/* 포즈 슬라이드 */}
          {capturedPoses.length > 0 && (
            <div className="mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="mb-4 relative inline-block w-full max-w-md mx-auto">
                  <div className="relative">
                    <img
                      ref={poseImageRef}
                      src={capturedPoses[currentSlideIndex]?.image}
                      alt={`포즈 ${currentSlideIndex + 1}`}
                      className="w-full rounded-lg"
                      onLoad={() => {
                        if (poseImageRef.current) {
                          setPoseImageSize({
                            width: poseImageRef.current.naturalWidth,
                            height: poseImageRef.current.naturalHeight,
                          })
                        }
                      }}
                    />
                    {capturedPoses[currentSlideIndex]?.keypoints && 
                     poseImageSize && 
                     poseImageRef.current && (
                      <PoseCanvas
                        poses={[{
                          keypoints: capturedPoses[currentSlideIndex].keypoints.map(kp => ({
                            x: kp.x,
                            y: kp.y,
                            z: kp.z,
                            score: kp.score ?? 1.0,
                            name: kp.name,
                          })),
                        }]}
                        videoWidth={poseImageSize.width}
                        videoHeight={poseImageSize.height}
                        canvasWidth={poseImageRef.current.clientWidth}
                        canvasHeight={poseImageRef.current.clientHeight}
                      />
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">관절 인식 값:</div>
                  <div className="bg-gray-800 rounded p-2 text-xs font-mono">
                    {Object.entries(capturedPoses[currentSlideIndex]?.angles || {}).map(([key, value]) => (
                      <div key={key} className="mb-1">
                        {key}: {value}도
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">핵심 포즈 설명:</div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="mb-2">{capturedPoses[currentSlideIndex]?.description?.split(' | ')[0] || '설명 없음'}</div>
                    {capturedPoses[currentSlideIndex]?.description?.includes(' | ') && (
                      <>
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">포즈 인식 핵심 값:</div>
                          <div className="text-xs text-gray-300">
                            {capturedPoses[currentSlideIndex]?.description?.split(' | ')[1]?.split(', ').map((value, idx) => (
                              <div key={idx} className="mb-1">{value}</div>
                            ))}
                          </div>
                        </div>
                        {capturedPoses[currentSlideIndex]?.description?.split(' | ')[2] && (
                          <div className="mt-2 pt-2 border-t border-gray-700">
                            <div className="text-xs text-gray-400 mb-1">평가 항목:</div>
                            <div className="text-xs text-yellow-300 font-semibold">
                              {capturedPoses[currentSlideIndex]?.description?.split(' | ')[2]}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 포즈 선택 버튼 */}
                <div className="mb-4 flex justify-center">
                  <button
                    onClick={() => togglePoseSelection(currentSlideIndex)}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                      selectedPoseIndices.has(currentSlideIndex)
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    {selectedPoseIndices.has(currentSlideIndex) ? '✓ 포즈 선택됨' : '포즈 선택'}
                  </button>
                </div>

                {/* 슬라이드 네비게이션 */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <div className="text-sm text-gray-400">
                    {currentSlideIndex + 1} / {capturedPoses.length}
                  </div>
                  <button
                    onClick={() => setCurrentSlideIndex(prev => Math.min(capturedPoses.length - 1, prev + 1))}
                    disabled={currentSlideIndex === capturedPoses.length - 1}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleConfirm}
              disabled={!title.trim() || selectedPoseIndices.size === 0}
              className="px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              저장
            </button>
            <button
              onClick={async () => {
                // 0단계: "재실행합니다" 음성 및 효과음 출력 (가장 먼저)
                if ('speechSynthesis' in window) {
                  speechSynthesis.cancel() // 기존 음성 취소
                  const utterance = new SpeechSynthesisUtterance('재실행합니다')
                  utterance.lang = 'ko-KR'
                  utterance.rate = 0.8
                  speechSynthesis.speak(utterance)
                }
                audioService.playFanfareSound() // 효과음 출력
                
                // 1단계: handleStop이 호출되지 않도록 플래그 설정 (가장 먼저)
                isStoppingRef.current = true
                
                // 2단계: handleStop을 호출하는 setTimeout 정리 (가장 중요!)
                if (handleStopTimeoutRef.current) {
                  clearTimeout(handleStopTimeoutRef.current)
                  handleStopTimeoutRef.current = null
                }
                
                // 3단계: 모든 인터벌과 애니메이션 프레임 정리 (handleStop 호출 없이)
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                }
                if (poseDetectionIntervalRef.current) {
                  clearInterval(poseDetectionIntervalRef.current)
                  poseDetectionIntervalRef.current = null
                }
                if (intervalRef.current) {
                  clearInterval(intervalRef.current)
                  intervalRef.current = null
                }
                if (poseCaptureIntervalRef.current) {
                  clearInterval(poseCaptureIntervalRef.current)
                  poseCaptureIntervalRef.current = null
                }
                if (animationFrameRef.current) {
                  cancelAnimationFrame(animationFrameRef.current)
                  animationFrameRef.current = null
                }
                
                // 3단계: 카메라 완전히 중지
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop())
                  streamRef.current = null
                }
                if (videoRef.current) {
                  videoRef.current.srcObject = null
                  videoRef.current.pause()
                }
                
                // 4단계: 음성 완전히 취소 (여러 번 호출하여 확실히 취소)
                // "재실행합니다" 음성은 이미 출력했으므로, 이후에 나오는 "인식 끝" 음성을 방지하기 위해
                // 약간의 지연 후 다시 취소 (하지만 "재실행합니다"는 이미 출력됨)
                await new Promise(resolve => setTimeout(resolve, 100))
                if ('speechSynthesis' in window) {
                  speechSynthesis.cancel()
                }
                
                // 5단계: 모든 상태 완전 초기화 (초기값으로 리셋 - 추가 버튼 클릭 시와 동일)
                setTitle('')
                setDescription('')
                setCapturedPoses([])
                setCurrentSlideIndex(0)
                setCountdown(null)
                setIsRecording(false)
                setTimeRemaining(0)
                setCurrentPoses([])
                setPoseImageSize(null)
                setSelectedPoseIndices(new Set())
                setMinutes(0)
                setSeconds(8) // 초기값으로 리셋 (유지 시간)
                
                // 6단계: 결과 화면 닫기 (초기 화면으로 돌아가기)
                // 하지만 먼저 플래그를 유지하여 handleStop이 호출되지 않도록 함
                setShowResults(false)
                
                // 7단계: 카메라 정리 완료 대기 (충분한 시간 확보)
                // handleStopTimeoutRef가 정리되었지만, 혹시 모를 비동기 호출을 방지하기 위해 충분한 대기
                await new Promise(resolve => setTimeout(resolve, 800))
                
                // 8단계: 플래그 리셋 (이제 새로운 시작을 위해)
                // 충분한 시간이 지난 후에만 리셋하여 handleStop이 호출되지 않도록 함
                isStoppingRef.current = false
                
                // 9단계: 추가 버튼 클릭 시와 동일하게 초기 상태로 복원
                // 컴포넌트가 처음 마운트될 때처럼 카메라를 자동으로 시작하지 않고,
                // 사용자가 "시작" 버튼을 클릭할 수 있도록 대기 상태로 둡니다.
                // (카메라는 사용자가 "시작" 버튼을 클릭할 때 handleStart에서 시작됩니다)
              }}
              className="px-4 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-semibold"
            >
              재실행
            </button>
            <button
              onClick={() => {
                cleanupAll()
                onCancel()
              }}
              className="px-4 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-semibold"
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ExerciseVideoRegistration

