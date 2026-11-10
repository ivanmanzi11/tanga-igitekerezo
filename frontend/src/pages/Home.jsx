import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import Reveal from "../components/Reveal";
import ParticleField from "../components/ParticleField";
import citizenPosting from "../assets/citizen-posting-idea.webp";
import digitalFeedback from "../assets/digital-feedback-phone.webp";
import scanQr from "../assets/scan-qr-code.webp";
import scanQrWoman from "../assets/scan-qr-woman.webp";
import boxBlue from "../assets/suggestion-box-blue.webp";
import boxRlrc from "../assets/suggestion-box-rlrc.webp";
import womanPurple from "../assets/ussd-woman-purple.webp";
import { USSD_CODE } from "./Access";

// General2 GEN_04: why this is better than the paper box, side by side.
const COMPARISON = [
  ["Does anyone read it?", "It sits in a box until someone happens to open it.", "Every submission is logged instantly and routed to the right team."],
  ["Will I hear back?", "Rarely — you never learn what happened.", "You get a tracking code and see every step, and the reply, on your phone."],
  ["Can I stay anonymous?", "Only if you're comfortable dropping paper in public.", "Choose anonymous, confidential or identified — and still get an answer."],
  ["What if I'm not there?", "You must walk to the box, during opening hours.", "Submit from anywhere, any time, in English, Kinyarwanda or French."],
  ["Is it accountable?", "Slips get lost, and nobody can prove they were sent.", "A full history nobody can quietly erase, with reports for leadership."],
];

const BENEFITS = [
  { icon: "🔔", title: "Never lost", body: "Nothing can fall behind a drawer. Every voice is recorded the moment it is sent." },
  { icon: "⚡", title: "Reaches the right people fast", body: "Urgent matters are flagged automatically so the people who must act see them first." },
  { icon: "🔒", title: "Your privacy, your choice", body: "Speak freely without a name, or share it and get personal follow-up." },
  { icon: "📈", title: "Change you can see", body: "Institutions learn what matters most — and you can watch your idea turn into action." },
];

