import Link from "next/link";
import type { ReactNode } from "react";

/* ---------- Floating glass chrome that sits on top of canvases ---------- */

export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`animate-fade-down absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/80 p-1.5 shadow-sm backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function ToolButton({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-900 hover:text-white disabled:hover:bg-neutral-100 disabled:hover:text-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

export function ToolDivider() {
  return <div className="mx-0.5 h-4 w-px bg-neutral-200" />;
}

export function StatsBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`animate-fade-up absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-neutral-200 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">{k}</span>
      <span className="font-mono text-xs font-medium text-neutral-700">{v}</span>
      {unit && <span className="font-mono text-[10px] text-neutral-300">{unit}</span>}
    </div>
  );
}

/** The problem statement card, top-left of the canvas. */
export function PromptCard({
  step,
  title,
  children,
  className = "",
}: {
  step?: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-fade-down absolute left-4 top-4 z-10 max-w-sm rounded-xl border border-neutral-200 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl ${className}`}
    >
      {step && (
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{step}</div>
      )}
      <div className="text-sm font-medium leading-snug text-neutral-900">{title}</div>
      {children && <div className="mt-1.5 text-xs leading-relaxed text-neutral-500">{children}</div>}
    </div>
  );
}

export function PillButton({
  onClick,
  children,
  variant = "solid",
  disabled,
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: "solid" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "solid"
          ? "bg-neutral-900 text-white hover:bg-neutral-700"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; locked?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.locked}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.value ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Page chrome ---------- */

export function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 8 Q17 8 24 26" strokeDasharray="0.1 4.6" />
        <circle cx="24" cy="26" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="animate-fade-down sticky top-0 z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-neutral-900">Intuition Lab</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/">Challenges</NavLink>
          <NavLink href="/analyzer">Analyzer</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}

export function ExperimentShell({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="animate-fade-down sticky top-0 z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <Link
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            href="/"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <div className="h-4 w-px bg-neutral-200" />
          <span className="text-sm font-medium text-neutral-900">{title}</span>
          <div className="flex-1" />
          <Link
            href="/analyzer"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            Analyzer
          </Link>
        </div>
      </div>
      <div className="animate-fade-up mx-auto max-w-6xl px-6 pb-6 pt-10">
        <div className="max-w-xl text-sm leading-relaxed text-neutral-500">{description}</div>
      </div>
      <div className="animate-fade-up mx-auto max-w-6xl px-6 pb-16">{children}</div>
    </div>
  );
}

export function CanvasCard({ children, height = "h-[600px]" }: { children: ReactNode; height?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className={`relative w-full overflow-hidden ${height}`}>{children}</div>
    </div>
  );
}

/* ---------- Icons (stroke, 14px) ---------- */

const I = ({ d, children }: { d?: string; children?: ReactNode }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

export const Icon = {
  play: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  ),
  pause: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  reset: (
    <I>
      <path d="M21 12a9 9 0 1 1-9-9" />
      <polyline points="21 3 21 9 15 9" />
      <path d="M21 9l-6-6" />
    </I>
  ),
  pen: <I d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />,
  erase: (
    <I>
      <path d="M20 20H8l-5-5 10-10 9 9-6 6" />
      <path d="M6 12l6 6" />
    </I>
  ),
  drop: (
    <I>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </I>
  ),
  eye: (
    <I>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </I>
  ),
  arrow: (
    <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  ),
};
