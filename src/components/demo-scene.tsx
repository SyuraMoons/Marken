import { t } from "@/lib/i18n";
import { Sprite } from "./sprite";

function Photo({ index = 0, coffee = false }: { index?: number; coffee?: boolean }) {
  return <div className="scene-photo"><Sprite src={coffee ? "/figma/landing-coffee.png" : "/figma/landing-products.png"} i={index} sizes="(min-width: 1024px) 600px, 360px" /></div>;
}

function Lines() {
  return <div className="scene-lines"><i /><i /><i /></div>;
}

function Cursor() {
  return <svg className="scene-cursor" viewBox="0 0 32 40" fill="none"><path d="M4 3v29l8-8 6 12 6-3-6-11h11L4 3Z" fill="currentColor" stroke="white" strokeWidth="2" /></svg>;
}

// Decorative storyboards illustrate the workflow; the caption and controls provide the accessible equivalent.
export function DemoScene({ feature }: { feature: number }) {
  return <div className={`motion-scene scene-${feature}`} aria-hidden="true">
    <div className="scene-orbit" /><div className="scene-spark">✦</div>
    {feature === 1 && <>
      <div className="scene-workspace scene-window">
        <div className="scene-toolbar"><b>marken ✦</b><span>01 / {t("nav.products")}</span></div>
        <div className="scene-library"><div className="scene-slot" /><div className="scene-slot" /><div className="scene-slot" /></div>
        <Lines />
      </div>
      {[0, 1, 2].map((index) => <div key={index} className={`scene-upload scene-upload-${index}`}><Photo index={index} /><span>0{index + 1}</span></div>)}
      <div className="scene-floating-label">＋ {t("nav.products")}</div><Cursor />
    </>}
    {feature === 2 && <>
      <div className="scene-source"><Photo index={1} /><span>{t("compare.before")}</span></div>
      <div className="scene-conduit"><span>✦</span></div>
      {[0, 1, 2].map((index) => <div key={index} className={`scene-post scene-post-${index}`}><Photo index={index} coffee /><span>0{index + 1}</span><Lines /></div>)}
      <div className="scene-floating-label">{t("today.slidesMeta")}</div>
    </>}
    {feature === 3 && <>
      <div className="scene-editor scene-window"><div className="scene-toolbar"><b>{t("landing.f3Caption")}</b><span>✦</span></div>
        <div className="scene-editor-body"><Photo /><div className="scene-writing"><Lines /><div className="scene-selection" /><Lines /><span className="scene-confirm">✓</span></div></div>
      </div>
      <div className="scene-edit-bubble"><span>✦</span><p>{t("demo.3.caption2")}</p></div><Cursor />
    </>}
    {feature === 4 && <>
      <svg className="scene-routes" viewBox="0 0 600 400"><path d="M195 200H280Q310 200 310 150V110H430M310 200V290H430" /></svg>
      <div className="scene-publish-post scene-window"><Photo index={2} /><Lines /><span className="scene-confirm">✓</span></div>
      {(["instagram", "facebook"] as const).map((platform, index) => <div key={platform} className={`scene-destination scene-destination-${index}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- existing exported platform vector */}
        <img src={`/figma/platform-${platform}.svg`} alt="" width={32} height={32} /><span>{t(`share.${platform}`)}</span><i /></div>)}
      <div className="scene-floating-label">{t("demo.3.state2")}</div><Cursor />
    </>}
    {feature === 5 && <>
      <div className="scene-report scene-window"><div className="scene-toolbar"><b>{t("nav.results")}</b><span>✦</span></div>
        <div className="scene-report-cards">{(["f5Reach", "f5Saves", "f5Orders"] as const).map((metric) => <div key={metric}><span>{t(`landing.${metric}`)}</span><b>—</b></div>)}</div>
        <div className="scene-report-grid"><Lines /><Lines /><Lines /></div>
      </div>
      <div className="scene-inspect"><span>↗</span><Lines /></div><div className="scene-scan" />
    </>}
  </div>;
}
