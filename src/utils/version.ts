/**
 * 앱 버전 관리
 * 버전 형식: 1.xx.xx (Major.Minor.Patch)
 */

const VERSION_KEY = 'app_version'

interface Version {
  major: number
  minor: number
  patch: number
}

/**
 * 버전 문자열을 파싱
 */
function parseVersion(versionString: string): Version {
  const parts = versionString.split('.')
  return {
    major: parseInt(parts[0] || '1', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10),
  }
}

/**
 * 버전 객체를 문자열로 변환
 */
function versionToString(version: Version): string {
  return `${version.major}.${version.minor.toString().padStart(2, '0')}.${version.patch.toString().padStart(2, '0')}`
}

/**
 * 현재 버전 가져오기
 */
export function getVersion(): string {
  const stored = localStorage.getItem(VERSION_KEY)
  if (stored) {
    return stored
  }
  
  // 기본 버전
  const defaultVersion = '1.00.00'
  localStorage.setItem(VERSION_KEY, defaultVersion)
  return defaultVersion
}

/**
 * 버전 증가 (patch 버전 증가)
 */
export function incrementVersion(): string {
  const currentVersion = getVersion()
  const version = parseVersion(currentVersion)
  
  // patch 버전 증가
  version.patch += 1
  
  // patch가 100을 넘으면 minor 증가
  if (version.patch >= 100) {
    version.patch = 0
    version.minor += 1
  }
  
  // minor가 100을 넘으면 major 증가
  if (version.minor >= 100) {
    version.minor = 0
    version.major += 1
  }
  
  const newVersion = versionToString(version)
  localStorage.setItem(VERSION_KEY, newVersion)
  return newVersion
}

/**
 * 버전 설정 (수동)
 */
export function setVersion(versionString: string): void {
  localStorage.setItem(VERSION_KEY, versionString)
}

/**
 * 앱 시작 시 자동으로 버전 증가 (선택적)
 * 코드 변경이 있을 때마다 호출하여 버전을 증가시킬 수 있습니다.
 */
export function autoIncrementOnStart(): string {
  // 마지막 버전 증가 시간 확인
  const LAST_INCREMENT_KEY = 'last_version_increment'
  const lastIncrement = localStorage.getItem(LAST_INCREMENT_KEY)
  const now = Date.now()
  
  // 하루에 한 번만 자동 증가 (같은 날에는 증가하지 않음)
  if (lastIncrement) {
    const lastDate = new Date(parseInt(lastIncrement))
    const today = new Date()
    if (
      lastDate.getFullYear() === today.getFullYear() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getDate() === today.getDate()
    ) {
      // 같은 날이면 증가하지 않음
      return getVersion()
    }
  }
  
  // 버전 증가
  const newVersion = incrementVersion()
  localStorage.setItem(LAST_INCREMENT_KEY, now.toString())
  return newVersion
}

