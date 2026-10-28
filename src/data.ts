/**
 * Editorial seed data for the MI workspace.
 * Company descriptions identify broad business areas only. They have not been
 * independently reverified during this task. Competitor membership and map
 * coordinates are illustrative analyst classifications, not market-share data.
 * Every signal below is an explicitly fictional planning scenario. Its URL is
 * a company reference homepage, never evidence that the scenario happened.
 */
export type CompanyId = 'ncchem' | 'kci' | 'verdant';
export type Company = {
  id: CompanyId;
  name: string;
  englishName: string;
  shortName: string;
  sector: string;
  description: string;
  color: string;
  keywords: string[];
  officialUrl: string;
};

export const companies: Company[] = [
  {
    id: 'ncchem', name: '삼양엔씨켐', englishName: 'Samyang NC Chem', shortName: 'NC Chem',
    sector: '반도체 · 전자재료',
    description: '반도체 공정용 정밀화학 소재를 중심으로 기술 전환, 고객 수요, 공급망 변화를 살펴봅니다.',
    color: '#5b64df', keywords: ['반도체 소재', '포토레지스트', 'EUV', '고순도 소재'],
    officialUrl: 'https://www.samyangncchem.com/',
  },
  {
    id: 'kci', name: '삼양KCI', englishName: 'Samyang KCI', shortName: 'KCI',
    sector: '퍼스널케어 · 스페셜티 소재',
    description: '퍼스널케어 기능성 원료를 중심으로 제형 트렌드, 고객 요구, 대체 소재 기회를 살펴봅니다.',
    color: '#25877d', keywords: ['퍼스널케어', '컨디셔닝 폴리머', '헤어케어', '지속가능 원료'],
    officialUrl: 'https://www.kciltd.com/',
  },
  {
    id: 'verdant', name: 'Verdant', englishName: 'Verdant Specialty Solutions', shortName: 'Verdant',
    sector: '계면활성제 · 산업용 스페셜티',
    description: '퍼스널케어와 산업용 계면활성제를 중심으로 응용시장, 생산 역량, 지속가능성 변화를 살펴봅니다.',
    color: '#be8535', keywords: ['계면활성제', '홈케어', '산업용 소재', '저자극'],
    officialUrl: 'https://www.verdantspecialty.com/',
  },
];

export type Signal = {
  id: string;
  title: string;
  summary: string;
  companyId: CompanyId;
  competitor: string;
  category: '기술·특허' | '제품·시장' | '투자·증설' | '규제·정책';
  region: '아시아' | '유럽' | '북미' | '글로벌';
  date: string;
  impact: '높음' | '보통' | '낮음';
  sourceName: string;
  sourceUrl: string;
  isDemo: boolean;
  tags: string[];
  implication: string;
  articleDetails?: {
    notes: { keyTakeaways: string; evidence: string; businessImpact: string; followUp: string };
    sourceExcerpt?: string;
    retrievedAt?: string;
    originalUrl?: string;
    contentHash?: string;
  };
};

