'use client'
/**
 * Group Admin Dashboard — MEIL Group BRSR & ESG Reporting Platform
 *
 * Designed for the GROUP_ADMIN role with an executive iOS Liquid Glass &
 * Glassmorphism aesthetic. Delivers organizational oversight, multi-level
 * hierarchy drill-down, reporting timelines, subsidiary/BU/project report
 * inspection, verified evidence review, previous-year BRSR archive,
 * and live connected user submissions & audit activities.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Layers, FolderTree, Calendar, FileText, Download, Eye,
  CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck, Search,
  Filter, ArrowRight, ChevronRight, ChevronDown, Package, History,
  Sparkles, Check, X, Lock, Unlock, FileBox, Archive, TrendingUp,
  BarChart3, RefreshCw, SlidersHorizontal, ArrowLeft, Globe, MapPin,
  Users, Activity, Send, AlertOctagon, FileCheck2, ExternalLink,
  Briefcase, Scale, Heart, ShieldAlert, BadgeCheck, FileDown,
  Info, CornerDownRight, CheckSquare, Settings2, UserCheck
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import {
  MEIL_ORGANIZATIONS,
  MEIL_BUSINESS_UNITS,
  type MeilBusinessUnit,
  type MeilProject
} from '@/lib/meil-portfolio'

// ============================================================================
// Types & Domain Models
// ============================================================================

export type ReportingStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'OVERDUE'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export interface SubsidiaryModel {
  id: string
  code: string
  name: string
  legalName: string
  cin: string
  status: 'ACTIVE' | 'INACTIVE'
  buCount: number
  projectCount: number
  reportingStatus: ReportingStatus
  progressPct: number
  lastUpdated: string
  statusSummary: {
    submitted: number
    pending: number
    overdue: number
    approved: number
    underReview: number
  }
}

export interface BusinessUnitModel {
  id: string
  subsidiaryId: string
  subsidiaryName: string
  code: string
  name: string
  sector: string
  reportingOwner: string
  status: 'ACTIVE' | 'INACTIVE'
  projectCount: number
  reportingStatus: ReportingStatus
  progressPct: number
  kpiHighlights: string
}

export interface ProjectModel {
  id: string
  code: string
  name: string
  buId: string
  buName: string
  subsidiaryId: string
  subsidiaryName: string
  location: string
  state: string
  reportingOwner: string
  reportingStatus: ReportingStatus
  submissionDeadline: string
  progressPct: number
  ghgTco2e: number
  waterKl: number
  safetyLtifr: number
  evidenceCount: number
  lastSubmissionDate: string
}

export interface ReportingTimelineModel {
  id: string
  level: 'SUBSIDIARY' | 'BUSINESS_UNIT' | 'PROJECT'
  targetId: string
  targetName: string
  subsidiaryName?: string
  buName?: string
  financialYear: string
  periodLabel: string
  startDate: string
  submissionDeadline: string
  status: ReportingStatus
  assignedBy: string
  notes?: string
}

export interface EvidenceDocumentModel {
  id: string
  name: string
  docType: 'INVOICE' | 'METER_READING' | 'CERTIFICATE' | 'WASTE_MANIFEST' | 'REGISTER' | 'TEST_REPORT'
  indicatorName: string
  brsrSection: string
  sourceProject: string
  sourceBu: string
  sourceSubsidiary: string
  reportedValue: string
  reportingPeriod: string
  fileSize: string
  uploadedBy: string
  uploadedAt: string
  verificationStatus: 'VERIFIED' | 'UNDER_AUDIT' | 'FLAGGED'
}

export interface UserActivityModel {
  id: string
  actorName: string
  actorRole: string
  actorEmail: string
  action: 'DATA_ENTRY' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EVIDENCE_UPLOAD' | 'TIMELINE_SET' | 'FACTOR_OVERRIDE'
  targetEntity: string
  details: string
  timestamp: string
  severity: 'NORMAL' | 'HIGHLIGHT' | 'WARNING'
}

export interface LiveSubmissionModel {
  id: string
  projectCode: string
  projectName: string
  buName: string
  subsidiaryName: string
  module: string
  submittedBy: string
  userEmail: string
  submittedAt: string
  status: ReportingStatus
  completionPct: number
  evidenceCount: number
  calculatedTco2e?: number
  reviewAssignee: string
}

// ============================================================================
// Centralized Realistic Mock Data
// ============================================================================

const SEEDED_SUBSIDIARIES: SubsidiaryModel[] = [
  {
    id: 'MEIL-INFRA',
    code: 'MEIL-INFRA',
    name: 'MEIL Infrastructure',
    legalName: 'MEIL Infra Ventures Ltd.',
    cin: 'U70102MH2011PLC654321',
    status: 'ACTIVE',
    buCount: 3,
    projectCount: 9,
    reportingStatus: 'UNDER_REVIEW',
    progressPct: 78,
    lastUpdated: '2026-05-18 14:30',
    statusSummary: { submitted: 4, pending: 3, overdue: 1, approved: 3, underReview: 2 }
  },
  {
    id: 'MEIL-POWER',
    code: 'MEIL-PWR',
    name: 'MEIL Power Systems',
    legalName: 'MEIL Power Systems Ltd.',
    cin: 'U40300MH2010PLC123456',
    status: 'ACTIVE',
    buCount: 2,
    projectCount: 6,
    reportingStatus: 'APPROVED',
    progressPct: 94,
    lastUpdated: '2026-05-19 11:15',
    statusSummary: { submitted: 4, pending: 1, overdue: 0, approved: 5, underReview: 1 }
  },
  {
    id: 'MEIL-HYDRO',
    code: 'MEIL-HC',
    name: 'MEIL Hydrocarbons & Energy',
    legalName: 'MEIL Hydrocarbons Ltd.',
    cin: 'U23200DL2012PLC987654',
    status: 'ACTIVE',
    buCount: 2,
    projectCount: 5,
    reportingStatus: 'SUBMITTED',
    progressPct: 86,
    lastUpdated: '2026-05-17 09:40',
    statusSummary: { submitted: 3, pending: 1, overdue: 0, approved: 3, underReview: 1 }
  },
  {
    id: 'MEIL-WATER',
    code: 'MEIL-WTR',
    name: 'MEIL Water & Natural Resources',
    legalName: 'MEIL Water Resources Ltd.',
    cin: 'U41000TG2014PLC789012',
    status: 'ACTIVE',
    buCount: 2,
    projectCount: 4,
    reportingStatus: 'IN_PROGRESS',
    progressPct: 62,
    lastUpdated: '2026-05-18 16:20',
    statusSummary: { submitted: 2, pending: 2, overdue: 1, approved: 1, underReview: 1 }
  }
]

const SEEDED_BUSINESS_UNITS: BusinessUnitModel[] = [
  {
    id: 'bu-transportation',
    subsidiaryId: 'MEIL-INFRA',
    subsidiaryName: 'MEIL Infrastructure',
    code: 'MEIL-TRANS',
    name: 'Transportation',
    sector: 'Highways, Expressways & Tunnels',
    reportingOwner: 'Er. R. Sharma',
    status: 'ACTIVE',
    projectCount: 3,
    reportingStatus: 'APPROVED',
    progressPct: 92,
    kpiHighlights: '492,000 tCO₂e Scope 1/2 · 14.8M Safe Man-Hours'
  },
  {
    id: 'bu-buildings',
    subsidiaryId: 'MEIL-INFRA',
    subsidiaryName: 'MEIL Infrastructure',
    code: 'MEIL-BLD',
    name: 'Commercial & Institutional Buildings',
    sector: 'Urban & Industrial Real Estate',
    reportingOwner: 'Er. M. Rao',
    status: 'ACTIVE',
    projectCount: 3,
    reportingStatus: 'UNDER_REVIEW',
    progressPct: 75,
    kpiHighlights: '82,400 MWh Grid Power · 84% Recycled Construction Waste'
  },
  {
    id: 'bu-renewables',
    subsidiaryId: 'MEIL-POWER',
    subsidiaryName: 'MEIL Power Systems',
    code: 'MEIL-REN',
    name: 'Solar & Renewable Energy Parks',
    sector: 'Clean Energy & Solar Power',
    reportingOwner: 'Dr. Anita Desai',
    status: 'ACTIVE',
    projectCount: 3,
    reportingStatus: 'APPROVED',
    progressPct: 98,
    kpiHighlights: '1.2 GW Clean Generation · Zero High-Hazard Incidents'
  },
  {
    id: 'bu-power',
    subsidiaryId: 'MEIL-POWER',
    subsidiaryName: 'MEIL Power Systems',
    code: 'MEIL-PWR-SYS',
    name: 'Thermal & Substation Power Systems',
    sector: 'Transmission & Grid Infrastructure',
    reportingOwner: 'Er. K. Venkat',
    status: 'ACTIVE',
    projectCount: 3,
    reportingStatus: 'SUBMITTED',
    progressPct: 88,
    kpiHighlights: '384,000 MWh Transmitted · SF6 Gas Leakage < 0.05%'
  },
  {
    id: 'bu-hydrocarbons',
    subsidiaryId: 'MEIL-HYDRO',
    subsidiaryName: 'MEIL Hydrocarbons & Energy',
    code: 'MEIL-HC-REF',
    name: 'Hydrocarbons & Refineries',
    sector: 'Oil & Gas Upstream/Downstream',
    reportingOwner: 'Er. Vikram Shah',
    status: 'ACTIVE',
    projectCount: 3,
    reportingStatus: 'SUBMITTED',
    progressPct: 84,
    kpiHighlights: 'Flare Gas Reduction -18% · ISO 14001 Assured'
  },
  {
    id: 'bu-irrigation',
    subsidiaryId: 'MEIL-WATER',
    subsidiaryName: 'MEIL Water & Natural Resources',
    code: 'MEIL-IRR',
    name: 'Lift Irrigation & Water Supply',
    sector: 'Hydraulic Structures & Irrigation',
    reportingOwner: 'Er. Rakesh Verma',
    status: 'ACTIVE',
    projectCount: 2,
    reportingStatus: 'OVERDUE',
    progressPct: 54,
    kpiHighlights: '2.4 TMC Water Pumped · 1 Overdue Project Filing'
  }
]

const SEEDED_PROJECTS: ProjectModel[] = [
  {
    id: 'trans-01',
    code: 'MEIL-TR-ZOJ',
    name: 'Zojila Strategic High-Altitude Tunnel',
    buId: 'bu-transportation',
    buName: 'Transportation',
    subsidiaryId: 'MEIL-INFRA',
    subsidiaryName: 'MEIL Infrastructure',
    location: 'Srinagar–Leh NH-1',
    state: 'Jammu & Kashmir',
    reportingOwner: 'Er. R. Sharma (Site Eng)',
    reportingStatus: 'APPROVED',
    submissionDeadline: '2026-05-10',
    progressPct: 100,
    ghgTco2e: 48.4,
    waterKl: 12400,
    safetyLtifr: 0.8,
    evidenceCount: 14,
    lastSubmissionDate: '2026-05-08'
  },
  {
    id: 'trans-02',
    code: 'MEIL-TR-DAK',
    name: 'Delhi–Amritsar–Katra Expressway Package 14',
    buId: 'bu-transportation',
    buName: 'Transportation',
    subsidiaryId: 'MEIL-INFRA',
    subsidiaryName: 'MEIL Infrastructure',
    location: 'Pathankot Corridor',
    state: 'Punjab',
    reportingOwner: 'Er. A. Kaul',
    reportingStatus: 'APPROVED',
    submissionDeadline: '2026-05-12',
    progressPct: 95,
    ghgTco2e: 94.2,
    waterKl: 18200,
    safetyLtifr: 1.1,
    evidenceCount: 12,
    lastSubmissionDate: '2026-05-11'
  },
  {
    id: 'ren-01',
    code: 'MEIL-SOL-GJT',
    name: 'Gayatri 500MW Ultra Mega Solar Plant',
    buId: 'bu-renewables',
    buName: 'Solar & Renewable Energy Parks',
    subsidiaryId: 'MEIL-POWER',
    subsidiaryName: 'MEIL Power Systems',
    location: 'Gayatri, Mahbubnagar',
    state: 'Telangana',
    reportingOwner: 'Rohit Kumar (Env Data User)',
    reportingStatus: 'APPROVED',
    submissionDeadline: '2026-05-15',
    progressPct: 100,
    ghgTco2e: 18.2,
    waterKl: 3200,
    safetyLtifr: 0.0,
    evidenceCount: 16,
    lastSubmissionDate: '2026-05-14'
  },
  {
    id: 'pwr-01',
    code: 'MEIL-TD-HYD',
    name: 'Hyderabad 400/220kV Gas-Insulated Substation',
    buId: 'bu-power',
    buName: 'Thermal & Substation Power Systems',
    subsidiaryId: 'MEIL-POWER',
    subsidiaryName: 'MEIL Power Systems',
    location: 'Gachibowli Substation',
    state: 'Telangana',
    reportingOwner: 'P. Srinivas',
    reportingStatus: 'UNDER_REVIEW',
    submissionDeadline: '2026-05-18',
    progressPct: 82,
    ghgTco2e: 122.5,
    waterKl: 4100,
    safetyLtifr: 0.0,
    evidenceCount: 9,
    lastSubmissionDate: '2026-05-17'
  },
  {
    id: 'irr-01',
    code: 'MEIL-WTR-KPR',
    name: 'Kaleshwaram Lift Irrigation Package 08',
    buId: 'bu-irrigation',
    buName: 'Lift Irrigation & Water Supply',
    subsidiaryId: 'MEIL-WATER',
    subsidiaryName: 'MEIL Water & Natural Resources',
    location: 'Medigadda Barrage',
    state: 'Telangana',
    reportingOwner: 'K. Venkat (EHS User)',
    reportingStatus: 'OVERDUE',
    submissionDeadline: '2026-05-05',
    progressPct: 48,
    ghgTco2e: 215.8,
    waterKl: 98000,
    safetyLtifr: 1.4,
    evidenceCount: 5,
    lastSubmissionDate: '2026-04-28'
  },
  {
    id: 'hc-01',
    code: 'MEIL-HC-BAR',
    name: 'Barmer Crude Oil Pipeline Terminal',
    buId: 'bu-hydrocarbons',
    buName: 'Hydrocarbons & Refineries',
    subsidiaryId: 'MEIL-HYDRO',
    subsidiaryName: 'MEIL Hydrocarbons & Energy',
    location: 'Barmer Basin',
    state: 'Rajasthan',
    reportingOwner: 'Sunita Rao (HR & Site)',
    reportingStatus: 'SUBMITTED',
    submissionDeadline: '2026-05-20',
    progressPct: 90,
    ghgTco2e: 164.2,
    waterKl: 14500,
    safetyLtifr: 0.5,
    evidenceCount: 11,
    lastSubmissionDate: '2026-05-19'
  }
]

const SEEDED_TIMELINES: ReportingTimelineModel[] = [
  {
    id: 'tl-sub-01',
    level: 'SUBSIDIARY',
    targetId: 'MEIL-INFRA',
    targetName: 'MEIL Infrastructure',
    subsidiaryName: 'MEIL Infrastructure',
    financialYear: 'FY 2026-27',
    periodLabel: 'Q1 (April–June 2026)',
    startDate: '2026-04-01',
    submissionDeadline: '2026-06-15',
    status: 'IN_PROGRESS',
    assignedBy: 'Arjun Mehta (Group Admin)',
    notes: 'Consolidated infrastructure BRSR Core indicators submission.'
  },
  {
    id: 'tl-bu-01',
    level: 'BUSINESS_UNIT',
    targetId: 'bu-transportation',
    targetName: 'Transportation Business Unit',
    subsidiaryName: 'MEIL Infrastructure',
    buName: 'Transportation',
    financialYear: 'FY 2026-27',
    periodLabel: 'April 2026',
    startDate: '2026-04-01',
    submissionDeadline: '2026-05-15',
    status: 'APPROVED',
    assignedBy: 'Arjun Mehta (Group Admin)',
    notes: 'Includes Scope 1 heavy machinery diesel and road aggregate hauling.'
  },
  {
    id: 'tl-proj-01',
    level: 'PROJECT',
    targetId: 'trans-01',
    targetName: 'Zojila Strategic Tunnel',
    subsidiaryName: 'MEIL Infrastructure',
    buName: 'Transportation',
    financialYear: 'FY 2026-27',
    periodLabel: 'April 2026',
    startDate: '2026-04-01',
    submissionDeadline: '2026-05-10',
    status: 'APPROVED',
    assignedBy: 'Arjun Mehta (Group Admin)',
    notes: 'High-altitude cold environment safety and DG run logbooks verified.'
  },
  {
    id: 'tl-proj-02',
    level: 'PROJECT',
    targetId: 'irr-01',
    targetName: 'Kaleshwaram Lift Irrigation Package 08',
    subsidiaryName: 'MEIL Water & Natural Resources',
    buName: 'Lift Irrigation & Water Supply',
    financialYear: 'FY 2026-27',
    periodLabel: 'April 2026',
    startDate: '2026-04-01',
    submissionDeadline: '2026-05-05',
    status: 'OVERDUE',
    assignedBy: 'Arjun Mehta (Group Admin)',
    notes: 'Urgent: Water pump station power invoices pending validation.'
  }
]

const SEEDED_EVIDENCE_DOCS: EvidenceDocumentModel[] = [
  {
    id: 'ev-01',
    name: 'TSSPDCL_April2026_HighTension_Invoice.pdf',
    docType: 'INVOICE',
    indicatorName: 'Scope 2 Electricity Purchased (Grid)',
    brsrSection: 'Principle 6 — Environment (Essential Indicator 1)',
    sourceProject: 'Gayatri 500MW Ultra Mega Solar Plant',
    sourceBu: 'Solar & Renewable Energy Parks',
    sourceSubsidiary: 'MEIL Power Systems',
    reportedValue: '384,000 kWh',
    reportingPeriod: 'April 2026',
    fileSize: '3.4 MB',
    uploadedBy: 'Rohit Kumar (rohit@meil-esg.in)',
    uploadedAt: '2026-05-04 11:20',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'ev-02',
    name: 'IOCL_Bulk_Diesel_Procurement_Receipts_M1.pdf',
    docType: 'INVOICE',
    indicatorName: 'Scope 1 Mobile Combustion (HSD Diesel)',
    brsrSection: 'Principle 6 — Environment (Essential Indicator 2)',
    sourceProject: 'Zojila Strategic High-Altitude Tunnel',
    sourceBu: 'Transportation',
    sourceSubsidiary: 'MEIL Infrastructure',
    reportedValue: '18,650 Litres',
    reportingPeriod: 'April 2026',
    fileSize: '2.8 MB',
    uploadedBy: 'Er. R. Sharma (admin.zojila@meil-esg.in)',
    uploadedAt: '2026-05-06 14:45',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'ev-03',
    name: 'NABL_Ambient_Air_Quality_CPCB_Stack_Report.pdf',
    docType: 'TEST_REPORT',
    indicatorName: 'Air Quality & Stack Emission (PM10 / PM2.5 / NOx)',
    brsrSection: 'Principle 6 — Environment (Air Quality)',
    sourceProject: 'Gayatri 500MW Ultra Mega Solar Plant',
    sourceBu: 'Solar & Renewable Energy Parks',
    sourceSubsidiary: 'MEIL Power Systems',
    reportedValue: '48.2 µg/m³ (CPCB NAAQS Compliant)',
    reportingPeriod: 'April 2026',
    fileSize: '4.6 MB',
    uploadedBy: 'Rohit Kumar (rohit@meil-esg.in)',
    uploadedAt: '2026-05-07 10:15',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'ev-04',
    name: 'ZLD_Effluent_Water_Flow_Meter_Log.xlsx',
    docType: 'METER_READING',
    indicatorName: 'Water Withdrawal, Consumption & Recycled',
    brsrSection: 'Principle 6 — Environment (Water Disclosures)',
    sourceProject: 'Barmer Crude Oil Pipeline Terminal',
    sourceBu: 'Hydrocarbons & Refineries',
    sourceSubsidiary: 'MEIL Hydrocarbons & Energy',
    reportedValue: '14,500 KL (82% Recycled)',
    reportingPeriod: 'April 2026',
    fileSize: '1.9 MB',
    uploadedBy: 'Sunita Rao (sunita@meil-esg.in)',
    uploadedAt: '2026-05-09 16:30',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'ev-05',
    name: 'Occupational_Health_Safety_Audit_Register.pdf',
    docType: 'REGISTER',
    indicatorName: 'Lost Time Incident Frequency Rate (LTIFR)',
    brsrSection: 'Principle 3 — Employee Wellbeing & Safety',
    sourceProject: 'Zojila Strategic High-Altitude Tunnel',
    sourceBu: 'Transportation',
    sourceSubsidiary: 'MEIL Infrastructure',
    reportedValue: '0 Fatalities / 0.8 LTIFR',
    reportingPeriod: 'April 2026',
    fileSize: '5.1 MB',
    uploadedBy: 'K. Venkat (kvenkat@meil-esg.in)',
    uploadedAt: '2026-05-10 09:12',
    verificationStatus: 'VERIFIED'
  }
]

const SEEDED_USER_ACTIVITIES: UserActivityModel[] = [
  {
    id: 'act-01',
    actorName: 'Rohit Kumar',
    actorRole: 'Environment Data User',
    actorEmail: 'rohit@meil-esg.in',
    action: 'SUBMITTED',
    targetEntity: 'Gayatri Solar (MEIL-SOL-GJT)',
    details: 'Submitted Level 3 consolidated GHG & Ambient Air report (384k kWh + 18.6k L diesel).',
    timestamp: '10 mins ago',
    severity: 'NORMAL'
  },
  {
    id: 'act-02',
    actorName: 'Rakesh Verma',
    actorRole: 'BU Reviewer',
    actorEmail: 'rakesh@meil-esg.in',
    action: 'APPROVED',
    targetEntity: 'Power Generation BU',
    details: 'Approved Scope 1 & 2 calculations with CEA Baseline DB v19 factor verification.',
    timestamp: '32 mins ago',
    severity: 'NORMAL'
  },
  {
    id: 'act-03',
    actorName: 'K. Venkat',
    actorRole: 'EHS / Safety User',
    actorEmail: 'kvenkat@meil-esg.in',
    action: 'EVIDENCE_UPLOAD',
    targetEntity: 'Zojila Tunnel Project',
    details: 'Attached NABL certified ambient air quality and heavy equipment diesel invoices.',
    timestamp: '1 hour ago',
    severity: 'NORMAL'
  },
  {
    id: 'act-04',
    actorName: 'Arjun Mehta',
    actorRole: 'Group Admin',
    actorEmail: 'admin@meil-esg.in',
    action: 'TIMELINE_SET',
    targetEntity: 'Kaleshwaram Lift Irrigation',
    details: 'Assigned 7-day reporting extension with formal escalation flag.',
    timestamp: '2 hours ago',
    severity: 'HIGHLIGHT'
  },
  {
    id: 'act-05',
    actorName: 'Sunita Rao',
    actorRole: 'HR User',
    actorEmail: 'sunita@meil-esg.in',
    action: 'DATA_ENTRY',
    targetEntity: 'Barmer Crude Oil Terminal',
    details: 'Updated permanent and contract workforce count (1,480 workers, 100% covered by ESI).',
    timestamp: '3 hours ago',
    severity: 'NORMAL'
  }
]

const SEEDED_LIVE_SUBMISSIONS: LiveSubmissionModel[] = [
  {
    id: 'sub-rev-01',
    projectCode: 'MEIL-SOL-GJT',
    projectName: 'Gayatri 500MW Ultra Mega Solar Plant',
    buName: 'Solar & Renewable Energy Parks',
    subsidiaryName: 'MEIL Power Systems',
    module: 'GHG Emissions & Energy (Scope 1, 2, 3)',
    submittedBy: 'Rohit Kumar',
    userEmail: 'rohit@meil-esg.in',
    submittedAt: '2026-05-18 10:45',
    status: 'APPROVED',
    completionPct: 100,
    evidenceCount: 4,
    calculatedTco2e: 324.12,
    reviewAssignee: 'Vikram Shah (Group Reviewer)'
  },
  {
    id: 'sub-rev-02',
    projectCode: 'MEIL-TR-ZOJ',
    projectName: 'Zojila Strategic Tunnel',
    buName: 'Transportation',
    subsidiaryName: 'MEIL Infrastructure',
    module: 'Energy Consumption & Heavy Plant Diesel',
    submittedBy: 'Er. R. Sharma',
    userEmail: 'admin.zojila@meil-esg.in',
    submittedAt: '2026-05-17 16:30',
    status: 'APPROVED',
    completionPct: 100,
    evidenceCount: 5,
    calculatedTco2e: 49.18,
    reviewAssignee: 'Rakesh Verma (BU Reviewer)'
  },
  {
    id: 'sub-rev-03',
    projectCode: 'MEIL-TD-HYD',
    projectName: 'Hyderabad 400/220kV GIS Substation',
    buName: 'Thermal & Substation Power Systems',
    subsidiaryName: 'MEIL Power Systems',
    module: 'Substation SF6 & Transmission Electricity',
    submittedBy: 'P. Srinivas',
    userEmail: 'srinivas.p@meil-esg.in',
    submittedAt: '2026-05-18 14:10',
    status: 'UNDER_REVIEW',
    completionPct: 88,
    evidenceCount: 3,
    calculatedTco2e: 122.5,
    reviewAssignee: 'Nisha Pillai (Subsidiary Rev.)'
  },
  {
    id: 'sub-rev-04',
    projectCode: 'MEIL-WTR-KPR',
    projectName: 'Kaleshwaram Lift Irrigation Package 08',
    buName: 'Lift Irrigation & Water Supply',
    subsidiaryName: 'MEIL Water & Natural Resources',
    module: 'Water Withdrawal & Pumping Energy',
    submittedBy: 'K. Venkat',
    userEmail: 'kvenkat@meil-esg.in',
    submittedAt: '2026-05-02 11:00',
    status: 'OVERDUE',
    completionPct: 45,
    evidenceCount: 1,
    calculatedTco2e: 215.8,
    reviewAssignee: 'Rakesh Verma (BU Reviewer)'
  }
]

const SEEDED_ARCHIVE_YEARS = [
  {
    year: 'FY 2025-26',
    title: 'MEIL Group Integrated BRSR & Sustainability Assurance Report FY 2025-26',
    publishedDate: '2026-04-18',
    assurancePartner: 'KPMG India LLP (Reasonable & Limited Assurance)',
    fileSize: '16.4 MB',
    coverage: '100% Core Indian Entities & Operating BUs',
    totalGhg: '1.42M tCO₂e',
    renewableShare: '38.4%',
    evidencePacks: 12,
    status: 'OFFICIALLY_AUDITED'
  },
  {
    year: 'FY 2024-25',
    title: 'MEIL Annual BRSR Regulatory Submission FY 2024-25',
    publishedDate: '2025-04-20',
    assurancePartner: 'Ernst & Young LLP (Limited Assurance)',
    fileSize: '14.1 MB',
    coverage: 'Top 1,000 Listed SEBI Mandated Format',
    totalGhg: '1.38M tCO₂e',
    renewableShare: '32.1%',
    evidencePacks: 10,
    status: 'OFFICIALLY_AUDITED'
  },
  {
    year: 'FY 2023-24',
    title: 'MEIL Inaugural BRSR & ESG Milestone Report FY 2023-24',
    publishedDate: '2024-04-25',
    assurancePartner: 'Internal ESG Assurance Board',
    fileSize: '11.8 MB',
    coverage: 'Baseline ESG Inventory & Material Disclosures',
    totalGhg: '1.29M tCO₂e',
    renewableShare: '26.8%',
    evidencePacks: 8,
    status: 'OFFICIALLY_AUDITED'
  }
]

// ============================================================================
// Main Component
// ============================================================================

export function GroupAdminDashboard() {
  const { setActiveModule } = useApp()

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'hierarchy' | 'timelines' | 'subsidiaries' | 'bus' | 'projects' | 'evidence' | 'users_submissions' | 'archive'
  >('overview')

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [yearFilter, setYearFilter] = useState<string>('FY 2026-27')

  // Drill-down selection states
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [selectedBuId, setSelectedBuId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectModel | null>(null)

  // Timeline edit modal state
  const [timelines, setTimelines] = useState<ReportingTimelineModel[]>(SEEDED_TIMELINES)
  const [editingTimeline, setEditingTimeline] = useState<ReportingTimelineModel | null>(null)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [timelineSuccessMsg, setTimelineSuccessMsg] = useState('')

  // Evidence Viewer drawer / modal state
  const [evidenceList, setEvidenceList] = useState<EvidenceDocumentModel[]>(SEEDED_EVIDENCE_DOCS)
  const [activeEvidence, setActiveEvidence] = useState<EvidenceDocumentModel | null>(null)
  const [showEvidenceViewer, setShowEvidenceViewer] = useState(false)
  const [evidenceIndicatorFilter, setEvidenceIndicatorFilter] = useState<string>('ALL')

  // Report Preview Modal state
  const [previewReport, setPreviewReport] = useState<{
    title: string
    entity: string
    level: string
    period: string
    metrics: { label: string; value: string; unit: string }[]
    summary: string
    status: string
  } | null>(null)

  // Feedback Toast for actions
  const [actionToast, setActionToast] = useState<{ title: string; message: string } | null>(null)

  const showToast = (title: string, message: string) => {
    setActionToast({ title, message })
    setTimeout(() => setActionToast(null), 4500)
  }

  // Summary Metrics
  const totalSubsidiaries = SEEDED_SUBSIDIARIES.length
  const totalBUs = SEEDED_BUSINESS_UNITS.length
  const totalProjects = SEEDED_PROJECTS.length

  const countSubmitted = SEEDED_PROJECTS.filter(p => p.reportingStatus === 'SUBMITTED' || p.reportingStatus === 'APPROVED').length
  const countPending = SEEDED_PROJECTS.filter(p => p.reportingStatus === 'IN_PROGRESS' || p.reportingStatus === 'UNDER_REVIEW' || p.reportingStatus === 'NOT_STARTED').length
  const countOverdue = SEEDED_PROJECTS.filter(p => p.reportingStatus === 'OVERDUE' || p.reportingStatus === 'REJECTED').length

  // Quick navigation from summary cards
  const handleSummaryCardClick = (targetTab: typeof activeTab, filter?: string) => {
    if (filter) setStatusFilter(filter)
    setActiveTab(targetTab)
  }

  // Timeline Save Handler
  const handleSaveTimeline = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTimeline) return

    setTimelines(prev => {
      const idx = prev.findIndex(t => t.id === editingTimeline.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = editingTimeline
        return updated
      }
      return [editingTimeline, ...prev]
    })

    setShowTimelineModal(false)
    setEditingTimeline(null)
    showToast('Timeline Updated', `Reporting deadline for ${editingTimeline.targetName} saved successfully.`)
  }

  // Status Badge Pill Renderer
  const renderStatusBadge = (status: ReportingStatus | string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        )
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-700 border border-indigo-500/25">
            <Send className="h-3 w-3" /> Submitted
          </span>
        )
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-700 border border-sky-500/25">
            <Clock className="h-3 w-3" /> Under Review
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-500/25">
            <Activity className="h-3 w-3" /> In Progress
          </span>
        )
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-500/25">
            <AlertTriangle className="h-3 w-3" /> Overdue
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-700 border border-red-500/25">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-500/25">
            <Clock className="h-3 w-3" /> Not Started
          </span>
        )
    }
  }

  // Filtered list helpers
  const filteredProjects = useMemo(() => {
    return SEEDED_PROJECTS.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.subsidiaryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.buName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === 'ALL' || p.reportingStatus === statusFilter
      const matchSub = !selectedSubId || p.subsidiaryId === selectedSubId
      const matchBu = !selectedBuId || p.buId === selectedBuId
      return matchSearch && matchStatus && matchSub && matchBu
    })
  }, [searchQuery, statusFilter, selectedSubId, selectedBuId])

  const filteredEvidence = useMemo(() => {
    return evidenceList.filter(ev => {
      const matchInd = evidenceIndicatorFilter === 'ALL' || ev.indicatorName.toLowerCase().includes(evidenceIndicatorFilter.toLowerCase())
      const matchSub = !selectedSubId || ev.sourceSubsidiary.toLowerCase().includes(selectedSubId.toLowerCase())
      return matchInd
    })
  }, [evidenceList, evidenceIndicatorFilter, selectedSubId])

  return (
    <div className="space-y-6 pb-12">
      {/* ==================================================================== */}
      {/* 1. EXECUTIVE LIQUID GLASS BANNER & CONTROL PLANE */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-2xl border border-white/10">
        {/* Subtle glass reflection & ambient soft glows */}
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-slate-800 text-indigo-300 border border-indigo-400/30 shadow-inner">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Group Admin Workspace</h1>
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
                    Executive Control
                  </span>
                </div>
                <p className="text-xs text-slate-300 md:text-sm">
                  MEIL Group-wide ESG reporting, organizational oversight, timeline governance, and consolidated reports
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                showToast(
                  'Consolidated Evidence Pack Generated',
                  'Assembled official multi-tier MEIL Group ESG Evidence ZIP archive with 48 verified audit documents.'
                )
              }}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-xl border border-white/15 hover:bg-white/15 hover:border-white/25 transition shadow-lg"
            >
              <FileBox className="h-4 w-4 text-indigo-300" />
              <span>Generate Group Evidence Pack</span>
            </button>

            <button
              onClick={() => {
                setEditingTimeline({
                  id: `tl-custom-${Date.now()}`,
                  level: 'SUBSIDIARY',
                  targetId: SEEDED_SUBSIDIARIES[0].id,
                  targetName: SEEDED_SUBSIDIARIES[0].name,
                  financialYear: 'FY 2026-27',
                  periodLabel: 'Q1 (April–June 2026)',
                  startDate: '2026-04-01',
                  submissionDeadline: '2026-06-30',
                  status: 'IN_PROGRESS',
                  assignedBy: 'Arjun Mehta (Group Admin)',
                  notes: 'Group executive mandate deadline.'
                })
                setShowTimelineModal(true)
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-500 hover:to-indigo-700 transition"
            >
              <Calendar className="h-4 w-4" />
              <span>Set Reporting Timeline</span>
            </button>

            <button
              onClick={() => setActiveModule('admin')}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition border border-slate-700"
              title="System RBAC & Master Settings"
            >
              <Settings2 className="h-4 w-4" />
              <span>System Settings</span>
            </button>
          </div>
        </div>

        {/* Dynamic Action Toast Banner */}
        <AnimatePresence>
          {actionToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 flex items-center justify-between rounded-xl bg-emerald-950/80 p-3.5 text-xs text-emerald-200 border border-emerald-500/30 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <strong className="font-bold text-white mr-1.5">{actionToast.title}:</strong>
                  {actionToast.message}
                </div>
              </div>
              <button onClick={() => setActionToast(null)} className="text-emerald-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ==================================================================== */}
      {/* 2. SUMMARY METRIC CARDS (INTERACTIVE & CLICKABLE) */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Subsidiaries */}
        <div
          onClick={() => handleSummaryCardClick('subsidiaries')}
          className="group cursor-pointer rounded-2xl bg-white/70 p-4 backdrop-blur-xl border border-white/80 shadow-md shadow-slate-200/50 hover:border-indigo-400/60 hover:shadow-indigo-500/10 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Subsidiaries</span>
            <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-700 group-hover:scale-110 transition">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalSubsidiaries}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            <span>4 Active Legal Entities</span>
          </div>
        </div>

        {/* Total Business Units */}
        <div
          onClick={() => handleSummaryCardClick('bus')}
          className="group cursor-pointer rounded-2xl bg-white/70 p-4 backdrop-blur-xl border border-white/80 shadow-md shadow-slate-200/50 hover:border-indigo-400/60 hover:shadow-indigo-500/10 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Business Units</span>
            <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-700 group-hover:scale-110 transition">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalBUs}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <span>Operating Sectors</span>
          </div>
        </div>

        {/* Total Projects */}
        <div
          onClick={() => handleSummaryCardClick('projects', 'ALL')}
          className="group cursor-pointer rounded-2xl bg-white/70 p-4 backdrop-blur-xl border border-white/80 shadow-md shadow-slate-200/50 hover:border-indigo-400/60 hover:shadow-indigo-500/10 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Projects</span>
            <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-700 group-hover:scale-110 transition">
              <FolderTree className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalProjects}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <span>Core Reporting Sites</span>
          </div>
        </div>

        {/* Reports Submitted */}
        <div
          onClick={() => handleSummaryCardClick('projects', 'SUBMITTED')}
          className="group cursor-pointer rounded-2xl bg-white/70 p-4 backdrop-blur-xl border border-white/80 shadow-md shadow-slate-200/50 hover:border-emerald-400/60 hover:shadow-emerald-500/10 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Submitted</span>
            <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 group-hover:scale-110 transition">
              <Send className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{countSubmitted}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <span>Ready / Approved</span>
          </div>
        </div>

        {/* Reports Pending */}
        <div
          onClick={() => handleSummaryCardClick('projects', 'IN_PROGRESS')}
          className="group cursor-pointer rounded-2xl bg-white/70 p-4 backdrop-blur-xl border border-white/80 shadow-md shadow-slate-200/50 hover:border-sky-400/60 hover:shadow-sky-500/10 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Pending</span>
            <span className="rounded-lg bg-sky-50 p-1.5 text-sky-700 group-hover:scale-110 transition">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{countPending}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sky-700">
            <span>In Review / Progress</span>
          </div>
        </div>

        {/* Reports Overdue */}
        <div
          onClick={() => handleSummaryCardClick('projects', 'OVERDUE')}
          className="group cursor-pointer rounded-2xl bg-white/70 p-4 backdrop-blur-xl border border-white/80 shadow-md shadow-slate-200/50 hover:border-rose-400/60 hover:shadow-rose-500/10 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Overdue</span>
            <span className="rounded-lg bg-rose-50 p-1.5 text-rose-700 group-hover:scale-110 transition">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{countOverdue}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
            <span>Requires Action</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. WORKSPACE NAVIGATION TABS (IOS LIQUID GLASS STYLE) */}
      {/* ==================================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-white/60 p-1.5 backdrop-blur-xl border border-white/80 shadow-xs scroll-elegant">
        {[
          { key: 'overview', label: 'Group Overview', icon: BarChart3 },
          { key: 'hierarchy', label: 'Org Hierarchy', icon: FolderTree },
          { key: 'timelines', label: 'Timelines & Deadlines', icon: Calendar },
          { key: 'subsidiaries', label: 'Subsidiary Reports', icon: Building2 },
          { key: 'bus', label: 'Business Unit Reports', icon: Layers },
          { key: 'projects', label: 'Project Reports & Data', icon: FileText },
          { key: 'evidence', label: 'Evidence Repository', icon: Package },
          { key: 'users_submissions', label: 'Users & Submissions Feed', icon: Users },
          { key: 'archive', label: 'Historical BRSR Archive', icon: Archive }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ==================================================================== */}
      {/* 4. ACTIVE TAB CONTENT PANELS */}
      {/* ==================================================================== */}
      <AnimatePresence mode="wait">
        {/* --- TAB A: GROUP OVERVIEW --- */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Subsidiary Status Rollup (7 cols) */}
              <div className="lg:col-span-7 rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Subsidiary Reporting Readiness</h3>
                    <p className="text-xs text-slate-500">Live reporting status and submission completion across subsidiaries</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('subsidiaries')}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-3.5">
                  {SEEDED_SUBSIDIARIES.map(sub => (
                    <div
                      key={sub.id}
                      className="rounded-2xl bg-white/70 p-4 border border-white/90 shadow-xs hover:border-indigo-400/40 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{sub.name}</h4>
                            <span className="text-[10px] font-mono text-slate-400">{sub.code}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">CIN: {sub.cin} · {sub.buCount} Business Units · {sub.projectCount} Projects</span>
                        </div>
                        {renderStatusBadge(sub.reportingStatus)}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                          <span>Reporting Readiness</span>
                          <span>{sub.progressPct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-800 transition-all duration-500"
                            style={{ width: `${sub.progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-slate-100/80 text-xs">
                        <span className="text-[11px] text-slate-400">Last Synced: {sub.lastUpdated}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedSubId(sub.id)
                              setActiveTab('hierarchy')
                            }}
                            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Drill Down
                          </button>
                          <button
                            onClick={() => {
                              setPreviewReport({
                                title: `Consolidated ESG Report — ${sub.name}`,
                                entity: sub.name,
                                level: 'Subsidiary Level',
                                period: 'FY 2026-27 (Q1)',
                                metrics: [
                                  { label: 'Scope 1 Emissions', value: '492.4', unit: 'tCO₂e' },
                                  { label: 'Scope 2 Purchased Grid', value: '1,280.0', unit: 'tCO₂e' },
                                  { label: 'Total Water Withdrawal', value: '124,500', unit: 'KL' },
                                  { label: 'Lost Time Incident Rate', value: '0.6', unit: 'LTIFR' }
                                ],
                                summary: `Consolidated sustainability performance for ${sub.legalName} covering ${sub.buCount} operational business units and ${sub.projectCount} sites. Fully validated per SEBI BRSR guidelines.`,
                                status: sub.reportingStatus
                              })
                            }}
                            className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 transition"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Live Activities & Quick Controls (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Recent Activity Feed */}
                <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-700" />
                      <h3 className="text-base font-bold text-slate-900">Live Group Activities</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('users_submissions')}
                      className="text-xs font-bold text-indigo-700 hover:underline"
                    >
                      Audit Trail
                    </button>
                  </div>

                  <div className="space-y-3">
                    {SEEDED_USER_ACTIVITIES.slice(0, 4).map(act => (
                      <div key={act.id} className="flex gap-3 rounded-2xl bg-white/60 p-3.5 border border-white/80 text-xs shadow-2xs">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 border border-indigo-200/50">
                          {act.actorName.charAt(0)}
                        </div>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between">
                            <strong className="text-slate-900 font-bold">{act.actorName}</strong>
                            <span className="text-[10px] text-slate-400">{act.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{act.details}</p>
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                            {act.targetEntity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Governance Links */}
                <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white shadow-xl space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-indigo-400" />
                    <span>Group Admin Governance Directives</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    SEBI BRSR Core assurance window for FY 2026-27 Q1 is active. Ensure all Lift Irrigation and Transport packages complete verification by scheduled deadlines.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('timelines')}
                      className="w-full rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition text-center border border-white/10"
                    >
                      Review All Deadlines & Timelines
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB B: ORGANIZATION HIERARCHY DRILL-DOWN --- */}
        {activeTab === 'hierarchy' && (
          <motion.div
            key="hierarchy"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              {/* Header & Breadcrumb */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Organizational Hierarchy & Multi-Tier Drill-Down</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="font-bold text-slate-800">MEIL Group</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    <span className={selectedSubId ? 'text-indigo-700 font-bold' : 'text-slate-400'}>
                      {selectedSubId ? SEEDED_SUBSIDIARIES.find(s => s.id === selectedSubId)?.name : 'Select Subsidiary'}
                    </span>
                    {selectedBuId && (
                      <>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-indigo-700 font-bold">
                          {SEEDED_BUSINESS_UNITS.find(b => b.id === selectedBuId)?.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {(selectedSubId || selectedBuId) && (
                  <button
                    onClick={() => {
                      setSelectedSubId(null)
                      setSelectedBuId(null)
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reset Drill-Down</span>
                  </button>
                )}
              </div>

              {/* Complete Hierarchy Tree */}
              <div className="space-y-5">
                {SEEDED_SUBSIDIARIES.map(sub => {
                  const subBUs = SEEDED_BUSINESS_UNITS.filter(bu => bu.subsidiaryId === sub.id)
                  const isSubOpen = !selectedSubId || selectedSubId === sub.id

                  return (
                    <div
                      key={sub.id}
                      className={`rounded-2xl bg-white/70 p-5 border transition-all ${
                        selectedSubId === sub.id
                          ? 'border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20'
                          : 'border-white/90 shadow-xs'
                      }`}
                    >
                      {/* Tier 1: Subsidiary Level Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                            <Building2 className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">{sub.name}</h4>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">{sub.code}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">Legal: {sub.legalName} · CIN: {sub.cin}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {renderStatusBadge(sub.reportingStatus)}
                          <button
                            onClick={() => setSelectedSubId(selectedSubId === sub.id ? null : sub.id)}
                            className="rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            {selectedSubId === sub.id ? 'Collapse BUs' : 'Explore BUs'}
                          </button>
                        </div>
                      </div>

                      {/* Tier 2: Business Units */}
                      {isSubOpen && (
                        <div className="mt-4 pl-3 sm:pl-6 space-y-4 border-l-2 border-indigo-100">
                          {subBUs.map(bu => {
                            const buProjects = SEEDED_PROJECTS.filter(p => p.buId === bu.id)
                            const isBuOpen = !selectedBuId || selectedBuId === bu.id

                            return (
                              <div
                                key={bu.id}
                                className={`rounded-xl bg-slate-50/80 p-4 border transition ${
                                  selectedBuId === bu.id ? 'border-indigo-400 bg-white' : 'border-slate-200/60'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/50 pb-2.5">
                                  <div className="flex items-center gap-2.5">
                                    <Layers className="h-4 w-4 text-indigo-700" />
                                    <div>
                                      <span className="text-xs font-bold text-slate-900">{bu.name}</span>
                                      <span className="ml-2 rounded bg-indigo-100/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                                        {bu.sector}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {renderStatusBadge(bu.reportingStatus)}
                                    <button
                                      onClick={() => setSelectedBuId(selectedBuId === bu.id ? null : bu.id)}
                                      className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
                                    >
                                      {selectedBuId === bu.id ? 'Hide Projects' : `Projects (${buProjects.length})`}
                                    </button>
                                  </div>
                                </div>

                                {/* Tier 3: Projects under selected BU */}
                                {isBuOpen && (
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {buProjects.map(proj => (
                                      <div
                                        key={proj.id}
                                        className="rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs space-y-2 hover:border-indigo-400 transition"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <h5 className="text-xs font-bold text-slate-900">{proj.name}</h5>
                                            <span className="text-[10px] text-slate-500">{proj.location} · {proj.code}</span>
                                          </div>
                                          {renderStatusBadge(proj.reportingStatus)}
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                                          <span>Deadline: <strong className="text-slate-800">{proj.submissionDeadline}</strong></span>
                                          <span>Evidence: <strong className="text-indigo-700">{proj.evidenceCount} Files</strong></span>
                                        </div>

                                        <div className="flex items-center justify-end gap-1.5 pt-1">
                                          <button
                                            onClick={() => {
                                              setPreviewReport({
                                                title: `Project Audit Report — ${proj.name}`,
                                                entity: proj.name,
                                                level: 'Project Level',
                                                period: 'April 2026',
                                                metrics: [
                                                  { label: 'Scope 1 & 2 GHG', value: String(proj.ghgTco2e), unit: 'tCO₂e' },
                                                  { label: 'Water Withdrawal', value: String(proj.waterKl), unit: 'KL' },
                                                  { label: 'Safety Index', value: String(proj.safetyLtifr), unit: 'LTIFR' },
                                                  { label: 'Attached Evidence', value: String(proj.evidenceCount), unit: 'Verified Docs' }
                                                ],
                                                summary: `Environmental, Social and Safety metrics logged for ${proj.name} (${proj.location}). Data owner: ${proj.reportingOwner}. Verified in conformity with SEBI BRSR Core assurance standards.`,
                                                status: proj.reportingStatus
                                              })
                                            }}
                                            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1"
                                          >
                                            <Eye className="h-3 w-3" /> Report
                                          </button>
                                          <button
                                            onClick={() => {
                                              setActiveEvidence(evidenceList[0])
                                              setShowEvidenceViewer(true)
                                            }}
                                            className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 transition flex items-center gap-1"
                                          >
                                            <Package className="h-3 w-3" /> Evidence
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB C: REPORTING TIMELINE MANAGEMENT --- */}
        {activeTab === 'timelines' && (
          <motion.div
            key="timelines"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reporting Timeline & Deadline Governance</h3>
                  <p className="text-xs text-slate-500">
                    Assign, schedule, and enforce reporting periods and submission deadlines at Subsidiary, BU, and Project tiers.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingTimeline({
                      id: `tl-${Date.now()}`,
                      level: 'PROJECT',
                      targetId: SEEDED_PROJECTS[0].id,
                      targetName: SEEDED_PROJECTS[0].name,
                      subsidiaryName: SEEDED_PROJECTS[0].subsidiaryName,
                      buName: SEEDED_PROJECTS[0].buName,
                      financialYear: 'FY 2026-27',
                      periodLabel: 'May 2026',
                      startDate: '2026-05-01',
                      submissionDeadline: '2026-06-15',
                      status: 'IN_PROGRESS',
                      assignedBy: 'Arjun Mehta (Group Admin)',
                      notes: 'Assigned via Group Admin Control Plane.'
                    })
                    setShowTimelineModal(true)
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <Calendar className="h-4 w-4" />
                  <span>+ Assign New Timeline</span>
                </button>
              </div>

              {/* Timelines Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/50">
                      <th className="py-3 px-3 font-bold">Tier / Level</th>
                      <th className="py-3 px-3 font-bold">Target Entity</th>
                      <th className="py-3 px-3 font-bold">Reporting Year</th>
                      <th className="py-3 px-3 font-bold">Period</th>
                      <th className="py-3 px-3 font-bold">Start Date</th>
                      <th className="py-3 px-3 font-bold">Submission Deadline</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {timelines.map(tl => (
                      <tr key={tl.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              tl.level === 'SUBSIDIARY'
                                ? 'bg-indigo-100 text-indigo-800'
                                : tl.level === 'BUSINESS_UNIT'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {tl.level.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div>{tl.targetName}</div>
                          {tl.subsidiaryName && <div className="text-[10px] text-slate-400 font-normal">{tl.subsidiaryName}</div>}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{tl.financialYear}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{tl.periodLabel}</td>
                        <td className="py-3 px-3 text-slate-600 font-mono">{tl.startDate}</td>
                        <td className="py-3 px-3 font-mono font-bold text-rose-700">{tl.submissionDeadline}</td>
                        <td className="py-3 px-3">{renderStatusBadge(tl.status)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setEditingTimeline(tl)
                              setShowTimelineModal(true)
                            }}
                            className="rounded-lg bg-indigo-50 px-3 py-1 font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB D: SUBSIDIARY REPORTS --- */}
        {activeTab === 'subsidiaries' && (
          <motion.div
            key="subsidiaries"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Subsidiary Consolidated Reports</h3>
                  <p className="text-xs text-slate-500">
                    Inspect consolidated filings, download regulatory PDF disclosures, and review attached supporting evidence packs.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {SEEDED_SUBSIDIARIES.map(sub => (
                  <div
                    key={sub.id}
                    className="rounded-2xl bg-white/80 p-5 border border-white/90 shadow-sm hover:border-indigo-400 transition-all space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{sub.name}</h4>
                        <span className="text-xs text-slate-500">Legal: {sub.legalName} · CIN: {sub.cin}</span>
                      </div>
                      {renderStatusBadge(sub.reportingStatus)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-3 rounded-xl text-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{sub.buCount}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">BUs</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{sub.projectCount}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Sites</div>
                      </div>
                      <div>
                        <div className="font-bold text-emerald-700">{sub.progressPct}%</div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Verified</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setPreviewReport({
                              title: `Consolidated ESG Report — ${sub.name}`,
                              entity: sub.name,
                              level: 'Subsidiary Level',
                              period: 'FY 2026-27 (Q1)',
                              metrics: [
                                { label: 'Scope 1 GHG', value: '492.4', unit: 'tCO₂e' },
                                { label: 'Scope 2 GHG', value: '1,280.0', unit: 'tCO₂e' },
                                { label: 'Water Withdrawal', value: '124,500', unit: 'KL' },
                                { label: 'Hazardous Waste', value: '42.8', unit: 'Tonnes' }
                              ],
                              summary: `Verified multi-business-unit report for ${sub.legalName}. Assured against SEBI BRSR Core KPI definitions and CEA emission factors.`,
                              status: sub.reportingStatus
                            })
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>View Report</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSubId(sub.id)
                            setActiveTab('evidence')
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                        >
                          <Package className="h-3.5 w-3.5" />
                          <span>View Evidence</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          showToast(
                            'Report Downloaded',
                            `Downloaded official Consolidated BRSR Report for ${sub.name} (PDF format).`
                          )
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB E: BUSINESS UNIT REPORTS --- */}
        {activeTab === 'bus' && (
          <motion.div
            key="bus"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Business Unit Consolidated Disclosures</h3>
                  <p className="text-xs text-slate-500">
                    Sector-level operational reporting, project rollups, and isolated evidence inspections per business unit.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {SEEDED_BUSINESS_UNITS.map(bu => {
                  const buProjects = SEEDED_PROJECTS.filter(p => p.buId === bu.id)

                  return (
                    <div
                      key={bu.id}
                      className="rounded-2xl bg-white/80 p-5 border border-white/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-indigo-400 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm font-bold text-slate-900">{bu.name}</h4>
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {bu.sector}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Subsidiary: <strong className="text-slate-800">{bu.subsidiaryName}</strong> · Owner: {bu.reportingOwner}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          Highlights: {bu.kpiHighlights} · {buProjects.length} Reporting Projects
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {renderStatusBadge(bu.reportingStatus)}
                        <button
                          onClick={() => {
                            setPreviewReport({
                              title: `Business Unit Consolidated Report — ${bu.name}`,
                              entity: bu.name,
                              level: 'Business Unit Level',
                              period: 'April 2026',
                              metrics: [
                                { label: 'Active Projects', value: String(buProjects.length), unit: 'Sites' },
                                { label: 'Reporting Owner', value: bu.reportingOwner, unit: 'Lead' },
                                { label: 'Data Readiness', value: `${bu.progressPct}%`, unit: 'Reconciled' }
                              ],
                              summary: `Consolidated sectoral performance for ${bu.name} under ${bu.subsidiaryName}. Segregated evidence and project records reviewed.`,
                              status: bu.reportingStatus
                            })
                          }}
                          className="rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          View BU Report
                        </button>
                        <button
                          onClick={() => {
                            showToast(
                              'BU Report Downloaded',
                              `Generated and downloaded ${bu.name} consolidated ESG report.`
                            )
                          }}
                          className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB F: PROJECT REPORTS & DATA --- */}
        {activeTab === 'projects' && (
          <motion.div
            key="projects"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Project Reports & Source Inspection</h3>
                  <p className="text-xs text-slate-500">
                    Drill down into project-level submissions, environmental disclosures, and supporting audit evidence.
                  </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search project or site…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="rounded-xl bg-slate-50 pl-8 pr-3 py-1.5 text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="APPROVED">Approved</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="OVERDUE">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Projects Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/50">
                      <th className="py-3 px-3 font-bold">Project Name & Code</th>
                      <th className="py-3 px-3 font-bold">Subsidiary / BU</th>
                      <th className="py-3 px-3 font-bold">Location</th>
                      <th className="py-3 px-3 font-bold">Deadline</th>
                      <th className="py-3 px-3 font-bold">GHG Footprint</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProjects.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{p.code}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-800">{p.subsidiaryName}</div>
                          <div className="text-[10px] text-slate-500">{p.buName}</div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">{p.location}, {p.state}</td>
                        <td className="py-3.5 px-3 font-mono font-semibold text-slate-700">{p.submissionDeadline}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-indigo-700">{p.ghgTco2e} tCO₂e</td>
                        <td className="py-3.5 px-3">{renderStatusBadge(p.reportingStatus)}</td>
                        <td className="py-3.5 px-3 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setPreviewReport({
                                title: `Site ESG Report — ${p.name}`,
                                entity: p.name,
                                level: 'Project Site',
                                period: 'April 2026',
                                metrics: [
                                  { label: 'Scope 1 Mobile Fuel', value: String(p.ghgTco2e * 0.4), unit: 'tCO₂e' },
                                  { label: 'Scope 2 Grid Power', value: String(p.ghgTco2e * 0.6), unit: 'tCO₂e' },
                                  { label: 'Water Withdrawal', value: String(p.waterKl), unit: 'KL' },
                                  { label: 'Safety Incidents', value: '0', unit: 'Fatalities' }
                                ],
                                summary: `Environmental footprint, water usage, and occupational health metrics for ${p.name}. Data owner: ${p.reportingOwner}. Verified with attached billing manifests.`,
                                status: p.reportingStatus
                              })
                            }}
                            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Report
                          </button>
                          <button
                            onClick={() => {
                              setActiveEvidence(evidenceList[0])
                              setShowEvidenceViewer(true)
                            }}
                            className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 transition"
                          >
                            Evidence
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB G: EVIDENCE REPOSITORY --- */}
        {activeTab === 'evidence' && (
          <motion.div
            key="evidence"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Verified Evidence Repository & Audit Chain</h3>
                  <p className="text-xs text-slate-500">
                    Supporting primary documents, utility invoices, test reports, and manifests mapped to BRSR disclosures.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={evidenceIndicatorFilter}
                    onChange={e => setEvidenceIndicatorFilter(e.target.value)}
                    className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Indicators</option>
                    <option value="Electricity">Electricity (Scope 2)</option>
                    <option value="Combustion">Fuel Combustion (Scope 1)</option>
                    <option value="Water">Water Withdrawal</option>
                    <option value="Air Quality">Air Quality (Stack)</option>
                    <option value="Safety">Safety & LTIFR</option>
                  </select>

                  <button
                    onClick={() => {
                      showToast(
                        'Evidence Pack Assembled',
                        'Consolidated all verified documents into a cryptographic audit zip archive.'
                      )
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download All</span>
                  </button>
                </div>
              </div>

              {/* Evidence Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEvidence.map(ev => (
                  <div
                    key={ev.id}
                    className="rounded-2xl bg-white/85 p-4 border border-white/90 shadow-xs hover:border-indigo-400 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/50">
                          PDF
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{ev.name}</h4>
                          <span className="text-[10px] text-slate-400">{ev.fileSize} · Uploaded: {ev.uploadedAt}</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                        {ev.verificationStatus}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 p-3 text-[11px] text-slate-600 space-y-1">
                      <div><strong>Indicator:</strong> {ev.indicatorName}</div>
                      <div><strong>BRSR Section:</strong> {ev.brsrSection}</div>
                      <div><strong>Source Entity:</strong> {ev.sourceProject} ({ev.sourceSubsidiary})</div>
                      <div><strong>Reported Value:</strong> <span className="font-mono font-bold text-slate-800">{ev.reportedValue}</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">Owner: {ev.uploadedBy}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveEvidence(ev)
                            setShowEvidenceViewer(true)
                          }}
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect</span>
                        </button>
                        <button
                          onClick={() => {
                            showToast('Document Downloaded', `Downloaded verified evidence document: ${ev.name}`)
                          }}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB H: USERS, LIVE SUBMISSIONS & AUDIT FEED (CONNECT USERS TO ADMIN) --- */}
        {activeTab === 'users_submissions' && (
          <motion.div
            key="users_submissions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Active Contributors Directory */}
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Connected Contributors & Site Roles</h3>
                  <p className="text-xs text-slate-500">Real-time status of users submitting data across all operating business units</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  9 Active Contributors
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'Rohit Kumar', role: 'Environment Data User', email: 'rohit@meil-esg.in', site: 'Gayatri Solar Plant', status: 'ACTIVE' },
                  { name: 'Rakesh Verma', role: 'BU Reviewer / Finance', email: 'rakesh@meil-esg.in', site: 'Power Generation BU', status: 'ACTIVE' },
                  { name: 'Sunita Rao', role: 'HR User', email: 'sunita@meil-esg.in', site: 'MEIL Infrastructure', status: 'ACTIVE' },
                  { name: 'K. Venkat', role: 'EHS / Safety User', email: 'kvenkat@meil-esg.in', site: 'Kaleshwaram Lift Irrig.', status: 'ACTIVE' },
                  { name: 'Priya Nair', role: 'Procurement User', email: 'priya@meil-esg.in', site: 'Supply Chain Group', status: 'ACTIVE' },
                  { name: 'Vikram Shah', role: 'Group / HQ Reviewer', email: 'vikram@meil-esg.in', site: 'MEIL Conglomerate HQ', status: 'ACTIVE' },
                ].map((u, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3.5 border border-white/90 shadow-2xs">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-sm">
                      {u.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">{u.name}</div>
                      <div className="text-[11px] text-indigo-700 font-semibold truncate">{u.role}</div>
                      <div className="text-[10px] text-slate-400 truncate">{u.site}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Submissions Oversight Table */}
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recent User Submissions Stream</h3>
                  <p className="text-xs text-slate-500">Live feed of filings submitted for group review, validation, and sign-off</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/50">
                      <th className="py-3 px-3 font-bold">Project / Site</th>
                      <th className="py-3 px-3 font-bold">Module</th>
                      <th className="py-3 px-3 font-bold">Submitted By</th>
                      <th className="py-3 px-3 font-bold">Submitted Date</th>
                      <th className="py-3 px-3 font-bold">Footprint</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SEEDED_LIVE_SUBMISSIONS.map(sub => (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900">{sub.projectName}</div>
                          <div className="text-[10px] text-slate-400">{sub.buName}</div>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-800">{sub.module}</td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-900">{sub.submittedBy}</div>
                          <div className="text-[10px] text-slate-400">{sub.userEmail}</div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-600">{sub.submittedAt}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-indigo-700">
                          {sub.calculatedTco2e ? `${sub.calculatedTco2e} tCO₂e` : '—'}
                        </td>
                        <td className="py-3.5 px-3">{renderStatusBadge(sub.status)}</td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setPreviewReport({
                                title: `Submission Audit — ${sub.projectName}`,
                                entity: sub.projectName,
                                level: sub.buName,
                                period: 'April 2026',
                                metrics: [
                                  { label: 'Completion', value: `${sub.completionPct}%`, unit: 'Reconciled' },
                                  { label: 'Footprint', value: String(sub.calculatedTco2e ?? 0), unit: 'tCO₂e' },
                                  { label: 'Attached Evidence', value: String(sub.evidenceCount), unit: 'Docs' }
                                ],
                                summary: `Direct submission by ${sub.submittedBy}. Reviewer assigned: ${sub.reviewAssignee}. All calculation formulas and source invoices validated.`,
                                status: sub.status
                              })
                            }}
                            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Inspect Submission
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- TAB I: HISTORICAL PREVIOUS-YEAR BRSR ARCHIVE --- */}
        {activeTab === 'archive' && (
          <motion.div
            key="archive"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="rounded-3xl bg-white/75 p-6 backdrop-blur-2xl border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Previous-Year BRSR Report Archive</h3>
                  <p className="text-xs text-slate-500">
                    Permanent repository of verified and audited BRSR reports from prior financial years with evidence packages.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
                    Archive Mode (Read-Only)
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {SEEDED_ARCHIVE_YEARS.map(arch => (
                  <div
                    key={arch.year}
                    className="rounded-2xl bg-white/80 p-5 border border-white/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-400 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white font-black text-sm shadow-md">
                        {arch.year.replace('FY ', '')}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{arch.title}</h4>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Assured
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Assurance: <strong className="text-slate-700">{arch.assurancePartner}</strong> · Published: {arch.publishedDate}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 pt-1 font-medium">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">Total GHG: <strong>{arch.totalGhg}</strong></span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">Renewable Share: <strong>{arch.renewableShare}</strong></span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">{arch.evidencePacks} Evidence Packs</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setPreviewReport({
                            title: arch.title,
                            entity: 'MEIL Group (Consolidated Historical)',
                            level: 'Group Historical Assurance',
                            period: arch.year,
                            metrics: [
                              { label: 'Assurance Partner', value: arch.assurancePartner, unit: 'External' },
                              { label: 'Consolidated GHG', value: arch.totalGhg, unit: 'Annual' },
                              { label: 'Clean Energy %', value: arch.renewableShare, unit: 'Of Total' }
                            ],
                            summary: `Official historical BRSR report for ${arch.year}. Verified in accordance with SEBI circular SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122. All primary source records archived in immutable cold storage.`,
                            status: 'APPROVED'
                          })
                        }}
                        className="rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview Report</span>
                      </button>

                      <button
                        onClick={() => {
                          showToast(
                            'Historical Report Downloaded',
                            `Downloaded official ${arch.year} BRSR filing and assurance annexures.`
                          )
                        }}
                        className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Report</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 5. MODAL: REPORTING TIMELINE ASSIGN & EDIT (WITH CONFIRMATION) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {showTimelineModal && editingTimeline && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTimeline.id.includes('custom') ? 'Assign Reporting Timeline' : 'Edit Reporting Deadline'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowTimelineModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTimeline} className="space-y-4 text-xs">
                {/* Level Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Timeline Hierarchy Level
                  </label>
                  <select
                    value={editingTimeline.level}
                    onChange={e => setEditingTimeline({ ...editingTimeline, level: e.target.value as any })}
                    className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                  >
                    <option value="SUBSIDIARY">Subsidiary Level (Consolidated)</option>
                    <option value="BUSINESS_UNIT">Business Unit Level (Sector)</option>
                    <option value="PROJECT">Project Site Level (Operational Source)</option>
                  </select>
                </div>

                {/* Target Entity Name */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Target Entity / Organization Node
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTimeline.targetName}
                    onChange={e => setEditingTimeline({ ...editingTimeline, targetName: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Financial Year
                    </label>
                    <input
                      type="text"
                      required
                      value={editingTimeline.financialYear}
                      onChange={e => setEditingTimeline({ ...editingTimeline, financialYear: e.target.value })}
                      className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Reporting Period
                    </label>
                    <input
                      type="text"
                      required
                      value={editingTimeline.periodLabel}
                      onChange={e => setEditingTimeline({ ...editingTimeline, periodLabel: e.target.value })}
                      className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={editingTimeline.startDate}
                      onChange={e => setEditingTimeline({ ...editingTimeline, startDate: e.target.value })}
                      className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Submission Deadline
                    </label>
                    <input
                      type="date"
                      required
                      value={editingTimeline.submissionDeadline}
                      onChange={e => setEditingTimeline({ ...editingTimeline, submissionDeadline: e.target.value })}
                      className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-rose-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Reporting Status
                  </label>
                  <select
                    value={editingTimeline.status}
                    onChange={e => setEditingTimeline({ ...editingTimeline, status: e.target.value as any })}
                    className="w-full rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTimelineModal(false)}
                    className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white shadow-md hover:bg-slate-800 transition"
                  >
                    Save & Confirm Timeline
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 6. MODAL: DEDICATED EVIDENCE VIEWER PANEL */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {showEvidenceViewer && activeEvidence && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{activeEvidence.name}</h3>
                    <span className="text-[10px] text-slate-400">Audit Reference: {activeEvidence.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowEvidenceViewer(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Document Meta Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-4 rounded-2xl text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">BRSR Indicator</span>
                  <strong className="text-slate-900">{activeEvidence.indicatorName}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reported Value</span>
                  <strong className="font-mono text-indigo-700">{activeEvidence.reportedValue}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Source Project / Site</span>
                  <span className="text-slate-800">{activeEvidence.sourceProject}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reporting Period</span>
                  <span className="text-slate-800">{activeEvidence.reportingPeriod}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Uploaded By</span>
                  <span className="text-slate-800">{activeEvidence.uploadedBy}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Verification Status</span>
                  <span className="font-bold text-emerald-700">{activeEvidence.verificationStatus}</span>
                </div>
              </div>

              {/* Document Preview Box */}
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-2">
                <FileText className="mx-auto h-12 w-12 text-slate-400" />
                <div className="text-sm font-bold text-slate-800">Verified Evidence Document Ready</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Digital invoice & laboratory certificate validated against MEIL MRV emission calculation protocols.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    showToast(
                      'Evidence Pack Assembled',
                      `Packaged ${activeEvidence.name} and related project audit files into an encrypted bundle.`
                    )
                  }}
                  className="rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5"
                >
                  <FileBox className="h-4 w-4" />
                  <span>Generate Evidence Pack</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEvidenceViewer(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      showToast('Document Downloaded', `Downloaded ${activeEvidence.name}.`)
                      setShowEvidenceViewer(false)
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 7. MODAL: FULL REPORT PREVIEWER */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {previewReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{previewReport.title}</h3>
                  <span className="text-[10px] text-slate-400">{previewReport.level} · Period: {previewReport.period}</span>
                </div>
                <button
                  onClick={() => setPreviewReport(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Highlight Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                {previewReport.metrics.map((m, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{m.label}</div>
                    <div className="text-sm font-black text-slate-900 mt-1">{m.value}</div>
                    <div className="text-[10px] text-slate-500">{m.unit}</div>
                  </div>
                ))}
              </div>

              {/* Summary Description */}
              <div className="rounded-2xl bg-slate-50/80 p-4 text-xs text-slate-700 space-y-2 border border-slate-100">
                <strong className="font-bold text-slate-900 block">Executive Assurance Summary:</strong>
                <p className="leading-relaxed text-slate-600">{previewReport.summary}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setPreviewReport(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    showToast('Report Downloaded', `Downloaded PDF: ${previewReport.title}`)
                    setPreviewReport(null)
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Full PDF Report</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
