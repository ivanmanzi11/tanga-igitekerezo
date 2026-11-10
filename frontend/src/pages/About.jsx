import { Link } from "react-router-dom";
import Reveal from "../components/Reveal";
import coatOfArms from "../assets/coat-of-arms.webp";
import boxRlrc from "../assets/suggestion-box-rlrc.webp";
import boxBlue from "../assets/suggestion-box-blue.webp";
import citizenPosting from "../assets/citizen-posting-idea.webp";
import digitalFeedback from "../assets/digital-feedback-phone.webp";
import scanQr from "../assets/scan-qr-code.webp";

const VALUES = [
  { icon: "🔒", title: "Privacy", body: "Anonymous, confidential, or identified — the choice is always the submitter's, never assumed for them." },
  { icon: "🔁", title: "Accountability", body: "Every case is tracked from Received to Closed, with a full history nobody can quietly erase." },
  { icon: "🤝", title: "Responsiveness", body: "A suggestion box only works if someone answers back — so every case gets a real response." },
  { icon: "🏛", title: "Institutional trust", body: "Built for real institutions: role-based access, departments, and audit trails, not a form-to-inbox shortcut." },
  { icon: "🌍", title: "Accessibility", body: "Available in English, Kinyarwanda, and French, and usable with or without an account." },
  { icon: "📊", title: "Transparency", body: "Analytics and exportable reports mean progress is visible, not just promised." },
];

const TIMELINE = [
  { year: "Step 1", title: "Submit", body: "A citizen or employee submits a suggestion, complaint, appreciation, or anything else — anonymously if they choose." },
  { year: "Step 2", title: "Categorize", body: "The system files it under a category and, if known, a department." },
  { year: "Step 3", title: "Review", body: "A responsible officer opens the case; it automatically moves to Under Review." },
  { year: "Step 4", title: "Assign", body: "The case is routed to the right department or staff member." },
  { year: "Step 5", title: "Respond", body: "Staff replies on the record — and the submitter can reply back, even anonymously, via their tracking code." },
  { year: "Step 6", title: "Track & close", body: "The submitter follows progress until it's marked Resolved, then automatically Closed three days later." },
];

export default function About() {
  return (
    <div>
      <section className="hero" style={{ padding: "56px 0" }}>
        <div className="container hero-grid">
         <div className="animate-in">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <img src={coatOfArms} alt="" style={{ width: 56, height: 56 }} />
            <h1 style={{ margin: 0 }}>About Tanga Igitekerezo</h1>
          </div>
          <p style={{ maxWidth: "60ch" }}>
            Tanga Igitekerezo — the Digital Agasanduku k'Ibitekerezo — turns the
            traditional paper suggestion box into a complete feedback
            management system: submissions are received, categorized,
            reviewed, assigned, responded to, tracked, and closed, all with a
            full accountability trail.
          </p>
         </div>
         <img className="hero-art float-y" src={citizenPosting} alt="A citizen posting an idea into a suggestion box" width="900" height="640" />
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="card animate-in">
            <h3 style={{ marginTop: 0 }}>Our Mission</h3>
            <p style={{ marginBottom: 0 }}>
              To give every citizen, employee, or visitor a genuine channel to
              be heard — and to give institutions a structured, accountable
              way to receive, act on, and respond to that feedback.
            </p>
          </div>
          <div className="card animate-in delay-1">
            <h3 style={{ marginTop: 0 }}>Our Vision</h3>
            <p style={{ marginBottom: 0 }}>
              An institution where no suggestion, complaint, or idea
              disappears into a box — where every voice is reviewed, routed,
              and answered, and progress is always visible.
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-raised)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="container">
          <h2 style={{ textAlign: "center" }}>What you can submit</h2>
          <p className="muted" style={{ textAlign: "center", margin: "0 auto 32px" }}>Four kinds of feedback, each handled the same accountable way.</p>
          <div className="stat-grid">
            {[
              ["💡", "Suggestion", "A way to make a service or process better."],
              ["⚠️", "Complaint", "A problem that needs to be looked into."],
              ["🙏", "Appreciation", "Recognition for something done well."],
              ["✨", "Others", "Anything else that doesn't fit the categories above."],
            ].map(([icon, title, body]) => (
              <div className="stat-card" key={title}>
                <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container two-col media-row">
          <Reveal from="left">
            <h2>Why we replaced the paper box</h2>
            <p>
              A wooden box can collect ideas, but it cannot answer them. Slips get lost, nobody can prove they were sent,
              and the person who cared enough to write never learns what happened.
            </p>
            <p>
              Tanga Igitekerezo keeps the simplicity — anyone can speak up in a minute — and adds what was missing:
              a tracking code, a named team responsible for every case, an answer on the record, and reports that show
              leadership where to improve.
            </p>
            <Link to="/submit" className="btn btn-primary">Try it yourself</Link>
          </Reveal>
          <Reveal from="right" delay={120}>
            <img className="media-art float-y-slow" src={scanQr} alt="A person scanning a QR code to send feedback" loading="lazy" width="900" height="842" />
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 style={{ textAlign: "center" }}>Our Values</h2>
          <div className="stat-grid" style={{ marginTop: 24 }}>
            {VALUES.map((v) => (
              <div className="stat-card" key={v.title}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{v.icon}</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{v.title}</div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>{v.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <Reveal as="h2" style={{ textAlign: "center" }}>Many doors, one system</Reveal>
          <div className="gallery" style={{ marginTop: 24 }}>
            <Reveal className="gallery-item hover-lift">
              <img src={boxRlrc} alt="A suggestion box stand at a public institution" loading="lazy" />
              <span>Boxes at the counter feed the same system</span>
            </Reveal>
            <Reveal className="gallery-item hover-lift" delay={100}>
              <img src={boxBlue} alt="A blue locked suggestion box" loading="lazy" />
              <span>Wall boxes are logged and answered too</span>
            </Reveal>
            <Reveal className="gallery-item hover-lift" delay={200}>
              <img src={digitalFeedback} alt="A person delighted by a reply on their phone" loading="lazy" />
              <span>And every answer reaches your phone</span>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-raised)", borderTop: "1px solid var(--line)" }}>
        <div className="container">
          <h2 style={{ textAlign: "center" }}>How a case moves through the system</h2>
          <ul className="timeline" style={{ maxWidth: 640, margin: "32px auto 0" }}>
            {TIMELINE.map((t) => (
              <li key={t.title}>
                <span className="role-pill" style={{ marginLeft: 0 }}>{t.year}</span>
                <h4 style={{ margin: "8px 0 4px" }}>{t.title}</h4>
                <p style={{ margin: 0 }}>{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
