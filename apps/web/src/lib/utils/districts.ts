import type { City } from '@/types/database'

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

export function inferCityFromAddress(address: string): City | null {
  for (const { keywords, value } of ADDRESS_TO_CITY) {
    if (keywords.some(kw => address.includes(kw))) return value
  }
  return null
}

export function inferDistrictFromAddress(address: string, city: City): string | null {
  const rules = ADDRESS_TO_DISTRICT[city]
  if (!rules) return null
  for (const { keywords, value } of rules) {
    if (keywords.some(kw => address.includes(kw))) return value
  }
  return null
}
