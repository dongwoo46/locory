'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Reporter {
  id: string
  nickname: string
  avatar_url: string | null
  trust_score: number
}

interface Report {
  id: string
  target_type: 'post' | 'place' | 'user'
  target_id: string
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
  reporter: Reporter
}

interface Inquiry {
  id: string
  title: string
  content: string
  status: 'pending' | 'resolved'
  response: string | null
  created_at: string
  resolved_at: string | null
  user: Reporter
}

interface AdminPost {
  id: string
  type: string
  rating: string | null
  memo: string | null
  photos: string[]
  created_at: string
  deleted_at: string | null
  is_public: boolean
  places: { id: string; name: string; city: string } | null
  profiles: { id: string; nickname: string; avatar_url: string | null } | null
}

interface AdminPlace {
  id: string
  name: string
  category: string
  city: string
  district: string | null
  place_type: string
  avg_rating: number | null
  deleted_at: string | null
  created_at: string
  address: string | null
}

interface AdminUser {
  id: string
  nickname: string
  avatar_url: string | null
  role: string
  trust_score: number
  is_public: boolean
  nationality: string | null
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-400',
}
const STATUS_LABEL: Record<string, string> = { pending: '대기', resolved: '완료', dismissed: '무시' }
const TARGET_LABEL: Record<string, string> = { post: '포스팅', place: '장소', user: '유저' }

const INQUIRY_CATEGORY_LABEL: Record<string, string> = {
  bug: '🐛 버그', account: '👤 계정', content: '📝 콘텐츠',
  points: '⭐ 포인트', suggestion: '💡 제안', other: '기타',
}

const CATEGORY_LABEL: Record<string, string> = {
  cafe: '카페', restaurant: '맛집', photospot: '포토스팟', bar: '바',
  culture: '문화', nature: '자연', shopping: '쇼핑', street: '거리',
}

const CITY_LABEL: Record<string, string> = {
  seoul: '서울', busan: '부산', jeju: '제주', gyeongju: '경주',
  jeonju: '전주', gangneung: '강릉', sokcho: '속초', yeosu: '여수', incheon: '인천',
}

