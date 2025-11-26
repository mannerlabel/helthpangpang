/**
 * 실시간 날씨 정보 서비스
 * 위치 기반 날씨 정보를 가져옵니다.
 */

import { WeatherInfo } from '@/types'
import { adminService } from './adminService'

interface WeatherAPIResponse {
  current: {
    temp_c: number
    humidity: number
    uv: number
    condition: {
      text: string
    }
  }
  location: {
    name: string
    region: string
  }
}

interface AirQualityResponse {
  data: {
    aqi: number
    city: {
      name: string
    }
  }
}

/**
 * 사용자 위치 가져오기 (Geolocation API)
 */
export async function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('⚠️ Geolocation API를 사용할 수 없습니다. 기본 위치(서울)를 사용합니다.')
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        console.warn('⚠️ 위치 정보를 가져올 수 없습니다. 기본 위치(서울)를 사용합니다.', error)
        resolve(null)
      },
      {
        timeout: 5000,
        maximumAge: 60000, // 1분 캐시
      }
    )
  })
}

/**
 * 에어코리아 API에서 대기오염 정보 가져오기
 * 한국환경공단 에어코리아 대기오염정보 활용
 */
interface AirKoreaData {
  pm10: number | null
  pm25: number | null
  o3: number | null
  pm10Grade?: string | null // 좋음, 보통, 나쁨, 매우나쁨
  pm25Grade?: string | null
  o3Grade?: string | null
}

