'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { containsProfanity } from '@/lib/utils/profanity';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const NATIONALITY_OPTS = [
  { value: 'KR', label: '🇰🇷 한국' },
  { value: 'JP', label: '🇯🇵 일본' },
  { value: 'US', label: '🇺🇸 미국' },
  { value: 'CN', label: '🇨🇳 중국' },
  { value: 'ES', label: '🇪🇸 스페인/남미' },
  { value: 'RU', label: '🇷🇺 러시아' },
  { value: 'OTHER', label: '🌍 기타' },
];

const AGE_GROUPS = [
  { value: 'teens', label: '10대' },
  { value: '20s_early', label: '20대 초' },
  { value: '20s_mid', label: '20대 중' },
  { value: '20s_late', label: '20대 후' },
  { value: '30s_early', label: '30대 초' },
  { value: '30s_mid', label: '30대 중' },
  { value: '30s_late', label: '30대 후' },
  { value: '40s_plus', label: '40대+' },
];

const ACTIVITIES = [
  { value: 'chat', label: '수다' },
  { value: 'food', label: '맛집탐방' },
  { value: 'photo', label: '사진/포토' },
  { value: 'tour', label: '관광' },
  { value: 'drink', label: '술한잔' },
  { value: 'game', label: '게임/오락' },
  { value: 'other', label: '기타' },
];

const VIBES = [
  { value: 'casual', label: '가벼운' },
  { value: 'fun', label: '유쾌한' },
  { value: 'serious', label: '진지한' },
];

const GENDER_OPTS = [
  { value: 'female', label: '여자' },
  { value: 'male', label: '남자' },
  { value: 'mixed', label: '혼성' },
];

const WANTED_GENDER_OPTS = [
  { value: 'female', label: '여자' },
  { value: 'male', label: '남자' },
  { value: 'any', label: '무관' },
];

const COUNT_OPTS = [1, 2, 3, 4];

function ageGroupLabel(v: string) {
  return AGE_GROUPS.find((a) => a.value === v)?.label ?? v;
}
function activityLabel(v: string) {
  return ACTIVITIES.find((a) => a.value === v)?.label ?? v;
}
function vibeLabel(v: string) {
  return VIBES.find((a) => a.value === v)?.label ?? v;
}

function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAgeGroup(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const age = calcAge(birthDate);
  if (age < 20) return 'teens';
  if (age <= 23) return '20s_early';
  if (age <= 26) return '20s_mid';
  if (age <= 29) return '20s_late';
  if (age <= 33) return '30s_early';
  if (age <= 36) return '30s_mid';
  if (age <= 39) return '30s_late';
  return '40s_plus';
}

function formatScheduled(iso: string) {
  const d = new Date(iso);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

// ─── 칩 컴포넌트 ─────────────────────────────────────────────────────────────

function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === o.value
              ? 'bg-gray-900 text-white border-transparent'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MultiChipSelect({
  options,
  values,
  onChange,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => toggle(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            values.includes(o.value)
              ? 'bg-gray-900 text-white border-transparent'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CountSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {COUNT_OPTS.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-xl text-sm font-medium border transition-colors ${
            value === n
              ? 'bg-gray-900 text-white border-transparent'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          {n}
        </button>
      ))}
      <button
        onClick={() => onChange(5)}
        className={`px-3 h-10 rounded-xl text-sm font-medium border transition-colors ${
          value >= 5
            ? 'bg-gray-900 text-white border-transparent'
            : 'border-gray-200 text-gray-600'
        }`}
      >
        5+
      </button>
    </div>
  );
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Meetup {
  id: string;
  organizer_id: string;
  scheduled_at: string;
  host_count: number;
  host_gender: string;
  host_age_groups: string[];
  activities: string[];
  vibe: string;
  description: string | null;
  wanted_gender: string;
  wanted_age_groups: string[] | null;
  wanted_count: number | null;
  wanted_nationalities: string[] | null;
  status: string;
  profiles: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    gender: string | null;
    birth_date: string | null;
  };
  meetup_joins?: { status: string; applicant_id: string }[];
}

interface JoinRow {
  id: string;
  applicant_id: string;
  join_count: number;
  join_gender: string;
  join_age_groups: string[];
  message: string | null;
  status: string;
  profiles: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    gender: string | null;
    birth_date: string | null;
  };
}

