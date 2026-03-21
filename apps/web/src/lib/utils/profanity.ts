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
  // English
  'admin', 'administrator', 'root', 'superuser', 'staff', 'system',
  'locory', 'locory_admin', 'moderator', 'official', 'support',
  // Korean
  '관리자', '운영자', '운영팀', '로코리', '어드민', '시스템', '공식',
  // Japanese
  '管理者', '管理人', '運営', 'システム', '公式', 'かんりしゃ',
  // Chinese (Simplified + Traditional)
  '管理员', '管理者', '系统', '运营', '官方',
  '管理員', '系統', '官方',
  // Spanish / Latin American
  'administrador', 'sistema', 'moderador', 'soporte', 'oficial',
  // Russian
  'администратор', 'система', 'модератор', 'официальный',
]

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s/g, '')
  return PROFANITY_WORDS.some(w => lower.includes(w))
}

export function isReservedNickname(value: string): boolean {
  const lower = value.toLowerCase().replace(/\s/g, '')
  return RESERVED_NAMES.some(r => lower === r || lower.includes(r))
}