export default function AdminClient() {
  const router = useRouter()
  const [tab, setTab] = useState<'reports' | 'inquiries' | 'posts' | 'places' | 'users'>('reports')
  const [reports, setReports] = useState<Report[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const [deductPoints, setDeductPoints] = useState<Record<string, number>>({})
  const [responseText, setResponseText] = useState<Record<string, string>>({})

  // 신고 필터
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('pending')
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all')
  const [minReportCount, setMinReportCount] = useState<number>(1)
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('pending')
  const [inquiryCategoryFilter, setInquiryCategoryFilter] = useState<string>('all')

  // 포스팅 관리
  const [adminPosts, setAdminPosts] = useState<AdminPost[]>([])
  const [postsSearch, setPostsSearch] = useState('')
  const [postsShowDeleted, setPostsShowDeleted] = useState(false)
  const [postsLoading, setPostsLoading] = useState(false)

  // 장소 관리
  const [adminPlaces, setAdminPlaces] = useState<AdminPlace[]>([])
  const [placesSearch, setPlacesSearch] = useState('')
  const [placesShowDeleted, setPlacesShowDeleted] = useState(false)
  const [placesLoading, setPlacesLoading] = useState(false)
  const [editingPlace, setEditingPlace] = useState<string | null>(null)
  const [placeEditData, setPlaceEditData] = useState<Record<string, any>>({})

  // 사용자 관리
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [usersSearch, setUsersSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [userEditData, setUserEditData] = useState<Record<string, any>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/data')
    if (res.ok) {
      const data = await res.json()
      setReports(data.reports)
      setInquiries(data.inquiries)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function fetchPosts() {
    setPostsLoading(true)
    const params = new URLSearchParams()
    if (postsSearch) params.set('search', postsSearch)
    if (postsShowDeleted) params.set('deleted', 'true')
    const res = await fetch(`/api/admin/posts?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAdminPosts(data.posts)
    }
    setPostsLoading(false)
  }

  async function fetchPlaces() {
    setPlacesLoading(true)
    const params = new URLSearchParams()
    if (placesSearch) params.set('search', placesSearch)
    if (placesShowDeleted) params.set('deleted', 'true')
    const res = await fetch(`/api/admin/places?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAdminPlaces(data.places)
    }
    setPlacesLoading(false)
  }

  async function fetchUsers() {
    setUsersLoading(true)
    const params = new URLSearchParams()
    if (usersSearch) params.set('search', usersSearch)
    const res = await fetch(`/api/admin/users?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAdminUsers(data.users)
    }
    setUsersLoading(false)
  }

  useEffect(() => {
    if (tab === 'posts') fetchPosts()
    else if (tab === 'places') fetchPlaces()
    else if (tab === 'users') fetchUsers()
  }, [tab])

  const pendingReports = reports.filter(r => r.status === 'pending').length
  const pendingInquiries = inquiries.filter(i => i.status === 'pending').length

  const reportCountByTarget = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.target_id] = (acc[r.target_id] || 0) + 1
    return acc
  }, {})

  async function handleReportAction(reportId: string, action: 'resolve' | 'dismiss') {
    setActionLoading(reportId + action)
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_note: adminNote[reportId] }),
    })
    setActionLoading(null)
    fetchData()
  }

  async function handleDeleteTarget(reportId: string, type: 'post' | 'place', targetId: string) {
    if (!confirm(`이 ${TARGET_LABEL[type]}을 삭제할까요?`)) return
    setActionLoading(reportId + 'delete')
    const res = await fetch(`/api/admin/${type}s/${targetId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`삭제 실패: ${data.error || res.status}`)
      setActionLoading(null)
      return
    }
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', admin_note: `${TARGET_LABEL[type]} 삭제` }),
    })
    setActionLoading(null)
    fetchData()
  }

  async function handleDeductPoints(reportId: string, userId: string) {
    const points = deductPoints[reportId] || 10
    if (!confirm(`${points}점 차감할까요?`)) return
    setActionLoading(reportId + 'deduct')
    await fetch(`/api/admin/users/${userId}/deduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', admin_note: `${points}점 차감` }),
    })
    setActionLoading(null)
    fetchData()
  }

  async function handleInquiryRespond(inquiryId: string) {
    const response = responseText[inquiryId]?.trim()
    if (!response) return
    setActionLoading(inquiryId)
    await fetch(`/api/admin/inquiries/${inquiryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })
    setActionLoading(null)
    fetchData()
  }

  async function handleDeletePost(postId: string) {
    if (!confirm('포스팅을 삭제할까요?')) return
    setActionLoading(postId + 'del')
    await fetch(`/api/admin/posts/${postId}`, { method: 'DELETE' })
    setActionLoading(null)
    fetchPosts()
  }

  async function handleRestorePost(postId: string) {
    setActionLoading(postId + 'res')
    await fetch(`/api/admin/posts/${postId}`, { method: 'PATCH' })
    setActionLoading(null)
    fetchPosts()
  }

  async function handleDeletePlace(placeId: string) {
    if (!confirm('장소를 삭제할까요?')) return
    setActionLoading(placeId + 'del')
    await fetch(`/api/admin/places/${placeId}`, { method: 'DELETE' })
    setActionLoading(null)
    fetchPlaces()
  }

  async function handleRestorePlace(placeId: string) {
    setActionLoading(placeId + 'res')
    await fetch(`/api/admin/places/${placeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    setActionLoading(null)
    fetchPlaces()
  }

  async function handleSavePlace(placeId: string) {
    setActionLoading(placeId + 'save')
    await fetch(`/api/admin/places/${placeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(placeEditData[placeId] || {}),
    })
    setActionLoading(null)
    setEditingPlace(null)
    fetchPlaces()
  }

  async function handleSaveUser(userId: string) {
    setActionLoading(userId + 'save')
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userEditData[userId] || {}),
    })
    setActionLoading(null)
    setEditingUser(null)
    fetchUsers()
  }

  const TABS = [
    { key: 'reports', label: '신고', badge: pendingReports, badgeColor: 'bg-red-500' },
    { key: 'inquiries', label: '문의', badge: pendingInquiries, badgeColor: 'bg-blue-500' },
    { key: 'posts', label: '포스팅', badge: 0, badgeColor: '' },
    { key: 'places', label: '장소', badge: 0, badgeColor: '' },
    { key: 'users', label: '사용자', badge: 0, badgeColor: '' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto flex items-center h-11 px-3 gap-2">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-sm font-bold text-gray-900">어드민</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto pt-11 pb-10">
        {/* 탭 */}
        <div className="flex border-b border-gray-200 bg-white sticky top-11 z-30 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[60px] py-2.5 text-xs font-medium relative whitespace-nowrap ${tab === t.key ? 'text-gray-900' : 'text-gray-400'}`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 ${t.badgeColor} text-white text-[10px] rounded-full`}>
                  {t.badge}
                </span>
              )}
              {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />}
            </button>
          ))}
        </div>

        {/* 신고 탭 */}
        {tab === 'reports' && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1 flex-wrap">
                  {(['pending','resolved','dismissed','all'] as const).map(s => (
                    <button key={s} onClick={() => setReportStatusFilter(s)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${reportStatusFilter === s ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>
                      {s === 'all' ? '전체' : STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(['all','post','place','user'] as const).map(t => (
                    <button key={t} onClick={() => setReportTypeFilter(t)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${reportTypeFilter === t ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>
                      {t === 'all' ? '전체' : TARGET_LABEL[t]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">누적</span>
                  {[1,2,3,5].map(n => (
                    <button key={n} onClick={() => setMinReportCount(n)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${minReportCount === n ? 'bg-red-500 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>
                      {n}건+
                    </button>
                  ))}
                </div>
              </div>
              {reports
                .filter(r => reportStatusFilter === 'all' || r.status === reportStatusFilter)
                .filter(r => reportTypeFilter === 'all' || r.target_type === reportTypeFilter)
                .filter(r => (reportCountByTarget[r.target_id] || 1) >= minReportCount)
                .length === 0 && <p className="text-center text-xs text-gray-400 py-8">해당 신고 없음</p>}
              {reports
                .filter(r => reportStatusFilter === 'all' || r.status === reportStatusFilter)
                .filter(r => reportTypeFilter === 'all' || r.target_type === reportTypeFilter)
                .filter(r => (reportCountByTarget[r.target_id] || 1) >= minReportCount)
                .map(report => (
                <div key={report.id} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                    onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  >
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[report.status]}`}>
                      {STATUS_LABEL[report.status]}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full shrink-0">
                      {TARGET_LABEL[report.target_type]}
                    </span>
                    {(reportCountByTarget[report.target_id] || 1) > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-bold shrink-0">
                        {reportCountByTarget[report.target_id]}건
                      </span>
                    )}
                    <span className="text-xs text-gray-600 flex-1 truncate">{report.reporter?.nickname}</span>
                    <span className="text-[10px] text-gray-300 shrink-0">
                      {new Date(report.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                    </span>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                      className={`shrink-0 transition-transform ${expandedId === report.id ? 'rotate-180' : ''}`}>
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {expandedId === report.id && (
                    <div className="px-3 pb-3 flex flex-col gap-2 border-t border-gray-50">
                      <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-2 mt-2">{report.reason}</p>
                      <p className="text-[10px] text-gray-400 font-mono bg-gray-50 rounded-lg px-2.5 py-1.5 break-all">{report.target_id}</p>

                      {report.status === 'pending' && (
                        <>
                          <input
                            type="text"
                            value={adminNote[report.id] || ''}
                            onChange={e => setAdminNote(n => ({ ...n, [report.id]: e.target.value }))}
                            placeholder="메모 (선택)"
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1">
                              <span className="text-[10px] text-gray-500">차감</span>
                              <input
                                type="number"
                                value={deductPoints[report.id] || 10}
                                onChange={e => setDeductPoints(p => ({ ...p, [report.id]: Number(e.target.value) }))}
                                className="w-9 text-[10px] text-center outline-none"
                                min={1} max={100}
                              />
                              <span className="text-[10px] text-gray-500">점</span>
                              <button
                                onClick={() => handleDeductPoints(report.id, report.target_type === 'user' ? report.target_id : report.reporter.id)}
                                disabled={actionLoading === report.id + 'deduct'}
                                className="text-[10px] px-2 py-0.5 bg-orange-500 text-white rounded font-medium disabled:opacity-40"
                              >차감</button>
                            </div>
                            {(report.target_type === 'post' || report.target_type === 'place') && (
                              <button
                                onClick={() => handleDeleteTarget(report.id, report.target_type as 'post' | 'place', report.target_id)}
                                disabled={actionLoading === report.id + 'delete'}
                                className="text-[10px] px-2 py-1 bg-red-500 text-white rounded-lg font-medium disabled:opacity-40"
                              >
                                {TARGET_LABEL[report.target_type]} 삭제
                              </button>
                            )}
                            <button
                              onClick={() => handleReportAction(report.id, 'resolve')}
                              disabled={actionLoading === report.id + 'resolve'}
                              className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-lg font-medium disabled:opacity-40"
                            >완료</button>
                            <button
                              onClick={() => handleReportAction(report.id, 'dismiss')}
                              disabled={actionLoading === report.id + 'dismiss'}
                              className="text-[10px] px-2 py-1 border border-gray-200 text-gray-500 rounded-lg font-medium disabled:opacity-40"
                            >무시</button>
                          </div>
                        </>
                      )}
                      {report.status !== 'pending' && report.admin_note && (
                        <p className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">{report.admin_note}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* 문의 탭 */}
        {tab === 'inquiries' && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1 flex-wrap">
                  {(['pending','resolved','all'] as const).map(s => (
                    <button key={s} onClick={() => setInquiryStatusFilter(s)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${inquiryStatusFilter === s ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>
                      {s === 'all' ? '전체' : STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(['all','bug','account','content','points','suggestion','other'] as const).map(c => (
                    <button key={c} onClick={() => setInquiryCategoryFilter(c)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${inquiryCategoryFilter === c ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>
                      {c === 'all' ? '전체' : INQUIRY_CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>
              {inquiries
                .filter(i => inquiryStatusFilter === 'all' || i.status === inquiryStatusFilter)
                .filter(i => inquiryCategoryFilter === 'all' || (i as any).category === inquiryCategoryFilter)
                .length === 0 && <p className="text-center text-xs text-gray-400 py-8">해당 문의 없음</p>}
              {inquiries
                .filter(i => inquiryStatusFilter === 'all' || i.status === inquiryStatusFilter)
                .filter(i => inquiryCategoryFilter === 'all' || (i as any).category === inquiryCategoryFilter)
                .map(inquiry => (
                <div key={inquiry.id} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                    onClick={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
                  >
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[inquiry.status]}`}>
                      {STATUS_LABEL[inquiry.status]}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                      {INQUIRY_CATEGORY_LABEL[(inquiry as any).category] || '기타'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{inquiry.title}</p>
                      <p className="text-[10px] text-gray-400">{inquiry.user?.nickname}</p>
                    </div>
                    <span className="text-[10px] text-gray-300 shrink-0">
                      {new Date(inquiry.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                    </span>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                      className={`shrink-0 transition-transform ${expandedId === inquiry.id ? 'rotate-180' : ''}`}>
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {expandedId === inquiry.id && (
                    <div className="px-3 pb-3 flex flex-col gap-2 border-t border-gray-50">
                      <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-2 mt-2 whitespace-pre-wrap">{inquiry.content}</p>
                      {inquiry.response && (
                        <p className="text-xs text-gray-700 bg-blue-50 rounded-lg px-2.5 py-2 whitespace-pre-wrap">{inquiry.response}</p>
                      )}
                      <textarea
                        value={responseText[inquiry.id] ?? (inquiry.response || '')}
                        onChange={e => setResponseText(t => ({ ...t, [inquiry.id]: e.target.value }))}
                        placeholder="답변 입력..."
                        rows={2}
                        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-400 resize-none"
                      />
                      <button
                        onClick={() => handleInquiryRespond(inquiry.id)}
                        disabled={actionLoading === inquiry.id || !responseText[inquiry.id]?.trim()}
                        className="w-full py-2 bg-gray-900 text-white text-xs rounded-lg font-medium disabled:opacity-40"
                      >
                        {actionLoading === inquiry.id ? '...' : '답변 전송'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* 포스팅 관리 탭 */}
        {tab === 'posts' && (
          <div className="px-3 py-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={postsSearch}
                onChange={e => setPostsSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchPosts()}
                placeholder="장소명, 닉네임, 메모 검색..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400"
              />
              <button onClick={fetchPosts} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-xl font-medium">검색</button>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => { setPostsShowDeleted(v => !v); }}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors ${postsShowDeleted ? 'bg-red-500 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
              >
                삭제된 포스팅
              </button>
              <button onClick={fetchPosts} className="text-[10px] text-gray-400 underline">새로고침</button>
            </div>
            {postsLoading ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
            ) : adminPosts.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">포스팅 없음</p>
            ) : (
              adminPosts.map(post => (
                <div key={post.id} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-2">
                  {post.photos?.[0] && (
                    <img src={post.photos[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {post.places?.name || '–'} <span className="text-gray-400 font-normal">{CITY_LABEL[post.places?.city || ''] || ''}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{post.profiles?.nickname} · {post.type}</p>
                    {post.memo && <p className="text-[10px] text-gray-400 truncate">{post.memo}</p>}
                    {post.deleted_at && <span className="text-[9px] text-red-500 font-medium">삭제됨</span>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {post.deleted_at ? (
                      <button
                        onClick={() => handleRestorePost(post.id)}
                        disabled={actionLoading === post.id + 'res'}
                        className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-lg font-medium disabled:opacity-40"
                      >복구</button>
                    ) : (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={actionLoading === post.id + 'del'}
                        className="text-[10px] px-2 py-1 bg-red-500 text-white rounded-lg font-medium disabled:opacity-40"
                      >삭제</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 장소 관리 탭 */}
        {tab === 'places' && (
          <div className="px-3 py-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={placesSearch}
                onChange={e => setPlacesSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchPlaces()}
                placeholder="장소명 검색..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400"
              />
              <button onClick={fetchPlaces} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-xl font-medium">검색</button>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => { setPlacesShowDeleted(v => !v); }}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors ${placesShowDeleted ? 'bg-red-500 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
              >
                삭제된 장소
              </button>
              <button onClick={fetchPlaces} className="text-[10px] text-gray-400 underline">새로고침</button>
            </div>
            {placesLoading ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
            ) : adminPlaces.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">장소 없음</p>
            ) : (
              adminPlaces.map(place => (
                <div key={place.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {editingPlace === place.id ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={placeEditData[place.id]?.name ?? place.name}
                            onChange={e => setPlaceEditData(d => ({ ...d, [place.id]: { ...d[place.id], name: e.target.value } }))}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                            placeholder="장소명"
                          />
                          <div className="flex gap-1">
                            <select
                              value={placeEditData[place.id]?.category ?? place.category}
                              onChange={e => setPlaceEditData(d => ({ ...d, [place.id]: { ...d[place.id], category: e.target.value } }))}
                              className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                            >
                              {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                            <select
                              value={placeEditData[place.id]?.city ?? place.city}
                              onChange={e => setPlaceEditData(d => ({ ...d, [place.id]: { ...d[place.id], city: e.target.value } }))}
                              className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                            >
                              {Object.entries(CITY_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {place.name} <span className="text-gray-400 font-normal">{CITY_LABEL[place.city] || place.city}</span>
                          </p>
                          <p className="text-[10px] text-gray-400">{CATEGORY_LABEL[place.category] || place.category}</p>
                          {place.deleted_at && <span className="text-[9px] text-red-500 font-medium">삭제됨</span>}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {place.deleted_at ? (
                        <button
                          onClick={() => handleRestorePlace(place.id)}
                          disabled={actionLoading === place.id + 'res'}
                          className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-lg font-medium disabled:opacity-40"
                        >복구</button>
                      ) : editingPlace === place.id ? (
                        <>
                          <button
                            onClick={() => handleSavePlace(place.id)}
                            disabled={actionLoading === place.id + 'save'}
                            className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-40"
                          >저장</button>
                          <button
                            onClick={() => setEditingPlace(null)}
                            className="text-[10px] px-2 py-1 border border-gray-200 text-gray-500 rounded-lg font-medium"
                          >취소</button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingPlace(place.id); setPlaceEditData(d => ({ ...d, [place.id]: {} })) }}
                            className="text-[10px] px-2 py-1 bg-blue-100 text-blue-600 rounded-lg font-medium"
                          >수정</button>
                          <button
                            onClick={() => handleDeletePlace(place.id)}
                            disabled={actionLoading === place.id + 'del'}
                            className="text-[10px] px-2 py-1 bg-red-500 text-white rounded-lg font-medium disabled:opacity-40"
                          >삭제</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 사용자 관리 탭 */}
        {tab === 'users' && (
          <div className="px-3 py-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={usersSearch}
                onChange={e => setUsersSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                placeholder="닉네임 검색..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400"
              />
              <button onClick={fetchUsers} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-xl font-medium">검색</button>
            </div>
            {usersLoading ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
            ) : adminUsers.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">사용자 없음</p>
            ) : (
              adminUsers.map(user => (
                <div key={user.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {editingUser === user.id ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-gray-500 shrink-0">역할</span>
                            <select
                              value={userEditData[user.id]?.role ?? user.role}
                              onChange={e => setUserEditData(d => ({ ...d, [user.id]: { ...d[user.id], role: e.target.value } }))}
                              className="px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </div>
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-gray-500 shrink-0">신뢰점수</span>
                            <input
                              type="number"
                              value={userEditData[user.id]?.trust_score ?? user.trust_score}
                              onChange={e => setUserEditData(d => ({ ...d, [user.id]: { ...d[user.id], trust_score: Number(e.target.value) } }))}
                              className="w-20 px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                              min={0}
                            />
                          </div>
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-gray-500 shrink-0">공개</span>
                            <button
                              onClick={() => setUserEditData(d => ({ ...d, [user.id]: { ...d[user.id], is_public: !(d[user.id]?.is_public ?? user.is_public) } }))}
                              className={`text-[10px] px-2 py-0.5 rounded border font-medium ${(userEditData[user.id]?.is_public ?? user.is_public) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                            >
                              {(userEditData[user.id]?.is_public ?? user.is_public) ? '공개' : '비공개'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {user.nickname}
                            {user.role === 'admin' && <span className="ml-1 text-[9px] bg-purple-100 text-purple-600 px-1 rounded">admin</span>}
                          </p>
                          <p className="text-[10px] text-gray-400">점수 {user.trust_score} · {user.is_public ? '공개' : '비공개'} · {user.nationality || '–'}</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {editingUser === user.id ? (
                        <>
                          <button
                            onClick={() => handleSaveUser(user.id)}
                            disabled={actionLoading === user.id + 'save'}
                            className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-40"
                          >저장</button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="text-[10px] px-2 py-1 border border-gray-200 text-gray-500 rounded-lg font-medium"
                          >취소</button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditingUser(user.id); setUserEditData(d => ({ ...d, [user.id]: {} })) }}
                          className="text-[10px] px-2 py-1 bg-blue-100 text-blue-600 rounded-lg font-medium"
                        >수정</button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
