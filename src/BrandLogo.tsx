import officialLogo from './assets/samyang-logo.png';

export default function BrandLogo() {
  return <><span className="brand-logo-plate">
    <img className="official-samyang-logo" src={officialLogo} alt="삼양사 SAMYANG 로고" width={7445} height={2157} />
  </span><small className="brand-workspace-caption">화학2그룹 · MARKET INTELLIGENCE</small></>;
}
