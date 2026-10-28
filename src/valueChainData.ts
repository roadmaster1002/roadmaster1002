import type { CompanyId } from './data';

/**
 * Analyst-authored industry navigation, not a verified supplier/customer graph.
 * The process order is simplified; semiconductor steps repeat in real production.
 * Named firms are research references for broadly known business roles. Placement
 * does not establish a supply contract, approved supplier status or market share.
 * Homepages are reference links, not evidence for current events. Product-level
 * competition and the three businesses' exact products require primary review.
 */
export type ChainParticipant = {
  id: string;
  name: string;
  role: string;
  relationship: '자사' | '경쟁 후보' | '전후방 참고';
  sourceUrl: string;
  description: string;
  earningsLogic: string;
  watchPoints: string[];
};
export type ProcessStage = {
  id: string;
  name: string;
  subtitle: string;
  input: string;
  transformation: string;
  output: string;
  role: string;
  watchPoints: string[];
  equipment: ChainParticipant[];
  materials: ChainParticipant[];
};
export type ValueChain = {
  id: CompanyId;
  title: string;
  subtitle: string;
  flow: string;
  startingPoint: string;
  endingPoint: string;
  stages: ProcessStage[];
  themes: { id: string; label: string; stageIds: string[] }[];
};

const participant = (
  id: string, name: string, role: string, sourceUrl: string,
  description: string, earningsLogic: string,
  relationship: ChainParticipant['relationship'] = '전후방 참고',
  watchPoints: string[] = ['공식 제품 자료에서 적용 공정·제품 등급 확인', '실제 고객·공급 관계는 공시 또는 양사 발표로 별도 검증'],
): ChainParticipant => ({ id, name, role, sourceUrl, description, earningsLogic, relationship, watchPoints });

const nc = participant('samyang-ncchem', '삼양엔씨켐', '반도체용 정밀화학 소재', 'https://www.samyangncchem.com/', '반도체 소재 가치사슬에서 정밀화학·고순도 소재의 역할을 검토하는 자사 기준점입니다. 개별 제품·적용처·양산 승인 여부는 최신 공식 자료로 확인해야 합니다.', '정밀화학 소재의 제품 판매와 고객별 품질·공정 요구 대응을 통해 가치를 제공하는 사업모델로 이해합니다. 구체적인 계약·판매단가는 확인 대상입니다.', '자사', ['제품별 실제 적용 공정과 고객 인증 상태', '고순도·불순물 관리 및 공정 세대 전환 대응', '공개 제품군과 경쟁 후보 제품의 직접 중첩 여부']);
const kci = participant('samyang-kci', '삼양KCI', '컨디셔닝·퍼스널케어 원료', 'https://www.kciltd.com/', '퍼스널케어 기능성 원료 가치사슬에서 컨디셔닝 등 제형 기능과 관련된 자사 기준점입니다. 제품별 성능·인증·고객 적용은 별도 확인합니다.', '기능성 원료 공급과 제형 적용 지원을 통해 원료의 성능·품질·공급 가치를 판매하는 구조입니다. 매출 구성이나 고객 계약을 뜻하지 않습니다.', '자사', ['컨디셔닝 성능과 제형 적합성', '지속가능성 관련 인증·주장의 근거', '고객 제형 승인과 제품별 대체 경쟁']);
const verdant = participant('verdant', 'Verdant', '계면활성제·스페셜티 원료', 'https://www.verdantspecialty.com/', '퍼스널케어·홈케어·산업용 계면활성제와 스페셜티 원료의 자사 기준점입니다. 각 응용 분야의 제품·제조 거점은 최신 자료 확인이 필요합니다.', '계면활성제와 응용별 스페셜티 제품을 제조·공급하고 고객 요구에 맞는 성능과 공급 안정성으로 가치를 제공하는 구조입니다.', '자사', ['응용 분야별 제품 경쟁력과 수요', '원료 비용·가용성 및 생산 대응', '저자극·바이오 기반 등 주장의 검증 자료']);

