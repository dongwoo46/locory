const BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'cock',
  'pussy', 'nigga', 'nigger', 'faggot', 'whore', 'slut', 'retard', 'rape',
  'nazi', 'hitler', 'porn', 'sex', 'xxx',
  '씨발', '시발', '개새끼', '병신', '지랄', '꺼져', '죽어', '미친놈', '창녀', '보지', '자지',
]

export function validateNickname(value: string): string | null {
  const v = value.trim()
  if (v.length < 2) return '닉네임은 최소 2자 이상이에요'
  if (v.length > 16) return '닉네임은 16자 이하로 입력해주세요'

  const lower = v.toLowerCase()
  if (BANNED_WORDS.some(w => lower.includes(w))) return '사용할 수 없는 닉네임이에요'

  return null
}
