# 기능 현황 & 비즈니스 로직

## 완료된 기능 목록
- 인증(Google OAuth), 온보딩(닉네임+국적+성별+생년월일)
- 포스팅 업로드 플로우: 장소→타입→사진(필수)→평점(visited만)→메모+공개여부+현지인추천
- 피드 (PostGrid 3열, 전체/팔로잉, 정렬, 필터: 카테고리/국적/성별/나이대/현지인추천/평점)
- 피드 사진 캐러셀 (좌우 화살표 + 점 인디케이터, 최대 3장)
- 피드 댓글 기능 (대댓글 없음, 내 댓글 삭제 가능, post_comments 테이블)
- 저장 페이지 (탭: 장소/포스팅/팔로잉, 도시 탭, 모달 필터)
- 지도 뷰 (MapClient) — 장소 검색(하이라이트 방식), 필터 패널(적용/초기화 버튼), 동선짜기 모드에서도 검색+필터 활성
- 장소 상세 (방문자 통계, 국적/평점 분포, ⚡버튼 → 번개 목록)
- 프로필 페이지 (PostGrid, 스타일 태그, 취향 도넛차트)
- 설정 페이지 (bio, 성별 1회변경, 생년월일, BottomNav 포함)
- 동선 짜기 (직접선택형 + AI추천형, Gemini 2.5 Flash Lite)
- PlaceAddSheet (검색/GPS/URL로 장소 저장), POI 탭 시 Places API로 이름/주소 자동입력
- 신뢰도(향도) 시스템 7단계
- 번개 기능 (MeetupSheet: 제목 필수, 전용 페이지들)
- 알림 시스템 (NotificationBell + /notifications) — DB 트리거로 자동 발송
- 어드민 페이지 (신고/문의 관리, soft delete, 포인트 차감)
- 피드 작성자 수정/삭제 (PostGrid 3-dot 메뉴 → edit bottom sheet + PATCH /api/posts/[id])
- 번개 필터 모달 (PlaceMeetupsClient — 필터 아이콘 → 바텀시트, 날짜 필터 포함)
- 현지인 추천 토글 (StepMemo — KR 국적만 활성화, 비KR은 잠금 표시)
- 번개 무한스크롤 (PAGE_SIZE=10, IntersectionObserver, 도시 필터 서버사이드)
- 포스트 피드 무한스크롤 (인스타그램 방식)

## 평점 라벨
- must_go: '또 가고싶은', worth_it: '한번은 와볼만해', neutral: '그냥그래', not_great: '별로야'
- avg_rating 표시 (숫자 없이 라벨만): ≥3.5=또 가고싶은, ≥2.5=한번은 와볼만해, ≥1.5=그냥그래, else=별로야

## 온보딩
- 필수: 닉네임 + 국적 + 성별 + 생년월일 (모두 필수)
- 완료 시 `onboarded=1` 쿠키 세팅(1년) → middleware 캐싱용
- middleware: 로그인됐지만 onboarded 쿠키 없으면 DB 확인 후 /onboarding 리다이렉트

## District 자동감지 패턴
- Geocoding 주소에서 `inferDistrictFromAddress()` 자동감지
- 감지 성공: 사용자에게 아무것도 표시 안 함 (조용히 저장)
- 감지 실패: 동네 선택 UI 노출 (StepPlace: 칩 목록 + "기타" → 텍스트 입력)
- `detectCity(lat, lng)`에 모든 지원 도시 포함 필수 (gangneung: 37.7~37.95 범위 — 주문진 포함)
- city 결정: `inferCityFromAddress(address) || detectCity(lat, lng)` 순서

## 현지인 추천 (is_local_recommendation)
- StepMemo에서만 토글 — KR 국적 사용자만 활성화
- `canLocalRecommend = userNationality === 'KR'`
- 비KR: 토글 노출하되 disabled + 🔒 + localRecLocked 메시지
- UploadFlow: `supabase.auth.getUser()` → `.eq('id', user.id)` 로 nationality 조회 (필수!)
- StepPlace: place_type 항상 'normal' (hidden spot 토글 없음)

