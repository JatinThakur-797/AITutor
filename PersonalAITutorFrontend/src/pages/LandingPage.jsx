import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Code2,
  GraduationCap,
  Menu,
  MessageCircle,
  Moon,
  Route,
  Sparkles,
  Sun,
  Target,
  X
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const features = [
  {
    icon: Target,
    number: "01",
    title: "Start with your goal",
    description:
      "Tell PathAI what you want to learn, where you are starting, and how much time you can commit.",
    tone: "violet",
  },
  {
    icon: Route,
    number: "02",
    title: "Follow a clear roadmap",
    description:
      "Turn a big ambition into a sequence of manageable daily topics, lessons, and milestones.",
    tone: "blue",
  },
  {
    icon: BrainCircuit,
    number: "03",
    title: "Learn, practice, improve",
    description:
      "Read focused lessons, work through tasks, and ask the AI mentor when a concept is unclear.",
    tone: "green",
  },
];

const workspaceItems = [
  {
    icon: BookOpen,
    title: "GFG-style lessons",
    copy: "Readable, topic-focused learning content",
  },
  {
    icon: Code2,
    title: "Practice workspace",
    copy: "A dedicated editor for coding exercises",
  },
  {
    icon: MessageCircle,
    title: "Lesson-aware mentor",
    copy: "Ask questions with your lesson as context",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const primaryHref = user ? "/app" : "/register";
  const primaryLabel = user ? "Open my workspace" : "Build my learning path";

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing-page">
      <header className="landing-nav-wrap">
        <nav className="landing-nav" aria-label="Main navigation">
          <Link to="/" className="landing-brand" onClick={closeMenu}>
            <span className="landing-brand-mark">
              <GraduationCap size={20} />
            </span>
            <span>
              path<span className="landing-brand-accent">ai</span>
            </span>
          </Link>

          <div className={`landing-nav-links ${menuOpen ? "is-open" : ""}`}>
            <a href="#how-it-works" onClick={closeMenu}>
              How it works
            </a>
            <a href="#workspace" onClick={closeMenu}>
              The workspace
            </a>
            <a href="#faq" onClick={closeMenu}>
              FAQ
            </a>
            <div className="landing-mobile-actions">
              <Link
                className="landing-mobile-login"
                to="/login"
                onClick={closeMenu}
              >
                Sign in
              </Link>
              <Link
                className="landing-button landing-button-primary"
                to={primaryHref}
                onClick={closeMenu}
              >
                {primaryLabel}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          <div className="landing-nav-actions">
            <button
              className="landing-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link className="landing-login-link" to={user ? "/app" : "/login"}>
              {user ? "Workspace" : "Sign in"}
            </Link>
            <Link
              className="landing-button landing-button-primary landing-nav-cta"
              to={primaryHref}
            >
              {user ? "Open workspace" : "Get started"}
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="landing-menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-noise" />
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <div className="landing-eyebrow">
                <span className="landing-eyebrow-pulse" /> A more intentional
                way to learn
              </div>
              <h1>
                Stop collecting tutorials.
                <br />
                <span>Start making progress.</span>
              </h1>
              <p className="landing-hero-description">
                PathAI turns your learning goal into a practical roadmap, guided
                lessons, hands-on tasks, and an AI mentor that helps you keep
                moving.
              </p>
              <div className="landing-hero-actions">
                <Link
                  to={primaryHref}
                  className="landing-button landing-button-primary landing-button-large"
                >
                  {primaryLabel}
                  <ArrowRight size={18} />
                </Link>
                <a
                  href="#how-it-works"
                  className="landing-button landing-button-secondary landing-button-large"
                >
                  <span className="landing-play-icon">↘</span>See how it works
                </a>
              </div>
              <div className="landing-hero-note">
                <CheckCircle2 size={15} />
                <span>
                  Your goal. Your pace. A plan you can actually follow.
                </span>
              </div>
            </div>

            <div
              className="landing-visual"
              aria-label="Illustration of a PathAI learning roadmap"
            >
              <div className="landing-visual-glow" />
              <div className="landing-orbit landing-orbit-one" />
              <div className="landing-orbit landing-orbit-two" />
              <div className="landing-floating-tag landing-tag-top">
                <Sparkles size={14} /> Built around your goal
              </div>
              <div className="landing-roadmap-card">
                <div className="landing-roadmap-head">
                  <div>
                    <span className="landing-card-label">
                      YOUR LEARNING PATH
                    </span>
                    <strong>Backend Development</strong>
                  </div>
                  <span className="landing-card-status">
                    <i /> In progress
                  </span>
                </div>
                <div className="landing-roadmap-progress">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="landing-roadmap-caption">
                  <span>Learning journey</span>
                  <strong>One step at a time</strong>
                </div>
                <div className="landing-roadmap-list">
                  <div className="landing-roadmap-item is-done">
                    <span className="landing-step-check">
                      <CheckCircle2 size={15} />
                    </span>
                    <div>
                      <strong>Java foundations</strong>
                      <small>Core concepts and problem solving</small>
                    </div>
                    <span className="landing-step-state">Done</span>
                  </div>
                  <div className="landing-roadmap-item is-current">
                    <span className="landing-step-number">02</span>
                    <div>
                      <strong>Spring Boot essentials</strong>
                      <small>REST APIs and dependency injection</small>
                    </div>
                    <span className="landing-step-state">Now</span>
                  </div>
                  <div className="landing-roadmap-item">
                    <span className="landing-step-number">03</span>
                    <div>
                      <strong>Persistence and data</strong>
                      <small>JPA, Hibernate, and SQL</small>
                    </div>
                    <span className="landing-step-state">Next</span>
                  </div>
                </div>
              </div>
              <div className="landing-floating-tag landing-tag-bottom">
                <span className="landing-mentor-avatar">
                  <BrainCircuit size={16} />
                </span>
                <span>
                  <strong>AI Mentor</strong>
                  <small>Here when you get stuck</small>
                </span>
                <span className="landing-online-dot" />
              </div>
            </div>
          </div>
          <div className="landing-hero-bottom">
            <span>LESS OVERWHELMING</span>
            <i />
            <span>MORE STRUCTURE</span>
            <i />
            <span>REAL PRACTICE</span>
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="PathAI approach">
          <span>Designed around the way people actually learn</span>
          <div>
            <BookOpen size={16} /> Focused lessons
          </div>
          <div>
            <Route size={16} /> Clear direction
          </div>
          <div>
            <Code2 size={16} /> Practical work
          </div>
          <div>
            <MessageCircle size={16} /> Guided support
          </div>
        </section>

        <section className="landing-section landing-how" id="how-it-works">
          <div className="landing-section-heading">
            <div className="landing-eyebrow">A SIMPLE LEARNING LOOP</div>
            <h2>
              Know what to learn.
              <br />
              <span>Know what to do next.</span>
            </h2>
            <p>
              No more jumping between random tabs. PathAI gives your learning a
              sequence and a next step.
            </p>
          </div>
          <div className="landing-feature-grid">
            {features.map((feature) => (
              <article
                className={`landing-feature-card tone-${feature.tone}`}
                key={feature.number}
              >
                <div className="landing-feature-top">
                  <span className="landing-feature-icon">
                    <feature.icon size={21} />
                  </span>
                  <span className="landing-feature-number">
                    {feature.number}
                  </span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className="landing-feature-line" />
              </article>
            ))}
          </div>
        </section>

        <section className="landing-workspace-section" id="workspace">
          <div className="landing-workspace-inner">
            <div className="landing-workspace-copy">
              <div className="landing-eyebrow">ONE CONNECTED WORKSPACE</div>
              <h2>
                From reading a concept
                <br />
                to <span>putting it into practice.</span>
              </h2>
              <p>
                Learning works better when the explanation, the exercise, and
                the help you need are connected. Keep the context of your
                current learning path in one place.
              </p>
              <div className="landing-workspace-list">
                {workspaceItems.map((item) => (
                  <div className="landing-workspace-item" key={item.title}>
                    <span>
                      <item.icon size={18} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.copy}</small>
                    </div>
                    <CheckCircle2
                      size={16}
                      className="landing-workspace-check"
                    />
                  </div>
                ))}
              </div>
              <Link to={primaryHref} className="landing-text-link">
                Explore your workspace <ArrowRight size={16} />
              </Link>
            </div>
            <div className="landing-product-preview">
              <div className="landing-preview-topbar">
                <div className="landing-preview-brand">
                  <span className="landing-brand-mark">
                    <GraduationCap size={14} />
                  </span>
                  path<span>ai</span>
                </div>
                <div className="landing-preview-dots">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="landing-preview-body">
                <aside className="landing-preview-sidebar">
                  <div className="landing-preview-avatar" />
                  <span className="active" />
                  <span />
                  <span />
                  <span />
                </aside>
                <div className="landing-preview-content">
                  <div className="landing-preview-greeting">
                    YOUR LEARNING OVERVIEW
                  </div>
                  <div className="landing-preview-title">
                    Build your next skill.
                  </div>
                  <div className="landing-preview-subtitle">
                    A little progress, every day.
                  </div>
                  <div className="landing-preview-stats">
                    <div>
                      <span>LEARNING PATH</span>
                      <strong>01</strong>
                    </div>
                    <div>
                      <span>DAILY LESSON</span>
                      <strong>01</strong>
                    </div>
                    <div>
                      <span>YOUR PACE</span>
                      <strong>∞</strong>
                    </div>
                  </div>
                  <div className="landing-preview-plan">
                    <div className="landing-preview-plan-head">
                      <div>
                        <span>YOUR ROADMAP</span>
                        <strong>Backend Development</strong>
                      </div>
                      <span className="landing-preview-chip">ACTIVE</span>
                    </div>
                    <div className="landing-preview-plan-line">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="landing-preview-topic">
                      <span className="landing-preview-topic-icon">
                        <BookOpen size={14} />
                      </span>
                      <div>
                        <strong>REST API design</strong>
                        <small>Lesson · Practice · Review</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                  <div className="landing-preview-mentor">
                    <span>
                      <BrainCircuit size={15} />
                    </span>
                    <div>
                      <strong>Your mentor is ready</strong>
                      <small>Ask a question about this lesson</small>
                    </div>
                    <MessageCircle size={15} />
                  </div>
                </div>
              </div>
              <div className="landing-preview-foot">
                <span>
                  <i /> Workspace preview
                </span>
                <span>Illustrative interface</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-quote-section">
          <div className="landing-quote-mark">“</div>
          <p>Consistency gets easier when the next step is clear.</p>
          <span>THE PATHAI APPROACH</span>
        </section>

        <section className="landing-faq-section" id="faq">
          <div className="landing-faq-intro">
            <div className="landing-eyebrow">GOOD TO KNOW</div>
            <h2>
              Questions before
              <br />
              <span>you get started?</span>
            </h2>
            <p>A quick overview of what PathAI is designed to help with.</p>
          </div>
          <div className="landing-faq-list">
            <details>
              <summary>
                What does PathAI do?
                <ChevronDown size={18} />
              </summary>
              <p>
                PathAI helps you turn a learning goal into an assessed starting
                point, a structured roadmap, daily lesson content, practical
                tasks, and a lesson-aware AI mentor.
              </p>
            </details>
            <details>
              <summary>
                Can I choose my own learning pace?
                <ChevronDown size={18} />
              </summary>
              <p>
                Yes. During onboarding, you provide your available study time
                and intended duration so the learning plan can be shaped around
                your schedule.
              </p>
            </details>
            <details>
              <summary>
                Does the coding editor execute code?
                <ChevronDown size={18} />
              </summary>
              <p>
                The current workspace provides an editor for working on and
                saving task drafts. Code execution requires a connected
                execution service and is not represented as available unless
                your backend provides one.
              </p>
            </details>
            <details>
              <summary>
                Do I need an account?
                <ChevronDown size={18} />
              </summary>
              <p>
                You can explore this introduction without signing in. An account
                is required to create and save your personal learning paths and
                progress.
              </p>
            </details>
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-final-cta-glow" />
          <div className="landing-eyebrow">YOUR NEXT STEP STARTS HERE</div>
          <h2>
            Make your learning
            <br />
            <span>intentional.</span>
          </h2>
          <p>Choose a goal. Get a direction. Keep showing up.</p>
          <Link
            to={primaryHref}
            className="landing-button landing-button-light landing-button-large"
          >
            {primaryLabel}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark">
            <GraduationCap size={18} />
          </span>
          <span>
            path<span className="landing-brand-accent">ai</span>
          </span>
        </Link>
        <span>Learn with direction. Build with confidence.</span>
        <div>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create account</Link>
          <a href="#how-it-works">How it works</a>
        </div>
        <small>© {new Date().getFullYear()} PathAI</small>
      </footer>
    </div>
  );
}
