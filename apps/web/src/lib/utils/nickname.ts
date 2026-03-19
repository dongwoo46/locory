import { containsProfanity, isReservedNickname } from './profanity'

export function validateNickname(value: string): string | null {
  const v = value.trim()
  if (v.length < 2) return '닉네임은 최소 2자 이상이에요'
  if (v.length > 16) return '닉네임은 16자 이하로 입력해주세요'
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_\- ]+$/.test(v)) return '닉네임에 특수문자는 사용할 수 없어요'
  if (isReservedNickname(v)) return '사용할 수 없는 닉네임이에요'
  if (containsProfanity(v)) return '사용할 수 없는 닉네임이에요'
  return null
}