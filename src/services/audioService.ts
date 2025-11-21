import { Howl } from 'howler'
import { AudioConfig } from '@/types'

class AudioService {
  private config: AudioConfig = {
    enabled: true,
    volume: 1.0,
    voiceType: 'female',
    backgroundMusic: 1, // 기본 배경음악 1번
  }

  private sounds: Map<string, Howl> = new Map()
  private backgroundMusic: Howl | null = null
  private backgroundMusicId: number | null = null // 재생 중인 배경음악의 Howl ID
  private currentBackgroundMusicId: number | null = null
  private previewMusic: Howl | null = null // 미리듣기용 음악
  private previewMusicId: number | null = null // 미리듣기 Howl ID
  private webAudioInterval: NodeJS.Timeout | null = null // Web Audio API로 생성한 음악의 interval
  private webAudioContext: AudioContext | null = null // Web Audio API 컨텍스트

  setConfig(config: Partial<AudioConfig>): void {
    const oldVolume = this.config.volume
    this.config = { ...this.config, ...config }
    
    // 볼륨이 변경된 경우, 재생 중인 모든 오디오의 볼륨 업데이트
    if (config.volume !== undefined && config.volume !== oldVolume) {
      // 배경음악 볼륨 업데이트
      if (this.backgroundMusic && this.backgroundMusicId !== null) {
        try {
          // 배경음악은 전체 볼륨의 50%로 설정
          this.backgroundMusic.volume(config.volume * 0.5, this.backgroundMusicId)
        } catch (e) {
          console.warn('배경음악 볼륨 업데이트 중 오류:', e)
        }
      }
      
      // 미리듣기 볼륨 업데이트
      if (this.previewMusic && this.previewMusicId !== null) {
        try {
          this.previewMusic.volume(config.volume * 0.5, this.previewMusicId)
        } catch (e) {
          console.warn('미리듣기 볼륨 업데이트 중 오류:', e)
        }
      }
      
      // 모든 효과음 볼륨 업데이트
      this.sounds.forEach((sound) => {
        try {
          sound.volume(config.volume ?? 1.0)
        } catch (e) {
          console.warn('효과음 볼륨 업데이트 중 오류:', e)
        }
      })
      
      // Web Audio API로 생성한 배경음악의 경우, config.volume이 다음 음표 재생 시 적용됨
      // (이미 재생 중인 음표는 변경할 수 없지만, 다음 음표부터 새 볼륨이 적용됨)
    }
  }

  getConfig(): AudioConfig {
    return { ...this.config }
  }

