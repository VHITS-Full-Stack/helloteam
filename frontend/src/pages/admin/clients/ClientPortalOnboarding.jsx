import { useState, useRef, useEffect } from "react";

const STEPS = [
  { id: "welcome", label: "Welcome", blocking: true },
  { id: "legal", label: "Legal Terms", blocking: true },
  { id: "new-hire", label: "New Hire Guide", blocking: false },
  { id: "best-practices", label: "Best Practices", blocking: false },
  { id: "contract-form", label: "Contract Info", blocking: true },
  { id: "payment", label: "Payment Setup", blocking: true },
  { id: "contract-signing", label: "Contract Signing", blocking: true },
  { id: "offboarding-policy", label: "Access Policy", blocking: true },
];

const EMPLOYEE_NAME = "Sarah Mitchell";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #0a0a0f;
    color: #e8e4dc;
    min-height: 100vh;
  }

  .portal-root {
    min-height: 100vh;
    background: #0a0a0f;
    position: relative;
    overflow: hidden;
  }

  .bg-mesh {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 20% 10%, rgba(180,155,100,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 60% 80% at 80% 90%, rgba(100,120,180,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 40% 40% at 50% 50%, rgba(180,155,100,0.03) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .bg-grain {
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    opacity: 0.5;
  }

  .portal-layout {
    position: relative;
    z-index: 1;
    display: flex;
    min-height: 100vh;
  }

  /* Sidebar */
  .sidebar {
    width: 240px;
    min-height: 100vh;
    border-right: 1px solid rgba(180,155,100,0.12);
    padding: 48px 0 48px 0;
    display: flex;
    flex-direction: column;
    background: rgba(10,10,15,0.6);
    backdrop-filter: blur(20px);
    flex-shrink: 0;
  }

  .sidebar-logo {
    padding: 0 32px 40px 32px;
    border-bottom: 1px solid rgba(180,155,100,0.1);
    margin-bottom: 32px;
  }

  .logo-mark {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 300;
    letter-spacing: 0.15em;
    color: #c9a84c;
    text-transform: uppercase;
  }

  .logo-sub {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: rgba(200,190,170,0.4);
    text-transform: uppercase;
    margin-top: 4px;
  }

  .step-list {
    flex: 1;
    padding: 0 16px;
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 4px;
    cursor: default;
    transition: background 0.2s;
  }

  .step-item.active {
    background: rgba(201,168,76,0.08);
  }

  .step-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid rgba(180,155,100,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 9px;
    color: rgba(200,190,170,0.3);
    transition: all 0.3s;
  }

  .step-dot.done {
    background: #c9a84c;
    border-color: #c9a84c;
    color: #0a0a0f;
    font-size: 11px;
  }

  .step-dot.current {
    border-color: #c9a84c;
    color: #c9a84c;
    box-shadow: 0 0 0 3px rgba(201,168,76,0.15);
  }

  .step-name {
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: rgba(200,190,170,0.4);
    transition: color 0.3s;
  }

  .step-item.active .step-name { color: rgba(200,190,170,0.9); }
  .step-item.done-item .step-name { color: rgba(200,190,170,0.55); }

  .step-badge {
    margin-left: auto;
    font-size: 9px;
    letter-spacing: 0.1em;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    background: rgba(201,168,76,0.12);
    color: rgba(201,168,76,0.6);
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    min-height: 100vh;
  }

  .step-card {
    width: 100%;
    max-width: 680px;
    animation: fadeUp 0.5s ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Step label */
  .step-eyebrow {
    font-size: 10px;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: #c9a84c;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .step-eyebrow::before {
    content: '';
    display: block;
    width: 32px;
    height: 1px;
    background: #c9a84c;
    opacity: 0.6;
  }

  /* Welcome Step */
  .welcome-headline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    font-weight: 300;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(200,190,170,0.5);
    margin-bottom: 12px;
  }

  .welcome-intro {
    font-family: 'Cormorant Garamond', serif;
    font-size: 15px;
    font-weight: 300;
    color: rgba(200,190,170,0.45);
    letter-spacing: 0.1em;
    margin-bottom: 24px;
  }

  .employee-name-block {
    margin: 32px 0 40px;
    padding: 40px 48px;
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 2px;
    background: rgba(201,168,76,0.03);
    text-align: center;
    position: relative;
  }

  .employee-name-block::before, .employee-name-block::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: #c9a84c;
    border-style: solid;
    opacity: 0.5;
  }
  .employee-name-block::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
  .employee-name-block::after { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

  .assigned-label {
    font-size: 11px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.5);
    margin-bottom: 16px;
  }

  .employee-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 52px;
    font-weight: 300;
    letter-spacing: 0.05em;
    color: #e8e4dc;
    line-height: 1;
  }

  .welcome-sub {
    font-size: 14px;
    font-weight: 300;
    color: rgba(200,190,170,0.5);
    line-height: 1.7;
    margin-bottom: 40px;
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 32px;
    background: #c9a84c;
    color: #0a0a0f;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover { background: #d4b660; transform: translateY(-1px); }
  .btn-primary:disabled { background: rgba(201,168,76,0.2); color: rgba(201,168,76,0.4); cursor: not-allowed; transform: none; }

  .btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 32px;
    background: transparent;
    color: rgba(200,190,170,0.7);
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    border: 1px solid rgba(200,190,170,0.15);
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-outline:hover { border-color: rgba(200,190,170,0.35); color: rgba(200,190,170,0.9); }

  /* Content scroll box */
  .scroll-doc {
    height: 320px;
    overflow-y: scroll;
    border: 1px solid rgba(180,155,100,0.15);
    border-radius: 4px;
    padding: 28px 32px;
    background: rgba(255,255,255,0.02);
    margin-bottom: 24px;
    font-size: 13px;
    line-height: 1.85;
    color: rgba(200,190,170,0.65);
    scroll-behavior: smooth;
  }

  .scroll-doc::-webkit-scrollbar { width: 4px; }
  .scroll-doc::-webkit-scrollbar-track { background: transparent; }
  .scroll-doc::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.25); border-radius: 2px; }

  .doc-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 400;
    color: #e8e4dc;
    margin-bottom: 20px;
  }

  .doc-section-title {
    font-size: 11px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #c9a84c;
    margin: 20px 0 8px;
  }

  /* Scroll indicator */
  .scroll-hint {
    font-size: 11px;
    letter-spacing: 0.1em;
    color: rgba(201,168,76,0.5);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.3s;
  }

  /* Checkbox */
  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 20px;
    border: 1px solid rgba(180,155,100,0.15);
    border-radius: 4px;
    margin-bottom: 24px;
    background: rgba(201,168,76,0.03);
    cursor: pointer;
  }

  .checkbox-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    accent-color: #c9a84c;
    cursor: pointer;
  }

  .checkbox-label {
    font-size: 13px;
    color: rgba(200,190,170,0.7);
    line-height: 1.6;
  }

  /* Form */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-field.full { grid-column: 1 / -1; }

  .form-label {
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.6);
  }

  .form-input {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(180,155,100,0.15);
    border-radius: 3px;
    padding: 11px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #e8e4dc;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-input:focus { border-color: rgba(201,168,76,0.4); }
  .form-input::placeholder { color: rgba(200,190,170,0.2); }

  select.form-input option { background: #1a1a22; }

  /* Section heading */
  .section-heading {
    font-family: 'Cormorant Garamond', serif;
    font-size: 38px;
    font-weight: 300;
    line-height: 1.15;
    color: #e8e4dc;
    margin-bottom: 16px;
    letter-spacing: 0.01em;
  }

  .section-desc {
    font-size: 14px;
    font-weight: 300;
    color: rgba(200,190,170,0.5);
    line-height: 1.8;
    margin-bottom: 32px;
  }

  .divider {
    height: 1px;
    background: rgba(180,155,100,0.1);
    margin: 32px 0;
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  /* Payment */
  .payment-card {
    border: 1px solid rgba(180,155,100,0.15);
    border-radius: 4px;
    padding: 24px 28px;
    background: rgba(201,168,76,0.03);
    margin-bottom: 24px;
  }

  .payment-card-header {
    font-size: 11px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.5);
    margin-bottom: 16px;
  }

  .card-icons {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .card-icon {
    padding: 4px 10px;
    border: 1px solid rgba(180,155,100,0.2);
    border-radius: 3px;
    font-size: 11px;
    color: rgba(200,190,170,0.4);
    letter-spacing: 0.05em;
  }

  /* Progress bar */
  .progress-bar-wrap {
    height: 2px;
    background: rgba(180,155,100,0.1);
    border-radius: 1px;
    margin-bottom: 48px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #c9a84c, #d4b660);
    border-radius: 1px;
    transition: width 0.5s ease;
  }

  /* Success */
  .success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid #c9a84c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    color: #c9a84c;
    margin-bottom: 32px;
    animation: popIn 0.4s ease both;
  }

  @keyframes popIn {
    from { transform: scale(0.6); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .important-notice {
    background: rgba(201,168,76,0.05);
    border-left: 3px solid #c9a84c;
    padding: 16px 20px;
    border-radius: 0 4px 4px 0;
    margin-bottom: 24px;
    font-size: 13px;
    line-height: 1.7;
    color: rgba(200,190,170,0.7);
  }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .main-content { padding: 40px 24px; }
    .form-grid { grid-template-columns: 1fr; }
    .employee-name { font-size: 36px; }
    .section-heading { font-size: 28px; }
  }
`;

// --- Step Components ---

function WelcomeStep({ onNext }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 1 of 8 — Welcome</div>
      <div className="welcome-headline">Welcome to The Hello Team</div>
      <div className="welcome-intro">You are now getting started with:</div>
      <div className="employee-name-block">
        <div className="assigned-label">Your Assigned Employee</div>
        <div className="employee-name">{EMPLOYEE_NAME}</div>
      </div>
      <div className="welcome-sub">
        We're excited to get you onboarded and ready to go. This quick setup will walk you through everything you need to begin working together — it takes just a few minutes.
      </div>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext}>
          Begin Onboarding →
        </button>
      </div>
    </div>
  );
}

function LegalStep({ onNext }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 2 of 8 — Legal Terms</div>
      <div className="section-heading">Terms &amp; Conditions</div>
      <div className="section-desc">Before getting started, please review and accept The Hello Team's legal terms and conditions.</div>
      <div className="scroll-doc">
        <div className="doc-title">Hello Team Legal Terms and Conditions</div>
        <div className="doc-section-title">1. Agreement Overview</div>
        <p>By accessing or using The Hello Team client portal and services, you agree to be bound by these Terms and Conditions. These terms govern the relationship between Hello Team Inc. ("Hello Team") and you, the client ("Client").</p>
        <div className="doc-section-title">2. Services Provided</div>
        <p>Hello Team provides staffing and employee placement services. Hello Team facilitates the connection between clients and qualified personnel, manages onboarding logistics, and provides ongoing support throughout the engagement.</p>
        <div className="doc-section-title">3. Client Responsibilities</div>
        <p>The Client agrees to provide a safe, respectful, and legally compliant work environment. The Client is responsible for integrating assigned personnel into their workflows and providing necessary tools, training, and access to complete assigned tasks.</p>
        <div className="doc-section-title">4. Confidentiality</div>
        <p>Both parties agree to maintain confidentiality of proprietary information, trade secrets, and any sensitive data shared during the engagement. This obligation survives the termination of services.</p>
        <div className="doc-section-title">5. Payment Terms</div>
        <p>Clients agree to pay all fees according to the agreed payment schedule. Late payments may result in service suspension. All fees are non-refundable unless otherwise specified in writing by Hello Team.</p>
        <div className="doc-section-title">6. Termination</div>
        <p>Either party may terminate the engagement with written notice as specified in the individual contract. Upon termination, the Client is obligated to follow the Hello Team Employee Access and Offboarding Policy in full.</p>
        <div className="doc-section-title">7. Limitation of Liability</div>
        <p>Hello Team's liability is limited to the total fees paid in the preceding 30 days. Hello Team is not liable for indirect, incidental, or consequential damages arising from the use of services.</p>
        <div className="doc-section-title">8. Governing Law</div>
        <p>These terms are governed by applicable law. Any disputes shall be resolved through binding arbitration.</p>
        <div className="doc-section-title">9. Modifications</div>
        <p>Hello Team reserves the right to update these terms. Continued use of the portal constitutes acceptance of updated terms. Clients will be notified of material changes.</p>
        <div className="doc-section-title">10. Contact</div>
        <p>For questions regarding these terms, contact Hello Team support through the portal or at legal@helloteam.com.</p>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
        <span className="checkbox-label">I have read and agree to The Hello Team's Terms and Conditions.</span>
      </label>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext} disabled={!agreed}>
          Agree and Continue →
        </button>
      </div>
    </div>
  );
}

function NewHireStep({ onNext }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 3 of 8 — New Hire Guide</div>
      <div className="section-heading">Getting Started</div>
      <div className="section-desc">Here's everything you need to know about working with your new Hello Team employee from day one.</div>
      <div className="scroll-doc">
        <div className="doc-title">New Hire Orientation Guide</div>
        <div className="doc-section-title">First Week Expectations</div>
        <p>The first week is a ramp-up period. Your employee will be learning your systems, communication style, and priorities. Dedicate time for a kickoff call and a brief daily check-in during this phase.</p>
        <div className="doc-section-title">Communication</div>
        <p>Establish a clear primary communication channel from day one — whether that's Slack, email, or a project management tool. Consistent communication prevents misalignment and helps your employee deliver faster results.</p>
        <div className="doc-section-title">Access and Tools</div>
        <p>Grant only the access needed for current tasks. Use role-based permissions where possible. Document what tools and systems your employee has been given access to — this will matter during offboarding.</p>
        <div className="doc-section-title">Feedback</div>
        <p>Regular feedback is one of the highest-leverage things you can provide. Even brief weekly feedback helps your employee calibrate and improve. Use Hello Team's portal to log notes and track performance over time.</p>
        <div className="doc-section-title">Escalations</div>
        <p>If you have any performance concerns, contact your Hello Team account manager promptly. Early escalation leads to better outcomes for everyone involved.</p>
        <div className="doc-section-title">Hello Team Support</div>
        <p>Your Hello Team contact is always available to help mediate, clarify expectations, or address any questions about your engagement. You are never navigating this alone.</p>
      </div>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

function BestPracticesStep({ onNext }) {
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 4 of 8 — Best Practices</div>
      <div className="section-heading">Tips for Success</div>
      <div className="section-desc">Recommendations to help you get the most out of your Hello Team engagement.</div>
      <div className="scroll-doc">
        <div className="doc-title">Practical Tips & Best Practices</div>
        <div className="doc-section-title">Set Clear Priorities</div>
        <p>Start each week with a shared priority list. Clarity on what matters most eliminates guesswork and allows your employee to work autonomously and efficiently.</p>
        <div className="doc-section-title">Document Everything</div>
        <p>Create written SOPs for recurring tasks. Well-documented processes reduce errors, onboarding time, and dependency on any single person.</p>
        <div className="doc-section-title">Give Context, Not Just Tasks</div>
        <p>When assigning work, share the "why" behind it. Employees who understand the broader goal make better independent decisions and produce higher quality output.</p>
        <div className="doc-section-title">Use the Portal</div>
        <p>The Hello Team portal is your central hub. Log progress notes, share files, and track milestones here to keep everything organized and accessible.</p>
        <div className="doc-section-title">Plan for Offboarding from Day One</div>
        <p>It sounds counterintuitive, but the best-run engagements plan for an eventual clean exit. Keep access lists up to date and document what your employee has access to from the start.</p>
        <div className="doc-section-title">Celebrate Small Wins</div>
        <p>Acknowledging good work — even briefly — keeps engagement and motivation high. Small gestures of recognition create strong working relationships over time.</p>
      </div>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

function ContractFormStep({ onNext }) {
  const [form, setForm] = useState({ company: '', contact: '', email: '', phone: '', address: '', city: '', country: '', industry: '', size: '', billing: '' });
  const allFilled = Object.values(form).every(v => v.trim() !== '');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 5 of 8 — Contract Information</div>
      <div className="section-heading">Contract Details</div>
      <div className="section-desc">Please provide the information we need to prepare your contract.</div>
      <div className="form-grid">
        <div className="form-field full">
          <label className="form-label">Legal Company Name</label>
          <input className="form-input" placeholder="Acme Corp Ltd." value={form.company} onChange={set('company')} />
        </div>
        <div className="form-field">
          <label className="form-label">Primary Contact Name</label>
          <input className="form-input" placeholder="Jane Smith" value={form.contact} onChange={set('contact')} />
        </div>
        <div className="form-field">
          <label className="form-label">Contact Email</label>
          <input className="form-input" placeholder="jane@company.com" value={form.email} onChange={set('email')} />
        </div>
        <div className="form-field">
          <label className="form-label">Phone Number</label>
          <input className="form-input" placeholder="+1 (555) 000-0000" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="form-field">
          <label className="form-label">Billing Address</label>
          <input className="form-input" placeholder="123 Main St" value={form.address} onChange={set('address')} />
        </div>
        <div className="form-field">
          <label className="form-label">City</label>
          <input className="form-input" placeholder="New York" value={form.city} onChange={set('city')} />
        </div>
        <div className="form-field">
          <label className="form-label">Country</label>
          <input className="form-input" placeholder="United States" value={form.country} onChange={set('country')} />
        </div>
        <div className="form-field">
          <label className="form-label">Industry</label>
          <select className="form-input" value={form.industry} onChange={set('industry')}>
            <option value="">Select industry</option>
            <option>Technology</option><option>Healthcare</option><option>Finance</option>
            <option>Retail</option><option>Marketing</option><option>Legal</option><option>Other</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Company Size</label>
          <select className="form-input" value={form.size} onChange={set('size')}>
            <option value="">Select size</option>
            <option>1–10</option><option>11–50</option><option>51–200</option><option>201–500</option><option>500+</option>
          </select>
        </div>
        <div className="form-field full">
          <label className="form-label">Preferred Billing Cycle</label>
          <select className="form-input" value={form.billing} onChange={set('billing')}>
            <option value="">Select billing cycle</option>
            <option>Weekly</option><option>Bi-weekly</option><option>Monthly</option>
          </select>
        </div>
      </div>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext} disabled={!allFilled}>
          Continue to Payment →
        </button>
      </div>
    </div>
  );
}

function PaymentStep({ onNext }) {
  const [form, setForm] = useState({ cardName: '', cardNum: '', expiry: '', cvv: '' });
  const allFilled = Object.values(form).every(v => v.trim() !== '');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 6 of 8 — Payment Setup</div>
      <div className="section-heading">Payment Setup</div>
      <div className="section-desc">Set up your payment method before contract signing. Your card will not be charged until your contract is active.</div>
      <div className="payment-card">
        <div className="payment-card-header">Payment Method</div>
        <div className="card-icons">
          <span className="card-icon">VISA</span>
          <span className="card-icon">MC</span>
          <span className="card-icon">AMEX</span>
        </div>
        <div className="form-grid">
          <div className="form-field full">
            <label className="form-label">Name on Card</label>
            <input className="form-input" placeholder="Jane Smith" value={form.cardName} onChange={set('cardName')} />
          </div>
          <div className="form-field full">
            <label className="form-label">Card Number</label>
            <input className="form-input" placeholder="•••• •••• •••• ••••" maxLength={19} value={form.cardNum} onChange={set('cardNum')} />
          </div>
          <div className="form-field">
            <label className="form-label">Expiry Date</label>
            <input className="form-input" placeholder="MM / YY" maxLength={7} value={form.expiry} onChange={set('expiry')} />
          </div>
          <div className="form-field">
            <label className="form-label">CVV</label>
            <input className="form-input" placeholder="•••" maxLength={4} value={form.cvv} onChange={set('cvv')} />
          </div>
        </div>
      </div>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext} disabled={!allFilled}>
          Save and Continue →
        </button>
      </div>
    </div>
  );
}

function ContractSigningStep({ onNext }) {
  const [signed, setSigned] = useState(false);
  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 7 of 8 — Contract Signing</div>
      <div className="section-heading">Sign Your Contract</div>
      <div className="section-desc">Your contract has been prepared based on the information you provided. Please review and sign below.</div>
      <div className="scroll-doc">
        <div className="doc-title">Service Agreement</div>
        <div className="doc-section-title">Parties</div>
        <p>This agreement is entered into between Hello Team Inc. ("Hello Team") and the Client as identified during onboarding.</p>
        <div className="doc-section-title">Scope of Services</div>
        <p>Hello Team agrees to provide staffing services including placement of qualified personnel as described in the onboarding documentation. The assigned employee is <strong style={{color:'#c9a84c'}}>{EMPLOYEE_NAME}</strong>.</p>
        <div className="doc-section-title">Term</div>
        <p>This agreement commences upon signing and continues until terminated by either party in accordance with the termination provisions herein.</p>
        <div className="doc-section-title">Fees and Payment</div>
        <p>Client agrees to pay all fees as set out in the agreed billing schedule. Fees are due upon invoice. Late payments incur a 2% monthly fee.</p>
        <div className="doc-section-title">Compliance</div>
        <p>Client agrees to comply with all Hello Team policies, including the Employee Access and Offboarding Policy, as a condition of this agreement.</p>
        <div className="doc-section-title">Entire Agreement</div>
        <p>This contract, together with the Terms and Conditions accepted during onboarding, constitutes the entire agreement between the parties.</p>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />
        <span className="checkbox-label">I have read, understood, and agree to sign this contract on behalf of my organisation.</span>
      </label>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext} disabled={!signed}>
          Sign Contract →
        </button>
      </div>
    </div>
  );
}

function OffboardingPolicyStep({ onNext }) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    if (atBottom) setScrolled(true);
  };

  return (
    <div className="step-card">
      <div className="step-eyebrow">Step 8 of 8 — Access &amp; Offboarding Policy</div>
      <div className="section-heading">Important Policy</div>
      <div className="important-notice">
        While The Hello Team is not responsible for your internal cybersecurity environment, all clients are required to follow a small number of basic access and offboarding protocols as a condition of using our services.<br /><br />
        These protocols exist for one reason: to ensure that if you ever need to terminate assigned personnel, you can do so quickly, cleanly, and with full confidence that all access has been removed.
      </div>
      <div
        className={`scroll-hint`}
        style={{ opacity: scrolled ? 0 : 1 }}
      >
        ↓ Scroll to the end to enable confirmation
      </div>
      <div className="scroll-doc" ref={scrollRef} onScroll={handleScroll}>
        <div className="doc-title">Employee Access and Offboarding Policy</div>
        <div className="doc-section-title">1. Access Provisioning</div>
        <p>Clients must document all systems and tools access granted to Hello Team employees. A written or digital access log must be maintained throughout the engagement and made available to Hello Team upon request.</p>
        <div className="doc-section-title">2. Principle of Least Privilege</div>
        <p>Grant Hello Team employees only the access necessary to perform their assigned tasks. Do not grant administrative or root-level access unless operationally required and approved in writing by Hello Team.</p>
        <div className="doc-section-title">3. Credentials and Authentication</div>
        <p>Do not share personal or executive credentials with Hello Team employees. Create dedicated accounts with role-appropriate permissions. Use multi-factor authentication on all accounts assigned to Hello Team personnel.</p>
        <div className="doc-section-title">4. Pre-Termination Checklist</div>
        <p>Before initiating termination of any Hello Team employee, clients must prepare a complete access revocation checklist. This should include all software subscriptions, email accounts, communication tools, cloud services, and physical access credentials.</p>
        <div className="doc-section-title">5. Day-of-Termination Protocol</div>
        <p>On the day of termination, all system access must be revoked within four hours of the termination notice. Hello Team must be notified in writing at the time of termination initiation. The client is solely responsible for the timely completion of access removal.</p>
        <div className="doc-section-title">6. Post-Termination Confirmation</div>
        <p>Within 48 hours of termination, clients must confirm in writing to Hello Team that all access has been revoked. This confirmation should include a summary of systems accessed and the date and time access was removed.</p>
        <div className="doc-section-title">7. Data and Intellectual Property</div>
        <p>Clients are responsible for ensuring all company data and intellectual property is secured prior to and following termination. Hello Team employees must not retain copies of client data beyond the scope of their assigned work.</p>
        <div className="doc-section-title">8. Non-Compliance</div>
        <p>Failure to follow this policy may result in suspension of Hello Team services and may expose the client to liability. Hello Team is not responsible for security incidents arising from client non-compliance with this policy.</p>
        <div className="doc-section-title">9. Acknowledgement</div>
        <p>By accepting this policy, the client confirms they have read, understood, and agree to follow all provisions above as a condition of using Hello Team services.</p>
      </div>
      <label className="checkbox-row" style={{ opacity: scrolled ? 1 : 0.4, pointerEvents: scrolled ? 'auto' : 'none' }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={!scrolled} />
        <span className="checkbox-label">I have read and agree to adhere to the Hello Team Employee Access and Offboarding Policy.</span>
      </label>
      <div className="action-row">
        <button className="btn-primary" onClick={onNext} disabled={!scrolled || !agreed}>
          Complete and Agree →
        </button>
      </div>
    </div>
  );
}

function PortalAccessScreen() {
  return (
    <div className="step-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="success-icon">✓</div>
      <div className="step-eyebrow" style={{ justifyContent: 'center' }}>Onboarding Complete</div>
      <div className="section-heading" style={{ textAlign: 'center' }}>Welcome to Your Portal</div>
      <div className="section-desc" style={{ textAlign: 'center', maxWidth: 480 }}>
        You've completed all required onboarding steps. You now have full access to The Hello Team client portal. {EMPLOYEE_NAME} is ready to get started.
      </div>
      <button className="btn-primary" onClick={() => alert('Redirecting to full portal…')}>
        Enter Portal →
      </button>
    </div>
  );
}

// --- Main App ---
export default function ClientPortalOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const completedSteps = currentStep;

  const stepComponents = [
    <WelcomeStep onNext={() => setCurrentStep(1)} />,
    <LegalStep onNext={() => setCurrentStep(2)} />,
    <NewHireStep onNext={() => setCurrentStep(3)} />,
    <BestPracticesStep onNext={() => setCurrentStep(4)} />,
    <ContractFormStep onNext={() => setCurrentStep(5)} />,
    <PaymentStep onNext={() => setCurrentStep(6)} />,
    <ContractSigningStep onNext={() => setCurrentStep(7)} />,
    <OffboardingPolicyStep onNext={() => setCurrentStep(8)} />,
    <PortalAccessScreen />,
  ];

  const progress = Math.round((currentStep / 8) * 100);

  return (
    <>
      <style>{styles}</style>
      <div className="portal-root">
        <div className="bg-mesh" />
        <div className="bg-grain" />
        <div className="portal-layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-logo">
              <div className="logo-mark">Hello Team</div>
              <div className="logo-sub">Client Portal</div>
            </div>
            <div className="step-list">
              {STEPS.map((step, i) => {
                const isDone = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div
                    key={step.id}
                    className={`step-item ${isCurrent ? 'active' : ''} ${isDone ? 'done-item' : ''}`}
                  >
                    <div className={`step-dot ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className="step-name">{step.label}</span>
                    {step.blocking && !isDone && !isCurrent && (
                      <span className="step-badge">req</span>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main */}
          <main className="main-content">
            <div style={{ width: '100%', maxWidth: 680, marginBottom: 0 }}>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div key={currentStep} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              {stepComponents[currentStep]}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}