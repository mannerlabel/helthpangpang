import { AIAnalysis, ExerciseSession, ExerciseType } from '@/types'
import { EXERCISE_TYPES, EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { adminService } from './adminService'

class AIAnalysisService {
  private apiUrl: string
  private openaiApiKey: string | null = null
  private apiKeyCache: { key: string | null; timestamp: number } = { key: null, timestamp: 0 }
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5분 캐시

  constructor() {
    // 환경 변수에서 API URL 가져오기
    this.apiUrl = import.meta.env.VITE_AI_API_URL || ''
    // API Key는 DB에서 동적으로 가져옴
  }

  // DB에서 LLM API Key 가져오기 (캐시 사용)
  private async getApiKey(): Promise<string | null> {
    const now = Date.now()
    // 캐시가 유효하면 캐시된 키 사용
    if (this.apiKeyCache.key && (now - this.apiKeyCache.timestamp) < this.CACHE_DURATION) {
      return this.apiKeyCache.key
    }

    try {
      // DB에서 API Key 가져오기
      const apiKey = await adminService.getApiKey('llm')
      this.apiKeyCache = { key: apiKey, timestamp: now }
      return apiKey
    } catch (error) {
      console.error('LLM API Key 가져오기 실패:', error)
      // 환경 변수에서 폴백
      const envKey = import.meta.env.VITE_OPENAI_API_KEY || ''
      if (envKey) {
        this.apiKeyCache = { key: envKey, timestamp: now }
        return envKey
      }
      return null
    }
  }

  async analyzeExercise(session: ExerciseSession): Promise<AIAnalysis> {
    // OpenAI API 직접 호출
    const apiKey = await this.getApiKey()
    if (apiKey) {
      try {
        const analysis = await this.callOpenAI(session, apiKey)
        if (analysis) {
          return analysis
        }
      } catch (error) {
        console.error('OpenAI API 호출 실패:', error)
      }
    }

    // 커스텀 API URL이 있는 경우
    if (this.apiUrl) {
      try {
        const requestBody: any = {
          exerciseType: session.config.type,
          bestScore: session.bestScore,
          worstScore: session.worstScore,
          averageScore: session.averageScore,
          counts: session.counts,
        }
        
        // 조깅 세션인 경우 joggingData 추가
        const joggingData = (session as any).joggingData
        if (joggingData) {
          requestBody.joggingData = joggingData
        }
        
        const response = await fetch(`${this.apiUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        // 연결 실패는 로컬 서버가 실행되지 않았을 때 발생하는 정상적인 상황
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.log('ℹ️ 로컬 AI 분석 서버에 연결할 수 없습니다. OpenAI API 또는 기본 분석을 사용합니다.')
        } else {
          console.error('AI 분석 API 호출 실패:', error)
        }
      }
    }

    // API가 없거나 실패한 경우 기본 분석 반환
    return this.generateDefaultAnalysis(session)
  }

  private async callOpenAI(session: ExerciseSession, apiKey: string): Promise<AIAnalysis | null> {
    if (!apiKey) return null

    const joggingData = (session as any).joggingData // 조깅 세션 데이터

    // 조깅 세션인 경우
    if (session.config.type === 'jogging' && joggingData) {
      const distance = joggingData.distance || 0
      const averageSpeed = joggingData.averageSpeed || 0
      const averageTime = joggingData.averageTime || 0
      const timeInMinutes = Math.floor(averageTime / 60000)
      const timeInSeconds = Math.floor((averageTime % 60000) / 1000)

      const prompt = `조깅 분석 전문가로서 다음 조깅 데이터를 분석해주세요:

총 거리: ${distance.toFixed(2)}km
평균 속도: ${averageSpeed.toFixed(2)}km/h
총 시간: ${timeInMinutes}분 ${timeInSeconds}초

다음 형식의 JSON으로 응답해주세요:
{
  "summary": "조깅 요약 (한국어)",
  "bestPoseFeedback": "조깅 자세에 대한 피드백 (한국어)",
  "worstPoseFeedback": "개선이 필요한 부분에 대한 피드백 (한국어)",
  "averageScore": 0,
  "recommendations": ["추천사항1", "추천사항2"],
  "exerciseType": "jogging"
}`

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  '당신은 조깅 분석 전문가입니다. 조깅 거리, 속도, 시간을 분석하여 한국어로 상세한 피드백을 제공합니다.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        })

        if (!response.ok) {
          throw new Error(`OpenAI API 오류: ${response.statusText}`)
        }

        const data = await response.json()
        const content = data.choices[0]?.message?.content

        if (content) {
          const analysis = JSON.parse(content) as AIAnalysis
          return {
            ...analysis,
            exerciseType: session.config.type,
          }
        }
      } catch (error) {
        console.error('OpenAI API 호출 중 오류:', error)
      }

      return null
    }

    // 일반 운동 세션인 경우
    const exerciseName =
      session.config.type === EXERCISE_TYPES.CUSTOM
        ? session.config.customName || '커스텀 운동'
        : (EXERCISE_TYPE_NAMES[session.config.type as keyof typeof EXERCISE_TYPE_NAMES] || '운동')

    // totalCount가 있으면 사용, 없으면 counts.length 사용
    const totalCount = (session as any).totalCount || session.counts.length

    const prompt = `운동 분석 전문가로서 다음 운동 데이터를 분석해주세요:

운동 종목: ${exerciseName}
평균 점수: ${session.averageScore.toFixed(1)}점
최고 점수: ${session.bestScore?.score || 0}점
최저 점수: ${session.worstScore?.score || 0}점
총 카운트: ${totalCount}회

다음 형식의 JSON으로 응답해주세요:
{
  "summary": "운동 요약 (한국어)",
  "bestPoseFeedback": "최고 자세에 대한 피드백 (한국어)",
  "worstPoseFeedback": "최저 자세에 대한 피드백 (한국어)",
  "averageScore": ${session.averageScore},
  "recommendations": ["추천사항1", "추천사항2"],
  "exerciseType": "${session.config.type}"
}`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                '당신은 운동 분석 전문가입니다. 운동 자세와 점수를 분석하여 한국어로 상세한 피드백을 제공합니다.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API 오류: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (content) {
        const analysis = JSON.parse(content) as AIAnalysis
        return {
          ...analysis,
          exerciseType: session.config.type,
        }
      }
    } catch (error) {
      console.error('OpenAI API 호출 중 오류:', error)
    }

    return null
  }

  private generateDefaultAnalysis(session: ExerciseSession): AIAnalysis {
    const { bestScore, worstScore, averageScore, config } = session
    const joggingData = (session as any).joggingData // 조깅 세션 데이터

    // 조깅 세션인 경우
    if (config.type === 'jogging' && joggingData) {
      const distance = joggingData.distance || 0
      const averageSpeed = joggingData.averageSpeed || 0
      const averageTime = joggingData.averageTime || 0
      const timeInMinutes = Math.floor(averageTime / 60000)
      const timeInSeconds = Math.floor((averageTime % 60000) / 1000)

      const recommendations: string[] = []
      
      if (averageSpeed < 5) {
        recommendations.push('속도를 조금 더 높여보세요. 적정 속도는 6-8km/h입니다.')
      } else if (averageSpeed > 10) {
        recommendations.push('속도가 너무 빠릅니다. 지속 가능한 속도로 조깅하세요.')
      }
      
      if (distance < 1) {
        recommendations.push('거리를 조금 더 늘려보세요. 점진적으로 거리를 늘리는 것이 좋습니다.')
      }

      return {
        summary: `조깅을 완료했습니다. 총 ${distance.toFixed(2)}km를 ${timeInMinutes}분 ${timeInSeconds}초 동안 평균 ${averageSpeed.toFixed(2)}km/h의 속도로 달렸습니다.`,
        bestPoseFeedback: '조깅 자세를 유지하며 일정한 속도로 달렸습니다.',
        worstPoseFeedback: '일정한 속도와 자세를 유지하면 더 좋은 결과를 얻을 수 있습니다.',
        averageScore: averageScore || 0,
        recommendations: recommendations.length > 0
          ? recommendations
          : ['규칙적인 조깅을 계속하세요!'],
        exerciseType: config.type,
      }
    }

    // 일반 운동 세션인 경우
    const recommendations: string[] = []

    if (averageScore < 70) {
      recommendations.push('자세를 더 정확하게 유지하도록 노력하세요.')
    }
    if (bestScore && worstScore && bestScore.score - worstScore.score > 20) {
      recommendations.push('일관된 자세를 유지하도록 연습하세요.')
    }

    return {
      summary: `${config.type} 운동을 완료했습니다. 평균 점수는 ${averageScore.toFixed(1)}점입니다.`,
      bestPoseFeedback: bestScore
        ? `최고 점수 ${bestScore.score}점: 훌륭한 자세입니다!`
        : '최고 점수 데이터가 없습니다.',
      worstPoseFeedback: worstScore
        ? `최저 점수 ${worstScore.score}점: 이 자세를 개선하면 더 좋은 결과를 얻을 수 있습니다.`
        : '최저 점수 데이터가 없습니다.',
      averageScore,
      recommendations: recommendations.length > 0
        ? recommendations
        : ['계속 좋은 자세를 유지하세요!'],
      exerciseType: config.type,
    }
  }
}

export const aiAnalysisService = new AIAnalysisService()