export const signals: Signal[] = [
  {
    id: 'sig-01', title: '차세대 반도체 공정 소재의 기술 전환 시나리오',
    summary: '예시 시나리오입니다. 경쟁사가 첨단 노광 공정용 소재 개발을 강화한다면 고객 인증과 소재 성능 요구가 어떻게 달라질지 검토합니다.',
    companyId: 'ncchem', competitor: 'JSR', category: '기술·특허', region: '아시아', date: '2026-10-28', impact: '높음',
    sourceName: 'JSR 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.jsr.co.jp/', isDemo: true,
    tags: ['EUV', '포토레지스트', '기술 전환'],
    implication: '공정 세대별 요구 사양과 개발 로드맵을 대조하고, 고객 인증 일정 및 기술 격차를 확인할 자료를 수집합니다.',
  },
  {
    id: 'sig-02', title: '고순도 전자재료의 공급 안정성 점검 시나리오',
    summary: '예시 시나리오입니다. 고객사가 공급망 다변화를 요구하는 경우를 가정해 고순도 소재의 생산·품질 대응 역량을 점검합니다.',
    companyId: 'ncchem', competitor: 'TOK', category: '투자·증설', region: '아시아', date: '2026-10-27', impact: '높음',
    sourceName: 'TOK 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.tok.co.jp/', isDemo: true,
    tags: ['고순도 소재', '공급망', '고객 인증'],
    implication: '경쟁사의 실제 공장 발표와 고객 인증 근거를 확보한 뒤 지역별 공급 능력 및 대응 리드타임을 비교합니다.',
  },
  {
    id: 'sig-03', title: '반도체 소재 포트폴리오 확장 가설',
    summary: '예시 시나리오입니다. 인접 공정 소재를 함께 제안하는 경쟁 구도를 가정하고 자사 제품 조합과 협업 기회를 탐색합니다.',
    companyId: 'ncchem', competitor: 'Merck', category: '제품·시장', region: '글로벌', date: '2026-10-26', impact: '보통',
    sourceName: 'Merck 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.merckgroup.com/', isDemo: true,
    tags: ['전자재료', '제품 포트폴리오', '고객 제안'],
    implication: '제품별 직접 경쟁 여부를 확인하고, 고객의 교차 구매 수요와 기술 제휴 후보를 분리해 검토합니다.',
  },
  {
    id: 'sig-04', title: '지속가능 헤어케어 원료 수요 확대 시나리오',
    summary: '예시 시나리오입니다. 브랜드 고객이 지속가능성과 컨디셔닝 성능을 동시에 요구하는 경우를 가정해 제안 원료를 검토합니다.',
    companyId: 'kci', competitor: 'Ashland', category: '제품·시장', region: '글로벌', date: '2026-10-28', impact: '높음',
    sourceName: 'Ashland 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.ashland.com/', isDemo: true,
    tags: ['헤어케어', '컨디셔닝 폴리머', '지속가능성'],
    implication: '성능·원가·환경 관련 주장에 필요한 인증을 비교하고, 고객별 제형 검증 과제를 정의합니다.',
  },
  {
    id: 'sig-05', title: '저자극 퍼스널케어 제형의 차별화 가설',
    summary: '예시 시나리오입니다. 민감성 피부용 제형이 관심 영역이 되는 상황을 가정하고 경쟁 원료의 기능과 적용처를 비교합니다.',
    companyId: 'kci', competitor: 'Lubrizol', category: '기술·특허', region: '북미', date: '2026-10-27', impact: '보통',
    sourceName: 'Lubrizol 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.lubrizol.com/', isDemo: true,
    tags: ['저자극', '퍼스널케어', '제형'],
    implication: '특허·시험 데이터·고객 평가를 확인한 뒤 자사 원료의 적용 범위와 추가 실험 필요성을 정리합니다.',
  },
  {
    id: 'sig-06', title: '원료 지속가능성 주장과 규제 대응 점검',
    summary: '예시 시나리오입니다. 고객사가 원료의 환경 관련 증빙을 요구하는 경우를 가정합니다. 특정 신규 규제가 시행됐다는 뉴스가 아닙니다.',
    companyId: 'kci', competitor: 'Inolex', category: '규제·정책', region: '유럽', date: '2026-10-26', impact: '보통',
    sourceName: 'Inolex 기업 홈페이지 · 참고 링크', sourceUrl: 'https://inolex.com/', isDemo: true,
    tags: ['원료 증빙', '지속가능성', '규제 검토'],
    implication: '적용 국가·제품군별 공식 규정과 고객 요구를 확인하고, 인증 및 증빙 자료의 공백을 점검합니다.',
  },
  {
    id: 'sig-07', title: '바이오 기반 계면활성제의 고객 전환 가설',
    summary: '예시 시나리오입니다. 고객이 바이오 기반 대체 원료를 검토하는 상황에서 성능·원가·공급 가능성을 비교합니다.',
    companyId: 'verdant', competitor: 'Stepan', category: '제품·시장', region: '북미', date: '2026-10-28', impact: '높음',
    sourceName: 'Stepan 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.stepan.com/', isDemo: true,
    tags: ['계면활성제', '바이오 기반', '홈케어'],
    implication: '실제 고객 요구와 원료 인증을 확보하고, 기존 제품 대비 대체 가능성과 가격 민감도를 검증합니다.',
  },
  {
    id: 'sig-08', title: '지역별 계면활성제 생산 대응력 비교 시나리오',
    summary: '예시 시나리오입니다. 특정 지역의 수요 증가나 물류 차질을 가정해 현지 생산과 공급 대응력을 평가합니다. 실제 증설 발표가 아닙니다.',
    companyId: 'verdant', competitor: 'Nouryon', category: '투자·증설', region: '유럽', date: '2026-10-27', impact: '보통',
    sourceName: 'Nouryon 기업 홈페이지 · 참고 링크', sourceUrl: 'https://www.nouryon.com/', isDemo: true,
    tags: ['생산 거점', '공급망', '리드타임'],
    implication: '공식 생산 거점과 가동·투자 발표를 확인하고, 지역별 고객 서비스 범위와 공급 대안을 비교합니다.',
  },
  {
    id: 'sig-09', title: '산업용 스페셜티의 인접 응용시장 탐색',
    summary: '예시 시나리오입니다. 퍼스널케어 외 산업용 응용 분야로의 확장을 가정해 경쟁 제품과 고객 문제를 조사합니다.',
    companyId: 'verdant', competitor: 'Innospec', category: '제품·시장', region: '글로벌', date: '2026-10-26', impact: '낮음',
    sourceName: 'Innospec 기업 홈페이지 · 참고 링크', sourceUrl: 'https://innospec.com/', isDemo: true,
    tags: ['산업용 소재', '응용시장', '신사업'],
    implication: '경쟁사의 실제 제품·적용처 자료를 확보하고, 자사 기술 적합성 및 고객 검증 비용을 함께 평가합니다.',
  },
];

