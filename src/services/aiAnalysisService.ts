import { AIAnalysis, ExerciseSession, ExerciseType } from '@/types'

class AIAnalysisService {
  private apiUrl: string
  private openaiApiKey: string

  constructor() {
    // 환경 변수에서 API URL 및 OpenAI API Key 가져오기
    this.apiUrl = import.meta.env.VITE_AI_API_URL || ''
    this.openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || ''
  }

  async analyzeExercise(session: ExerciseSession): Promise<AIAnalysis> {
    // OpenAI API 직접 호출
    if (this.openaiApiKey) {
      try {
        const analysis = await this.callOpenAI(session)
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
        const response = await fetch(`${this.apiUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exerciseType: session.config.type,
            bestScore: session.bestScore,
            worstScore: session.worstScore,
            averageScore: session.averageScore,
            counts: session.counts,
          }),
        })

        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.error('AI 분석 API 호출 실패:', error)
      }
    }

    // API가 없거나 실패한 경우 기본 분석 반환
    return this.generateDefaultAnalysis(session)
  }

  private async callOpenAI(session: ExerciseSession): Promise<AIAnalysis | null> {
    if (!this.openaiApiKey) return null

    const exerciseName =
      session.config.type === 'custom'
        ? session.config.customName || '커스텀 운동'
        : session.config.type === 'squat'
        ? '스쿼트'
        : session.config.type === 'pushup'
        ? '푸시업'
        : '런지'

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
          Authorization: `Bearer ${this.openaiApiKey}`,
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

