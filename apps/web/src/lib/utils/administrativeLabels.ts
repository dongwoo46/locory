const KR_DISTRICT_LABELS: Record<string, { ko: string; en: string }> = {
  // Seoul
  'jongno-gu': { ko: '종로구', en: 'Jongno-gu' },
  'jung-gu': { ko: '중구', en: 'Jung-gu' },
  'yongsan-gu': { ko: '용산구', en: 'Yongsan-gu' },
  'seongdong-gu': { ko: '성동구', en: 'Seongdong-gu' },
  'gwangjin-gu': { ko: '광진구', en: 'Gwangjin-gu' },
  'dongdaemun-gu': { ko: '동대문구', en: 'Dongdaemun-gu' },
  'jungnang-gu': { ko: '중랑구', en: 'Jungnang-gu' },
  'seongbuk-gu': { ko: '성북구', en: 'Seongbuk-gu' },
  'gangbuk-gu': { ko: '강북구', en: 'Gangbuk-gu' },
  'dobong-gu': { ko: '도봉구', en: 'Dobong-gu' },
  'nowon-gu': { ko: '노원구', en: 'Nowon-gu' },
  'eunpyeong-gu': { ko: '은평구', en: 'Eunpyeong-gu' },
  'seodaemun-gu': { ko: '서대문구', en: 'Seodaemun-gu' },
  'mapo-gu': { ko: '마포구', en: 'Mapo-gu' },
  'yangcheon-gu': { ko: '양천구', en: 'Yangcheon-gu' },
  'gangseo-gu': { ko: '강서구', en: 'Gangseo-gu' },
  'guro-gu': { ko: '구로구', en: 'Guro-gu' },
  'geumcheon-gu': { ko: '금천구', en: 'Geumcheon-gu' },
  'yeongdeungpo-gu': { ko: '영등포구', en: 'Yeongdeungpo-gu' },
  'dongjak-gu': { ko: '동작구', en: 'Dongjak-gu' },
  'gwanak-gu': { ko: '관악구', en: 'Gwanak-gu' },
  'seocho-gu': { ko: '서초구', en: 'Seocho-gu' },
  'gangnam-gu': { ko: '강남구', en: 'Gangnam-gu' },
  'songpa-gu': { ko: '송파구', en: 'Songpa-gu' },
  'gangdong-gu': { ko: '강동구', en: 'Gangdong-gu' },
  // Busan
  'busanjin-gu': { ko: '부산진구', en: 'Busanjin-gu' },
  'dongnae-gu': { ko: '동래구', en: 'Dongnae-gu' },
  'suyeong-gu': { ko: '수영구', en: 'Suyeong-gu' },
  'sasang-gu': { ko: '사상구', en: 'Sasang-gu' },
  'gijang-gun': { ko: '기장군', en: 'Gijang-gun' },
  // Incheon/Daegu/etc (common)
  'michuhol-gu': { ko: '미추홀구', en: 'Michuhol-gu' },
  'yeonsu-gu': { ko: '연수구', en: 'Yeonsu-gu' },
  'namdong-gu': { ko: '남동구', en: 'Namdong-gu' },
  'bupyeong-gu': { ko: '부평구', en: 'Bupyeong-gu' },
  'gyeyang-gu': { ko: '계양구', en: 'Gyeyang-gu' },
  'ganghwa-gun': { ko: '강화군', en: 'Ganghwa-gun' },
  'ongjin-gun': { ko: '옹진군', en: 'Ongjin-gun' },
  'suseong-gu': { ko: '수성구', en: 'Suseong-gu' },
  'dalseo-gu': { ko: '달서구', en: 'Dalseo-gu' },
  'dalseong-gun': { ko: '달성군', en: 'Dalseong-gun' },
  'gwangsan-gu': { ko: '광산구', en: 'Gwangsan-gu' },
  'yuseong-gu': { ko: '유성구', en: 'Yuseong-gu' },
  'daedeok-gu': { ko: '대덕구', en: 'Daedeok-gu' },
  'ulju-gun': { ko: '울주군', en: 'Ulju-gun' },
  'jeju-si': { ko: '제주시', en: 'Jeju-si' },
  'seogwipo-si': { ko: '서귀포시', en: 'Seogwipo-si' },
};

const KO_TO_EN = Object.values(KR_DISTRICT_LABELS).reduce<Record<string, string>>(
  (acc, item) => {
    acc[item.ko] = item.en;
    return acc;
  },
  {},
);

export function getLocalizedKrDistrictLabel(raw: string | null | undefined, locale: string): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.toLowerCase() === 'other') return null;
  const key = value.toLowerCase().replace(/\s+/g, '-');
  const direct = KR_DISTRICT_LABELS[key];
  if (direct) return locale === 'ko' ? direct.ko : direct.en;
  if (locale === 'ko') {
    if (/[가-힣]/.test(value)) return value;
    return value
      .replace(/-gu$/i, '구')
      .replace(/-gun$/i, '군')
      .replace(/-si$/i, '시');
  }
  const enFromKo = KO_TO_EN[value];
  if (enFromKo) return enFromKo;
  return value;
}