export type Competitor = {
  id: string;
  name: string;
  companyId: CompanyId;
  region: string;
  country: string;
  segment: string;
  position: '직접 경쟁' | '인접 시장';
  description: string;
  sourceUrl: string;
  x: number;
  y: number;
};

export const competitors: Competitor[] = [
  { id: 'jsr', name: 'JSR', companyId: 'ncchem', region: '아시아', country: '일본', segment: '반도체 공정 소재', position: '직접 경쟁', description: '전자재료의 기술·제품 동향을 살펴볼 모니터링 후보입니다. 제품별 경쟁 관계는 추가 확인이 필요합니다.', sourceUrl: 'https://www.jsr.co.jp/', x: 10, y: 99 },
  { id: 'tok', name: 'TOK', companyId: 'ncchem', region: '아시아', country: '일본', segment: '포토레지스트 · 공정 소재', position: '직접 경쟁', description: '노광·공정용 화학 소재의 제품과 고객 적용 동향을 살펴볼 후보입니다.', sourceUrl: 'https://www.tok.co.jp/', x: 35, y: 99 },
  { id: 'merck', name: 'Merck', companyId: 'ncchem', region: '유럽', country: '독일', segment: '전자재료 · 스페셜티', position: '인접 시장', description: '폭넓은 전자재료 포트폴리오에서 인접 공정과 협업 가능성을 검토할 후보입니다.', sourceUrl: 'https://www.merckgroup.com/', x: 60, y: 99 },
  { id: 'fujifilm', name: 'FUJIFILM', companyId: 'ncchem', region: '아시아', country: '일본', segment: '반도체 전자재료', position: '인접 시장', description: '전자재료 응용 분야와 공급망 관련 공개 자료를 살펴볼 후보입니다.', sourceUrl: 'https://www.fujifilm.com/', x: 85, y: 99 },
  { id: 'ashland', name: 'Ashland', companyId: 'kci', region: '북미', country: '미국', segment: '퍼스널케어 기능성 원료', position: '직접 경쟁', description: '컨디셔닝·제형 기능성 원료에서 제품별 경쟁 접점을 확인할 후보입니다.', sourceUrl: 'https://www.ashland.com/', x: 10, y: 66 },
  { id: 'lubrizol', name: 'Lubrizol', companyId: 'kci', region: '북미', country: '미국', segment: '폴리머 · 퍼스널케어', position: '직접 경쟁', description: '퍼스널케어 폴리머와 제형 기능의 차별화 요소를 비교할 후보입니다.', sourceUrl: 'https://www.lubrizol.com/', x: 35, y: 66 },
  { id: 'inolex', name: 'Inolex', companyId: 'kci', region: '북미', country: '미국', segment: '퍼스널케어 스페셜티', position: '직접 경쟁', description: '퍼스널케어 대체 원료 및 지속가능성 관련 공개 제품 자료를 살펴볼 후보입니다.', sourceUrl: 'https://inolex.com/', x: 60, y: 66 },
  { id: 'evonik-kci', name: 'Evonik', companyId: 'kci', region: '유럽', country: '독일', segment: '케어 솔루션 · 스페셜티', position: '인접 시장', description: '퍼스널케어 원료의 제품 조합과 기능성 솔루션을 비교할 후보입니다.', sourceUrl: 'https://www.evonik.com/', x: 85, y: 66 },
  { id: 'stepan', name: 'Stepan', companyId: 'verdant', region: '북미', country: '미국', segment: '계면활성제', position: '직접 경쟁', description: '계면활성제 제품군과 홈·퍼스널케어 응용 분야를 살펴볼 후보입니다.', sourceUrl: 'https://www.stepan.com/', x: 10, y: 33 },
  { id: 'innospec', name: 'Innospec', companyId: 'verdant', region: '북미', country: '미국', segment: '계면활성제 · 기능성 화학', position: '직접 경쟁', description: '퍼스널케어·홈케어·산업용 기능성 제품의 경쟁 접점을 확인할 후보입니다.', sourceUrl: 'https://innospec.com/', x: 35, y: 33 },
  { id: 'nouryon', name: 'Nouryon', companyId: 'verdant', region: '유럽', country: '네덜란드', segment: '계면활성제 · 스페셜티', position: '직접 경쟁', description: '계면활성제와 산업용 응용 소재의 제품·생산 거점 자료를 살펴볼 후보입니다.', sourceUrl: 'https://www.nouryon.com/', x: 60, y: 33 },
  { id: 'basf', name: 'BASF', companyId: 'verdant', region: '유럽', country: '독일', segment: '케어 원료 · 화학 소재', position: '인접 시장', description: '케어 원료 포트폴리오와 폭넓은 산업 응용 분야에서 경쟁 접점을 확인할 후보입니다.', sourceUrl: 'https://www.basf.com/', x: 85, y: 33 },
  { id: 'evonik-verdant', name: 'Evonik', companyId: 'verdant', region: '유럽', country: '독일', segment: '계면활성제 · 케어 솔루션', position: '인접 시장', description: '케어·산업용 기능성 소재의 응용 분야와 제품 차별화를 비교할 후보입니다.', sourceUrl: 'https://www.evonik.com/', x: 50, y: 0 },
];