interface Props {
  placeId: string;
  placeName: string;
  userId: string;
  userBirthDate: string | null;
  userGender: string | null;
  userNationality: string | null;
  userIsPublic: boolean;
  userTrustScore: number;
  onClose: () => void;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

type View = 'list' | 'create' | 'detail' | 'join' | 'manage' | 'thread';

export default function MeetupSheet({
  placeId,
  placeName,
  userId,
  userBirthDate,
  userGender,
  userNationality,
  userIsPublic,
  userTrustScore,
  onClose,
}: Props) {
  const supabase = createClient();
  const t = useTranslations('meetup');
  const [view, setView] = useState<View>('list');
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [selected, setSelected] = useState<Meetup | null>(null);
  const [joins, setJoins] = useState<JoinRow[]>([]);
  const [loading, setLoading] = useState(false);

  const myAgeGroup = getAgeGroup(userBirthDate);
  const canParticipate = userIsPublic && userTrustScore >= 3;

  // ── 목록 로드 ──────────────────────────────────────────────────────────────

  async function loadMeetups() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('place_meetups')
      .select(
        `
        *,
        profiles!organizer_id (id, nickname, avatar_url, gender, birth_date),
        meetup_joins (status, applicant_id)
      `,
      )
      .eq('place_id', placeId)
      .eq('status', 'open')
      .gt('scheduled_at', now)
      .order('scheduled_at', { ascending: true });
    setMeetups((data as any[]) ?? []);
  }

  useEffect(() => {
    loadMeetups();
  }, []);

  // ── 미팅 선택 (상세/신청) ──────────────────────────────────────────────────

  async function openDetail(m: Meetup) {
    setSelected(m);
    if (m.organizer_id === userId) {
      // 주최자 → 신청 목록 로드
      const { data } = await supabase
        .from('meetup_joins')
        .select(
          '*, profiles!applicant_id (id, nickname, avatar_url, gender, birth_date)',
        )
        .eq('meetup_id', m.id)
        .order('created_at', { ascending: true });
      setJoins((data as any[]) ?? []);
      setView('manage');
    } else {
      setView('detail');
    }
  }

  // ── 수락/거절/언매치 ────────────────────────────────────────────────────────

