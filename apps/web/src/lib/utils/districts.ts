import type { City } from '@/types/database'

export type NeighborhoodBounds = {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}

export type PopularNeighborhood = {
  id: string
  country: 'KR' | 'JP'
  city: string
  labelKey: string
  /** Keywords for local fuzzy search (Korean/Japanese/English) */
  searchTokens: string[]
  /** Show as a quick-pick chip in the UI */
  featured: boolean
  bounds: NeighborhoodBounds
}

function nb(lat: number, lng: number, rLat: number, rLng?: number): NeighborhoodBounds {
  const rl = rLat
  const rn = rLng ?? rLat * 1.2
  return { latMin: lat - rl, latMax: lat + rl, lngMin: lng - rn, lngMax: lng + rn }
}

export const POPULAR_NEIGHBORHOODS: PopularNeighborhood[] = [
  // ── 서울 (Seoul) ──────────────────────────────────────────────────────────
  { id: 'hongdae',       country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.hongdae',       searchTokens: ['홍대', '홍익대', '상수', '합정역', 'hongdae'],           bounds: nb(37.5563, 126.9222, 0.010) },
  { id: 'yeonnam',       country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.yeonnam',       searchTokens: ['연남동', '연남', 'yeonnam'],                             bounds: nb(37.5660, 126.9234, 0.008) },
  { id: 'hapjeong',      country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.hapjeong',      searchTokens: ['합정', '합정동', 'hapjeong'],                            bounds: nb(37.5494, 126.9146, 0.008) },
  { id: 'sinchon',       country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.sinchon',       searchTokens: ['신촌', '신촌동', 'sinchon'],                             bounds: nb(37.5552, 126.9366, 0.008) },
  { id: 'seongsu',       country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.seongsu',       searchTokens: ['성수', '성수동', '뚝섬', 'seongsu'],                     bounds: nb(37.5445, 127.0558, 0.010) },
  { id: 'seoulforest',   country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.seoulforest',   searchTokens: ['서울숲', 'seoulforest', 'seoul forest'],                 bounds: nb(37.5435, 127.0374, 0.008) },
  { id: 'itaewon',       country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.itaewon',       searchTokens: ['이태원', '이태원동', 'itaewon'],                         bounds: nb(37.5340, 126.9946, 0.010) },
  { id: 'hannam',        country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.hannam',        searchTokens: ['한남', '한남동', 'hannam'],                              bounds: nb(37.5377, 127.0021, 0.008) },
  { id: 'yongsan',       country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.yongsan',       searchTokens: ['용산', '용산구', 'yongsan'],                             bounds: nb(37.5326, 126.9882, 0.012) },
  { id: 'myeongdong',    country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.myeongdong',    searchTokens: ['명동', '명동역', 'myeongdong'],                          bounds: nb(37.5636, 126.9834, 0.009) },
  { id: 'euljiro',       country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.euljiro',       searchTokens: ['을지로', '을지로입구', 'euljiro'],                       bounds: nb(37.5658, 126.9912, 0.009) },
  { id: 'insadong',      country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.insadong',      searchTokens: ['인사동', '익선동', 'insadong'],                          bounds: nb(37.5735, 126.9852, 0.008) },
  { id: 'bukchon',       country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.bukchon',       searchTokens: ['북촌', '삼청동', '가회동', '경복궁', 'bukchon'],         bounds: nb(37.5797, 126.9821, 0.009) },
  { id: 'jongno',        country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.jongno',        searchTokens: ['종로', '광화문', '경복궁', '세종대로', 'jongno'],        bounds: nb(37.5730, 126.9795, 0.012) },
  { id: 'gangnam',       country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.gangnam',       searchTokens: ['강남', '역삼', '논현', '강남구', 'gangnam'],             bounds: nb(37.4979, 127.0276, 0.016) },
  { id: 'sinsa',         country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.sinsa',         searchTokens: ['신사', '가로수길', '신사동', 'sinsa'],                   bounds: nb(37.5206, 127.0194, 0.009) },
  { id: 'apgujeong',     country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.apgujeong',     searchTokens: ['압구정', '압구정동', '로데오', 'apgujeong'],             bounds: nb(37.5270, 127.0291, 0.009) },
  { id: 'cheongdam',     country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.cheongdam',     searchTokens: ['청담', '청담동', 'cheongdam'],                           bounds: nb(37.5270, 127.0479, 0.010) },
  { id: 'jamsil',        country: 'KR', city: 'seoul', featured: true,  labelKey: 'neighborhoods.jamsil',        searchTokens: ['잠실', '잠실동', '롯데월드', 'jamsil'],                  bounds: nb(37.5133, 127.1002, 0.012) },
  { id: 'konkuk',        country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.konkuk',        searchTokens: ['건대', '건국대', '화양동', 'konkuk'],                   bounds: nb(37.5402, 127.0702, 0.009) },
  { id: 'dongdaemun',    country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.dongdaemun',    searchTokens: ['동대문', '동대문디자인플라자', 'ddp', '청량리', 'dongdaemun'], bounds: nb(37.5710, 127.0095, 0.012) },
  { id: 'yeouido',       country: 'KR', city: 'seoul', featured: false, labelKey: 'neighborhoods.yeouido',       searchTokens: ['여의도', '여의도공원', 'yeouido'],                       bounds: nb(37.5219, 126.9242, 0.010) },
  // ── 부산 (Busan) ──────────────────────────────────────────────────────────
  { id: 'haeundae',      country: 'KR', city: 'busan', featured: true,  labelKey: 'neighborhoods.haeundae',      searchTokens: ['해운대', '해운대해수욕장', 'haeundae'],                  bounds: nb(35.1587, 129.1604, 0.014) },
  { id: 'gwangalli',     country: 'KR', city: 'busan', featured: true,  labelKey: 'neighborhoods.gwangalli',     searchTokens: ['광안리', '광안리해수욕장', '수영', 'gwangalli'],         bounds: nb(35.1532, 129.1185, 0.011) },
  { id: 'nampodong',     country: 'KR', city: 'busan', featured: true,  labelKey: 'neighborhoods.nampodong',     searchTokens: ['남포동', '광복동', '부평깡통시장', '자갈치', 'nampodong'], bounds: nb(35.0975, 129.0291, 0.010) },
  { id: 'seomyeon',      country: 'KR', city: 'busan', featured: true,  labelKey: 'neighborhoods.seomyeon',      searchTokens: ['서면', '전포', '부산진', 'seomyeon'],                    bounds: nb(35.1579, 129.0598, 0.012) },
  { id: 'jeonpo',        country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.jeonpo',        searchTokens: ['전포', '전포카페거리', '전포동', 'jeonpo'],              bounds: nb(35.1530, 129.0600, 0.008) },
  { id: 'centum',        country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.centum',        searchTokens: ['센텀', '센텀시티', 'bexco', '재송동', 'centum'],         bounds: nb(35.1698, 129.1314, 0.010) },
  { id: 'gamcheon',      country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.gamcheon',      searchTokens: ['감천', '감천마을', '감천문화마을', 'gamcheon'],           bounds: nb(35.0968, 129.0098, 0.009) },
  { id: 'dalmaji',       country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.dalmaji',       searchTokens: ['달맞이', '달맞이고개', '달맞이길', 'dalmaji'],           bounds: nb(35.1560, 129.1750, 0.011) },
  { id: 'songjeong',     country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.songjeong',     searchTokens: ['송정', '송정해수욕장', '송정동', 'songjeong'],           bounds: nb(35.1851, 129.2042, 0.010) },
  { id: 'busandae',      country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.busandae',      searchTokens: ['부산대', '부산대학교', '금정구', '금정', 'busandae'],    bounds: nb(35.2315, 129.0883, 0.018) },
  { id: 'yeongdo',       country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.yeongdo',       searchTokens: ['영도', '영도구', 'yeongdo'],                             bounds: nb(35.0902, 129.0748, 0.018) },
  { id: 'gijang',        country: 'KR', city: 'busan', featured: false, labelKey: 'neighborhoods.gijang',        searchTokens: ['기장', '기장군', 'gijang'],                              bounds: nb(35.2445, 129.2123, 0.018) },
  // ── 경기도 & 기타 한국 ────────────────────────────────────────────────────
  { id: 'gwanggyo',      country: 'KR', city: 'suwon', featured: true,  labelKey: 'neighborhoods.gwanggyo',      searchTokens: ['광교', '광교호수공원', '광교신도시', '수원 광교', 'gwanggyo'], bounds: nb(37.2917, 127.0538, 0.022) },
  { id: 'pangyo',        country: 'KR', city: 'seongnam', featured: false, labelKey: 'neighborhoods.pangyo',     searchTokens: ['판교', '판교테크노밸리', '성남', 'pangyo'],              bounds: nb(37.3943, 127.1113, 0.015) },
  { id: 'jeonju',        country: 'KR', city: 'jeonju', featured: true, labelKey: 'neighborhoods.jeonju',        searchTokens: ['전주', '전주한옥마을', '한옥마을', '풍남동', 'jeonju'],   bounds: nb(35.8155, 127.1530, 0.018) },
  { id: 'aewol',         country: 'KR', city: 'jeju',  featured: false, labelKey: 'neighborhoods.aewol',         searchTokens: ['애월', '애월읍', '제주 애월', 'aewol'],                  bounds: nb(33.4626, 126.3119, 0.022) },
  { id: 'seongsan',      country: 'KR', city: 'jeju',  featured: false, labelKey: 'neighborhoods.seongsan',      searchTokens: ['성산', '성산일출봉', '성산읍', 'seongsan'],              bounds: nb(33.4574, 126.9300, 0.022) },
  { id: 'gyeongju',      country: 'KR', city: 'gyeongju', featured: true, labelKey: 'neighborhoods.gyeongju',   searchTokens: ['경주', '황리단길', '황남동', '불국사', 'gyeongju'],       bounds: nb(35.8352, 129.2115, 0.030) },
  { id: 'gangneung',     country: 'KR', city: 'gangneung', featured: true, labelKey: 'neighborhoods.gangneung', searchTokens: ['강릉', '강릉시', '경포대', '안목', 'gangneung'],          bounds: nb(37.7518, 128.8761, 0.035) },
  { id: 'sokcho',        country: 'KR', city: 'sokcho', featured: false, labelKey: 'neighborhoods.sokcho',       searchTokens: ['속초', '속초시', '설악산', 'sokcho'],                    bounds: nb(38.2070, 128.5918, 0.030) },
  { id: 'yeosu',         country: 'KR', city: 'yeosu', featured: false, labelKey: 'neighborhoods.yeosu',         searchTokens: ['여수', '여수시', '오동도', 'yeosu'],                     bounds: nb(34.7604, 127.6622, 0.030) },
  { id: 'gaehang',       country: 'KR', city: 'incheon', featured: false, labelKey: 'neighborhoods.gaehang',  searchTokens: ['인천', '개항장', '차이나타운', '인천 중구', 'incheon'],   bounds: nb(37.4745, 126.6160, 0.025) },
  // ── 도쿄 (Tokyo) ──────────────────────────────────────────────────────────
  { id: 'shibuya',       country: 'JP', city: 'tokyo', featured: true,  labelKey: 'neighborhoods.shibuya',       searchTokens: ['시부야', '渋谷', 'shibuya'],                             bounds: nb(35.6596, 139.7006, 0.012) },
  { id: 'shinjuku',      country: 'JP', city: 'tokyo', featured: true,  labelKey: 'neighborhoods.shinjuku',      searchTokens: ['신주쿠', '新宿', 'shinjuku'],                            bounds: nb(35.6938, 139.7034, 0.012) },
  { id: 'harajuku',      country: 'JP', city: 'tokyo', featured: true,  labelKey: 'neighborhoods.harajuku',      searchTokens: ['하라주쿠', '原宿', 'harajuku'],                          bounds: nb(35.6702, 139.7027, 0.010) },
  { id: 'asakusa',       country: 'JP', city: 'tokyo', featured: true,  labelKey: 'neighborhoods.asakusa',       searchTokens: ['아사쿠사', '浅草', 'asakusa'],                           bounds: nb(35.7148, 139.7967, 0.012) },
  { id: 'akihabara',     country: 'JP', city: 'tokyo', featured: true,  labelKey: 'neighborhoods.akihabara',     searchTokens: ['아키하바라', '秋葉原', 'akihabara'],                     bounds: nb(35.7023, 139.7745, 0.010) },
  { id: 'ginza',         country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.ginza',         searchTokens: ['긴자', '銀座', 'ginza'],                                 bounds: nb(35.6716, 139.7651, 0.011) },
  { id: 'roppongi',      country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.roppongi',      searchTokens: ['롯폰기', '六本木', 'roppongi'],                          bounds: nb(35.6628, 139.7313, 0.010) },
  { id: 'ikebukuro',     country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.ikebukuro',     searchTokens: ['이케부쿠로', '池袋', 'ikebukuro'],                       bounds: nb(35.7295, 139.7109, 0.012) },
  { id: 'nakameguro',    country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.nakameguro',    searchTokens: ['나카메구로', '中目黒', 'nakameguro'],                    bounds: nb(35.6445, 139.6987, 0.010) },
  { id: 'aoyama',        country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.aoyama',        searchTokens: ['아오야마', '오모테산도', '青山', '表参道', 'aoyama', 'omotesando'], bounds: nb(35.6652, 139.7163, 0.010) },
  { id: 'shimokitazawa', country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.shimokitazawa', searchTokens: ['시모키타자와', '下北沢', 'shimokitazawa'],               bounds: nb(35.6614, 139.6681, 0.010) },
  { id: 'ueno',          country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.ueno',          searchTokens: ['우에노', '上野', 'ueno'],                                bounds: nb(35.7141, 139.7774, 0.011) },
  { id: 'odaiba',        country: 'JP', city: 'tokyo', featured: false, labelKey: 'neighborhoods.odaiba',        searchTokens: ['오다이바', 'お台場', 'odaiba'],                          bounds: nb(35.6290, 139.7748, 0.014) },
  // ── 오사카 (Osaka) ────────────────────────────────────────────────────────
  { id: 'namba',         country: 'JP', city: 'osaka', featured: true,  labelKey: 'neighborhoods.namba',         searchTokens: ['난바', '남바', '難波', 'namba'],                         bounds: nb(34.6651, 135.5021, 0.012) },
  { id: 'umeda',         country: 'JP', city: 'osaka', featured: true,  labelKey: 'neighborhoods.umeda',         searchTokens: ['우메다', '梅田', 'umeda'],                               bounds: nb(34.7024, 135.4959, 0.012) },
  { id: 'dotonbori',     country: 'JP', city: 'osaka', featured: true,  labelKey: 'neighborhoods.dotonbori',     searchTokens: ['도톤보리', '道頓堀', 'dotonbori'],                       bounds: nb(34.6687, 135.5014, 0.010) },
  { id: 'shinsaibashi',  country: 'JP', city: 'osaka', featured: false, labelKey: 'neighborhoods.shinsaibashi',  searchTokens: ['신사이바시', '心斎橋', 'shinsaibashi'],                  bounds: nb(34.6733, 135.5022, 0.011) },
  { id: 'tennoji',       country: 'JP', city: 'osaka', featured: false, labelKey: 'neighborhoods.tennoji',       searchTokens: ['텐노지', '덴노지', '天王寺', 'tennoji'],                 bounds: nb(34.6491, 135.5136, 0.012) },
  { id: 'shinsekai',     country: 'JP', city: 'osaka', featured: false, labelKey: 'neighborhoods.shinsekai',     searchTokens: ['신세카이', '신세계', '新世界', 'shinsekai'],             bounds: nb(34.6527, 135.5063, 0.009) },
  { id: 'dendentown',    country: 'JP', city: 'osaka', featured: false, labelKey: 'neighborhoods.dendentown',    searchTokens: ['덴덴타운', '電気街', 'dendentown'],                      bounds: nb(34.6551, 135.5053, 0.009) },
  // ── 교토 (Kyoto) ──────────────────────────────────────────────────────────
  { id: 'kyoto',         country: 'JP', city: 'kyoto', featured: true,  labelKey: 'neighborhoods.kyoto',         searchTokens: ['교토', '京都', 'kyoto', '기온', '기요미즈'],             bounds: nb(35.0116, 135.7681, 0.040) },
  { id: 'gion',          country: 'JP', city: 'kyoto', featured: false, labelKey: 'neighborhoods.gion',          searchTokens: ['기온', '祇園', 'gion'],                                  bounds: nb(35.0039, 135.7761, 0.012) },
]

/**
 * Local fuzzy search — check searchTokens first, fall back to null.
 * Used in feed to avoid Geocoding API for known neighborhoods.
 */
export function searchNeighborhoods(query: string): PopularNeighborhood | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!q || q.length < 2) return null

  // Exact/prefix match first
  for (const nb of POPULAR_NEIGHBORHOODS) {
    if (nb.searchTokens.some(token => {
      const t = token.toLowerCase().replace(/\s+/g, '')
      return t === q || t.startsWith(q) || q.startsWith(t)
    })) return nb
  }

  // Substring match fallback
  for (const nb of POPULAR_NEIGHBORHOODS) {
    if (nb.searchTokens.some(token => {
      const t = token.toLowerCase().replace(/\s+/g, '')
      return t.includes(q) || q.includes(t)
    })) return nb
  }

  return null
}

export const CITIES: { value: City; label: string }[] = [
  { value: 'seoul', label: '서울' },
  { value: 'busan', label: '부산' },
  { value: 'jeju', label: '제주' },
  { value: 'gyeongju', label: '경주' },
  { value: 'jeonju', label: '전주' },
  { value: 'gangneung', label: '강릉' },
  { value: 'sokcho', label: '속초' },
  { value: 'yeosu', label: '여수' },
  { value: 'incheon', label: '인천' },
]

// 각 도시별 인기 동네 (앞쪽이 외국인 인기순)
// main: 기본 노출, extra: 더보기
export const DISTRICTS: Record<City, {
  main: { value: string; label: string }[]
  extra: { value: string; label: string }[]
}> = {
  seoul: {
    main: [
      { value: 'hongdae', label: '홍대' },
      { value: 'myeongdong', label: '명동' },
      { value: 'itaewon', label: '이태원' },
      { value: 'gangnam', label: '강남' },
      { value: 'seongsu', label: '성수' },
    ],
    extra: [
      { value: 'hapjeong', label: '합정' },
      { value: 'yeonnam', label: '연남동' },
      { value: 'bukchon', label: '북촌' },
      { value: 'insadong', label: '인사동' },
      { value: 'hannam', label: '한남' },
      { value: 'jongno', label: '종로' },
      { value: 'apgujeong', label: '압구정' },
      { value: 'konkuk', label: '건대' },
      { value: 'jamsil', label: '잠실' },
      { value: 'dongdaemun', label: '동대문' },
    ],
  },
  busan: {
    main: [
      { value: 'haeundae', label: '해운대' },
      { value: 'gwangalli', label: '광안리' },
      { value: 'nampo', label: '남포동' },
      { value: 'seomyeon', label: '서면' },
      { value: 'dalmaji', label: '달맞이고개' },
      { value: 'yeongdo', label: '영도' },
    ],
    extra: [
      { value: 'centum', label: '센텀시티' },
      { value: 'mangmi', label: '망미단길' },
      { value: 'millak', label: '밀락더마켓' },
      { value: 'songjeong', label: '송정' },
      { value: 'gamcheon', label: '감천마을' },
      { value: 'dadaepo', label: '다대포' },
      { value: 'gijang', label: '기장' },
      { value: 'busanstation', label: '부산역' },
    ],
  },
  jeju: {
    main: [
      { value: 'jejusi', label: '제주시' },
      { value: 'aewol', label: '애월' },
      { value: 'seogwipo', label: '서귀포' },
    ],
    extra: [
      { value: 'seongsan', label: '성산' },
      { value: 'udo', label: '우도' },
      { value: 'hyeopjae', label: '협재' },
      { value: 'hamdeok', label: '함덕' },
    ],
  },
  gyeongju: {
    main: [
      { value: 'hwangridangil', label: '황리단길' },
      { value: 'downtown', label: '경주 시내' },
    ],
    extra: [
      { value: 'bomun', label: '보문단지' },
      { value: 'bulguksa', label: '불국사' },
    ],
  },
  jeonju: {
    main: [
      { value: 'hanok', label: '한옥마을' },
      { value: 'downtown', label: '전주 시내' },
    ],
    extra: [
      { value: 'nambu', label: '남부시장' },
    ],
  },
  gangneung: {
    main: [
      { value: 'downtown', label: '강릉 시내' },
      { value: 'gyeongpo', label: '경포대' },
    ],
    extra: [
      { value: 'anmok', label: '안목해변' },
      { value: 'jumunjin', label: '주문진' },
    ],
  },
  sokcho: {
    main: [
      { value: 'downtown', label: '속초 시내' },
      { value: 'seoraksan', label: '설악산' },
    ],
    extra: [
      { value: 'beach', label: '속초해수욕장' },
      { value: 'abai', label: '아바이마을' },
    ],
  },
  yeosu: {
    main: [
      { value: 'downtown', label: '여수 시내' },
      { value: 'dolsando', label: '돌산도' },
    ],
    extra: [
      { value: 'odongdo', label: '오동도' },
      { value: 'hyangiram', label: '향일암' },
    ],
  },
  incheon: {
    main: [
      { value: 'chinatown', label: '차이나타운' },
      { value: 'gaehang', label: '개항장' },
    ],
    extra: [
      { value: 'songdo', label: '송도' },
      { value: 'wolmi', label: '월미도' },
    ],
  },
}

export function getDistricts(city: City) {
  const d = DISTRICTS[city]
  return [...(d?.main || []), ...(d?.extra || [])]
}

export function getMainDistricts(city: City) {
  return DISTRICTS[city]?.main || []
}

export function getExtraDistricts(city: City) {
  return DISTRICTS[city]?.extra || []
}

export function getDistrictLabel(city: City, value: string) {
  const all = getDistricts(city)
  return all.find(d => d.value === value)?.label || value
}

// 주소 키워드 → district value 매핑
const ADDRESS_TO_DISTRICT: Record<City, Array<{ keywords: string[]; value: string }>> = {
  seoul: [
    { keywords: ['서교동', '상수동', '홍대'], value: 'hongdae' },
    { keywords: ['합정동', '합정'], value: 'hapjeong' },
    { keywords: ['연남동', '연남'], value: 'yeonnam' },
    { keywords: ['명동', '충무로', '을지로'], value: 'myeongdong' },
    { keywords: ['이태원동', '이태원', '녹사평'], value: 'itaewon' },
    { keywords: ['한남동', '한남'], value: 'hannam' },
    { keywords: ['청담동', '역삼동', '논현동', '신사동', '삼성동', '강남구'], value: 'gangnam' },
    { keywords: ['압구정동', '압구정'], value: 'apgujeong' },
    { keywords: ['성수동', '성수', '뚝섬'], value: 'seongsu' },
    { keywords: ['익선동', '돈의동', '관훈동', '인사동'], value: 'insadong' },
    { keywords: ['북촌', '가회동', '삼청동', '계동'], value: 'bukchon' },
    { keywords: ['종로구', '광화문', '경복궁', '세종로', '청계천'], value: 'jongno' },
    { keywords: ['화양동', '자양동', '건대'], value: 'konkuk' },
    { keywords: ['잠실동', '잠실'], value: 'jamsil' },
    { keywords: ['동대문구', '신설동', '청량리', '회기동'], value: 'dongdaemun' },
  ],
  busan: [
    { keywords: ['달맞이고개', '달맞이길', '중2동', '우2동'], value: 'dalmaji' },
    { keywords: ['영도구', '영도'], value: 'yeongdo' },
    { keywords: ['센텀시티', 'BEXCO', '재송동', '우동 센텀'], value: 'centum' },
    { keywords: ['망미동', '망미단길', '망미'], value: 'mangmi' },
    { keywords: ['밀락', '수영동', '민락동'], value: 'millak' },
    { keywords: ['다대포', '다대동'], value: 'dadaepo' },
    { keywords: ['부산역', '초량동', '초량'], value: 'busanstation' },
    { keywords: ['해운대구', '해운대동', '우동', '중동'], value: 'haeundae' },
    { keywords: ['광안리', '수영구', '광안동'], value: 'gwangalli' },
    { keywords: ['남포동', '광복동', '중구'], value: 'nampo' },
    { keywords: ['서면', '부산진구', '전포동', '부전동'], value: 'seomyeon' },
    { keywords: ['송정동', '송정'], value: 'songjeong' },
    { keywords: ['감천동', '감천'], value: 'gamcheon' },
    { keywords: ['기장군', '기장'], value: 'gijang' },
  ],
  jeju: [
    { keywords: ['애월읍', '애월'], value: 'aewol' },
    { keywords: ['성산읍', '성산'], value: 'seongsan' },
    { keywords: ['우도면', '우도'], value: 'udo' },
    { keywords: ['협재', '한림읍'], value: 'hyeopjae' },
    { keywords: ['함덕', '조천읍'], value: 'hamdeok' },
    { keywords: ['서귀포시'], value: 'seogwipo' },
    { keywords: ['제주시'], value: 'jejusi' },
  ],
  gyeongju: [
    { keywords: ['황남동', '포석로', '황리단길'], value: 'hwangridangil' },
    { keywords: ['불국로', '진현동', '불국사'], value: 'bulguksa' },
    { keywords: ['보문동', '보문단지'], value: 'bomun' },
    { keywords: ['경주시'], value: 'downtown' },
  ],
  jeonju: [
    { keywords: ['교동', '풍남동', '한옥마을'], value: 'hanok' },
    { keywords: ['남부시장', '중앙동'], value: 'nambu' },
    { keywords: ['전주시'], value: 'downtown' },
  ],
  gangneung: [
    { keywords: ['경포동', '경포대', '경포로'], value: 'gyeongpo' },
    { keywords: ['안목', '견소동'], value: 'anmok' },
    { keywords: ['주문진'], value: 'jumunjin' },
    { keywords: ['강릉시'], value: 'downtown' },
  ],
  sokcho: [
    { keywords: ['설악동', '설악산'], value: 'seoraksan' },
    { keywords: ['청호동', '아바이'], value: 'abai' },
    { keywords: ['속초해수욕장', '조양동'], value: 'beach' },
    { keywords: ['속초시'], value: 'downtown' },
  ],
  yeosu: [
    { keywords: ['돌산읍', '돌산도'], value: 'dolsando' },
    { keywords: ['오동도', '수정동'], value: 'odongdo' },
    { keywords: ['향일암', '돌산'], value: 'hyangiram' },
    { keywords: ['여수시'], value: 'downtown' },
  ],
  incheon: [
    { keywords: ['차이나타운', '선린동', '북성동'], value: 'chinatown' },
    { keywords: ['개항장', '중구 신포', '신포동'], value: 'gaehang' },
    { keywords: ['연수구', '송도동', '송도'], value: 'songdo' },
    { keywords: ['월미도', '북성동'], value: 'wolmi' },
  ],
}

// 주소 키워드 → city 매핑
const ADDRESS_TO_CITY: Array<{ keywords: string[]; value: City }> = [
  { keywords: ['서울특별시', '서울시'], value: 'seoul' },
  { keywords: ['부산광역시', '부산시'], value: 'busan' },
  { keywords: ['제주특별자치도', '제주도', '제주시', '서귀포시'], value: 'jeju' },
  { keywords: ['경주시', '경상북도 경주'], value: 'gyeongju' },
  { keywords: ['전주시', '전라북도 전주'], value: 'jeonju' },
  { keywords: ['강릉시', '강원도 강릉', '강원특별자치도 강릉'], value: 'gangneung' },
  { keywords: ['속초시', '강원도 속초', '강원특별자치도 속초'], value: 'sokcho' },
  { keywords: ['여수시', '전라남도 여수'], value: 'yeosu' },
  { keywords: ['인천광역시', '인천시'], value: 'incheon' },
]

const DISTRICT_GU_FALLBACK: Record<City, Array<{ keywords: string[]; value: string }>> = {
  seoul: [
    { keywords: ['마포구'], value: 'hongdae' },
    { keywords: ['성동구'], value: 'seongsu' },
    { keywords: ['강남구'], value: 'gangnam' },
    { keywords: ['송파구'], value: 'jamsil' },
    { keywords: ['종로구'], value: 'jongno' },
    { keywords: ['동대문구'], value: 'dongdaemun' },
    { keywords: ['용산구'], value: 'itaewon' },
  ],
  busan: [
    { keywords: ['해운대구'], value: 'haeundae' },
    { keywords: ['수영구'], value: 'gwangalli' },
    { keywords: ['중구'], value: 'nampo' },
    { keywords: ['부산진구'], value: 'seomyeon' },
    { keywords: ['영도구'], value: 'yeongdo' },
    { keywords: ['기장군'], value: 'gijang' },
  ],
  jeju: [],
  gyeongju: [],
  jeonju: [],
  gangneung: [],
  sokcho: [],
  yeosu: [],
  incheon: [],
}

function normalizeAddressText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

function includesKeyword(address: string, normalizedAddress: string, keyword: string): boolean {
  return address.includes(keyword) || normalizedAddress.includes(normalizeAddressText(keyword))
}

const CITY_VALUES = new Set<City>([
  'seoul',
  'busan',
  'jeju',
  'gyeongju',
  'jeonju',
  'gangneung',
  'sokcho',
  'yeosu',
  'incheon',
])

function isCity(value: string | null | undefined): value is City {
  return !!value && CITY_VALUES.has(value as City)
}

export function normalizeDistrictForCity(
  city: City | string | null | undefined,
  district: string | null | undefined,
): string | null {
  if (!district) return null
  if (district === 'other') return 'other'
  if (!isCity(city)) return district

  const normalizedDistrict = normalizeAddressText(district)
  if (getDistricts(city).some(d => normalizeAddressText(d.value) === normalizedDistrict)) {
    return district
  }

  const fallbackRules = DISTRICT_GU_FALLBACK[city] || []
  for (const { keywords, value } of fallbackRules) {
    if (keywords.some(kw => normalizedDistrict.includes(normalizeAddressText(kw)))) {
      return value
    }
  }

  return district
}

export function getDistrictQueryValues(
  city: City | string | null | undefined,
  district: string | null | undefined,
): string[] {
  if (!district || district === 'other') return []

  const normalizedDistrict = normalizeDistrictForCity(city, district) ?? district
  if (!isCity(city)) return [normalizedDistrict]

  const values = new Set<string>([normalizedDistrict])
  const fallbackRules = DISTRICT_GU_FALLBACK[city] || []
  for (const { keywords, value } of fallbackRules) {
    if (value === normalizedDistrict) {
      keywords.forEach((kw) => values.add(kw))
    }
  }
  return Array.from(values)
}

export function extractAdministrativeAddressParts(address: string): {
  cityRaw: string | null
  guRaw: string | null
  dongRaw: string | null
} {
  const tokens = address
    .replace(/[,]/g, ' ')
    .split(/\s+/)
    .map(token => token.replace(/[()]/g, '').trim())
    .filter(Boolean)

  const cityRaw =
    tokens.find(token => /(특별시|광역시|특별자치시|특별자치도|자치시|자치도|시|도)$/.test(token)) ?? null
  const guRaw = tokens.find(token => /(구|군)$/.test(token)) ?? null
  const dongRaw = tokens.find(token => /(동|읍|면|리|가)$/.test(token)) ?? null

  return { cityRaw, guRaw, dongRaw }
}

function normalizeFilterToken(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

type PlaceLocationLike = {
  city?: string | null
  district?: string | null
  city_global?: string | null
  neighborhood_global?: string | null
}

export function getPlaceCityFilterToken(place: PlaceLocationLike): string | null {
  return normalizeFilterToken(place.city_global || place.city || null)
}

export function getPlaceNeighborhoodFilterToken(place: PlaceLocationLike): string | null {
  const normalizedDistrict = normalizeDistrictForCity(place.city, place.district)
  if (normalizedDistrict && normalizedDistrict !== 'other') {
    return normalizeFilterToken(normalizedDistrict)
  }
  return normalizeFilterToken(place.neighborhood_global || place.district || null)
}

export function inferCityFromAddress(address: string): City | null {
  const normalized = normalizeAddressText(address)
  for (const { keywords, value } of ADDRESS_TO_CITY) {
    if (keywords.some(kw => includesKeyword(address, normalized, kw))) return value
  }
  return null
}

export function inferDistrictFromAddress(address: string, city: City): string | null {
  const rules = ADDRESS_TO_DISTRICT[city]
  if (!rules) return null
  const normalized = normalizeAddressText(address)

  for (const { keywords, value } of rules) {
    if (keywords.some(kw => includesKeyword(address, normalized, kw))) return value
  }

  const fallbackRules = DISTRICT_GU_FALLBACK[city] || []
  for (const { keywords, value } of fallbackRules) {
    if (keywords.some(kw => includesKeyword(address, normalized, kw))) return value
  }

  return null
}

function toKoreanAdministrativeLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  if (/[가-힣]+(시|군|구)$/.test(raw)) return raw
  const koMatch = raw.match(/([가-힣]+(?:시|군|구))/)
  if (koMatch?.[1]) return koMatch[1]
  return null
}

export function inferGuFromAddress(address: string): string | null {
  if (!address) return null
  const koMatch = address.match(/([가-힣]+(?:시|군|구))/)
  if (koMatch?.[1]) return koMatch[1]
  return null
}

export function normalizeDistrictForStorage(
  city: City | string | null | undefined,
  countryCode: string | null | undefined,
  district: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const cc = (countryCode || 'KR').toUpperCase()
  const rawDistrict = district?.trim() || null
  const rawAddress = address?.trim() || null

  if (cc !== 'KR') {
    return normalizeDistrictForCity(city, rawDistrict) ?? rawDistrict
  }

  const fromAddress = rawAddress ? inferGuFromAddress(rawAddress) : null
  const normalized = normalizeDistrictForCity(city, rawDistrict)
  const fromNormalized = toKoreanAdministrativeLabel(normalized)
  const fromRaw = toKoreanAdministrativeLabel(rawDistrict)

  return fromAddress || fromRaw || fromNormalized || null
}