export type WatchTopic = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  companyId: CompanyId;
};

export const watchTopics: WatchTopic[] = [
  { id: 'topic-euv', title: '첨단 반도체 소재', description: '노광 기술 전환과 고순도 소재의 고객 인증 요건을 추적합니다.', keywords: ['EUV', '포토레지스트', '고순도 소재'], companyId: 'ncchem' },
  { id: 'topic-supply', title: '전자재료 공급망', description: '경쟁사의 실제 투자 발표와 지역별 공급 기반을 확인합니다.', keywords: ['생산 거점', '공급망', '투자'], companyId: 'ncchem' },
  { id: 'topic-hair', title: '차세대 헤어케어', description: '컨디셔닝 성능과 제형 적용에 관한 고객 요구를 살펴봅니다.', keywords: ['헤어케어', '컨디셔닝 폴리머', '제형'], companyId: 'kci' },
  { id: 'topic-clean', title: '지속가능 퍼스널케어', description: '대체 원료와 환경 관련 주장에 필요한 근거를 확인합니다.', keywords: ['퍼스널케어', '지속가능성', '원료 증빙'], companyId: 'kci' },
  { id: 'topic-surfactant', title: '지속가능 계면활성제', description: '바이오 기반 원료와 저자극 제형의 적용 가능성을 살펴봅니다.', keywords: ['계면활성제', '바이오 기반', '저자극'], companyId: 'verdant' },
  { id: 'topic-industry', title: '산업용 응용시장', description: '인접 산업의 고객 문제와 소재 적용 기회를 탐색합니다.', keywords: ['산업용 소재', '홈케어', '신사업'], companyId: 'verdant' },
];