async function getAirKoreaData(_cityName: string): Promise<AirKoreaData | null> {
  try {
    // 환경 변수에서 API Key 가져오기
    const API_KEY = import.meta.env.VITE_AIR_KOREA_API_KEY || ''
    
    if (!API_KEY) {
      console.warn('⚠️ 에어코리아 API 키가 설정되지 않았습니다.')
      return null
    }
    
    // 오늘 날짜
    const today = new Date()
    const searchDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    // PM10, PM25, O3 데이터를 각각 가져오기
    const [pm10Response, pm25Response, o3Response] = await Promise.all([
      fetch(`http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${encodeURIComponent(API_KEY)}&returnType=json&numOfRows=100&pageNo=1&searchDate=${searchDate}&InformCode=PM10`),
      fetch(`http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${encodeURIComponent(API_KEY)}&returnType=json&numOfRows=100&pageNo=1&searchDate=${searchDate}&InformCode=PM25`),
      fetch(`http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${encodeURIComponent(API_KEY)}&returnType=json&numOfRows=100&pageNo=1&searchDate=${searchDate}&InformCode=O3`)
    ])
    
    let pm10: number | null = null
    let pm25: number | null = null
    let o3: number | null = null
    let pm10Grade: string | null = null
    let pm25Grade: string | null = null
    let o3Grade: string | null = null
    
    // 등급 문자열에서 등급 추출 함수 (예: "서울: 나쁨, 제주: 나쁨" -> "나쁨")
    const extractGrade = (gradeString: string): string | null => {
      if (!gradeString) return null
      // "서울: 나쁨" 형식에서 등급 추출
      const match = gradeString.match(/:\s*(좋음|보통|나쁨|매우나쁨)/)
      if (match) return match[1]
      // 직접 등급인 경우
      if (gradeString.includes('좋음')) return '좋음'
      if (gradeString.includes('보통')) return '보통'
      if (gradeString.includes('나쁨')) return '나쁨'
      if (gradeString.includes('매우나쁨')) return '매우나쁨'
      return null
    }
    
    // 등급을 수치로 변환하는 함수
    // O3는 ppm 단위이므로 값이 작음 (예: 0.03~0.1 범위)
    const gradeToValue = (grade: string | null, type: 'pm10' | 'pm25' | 'o3'): number | null => {
      if (!grade) return null
      // 등급별 평균값 사용
      switch (grade) {
        case '좋음':
          return type === 'pm10' ? 25 : type === 'pm25' ? 10 : 0.03 // O3는 ppm 단위
        case '보통':
          return type === 'pm10' ? 75 : type === 'pm25' ? 25 : 0.06 // O3는 ppm 단위
        case '나쁨':
          return type === 'pm10' ? 125 : type === 'pm25' ? 50 : 0.1 // O3는 ppm 단위
        case '매우나쁨':
          return type === 'pm10' ? 200 : type === 'pm25' ? 100 : 0.15 // O3는 ppm 단위
        default:
          return null
      }
    }
    
    // PM10 파싱
    if (pm10Response.ok) {
      try {
        const pm10Data = await pm10Response.json()
        console.log('에어코리아 PM10 응답:', pm10Data)
        if (pm10Data.response && pm10Data.response.body) {
          // 응답이 성공인지 확인
          if (pm10Data.response.header && pm10Data.response.header.resultCode === '00') {
            if (pm10Data.response.body.items && pm10Data.response.body.items.length > 0) {
              const item = pm10Data.response.body.items[0]
              // 등급 정보 추출 (informGrade: "서울: 나쁨, 제주: 나쁨" 형식)
              if (item.informGrade) {
                pm10Grade = extractGrade(item.informGrade)
                if (pm10Grade) {
                  pm10 = gradeToValue(pm10Grade, 'pm10')
                }
              }
              // 등급이 없으면 숫자 값 추출 시도
              if (!pm10 && item.informData) {
                const match = item.informData.match(/(\d+)/)
                if (match) {
                  pm10 = parseInt(match[1])
                }
              }
            }
          } else {
            console.warn('에어코리아 PM10 API 오류:', pm10Data.response.header?.resultMsg)
          }
        }
      } catch (e) {
        console.warn('PM10 데이터 파싱 실패:', e)
      }
    } else {
      console.warn('에어코리아 PM10 API 호출 실패:', pm10Response.status, pm10Response.statusText)
    }
    
    // PM25 파싱
    if (pm25Response.ok) {
      try {
        const pm25Data = await pm25Response.json()
        console.log('에어코리아 PM25 응답:', pm25Data)
        if (pm25Data.response && pm25Data.response.body) {
          if (pm25Data.response.header && pm25Data.response.header.resultCode === '00') {
            if (pm25Data.response.body.items && pm25Data.response.body.items.length > 0) {
              const item = pm25Data.response.body.items[0]
              // 등급 정보 추출
              if (item.informGrade) {
                pm25Grade = extractGrade(item.informGrade)
                if (pm25Grade) {
                  pm25 = gradeToValue(pm25Grade, 'pm25')
                }
              }
              // 등급이 없으면 숫자 값 추출 시도
              if (!pm25 && item.informData) {
                const match = item.informData.match(/(\d+)/)
                if (match) {
                  pm25 = parseInt(match[1])
                }
              }
            }
          } else {
            console.warn('에어코리아 PM25 API 오류:', pm25Data.response.header?.resultMsg)
          }
        }
      } catch (e) {
        console.warn('PM25 데이터 파싱 실패:', e)
      }
    } else {
      console.warn('에어코리아 PM25 API 호출 실패:', pm25Response.status, pm25Response.statusText)
    }
    
    // O3 파싱
    if (o3Response.ok) {
      try {
        const o3Data = await o3Response.json()
        console.log('에어코리아 O3 응답:', o3Data)
        if (o3Data.response && o3Data.response.body) {
          if (o3Data.response.header && o3Data.response.header.resultCode === '00') {
            if (o3Data.response.body.items && o3Data.response.body.items.length > 0) {
              const item = o3Data.response.body.items[0]
              // 등급 정보 추출
              if (item.informGrade) {
                o3Grade = extractGrade(item.informGrade)
                if (o3Grade) {
                  o3 = gradeToValue(o3Grade, 'o3')
                }
              }
              // 등급이 없으면 숫자 값 추출 시도 (O3는 ppm 단위이므로 소수점 포함)
              if (!o3 && item.informData) {
                // 소수점 포함 숫자 추출 (예: "0.0360" -> 0.0360)
                const match = item.informData.match(/(\d+\.?\d*)/)
                if (match) {
                  o3 = parseFloat(match[1])
                }
              }
            }
          } else {
            console.warn('에어코리아 O3 API 오류:', o3Data.response.header?.resultMsg)
          }
        }
      } catch (e) {
        console.warn('O3 데이터 파싱 실패:', e)
      }
    } else {
      console.warn('에어코리아 O3 API 호출 실패:', o3Response.status, o3Response.statusText)
    }
    
    // 하나라도 성공하면 반환
    if (pm10 !== null || pm25 !== null || o3 !== null) {
      return { pm10, pm25, o3, pm10Grade, pm25Grade, o3Grade }
    }
    
    return null
  } catch (error) {
    console.error('에어코리아 API 호출 실패:', error)
    return null
  }
}