export default function Home() {
  const { t } = useLanguage();
  return (
    <>
      <section className="hero" style={{ position: "relative", overflow: "hidden" }}>
        <ParticleField />
        <div className="container hero-grid" style={{ position: "relative", zIndex: 1 }}>
          <div className="animate-in">
            <h1 className="kinetic-text">
              {t("heroTitle").split(" ").map((word, i) => (
                <span key={i} style={{ animationDelay: `${i * 60}ms` }}>{word}&nbsp;</span>
              ))}
            </h1>
            <p>
              Your voice deserves more than a slot in a wooden box. Tanga Igitekerezo receives, routes and answers every
              suggestion, complaint, word of appreciation or other feedback — anonymously if you choose — and lets you follow it from
              the moment you send it until the answer arrives.
            </p>
            <div className="hero-actions">
              <Link to="/submit" className="btn btn-gold btn-shine">Submit something</Link>
              <Link to="/track" className="btn btn-outline" style={{ borderColor: "var(--gold-soft)", color: "var(--paper)" }}>
                Track a submission
              </Link>
            </div>
          </div>
          <img className="hero-art float-y" src={citizenPosting} alt="A citizen posting an idea into a suggestion box" width="900" height="640" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal as="h2">How a submission moves through the system</Reveal>
          <p className="muted">
            Nothing disappears into a box. Every submission is visible, assigned, and answered —
            and you can watch it happen with your tracking code.
          </p>
          <div className="flow-strip">
            {[
              ["1", "Submit", "Anonymous is the default way to submit. Describe your idea or concern."],
              ["2", "Categorize", "It's sorted as a suggestion, complaint, appreciation, or other."],
              ["3", "Review", "A responsible officer reads it and confirms what it's about."],
              ["4", "Assign", "It's routed to the department best placed to act on it."],
              ["5", "Respond", "The department replies, in writing, on the record."],
              ["6", "Track & close", "You follow progress with your code until it's resolved."],
            ].map(([n, title, body], i) => (
              <Reveal as="div" className="flow-step hover-lift" key={n} delay={i * 70}>
                <div className="flow-step-index">{n}</div>
                <h4>{title}</h4>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container two-col media-row">
          <Reveal from="left">
            <h2>From the wooden box to the palm of your hand</h2>
            <p>
              The traditional Agasanduku k'ibitekerezo gave people a place to speak up — but no way to know whether anyone
              listened. Tanga Igitekerezo keeps everything people value about it and fixes what let them down.
            </p>
            <p>Scan a code, type a few lines, and your idea is on its way — with proof that it was received.</p>
            <Link to="/submit" className="btn btn-primary">Share your idea now</Link>
          </Reveal>
          <Reveal from="right" delay={120}>
            <img className="media-art float-y-slow" src={scanQr} alt="A person scanning a QR code with a phone" loading="lazy" width="900" height="842" />
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container ussd-teaser">
          <Reveal from="left">
            <img className="float-y" src={womanPurple} alt="A woman pointing at a phone showing the code to dial" loading="lazy" />
          </Reveal>
          <Reveal from="right" delay={120}>
            <span className="eyebrow eyebrow-gold">No smartphone? No problem</span>
            <h2>Just dial <span className="code-pill">{USSD_CODE}</span></h2>
            <p>
              Any phone can be heard. Dial the code, follow the menu in order, and your suggestion or complaint is on its
              way — no internet, no app. Got a smartphone? Scanning the QR code is even quicker.
            </p>
            <div className="hero-actions">
              <Link to="/access" className="btn btn-primary">See all the ways to reach us</Link>
              <Link to="/access#qr" className="btn btn-outline">Get the QR code</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <Reveal as="h2" style={{ textAlign: "center" }}>Why it beats the traditional suggestion box</Reveal>
          <p className="muted" style={{ textAlign: "center", margin: "0 auto 28px" }}>
            Same spirit. Far better results.
          </p>
          <Reveal className="compare-wrap">
            <table className="compare-table">
              <thead>
                <tr><th></th><th>Paper suggestion box</th><th>Tanga Igitekerezo</th></tr>
              </thead>
              <tbody>
                {COMPARISON.map(([q, box, us]) => (
                  <tr key={q}>
                    <th scope="row">{q}</th>
                    <td>✗ {box}</td>
                    <td>✓ {us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <Reveal as="h2" style={{ textAlign: "center" }}>What you gain</Reveal>
          <div className="stat-grid" style={{ marginTop: 24 }}>
            {BENEFITS.map((b, i) => (
              <Reveal className="stat-card hover-lift" key={b.title} delay={i * 80}>
                <div className="benefit-icon">{b.icon}</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{b.title}</div>
                <div className="muted" style={{ fontSize: "0.88rem" }}>{b.body}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col media-row privacy-row">
          <Reveal from="left">
            <img className="media-art float-y" src={digitalFeedback} alt="A happy person reacting to feedback on their phone" loading="lazy" width="794" height="900" />
          </Reveal>
          <Reveal from="right" delay={120}>
            <h2>Privacy stays yours to choose</h2>
            <p>
              A physical suggestion box let you write something without signing your name.
              This one does too — and gives you two more options when you want a reply.
            </p>
            <ul style={{ paddingLeft: "1.2em", color: "var(--ink-soft)" }}>
              <li style={{ marginBottom: 10 }}>
                <strong style={{ color: "var(--ink)" }}>Anonymous</strong> — no name is collected. Follow up with your tracking code only.
              </li>
              <li style={{ marginBottom: 10 }}>
                <strong style={{ color: "var(--ink)" }}>Confidential</strong> — your identity is recorded but restricted to authorized staff only.
              </li>
              <li>
                <strong style={{ color: "var(--ink)" }}>Identified</strong> — a normal submission under your name, saved to your account.
              </li>
            </ul>
            <div className="card hover-lift" style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>Example</h3>
              <p className="muted" style={{ fontSize: "0.92rem", marginBottom: 0 }}>
                Ivan submits a suggestion and receives <strong>TGC-2026-10-05-0127</strong>. The system
                records it as Received. An officer reviews it and routes it to the ICT department,
                who mark it Under Review. The officer responds. Ivan checks TGC-2026-10-05-0127 and sees
                Resolved, with the institution's answer.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <Reveal as="h2" style={{ textAlign: "center" }}>Wherever people already are</Reveal>
          <p className="muted" style={{ textAlign: "center", margin: "0 auto 28px" }}>
            Physical boxes at the office, a QR code on the wall, or the website on your phone — all lead to the same place.
          </p>
          <div className="gallery">
            <Reveal className="gallery-item hover-lift" delay={0}>
              <img src={boxRlrc} alt="A suggestion box stand at a public institution" loading="lazy" />
              <span>At the counter</span>
            </Reveal>
            <Reveal className="gallery-item hover-lift" delay={100}>
              <img src={boxBlue} alt="A blue locked suggestion box labelled Tanga Amakuru Kuri Ruswa" loading="lazy" />
              <span>On the wall</span>
            </Reveal>
            <Reveal className="gallery-item hover-lift" delay={200}>
              <img src={scanQrWoman} alt="A woman scanning a QR code on a wall poster" loading="lazy" />
              <span>By QR code</span>
            </Reveal>
          </div>
          <Reveal style={{ textAlign: "center", marginTop: 36 }}>
            <Link to="/submit" className="btn btn-gold btn-shine pulse-soft">Be heard today</Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
