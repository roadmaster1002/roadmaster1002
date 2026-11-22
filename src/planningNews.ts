import type { CompanyId } from './data';

type PlanningNewsItem = {
  companyId: CompanyId;
  date: string;
  title: string;
  summary: string;
  insight: string;
  source: string;
  url: string;
};

export const planningNewsUpdated = '2026-11-23';

export const planningNews: PlanningNewsItem[] = [
  {
    companyId: 'kci',
    date: '2026-11-23',
    title: '클라리언트·CD&R, 애쉬랜드 인수 협상 보도',
    summary: '블룸버그는 한국시간 23일 두 회사가 퍼스널케어 원료 업체 애쉬랜드의 현금 인수를 논의 중이라고 보도했다. 보도 시점에 최종 합의는 없었다.',
    insight: '합의가 발표되면 애쉬랜드의 헤어 컨디셔닝 폴리머와 지역별 유통권이 거래에 포함되는지 확인해 KCI의 경쟁 제품 비교표를 갱신할 수 있다.',
    source: '블룸버그 보도',
    url: 'https://news.bloomberglaw.com/private-equity/clariant-and-cd-r-said-in-talks-to-buy-chemicals-firm-ashland',
  },
  {
    companyId: 'verdant',
    date: '2026-11-21',
    title: 'Aarti Surfactants, 인도 세관의 관세 추징 명령 공시',
    summary: '인도 세관은 회사 분할 전 수입품의 품목분류와 면세 적용을 문제 삼아 약 1,275만 루피의 관세 추징을 명령했다. 회사는 재무 영향과 불복 여부를 검토 중이다.',
    insight: '인도향 원료 견적에 면세를 가정했다면, 제품별 품목분류 코드와 수입자가 보유한 면세 근거를 대조해 도착원가를 다시 계산할 수 있다.',
    source: 'Aarti Surfactants 거래소 공시',
    url: 'https://nsearchives.nseindia.com/corporate/AARTISURF_21112026173347_AARTISURF.pdf',
  },
  {
    companyId: 'ncchem',
    date: '2026-11-20',
    title: 'JSR, 한국 금속산화물 레지스트 공장의 양산 준비 현황 공개',
    summary: 'JSR은 9월 준공한 한국 공장을 첨단 메모리용 금속산화물 레지스트(MOR)의 양산 거점으로 제시했다. 2026회계연도 상반기 전자재료 매출은 전년 동기보다 36% 늘어난 1,228억 엔이었다.',
    insight: '고객별 메모리 공정에서 MOR 비교평가 시점과 기존 포토레지스트 원료의 재인증 일정을 대조하면, 삼양엔씨켐이 먼저 공급할 평가용 샘플을 정할 수 있다.',
    source: 'JSR 사업설명회 회의록',
    url: 'https://ssl4.eir-parts.net/doc/4185/ir_material_for_fiscal_ym/219569/00.pdf',
  },
  {
    companyId: 'verdant',
    date: '2026-11-19',
    title: 'Polykem, 이스탄불 전시회에서 베타인 2종 소개 예정',
    summary: 'Polykem Care는 11월 25~27일 TURKCHEM에서 코카미도프로필베타인과 라우릴베타인을 소개하고 제품 규격과 샘플 문의를 받겠다고 발표했다.',
    insight: '샴푸·보디워시 고객이 대체 원료를 평가할 때 쓸 수 있도록, 같은 활성분 농도에서 Verdant 베타인의 거품 유지력과 제형 점도를 비교한 자료를 준비할 만하다.',
    source: 'Polykem Care 전시 안내',
    url: 'https://polykem-care.com/discover-polykem-cares-surfactant-portfolio-at-turkchem-eurasia-2026/',
  },
  {
    companyId: 'kci',
    date: '2026-11-18',
    title: '이놀렉스, 식물 유래 헤어 컨디셔닝 원료 출시',
    summary: '이놀렉스는 ProCondition Satin을 출시했다. 자사 시험에서 이 원료를 사용한 젖은 웨이브 모발은 폴리쿼터늄-7·-10을 사용했을 때보다 빗질이 쉽고 부드러웠다고 밝혔다.',
    insight: '고객의 실제 린스 제형에서 KCI 원료와 신제품의 투입 원가를 맞춘 뒤 젖은 모발을 빗는 데 필요한 힘을 측정하면, 성능과 비용을 함께 비교할 수 있다.',
    source: '이놀렉스 제품 발표·시험 조건',
    url: 'https://www.inolex.com/about/news/weightless-conditioning-from-scalp-to-strand',
  },
  {
    companyId: 'ncchem',
    date: '2026-11-17',
    title: 'TSMC, 도쿄오카공업의 기술·생산 지원과 해외 거점 지원을 평가',
    summary: 'TSMC는 공급망 포럼에서 도쿄오카공업(TOK)에 기술·생산 지원과 글로벌 지원 두 부문을 시상했다. 올해 공급사 평가에서는 현지화와 글로벌 지원의 비중을 높였다고 밝혔다.',
    insight: '해외 고객의 소재 평가 요청에 대비해 거점별 샘플 납기, 로트 추적에 걸리는 시간, 품질 문의 대응 시간을 제안서에 명시할 수 있는지 점검할 만하다.',
    source: 'TSMC 공급망 포럼 발표',
    url: 'https://pr.tsmc.com/english/news/3355',
  },
];
