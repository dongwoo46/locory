'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const NATIONALITY_OPTS = [
  { value: 'KR', label: '🇰🇷 한국' }, { value: 'JP', label: '🇯🇵 일본' },
  { value: 'US', label: '🇺🇸 미국' }, { value: 'CN', label: '🇨🇳 중국' },
  { value: 'ES', label: '🇪🇸 스페인/남미' }, { value: 'RU', label: '🇷🇺 러시아' },
  { value: 'OTHER', label: '🌍 기타' },
]

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function getAgeGroup(birthDate: string | null): string | null {
  if (!birthDate) return null
  const age = calcAge(birthDate)
  if (age < 20) return 'teens'
  if (age <= 23) return '20s_early'
  if (age <= 26) return '20s_mid'
  if (age <= 29) return '20s_late'
  if (age <= 33) return '30s_early'
  if (age <= 36) return '30s_mid'
  if (age <= 39) return '30s_late'
  return '40s_plus'
}

function formatScheduled(iso: string) {
  const d = new Date(iso)
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface JoinRow {
  id: string
  applicant_id: string
  join_count: number
  join_gender: string
  join_age_groups: string[]
  message: string | null
  status: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meetup: any
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
  myJoin: { id: string; status: string } | null
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function MeetupDetailClient({ meetup: initialMeetup, userId, profile, myJoin: initialMyJoin }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('meetup')

  const [meetup, setMeetup] = useState(initialMeetup)
  const [myJoin, setMyJoin] = useState(initialMyJoin)
  const [joins, setJoins] = useState<JoinRow[]>([])
  const [joinsLoaded, setJoinsLoaded] = useState(false)

  const isOrganizer = meetup.organizer_id === userId
  const myAgeGroup = getAgeGroup(profile?.birth_date ?? null)
  const canParticipate = profile?.is_public && (profile?.trust_score ?? 0) >= 3

  const natMismatch = meetup.wanted_nationalities && profile?.nationality
    ? !meetup.wanted_nationalities.includes(profile.nationality)
    : false
  const genderMismatch = meetup.wanted_gender !== 'any' && profile?.gender
    ? meetup.wanted_gender !== profile.gender
    : false
  const ageGroupMismatch = meetup.wanted_age_groups && meetup.wanted_age_groups.length > 0 && myAgeGroup
    ? !meetup.wanted_age_groups.includes(myAgeGroup)
    : false
  const conditionBlocked = natMismatch || genderMismatch || ageGroupMismatch

  const isAccepted = myJoin?.status === 'accepted'
  const isPending = myJoin?.status === 'pending'
  const isUnmatched = myJoin?.status === 'unmatched' || myJoin?.status === 'rejected'

  async function loadJoins() {
    if (joinsLoaded) return
    const { data } = await supabase
      .from('meetup_joins')
      .select('*, profiles!applicant_id (id, nickname, avatar_url, gender, birth_date)')
      .eq('meetup_id', meetup.id)
      .order('created_at', { ascending: true })
    setJoins((data as JoinRow[]) ?? [])
    setJoinsLoaded(true)
  }

  async function updateJoinStatus(joinId: string, status: 'accepted' | 'rejected' | 'unmatched') {
    await supabase.from('meetup_joins').update({ status }).eq('id', joinId)
    setJoins((j) => j.map((x) => (x.id === joinId ? { ...x, status } : x)))
    if (status === 'accepted') {
      // 매칭 성사 trust 포인트: 주최자 + 신청자 모두 적립
      const join = joins.find((x) => x.id === joinId)
      await Promise.all([
        supabase.rpc('apply_trust_points', { p_user_id: meetup.organizer_id, p_action: 'meetup_matched', p_ref_id: meetup.id }),
        join?.applicant_id && supabase.rpc('apply_trust_points', { p_user_id: join.applicant_id, p_action: 'meetup_matched', p_ref_id: meetup.id }),
      ])
    }
  }

  async function handleCloseMeetup() {
    if (!confirm(t('manage.closeConfirm'))) return
    // pending 신청 전부 거절
    const pendingIds = joins.filter((j) => j.status === 'pending').map((j) => j.id)
    if (pendingIds.length > 0) {
      await supabase.from('meetup_joins').update({ status: 'rejected' }).in('id', pendingIds)
      setJoins((prev) => prev.map((j) => j.status === 'pending' ? { ...j, status: 'rejected' } : j))
    }
    await supabase.from('place_meetups').update({ status: 'closed' }).eq('id', meetup.id)
    setMeetup((m: typeof initialMeetup) => ({ ...m, status: 'closed' }))
  }

  async function handleDeleteMeetup() {
    if (!confirm(t('manage.deleteConfirm'))) return
    await supabase.from('place_meetups')
      .update({ status: 'closed', deleted_at: new Date().toISOString() })
      .eq('id', meetup.id)
    router.back()
  }

  // 주최자는 첫 렌더에 joins를 로드
  useState(() => {
    if (isOrganizer) loadJoins()
  })

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 max-w-lg mx-auto">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} className="p-1 mr-2 text-gray-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {meetup.title && <p className="text-base font-bold text-gray-900 truncate">{meetup.title}</p>}
            <p className={`truncate ${meetup.title ? 'text-xs text-gray-400' : 'text-base font-bold text-gray-900'}`}>
              {meetup.places?.name ?? '-'}
            </p>
          </div>
        </div>
      </header>

      <div className="pt-14 pb-28 max-w-lg mx-auto w-full">
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* 주최자 카드 */}
          <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            {meetup.profiles?.avatar_url ? (
              <img src={meetup.profiles.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg text-gray-400">
                {meetup.profiles?.nickname?.[0] ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{meetup.profiles?.nickname ?? '-'}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                {meetup.profiles?.gender && (
                  <span>{t(`gender.${meetup.profiles.gender}`)}</span>
                )}
                {meetup.profiles?.birth_date && (
                  <span>{calcAge(meetup.profiles.birth_date)}세</span>
                )}
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">
              {formatScheduled(meetup.scheduled_at)}
            </p>
          </div>

          {/* 장소 카드 */}
          <button
            onClick={() => meetup.places?.id && router.push(`/place/${meetup.places.id}`)}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-left w-full"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{meetup.places?.name ?? '-'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {meetup.places?.category && <span className="mr-1">{meetup.places.category}</span>}
                {meetup.places?.city}
              </p>
            </div>
            <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* 우리 팀 */}
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('detail.hostTeam')}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{meetup.host_count}명</span>
              {meetup.host_gender && (
                <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {t(`gender.${meetup.host_gender}`)}
                </span>
              )}
              {meetup.host_age_groups?.map((a: string) => (
                <span key={a} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {t(`ageGroup.${a}`)}
                </span>
              ))}
              {meetup.activities?.map((a: string) => (
                <span key={a} className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-600">
                  {t(`activity.${a}`)}
                </span>
              ))}
              {meetup.vibe && (
                <span className="px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-600">
                  {t(`vibe.${meetup.vibe}`)}
                </span>
              )}
            </div>
          </div>

          {/* 원하는 상대 */}
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('detail.wantedPartner')}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                {t(`gender.${meetup.wanted_gender}`)}
              </span>
              {meetup.wanted_age_groups?.map((a: string) => (
                <span key={a} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {t(`ageGroup.${a}`)}
                </span>
              ))}
              {meetup.wanted_count && (
                <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {meetup.wanted_count}명
                </span>
              )}
              {meetup.wanted_nationalities?.map((n: string) => (
                <span key={n} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {NATIONALITY_OPTS.find((o) => o.value === n)?.label ?? n}
                </span>
              ))}
            </div>
          </div>

          {/* 한마디 */}
          {meetup.description && (
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-600">{meetup.description}</p>
            </div>
          )}

          {/* 주최자: 신청 관리 */}
          {isOrganizer && (
            <ManageSection
              joins={joins}
              meetup={meetup}
              onUpdateStatus={updateJoinStatus}
              onThread={() => router.push(`/chat/${meetup.id}`)}
              onClose={handleCloseMeetup}
            />
          )}
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 py-4 max-w-lg mx-auto">
        {isOrganizer ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/chat/${meetup.id}`)}
                className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium"
              >
                {t('manage.openThread')}
              </button>
              {meetup.status === 'open' && (
                <button
                  onClick={handleCloseMeetup}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm"
                >
                  {t('manage.closeBtn')}
                </button>
              )}
            </div>
            <button
              onClick={handleDeleteMeetup}
              className="w-full py-2.5 text-red-400 text-xs"
            >
              {t('manage.deleteBtn')}
            </button>
          </div>
        ) : isAccepted ? (
          <button
            onClick={() => router.push(`/chat/${meetup.id}`)}
            className="w-full py-3.5 bg-green-600 text-white rounded-xl text-sm font-medium"
          >
            {t('detail.openThread')}
          </button>
        ) : isUnmatched ? (
          <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm text-center">
            {t('detail.cannotApply')}
          </div>
        ) : conditionBlocked ? (
          <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm text-center">
            {natMismatch ? t('detail.conditionMismatchNat') : t('detail.conditionMismatchGender')}
          </div>
        ) : !canParticipate ? (
          <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm text-center">
            {t('detail.restrictionNotMet')}
          </div>
        ) : isPending ? (
          <div className="w-full py-3.5 bg-yellow-50 text-yellow-600 rounded-xl text-sm text-center">
            {t('detail.inReview')}
          </div>
        ) : meetup.status === 'closed' ? (
          <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm text-center">
            {t('explore.closed')}
          </div>
        ) : (
          <button
            onClick={() => router.push(`/meetup/${meetup.id}/apply`)}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium"
          >
            {t('detail.applyButton')}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── 관리 섹션 (주최자용) ──────────────────────────────────────────────────────

function ManageSection({
  joins,
  meetup,
  onUpdateStatus,
  onThread: _onThread,
  onClose: _onClose,
}: {
  joins: JoinRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meetup: any
  onUpdateStatus: (id: string, status: 'accepted' | 'rejected' | 'unmatched') => void
  onThread: () => void
  onClose: () => void
}) {
  const t = useTranslations('meetup')
  const router = useRouter()
  const pending = joins.filter((j) => j.status === 'pending')
  const accepted = joins.filter((j) => j.status === 'accepted')
  const others = joins.filter((j) => j.status === 'rejected' || j.status === 'unmatched')

  return (
    <div className="flex flex-col gap-4">
      {/* 신청 대기 */}
      {pending.length > 0 && (
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-900 mb-3">{t('manage.pending')} {pending.length}</p>
          {pending.map((j) => (
            <div key={j.id} className="p-3 border border-gray-100 rounded-xl mb-2">
              <JoinInfo join={j} />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onUpdateStatus(j.id, 'rejected')}
                  className="flex-1 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs"
                >
                  {t('manage.reject')}
                </button>
                <button
                  onClick={() => onUpdateStatus(j.id, 'accepted')}
                  className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-xs"
                >
                  {t('manage.accept')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 수락된 신청 */}
      {accepted.length > 0 && (
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-900 mb-3">{t('manage.accepted')} {accepted.length}</p>
          {accepted.map((j) => (
            <div key={j.id} className="flex items-center gap-3 p-3 border border-green-100 rounded-xl mb-2">
              <JoinInfo join={j} />
              <button
                onClick={() => onUpdateStatus(j.id, 'unmatched')}
                className="ml-auto text-xs text-gray-300 px-2 py-1 border border-gray-200 rounded-lg shrink-0"
              >
                {t('manage.unmatchBtn')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 거절/언매치 */}
      {others.length > 0 && (
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm opacity-60">
          <p className="text-xs font-semibold text-gray-400 mb-3">{t('manage.rejectUnmatch')}</p>
          {others.map((j) => (
            <div key={j.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
              <JoinInfo join={j} />
              <span className="ml-auto text-xs text-gray-400">
                {j.status === 'rejected' ? t('manage.reject') : t('manage.unmatch')}
              </span>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && accepted.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          {t('manage.noApplicants')}
        </div>
      )}

      {/* 상태 배지 */}
      {meetup.status === 'closed' && (
        <div className="text-center py-2 text-sm text-green-700 bg-green-50 rounded-xl">
          {t('manage.closed')}
        </div>
      )}

      {/* 채팅 버튼 (별도로 헤더에 있지만 카드로도 제공) */}
      <button
        onClick={() => router.push(`/chat/${meetup.id}`)}
        className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium"
      >
        {t('manage.openThread')}
      </button>
    </div>
  )
}

function JoinInfo({ join }: { join: JoinRow }) {
  const t = useTranslations('meetup')
  const router = useRouter()
  return (
    <div
      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
      onClick={() => router.push(`/profile/${join.profiles?.id}`)}
    >
      {join.profiles?.avatar_url ? (
        <img src={join.profiles.avatar_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-400 shrink-0">
          {join.profiles?.nickname?.[0] ?? '?'}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{join.profiles?.nickname ?? '-'}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-400">{join.join_count}명</span>
          {join.join_gender && (
            <span className="text-xs text-gray-400">{t(`gender.${join.join_gender}`)}</span>
          )}
          {join.join_age_groups?.map((a: string) => (
            <span key={a} className="text-xs text-gray-400">{t(`ageGroup.${a}`)}</span>
          ))}
        </div>
        {join.message && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{join.message}</p>
        )}
      </div>
    </div>
  )
}
