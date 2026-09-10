import Link from "next/link";

export function DashboardBrand() {
  return (
    <Link href="/" className="dashboard-brand" aria-label="Strike home" title="Strike Home">
      <svg width="25" height="29" viewBox="0 0 28 32" fill="none" aria-hidden="true">
        <path d="M15 1H26L17.5 12H27L9 31L12 19H1L15 1Z" fill="currentColor" />
      </svg>
      <span>strike<span className="dashboard-brand-dot">.</span></span>
    </Link>
  );
}
