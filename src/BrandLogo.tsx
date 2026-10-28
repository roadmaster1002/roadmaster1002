// Only an original, verified company asset belongs in this slot. A plain text
// label is used while the original file is unavailable; it is not a drawn logo.
const files = import.meta.glob<string>('./assets/samyang-logo.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const officialLogo = Object.values(files)[0];

export default function BrandLogo() {
  return <><span className="brand-logo-plate">{officialLogo
    ? <img className="official-samyang-logo" src={officialLogo} alt="삼양사 Samyang 공식 로고" />
    : <span className="brand-text-fallback">삼양사</span>}
  </span><small className="brand-workspace-caption">화학2그룹 · MARKET INTELLIGENCE</small></>;
}