/**
 * 한국 주요 도시 목록 (기본 위치로 사용)
 */
const KOREAN_CITIES = [
  { name: '서울', lat: 37.5665, lng: 126.9780 },
  { name: '대전', lat: 36.3504, lng: 127.3845 },
  { name: '인천', lat: 37.4563, lng: 126.7052 },
  { name: '울산', lat: 35.5384, lng: 129.3114 },
  { name: '아산시', lat: 36.7898, lng: 127.0015 },
  { name: '천안시', lat: 36.8151, lng: 127.1139 },
]

/**
 * 위치에 가장 가까운 한국 도시 찾기
 */
function findNearestCity(lat: number, lng: number): string {
  let minDistance = Infinity
  let nearestCity = '서울'

  for (const city of KOREAN_CITIES) {
    const distance = Math.sqrt(
      Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2)
    )
    if (distance < minDistance) {
      minDistance = distance
      nearestCity = city.name
    }
  }

  return nearestCity
}

/**
 * 날씨 정보 가져오기
 * 
 * GPS 좌표를 기반으로 날씨 정보를 가져옵니다.
 * 
 * 📝 실제 API 연동 방법:
 * 1. OpenWeatherMap API 키 발급: https://openweathermap.org/api
 * 2. 관리자 페이지에서 Weather API Key 설정 또는 환경 변수에 설정
 * 
 * 대안 API:
 * - 기상청 API (공공데이터포털): https://www.data.go.kr/
 * - AccuWeather API: https://developer.accuweather.com/
 */