## PlaceAddSheet 규칙
- 장소 저장 = place_saves만 생성. 포스트 자동 생성 없음
- GPS 탭: 역지오코딩으로 이름(동 수준)+동네 자동 추출

## 성별 변경 제한
- `gender_changed_at`이 있으면 변경 불가 (1회만 허용)

## 번개 기능 상세
- 주최/신청 조건: `is_public = true AND trust_score >= 3` (무취 이상)
- **제목(title) 필수**: MeetupCreateForm에서 40자 이내, canSubmit 조건 포함
- 채팅 접근: (role=organizer AND status=open) OR (role=applicant AND joinStatus=accepted)
- place_meetups.deleted_at: soft delete (status=closed + deleted_at=now())
- 주최자: 명시적 마감 버튼만 (수락 시 자동마감 없음), 마감 시 pending 전부 reject
- 마감 버튼: 모임 상세 페이지에서만 → 마감 confirm → pending reject → closed
- 삭제 버튼: 모임 상세 페이지 하단 (소프트딜리트)
- 번개 목록 카드: 아바타 왼쪽, 닉네임 굵게, 도시/동네 i18n 번역
- 번개 카드에 마감 버튼 없음 (상세 페이지에서만 처리)

## 번개 채팅
- MeetupInboxIcon: FeedClient/SavedClient 헤더, 미읽은 메시지 배지
- `meetup_chat_reads(meetup_id, user_id, last_read_at)`: 읽음 상태
- `blocks(blocker_id, blocked_id)`: 차단 관계
- Optimistic update: 메시지 즉시 표시 후 realtime 교체

## 알림 시스템
- 파일: `src/components/ui/NotificationBell.tsx`
- NotificationBell → router.push('/notifications') + 안읽음 빨간 배지
- notifications 타입: meetup_today/join_new/join_accepted/join_rejected/join_unmatched/message_new/post_deleted/post_liked/post_saved
- DB 트리거 (migration 030):
  - post_likes INSERT → post_liked (작성자에게)
  - post_saves INSERT → post_saved (작성자에게)
  - meetup_joins INSERT → join_new (주최자에게, 장소명+날짜 포함)
  - meetup_joins UPDATE status → join_accepted/rejected/unmatched (신청자에게, 닉네임 포함)
- 알림에 actor 닉네임 포함 (누가 좋아요/저장/신청했는지)

## 지도 (MapClient) 상세
- 검색: 결과 탭 시 `highlighted` 상태로 핀 강조 (bottom sheet 모달 안 열림)
- 필터 패널: 헤더에 [초기화] + [적용] 버튼, 실시간 반영
- 동선짜기(course-build) 모드에서도 검색바 + 필터 버튼 활성화
- 장소 핀 탭 → 상세 bottom sheet 열기 (highlighted 초기화 후 selected 설정)
- Google Places API: UploadMapSection에 `libraries={['places']}`, POI 탭 시 PlacesService.getDetails()

## 피드 댓글
- `post_comments` 테이블: post_id, user_id, body(1~200자), created_at, deleted_at
- API: GET/POST `/api/posts/[id]/comments`, DELETE `/api/comments/[id]`
- UI: PostGrid 모달 하단 댓글 목록 + 입력창, Enter 게시, 내 댓글만 삭제(✕)

## 동선 짜기 (AI)
- `/api/course`: Gemini 2.5 Flash Lite, 직접선택형 (사용자 저장 장소 RAG)
- `/api/course/recommend`: AI 추천형 (동네 멀티셀렉트 + Locory DB 장소 최대 80개 RAG)
- `/api/directions`: Google Directions 경로
- `saved_courses` 테이블 저장 (source: 'user_selected' | 'ai_recommended')