  async function updateJoinStatus(
    joinId: string,
    status: 'accepted' | 'rejected' | 'unmatched',
  ) {
    await supabase.from('meetup_joins').update({ status }).eq('id', joinId);
    setJoins((j) => j.map((x) => (x.id === joinId ? { ...x, status } : x)));

    // 수락 → 모집 인원 충족 시 자동 마감
    if (status === 'accepted' && selected) {
      const accepted =
        joins.filter((x) => x.status === 'accepted' || x.id === joinId).length +
        1;
      if (selected.wanted_count && accepted >= selected.wanted_count) {
        await supabase
          .from('place_meetups')
          .update({ status: 'closed' })
          .eq('id', selected.id);
        setSelected((s) => (s ? { ...s, status: 'closed' } : s));
      }
    }
  }

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          {view !== 'list' && (
            <button
              onClick={() => setView('list')}
              className="p-1 mr-2 text-gray-400"
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 12H5M12 5l-7 7 7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <h2 className="text-base font-bold text-gray-900 flex-1">
            {view === 'list' && t('title')}
            {view === 'create' && t('create')}
            {view === 'detail' && t('detail.openThread')}
            {view === 'join' && t('join.title')}
            {view === 'manage' && t('manage.title')}
            {view === 'thread' && t('thread.title')}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400">
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto flex-1 pb-6">
          {view === 'list' && (
            <MeetupList
              meetups={meetups}
              userId={userId}
              canParticipate={canParticipate}
              onSelect={openDetail}
              onCreate={() => setView('create')}
            />
          )}
          {view === 'create' && (
            <MeetupCreateForm
              placeId={placeId}
              userId={userId}
              myAgeGroup={myAgeGroup}
              myGender={userGender}
              onDone={async () => {
                await loadMeetups();
                setView('list');
              }}
            />
          )}

          {view === 'detail' && selected && (
            <MeetupDetailView
              meetup={selected}
              userId={userId}
              myAgeGroup={myAgeGroup}
              myGender={userGender}
              myNationality={userNationality}
              canParticipate={canParticipate}
              onJoin={() => setView('join')}
              onThread={() => setView('thread')}
            />
          )}
          {view === 'join' && selected && (
            <MeetupJoinForm
              meetup={selected}
              userId={userId}
              myAgeGroup={myAgeGroup}
              myGender={userGender}
              onDone={async () => {
                await loadMeetups();
                setView('list');
              }}
            />
          )}
          {view === 'manage' && selected && (
            <MeetupManageView
              meetup={selected}
              joins={joins}
              userId={userId}
              onUpdateStatus={updateJoinStatus}
              onThread={() => setView('thread')}
              onClose={() =>
                supabase
                  .from('place_meetups')
                  .update({ status: 'closed' })
                  .eq('id', selected.id)
                  .then(() => {
                    loadMeetups();
                    setView('list');
                  })
              }
            />
          )}
          {view === 'thread' && selected && (
            <MeetupThread meetup={selected} userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 목록 뷰 ─────────────────────────────────────────────────────────────────

function MeetupList({
  meetups,
  userId,
  canParticipate,
  onSelect,
  onCreate,
}: {
  meetups: Meetup[];
  userId: string;
  canParticipate: boolean;
  onSelect: (m: Meetup) => void;
  onCreate: () => void;
}) {
  const t = useTranslations('meetup');
  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      {canParticipate ? (
        <button
          onClick={onCreate}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium"
        >
          {t('createButton')}
        </button>
      ) : (
        <div className="w-full py-3 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
          {t('restrictionMsg')}
        </div>
      )}

      {meetups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {t('noMeetups')}
        </div>
      ) : (
        meetups.map((m) => {
          const myJoin = m.meetup_joins?.find((j) => j.applicant_id === userId);
          const isOrganizer = m.organizer_id === userId;
          return (
            <div
              key={m.id}
              onClick={() => onSelect(m)}
              className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer active:bg-gray-50"
            >
              {/* 상단: 시간 + 주최자 */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-900">
                  {formatScheduled(m.scheduled_at)}
                </span>
                <div className="flex items-center gap-1.5">
                  {m.profiles.avatar_url ? (
                    <img
                      src={m.profiles.avatar_url}
                      className="w-5 h-5 rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                      {m.profiles.nickname[0]}
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    {m.profiles.nickname}
                  </span>
                  {isOrganizer && (
                    <span className="text-xs text-blue-500 font-medium">
                      {t('myMeetup')}
                    </span>
                  )}
                </div>
              </div>

              {/* 우리 측 */}
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                  우리 {m.host_count}명
                </span>
                {m.host_gender && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                    {t(`gender.${m.host_gender}`)}
                  </span>
                )}
                {m.host_age_groups.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700"
                  >
                    {t(`ageGroup.${a}`)}
                  </span>
                ))}
                {m.activities.slice(0, 2).map((a) => (
                  <span
                    key={a}
                    className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600"
                  >
                    {t(`activity.${a}`)}
                  </span>
                ))}
                {m.vibe && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600">
                    {t(`vibe.${m.vibe}`)}
                  </span>
                )}
              </div>

              {/* 원하는 상대 */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-400">
                  {t('wantedLabel')}
                </span>
                <span className="text-xs text-gray-600">
                  {t(`gender.${m.wanted_gender}`)}
                </span>
                {m.wanted_age_groups?.map((a) => (
                  <span key={a} className="text-xs text-gray-600">
                    {t(`ageGroup.${a}`)}
                  </span>
                ))}
                {m.wanted_count && (
                  <span className="text-xs text-gray-600">
                    {m.wanted_count}명
                  </span>
                )}
              </div>

              {/* 신청 상태 배지 */}
              {myJoin && (
                <div className="mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      myJoin.status === 'accepted'
                        ? 'bg-green-100 text-green-700'
                        : myJoin.status === 'rejected'
                          ? 'bg-red-50 text-red-500'
                          : myJoin.status === 'unmatched'
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-yellow-50 text-yellow-600'
                    }`}
                  >
                    {myJoin.status === 'accepted'
                      ? t('status.accepted')
                      : myJoin.status === 'rejected'
                        ? t('status.rejected')
                        : myJoin.status === 'unmatched'
                          ? t('status.unmatched')
                          : t('status.pending')}
                  </span>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── 만들기 폼 ────────────────────────────────────────────────────────────────

function MeetupCreateForm({
  placeId,
  userId,
  myAgeGroup,
  myGender,
  onDone,
}: {
  placeId: string;
  userId: string;
  myAgeGroup: string | null;
  myGender: string | null;
  onDone: () => void;
}) {
  const supabase = createClient();
  const t = useTranslations('meetup');
  const tCommon = useTranslations('common');

  const todayDate = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const defaultTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  };

  const [scheduledTime, setScheduledTime] = useState(defaultTime());
  const scheduledAt = `${todayDate()}T${scheduledTime}:00`;
  const [hostCount, setHostCount] = useState(1);
  const [hostGender, setHostGender] = useState<string>(
    myGender === 'female' ? 'female' : myGender === 'male' ? 'male' : 'mixed',
  );
  const [hostAgeGroups, setHostAgeGroups] = useState<string[]>(
    myAgeGroup ? [myAgeGroup] : [],
  );
  const [activities, setActivities] = useState<string[]>([]);
  const [vibe, setVibe] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [wantedGender, setWantedGender] = useState<string>('any');
  const [wantedAgeGroups, setWantedAgeGroups] = useState<string[]>([]);
  const [wantedCount, setWantedCount] = useState<number | null>(null);
  const [wantedNationalities, setWantedNationalities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    scheduledAt && hostAgeGroups.length > 0 && activities.length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (containsProfanity(description)) { setError(tCommon('profanityError')); return; }
    setLoading(true);
    const { error: err } = await supabase.from('place_meetups').insert({
      place_id: placeId,
      organizer_id: userId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      host_count: hostCount,
      host_gender: hostGender,
      host_age_groups: hostAgeGroups,
      activities,
      vibe: vibe || null,
      description: description.trim() || null,
      wanted_gender: wantedGender,
      wanted_age_groups: wantedAgeGroups.length > 0 ? wantedAgeGroups : null,
      wanted_count: wantedCount,
      wanted_nationalities:
        wantedNationalities.length > 0 ? wantedNationalities : null,
    });
    if (err) {
      setError(t('form.saveFailed'));
      setLoading(false);
      return;
    }
    onDone();
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      {/* 날짜/시간 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {t('form.dateTime')}
        </p>
        <input
          type="time"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none bg-white"
        />
      </div>

      {/* 우리 측 */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-900">
          {t('form.ourTeam')}
        </p>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">
            {t('form.memberCount')}
          </p>
          <CountSelect value={hostCount} onChange={setHostCount} />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('form.genderComp')}</p>
          <ChipSelect
            options={GENDER_OPTS.map((g) => ({
              value: g.value,
              label: t(`gender.${g.value}`),
            }))}
            value={hostGender}
            onChange={setHostGender}
          />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('form.ageGroups')}</p>
          <MultiChipSelect
            options={AGE_GROUPS.map((a) => ({
              value: a.value,
              label: t(`ageGroup.${a.value}`),
            }))}
            values={hostAgeGroups}
            onChange={setHostAgeGroups}
          />
        </div>
      </div>

      {/* 활동 / 분위기 */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-900">
          {t('form.activitiesVibe')}
        </p>
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('form.whatToDo')}</p>
          <MultiChipSelect
            options={ACTIVITIES.map((a) => ({
              value: a.value,
              label: t(`activity.${a.value}`),
            }))}
            values={activities}
            onChange={setActivities}
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('form.vibe')}</p>
          <ChipSelect
            options={VIBES.map((v) => ({
              value: v.value,
              label: t(`vibe.${v.value}`),
            }))}
            value={vibe}
            onChange={(v) => setVibe((prev) => (prev === v ? null : v))}
          />
        </div>
      </div>

      {/* 한마디 */}
      <div>
        <p className="text-xs font-semibold text-gray-900 mb-2">
          {t('form.description')}
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 100))}
          placeholder={t('form.descriptionPlaceholder')}
          rows={2}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none"
        />
        <p className="text-right text-xs text-gray-300 mt-0.5">
          {description.length}/100
        </p>
      </div>

      {/* 원하는 상대 */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-900">
          {t('form.wantedConditions')}
        </p>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('form.gender')}</p>
          <ChipSelect
            options={WANTED_GENDER_OPTS.map((g) => ({
              value: g.value,
              label: t(`gender.${g.value}`),
            }))}
            value={wantedGender}
            onChange={setWantedGender}
          />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">
            {t('form.ageGroupsOptional')}
          </p>
          <MultiChipSelect
            options={AGE_GROUPS.map((a) => ({
              value: a.value,
              label: t(`ageGroup.${a.value}`),
            }))}
            values={wantedAgeGroups}
            onChange={setWantedAgeGroups}
          />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">
            {t('form.countOptional')}
          </p>
          <div className="flex gap-1.5">
            {COUNT_OPTS.map((n) => (
              <button
                key={n}
                onClick={() =>
                  setWantedCount((prev) => (prev === n ? null : n))
                }
                className={`w-10 h-10 rounded-xl text-sm font-medium border transition-colors ${
                  wantedCount === n
                    ? 'bg-gray-900 text-white border-transparent'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setWantedCount((prev) => (prev === 5 ? null : 5))}
              className={`px-3 h-10 rounded-xl text-sm font-medium border transition-colors ${
                (wantedCount ?? 0) >= 5
                  ? 'bg-gray-900 text-white border-transparent'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              5+
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">
            {t('form.nationalityOptional')}
          </p>
          <MultiChipSelect
            options={NATIONALITY_OPTS}
            values={wantedNationalities}
            onChange={setWantedNationalities}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
      >
        {loading ? t('form.saving') : t('form.submit')}
      </button>
    </div>
  );
}

// ─── 상세 뷰 (신청자용) ───────────────────────────────────────────────────────

function MeetupDetailView({
  meetup,
  userId,
  myAgeGroup,
  myGender,
  myNationality,
  canParticipate,
  onJoin,
  onThread,
}: {
  meetup: Meetup;
  userId: string;
  myAgeGroup: string | null;
  myGender: string | null;
  myNationality: string | null;
  canParticipate: boolean;
  onJoin: () => void;
  onThread: () => void;
}) {
  const t = useTranslations('meetup');
  const myJoin = meetup.meetup_joins?.find((j) => j.applicant_id === userId);
  const isUnmatched =
    myJoin?.status === 'unmatched' || myJoin?.status === 'rejected';
  const isPending = myJoin?.status === 'pending';
  const isAccepted = myJoin?.status === 'accepted';

  // 조건 미충족 여부
  const natMismatch =
    meetup.wanted_nationalities && myNationality
      ? !meetup.wanted_nationalities.includes(myNationality)
      : false;
  const genderMismatch =
    meetup.wanted_gender !== 'any' && myGender
      ? meetup.wanted_gender !== myGender
      : false;
  const conditionBlocked = natMismatch || genderMismatch;

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* 주최자 프로필 카드 */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
        {meetup.profiles.avatar_url ? (
          <img
            src={meetup.profiles.avatar_url}
            className="w-12 h-12 rounded-full object-cover"
            alt=""
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg text-gray-400">
            {meetup.profiles.nickname[0]}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-gray-900">
            {meetup.profiles.nickname}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
            {meetup.profiles.gender && (
              <span>
                {meetup.profiles.gender === 'female'
                  ? t('gender.female')
                  : meetup.profiles.gender === 'male'
                    ? t('gender.male')
                    : t('gender.other')}
              </span>
            )}
            {meetup.profiles.birth_date && (
              <span>{calcAge(meetup.profiles.birth_date)}세</span>
            )}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs font-semibold text-gray-900">
            {formatScheduled(meetup.scheduled_at)}
          </p>
        </div>
      </div>

      {/* 우리 팀 정보 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {t('detail.hostTeam')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            {meetup.host_count}명
          </span>
          {meetup.host_gender && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              {t(`gender.${meetup.host_gender}`)}
            </span>
          )}
          {meetup.host_age_groups.map((a) => (
            <span
              key={a}
              className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
            >
              {t(`ageGroup.${a}`)}
            </span>
          ))}
          {meetup.activities.map((a) => (
            <span
              key={a}
              className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-600"
            >
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
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {t('detail.wantedPartner')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            {t(`gender.${meetup.wanted_gender}`)}
          </span>
          {meetup.wanted_age_groups?.map((a) => (
            <span
              key={a}
              className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
            >
              {t(`ageGroup.${a}`)}
            </span>
          ))}
          {meetup.wanted_count && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              {meetup.wanted_count}명
            </span>
          )}
          {meetup.wanted_nationalities?.map((n) => (
            <span
              key={n}
              className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
            >
              {NATIONALITY_OPTS.find((o) => o.value === n)?.label ?? n}
            </span>
          ))}
        </div>
      </div>

      {/* 한마디 */}
      {meetup.description && (
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">{meetup.description}</p>
        </div>
      )}

      {/* 신청/스레드 버튼 */}
      {isAccepted ? (
        <button
          onClick={onThread}
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
          {natMismatch
            ? t('detail.conditionMismatchNat')
            : t('detail.conditionMismatchGender')}
        </div>
      ) : !canParticipate ? (
        <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm text-center">
          {t('detail.restrictionNotMet')}
        </div>
      ) : isPending ? (
        <div className="w-full py-3.5 bg-yellow-50 text-yellow-600 rounded-xl text-sm text-center">
          {t('detail.inReview')}
        </div>
      ) : (
        <button
          onClick={onJoin}
          className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium"
        >
          {t('detail.applyButton')}
        </button>
      )}
    </div>
  );
}

// ─── 신청 폼 (신청자용) ───────────────────────────────────────────────────────

function MeetupJoinForm({
  meetup,
  userId,
  myAgeGroup,
  myGender,
  onDone,
}: {
  meetup: Meetup;
  userId: string;
  myAgeGroup: string | null;
  myGender: string | null;
  onDone: () => void;
}) {
  const supabase = createClient();
  const t = useTranslations('meetup');
  const tCommon = useTranslations('common');
  const [joinCount, setJoinCount] = useState(1);
  const [joinGender, setJoinGender] = useState<string>(
    myGender === 'female' ? 'female' : myGender === 'male' ? 'male' : 'mixed',
  );
  const [joinAgeGroups, setJoinAgeGroups] = useState<string[]>(
    myAgeGroup ? [myAgeGroup] : [],
  );
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (joinAgeGroups.length === 0) {
      setError(t('join.selectAgeGroup'));
      return;
    }
    if (containsProfanity(message)) {
      setError(tCommon('profanityError'));
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.from('meetup_joins').insert({
      meetup_id: meetup.id,
      applicant_id: userId,
      join_count: joinCount,
      join_gender: joinGender,
      join_age_groups: joinAgeGroups,
      message: message.trim() || null,
    });
    if (err) {
      setError(t('join.failed'));
      setLoading(false);
      return;
    }
    onDone();
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold text-gray-900 mb-3">
          {t('join.title')}
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('join.ourCount')}</p>
            <CountSelect value={joinCount} onChange={setJoinCount} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">
              {t('join.genderComp')}
            </p>
            <ChipSelect
              options={GENDER_OPTS.map((g) => ({
                value: g.value,
                label: t(`gender.${g.value}`),
              }))}
              value={joinGender}
              onChange={setJoinGender}
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">
              {t('join.ageGroups')}
            </p>
            <MultiChipSelect
              options={AGE_GROUPS.map((a) => ({
                value: a.value,
                label: t(`ageGroup.${a.value}`),
              }))}
              values={joinAgeGroups}
              onChange={setJoinAgeGroups}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-900 mb-2">
          {t('join.description')}
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 80))}
          placeholder={t('join.descriptionPlaceholder')}
          rows={2}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none"
        />
        <p className="text-right text-xs text-gray-300 mt-0.5">
          {message.length}/80
        </p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
      >
        {loading ? t('join.submitting') : t('join.submit')}
      </button>
    </div>
  );
}

// ─── 관리 뷰 (주최자용) ───────────────────────────────────────────────────────

function MeetupManageView({
  meetup,
  joins,
  userId,
  onUpdateStatus,
  onThread,
  onClose,
}: {
  meetup: Meetup;
  joins: JoinRow[];
  userId: string;
  onUpdateStatus: (
    id: string,
    status: 'accepted' | 'rejected' | 'unmatched',
  ) => void;
  onThread: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('meetup');
  const pending = joins.filter((j) => j.status === 'pending');
  const accepted = joins.filter((j) => j.status === 'accepted');
  const others = joins.filter(
    (j) => j.status === 'rejected' || j.status === 'unmatched',
  );

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* 내 만남 요약 */}
      <div className="p-3 bg-gray-50 rounded-xl flex flex-wrap gap-1.5">
        <span className="text-xs text-gray-600 font-medium">
          {formatScheduled(meetup.scheduled_at)}
        </span>
        {meetup.activities.map((a) => (
          <span key={a} className="text-xs text-gray-500">
            {t(`activity.${a}`)}
          </span>
        ))}
        {meetup.status === 'closed' && (
          <span className="ml-auto text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
            {t('manage.closed')}
          </span>
        )}
      </div>

      {/* 신청 대기 */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-900 mb-2">{`${t('manage.pending')} ${pending.length}`}</p>
          {pending.map((j) => (
            <JoinCard
              key={j.id}
              join={j}
              onAccept={() => onUpdateStatus(j.id, 'accepted')}
              onReject={() => onUpdateStatus(j.id, 'rejected')}
            />
          ))}
        </div>
      )}

      {/* 수락된 신청 */}
      {accepted.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-900 mb-2">{`${t('manage.accepted')} ${accepted.length}`}</p>
          {accepted.map((j) => (
            <div
              key={j.id}
              className="flex items-center gap-3 p-3 border border-green-100 rounded-xl mb-2"
            >
              <JoinInfo join={j} />
              <button
                onClick={() => onUpdateStatus(j.id, 'unmatched')}
                className="ml-auto text-xs text-gray-300 px-2 py-1 border border-gray-200 rounded-lg"
              >
                {t('manage.unmatchBtn')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 거절/언매치 */}
      {others.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">
            {t('manage.rejectUnmatch')}
          </p>
          {others.map((j) => (
            <div
              key={j.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2 opacity-50"
            >
              <JoinInfo join={j} />
              <span className="ml-auto text-xs text-gray-400">
                {j.status === 'rejected'
                  ? t('manage.reject')
                  : t('manage.unmatch')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onThread}
          className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium"
        >
          {t('manage.openThread')}
        </button>
        {meetup.status === 'open' && (
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm"
          >
            {t('manage.closeBtn')}
          </button>
        )}
      </div>

      {pending.length === 0 && accepted.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          {t('manage.noApplicants')}
        </div>
      )}
    </div>
  );
}

function JoinInfo({ join }: { join: JoinRow }) {
  const t = useTranslations('meetup');
  const router = useRouter();
  return (
    <div
      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
      onClick={() => router.push(`/profile/${join.profiles.id}`)}
    >
      {join.profiles.avatar_url ? (
        <img
          src={join.profiles.avatar_url}
          className="w-9 h-9 rounded-full object-cover shrink-0"
          alt=""
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-400 shrink-0">
          {join.profiles.nickname[0]}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {join.profiles.nickname}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-400">{join.join_count}명</span>
          {join.join_gender && (
            <span className="text-xs text-gray-400">
              {t(`gender.${join.join_gender}`)}
            </span>
          )}
          {join.join_age_groups.map((a) => (
            <span key={a} className="text-xs text-gray-400">
              {t(`ageGroup.${a}`)}
            </span>
          ))}
        </div>
        {join.message && (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {join.message}
          </p>
        )}
      </div>
    </div>
  );
}

function JoinCard({
  join,
  onAccept,
  onReject,
}: {
  join: JoinRow;
  onAccept: () => void;
  onReject: () => void;
}) {
  const t = useTranslations('meetup');
  return (
    <div className="p-3 border border-gray-100 rounded-xl mb-2">
      <div className="flex items-start gap-2 mb-3">
        <JoinInfo join={join} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onReject}
          className="flex-1 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs"
        >
          {t('manage.reject')}
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-xs"
        >
          {t('manage.accept')}
        </button>
      </div>
    </div>
  );
}

// ─── 스레드 뷰 ────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles: { id: string; nickname: string; avatar_url: string | null };
}

function MeetupThread({ meetup, userId }: { meetup: Meetup; userId: string }) {
  const supabase = createClient();
  const t = useTranslations('meetup');
  const tCommon = useTranslations('common');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [sendError, setSendError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // 번개는 당일만 생성 가능 → 스레드 항상 오픈
  const isOpen = true;

  useEffect(() => {
    if (!isOpen) return;
    loadMessages();

    // 실시간 구독
    const channel = supabase
      .channel(`meetup_messages:${meetup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetup_messages',
          filter: `meetup_id=eq.${meetup.id}`,
        },
        (payload) => {
          // 새 메시지 추가 (sender 프로필은 별도 fetch)
          supabase
            .from('meetup_messages')
            .select('*, profiles!sender_id(id, nickname, avatar_url)')
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) setMessages((prev) => [...prev, data as any]);
            });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from('meetup_messages')
      .select('*, profiles!sender_id(id, nickname, avatar_url)')
      .eq('meetup_id', meetup.id)
      .order('created_at', { ascending: true });
    setMessages((data as any[]) ?? []);
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    if (containsProfanity(text)) { setSendError(tCommon('profanityError')); return; }
    setSendError('');
    setSending(true);
    const { error } = await supabase.from('meetup_messages').insert({
      meetup_id: meetup.id,
      sender_id: userId,
      content: text.trim(),
    });
    if (error) {
      if (error.code === '42501') setLocked(true); // RLS 차단 (아직 오픈 안됨)
    } else {
      setText('');
    }
    setSending(false);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  if (!isOpen) {
    // 번개 날짜까지 남은 날 계산
    const meetupDate = new Date(meetup.scheduled_at);
    const diffMs = meetupDate.getTime() - Date.now();
    const diffDays = Math.floor(diffMs / 86400000);
    const diffH = Math.floor((diffMs % 86400000) / 3600000);
    const diffM = Math.floor((diffMs % 3600000) / 60000);
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">
          {t('thread.openOnDay')}
        </p>
        <p className="text-xs text-gray-400">
          {diffDays > 0
            ? t('thread.daysUntil', { days: diffDays, hours: diffH })
            : diffH > 0
              ? t('thread.hoursUntil', { hours: diffH, minutes: diffM })
              : t('thread.minutesUntil', { minutes: diffM })}
        </p>
        <p className="text-xs text-gray-400">
          {formatScheduled(meetup.scheduled_at)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(70vh - 120px)' }}>
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            {t('thread.firstMessage')}
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
            >
              {!isMe &&
                (msg.profiles.avatar_url ? (
                  <img
                    src={msg.profiles.avatar_url}
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                    alt=""
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 shrink-0">
                    {msg.profiles.nickname[0]}
                  </div>
                ))}
              <div
                className={`flex flex-col gap-0.5 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-xs text-gray-400 px-1">
                    {msg.profiles.nickname}
                  </span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-300 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        {locked ? (
          <div className="flex-1 text-center text-xs text-gray-400 py-2">
            {t('thread.cannotSend')}
          </div>
        ) : (
          <>
            {sendError && <p className="w-full text-xs text-red-500 px-1">{sendError}</p>}
            <input
              type="text"
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, 300)); setSendError('') }}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && handleSend()
              }
              placeholder={t('thread.placeholder')}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
            >
              {t('thread.send')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