  // 음성 합성 (TTS)
  speak(text: string): void {
    if (!this.config.enabled) return

    if ('speechSynthesis' in window) {
      // 이전 음성 취소 (중복 방지)
      speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ko-KR'
      utterance.volume = this.config.volume
      
      // 음성 타입 설정 (더 정확한 매칭)
      const setVoice = () => {
        const voices = speechSynthesis.getVoices()
        if (voices.length === 0) {
          // voices가 아직 로드되지 않았으면 재시도
          setTimeout(setVoice, 100)
          return
        }
        
        let koreanVoice = null
        
        if (this.config.voiceType === 'male') {
          // 남성 음성 찾기 (여러 패턴 시도)
          koreanVoice = voices.find((voice) => 
            voice.lang.startsWith('ko') && (
              voice.name.includes('남') || 
              voice.name.includes('Male') || 
              voice.name.includes('male') ||
              voice.name.toLowerCase().includes('yuna') === false // Yuna는 여성
            )
          ) || voices.find((voice) => voice.lang.startsWith('ko'))
        } else {
          // 여성 음성 찾기
          koreanVoice = voices.find((voice) => 
            voice.lang.startsWith('ko') && (
              voice.name.includes('여') || 
              voice.name.includes('Female') || 
              voice.name.includes('female') ||
              voice.name.includes('Yuna')
            )
          ) || voices.find((voice) => voice.lang.startsWith('ko'))
        }
        
        if (koreanVoice) {
          utterance.voice = koreanVoice
        }
        
        speechSynthesis.speak(utterance)
      }
      
      // voices 로드 대기
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = setVoice
      } else {
        setVoice()
      }
    }
  }

  // 효과음 재생
  playSound(soundName: string, volume?: number): void {
    if (!this.config.enabled) return

    const sound = this.sounds.get(soundName)
    if (sound) {
      sound.volume(volume ?? this.config.volume)
      sound.play()
    }
  }

  // 효과음 로드
  loadSound(name: string, src: string): void {
    const sound = new Howl({
      src: [src],
      volume: this.config.volume,
    })
    this.sounds.set(name, sound)
  }

  stopAll(): void {
    // 배경음악 먼저 정지 (가장 중요)
    this.stopBackgroundMusic()
    
    // 미리듣기 정지
    this.stopPreview()
    
    // 모든 효과음 정지
    this.sounds.forEach((sound) => {
      try {
        sound.stop()
        sound.unload()
      } catch (e) {
        console.warn('효과음 정지 중 오류:', e)
      }
    })
    this.sounds.clear()
    
    // 음성 합성 취소
    speechSynthesis.cancel()
    
    // 추가 안전장치: 모든 Howl 인스턴스 강제 정지
    try {
      // Howl의 모든 재생 중인 사운드 강제 정지
      if (typeof window !== 'undefined' && (window as any).Howl) {
        const HowlClass = (window as any).Howl
        // Howl의 내부 인스턴스 목록에 접근하여 모두 정지
        if (HowlClass._howls && Array.isArray(HowlClass._howls)) {
          HowlClass._howls.forEach((howl: any) => {
            try {
              if (howl && typeof howl.stop === 'function') {
                howl.stop()
              }
              if (howl && typeof howl.unload === 'function') {
                howl.unload()
              }
            } catch (e) {
              // 개별 인스턴스 정지 실패는 무시
            }
          })
          // 인스턴스 목록 초기화
          HowlClass._howls = []
        }
      }
    } catch (e) {
      console.warn('전역 오디오 정지 중 오류:', e)
    }
  }

  // 배경음악 재생
  playBackgroundMusic(musicId: number = 1, preview: boolean = false): void {
    if (!this.config.enabled && !preview) return

    // 미리듣기인 경우 기존 미리듣기 정지
    if (preview) {
      this.stopPreview()
    }

    // 기존 배경음악 정지 (미리듣기가 아닐 때만)
    if (!preview) {
      // 강제로 모든 배경음악 정지
      this.stopBackgroundMusic()
    }

    // 배경음악 파일 경로 (bgm 폴더에 있음)
    const musicFiles = [
      '/bgm/bgm1.mp3', // 활기찬 게임 음악
      '/bgm/bgm2.mp3', // 동기부여 음악
      '/bgm/bgm3.mp3', // 에너지 넘치는 음악
      '/bgm/bgm4.mp3', // 재미있는 음악
      '/bgm/bgm5.mp3', // 힘찬 음악
      '/bgm/bgm6.mp3', // 추가 배경음악
    ]

    if (musicId >= 1 && musicId <= 6) {
      const music = new Howl({
        src: [musicFiles[musicId - 1]],
        loop: !preview, // 미리듣기는 반복 안함
        volume: this.config.volume * 0.5, // 배경음악은 조금 낮게
        html5: true, // HTML5 오디오 사용
        onloaderror: () => {
          // 파일이 없으면 Web Audio API로 간단한 배경음악 생성
          console.warn(`배경음악 파일을 찾을 수 없습니다: ${musicFiles[musicId - 1]}, Web Audio API로 생성합니다.`)
          this.createBackgroundMusicWithWebAudio(musicId, preview)
        },
        onload: () => {
          // 파일 로드 성공
          // 모바일 환경에서 AudioContext가 suspended 상태일 수 있으므로 resume 처리
          const resumeAudioContext = async () => {
            try {
              // Howl이 내부적으로 사용하는 AudioContext에 접근
              const howlContext = (music as any)._sounds?.[0]?._node?.context
              if (howlContext && howlContext.state === 'suspended') {
                await howlContext.resume()
                console.log('AudioContext resumed for background music')
              }
            } catch (e) {
              console.warn('AudioContext resume 실패:', e)
            }
          }

          if (preview) {
            // 미리듣기는 5초 재생 후 정지
            this.previewMusic = music
            resumeAudioContext().then(() => {
              const id = music.play()
              this.previewMusicId = id
              setTimeout(() => {
                if (this.previewMusic === music && this.previewMusicId === id) {
                  music.stop(id)
                  this.previewMusic = null
                  this.previewMusicId = null
                }
              }, 5000)
            }).catch((e) => {
              console.warn('미리듣기 재생 실패:', e)
              // 실패해도 재생 시도
              const id = music.play()
              this.previewMusicId = id
            })
          } else {
            this.backgroundMusic = music
            this.currentBackgroundMusicId = musicId
            resumeAudioContext().then(() => {
              const id = music.play()
              this.backgroundMusicId = id
            }).catch((e) => {
              console.warn('배경음악 재생 실패:', e)
              // 실패해도 재생 시도
              const id = music.play()
              this.backgroundMusicId = id
            })
          }
        },
      })

      // 로드 시작 (파일이 없어도 시도)
      try {
        music.load()
      } catch (e) {
        // 로드 실패 시 Web Audio API로 생성
        console.warn('배경음악 로드 실패, Web Audio API로 생성합니다.')
        this.createBackgroundMusicWithWebAudio(musicId, preview)
      }
    }
  }

  // Web Audio API로 배경음악 생성 (파일이 없을 때)
  private createBackgroundMusicWithWebAudio(musicId: number, preview: boolean): void {
    try {
      // 기존 Web Audio 정지
      if (this.webAudioInterval) {
        clearInterval(this.webAudioInterval)
        this.webAudioInterval = null
      }
      if (this.webAudioContext) {
        this.webAudioContext.close().catch(() => {})
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.webAudioContext = audioContext
      
      // 모바일 환경에서 AudioContext가 suspended 상태일 수 있으므로 resume 처리
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Web Audio Context resumed for background music')
        }).catch((e) => {
          console.warn('Web Audio Context resume 실패:', e)
        })
      }
      
      // 더 완전한 멜로디 생성 (각 음악마다 다른 패턴과 리듬)
      const musicPatterns = [
        // 1번: 활기찬 게임 음악 (C major scale 기반)
        {
          melody: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25], // C, D, E, F, G, A, B, C
          rhythm: [0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.4], // 각 음의 길이
          tempo: 400, // 밀리초
        },
        // 2번: 동기부여 음악 (A minor scale)
        {
          melody: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00], // A, B, C, D, E, F, G, A
          rhythm: [0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.5],
          tempo: 450,
        },
        // 3번: 에너지 넘치는 음악 (E major scale)
        {
          melody: [329.63, 369.99, 415.30, 466.16, 523.25, 587.33, 659.25, 698.46], // E, F#, G#, A, B, C#, D#, E
          rhythm: [0.25, 0.25, 0.3, 0.25, 0.25, 0.3, 0.25, 0.4],
          tempo: 350,
        },
        // 4번: 재미있는 음악 (G major scale)
        {
          melody: [392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 739.99, 783.99], // G, A, B, C, D, E, F#, G
          rhythm: [0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.4],
          tempo: 380,
        },
        // 5번: 힘찬 음악 (D major scale)
        {
          melody: [293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 554.37, 587.33], // D, E, F#, G, A, B, C#, D
          rhythm: [0.35, 0.3, 0.35, 0.3, 0.35, 0.3, 0.35, 0.5],
          tempo: 420,
        },
        // 6번: 추가 배경음악 (F major scale)
        {
          melody: [349.23, 392.00, 440.00, 466.16, 523.25, 587.33, 659.25, 698.46], // F, G, A, A#, B, C, D, E
          rhythm: [0.3, 0.25, 0.3, 0.25, 0.3, 0.25, 0.3, 0.4],
          tempo: 400,
        },
      ]

      const pattern = musicPatterns[musicId - 1]
      let noteIndex = 0
      let beatCount = 0

      const playNote = () => {
        if (noteIndex >= pattern.melody.length) {
          noteIndex = 0
          beatCount++
          if (preview && beatCount >= 2) {
            // 미리듣기는 2바퀴만
            if (this.webAudioInterval) {
              clearInterval(this.webAudioInterval)
              this.webAudioInterval = null
            }
            return
          }
        }

        const freq = pattern.melody[noteIndex]
        const duration = pattern.rhythm[noteIndex]

        // 메인 멜로디
        const oscillator1 = audioContext.createOscillator()
        const gainNode1 = audioContext.createGain()

        oscillator1.connect(gainNode1)
        gainNode1.connect(audioContext.destination)

        oscillator1.frequency.value = freq
        oscillator1.type = 'sine'
        gainNode1.gain.setValueAtTime(0.08 * this.config.volume, audioContext.currentTime)
        gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

        oscillator1.start(audioContext.currentTime)
        oscillator1.stop(audioContext.currentTime + duration)

        // 하모니 추가 (옥타브 아래)
        if (noteIndex % 2 === 0) {
          const oscillator2 = audioContext.createOscillator()
          const gainNode2 = audioContext.createGain()

          oscillator2.connect(gainNode2)
          gainNode2.connect(audioContext.destination)

          oscillator2.frequency.value = freq * 0.5
          oscillator2.type = 'triangle'
          gainNode2.gain.setValueAtTime(0.03 * this.config.volume, audioContext.currentTime)
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

          oscillator2.start(audioContext.currentTime)
          oscillator2.stop(audioContext.currentTime + duration)
        }

        noteIndex++
      }

      // 첫 음 재생
      playNote()

      // 반복 재생 (미리듣기가 아닐 때만)
      if (!preview) {
        this.webAudioInterval = setInterval(playNote, pattern.tempo)
      } else {
        // 미리듣기는 5초 후 정지 (더 길게)
        this.webAudioInterval = setInterval(playNote, pattern.tempo)
        setTimeout(() => {
          if (this.webAudioInterval) {
            clearInterval(this.webAudioInterval)
            this.webAudioInterval = null
          }
        }, 5000)
      }
    } catch (e) {
      console.error('Web Audio API로 배경음악 생성 실패:', e)
    }
  }

  // 배경음악 정지
  stopBackgroundMusic(): void {
    // Howl 인스턴스가 있으면 강제로 정지
    if (this.backgroundMusic) {
      try {
        // 모든 재생 중인 사운드 정지
        if (this.backgroundMusicId !== null) {
          this.backgroundMusic.stop(this.backgroundMusicId)
        }
        // 모든 재생 중인 사운드 강제 정지 (안전장치)
        this.backgroundMusic.stop()
        
        // 리소스 해제
        this.backgroundMusic.unload()
      } catch (e) {
        console.warn('배경음악 정지 중 오류:', e)
      } finally {
        this.backgroundMusic = null
        this.backgroundMusicId = null
        this.currentBackgroundMusicId = null
      }
    }
    
    // Web Audio API로 생성한 음악도 정지
    if (this.webAudioInterval) {
      clearInterval(this.webAudioInterval)
      this.webAudioInterval = null
    }
    
    if (this.webAudioContext) {
      try {
        this.webAudioContext.close().catch(() => {})
      } catch (e) {
        console.warn('Web Audio Context 종료 중 오류:', e)
      } finally {
        this.webAudioContext = null
      }
    }
  }

  // 미리듣기 정지
  stopPreview(): void {
    if (this.previewMusic) {
      // 모든 재생 중인 미리듣기 정지
      if (this.previewMusicId !== null) {
        this.previewMusic.stop(this.previewMusicId)
      } else {
        this.previewMusic.stop()
      }
      this.previewMusic.unload() // 리소스 해제
      this.previewMusic = null
      this.previewMusicId = null
    }
  }

  // 배경음악 일시정지
  pauseBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause()
    }
  }

  // 배경음악 재개
  resumeBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.play()
    }
  }

  // 카운트 사운드 (딩동)
  playCountSound(count: number): void {
    if (!this.config.enabled) return

    // 딩동 사운드 (간단한 beep 사운드)
    // 실제로는 오디오 파일이 필요하지만, 여기서는 Web Audio API로 생성
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // 모바일 환경에서 AudioContext가 suspended 상태일 수 있으므로 resume 처리
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch((e) => {
        console.warn('AudioContext resume 실패:', e)
      })
    }
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800 + (count * 50) // 카운트에 따라 피치 증가
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  }

  // 팡파레 사운드 (마지막 갯수)
  playFanfareSound(): void {
    if (!this.config.enabled) return

    // 팡파레 사운드 (여러 음을 연속으로)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // 모바일 환경에서 AudioContext가 suspended 상태일 수 있으므로 resume 처리
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch((e) => {
        console.warn('AudioContext resume 실패:', e)
      })
    }
    const notes = [523.25, 659.25, 783.99, 1046.50] // C, E, G, C (도미솔도)

    notes.forEach((freq, index) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = freq
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      }, index * 150)
    })
  }

  // 에너지 효과음
  playEnergySound(): void {
    if (!this.config.enabled) return

    // 에너지가 차오르는 듯한 효과음
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // 모바일 환경에서 AudioContext가 suspended 상태일 수 있으므로 resume 처리
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch((e) => {
        console.warn('AudioContext resume 실패:', e)
      })
    }
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.5)
    oscillator.type = 'sawtooth'
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }
}

export const audioService = new AudioService()

