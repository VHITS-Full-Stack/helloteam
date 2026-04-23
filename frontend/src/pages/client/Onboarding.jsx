import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import {
  Loader2,
  Check,
  AlertCircle,
  FileText,
  Pen,
  Upload,
  X,
  RotateCcw,
  ChevronRight,
  Building,
  CreditCard,
  Shield,
  Star,
  Play,
  Info,
  LayoutDashboard,
  Users,
  Clock,
  Timer,
  Gift,
  CheckSquare,
  TrendingUp,
  MessageCircle,
  ClipboardList,
  User,
  Settings,
  Heart,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import onboardingService from "../../services/onboarding.service";
import settingsService from "../../services/settings.service";
import ImpersonationBanner from "../../components/layout/ImpersonationBanner";
import { Button, Card, Badge, Input, Avatar } from "../../components/common";

const STEPS = [
  { id: "welcome", label: "Welcome", icon: Star, blocking: true },
  {
    id: "legal",
    label: "Legal Terms and Conditions",
    icon: Shield,
    blocking: true,
  },
  { id: "new-hire", label: "New Hire Guide", icon: Info, blocking: false },
  {
    id: "contract-form",
    label: "Contract Onboarding Information Form",
    icon: Building,
    blocking: true,
  },

  { id: "payment", label: "Payment Setup", icon: CreditCard, blocking: true },
  {
    id: "contract-signing",
    label: "Contract Signing",
    icon: Pen,
    blocking: true,
  },

  {
    id: "offboarding-policy",
    label: "Employee Access and Offboarding Policy",
    icon: Shield,
    blocking: true,
  },
  {
    id: "best-practices",
    label: "Practical Tips / Best Practices",
    icon: Zap,
    blocking: false,
  },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

  .onboarding-root {
    min-height: 100vh;
    background: #f0f4f8;
    position: relative;
    overflow-x: hidden;
    color: #102a43;
    font-family: 'Poppins', sans-serif;
  }

  .onboarding-bg-mesh {
    position: fixed;
    inset: 0;
    background: 
      radial-gradient(circle at 0% 0%, rgba(51, 78, 104, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 100% 100%, rgba(247, 168, 22, 0.03) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  .onboarding-layout {
    position: relative;
    z-index: 1;
    display: flex;
    min-height: 100vh;
  }

  /* Sidebar - Matches Main Portal Sidebar */
  .onboarding-sidebar {
    width: 256px;
    min-height: 100vh;
    background: linear-gradient(180deg, #102a43 0%, #243b53 100%);
    padding: 0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.2);
    color: white;
  }

  .onboarding-sidebar-logo {
    height: 100px;
    display: flex;
    align-items: center;
    padding: 0 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .onboarding-logo-box {
    background: white;
    padding: 10px;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    margin-right: 14px;
  }

  .onboarding-logo-img {
    height: 36px;
    width: auto;
  }

  .onboarding-logo-text h1 {
    font-weight: 700;
    font-size: 20px;
    line-height: 1;
    color: white;
    letter-spacing: -0.01em;
  }

  .onboarding-logo-text p {
    font-size: 10px;
    color: #9fb3c8;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-top: 4px;
    font-weight: 600;
  }

  .onboarding-step-list {
    flex: 1;
    padding: 32px 16px;
  }

  .onboarding-step-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border-radius: 14px;
    margin-bottom: 10px;
    cursor: default;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    color: #bcccdc;
    border: 1px solid transparent;
  }

  .onboarding-step-item.active {
    background: #f7a816;
    color: #102a43;
    font-weight: 700;
    box-shadow: 0 8px 16px rgba(247, 168, 22, 0.25);
    transform: translateX(4px);
  }

  .onboarding-step-item.done-item {
    color: #627d98;
  }

  .onboarding-step-dot {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 11px;
    transition: all 0.3s;
  }

  .onboarding-step-item.active .onboarding-step-dot {
    border-color: #102a43;
    background: rgba(16, 42, 67, 0.1);
  }

  .onboarding-step-dot.done {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }

  .onboarding-step-name {
    font-size: 13px;
  }

  /* Main Content Area */
  .onboarding-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 40px;
    overflow-y: auto;
  }

  .onboarding-container {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    animation: onboardingSlideIn 0.5s ease-out;
  }

  @keyframes onboardingSlideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* Progress Bar */
  .onboarding-progress-wrap {
    background: #f7a8161a;
    border-radius: 10px;
    height: 8px;
    margin-bottom: 40px;
    border: 1px solid #f7a81626;
    overflow: hidden;
  }

  .onboarding-progress-fill {
    height: 100%;
    background: #f7a816;
    box-shadow: 0 0 10px rgba(247, 168, 22, 0.3);
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Cards and Content */
  .onboarding-header {
    margin-bottom: 32px;
  }

  .onboarding-eyebrow {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #f7a816;
    margin-bottom: 12px;
  }

  .onboarding-headline {
    font-size: 38px;
    font-weight: 800;
    color: #102a43;
    letter-spacing: -0.03em;
    line-height: 1.1;
    background: linear-gradient(135deg, #102a43 0%, #334e68 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .onboarding-welcome-card {
    background: white;
    border-radius: 28px;
    padding: 48px;
    box-shadow: 0 20px 40px rgba(51, 78, 104, 0.08);
    border: 1px solid rgba(226, 232, 240, 0.8);
  }

  .onboarding-employee-hero {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 32px;
    background: #f8fafc;
    border-radius: 20px;
    margin-bottom: 32px;
    border: 1px solid #f1f5f9;
  }

  .onboarding-employee-hero .avatar-ring {
    padding: 4px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 8px 16px rgba(0,0,0,0.06);
  }

  .onboarding-scroll-view {
    height: 400px;
    overflow-y: auto;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 24px;
    font-size: 14px;
    line-height: 1.8;
    color: #334e68;
  }

  .onboarding-doc-h {
    font-weight: 700;
    color: #102a43;
    margin-top: 24px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ck-content h1, .ck-content h2, .ck-content h3, .ck-content h4 {
    color: #102a43;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: bold;
  }
  
  .ck-content p {
    margin-bottom: 1em;
  }

  .ck-content ul {
    list-style-type: disc;
    margin-left: 1.5em;
    margin-bottom: 1em;
  }
  
  .ck-content ol {
    list-style-type: decimal;
    margin-left: 1.5em;
    margin-bottom: 1em;
  }

  .ck-content blockquote {
    border-left: 4px solid #f7a816;
    padding-left: 1em;
    color: #627d98;
    font-style: italic;
    margin-bottom: 1em;
  }
  .onboarding-doc-h::before {
    content: '';
    width: 4px;
    height: 16px;
    background: #f7a816;
    border-radius: 2px;
  }

  /* Signature */
  .onboarding-sig-pad {
    background: white;
    border: 2px dashed #d9e2ec;
    border-radius: 16px;
    height: 180px;
    position: relative;
    cursor: crosshair;
    transition: border-color 0.2s;
  }

  .onboarding-sig-pad:hover { border-color: #f7a816; }

  /* Success State */
  .onboarding-success-pulse {
    width: 100px;
    height: 100px;
    background: #10b9811a;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 32px;
    position: relative;
  }

  .onboarding-success-pulse::after {
    content: '';
    position: absolute;
    inset: -10px;
    border: 2px solid #10b98133;
    border-radius: 50%;
    animation: pulseOnboarding 2s infinite;
  }

  @keyframes pulseOnboarding {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.3); opacity: 0; }
  }

  @media (max-width: 1024px) {
    .onboarding-sidebar { display: none; }
    .onboarding-main { padding: 24px; }
  }
`;

// --- Components ---

function WelcomeStep({ onNext, employees }) {
  const employeeList =
    employees?.length > 0
      ? employees
      : [{ name: "Specialist", profilePhoto: null }];
  const isMultiple = employeeList.length > 1;

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 1 OF 8 — WELCOME
        </div>
        <h1 className="onboarding-headline">Welcome to Hello Team</h1>
      </div>

      <div className="onboarding-welcome-card">
        <p className="text-slate-600 mb-8 text-lg leading-relaxed">
          We're thrilled to have you here! The Hello Team portal is your central
          hub for managing your {isMultiple ? "new employees" : "new employee"},
          reviewing timesheets, and approving payments.
          <br />
          <br />
          Before{" "}
          {isMultiple
            ? "your team"
            : employeeList[0].name || "your specialist"}{" "}
          begins their first shift, we just need to finalize a few important
          details. This setup process takes less than 5 minutes and ensures
          everything runs smoothly from day one. Let's get started and set your
          team up for success!
        </p>

        <div className="mb-8 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
          <span className="text-[12px] font-bold uppercase tracking-widest block mb-4">
            {isMultiple ? "Your Assigned Employees" : "Your Assigned Employee"}
          </span>
          <div className="flex flex-col gap-3">
            {employeeList.map((emp, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-slate-100"
              >
                <Avatar
                  name={emp.name || "Specialist"}
                  src={emp.profilePhoto}
                  size="md"
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {emp.name || "Specialist"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ready to start supporting your operations.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="secondary"
          size="xl"
          rounded="pill"
          className="h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
          onClick={onNext}
          icon={ChevronRight}
          iconPosition="right"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function LegalStep({ onNext, onBack, content }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 2 OF 8 — LEGAL TERMS & Condition
        </div>

        <h4>
          Please review before getting started, need to review and accept Hello
          Team’s legal terms and conditions..
        </h4>
      </div>

      <div className="onboarding-welcome-card" style={{ padding: "60px" }}>
        <div className="onboarding-scroll-view mb-8 ck-content">
          <h4 className="text-lg font-bold mb-4">
            Hello Team Master Services Agreement
          </h4>
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <>
              <div className="onboarding-doc-h">Scope of Services</div>
              <p>
                This agreement outlines the professional staffing services
                provided by Hello Team. We provide qualified personnel to
                integrate into your business operations while managing all
                backend HR and payroll requirements.
              </p>
              <div className="onboarding-doc-h">Intellectual Property</div>
              <p>
                All work product, code, documents, and data generated by our
                personnel for your company belong exclusively to you. We
                maintain zero-retention policies for client data.
              </p>
              <div className="onboarding-doc-h">Engagement Standards</div>
              <p>
                Both parties agree to maintain a professional, respectful, and
                productive working environment. Hello Team handles all
                performance reviews and HR mediation.
              </p>
              <div className="onboarding-doc-h">Billing Cycles</div>
              <p>
                Billing is processed on a bi-weekly basis. Our rates are
                inclusive of all taxes, benefits, and administrative costs.
              </p>
            </>
          )}
        </div>

        <label
          className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all mb-8 ${agreed ? "bg-slate-50 border-primary" : "border-slate-100 hover:border-slate-200"}`}
        >
          <input
            type="checkbox"
            className="w-5 h-5 rounded accent-primary"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-sm font-semibold text-slate-700">
            I have reviewed and accept the Master Services Agreement
          </span>
        </label>
        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            onClick={onBack}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            disabled={!agreed}
            onClick={onNext}
            icon={ChevronRight}
            iconPosition="right"
          >
            AGREE AND CONTINUE
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrivacyPolicyStep({ onNext, onBack, content }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 3 OF 9 — PRIVACY POLICY
        </div>
        <h4>Please review our Privacy Policy before proceeding.</h4>
      </div>

      <div className="onboarding-welcome-card" style={{ padding: "60px" }}>
        <div className="onboarding-scroll-view mb-8 ck-content">
          <h4 className="text-lg font-bold mb-4">Hello Team Privacy Policy</h4>
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <>
              <div className="onboarding-doc-h">Data Collection</div>
              <p>
                We collect information necessary to provide our staffing
                services, including business contact details and payment
                information.
              </p>
              <div className="onboarding-doc-h">Data Use</div>
              <p>
                Your data is used solely to manage your account, process
                payments, and facilitate employee placement. We do not sell your
                data to third parties.
              </p>
              <div className="onboarding-doc-h">Data Security</div>
              <p>
                All data is encrypted in transit and at rest. Access is
                restricted to authorized Hello Team personnel only.
              </p>
            </>
          )}
        </div>

        <label
          className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all mb-8 ${agreed ? "bg-slate-50 border-primary" : "border-slate-100 hover:border-slate-200"}`}
        >
          <input
            type="checkbox"
            className="w-5 h-5 rounded accent-primary"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-sm font-semibold text-slate-700">
            I have read and agree to the Privacy Policy
          </span>
        </label>

        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            onClick={onBack}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            disabled={!agreed}
            onClick={onNext}
            icon={ChevronRight}
            iconPosition="right"
          >
            AGREE AND CONTINUE
          </Button>
        </div>
      </div>
    </div>
  );
}

function PdfViewer({ pdfUrl, title = "New Hire Guide" }) {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e) => {
    const pages = e.currentTarget.querySelectorAll(".react-pdf__Page");
    for (let i = 0; i < pages.length; i++) {
      const rect = pages[i].getBoundingClientRect();
      const containerRect = e.currentTarget.getBoundingClientRect();
      if (rect.top >= containerRect.top - rect.height / 2) {
        setCurrentPage(i + 1);
        break;
      }
    }
  };

  return (
    <div className="mb-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 rounded-t-xl border border-b-0 border-slate-200">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          {title}
        </span>
        {numPages && (
          <span className="text-xs text-slate-500">
            Page {currentPage} of {numPages}
          </span>
        )}
      </div>

      {/* Scrollable pages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="border border-slate-200 rounded-b-xl bg-slate-50"
        style={{ height: "680px", overflowY: "auto" }}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Failed to load PDF.
            </div>
          }
        >
          {Array.from({ length: numPages || 0 }, (_, i) => (
            <div key={i + 1} className="flex justify-center py-3">
              <Page
                pageNumber={i + 1}
                width={containerWidth - 32}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                className="shadow-md rounded-lg overflow-hidden"
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

function GuideStep({
  onNext,
  onBack,
  step,
  content,
  pdfExists,
  welcomeTipsPdfExists,
  loading,
}) {
  const isBestPractices = step === 3;
  const [pdfObjectUrl, setPdfObjectUrl] = useState(null);

  useEffect(() => {
    if (!isBestPractices && pdfExists) {
      settingsService
        .downloadNewHireGuidePdf()
        .then((blob) => setPdfObjectUrl(URL.createObjectURL(blob)))
        .catch(() => setPdfObjectUrl(null));
    } else if (isBestPractices && welcomeTipsPdfExists) {
      settingsService
        .downloadWelcomeTipsPdf()
        .then((blob) => setPdfObjectUrl(URL.createObjectURL(blob)))
        .catch(() => setPdfObjectUrl(null));
    }
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    };
  }, [pdfExists, welcomeTipsPdfExists, isBestPractices]);

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          {isBestPractices
            ? "STEP 8 OF 8 — Practical Tips / Best Practices"
            : "STEP 3 OF 8 — FOUNDATIONS"}
        </div>
        <h2 className="onboarding-headline" style={{ fontSize: "42px" }}>
          {isBestPractices
            ? "Practical Tips / Best Practices"
            : "New Hire Guide"}
        </h2>
      </div>

      <div className="onboarding-welcome-card" style={{ padding: "60px" }}>
        {/* Show text content first (directly without scroll box) */}
        {content ? (
          <div className="mb-8 ck-content">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        ) : (
          /* Fallback default content when no CMS content */
          <div className="mb-8 ck-content">
            {isBestPractices ? (
              <>
                <div className="onboarding-doc-h">Establish Daily Rhythms</div>
                <p>
                  The most successful clients have a quick 10-minute sync at the
                  start of each shift. This eliminates ambiguity and sets the
                  pace for the day.
                </p>
                <div className="onboarding-doc-h">Use the Dashboard</div>
                <p>
                  Track live clock-ins, approvals, and payroll directly through
                  this portal. All team activity is logged in real-time for full
                  transparency.
                </p>
                <div className="onboarding-doc-h">Clear KPIs</div>
                <p>
                  Define 2-3 key metrics for your team member. When they know
                  what "winning" looks like, they deliver higher value
                  consistently.
                </p>
              </>
            ) : (
              <>
                <div className="onboarding-doc-h">Software Access</div>
                <p>
                  Please prepare any required software licenses (Slack, CRM,
                  Project Management) prior to the first shift. We recommend
                  using LastPass for secure credential sharing.
                </p>
                <div className="onboarding-doc-h">The First 48 Hours</div>
                <p>
                  Dedicate time in the first two days for training. Your
                  dedicated expert is already vetted, but they need to learn
                  *your* specific way of doing things.
                </p>
                <div className="onboarding-doc-h">Points of Contact</div>
                <p>
                  Identify who your team member should reach out to for
                  technical blockers versus operational questions.
                </p>
              </>
            )}
          </div>
        )}

        {/* Show PDF viewer when a PDF is available (new hire guide or best practices) */}
        {pdfObjectUrl && (
          <PdfViewer
            pdfUrl={pdfObjectUrl}
            title={
              isBestPractices
                ? "Practical Tips / Best Practices"
                : "New Hire Guide"
            }
          />
        )}

        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            onClick={onBack}
            disabled={loading}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            onClick={onNext}
            loading={loading}
            disabled={loading}
            icon={ChevronRight}
            iconPosition="right"
          >
            {isBestPractices ? "COMPLETE ONBOARDING" : "CONTINUE"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntityFormStep({ onNext, onBack, form, setForm, loading }) {
  const isFilled = form.company && form.address && form.ein;
  const formatEIN = (val) => {
    let v = val.replace(/\D/g, "").slice(0, 9);
    return v.length > 2 ? v.slice(0, 2) + "-" + v.slice(2) : v;
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 4 OF 8 — CONTRACT ONBOARDING INFORMATION FORM
        </div>
      </div>

      <div className="onboarding-welcome-card" style={{ padding: "60px" }}>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Business Entity Information
        </h2>
        <p className="text-primary text-sm mb-8">
          Please provide the business entity details for the Service Agreement.
        </p>

        <div className="space-y-6 mb-12">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business Entity Name <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Legal business name"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Street address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business EIN <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="XX-XXXXXXX"
              value={form.ein}
              onChange={(e) =>
                setForm({ ...form, ein: formatEIN(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            disabled={loading}
            onClick={onBack}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            disabled={!isFilled || loading}
            onClick={onNext}
            loading={loading}
            icon={ChevronRight}
            iconPosition="right"
          >
            SAVE AND CONTINUE
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentStep({ onNext, onBack, form, setForm, loading }) {
  const formatCard = (val) =>
    val
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  const formatExpiry = (val) => {
    let v = val.replace(/\D/g, "").slice(0, 4);
    return v.length >= 3 ? v.slice(0, 2) + "/" + v.slice(2) : v;
  };

  const isCreditCard = form.paymentType === "credit_card";
  const isACH = form.paymentType === "ach";

  const isFilled =
    (isCreditCard &&
      form.cardName &&
      form.ccBillingAddress &&
      form.ccCity &&
      form.ccState &&
      form.ccZip &&
      form.ccCardType &&
      form.cardNum &&
      form.expiry &&
      form.cvv) ||
    (isACH &&
      form.achAccountHolder &&
      form.achBankName &&
      form.achRoutingNumber &&
      form.achAccountNumber &&
      form.achAccountType);

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 5 OF 8 — PAYMENT SETUP
        </div>
      </div>

      <div className="onboarding-welcome-card" style={{ padding: "60px" }}>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Payment Authorization
        </h2>
        <p className="text-primary text-sm mb-8">
          Select your preferred payment method(s). At least one is required.
        </p>

        {/* Method selector */}
        <div className="flex gap-6 mb-10">
          {[
            { value: "credit_card", label: "Credit Card" },
            { value: "ach", label: "ACH Bank Transfer" },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="paymentType"
                value={opt.value}
                checked={form.paymentType === opt.value}
                onChange={() => setForm({ ...form, paymentType: opt.value })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-semibold text-slate-700">
                {opt.label}
              </span>
            </label>
          ))}
        </div>

        {/* Credit Card fields */}
        {isCreditCard && (
          <div className="mb-10 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
            <div className="flex items-center gap-2 font-semibold text-slate-700 mb-2">
              <CreditCard size={16} />
              <span>Credit Card Details</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cardholder Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Name as it appears on card"
                value={form.cardName}
                onChange={(e) => setForm({ ...form, cardName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Billing Address <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Billing address"
                value={form.ccBillingAddress}
                onChange={(e) =>
                  setForm({ ...form, ccBillingAddress: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="City"
                  value={form.ccCity}
                  onChange={(e) => setForm({ ...form, ccCity: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="State"
                  value={form.ccState}
                  onChange={(e) =>
                    setForm({ ...form, ccState: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Zip Code <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Zip"
                  value={form.ccZip}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ccZip: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Card Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-5">
                {["Visa", "MasterCard", "American Express", "Discover"].map(
                  (type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
                    >
                      <input
                        type="radio"
                        name="ccCardType"
                        value={type}
                        checked={form.ccCardType === type}
                        onChange={() => setForm({ ...form, ccCardType: type })}
                        className="w-4 h-4 accent-primary"
                      />
                      {type}
                    </label>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Card Number <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="XXXX XXXX XXXX XXXX"
                  value={form.cardNum}
                  onChange={(e) =>
                    setForm({ ...form, cardNum: formatCard(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expiration <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="MM/YY"
                  value={form.expiry}
                  onChange={(e) =>
                    setForm({ ...form, expiry: formatExpiry(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CVV <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="XXX"
                  value={form.cvv}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* ACH fields */}
        {isACH && (
          <div className="space-y-8 mb-12">
            <Input
              label="Account Holder Name"
              value={form.achAccountHolder}
              onChange={(e) =>
                setForm({ ...form, achAccountHolder: e.target.value })
              }
              placeholder="Full legal name"
            />
            <Input
              label="Bank Name"
              value={form.achBankName}
              onChange={(e) =>
                setForm({ ...form, achBankName: e.target.value })
              }
              placeholder="e.g. Chase, Bank of America"
            />
            <div className="grid grid-cols-2 gap-6">
              <Input
                label="Routing Number"
                value={form.achRoutingNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    achRoutingNumber: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 9),
                  })
                }
                placeholder="9-digit routing number"
              />
              <Input
                label="Account Number"
                value={form.achAccountNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    achAccountNumber: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Account number"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Account Type
              </label>
              <div className="flex gap-6">
                {["Checking", "Savings"].map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="achAccountType"
                      value={type.toLowerCase()}
                      checked={form.achAccountType === type.toLowerCase()}
                      onChange={() =>
                        setForm({ ...form, achAccountType: type.toLowerCase() })
                      }
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            onClick={onBack}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            disabled={!isFilled || loading}
            onClick={onNext}
            loading={loading}
            icon={ChevronRight}
            iconPosition="right"
          >
            AUTHORIZE AND CONTINUE
          </Button>
        </div>
      </div>
    </div>
  );
}

function SigningStep({
  onNext,
  onBack,
  loading,
  signedByName,
  setSignedByName,
  error,
}) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasSetupRef = useRef(false);

  useEffect(() => {
    setPdfLoading(true);
    setPdfError(null);
    onboardingService
      .getPreviewPdf()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setPdfLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load PDF:", err);
        setPdfError(err.message || "Failed to load agreement PDF");
        setPdfLoading(false);
      });
  }, []);

  // Setup canvas when it becomes available
  useEffect(() => {
    if (canvasSetupRef.current) return;

    const trySetup = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Wait for canvas to have dimensions
        if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#102a43";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";

        canvasSetupRef.current = true;
      } catch (err) {
        console.error("Canvas setup error:", err);
      }
    };

    // Try multiple times in case DOM isn't ready
    const intervals = [0, 50, 100, 200, 300, 500];
    intervals.forEach((delay) => {
      setTimeout(trySetup, delay);
    });
  }, []);

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const start = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 6 OF 8 — CONTRACT EXECUTION
        </div>
        <h2 className="onboarding-headline">Digital Signature</h2>
      </div>

      <div className="onboarding-welcome-card">
        {pdfLoading ? (
          <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-xl mb-6">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : pdfError ? (
          <div className="h-[300px] flex flex-col items-center justify-center bg-slate-50 rounded-xl mb-6 text-slate-500">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm">{pdfError}</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-[300px] border border-slate-200 rounded-xl mb-6 shadow-inner"
            title="Contract"
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-xl mb-6">
            <p className="text-slate-500 text-sm">No PDF available</p>
          </div>
        )}

        <div className="space-y-6 mb-8">
          <Input
            label="Your Legal Full Name"
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center justify-between">
                Digital Signature
              </label>
              <button
                className="text-primary hover:underline text-xs font-medium"
                onClick={() => {
                  const ctx = canvasRef.current.getContext("2d");
                  ctx.clearRect(
                    0,
                    0,
                    canvasRef.current.width,
                    canvasRef.current.height,
                  );
                  setHasDrawn(false);
                }}
              >
                Clear Pad
              </button>
            </div>
            <div className="onboarding-sig-pad">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                onMouseDown={start}
                onMouseMove={draw}
                onMouseUp={() => setIsDrawing(false)}
                onTouchStart={start}
                onTouchMove={draw}
                onTouchEnd={() => setIsDrawing(false)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            disabled={loading}
            onClick={onBack}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            disabled={!hasDrawn || !signedByName || loading}
            onClick={() => {
              if (canvasRef.current) {
                onNext(signedByName, canvasRef.current.toDataURL());
              } else {
                onNext(signedByName, null);
              }
            }}
            loading={loading}
            icon={Check}
            iconPosition="right"
          >
            FINALIZE AND SIGN
          </Button>
        </div>
      </div>
    </div>
  );
}

function AccessPolicyStep({ onNext, onBack, privacyPolicy }) {
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-eyebrow" style={{ color: "#f7a816" }}>
          STEP 7 OF 8 — SECURITY POLICY
        </div>
        <h2 className="onboarding-headline">
          Employee Access and Offboarding Policy
        </h2>
      </div>

      <div className="onboarding-welcome-card">
        <div
          className="onboarding-scroll-view mb-8 ck-content"
          onScroll={(e) => {
            if (
              e.target.scrollHeight -
                e.target.scrollTop -
                e.target.clientHeight <
              40
            )
              setScrolled(true);
          }}
        >
          {privacyPolicy ? (
            <div dangerouslySetInnerHTML={{ __html: privacyPolicy }} />
          ) : (
            <>
              <h4 className="text-lg font-bold mb-4">
                Employee Access and Offboarding Policy
              </h4>
              <div className="onboarding-doc-h">1. Access Provisioning</div>
              <p>
                Clients must document all systems and tools access granted to
                Hello Team employees. A digital access log must be maintained
                and made available to Hello Team upon request.
              </p>
              <div className="onboarding-doc-h">
                2. Principle of Least Privilege
              </div>
              <p>
                Grant employees only the access necessary for their tasks. Do
                not share root/admin passwords unless approved in writing by
                Hello Team.
              </p>
              <div className="onboarding-doc-h">
                3. Day-of-Termination Protocol
              </div>
              <p>
                In the event of a contract termination, all system access must
                be revoked within four (4) hours of the notice. The client is
                solely responsible for timely access removal.
              </p>
              <div className="onboarding-doc-h">
                4. Post-Termination Confirmation
              </div>
              <p>
                Within 48 hours of termination, clients must confirm in writing
                to Hello Team that all access has been revoked, including a
                summary of systems accessed.
              </p>
              <div className="onboarding-doc-h">5. Data and IP</div>
              <p>
                Clients are responsible for ensuring all company data is secured
                prior to termination. Hello Team personnel must not retain
                copies of client data.
              </p>
            </>
          )}

          <p className="mt-8 text-xs font-bold text-slate-400 italic text-center">
            {scrolled
              ? "✓ You have reviewed the entire policy"
              : "↓ Please scroll to the bottom to acknowledge the policy"}
          </p>
        </div>

        <label
          className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all mb-8 ${!scrolled ? "opacity-50 grayscale pointer-events-none" : agreed ? "bg-slate-50 border-primary" : "border-slate-100 hover:border-slate-200"}`}
        >
          <input
            type="checkbox"
            className="w-5 h-5 rounded accent-primary"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={!scrolled}
          />
          <span className="text-sm font-semibold text-slate-700">
            I acknowledge and agree to the Security and Offboarding Policy
          </span>
        </label>

        <div className="flex items-center justify-between mt-16 px-4">
          <button
            type="button"
            className="text-slate-500 font-bold hover:text-slate-800 transition-colors tracking-[0.2em] text-xs"
            onClick={onBack}
          >
            BACK
          </button>
          <Button
            variant="secondary"
            size="xl"
            rounded="pill"
            className="px-14 h-16 shadow-xl shadow-secondary/10 font-bold text-sm tracking-widest bg-[#f7d08a] hover:bg-[#f7a816] text-[#334e68]"
            disabled={!agreed}
            onClick={onNext}
            icon={CheckSquare}
            iconPosition="right"
          >
            COMPLETE ONBOARDING
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuccessStep() {
  return (
    <div className="onboarding-container text-center">
      <div className="onboarding-success-pulse">
        <Check size={48} className="text-emerald-500" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        You're All Set!
      </h1>
      <p className="text-slate-500 text-lg mb-10 max-w-md mx-auto">
        Onboarding complete. Your dashboard is now active and your team member
        is ready for their first shift.
      </p>
      <Button
        variant="secondary"
        size="xl"
        rounded="pill"
        className="h-16 px-16 text-lg font-bold shadow-xl shadow-secondary/20"
        onClick={() => (window.location.href = "/client/dashboard")}
        icon={LayoutDashboard}
        iconPosition="right"
      >
        Go to Portal Dashboard
      </Button>
    </div>
  );
}

// --- Main Page ---
export default function ClientPortalOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [cmsSettings, setCmsSettings] = useState(null);

  const [form, setForm] = useState({
    company: "",
    contact: "",
    address: "",
    ein: "",
    paymentType: "",
    cardName: "",
    ccBillingAddress: "",
    ccCity: "",
    ccState: "",
    ccZip: "",
    ccCardType: "",
    cardNum: "",
    expiry: "",
    cvv: "",
    achAccountHolder: "",
    achBankName: "",
    achRoutingNumber: "",
    achAccountNumber: "",
    achAccountType: "",
  });
  const [signedByName, setSignedByName] = useState("");

  useEffect(() => {
    onboardingService
      .getAgreement()
      .then((res) => {
        if (res.success) {
          setData(res.data);
          if (res.data.onboardingStatus === "COMPLETED") setCurrentStep(8);
          else if (res.data.onboardingStatus === "SIGNED") setCurrentStep(7);
          setForm((f) => ({
            ...f,
            company:
              res.data.agreement?.businessName || res.data.companyName || "",
            contact:
              res.data.agreement?.signerName || res.data.contactPerson || "",
            address:
              res.data.agreement?.businessAddress || res.data.address || "",
            ein: res.data.agreement?.businessEIN || "",
            cardName:
              res.data.agreement?.ccCardholderName ||
              res.data.contactPerson ||
              "",
          }));
          setSignedByName(
            res.data.agreement?.signedByName || res.data.contactPerson || "",
          );
        }
        setDataLoading(false);
      })
      .catch(() => setDataLoading(false));

    settingsService.getCmsSettings().then((res) => {
      if (res.success) setCmsSettings(res.data);
    });
  }, []);

  const handleNext = async (signedName, sigImage) => {
    setError(null);
    try {
      if (currentStep === 3) {
        setLoading(true);
        await onboardingService.saveDetails({
          businessName: form.company,
          signerName: form.contact,
          businessAddress: form.address,
          businessEIN: form.ein,
        });
      } else if (currentStep === 4) {
        setLoading(true);
        const paymentPayload =
          form.paymentType === "ach"
            ? {
                paymentMethod: "ach",
                achAccountHolder: form.achAccountHolder,
                achBankName: form.achBankName,
                achRoutingNumber: form.achRoutingNumber,
                achAccountNumber: form.achAccountNumber,
                achAccountType: form.achAccountType,
              }
            : {
                paymentMethod: "credit_card",
                ccCardholderName: form.cardName,
                ccBillingAddress: form.ccBillingAddress,
                ccCity: form.ccCity,
                ccState: form.ccState,
                ccZip: form.ccZip,
                ccCardType: form.ccCardType,
                ccCardNumber: form.cardNum,
                ccExpiration: form.expiry,
                ccCVV: form.cvv,
              };
        await onboardingService.saveDetails({
          ...paymentPayload,
          businessName: form.company,
          signerName: form.contact,
          businessAddress: form.address,
          businessEIN: form.ein,
        });
      } else if (currentStep === 5) {
        setLoading(true);
        await onboardingService.signAgreement(signedName, sigImage);
      } else if (currentStep === 7) {
        setLoading(true);
        await onboardingService.completeOnboarding();
      }
      setCurrentStep((prev) => prev + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const progress = Math.round((currentStep / 8) * 100);

  return (
    <div className="onboarding-root">
      <style>{styles}</style>
      <ImpersonationBanner />
      <div className="onboarding-bg-mesh" />

      <div className="onboarding-layout">
        <aside className="onboarding-sidebar">
          <div className="onboarding-sidebar-logo">
            <div className="onboarding-logo-box">
              <img src="/logo.png" alt="Logo" className="onboarding-logo-img" />
            </div>
            <div className="onboarding-logo-text">
              <h1>Hello Team</h1>
              <p>Onboarding</p>
            </div>
          </div>
          <div className="onboarding-step-list">
            {STEPS.map((step, i) => {
              const isDone = i < currentStep;
              const isCurrent = i === currentStep;
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`onboarding-step-item ${isCurrent ? "active" : ""} ${isDone ? "done-item" : ""}`}
                >
                  <div
                    className={`onboarding-step-dot ${isDone ? "done" : ""}`}
                  >
                    {isDone ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span className="onboarding-step-name">{step.label}</span>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="onboarding-main">
          <div className="onboarding-progress-wrap">
            <div
              className="onboarding-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div key={currentStep}>
            {currentStep === 0 &&
              (dataLoading ? (
                <div className="flex items-center justify-center py-32">
                  <Loader2 className="animate-spin text-primary" size={36} />
                </div>
              ) : (
                <WelcomeStep
                  onNext={() => setCurrentStep(1)}
                  employees={data?.assignedEmployees || []}
                />
              ))}
            {currentStep === 1 && (
              <LegalStep
                onNext={() => setCurrentStep(2)}
                onBack={handleBack}
                content={cmsSettings?.legalTerms}
              />
            )}
            {currentStep === 2 && (
              <GuideStep
                onNext={() => setCurrentStep(3)}
                onBack={handleBack}
                step={2}
                content={cmsSettings?.newHireGuide}
                pdfExists={!!cmsSettings?.newHireGuidePdfName}
              />
            )}
            {currentStep === 3 && (
              <EntityFormStep
                onNext={handleNext}
                onBack={handleBack}
                form={form}
                setForm={setForm}
                loading={loading}
              />
            )}
            {currentStep === 4 && (
              <PaymentStep
                onNext={handleNext}
                onBack={handleBack}
                form={form}
                setForm={setForm}
                loading={loading}
              />
            )}
            {currentStep === 5 && (
              <SigningStep
                onNext={handleNext}
                onBack={handleBack}
                loading={loading}
                signedByName={signedByName}
                setSignedByName={setSignedByName}
                error={error}
              />
            )}
            {currentStep === 6 && (
              <AccessPolicyStep
                onNext={() => setCurrentStep(7)}
                onBack={handleBack}
                privacyPolicy={cmsSettings?.privacyPolicy}
              />
            )}
            {currentStep === 7 && (
              <GuideStep
                onNext={handleNext}
                onBack={handleBack}
                step={3}
                loading={loading}
                welcomeTipsPdfExists={!!cmsSettings?.welcomeTipsPdfName}
                content={cmsSettings?.welcomeTips}
              />
            )}
            {currentStep === 8 && <SuccessStep />}
          </div>
        </main>
      </div>
    </div>
  );
}
