/**
 * Role-aware navigation configuration.
 * Each role sees a different set of nav items, filtered by their permissions.
 * This makes the nav bar role-specific instead of showing all 9 items to everyone.
 */
import {
  LayoutDashboard, Building2, FileText, Link2, Send, FileBarChart,
  TrendingUp, History, FileCheck2, Settings2, Users, ShieldCheck,
  Package, HeartHandshake, Scale, Briefcase, BarChart3, Gavel, Eye, Crown,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '@/lib/auth-context'

export interface NavItem {
  key: ModuleKey
  label: string
  icon: LucideIcon
  badgeTone?: 'green' | 'blue' | 'amber' | 'rose'
}

// Role-specific navigation maps (per the master spec's role definitions)
const ROLE_NAV: Record<string, NavItem[]> = {
  // Super Admin — full system access
  SUPER_ADMIN: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'My Project', icon: Building2 },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'audit', label: 'Audit & Trace', icon: History },
    { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
    { key: 'admin', label: 'Admin', icon: Settings2 },
  ],

  // Project / Site User — data entry focused
  PROJECT_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'My Project', icon: Building2 },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
  ],

  // HR User — workforce data focused
  HR_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'Workforce', icon: Users },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'team', label: 'Team', icon: Users },
  ],

  // EHS / Safety User — safety data focused
  EHS_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'My Project', icon: Building2 },
    { key: 'data-entry', label: 'Data Entry', icon: ShieldCheck, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'team', label: 'Team', icon: Users },
  ],

  // Procurement User — supplier data focused
  PROCUREMENT_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'Suppliers', icon: Package },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'team', label: 'Team', icon: Users },
  ],

  // CSR User — community focused
  CSR_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'CSR', icon: HeartHandshake },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'team', label: 'Team', icon: Users },
  ],

  // Compliance / Governance User
  COMPLIANCE_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'Governance', icon: Scale },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'team', label: 'Team', icon: Users },
  ],

  // BU Reviewer — review focused
  BU_REVIEWER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'Projects', icon: Building2 },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Review Queue', icon: Send, badgeTone: 'amber' },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit', icon: History },
  ],

  // Subsidiary Reviewer — consolidation focused
  SUBSIDIARY_REVIEWER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'Business Units', icon: Briefcase },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Approvals', icon: Send, badgeTone: 'amber' },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit', icon: History },
  ],

  // Group / HQ Reviewer — final review + lock
  GROUP_REVIEWER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'Organization', icon: Building2 },
    { key: 'submissions', label: 'Final Review', icon: Send, badgeTone: 'amber' },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
    { key: 'audit', label: 'Audit', icon: History },
  ],

  // ESG Manager — data quality + methodology
  ESG_MANAGER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit', icon: History },
    { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
  ],

  // ESG Analyst — analytics focused
  ESG_ANALYST: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
  ],

  // BRSR Manager — BRSR focused
  BRSR_MANAGER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit', icon: History },
  ],

  // Auditor — read-only assurance
  AUDITOR: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
    { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
  ],

  // Executive — high-level reporting
  EXECUTIVE: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
  ],
}

/** Get the nav items for a given role key. Falls back to Executive (read-only) for unknown roles. */
export function getNavForRole(roleKey: string): NavItem[] {
  return ROLE_NAV[roleKey] ?? ROLE_NAV.EXECUTIVE
}

/** Default nav for fallback (used in contexts where role isn't known yet) */
export const DEFAULT_NAV: NavItem[] = ROLE_NAV.EXECUTIVE