const basf = participant('basf', 'BASF', '화학 원료·케어 소재', 'https://www.basf.com/', '화학 원료와 케어 소재의 폭넓은 포트폴리오를 살펴보는 비교 대상입니다. 각 단계의 제품 연결은 추가 검증이 필요합니다.', '화학 원료·기능성 소재 판매와 고객 응용 지원을 결합하는 사업모델을 검토합니다.');
const merck = participant('merck', 'Merck', '전자재료·공정 소재', 'https://www.merckgroup.com/', '전자재료와 반도체 공정용 소재의 제품별 역할을 비교할 후보입니다.', '소재 품질과 공정 적합성에 기반한 전자재료 판매·기술 지원 모델을 검토합니다.', '경쟁 후보');
const jsr = participant('jsr', 'JSR', '포토레지스트·전자재료', 'https://www.jsr.co.jp/', '노광 공정용 소재와 전자재료 포트폴리오를 살펴볼 후보입니다. 원료 단계의 직접 경쟁 여부는 제품별 확인이 필요합니다.', '공정 성능·품질·고객 인증을 기반으로 소재를 공급하는 구조를 검토합니다.', '경쟁 후보');
const tok = participant('tok', 'TOK', '포토레지스트·공정 화학', 'https://www.tok.co.jp/', '감광성 소재와 관련 공정용 화학제품의 응용을 비교할 후보입니다.', '공정용 화학제품 판매와 고객 요구에 맞춘 품질·적용 지원 구조를 검토합니다.', '경쟁 후보');
const dongjin = participant('dongjin', '동진쎄미켐', '전자재료·포토 소재', 'https://www.dongjin.com/', '반도체·전자재료 제품군에서 노광 소재의 적용 범위를 확인할 후보입니다.', '전자재료의 개발·제조·판매와 공정 적합성 확보를 통한 가치 제공 구조를 검토합니다.', '경쟁 후보');
const sumco = participant('sumco', 'SUMCO', '실리콘 웨이퍼', 'https://www.sumcosi.com/', '반도체 회로 제조의 기초가 되는 실리콘 웨이퍼 사업을 살펴볼 전방 참고 기업입니다.', '웨이퍼의 규격·품질·공급 역량을 기반으로 기판을 공급하는 모델입니다.');
const shinetsu = participant('shinetsu', 'Shin-Etsu', '실리콘·화학 소재', 'https://www.shinetsu.co.jp/', '웨이퍼와 다양한 화학 소재의 사업 범위를 살펴볼 기업입니다. 각 제품군은 구분해서 확인해야 합니다.', '웨이퍼·화학 소재 등 제품별 제조·공급을 통해 가치를 제공하는 모델입니다.');
const asml = participant('asml', 'ASML', '노광 시스템', 'https://www.asml.com/', '웨이퍼에 회로 패턴을 전사하는 노광 시스템의 역할을 이해하기 위한 장비 기업입니다.', '노광 장비와 관련 서비스·업그레이드 제공 구조를 검토합니다.');
const tel = participant('tel', 'Tokyo Electron', '코팅·현상·식각·성막 장비', 'https://www.tel.com/', '여러 반도체 제조 단계에 걸친 공정 장비의 역할을 살펴볼 기업입니다. 단계별 제품은 공식 목록으로 확인합니다.', '반도체 공정 장비와 부품·유지보수 서비스를 제공하는 모델입니다.');
const lam = participant('lam', 'Lam Research', '식각·증착 공정 장비', 'https://www.lamresearch.com/', '식각과 박막 형성 등 여러 제조 단계의 공정 장비를 살펴볼 기업입니다.', '공정 장비 판매와 설치 장비에 대한 서비스·부품 제공 모델입니다.');
const amat = participant('amat', 'Applied Materials', '성막·공정 장비', 'https://www.appliedmaterials.com/', '반도체 재료 형성·가공에 쓰이는 장비의 적용 범위를 살펴볼 기업입니다.', '재료 공정 장비와 서비스·업그레이드 제공을 통한 모델입니다.');
const kla = participant('kla', 'KLA', '검사·계측', 'https://www.kla.com/', '공정 중 결함 검사와 계측의 역할을 이해할 참고 기업입니다.', '검사·계측 시스템과 소프트웨어·서비스를 제공하는 모델입니다.');
const amkor = participant('amkor', 'Amkor', '패키징·테스트', 'https://amkor.com/', '칩의 패키징과 테스트를 수행하는 후공정 서비스의 역할을 살펴볼 기업입니다.', '패키징·테스트 공정 서비스의 제공과 생산 역량 활용 모델입니다.');
const ase = participant('ase', 'ASE', '패키징·테스트', 'https://www.aseglobal.com/', '반도체 후공정 서비스와 패키징 기술의 역할을 살펴볼 기업입니다.', '패키징·테스트 서비스와 고객별 제조 대응을 제공하는 모델입니다.');
const ashland = participant('ashland', 'Ashland', '퍼스널케어 기능성 소재', 'https://www.ashland.com/', '컨디셔닝과 제형 기능성 소재의 제품별 중첩을 확인할 경쟁 후보입니다.', '기능성 원료 공급과 응용·제형 지원으로 성능 가치를 제공하는 모델입니다.', '경쟁 후보');
const lubrizol = participant('lubrizol', 'Lubrizol', '폴리머·케어 원료', 'https://www.lubrizol.com/', '퍼스널케어 폴리머와 제형 기능을 비교할 후보입니다. 제품별 직접 경쟁 관계를 별도로 검증합니다.', '기능성 소재·첨가제 공급과 고객 응용 지원을 결합한 모델입니다.', '경쟁 후보');
const inolex = participant('inolex', 'Inolex', '퍼스널케어 스페셜티', 'https://inolex.com/', '퍼스널케어 제형의 기능성·대체 원료와 관련 주장을 비교할 후보입니다.', '스페셜티 원료 판매와 제형 솔루션 제안을 통해 가치를 제공하는 모델입니다.', '경쟁 후보');
const evonik = participant('evonik', 'Evonik', '케어·스페셜티 소재', 'https://www.evonik.com/', '케어 소재와 계면활성 기능의 적용 분야를 비교할 후보입니다.', '스페셜티 원료 공급과 응용 기술 지원을 통한 모델입니다.', '경쟁 후보');
const croda = participant('croda', 'Croda', '기능성 원료·제형 지원', 'https://www.croda.com/', '뷰티·케어 원료의 기능과 고객 적용 제안을 살펴볼 기업입니다.', '차별화된 기능성 원료와 응용 지원을 통해 가치를 제공하는 모델입니다.', '경쟁 후보');
const stepan = participant('stepan', 'Stepan', '계면활성제', 'https://www.stepan.com/', '홈·퍼스널케어 등 계면활성제 제품의 응용 분야를 비교할 후보입니다.', '계면활성제 제조·공급과 응용 요구 대응을 통한 모델입니다.', '경쟁 후보');
const nouryon = participant('nouryon', 'Nouryon', '계면활성제·스페셜티', 'https://www.nouryon.com/', '계면활성제와 여러 산업용 스페셜티 제품의 범위를 비교할 후보입니다.', '스페셜티 화학제품 제조·공급과 응용 지원을 통한 모델입니다.', '경쟁 후보');
const innospec = participant('innospec', 'Innospec', '계면활성제·기능성 화학', 'https://innospec.com/', '케어·산업용 계면활성 기능과 제품 구성을 비교할 후보입니다.', '응용별 기능성 화학제품 판매와 고객 맞춤 기술 지원 모델입니다.', '경쟁 후보');
const sasol = participant('sasol', 'Sasol', '기초·특수 화학 원료', 'https://www.sasol.com/', '계면활성제 관련 원료와 화학제품의 역할을 살펴볼 기업입니다. 구체적 공급 관계는 별도 확인합니다.', '화학 원료·제품 생산과 판매를 통해 가치를 제공하는 모델입니다.');
const klk = participant('klk', 'KLK OLEO', '올레오케미컬', 'https://www.klkoleo.com/', '유지 기반 화학 원료의 종류와 공급·인증 요구를 살펴볼 기업입니다.', '유지 기반 화학 원료의 제조·공급을 통해 가치를 제공하는 모델입니다.');
const cargill = participant('cargill', 'Cargill', '바이오·유지 기반 원료', 'https://www.cargill.com/', '유지와 바이오 기반 응용 원료의 역할을 살펴볼 기업입니다. 특정 자사 제품의 원료 공급사를 뜻하지 않습니다.', '농산·유지 기반 원료의 가공·판매와 공급 대응 모델입니다.');
const ika = participant('ika', 'IKA', '혼합·분산 장비', 'https://www.ika.com/', '원료 혼합과 제형 시험에 쓰이는 장비 범위를 살펴볼 기업입니다.', '실험·생산용 혼합·분산 장비와 관련 서비스 제공 모델입니다.');
const gea = participant('gea', 'GEA', '혼합·처리·생산 설비', 'https://www.gea.com/', '액상 처리와 생산 공정 설비의 역할을 살펴볼 기업입니다. 특정 공장 납품 관계를 뜻하지 않습니다.', '생산 설비·공정 솔루션과 유지보수 서비스를 제공하는 모델입니다.');
const silverson = participant('silverson', 'Silverson', '혼합·유화 장비', 'https://www.silverson.com/', '제형 혼합·유화 장비의 역할을 이해할 참고 기업입니다.', '혼합 장비와 응용·운영 지원을 제공하는 모델입니다.');
const sgs = participant('sgs', 'SGS', '시험·인증 서비스', 'https://www.sgs.com/', '원료·완제품의 품질·규격 확인에 필요한 외부 시험·인증 서비스의 역할을 살펴볼 기업입니다.', '시험·검사·인증 서비스 비용을 받는 모델입니다. 인증 보유를 의미하지 않습니다.');
const intertek = participant('intertek', 'Intertek', '시험·품질 검증', 'https://www.intertek.com/', '제품 규격과 성능 주장에 대한 외부 검증 서비스의 역할을 살펴볼 기업입니다.', '시험·검사·인증·보증 서비스를 제공하는 모델입니다.');
const cosmax = participant('cosmax', '코스맥스', '화장품 ODM', 'https://www.cosmax.com/', '원료를 완제품 제형과 제조로 연결하는 화장품 ODM의 역할을 살펴볼 기업입니다. 자사 고객이라는 의미는 아닙니다.', '브랜드 고객을 위한 제품 개발·제조 서비스를 제공하는 모델입니다.');
const kolmar = participant('kolmar', '한국콜마', '화장품 ODM', 'https://www.kolmar.co.kr/', '화장품 개발·제조 단계에서 기능성 원료가 평가·채택되는 흐름을 이해할 참고 기업입니다.', '브랜드 고객의 제형 개발·생산 요구에 대응하는 제조 서비스 모델입니다.');
const loreal = participant('loreal', "L'Oréal", '뷰티 브랜드·완제품', 'https://www.loreal.com/', '원료의 기능이 최종 뷰티 제품의 고객 가치로 전환되는 흐름을 살펴볼 기업입니다.', '브랜드 완제품의 기획·판매와 유통 채널 운영을 통한 모델입니다.');
const unilever = participant('unilever', 'Unilever', '홈·퍼스널케어 완제품', 'https://www.unilever.com/', '케어 원료가 브랜드 완제품과 소비자 수요로 연결되는 흐름을 이해할 참고 기업입니다.', '브랜드 완제품을 소비자·유통 채널에 판매하는 모델입니다.');
const brenntag = participant('brenntag', 'Brenntag', '화학 원료 유통', 'https://www.brenntag.com/', '원료 제조사와 다양한 고객 사이의 유통·물류·응용 지원 역할을 살펴볼 기업입니다. 특정 판매 대리 관계를 뜻하지 않습니다.', '제품 유통·물류와 부가 서비스 제공을 결합하는 모델입니다.');
const imcd = participant('imcd', 'IMCD', '스페셜티 원료 유통', 'https://www.imcdgroup.com/', '스페셜티 원료의 고객 접근과 응용 지원을 살펴볼 유통 기업입니다.', '스페셜티 원료 유통과 기술·응용 지원을 제공하는 모델입니다.');
const azelis = participant('azelis', 'Azelis', '스페셜티 원료 유통', 'https://www.azelis.com/', '원료 포트폴리오와 제형 지원을 통해 고객 수요를 연결하는 유통 역할의 참고 기업입니다.', '원료 유통과 응용 기술·고객 지원을 결합하는 모델입니다.');
const ecolab = participant('ecolab', 'Ecolab', '산업용 위생·세정 솔루션', 'https://www.ecolab.com/', '산업용 세정·위생 분야에서 계면활성 기능이 최종 솔루션으로 연결되는 흐름을 살펴볼 기업입니다.', '위생·세정 관련 제품과 고객 현장 서비스를 결합하는 모델입니다.');

