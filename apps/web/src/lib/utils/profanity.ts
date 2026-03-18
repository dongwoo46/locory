const PROFANITY_WORDS = [
  // English
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'cock',
  'pussy', 'nigga', 'nigger', 'faggot', 'whore', 'slut', 'retard', 'rape',
  'nazi', 'hitler', 'porn', 'xxx',
  // Korean
  '씨발', '시발', '개새끼', '병신', '지랄', '꺼져', '죽어', '미친놈', '창녀', '보지', '자지',
  '새끼', '개년', '개놈', 'ㅆㅂ', 'ㅂㅅ',
]

const RESERVED_NAMES = [
  'admin', 'administrator', 'root', 'superuser', 'staff', 'system',
  'locory', 'locory_admin', 'moderator', 'official',
  '관리자', '운영자', '운영팀', '로코리', '어드민', '시스템',
]

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s/g, '')
  return PROFANITY_WORDS.some(w => lower.includes(w))
}

export function isReservedNickname(value: string): boolean {
  const lower = value.toLowerCase().replace(/\s/g, '')
  return RESERVED_NAMES.some(r => lower === r || lower.includes(r))
}