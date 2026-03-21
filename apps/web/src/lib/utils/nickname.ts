import { containsProfanity, isReservedNickname } from './profanity'

export type NicknameErrorCode = 'tooShort' | 'tooLong' | 'invalidChars' | 'reserved'

export function validateNickname(value: string): NicknameErrorCode | null {
  const v = value.trim()
  if (v.length < 2) return 'tooShort'
  if (v.length > 16) return 'tooLong'
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_\- ]+$/.test(v)) return 'invalidChars'
  if (isReservedNickname(v)) return 'reserved'
  if (containsProfanity(v)) return 'reserved'
  return null
}