async function fetchWeatherData(lat: number, lon: number, cityName: string): Promise<WeatherInfo[]> {
  try {
    // ============================================
    // 실제 API 호출 코드 (환경 변수 우선, DB 폴백)
    // ============================================
    let API_KEY: string | null = null
    
    // 1. 환경 변수에서 API Key 가져오기 (우선순위)
    API_KEY = import.meta.env.VITE_WEATHER_API_KEY || ''
    
    // 2. 환경 변수에 없으면 DB에서 가져오기
    if (!API_KEY) {
      try {
        API_KEY = await adminService.getApiKey('weather')
      } catch (error) {
        console.warn('⚠️ DB에서 Weather API Key 가져오기 실패:', error)
      }
    }
    
    if (API_KEY && API_KEY !== 'YOUR_API_KEY') {
      try {
        // GPS 좌표를 직접 사용 (이미 getWeatherInfo에서 확인된 좌표)
        console.log(`📍 날씨 API 호출: ${cityName} (위도: ${lat}, 경도: ${lon})`)
        
        // 좌표 기반으로 현재 날씨, 예보, UV Index, 미세먼지를 함께 가져오기
        // 좌표 기반 호출이 더 안정적이고 정확합니다
        const apiCalls = [
          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`),
          fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
          fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
        ]
        
        const [currentResponse, forecastResponse, uvResponse, airResponse] = await Promise.all(apiCalls)
        
        // 각 API 응답 상태 확인
        if (!currentResponse.ok) {
          const errorText = await currentResponse.text()
          console.error('현재 날씨 API 오류:', currentResponse.status, errorText)
          throw new Error(`현재 날씨 API 호출 실패: ${currentResponse.status}`)
        }
        
        if (!forecastResponse.ok) {
          const errorText = await forecastResponse.text()
          console.error('예보 API 오류:', forecastResponse.status, errorText)
          throw new Error(`예보 API 호출 실패: ${forecastResponse.status}`)
        }
        
        const currentData = await currentResponse.json()
        const forecastData = await forecastResponse.json()
        
        // UV Index 데이터 파싱
        let uvIndex = 5 // 기본값
        if (uvResponse.ok) {
          try {
            const uvData = await uvResponse.json()
            if (uvData && uvData.value !== undefined) {
              uvIndex = Math.round(uvData.value)
            }
          } catch (e) {
            console.warn('UV Index 파싱 실패:', e)
          }
        }
        
        // 미세먼지 및 오존 데이터 파싱 (에어코리아 API 우선 사용)
        let pm10: number | null = null
        let pm25: number | null = null
        let o3: number | null = null
        
        // 수치 기반 등급 계산 함수 (에어코리아 기준)
        const calculateGradeFromValue = (value: number | null, type: 'pm10' | 'pm25' | 'o3'): string | null => {
          if (value === null || value === undefined) return null
          
          if (type === 'pm25') {
            // 초미세먼지: 좋음(0~15), 보통(16~35), 나쁨(36~75), 매우나쁨(76~)
            if (value <= 15) return '좋음'
            if (value <= 35) return '보통'
            if (value <= 75) return '나쁨'
            return '매우나쁨'
          } else if (type === 'pm10') {
            // 미세먼지: 좋음(0~30), 보통(31~80), 나쁨(81~150), 매우나쁨(151~)
            if (value <= 30) return '좋음'
            if (value <= 80) return '보통'
            if (value <= 150) return '나쁨'
            return '매우나쁨'
          } else if (type === 'o3') {
            // 오존: 좋음(0~0.03), 보통(0.0301~0.09), 나쁨(0.0901~0.15), 매우나쁨(0.1501~)
            if (value <= 0.03) return '좋음'
            if (value <= 0.09) return '보통'
            if (value <= 0.15) return '나쁨'
            return '매우나쁨'
          }
          return null
        }
        
        // 1. 에어코리아 API에서 실시간 대기오염 정보 가져오기
        let pm10Grade: string | null = null
        let pm25Grade: string | null = null
        let o3Grade: string | null = null
        try {
          const airKoreaData = await getAirKoreaData(cityName)
          if (airKoreaData) {
            pm10 = airKoreaData.pm10
            pm25 = airKoreaData.pm25
            o3 = airKoreaData.o3
            pm10Grade = airKoreaData.pm10Grade || null
            pm25Grade = airKoreaData.pm25Grade || null
            o3Grade = airKoreaData.o3Grade || null
            
            // 등급 정보가 없으면 수치 기반으로 등급 계산
            if (!pm10Grade && pm10 !== null) {
              pm10Grade = calculateGradeFromValue(pm10, 'pm10')
            }
            if (!pm25Grade && pm25 !== null) {
              pm25Grade = calculateGradeFromValue(pm25, 'pm25')
            }
            if (!o3Grade && o3 !== null) {
              o3Grade = calculateGradeFromValue(o3, 'o3')
            }
            
            console.log('✅ 에어코리아 API에서 대기오염 정보 가져옴:', { pm10, pm25, o3, pm10Grade, pm25Grade, o3Grade })
          }
        } catch (error) {
          console.warn('⚠️ 에어코리아 API 호출 실패:', error)
        }
        
        // 2. 에어코리아 API 실패 시 OpenWeatherMap Air Pollution API 사용
        if (pm10 === null || pm25 === null || o3 === null) {
          if (airResponse.ok) {
            try {
              const airData = await airResponse.json()
              if (airData && airData.list && airData.list.length > 0) {
                const components = airData.list[0].components
                if (components) {
                  if (pm10 === null && components.pm10) {
                    pm10 = Math.round(components.pm10)
                    pm10Grade = calculateGradeFromValue(pm10, 'pm10')
                  }
                  if (pm25 === null && components.pm2_5) {
                    pm25 = Math.round(components.pm2_5)
                    pm25Grade = calculateGradeFromValue(pm25, 'pm25')
                  }
                  // OpenWeatherMap의 O3는 μg/m³ 단위이므로 ppm으로 변환 (1 ppm = 1960 μg/m³)
                  if (o3 === null && components.o3) {
                    o3 = Math.round((components.o3 / 1960) * 10000) / 10000 // 소수점 4자리까지
                    o3Grade = calculateGradeFromValue(o3, 'o3')
                  }
                  console.log('✅ OpenWeatherMap Air Pollution API에서 대기오염 정보 가져옴')
                }
              }
            } catch (e) {
              console.warn('OpenWeatherMap 대기질 데이터 파싱 실패:', e)
            }
          }
        }
        
        // 3. 모든 API 실패 시 null 유지 (UI에서 '없음'으로 표시)
        
        // API 응답 검증
        if (!currentData || !currentData.main || !currentData.weather || !currentData.weather[0]) {
          throw new Error('현재 날씨 API 응답 형식이 올바르지 않습니다.')
        }
        
        if (!forecastData || !forecastData.list || !Array.isArray(forecastData.list)) {
          throw new Error('예보 API 응답 형식이 올바르지 않습니다.')
        }
        
        // API 응답을 WeatherInfo 형식으로 변환
        const weatherList: WeatherInfo[] = []
        const today = new Date()
        today.setHours(0, 0, 0, 0) // 오늘 자정으로 설정
        
        // 오늘 날씨 (현재 날씨 API 사용)
        weatherList.push({
          date: '오늘',
          temperature: Math.round(currentData.main.temp),
          humidity: currentData.main.humidity || 65,
          uvIndex: uvIndex, // UV Index API에서 가져온 값
          condition: currentData.weather[0].description || '맑음',
          pm10: pm10 ?? undefined, // 에어코리아 또는 OpenWeatherMap에서 가져온 값 (null이면 undefined)
          pm25: pm25 ?? undefined, // 초미세먼지
          o3: o3 ?? undefined, // 오존 (O3)
          pm10Grade: pm10Grade, // 미세먼지 등급
          pm25Grade: pm25Grade, // 초미세먼지 등급
          o3Grade: o3Grade, // 오존 등급
        })
        
        // 내일, 모레 날씨 (Forecast API에서 가져오기)
        for (let i = 1; i <= 2; i++) {
          const targetDate = new Date(today)
          targetDate.setDate(targetDate.getDate() + i)
          targetDate.setHours(12, 0, 0, 0) // 정오 시간으로 설정
          
          // 해당 날짜에 가장 가까운 예보 찾기
          let closestForecast = null
          let minTimeDiff = Infinity
          
          for (const item of forecastData.list || []) {
            const itemDate = new Date(item.dt * 1000)
            const timeDiff = Math.abs(itemDate.getTime() - targetDate.getTime())
            
            // 같은 날짜이고 시간 차이가 가장 작은 것 선택
            if (itemDate.toDateString() === targetDate.toDateString() && timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff
              closestForecast = item
            }
          }
          
          // 같은 날짜의 예보가 없으면 가장 가까운 예보 선택
          if (!closestForecast) {
            for (const item of forecastData.list || []) {
              const itemDate = new Date(item.dt * 1000)
              const timeDiff = Math.abs(itemDate.getTime() - targetDate.getTime())
              
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff
                closestForecast = item
              }
            }
          }
          
          if (closestForecast) {
            weatherList.push({
              date: i === 1 ? '내일' : '모레',
              temperature: Math.round(closestForecast.main.temp),
              humidity: closestForecast.main.humidity,
              uvIndex: uvIndex, // 오늘과 동일한 UV Index 사용 (예보용 API에는 없음)
              condition: closestForecast.weather[0].description,
              pm10: pm10 ?? undefined, // 오늘과 동일한 미세먼지 사용 (예보용 API에는 없음)
              pm25: pm25 ?? undefined, // 초미세먼지
              o3: o3 ?? undefined, // 오늘과 동일한 오존 사용 (예보용 API에는 없음)
              pm10Grade: pm10Grade, // 미세먼지 등급
              pm25Grade: pm25Grade, // 초미세먼지 등급
              o3Grade: o3Grade, // 오존 등급
            })
          }
        }
        
        if (weatherList.length > 0) {
          console.log('✅ OpenWeatherMap API에서 날씨 정보를 성공적으로 가져왔습니다.')
          console.log('📍 위치:', cityName, `(${lat}, ${lon})`)
          console.log('🌡️ 오늘 온도:', weatherList[0].temperature, '℃')
          console.log('☁️ 오늘 날씨:', weatherList[0].condition)
          console.log('☀️ 자외선 지수:', weatherList[0].uvIndex)
          console.log('🌫️ 미세먼지 PM10:', weatherList[0].pm10, 'PM2.5:', weatherList[0].pm25)
          console.log('☁️ 오존 O3:', weatherList[0].o3, 'ppm')
          return weatherList
        } else {
          throw new Error('날씨 정보를 가져올 수 없습니다.')
        }
      } catch (error: any) {
        console.error('⚠️ 날씨 API 호출 실패')
        console.error('API 오류 상세:', error.message)
        if (error.response) {
          console.error('API 응답 상태:', error.response.status)
          console.error('API 응답 본문:', error.response.data)
        }
        // API 호출 실패 시 빈 배열 반환
        return []
      }
    } else {
      console.warn('⚠️ 날씨 API 키가 설정되지 않았습니다.')
      // API 키가 없으면 빈 배열 반환
      return []
    }
  } catch (error) {
    console.error('❌ 날씨 정보 가져오기 실패:', error)
    // API 실패 시 빈 배열 반환 (더미 데이터 제거)
    return []
  }
}


/**
 * 실시간 날씨 정보 가져오기
 * 위치를 확인하고 해당 위치의 날씨 정보를 반환합니다.
 */
export async function getWeatherInfo(): Promise<{ weather: WeatherInfo[]; location: string }> {
  try {
    // 1. 사용자 위치 가져오기 (GPS 좌표)
    const location = await getUserLocation()
    
    // 2. 좌표 설정 (위치를 못 찾으면 서울 좌표 사용)
    let lat: number
    let lon: number
    let cityName: string
    
    if (location) {
      // GPS 좌표를 직접 사용
      lat = location.lat
      lon = location.lng
      // 표시용 도시 이름 찾기
      cityName = findNearestCity(location.lat, location.lng)
      console.log('✅ GPS 위치 확인 완료:', { lat, lon, cityName })
    } else {
      // 위치를 못 찾으면 서울 좌표 사용
      lat = 37.5665
      lon = 126.9780
      cityName = '서울'
      console.log('ℹ️ 위치 확인 불가, 기본 위치(서울) 사용:', { lat, lon })
    }

    // 3. GPS 좌표를 직접 사용하여 날씨 정보 가져오기
    const weather = await fetchWeatherData(lat, lon, cityName)
    
    return { weather, location: cityName }
  } catch (error) {
    console.error('❌ 날씨 정보 가져오기 실패:', error)
    return {
      weather: [],
      location: '서울',
    }
  }
}

/**
 * 현재 날씨 정보만 가져오기 (채팅창용)
 */
export async function getCurrentWeather(): Promise<WeatherInfo & { location: string }> {
  try {
    const { weather, location } = await getWeatherInfo()
    return {
      ...weather[0],
      location,
    }
  } catch (error) {
    console.error('❌ 현재 날씨 정보 가져오기 실패:', error)
    return {
      date: '오늘',
      temperature: 0,
      humidity: 0,
      uvIndex: 0,
      condition: '없음',
      location: '서울',
    }
  }
}

