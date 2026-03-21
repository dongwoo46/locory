'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { localeNames, displayLocales, type Locale } from '@/i18n/config'
import { setLocale } from '@/i18n/client'
import { validateNickname } from '@/lib/utils/nickname'

interface Profile {
  id: string
  nickname: string
  nationality: string
  avatar_url: string | null
  is_public: boolean
  birth_date: string | null
  gender: 'male' | 'female' | 'other' | null
  gender_changed_at: string | null
  bio: string | null
  role?: string
}

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', ES: '🇪🇸', RU: '🇷🇺', OTHER: '🌍',
}

export default function SettingsClient({ profile: initial, currentLocale: initialLocale, isAdmin = false }: { profile: Profile; currentLocale: string; isAdmin?: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tProfile = useTranslations('profile')

  const [profile, setProfile] = useState(initial)
  const [currentLocale, setCurrentLocale] = useState<Locale>(initialLocale as Locale)
  const [nickname, setNickname] = useState(initial.nickname)
  const [birthDate, setBirthDate] = useState<string>(initial.birth_date ?? '')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(initial.gender)
  const canChangeGender = !initial.gender_changed_at
  const [bio, setBio] = useState(initial.bio ?? '')
  const [nicknameError, setNicknameError] = useState('')
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [isPublic, setIsPublic] = useState(initial.is_public)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 회원탈퇴
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [showDormantConfirm, setShowDormantConfirm] = useState(false)
  const deleteKeyword = t('deleteConfirmKeyword')

  // 문의하기
  const [inquiryCategory, setInquiryCategory] = useState('other')
  const [inquiryTitle, setInquiryTitle] = useState('')
  const [inquiryContent, setInquiryContent] = useState('')
  const [inquiryLoading, setInquiryLoading] = useState(false)
  const [inquiryDone, setInquiryDone] = useState(false)
  const [showInquiry, setShowInquiry] = useState(false)

  async function handleInquirySubmit() {
    if (!inquiryTitle.trim() || !inquiryContent.trim()) return
    setInquiryLoading(true)
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: inquiryTitle, content: inquiryContent, category: inquiryCategory }),
    })
    setInquiryLoading(false)
    if (res.ok) {
      setInquiryDone(true)
      setInquiryTitle('')
      setInquiryContent('')
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
      setProfile(p => ({ ...p, avatar_url: publicUrl }))
    }
    setAvatarUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSaveNickname() {
    if (!isAdmin) {
      const errCode = validateNickname(nickname)
      if (errCode) {
        const msgMap: Record<string, string> = {
          tooShort: t('nicknameErrorTooShort'),
          tooLong: t('nicknameErrorTooLong'),
          invalidChars: t('nicknameErrorInvalid'),
          reserved: t('nicknameErrorReserved'),
        }
        setNicknameError(msgMap[errCode] ?? t('nicknameErrorInvalid'))
        return
      }
    }
    setNicknameSaving(true)
    setNicknameError('')
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: nickname.trim() })
      .eq('id', profile.id)

    if (error) {
      if (error.code === '23505') setNicknameError(t('nicknameErrorDuplicate'))
      else if (error.code === '23514') setNicknameError(t('nicknameErrorInvalid'))
      else setNicknameError(t('nicknameErrorFailed'))
    } else {
      setProfile(p => ({ ...p, nickname: nickname.trim() }))
    }
    setNicknameSaving(false)
  }

  async function handleVisibilityChange(value: boolean) {
    setIsPublic(value)
    setVisibilitySaving(true)
    await supabase.from('profiles').update({ is_public: value }).eq('id', profile.id)
    setVisibilitySaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteAccount() {
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (res.ok) {
      await supabase.auth.signOut()
      router.push('/login')
    } else {
      alert(t('deleteError'))
    }
  }

  async function handleDormant() {
    await supabase.from('profiles').update({ is_public: false }).eq('id', profile.id)
    setIsPublic(false)
    setShowDormantConfirm(false)
    alert(t('dormantSuccess'))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900">{t('title')}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto pt-14 pb-10 px-4">

        {/* 프로필 이미지 */}
        <section className="mt-6 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('profileImage')}</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden shrink-0">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl text-gray-400">
                    {profile.nickname?.[0]}
                  </div>
              }
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-50"
              >
                {avatarUploading ? '...' : t('changePhoto')}
              </button>
              <p className="text-xs text-gray-400">{t('photoHint')}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </section>

        {/* 닉네임 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('nickname')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setNicknameError('') }}
              maxLength={16}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
            />
            <button
              onClick={handleSaveNickname}
              disabled={nicknameSaving || nickname.trim() === profile.nickname}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-40"
            >
              {tCommon('save')}
            </button>
          </div>
          {nicknameError && <p className="text-xs text-red-500 mt-2">{nicknameError}</p>}
        </section>

        {/* 자기소개 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('bio')}</p>
          <div className="flex flex-col gap-2">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 120))}
              placeholder={t('bioPlaceholder')}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">{bio.length}/120</span>
              <button
                onClick={async () => {
                  await supabase.from('profiles').update({ bio: bio.trim() || null }).eq('id', profile.id)
                  setProfile(p => ({ ...p, bio: bio.trim() || null }))
                }}
                disabled={bio === (profile.bio ?? '')}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-40"
              >
                {tCommon('save')}
              </button>
            </div>
          </div>
        </section>

        {/* 생년월일 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('birthDate')}</p>
          <div className="flex gap-2">
            <input
              type="date"
              lang="en"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 14)).toISOString().slice(0, 10)}
              min="1920-01-01"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 bg-white"
            />
            <button
              onClick={async () => {
                await supabase.from('profiles').update({ birth_date: birthDate || null }).eq('id', profile.id)
                setProfile(p => ({ ...p, birth_date: birthDate || null }))
              }}
              disabled={birthDate === (profile.birth_date ?? '')}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-40"
            >
              {tCommon('save')}
            </button>
          </div>
        </section>

        {/* 성별 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('gender')}</p>
            {!canChangeGender && (
              <span className="text-xs text-gray-300">{t('genderLocked')}</span>
            )}
          </div>
          {canChangeGender ? (
            <div className="flex gap-2">
              {(['female', 'male', 'other'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(prev => prev === g ? null : g)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm transition-colors ${
                    gender === g
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {tProfile(`gender.${g}`)}
                </button>
              ))}
              <button
                onClick={async () => {
                  const now = new Date().toISOString()
                  await supabase.from('profiles').update({ gender, gender_changed_at: now }).eq('id', profile.id)
                  setProfile(p => ({ ...p, gender, gender_changed_at: now }))
                }}
                disabled={gender === profile.gender || !gender}
                className="px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-40"
              >
                {tCommon('save')}
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">
              {profile.gender ? tProfile(`gender.${profile.gender}`) : ''}
            </div>
          )}
        </section>

        {/* 언어 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">언어 / Language</p>
          <div className="grid grid-cols-2 gap-2">
            {displayLocales.map(locale => (
              <button
                key={locale}
                onClick={() => { setCurrentLocale(locale); setLocale(locale) }}
                className={`px-4 py-2.5 rounded-xl border text-sm transition-colors text-left ${
                  currentLocale === locale
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                {localeNames[locale]}
              </button>
            ))}
          </div>
        </section>

        {/* 국적 (읽기 전용) */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('nationality')}</p>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl">
            <span>{NATIONALITY_FLAGS[profile.nationality]}</span>
            <span className="text-sm text-gray-700">{tProfile(`nationality.${profile.nationality}`)}</span>
            <span className="ml-auto text-xs text-gray-400">{t('nationalityReadonly')}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{t('nationalityHint')}</p>
        </section>

        {/* 계정 공개 설정 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('visibility')}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleVisibilityChange(true)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-colors ${
                isPublic ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700'
              }`}
            >
              <span>{t('public')}</span>
              <span className={`ml-auto text-xs ${isPublic ? 'text-gray-300' : 'text-gray-400'}`}>
                {t('publicHint')}
              </span>
              {visibilitySaving && isPublic && <span className="text-xs">...</span>}
            </button>
            <button
              onClick={() => handleVisibilityChange(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-colors ${
                !isPublic ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700'
              }`}
            >
              <span>{t('private')}</span>
              <span className={`ml-auto text-xs ${!isPublic ? 'text-gray-300' : 'text-gray-400'}`}>
                {t('privateHint')}
              </span>
              {visibilitySaving && !isPublic && <span className="text-xs">...</span>}
            </button>
          </div>
        </section>

        {/* 문의하기 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-2">
          <button
            onClick={() => { setShowInquiry(v => !v); setInquiryDone(false) }}
            className="w-full flex items-center justify-between py-3.5 text-sm text-gray-700 font-medium"
          >
            {t('inquiry')}
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className={`transition-transform ${showInquiry ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showInquiry && (
            <div className="pb-4 flex flex-col gap-2.5 border-t border-gray-50 pt-3">
              {inquiryDone ? (
                <div className="flex flex-col items-center gap-1.5 py-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg width="20" height="20" fill="none" stroke="#16A34A" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{t('inquiryDoneTitle')}</p>
                  <p className="text-xs text-gray-400">{t('inquiryDoneMsg')}</p>
                </div>
              ) : (
                <>
                  {/* 카테고리 */}
                  <div className="flex flex-wrap gap-1.5">
                    {(['bug', 'account', 'content', 'points', 'suggestion', 'other'] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => setInquiryCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${inquiryCategory === c ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'}`}
                      >
                        {t(`inquiryCategory.${c}`)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={inquiryTitle}
                    onChange={e => setInquiryTitle(e.target.value)}
                    placeholder={t('inquiryTitlePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                  />
                  <textarea
                    value={inquiryContent}
                    onChange={e => setInquiryContent(e.target.value)}
                    placeholder={t('inquiryContentPlaceholder')}
                    rows={4}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
                  />
                  <button
                    onClick={handleInquirySubmit}
                    disabled={inquiryLoading || !inquiryTitle.trim() || !inquiryContent.trim()}
                    className="w-full py-3 bg-gray-900 text-white text-sm rounded-xl font-medium disabled:opacity-40"
                  >
                    {inquiryLoading ? t('inquirySending') : t('inquirySend')}
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* 어드민 (admin 계정만 노출) */}
        {isAdmin && (
          <section className="mt-3 bg-gray-900 rounded-2xl px-4 py-2">
            <button
              onClick={() => router.push('/admin')}
              className="w-full flex items-center gap-3 py-3.5 text-sm text-white font-medium"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('adminPage')}
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="ml-auto">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </section>
        )}

        {/* 로그아웃 + 휴면 + 회원탈퇴 */}
        <section className="mt-3 bg-white rounded-2xl px-4 py-2">
          <button onClick={handleLogout} className="w-full py-3.5 text-sm text-red-500 font-medium text-left">
            {tCommon('logout')}
          </button>
          <div className="border-t border-gray-50" />
          <button onClick={() => setShowDormantConfirm(true)} className="w-full py-3.5 text-sm text-gray-400 font-medium text-left">
            {t('dormantAccount')}
          </button>
          <div className="border-t border-gray-50" />
          <button onClick={() => { setShowDeleteModal(true); setDeleteInput('') }} className="w-full py-3.5 text-sm text-gray-300 font-medium text-left">
            {t('deleteAccount')}
          </button>
        </section>

        {/* 휴면 확인 모달 */}
        {showDormantConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setShowDormantConfirm(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-900">{t('dormantAccount')}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t('dormantDesc')}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDormantConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
                  {tCommon('cancel')}
                </button>
                <button onClick={handleDormant} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium">
                  {t('dormantButton')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 회원탈퇴 확인 모달 */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setShowDeleteModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base font-bold text-gray-900">{t('deleteConfirmTitle')}</h3>
                <p className="text-sm text-red-500 leading-relaxed">{t('deleteConfirmDesc')}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-400">{t('deleteConfirmHint')}</p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder={t('deleteConfirmPlaceholder')}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== deleteKeyword}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-30"
                >
                  {t('deleteConfirmButton')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 앱 버전 */}
        <p className="text-center text-xs text-gray-300 mt-8">locory v0.1.0</p>
      </main>
    </div>
  )
}