export const chains: Record<CompanyId, ValueChain> = {
  ncchem: {
    id: 'ncchem', title: '정밀화학 소재가 반도체가 되기까지',
    subtitle: '원료 합성 → 고순도 소재 → 감광액 → 노광·가공 → 완성 반도체',
    flow: '기초 원료 → 정밀 합성·정제 → 소재 배합 → 웨이퍼 준비 → 코팅·노광 → 식각·성막 → 검사 → 패키징',
    startingPoint: '정밀화학 원료', endingPoint: '완성 반도체',
    themes: [
      { id: 'all', label: '전체 흐름', stageIds: [] },
      { id: 'photo', label: '포토·EUV', stageIds: ['nc-synthesis', 'nc-formulation', 'nc-photo'] },
      { id: 'purity', label: '고순도·품질', stageIds: ['nc-feedstock', 'nc-synthesis', 'nc-inspection'] },
      { id: 'supply', label: '고객 인증·공급망', stageIds: ['nc-synthesis', 'nc-formulation', 'nc-inspection', 'nc-package'] },
    ],
    stages: [
      { id: 'nc-feedstock', name: '기초 원료', subtitle: '원료의 출발점을 확보한다', input: '화학 기초 원료·유기 중간체', transformation: '원료 등급과 공급 안정성을 확인하고 합성에 필요한 출발 물질을 준비합니다.', output: '정밀 합성용 원료', role: '원료 생산·유통 기업은 합성 단계에 필요한 품질과 공급 가용성을 제공합니다.', watchPoints: ['원료 가용성과 지역 편중', '추적성·안전·규제 자료'], equipment: [], materials: [basf, shinetsu] },
      { id: 'nc-synthesis', name: '정밀 합성·정제', subtitle: '필요한 구조와 순도를 만든다', input: '출발 원료·반응 조건', transformation: '목표 기능의 분자를 합성하고 불순물을 관리합니다. 자사 개별 제품의 실제 연결은 공식 자료로 확인합니다.', output: '고순도 정밀화학 소재', role: '정밀화학 기업은 분자 설계·합성·순도 관리 역량으로 소재의 기능과 일관성을 제공합니다.', watchPoints: ['금속·미세 불순물 관리', '배치 일관성과 수율', '제품별 고객 인증 상태'], equipment: [], materials: [nc, merck, shinetsu] },
      { id: 'nc-formulation', name: '소재 배합', subtitle: '공정에서 작동하는 조합을 만든다', input: '기능성 성분·수지·용제 등', transformation: '적용 공정에 맞는 조성으로 배합·여과하고 성능을 평가합니다. 특정 원료의 공급 관계는 표시하지 않습니다.', output: '감광액·공정용 화학제품', role: '소재 배합 기업은 고객의 공정 창과 품질 기준에 맞는 최종 소재를 제공합니다.', watchPoints: ['노광 세대별 요구 성능', '제품별 원료 중첩과 대체성', '고객 평가·승인 일정'], equipment: [], materials: [jsr, tok, dongjin] },
      { id: 'nc-wafer', name: '웨이퍼 준비', subtitle: '회로를 만들 기판을 준비한다', input: '실리콘 소재·웨이퍼', transformation: '기판 품질과 표면 상태를 확보하고 반도체 공정에 투입합니다.', output: '공정 투입용 웨이퍼', role: '웨이퍼 기업과 공정 장비 기업은 회로 형성의 출발 기판을 준비합니다.', watchPoints: ['웨이퍼 규격·결함', '공정 투입 수요와 생산 가동'], equipment: [tel], materials: [sumco, shinetsu] },
      { id: 'nc-photo', name: '코팅·노광', subtitle: '빛으로 패턴을 만든다', input: '웨이퍼·감광 소재·마스크', transformation: '감광액을 코팅하고 빛으로 패턴을 전사한 뒤 현상합니다. 첨단 구조에서 여러 번 반복됩니다.', output: '패턴이 형성된 웨이퍼', role: '장비는 패턴 구현을, 소재는 감도·해상도·결함 등 공정 성능을 담당합니다.', watchPoints: ['DUV·EUV 공정 전환', '장비·소재의 공정 적합성', '고객 양산 검증'], equipment: [asml, tel], materials: [jsr, tok, dongjin] },
      { id: 'nc-processing', name: '식각·성막', subtitle: '패턴을 재료 구조로 전환한다', input: '패턴 웨이퍼·막 형성 소재·공정 가스', transformation: '불필요한 막을 제거하거나 필요한 막을 형성합니다. 실제 제조에서는 세정·계측과 함께 반복됩니다.', output: '기능 구조·박막이 형성된 웨이퍼', role: '장비 기업과 공정 소재 기업은 선택성·균일도·결함 관리를 통해 구조 형성에 기여합니다.', watchPoints: ['구조 미세화와 공정 횟수 변화', '소재 소모량과 불량·수율', '장비별 적용 가능 공정'], equipment: [lam, amat], materials: [merck, shinetsu] },
      { id: 'nc-inspection', name: '검사·계측', subtitle: '결함과 공정 결과를 확인한다', input: '가공된 웨이퍼·공정 데이터', transformation: '패턴·막·결함을 측정하고 품질 판정과 공정 개선에 연결합니다. 단일 마지막 단계만이 아니라 공정 중에도 수행됩니다.', output: '검증 데이터·선별 결과', role: '검사·계측 기업은 공정 이상 발견과 품질 개선을 지원합니다.', watchPoints: ['불순물·결함과 소재 상관성', '고객 판정 기준과 검증 자료'], equipment: [kla], materials: [nc, merck] },
      { id: 'nc-package', name: '패키징·출하', subtitle: '칩을 보호하고 연결한다', input: '제조·선별된 칩·패키지 소재', transformation: '칩을 연결·보호하는 구조로 조립하고 최종 테스트를 거쳐 출하합니다.', output: '사용 가능한 반도체 패키지', role: '후공정 기업은 연결·보호·테스트 서비스를 제공하며 소재 수요의 전방 변화를 보여줍니다.', watchPoints: ['첨단 패키징의 소재 요구', '메모리·로직 등 전방 수요', '소재 적용 범위는 제품별 별도 확인'], equipment: [], materials: [amkor, ase] },
    ],
  },
  kci: {
    id: 'kci', title: '기능성 원료가 매일의 케어가 되기까지',
    subtitle: '기초 원료 → 기능성 성분 → 제형 검증 → ODM 제조 → 브랜드 제품',
    flow: '원료 확보 → 기능성 합성 → 원료 설계·조합 → 제형 개발 → 품질·규격 검증 → 완제품 제조 → 브랜드·유통',
    startingPoint: '기능성 원료', endingPoint: '소비자 케어 제품',
    themes: [
      { id: 'all', label: '전체 흐름', stageIds: [] },
      { id: 'hair', label: '헤어케어·컨디셔닝', stageIds: ['kci-synthesis', 'kci-ingredients', 'kci-formulation'] },
      { id: 'sustainability', label: '지속가능 원료', stageIds: ['kci-feedstock', 'kci-synthesis', 'kci-validation'] },
      { id: 'customer', label: '고객 채택·제형', stageIds: ['kci-formulation', 'kci-validation', 'kci-manufacture', 'kci-brand'] },
    ],
    stages: [
      { id: 'kci-feedstock', name: '원료 확보', subtitle: '기능과 원산지의 출발점을 살핀다', input: '기초 화학·유지·바이오 기반 원료', transformation: '필요한 원료 등급과 안전·추적성 자료를 확보합니다. 바이오 기반이라는 사실만으로 환경 우위를 단정하지 않습니다.', output: '기능성 원료 제조의 투입 원료', role: '원료 기업은 공급 가용성·일관성·증빙을 제공합니다.', watchPoints: ['원산지·공급 안정성', '지속가능성 인증과 주장 범위', '원료 가격의 전가 조건'], equipment: [], materials: [basf, klk, cargill] },
      { id: 'kci-synthesis', name: '기능성 합성', subtitle: '컨디셔닝 등 필요한 기능을 만든다', input: '기초 원료·합성 공정', transformation: '목표 기능을 가진 소재를 합성·정제하고 일관된 규격으로 관리합니다.', output: '기능성 폴리머·케어 원료', role: '기능성 원료 기업은 분자·소재 구조와 제조 품질을 통해 제형 성능의 기반을 제공합니다.', watchPoints: ['성능·원가·순도 균형', '제품군별 경쟁 중첩', '생산 규격과 품질 변동'], equipment: [], materials: [kci, ashland, lubrizol] },
      { id: 'kci-ingredients', name: '원료 설계·조합', subtitle: '고객에게 제안할 기능을 구체화한다', input: '기능성 원료·안전·성능 자료', transformation: '헤어·스킨케어 등 적용처에 맞는 원료 구성과 사용 조건을 정의합니다.', output: '응용별 원료·제품 제안', role: '원료 기업은 차별화된 기능과 사용 편의성을 제안하고 제형 적용을 지원합니다.', watchPoints: ['컨디셔닝·감촉·제형 적합성', '시험 결과와 마케팅 주장 구분', '대체 원료와 고객 전환 비용'], equipment: [ika], materials: [kci, inolex, croda] },
      { id: 'kci-formulation', name: '제형 개발', subtitle: '소비자 경험으로 기능을 구현한다', input: '여러 기능성 원료·물·유상 등', transformation: '원료를 조합·혼합해 점도·안정성·사용감과 목표 성능을 갖는 제형을 개발합니다.', output: '시험 가능한 완제품 제형', role: 'ODM·브랜드·원료 응용 연구는 제형에서 원료를 평가하고 조합을 선택합니다.', watchPoints: ['동일 제형 내 상호작용', '성능 시험과 고객 사용감 평가', '승인·개발 리드타임'], equipment: [ika, silverson], materials: [cosmax, kolmar, kci] },
      { id: 'kci-validation', name: '품질·규격 검증', subtitle: '성능과 안전 주장의 근거를 확인한다', input: '원료·제형·시험 계획·규정', transformation: '제품 규격, 안정성, 적용 지역의 요구 자료를 확인합니다. 개별 인증 보유를 의미하지 않습니다.', output: '시험 결과·규격·증빙 자료', role: '내부 품질 조직과 외부 시험 기관은 채택·출시 판단에 필요한 근거를 제공합니다.', watchPoints: ['지역별 적용 규정과 표시 기준', '시험 조건·대조군·재현성', '환경 주장에 필요한 자료'], equipment: [sgs, intertek], materials: [kci, ashland] },
      { id: 'kci-manufacture', name: '완제품 제조', subtitle: '실험실 제형을 일관되게 생산한다', input: '승인 제형·원료·포장재', transformation: '배합·혼합·충전·품질 관리를 통해 브랜드 요구에 맞는 완제품을 생산합니다.', output: '출하 가능한 케어 제품', role: 'ODM·OEM과 생산 설비 기업은 규모와 일관성을 확보하고 원료 수요를 실제 생산으로 연결합니다.', watchPoints: ['배합 확대 시 안정성', '고객 발주와 재고', '고객 원료 변경 승인 절차'], equipment: [gea, silverson], materials: [cosmax, kolmar] },
      { id: 'kci-brand', name: '브랜드·유통', subtitle: '기능을 소비자의 선택으로 연결한다', input: '완제품·브랜드 기획·유통 채널', transformation: '브랜드가 소비자 요구에 맞게 제품을 기획하고 판매·피드백을 다음 개발에 반영합니다.', output: '소비자 경험·후속 원료 수요', role: '브랜드 수요와 유통 트렌드는 원료 기업이 어떤 성능을 준비할지 보여주는 전방 신호입니다.', watchPoints: ['소비자 기능 요구와 가격대', '클레임·리뉴얼·출시 주기', '수요 신호와 실제 구매량 구분'], equipment: [], materials: [loreal, unilever, imcd] },
    ],
  },
  verdant: {
    id: 'verdant', title: '계면활성 기능이 생활과 산업을 바꾸기까지',
    subtitle: '기초 원료 → 계면활성제 → 응용 배합 → 생산·유통 → 최종 사용',
    flow: '원료 확보 → 계면활성제 합성 → 기능성 배합 → 응용 제형 → 품질·생산 → 유통·기술 지원 → 최종 사용',
    startingPoint: '계면활성 원료', endingPoint: '케어·산업 솔루션',
    themes: [
      { id: 'all', label: '전체 흐름', stageIds: [] },
      { id: 'mild', label: '저자극·퍼스널케어', stageIds: ['v-synthesis', 'v-blend', 'v-formulation', 'v-use'] },
      { id: 'bio', label: '바이오 기반·공급망', stageIds: ['v-feedstock', 'v-synthesis', 'v-production'] },
      { id: 'industrial', label: '홈케어·산업용', stageIds: ['v-blend', 'v-formulation', 'v-distribution', 'v-use'] },
    ],
    stages: [
      { id: 'v-feedstock', name: '원료 확보', subtitle: '성능과 원가의 기반을 준비한다', input: '화학·유지 기반 출발 원료', transformation: '목표 성능과 합성 경로에 맞는 원료를 확보하고 품질·추적성·가용성을 확인합니다.', output: '계면활성제 제조용 원료', role: '상류 원료 기업의 가용성과 비용은 제품 원가·공급 조건에 영향을 줄 수 있습니다. 특정 공급 계약은 표시하지 않습니다.', watchPoints: ['원료 종류별 가격과 공급', '원산지·인증·추적성', '바이오 기반 주장과 실제 평가 범위'], equipment: [], materials: [sasol, klk, basf] },
      { id: 'v-synthesis', name: '계면활성제 합성', subtitle: '계면에서 작동하는 성질을 만든다', input: '출발 원료·합성·반응 조건', transformation: '세정·습윤·유화 등 기능을 위한 계면활성 소재를 제조하고 규격을 관리합니다.', output: '규격화된 계면활성제', role: '계면활성제 기업은 화학적 성질과 품질·공급 역량을 통해 고객 응용의 기반을 제공합니다.', watchPoints: ['기능별 제품 경쟁 중첩', '생산 역량과 가동 대응', '일관된 품질과 불순물 관리'], equipment: [], materials: [verdant, stepan, innospec, nouryon] },
      { id: 'v-blend', name: '기능성 배합', subtitle: '여러 요구를 함께 만족시킨다', input: '계면활성제·기능성 성분', transformation: '용도에 맞게 배합해 세정력·거품·저자극·안정성 등의 균형을 조정합니다.', output: '응용별 스페셜티 제품·배합', role: '스페셜티 기업은 개별 원료의 조합과 사용 편의성으로 고객의 제형 문제를 해결합니다.', watchPoints: ['성능 대 원가 비교', '다기능·저자극 검증', '고객 원료 변경 난이도'], equipment: [ika], materials: [verdant, innospec, evonik] },
      { id: 'v-formulation', name: '응용 제형', subtitle: '사용 환경에 맞게 기능을 구현한다', input: '배합 제품·기타 원료·목표 규격', transformation: '퍼스널케어·홈케어·산업용 등 실제 조건에 맞는 제형을 시험·조정합니다.', output: '응용 검증용 제형·솔루션', role: '원료 응용팀과 고객은 실제 사용 조건의 성능·안정성을 확인하며 원료를 채택합니다.', watchPoints: ['물 경도·온도·사용 조건', '다른 원료와의 호환성', '실험 성능과 현장 성능 구분'], equipment: [silverson, ika], materials: [verdant, nouryon, stepan] },
      { id: 'v-production', name: '품질·생산', subtitle: '검증된 기능을 일관되게 공급한다', input: '원료·승인 규격·배합 공정', transformation: '생산 규모에 맞는 공정을 운영하고 제품 규격·안전·물류 조건을 관리합니다.', output: '공급 가능한 소재·배합 제품', role: '제조·품질 조직은 원료와 배합의 성능을 일관된 제품 공급으로 전환합니다.', watchPoints: ['제품별 생산 거점과 리드타임', '생산능력과 실제 출하량 구분', '지역별 안전·규제 문서'], equipment: [gea], materials: [verdant, stepan, innospec] },
      { id: 'v-distribution', name: '유통·기술 지원', subtitle: '필요한 고객에게 제품과 지식을 연결한다', input: '소재·제품 정보·고객 요구', transformation: '물류·재고·제품 제안과 응용 지원으로 제조사와 다양한 고객을 연결합니다.', output: '고객 접근·배송·응용 지원', role: '유통 기업은 고객 접점과 물류·기술 지원을 제공합니다. 표시 기업이 자사의 판매 대리점이라는 의미는 아닙니다.', watchPoints: ['판매 채널과 지역 커버리지', '재고·주문 수요의 구분', '응용 지원과 고객 피드백'], equipment: [], materials: [brenntag, imcd, azelis] },
      { id: 'v-use', name: '최종 사용', subtitle: '케어와 산업 현장에서 가치를 낸다', input: '완제품·응용 솔루션·사용 조건', transformation: '소비자나 산업 고객이 세정·습윤·유화 등의 성능을 사용하고 경험·문제를 다음 개발에 반영합니다.', output: '케어 경험·산업 공정 성능·후속 수요', role: '완제품 기업과 산업 솔루션 기업은 전방 수요와 기능 요구의 변화를 보여주는 참고 대상입니다.', watchPoints: ['사용 분야별 수요 변화', '제품 성능과 환경·안전 요구', '신규 응용시장 검증과 채택 비용'], equipment: [], materials: [unilever, loreal, ecolab] },
    ],
  },
};
