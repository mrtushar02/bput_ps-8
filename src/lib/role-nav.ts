/**
 * Role-aware navigation configuration.
 * Each role sees a different set of nav items, filtered by their permissions.
 * This makes the nav bar role-specific instead of showing all 9 items to everyone.
 */
import {
  LayoutDashboard, Building2, FileText, Link2, Send, FileBarChart,
  TrendingUp, History, FileCheck2, Settings2, Users, ShieldCheck,
  Package, HeartHandshake, Scale, Briefcase, BarChart3, Gavel, Eye, Crown,
  GraduationCap, HeartPulse,
  FileSearch, Wrench, ShoppingCart, Wallet, MapPin, MessageCircle,
  AlertCircle, ClipboardList, Calendar, Target, Lock, Layers, FlaskConical,
  Database, Leaf, AlertTriangle, Gauge, CheckCircle2, GitBranch,
  ClipboardCheck, Flame, Zap,
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
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
  ],

  // Finance & Resource Data Contributor — 8 dedicated tabs matching reference screenshot
  FINANCE_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'fin-assignments', label: 'My Assignments', icon: ClipboardList, badgeTone: 'blue' },
    { key: 'fin-data', label: 'Financial Data', icon: FileText, badgeTone: 'green' },
    { key: 'fin-expenditure', label: 'Resource Expenditure', icon: Leaf },
    { key: 'fin-evidence', label: 'Evidence & Documents', icon: Link2, badgeTone: 'blue' },
    { key: 'fin-submissions', label: 'My Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'fin-reports', label: 'Reports & Exports', icon: FileBarChart },
    { key: 'fin-activity', label: 'Activity Log', icon: History },
  ],

  // HR User — 7 HR-specific tabs (NOT generic tabs)
  HR_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'hr-workforce', label: 'Workforce', icon: Users },
    { key: 'hr-training', label: 'Training & Dev', icon: GraduationCap },
    { key: 'hr-wellbeing', label: 'Wellbeing', icon: HeartPulse },
    { key: 'hr-rights', label: 'Human Rights', icon: Scale },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
  ],

  // EHS / Safety User — 13 EHS-specific tabs
  EHS_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'ehs-ops', label: 'Safety Operations', icon: ShieldCheck },
    { key: 'ehs-incidents', label: 'Incidents', icon: AlertTriangle },
    { key: 'ehs-inspections', label: 'Inspections', icon: FileSearch },
    { key: 'ehs-corrective', label: 'Corrective Actions', icon: Wrench },
    { key: 'ehs-environmental', label: 'Environmental', icon: Leaf },
    { key: 'ehs-training', label: 'Safety Training', icon: GraduationCap },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Procurement / Supply Chain User — 12 tabs
  PROCUREMENT_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'proc-suppliers', label: 'Suppliers', icon: Package },
    { key: 'proc-assessments', label: 'Assessments', icon: ClipboardCheck },
    { key: 'proc-sourcing', label: 'Sustainable Sourcing', icon: Leaf },
    { key: 'proc-transactions', label: 'Transactions', icon: ShoppingCart },
    { key: 'proc-valuechain', label: 'ESG / Value Chain', icon: GitBranch },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // CSR / Community User — 13 tabs
  CSR_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'csr-projects', label: 'CSR Projects', icon: HeartHandshake },
    { key: 'csr-budgets', label: 'Budgets & Spend', icon: Wallet },
    { key: 'csr-beneficiaries', label: 'Beneficiaries', icon: Users },
    { key: 'csr-impact', label: 'Impact Assessment', icon: BarChart3 },
    { key: 'csr-community', label: 'Community Engagement', icon: MessageCircle },
    { key: 'csr-local', label: 'Local Sourcing', icon: MapPin },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Compliance / Governance User — 13 tabs
  COMPLIANCE_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'comp-policies', label: 'Policies', icon: FileCheck2 },
    { key: 'comp-obligations', label: 'Compliance Obligations', icon: ClipboardList },
    { key: 'comp-controls', label: 'Controls', icon: ShieldCheck },
    { key: 'comp-cases', label: 'Cases & Incidents', icon: AlertCircle },
    { key: 'comp-ethics', label: 'Ethics & Conduct', icon: Scale },
    { key: 'comp-calendar', label: 'Regulatory Calendar', icon: Calendar },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'brsr', label: 'BRSR Governance', icon: FileCheck2 },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // BU Reviewer — 12 BU-specific tabs
  BU_REVIEWER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'review-queue', label: 'Review Queue', icon: ClipboardCheck, badgeTone: 'amber' },
    { key: 'review-bu', label: 'My Business Unit', icon: Building2 },
    { key: 'submissions', label: 'Submissions', icon: Send },
    { key: 'review-consolidation', label: 'Consolidation', icon: GitBranch },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'review-exceptions', label: 'Exceptions & SLA', icon: AlertTriangle },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Subsidiary Reviewer — 11 tabs
  SUBSIDIARY_REVIEWER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'sub-bucenter', label: 'BU Review Center', icon: Briefcase },
    { key: 'sub-esg', label: 'Subsidiary ESG', icon: BarChart3 },
    { key: 'sub-brsr-impact', label: 'BRSR Impact', icon: FileCheck2 },
    { key: 'sub-approvals', label: 'Approvals', icon: Send, badgeTone: 'amber' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Group / HQ Reviewer (CSO) — 11 tabs
  GROUP_REVIEWER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'grp-consolidation', label: 'Group Consolidation', icon: GitBranch },
    { key: 'grp-enterprise', label: 'Enterprise ESG', icon: BarChart3 },
    { key: 'grp-brsr', label: 'BRSR Command', icon: FileCheck2 },
    { key: 'grp-assurance', label: 'Assurance', icon: Eye },
    { key: 'grp-risk', label: 'Risk Management', icon: AlertTriangle },
    { key: 'grp-lock', label: 'Approvals & Lock', icon: Lock, badgeTone: 'amber' },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // ESG Manager — 13 tabs
  ESG_MANAGER: [
    { key: 'overview', label: 'ESG Overview', icon: LayoutDashboard },
    { key: 'esg-kpi', label: 'KPI Management', icon: Gauge },
    { key: 'esg-performance', label: 'ESG Performance', icon: TrendingUp },
    { key: 'esg-completeness', label: 'Data Completeness', icon: CheckCircle2 },
    { key: 'esg-risks', label: 'Material ESG Risks', icon: AlertTriangle },
    { key: 'esg-targets', label: 'Targets & Progress', icon: Target },
    { key: 'brsr', label: 'BRSR Readiness', icon: FileCheck2 },
    { key: 'esg-crossfunc', label: 'Cross-Functional', icon: GitBranch },
    { key: 'evidence', label: 'Evidence', icon: Link2 },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // ESG Analyst — 13 tabs
  ESG_ANALYST: [
    { key: 'overview', label: 'Analytics Overview', icon: LayoutDashboard },
    { key: 'ana-explorer', label: 'Data Explorer', icon: Database },
    { key: 'ana-metrics', label: 'ESG Metrics', icon: Gauge },
    { key: 'ana-emissions', label: 'Emissions Analysis', icon: Flame },
    { key: 'ana-energy', label: 'Energy & Resources', icon: Zap },
    { key: 'ana-social', label: 'Social Analytics', icon: Users },
    { key: 'ana-governance', label: 'Governance Analytics', icon: Scale },
    { key: 'ana-variance', label: 'Variance & Anomalies', icon: AlertTriangle },
    { key: 'ana-quality', label: 'Data Quality', icon: ShieldCheck },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit', icon: History },
  ],

  // BRSR Manager — 14 tabs
  BRSR_MANAGER: [
    { key: 'overview', label: 'BRSR Command', icon: LayoutDashboard },
    { key: 'brsr-frameworks', label: 'Frameworks', icon: Layers },
    { key: 'brsr-section-a', label: 'Section A', icon: FileText },
    { key: 'brsr-section-b', label: 'Section B', icon: FileText },
    { key: 'brsr-section-c', label: 'Section C', icon: FileText },
    { key: 'brsr-core', label: 'BRSR Core', icon: FileCheck2 },
    { key: 'brsr-mapping', label: 'Disclosure Mapping', icon: GitBranch },
    { key: 'brsr-sources', label: 'Evidence & Sources', icon: Link2 },
    { key: 'brsr-validation', label: 'Validation', icon: CheckCircle2 },
    { key: 'brsr-readiness', label: 'Readiness', icon: Gauge },
    { key: 'brsr-builder', label: 'Report Builder', icon: FileBarChart },
    { key: 'brsr-issuance', label: 'Approval & Issuance', icon: Send },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Auditor — 13 tabs
  AUDITOR: [
    { key: 'overview', label: 'Assurance Overview', icon: LayoutDashboard },
    { key: 'aud-engagements', label: 'Engagements', icon: Briefcase },
    { key: 'aud-scope', label: 'Scope & Materiality', icon: Target },
    { key: 'aud-evidence', label: 'Evidence Review', icon: FileSearch },
    { key: 'aud-testing', label: 'Data Testing', icon: FlaskConical },
    { key: 'aud-brsr-testing', label: 'BRSR Testing', icon: FileCheck2 },
    { key: 'aud-findings', label: 'Findings', icon: AlertTriangle },
    { key: 'aud-requests', label: 'Evidence Requests', icon: Send },
    { key: 'aud-responses', label: 'Mgmt Responses', icon: MessageCircle },
    { key: 'aud-status', label: 'Assurance Status', icon: Gauge },
    { key: 'aud-reports', label: 'Assurance Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit Trail', icon: History },
  ],

  // Executive — 10 tabs
  EXECUTIVE: [
    { key: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
    { key: 'exec-enterprise', label: 'Enterprise ESG', icon: BarChart3 },
    { key: 'exec-brsr', label: 'BRSR Readiness', icon: FileCheck2 },
    { key: 'exec-risks', label: 'Strategic Risks', icon: AlertTriangle },
    { key: 'exec-trends', label: 'Performance Trends', icon: TrendingUp },
    { key: 'exec-bus', label: 'Business Units', icon: Building2 },
    { key: 'exec-assurance', label: 'Assurance Status', icon: ShieldCheck },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],
}

/** Get the nav items for a given role key. Falls back to Executive (read-only) for unknown roles. */
export function getNavForRole(roleKey: string): NavItem[] {
  return ROLE_NAV[roleKey] ?? ROLE_NAV.EXECUTIVE
}

/** Default nav for fallback (used in contexts where role isn't known yet) */
export const DEFAULT_NAV: NavItem[] = ROLE_NAV.EXECUTIVE
