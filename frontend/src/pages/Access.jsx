import { useRef } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Reveal from "../components/Reveal";
import Tilt from "../components/Tilt";
import Typewriter from "../components/Typewriter";
import ParticleField from "../components/ParticleField";
import ussdDial from "../assets/ussd-dial.webp";
import womanPurple from "../assets/ussd-woman-purple.webp";
import womanYellow from "../assets/ussd-woman-yellow.webp";
import manShirt from "../assets/ussd-man.webp";
import scanQr from "../assets/scan-qr-code.webp";
import scanQrWoman from "../assets/scan-qr-woman.webp";

// General2 GEN_08: how to reach the system. The QR code is the main way in
// (smartphones); USSD is the separate, additional way for phones without a
// smartphone or without internet.
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
const QR_TARGET = `${PUBLIC_URL}/submit`;
export const USSD_CODE = import.meta.env.VITE_USSD_CODE || "*502#";

const QR_STEPS = [
  ["📷", "Open your camera", "Open the camera app on your smartphone."],
  ["🎯", "Point at the QR code", "Hold it steady over the code on a poster, box or this page."],
  ["👆", "Tap the link", "Tap the link that pops up. The submission page opens straight away."],
];

const USSD_STEPS = [
  ["1", "Open the phone app", "Open the Phone (dial pad) on any mobile phone — a smartphone is not needed."],
  ["2", "Dial the code", `Type ${USSD_CODE} and press the green call button.`],
  ["3", "Follow the menu", "A menu appears on the screen. Reply with the number of the option you want, in order, and press send."],
  ["4", "Keep your tracking code", "When you finish you receive a tracking code. Keep it to check progress later."],
];

export default function Access() {
  const qrBox = useRef(null);

  // Download the QR as a PNG so it can be printed on posters and suggestion boxes.
  function downloadQr() {
    const svg = qrBox.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "tanga-igitekerezo-qr.png";
      a.click();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }

  return (
    <>
      <section className="hero access-hero" style={{ position: "relative", overflow: "hidden" }}>
        <ParticleField />
        <div className="container hero-grid" style={{ position: "relative", zIndex: 1 }}>
          <div className="animate-in">
            <h1>Every phone can be heard</h1>
            <p>
              Whether you carry the latest smartphone or a simple phone with buttons, you can send a
              suggestion, a complaint, a word of thanks or anything else — and follow it until it is answered.
            </p>
            <div className="hero-actions">
              <a href="#qr" className="btn btn-gold btn-shine">Scan the QR code</a>
              <a href="#ussd" className="btn btn-outline" style={{ borderColor: "var(--gold-soft)", color: "var(--paper)" }}>
                No smartphone? Dial {USSD_CODE}
              </a>
            </div>
          </div>
          <img className="hero-art float-y" src={womanPurple} alt="A woman pointing at a phone showing the code to dial" width="361" height="900" style={{ maxHeight: 440 }} />
        </div>
      </section>

      {/* ---- MAIN WAY IN: QR code ---- */}
      <section className="section" id="qr">
        <div className="container two-col media-row">
          <Reveal from="left">
            <span className="eyebrow">The quickest way</span>
            <h2>Scan the QR code</h2>
            <p>
              If you have a smartphone, this is the fastest way in. You will find the code on posters, on suggestion
              boxes and right here. No typing, no searching — scan it and start writing.
            </p>
            <ol className="step-list">
              {QR_STEPS.map(([icon, title, body], i) => (
                <Reveal as="li" key={title} delay={i * 110} from="left">
                  <span className="step-icon" aria-hidden="true">{icon}</span>
                  <div>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </Reveal>
              ))}
            </ol>
            <div className="hero-actions" style={{ marginTop: 20 }}>
              <Link to="/submit" className="btn btn-primary">Or open the submission page</Link>
              <button type="button" className="btn btn-info" onClick={downloadQr}>Download the QR code</button>
            </div>
          </Reveal>
          <Reveal from="right" delay={120}>
            <Tilt>
              <div className="qr-card" ref={qrBox}>
                <div className="qr-frame">
                  <span className="qr-corner tl" /><span className="qr-corner tr" />
                  <span className="qr-corner bl" /><span className="qr-corner br" />
                  <QRCodeSVG value={QR_TARGET} size={240} level="M" marginSize={2} bgColor="#ffffff" fgColor="#16241f" title="QR code to open the Tanga Igitekerezo submission page" />
                  <span className="qr-scanline" aria-hidden="true" />
                </div>
                <div className="qr-caption">Scan to submit</div>
                <div className="qr-url">{QR_TARGET.replace(/^https?:\/\//, "")}</div>
              </div>
            </Tilt>
            <img className="media-art float-y-slow" src={scanQrWoman} alt="A woman scanning a QR code with her phone" loading="lazy" style={{ maxWidth: 260, marginTop: 22 }} />
          </Reveal>
        </div>
      </section>

      {/* ---- ADDITIONAL WAY IN: USSD ---- */}
      <section className="section band" id="ussd">
        <div className="container">
          <Reveal className="ussd-heading">
            <span className="eyebrow eyebrow-gold">Also available</span>
            <h2>No smartphone? Just dial {USSD_CODE}</h2>
            <p className="muted">
              Not everyone has a smartphone or mobile data — and that should never stop anyone from being heard.
              Any phone can use our USSD service: it works like making a call, with no internet and no app.
            </p>
          </Reveal>

          <div className="ussd-grid">
            <Reveal from="left" className="ussd-phone-col">
              <div className="ussd-phone" aria-hidden="true">
                <div className="ussd-phone-notch" />
                <div className="ussd-phone-screen">
                  <div className="ussd-phone-label">Dial</div>
                  <div className="ussd-phone-code"><Typewriter text={USSD_CODE} /></div>
                  <div className="ussd-phone-call">📞</div>
                </div>
              </div>
              <img className="media-art float-y" src={ussdDial} alt="Hands dialing the USSD code on a phone" loading="lazy" style={{ maxWidth: 300 }} />
            </Reveal>

            <div>
              <ol className="ussd-steps">
                {USSD_STEPS.map(([n, title, body], i) => (
                  <Reveal as="li" key={n} delay={i * 120} from="right" className="ussd-step hover-lift">
                    <span className="ussd-step-n">{n}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
              <Reveal className="ussd-note">
                <strong>Good to know:</strong> USSD works on every network and on basic phones. Normal session charges
                from your mobile operator may apply. Your tracking code works on the website too — enter it on the Track page.
              </Reveal>
            </div>
          </div>

          <div className="ussd-people">
            <Reveal className="ussd-person hover-lift" delay={0}>
              <img src={womanYellow} alt="A young woman using her phone" loading="lazy" />
              <p><strong>“I don't need internet.”</strong> Dial, choose, send — it is as easy as a phone call.</p>
            </Reveal>
            <Reveal className="ussd-person hover-lift" delay={120}>
              <img src={manShirt} alt="A man using his phone" loading="lazy" />
              <p><strong>“Same answer, same tracking.”</strong> A case sent by USSD is handled exactly like one sent on the website.</p>
            </Reveal>
            <Reveal className="ussd-person hover-lift" delay={240}>
              <img src={scanQr} alt="A person scanning a QR code" loading="lazy" />
              <p><strong>“Got a smartphone?”</strong> The QR code above is even faster — choose whichever suits you.</p>
            </Reveal>
          </div>

          <Reveal style={{ textAlign: "center", marginTop: 36 }}>
            <Link to="/track" className="btn btn-primary">Already have a code? Track it</Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
