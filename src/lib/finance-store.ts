'use client'
/**
 * Finance & Resource Data Contributor — Persistent Data Store & Workflow Engine
 * Manages assignments, financial metrics, resource expenditures, evidence documents,
 * submissions, validation checklist, activity logs, and reporting exports.
 */

export interface FinanceAssignment {
  id: string
  entityName: string
  entityId: string
  businessUnit: string
  reportingPeriod: string
  financialYear: string
  module: 'Financial Summary' | 'Resource Expenditure' | 'BRSR Financial Calculations' | 'Supporting Evidence'
  completion: number
  evidenceStatus: 'Complete' | 'Pending' | 'Under Review'
  status: 'In Progress' | 'Draft' | 'Submitted' | 'Returned for Correction' | 'Accepted'
  lastUpdated: string
  location: string
  currency: string
  preparedBy: string
  designation: string
  submissionId: string
}

export interface FinancialSummaryData {
  turnover: number
  previousTurnover: number
  turnoverUnit: 'Crore' | 'Lakh' | 'Thousand'
  totalExpenditure: number
  capEx: number
  opEx: number
  environmentalSpend: number
  dataSource: string
  documentReference: string
  remarks: string
  lastSaved?: string
}

export interface ResourceExpenditureItem {
  id: string
  category: 'Pollution Control' | 'Energy Efficiency' | 'Renewable Energy' | 'Water Conservation' | 'Waste Management' | 'Other Initiatives'
  description: string
  amount: number // in ₹ Crore
  accountingPeriod: string
  source: 'CapEx' | 'OpEx'
  status: 'Draft' | 'Verified' | 'Locked'
  dateAdded: string
}

export interface EvidenceDocumentItem {
  id: string
  documentName: string
  category: 'Financial Statement' | 'Capital Expenditure' | 'Operating Expenditure' | 'Environmental Expenditure' | 'Supporting Document' | 'General Ledger Extract'
  linkedTo: 'Financial Summary' | 'Resource Expenditure'
  uploadDate: string
  uploadedBy: string
  size: string
  status: 'Accepted' | 'Under Review' | 'Returned' | 'Draft'
  remarks?: string
}

export interface SubmissionRecord {
  id: string
  entityName: string
  entityId: string
  businessUnit: string
  financialYear: string
  module: string
  submittedDate: string
  completion: number
  status: 'Draft' | 'Ready for Submission' | 'In Progress' | 'Submitted' | 'Under Review' | 'Returned for Correction' | 'Accepted'
  reviewer: string
  latestComment: string
  lastUpdated: string
  timeline: { step: string; timestamp: string; actor: string; note: string }[]
}

export interface ActivityEvent {
  id: string
  timestamp: string
  type: 'RECORD_CREATED' | 'DRAFT_SAVED' | 'DOC_UPLOADED' | 'DOC_REPLACED' | 'VALIDATION_PASSED' | 'SUBMITTED' | 'RETURNED' | 'CORRECTED' | 'RESUBMITTED' | 'EXPORT_GENERATED'
  title: string
  description: string
  entity: string
  actor: string
  severity: 'info' | 'success' | 'warning' | 'error'
}

export interface ValidationChecklistResult {
  financialSummaryCompleted: boolean
  resourceExpenditureCompleted: boolean
  requiredDocumentsUploaded: boolean
  previousYearComparisonAvailable: boolean
  remarksProvided: boolean
  readyForSubmission: boolean
  completionPercentage: number
  blockingErrors: string[]
  warnings: string[]
}

// ---------------- DEFAULT SEED DATA ----------------

const DEFAULT_ASSIGNMENTS: FinanceAssignment[] = [
  {
    id: 'asg-1',
    entityName: 'Gayatri Solar Plant',
    entityId: 'MEIL-SOL-GJT',
    businessUnit: 'Solar BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    completion: 80,
    evidenceStatus: 'Complete',
    status: 'In Progress',
    lastUpdated: 'Today at 02:15 PM',
    location: 'Andhra Pradesh, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-SOL-GJT',
  },
  {
    id: 'asg-2',
    entityName: 'Hyderabad Metro Phase 2',
    entityId: 'MEIL-MET-HYD',
    businessUnit: 'Infra BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Resource Expenditure',
    completion: 45,
    evidenceStatus: 'Pending',
    status: 'Draft',
    lastUpdated: 'Yesterday at 05:40 PM',
    location: 'Telangana, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-MET-HYD',
  },
  {
    id: 'asg-3',
    entityName: 'Vizag Port Expansion',
    entityId: 'MEIL-PORT-VZG',
    businessUnit: 'Ports BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    completion: 100,
    evidenceStatus: 'Complete',
    status: 'Submitted',
    lastUpdated: '10 Jun 2026',
    location: 'Andhra Pradesh, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-PORT-VZG',
  },
  {
    id: 'asg-4',
    entityName: 'Zojila Tunnel Project',
    entityId: 'MEIL-TUN-ZOJ',
    businessUnit: 'Infra BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    completion: 65,
    evidenceStatus: 'Complete',
    status: 'In Progress',
    lastUpdated: '08 Jun 2026',
    location: 'Jammu & Kashmir, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-TUN-ZOJ',
  },
  {
    id: 'asg-5',
    entityName: 'Kaleshwaram Lift Irrigation',
    entityId: 'MEIL-WTR-KPR',
    businessUnit: 'Water BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Resource Expenditure',
    completion: 25,
    evidenceStatus: 'Pending',
    status: 'Draft',
    lastUpdated: '05 Jun 2026',
    location: 'Telangana, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-WTR-KPR',
  },
  {
    id: 'asg-6',
    entityName: 'Nizamabad Solar Farm',
    entityId: 'MEIL-SOL-NZR',
    businessUnit: 'Solar BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'BRSR Financial Calculations',
    completion: 85,
    evidenceStatus: 'Complete',
    status: 'Returned for Correction',
    lastUpdated: '02 Jun 2026',
    location: 'Telangana, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-SOL-NZR',
  },
]

const DEFAULT_FINANCIAL_SUMMARY: FinancialSummaryData = {
  turnover: 1250.0,
  previousTurnover: 1180.0,
  turnoverUnit: 'Crore',
  totalExpenditure: 980.0,
  capEx: 320.0,
  opEx: 660.0,
  environmentalSpend: 45.0,
  dataSource: 'Audited Financial Statement',
  documentReference: 'MEIL_FS_2026-27.pdf',
  remarks: 'Turnover and CapEx reconciled with audited statutory auditor notes annexure 4.',
  lastSaved: '10 Jun 2026, 02:15 PM',
}

const DEFAULT_EXPENDITURES: ResourceExpenditureItem[] = [
  {
    id: 'exp-1',
    category: 'Pollution Control',
    description: 'Air emission control equipment',
    amount: 12.5,
    accountingPeriod: 'FY 2026-27',
    source: 'CapEx',
    status: 'Verified',
    dateAdded: '10 Jun 2026',
  },
  {
    id: 'exp-2',
    category: 'Energy Efficiency',
    description: 'High efficiency transformers',
    amount: 8.0,
    accountingPeriod: 'FY 2026-27',
    source: 'CapEx',
    status: 'Verified',
    dateAdded: '10 Jun 2026',
  },
  {
    id: 'exp-3',
    category: 'Renewable Energy',
    description: 'Solar panels installation',
    amount: 15.0,
    accountingPeriod: 'FY 2026-27',
    source: 'CapEx',
    status: 'Verified',
    dateAdded: '10 Jun 2026',
  },
  {
    id: 'exp-4',
    category: 'Water Conservation',
    description: 'Rainwater harvesting system',
    amount: 5.5,
    accountingPeriod: 'FY 2026-27',
    source: 'OpEx',
    status: 'Verified',
    dateAdded: '09 Jun 2026',
  },
  {
    id: 'exp-5',
    category: 'Waste Management',
    description: 'Waste treatment facility',
    amount: 3.0,
    accountingPeriod: 'FY 2026-27',
    source: 'OpEx',
    status: 'Verified',
    dateAdded: '09 Jun 2026',
  },
  {
    id: 'exp-6',
    category: 'Other Initiatives',
    description: 'Green belt development',
    amount: 1.0,
    accountingPeriod: 'FY 2026-27',
    source: 'OpEx',
    status: 'Verified',
    dateAdded: '08 Jun 2026',
  },
]

const DEFAULT_EVIDENCE_DOCS: EvidenceDocumentItem[] = [
  {
    id: 'doc-1',
    documentName: 'MEIL_FS_2026-27.pdf',
    category: 'Financial Statement',
    linkedTo: 'Financial Summary',
    uploadDate: '12 Jun 2026',
    uploadedBy: 'Rakesh Verma',
    size: '4.8 MB',
    status: 'Accepted',
    remarks: 'Approved by statutory audit team',
  },
  {
    id: 'doc-2',
    documentName: 'CapEx_Projects.xlsx',
    category: 'Capital Expenditure',
    linkedTo: 'Resource Expenditure',
    uploadDate: '10 Jun 2026',
    uploadedBy: 'Rakesh Verma',
    size: '2.1 MB',
    status: 'Under Review',
    remarks: 'CapEx breakdown for solar & transformers',
  },
  {
    id: 'doc-3',
    documentName: 'OpEx_Records.pdf',
    category: 'Operating Expenditure',
    linkedTo: 'Resource Expenditure',
    uploadDate: '10 Jun 2026',
    uploadedBy: 'Rakesh Verma',
    size: '1.4 MB',
    status: 'Accepted',
    remarks: 'Rainwater & waste treatment operating slips',
  },
  {
    id: 'doc-4',
    documentName: 'Environmental_Spend.pdf',
    category: 'Environmental Expenditure',
    linkedTo: 'Resource Expenditure',
    uploadDate: '09 Jun 2026',
    uploadedBy: 'Rakesh Verma',
    size: '3.6 MB',
    status: 'Accepted',
    remarks: 'Total ₹45.00 Cr reconciliation cert',
  },
  {
    id: 'doc-5',
    documentName: 'Bank_Statement.pdf',
    category: 'Supporting Document',
    linkedTo: 'Financial Summary',
    uploadDate: '09 Jun 2026',
    uploadedBy: 'Rakesh Verma',
    size: '5.2 MB',
    status: 'Returned',
    remarks: 'Requires page 12 stamp certification from treasury',
  },
]

const DEFAULT_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'SUB-2026-SOL-GJT',
    entityName: 'Gayatri Solar Plant',
    entityId: 'MEIL-SOL-GJT',
    businessUnit: 'Solar BU',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary & Resource Spend',
    submittedDate: '10 Jun 2026',
    completion: 80,
    status: 'In Progress',
    reviewer: 'Anita Desai (ESG Manager)',
    latestComment: 'Draft saved. Please upload the revised certified bank statement before final submission.',
    lastUpdated: 'Today at 02:15 PM',
    timeline: [
      { step: 'Assignment Created', timestamp: '01 Jun 2026', actor: 'System Admin', note: 'Scope assigned for Solar BU' },
      { step: 'Draft Saved', timestamp: '10 Jun 2026', actor: 'Rakesh Verma', note: 'Financial figures populated' },
    ],
  },
  {
    id: 'SUB-2026-PORT-VZG',
    entityName: 'Vizag Port Expansion',
    entityId: 'MEIL-PORT-VZG',
    businessUnit: 'Ports BU',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    submittedDate: '10 Jun 2026',
    completion: 100,
    status: 'Submitted',
    reviewer: 'Vikram Shah (Group Reviewer)',
    latestComment: 'Submitted for Group level sign-off. Initial validation passed.',
    lastUpdated: '10 Jun 2026',
    timeline: [
      { step: 'Assignment Created', timestamp: '01 Jun 2026', actor: 'System Admin', note: 'Scope assigned' },
      { step: 'Validation Passed', timestamp: '10 Jun 2026', actor: 'Rakesh Verma', note: 'All checks green' },
      { step: 'Submitted for Review', timestamp: '10 Jun 2026', actor: 'Rakesh Verma', note: 'Submitted to reviewer queue' },
    ],
  },
  {
    id: 'SUB-2026-SOL-NZR',
    entityName: 'Nizamabad Solar Farm',
    entityId: 'MEIL-SOL-NZR',
    businessUnit: 'Solar BU',
    financialYear: 'FY 2026-27',
    module: 'BRSR Financial Calculations',
    submittedDate: '02 Jun 2026',
    completion: 85,
    status: 'Returned for Correction',
    reviewer: 'Meena Iyer (BRSR Manager)',
    latestComment: 'Environmental expenditure was listed under wrong accounting period. Please correct to FY 2026-27.',
    lastUpdated: '04 Jun 2026',
    timeline: [
      { step: 'Submitted', timestamp: '02 Jun 2026', actor: 'Rakesh Verma', note: 'Initial submission' },
      { step: 'Returned for Correction', timestamp: '04 Jun 2026', actor: 'Meena Iyer', note: 'Period mismatch in line item 3' },
    ],
  },
]

const DEFAULT_ACTIVITY: ActivityEvent[] = [
  {
    id: 'act-1',
    timestamp: 'Today at 02:15 PM',
    type: 'DRAFT_SAVED',
    title: 'Financial data submitted',
    description: 'Financial Summary and Resource Expenditure saved for Gayatri Solar Plant',
    entity: 'MEIL-SOL-GJT | June 2026',
    actor: 'Rakesh Verma',
    severity: 'success',
  },
  {
    id: 'act-2',
    timestamp: '12 Jun 2026, 11:30 AM',
    type: 'DOC_UPLOADED',
    title: 'Document uploaded',
    description: 'Annual Financial Statement.pdf uploaded and verified',
    entity: 'MEIL_FS_2026-27.pdf',
    actor: 'Rakesh Verma',
    severity: 'info',
  },
  {
    id: 'act-3',
    timestamp: '09 Jun 2026, 04:10 PM',
    type: 'RETURNED',
    title: 'Returned for correction',
    description: 'Bank Statement.pdf returned: page 12 stamp required',
    entity: 'Resource Expenditure - Plant A',
    actor: 'Anita Desai',
    severity: 'warning',
  },
  {
    id: 'act-4',
    timestamp: '08 Jun 2026, 09:45 AM',
    type: 'DRAFT_SAVED',
    title: 'Draft saved',
    description: 'Financial Summary - Unit B draft autosaved with 6 line items',
    entity: 'MEIL-TUN-ZOJ',
    actor: 'Rakesh Verma',
    severity: 'info',
  },
]

export const MONTHLY_EXPENDITURE_CHART = [
  { month: 'Apr', capEx: 25, opEx: 60 },
  { month: 'May', capEx: 45, opEx: 85 },
  { month: 'Jun', capEx: 70, opEx: 110 },
  { month: 'Jul', capEx: 90, opEx: 130 },
  { month: 'Aug', capEx: 115, opEx: 150 },
  { month: 'Sep', capEx: 80, opEx: 125 },
]

// ---------------- LOCAL STORAGE KEYS ----------------

const KEYS = {
  ASSIGNMENTS: 'meil_finance_assignments',
  FINANCIAL_SUMMARY: 'meil_finance_summary',
  EXPENDITURES: 'meil_finance_expenditures',
  EVIDENCE_DOCS: 'meil_finance_evidence_docs',
  SUBMISSIONS: 'meil_finance_submissions',
  ACTIVITY: 'meil_finance_activity',
  ACTIVE_ENTITY: 'meil_finance_active_entity',
}

// ---------------- STORE SERVICE ----------------

export class FinanceStoreService {
  private static isClient = typeof window !== 'undefined'

  static getAssignments(): FinanceAssignment[] {
    if (!this.isClient) return DEFAULT_ASSIGNMENTS
    try {
      const data = localStorage.getItem(KEYS.ASSIGNMENTS)
      return data ? JSON.parse(data) : DEFAULT_ASSIGNMENTS
    } catch {
      return DEFAULT_ASSIGNMENTS
    }
  }

  static saveAssignments(list: FinanceAssignment[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(list))
    } catch {}
  }

  static getFinancialSummary(): FinancialSummaryData {
    if (!this.isClient) return DEFAULT_FINANCIAL_SUMMARY
    try {
      const data = localStorage.getItem(KEYS.FINANCIAL_SUMMARY)
      return data ? JSON.parse(data) : DEFAULT_FINANCIAL_SUMMARY
    } catch {
      return DEFAULT_FINANCIAL_SUMMARY
    }
  }

  static saveFinancialSummary(data: FinancialSummaryData) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.FINANCIAL_SUMMARY, JSON.stringify({ ...data, lastSaved: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))
      this.logActivity({
        type: 'DRAFT_SAVED',
        title: 'Financial data saved',
        description: `Saved turnover ₹${data.turnover} Cr and CapEx ₹${data.capEx} Cr`,
        entity: 'MEIL-SOL-GJT',
        actor: 'Rakesh Verma',
        severity: 'success',
      })
    } catch {}
  }

  static getExpenditures(): ResourceExpenditureItem[] {
    if (!this.isClient) return DEFAULT_EXPENDITURES
    try {
      const data = localStorage.getItem(KEYS.EXPENDITURES)
      return data ? JSON.parse(data) : DEFAULT_EXPENDITURES
    } catch {
      return DEFAULT_EXPENDITURES
    }
  }

  static saveExpenditures(list: ResourceExpenditureItem[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.EXPENDITURES, JSON.stringify(list))
    } catch {}
  }

  static addExpenditure(item: Omit<ResourceExpenditureItem, 'id' | 'dateAdded'>): ResourceExpenditureItem {
    const list = this.getExpenditures()
    const newItem: ResourceExpenditureItem = {
      ...item,
      id: `exp-${Date.now()}`,
      dateAdded: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    }
    const updated = [newItem, ...list]
    this.saveExpenditures(updated)
    this.logActivity({
      type: 'RECORD_CREATED',
      title: 'Expenditure record added',
      description: `Added ₹${newItem.amount} Cr under ${newItem.category} (${newItem.source})`,
      entity: 'MEIL-SOL-GJT',
      actor: 'Rakesh Verma',
      severity: 'info',
    })
    return newItem
  }

  static deleteExpenditure(id: string) {
    const list = this.getExpenditures()
    const filtered = list.filter(i => i.id !== id)
    this.saveExpenditures(filtered)
  }

  static updateExpenditure(id: string, updates: Partial<ResourceExpenditureItem>) {
    const list = this.getExpenditures()
    const updated = list.map(item => item.id === id ? { ...item, ...updates } : item)
    this.saveExpenditures(updated)
  }

  static getEvidenceDocs(): EvidenceDocumentItem[] {
    if (!this.isClient) return DEFAULT_EVIDENCE_DOCS
    try {
      const data = localStorage.getItem(KEYS.EVIDENCE_DOCS)
      return data ? JSON.parse(data) : DEFAULT_EVIDENCE_DOCS
    } catch {
      return DEFAULT_EVIDENCE_DOCS
    }
  }

  static getEvidenceDocuments(): EvidenceDocumentItem[] {
    return this.getEvidenceDocs()
  }

  static saveEvidenceDocs(list: EvidenceDocumentItem[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.EVIDENCE_DOCS, JSON.stringify(list))
    } catch {}
  }

  static addEvidenceDoc(doc: Omit<EvidenceDocumentItem, 'id' | 'uploadDate' | 'uploadedBy'>): EvidenceDocumentItem {
    const list = this.getEvidenceDocs()
    const newDoc: EvidenceDocumentItem = {
      ...doc,
      id: `doc-${Date.now()}`,
      uploadDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      uploadedBy: 'Rakesh Verma',
    }
    const updated = [newDoc, ...list]
    this.saveEvidenceDocs(updated)
    this.logActivity({
      type: 'DOC_UPLOADED',
      title: 'Evidence document uploaded',
      description: `Uploaded ${newDoc.documentName} for ${newDoc.linkedTo}`,
      entity: newDoc.documentName,
      actor: 'Rakesh Verma',
      severity: 'success',
    })
    return newDoc
  }

  static addEvidenceDocument(doc: any): EvidenceDocumentItem {
    return this.addEvidenceDoc(doc)
  }

  static deleteEvidenceDoc(id: string) {
    const list = this.getEvidenceDocs()
    const filtered = list.filter(i => i.id !== id)
    this.saveEvidenceDocs(filtered)
  }

  static deleteEvidenceDocument(id: string) {
    return this.deleteEvidenceDoc(id)
  }

  static getSubmissions(): SubmissionRecord[] {
    if (!this.isClient) return DEFAULT_SUBMISSIONS
    try {
      const data = localStorage.getItem(KEYS.SUBMISSIONS)
      return data ? JSON.parse(data) : DEFAULT_SUBMISSIONS
    } catch {
      return DEFAULT_SUBMISSIONS
    }
  }

  static saveSubmissions(list: SubmissionRecord[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify(list))
    } catch {}
  }

  static submitRecordForReview(entityId: string = 'MEIL-SOL-GJT'): { ok: boolean; message: string } {
    const summary = this.getFinancialSummary()
    const expenditures = this.getExpenditures()
    const docs = this.getEvidenceDocs()
    const validation = this.validateRecord(summary, expenditures, docs)

    if (!validation.readyForSubmission) {
      return { ok: false, message: validation.blockingErrors[0] || 'Validation failed. Check requirements.' }
    }

    const submissions = this.getSubmissions()
    const updated = submissions.map(s => {
      if (s.entityId === entityId) {
        return {
          ...s,
          status: 'Submitted' as const,
          completion: 100,
          lastUpdated: 'Just now',
          latestComment: 'Submitted by Rakesh Verma. Awaiting reviewer review.',
          timeline: [
            ...s.timeline,
            { step: 'Submitted for Review', timestamp: new Date().toLocaleDateString('en-GB'), actor: 'Rakesh Verma', note: 'All validations passed' },
          ],
        }
      }
      return s
    })
    this.saveSubmissions(updated)

    // Update assignment status
    const asgs = this.getAssignments()
    this.saveAssignments(asgs.map(a => a.entityId === entityId ? { ...a, status: 'Submitted', completion: 100 } : a))

    this.logActivity({
      type: 'SUBMITTED',
      title: 'Record submitted for review',
      description: `Submitted ${entityId} financial and resource data with full evidence verification`,
      entity: entityId,
      actor: 'Rakesh Verma',
      severity: 'success',
    })

    return { ok: true, message: 'Record successfully submitted for reviewer approval!' }
  }

  static resubmitRecord(submissionId: string = 'SUB-2026-SOL-GJT') {
    const subs = this.getSubmissions()
    const updated = subs.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'Submitted' as const,
          lastUpdated: 'Just now',
          latestComment: 'Corrections addressed by Rakesh Verma. Resubmitted for approval.',
          timeline: [
            ...s.timeline,
            { step: 'Resubmitted for Review', timestamp: new Date().toLocaleDateString('en-GB'), actor: 'Rakesh Verma', note: 'Corrections addressed' }
          ]
        }
      }
      return s
    })
    this.saveSubmissions(updated)
    this.logActivity({
      type: 'RESUBMITTED',
      title: 'Record resubmitted',
      description: `Resubmitted ${submissionId} after incorporating reviewer remarks`,
      entity: submissionId,
      actor: 'Rakesh Verma',
      severity: 'success'
    })
  }

  static getMonthlyExpenditureChartData() {
    return MONTHLY_EXPENDITURE_CHART
  }

  static getActivity(): ActivityEvent[] {
    if (!this.isClient) return DEFAULT_ACTIVITY
    try {
      const data = localStorage.getItem(KEYS.ACTIVITY)
      return data ? JSON.parse(data) : DEFAULT_ACTIVITY
    } catch {
      return DEFAULT_ACTIVITY
    }
  }

  static getActivities(): ActivityEvent[] {
    return this.getActivity()
  }

  static logActivity(
    eventOrTitle: Omit<ActivityEvent, 'id' | 'timestamp'> | string,
    description?: string,
    severity?: any,
    entity?: string
  ) {
    if (!this.isClient) return
    try {
      const current = this.getActivity()
      let newEvent: ActivityEvent

      if (typeof eventOrTitle === 'string') {
        const sev = severity === 'saved' ? 'info' : (severity || 'info')
        newEvent = {
          id: `act-${Date.now()}`,
          timestamp: 'Just now',
          type: 'DRAFT_SAVED',
          title: eventOrTitle,
          description: description || '',
          entity: entity || 'MEIL-SOL-GJT',
          actor: 'Rakesh Verma',
          severity: sev,
        }
      } else {
        newEvent = {
          ...eventOrTitle,
          id: `act-${Date.now()}`,
          timestamp: 'Just now',
        }
      }

      localStorage.setItem(KEYS.ACTIVITY, JSON.stringify([newEvent, ...current.slice(0, 40)]))
    } catch {}
  }

  // ---------------- COMPUTED BUSINESS LOGIC ----------------

  static calculateYoY(current: number, previous: number): { percentage: number | null; text: string; positive: boolean } {
    if (previous === 0 || isNaN(previous) || previous == null) {
      return { percentage: null, text: 'Not calculable — previous-year value is zero', positive: false }
    }
    const pct = ((current - previous) / previous) * 100
    const formatted = pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`
    return { percentage: pct, text: `${formatted} YoY change`, positive: pct >= 0 }
  }

  static getTotalResourceExpenditure(expenditures: ResourceExpenditureItem[] = this.getExpenditures()): number {
    return Number(expenditures.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2))
  }

  static getCategoryDistribution(expenditures: ResourceExpenditureItem[] = this.getExpenditures()): { category: string; amount: number; percentage: number; color: string }[] {
    const total = this.getTotalResourceExpenditure(expenditures) || 1
    const colorMap: Record<string, string> = {
      'Renewable Energy': '#2563EB', // Blue
      'Energy Efficiency': '#3B82F6', // Sky
      'Pollution Control': '#8B5CF6', // Purple
      'Water Conservation': '#06B6D4', // Cyan
      'Waste Management': '#10B981', // Emerald
      'Other Initiatives': '#64748B', // Slate
    }

    const byCat = expenditures.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount
      return acc
    }, {} as Record<string, number>)

    return Object.entries(byCat).map(([category, amount]) => ({
      category,
      amount,
      percentage: Math.round((amount / total) * 100),
      color: colorMap[category] || '#94A3B8',
    }))
  }

  static validateRecord(
    summary: FinancialSummaryData = this.getFinancialSummary(),
    expenditures: ResourceExpenditureItem[] = this.getExpenditures(),
    docs: EvidenceDocumentItem[] = this.getEvidenceDocs()
  ): ValidationChecklistResult {
    const blockingErrors: string[] = []
    const warnings: string[] = []

    // 1. Financial summary check
    const financialSummaryCompleted = summary.turnover > 0 && summary.totalExpenditure > 0 && !!summary.dataSource
    if (!financialSummaryCompleted) {
      blockingErrors.push('Total Turnover and Total Expenditure must be greater than zero')
    }

    // 2. Resource expenditure check
    const resourceExpenditureCompleted = expenditures.length >= 1 && this.getTotalResourceExpenditure(expenditures) > 0
    if (!resourceExpenditureCompleted) {
      blockingErrors.push('At least 1 valid resource expenditure record is required')
    }

    // 3. Required documents uploaded
    const acceptedOrPendingDocs = docs.filter(d => d.status !== 'Returned')
    const hasFinancialDoc = acceptedOrPendingDocs.some(d => d.category === 'Financial Statement' || d.linkedTo === 'Financial Summary')
    const hasExpenditureDoc = acceptedOrPendingDocs.some(d => d.category === 'Environmental Expenditure' || d.category === 'Capital Expenditure' || d.linkedTo === 'Resource Expenditure')
    const requiredDocumentsUploaded = hasFinancialDoc && hasExpenditureDoc
    if (!requiredDocumentsUploaded) {
      blockingErrors.push('Approved Financial Statement and Environmental Spend evidence are mandatory')
    }

    // 4. Previous year comparison
    const previousYearComparisonAvailable = summary.previousTurnover > 0
    if (!previousYearComparisonAvailable) {
      warnings.push('Previous year turnover is empty or zero')
    }

    // 5. Remarks provided
    const remarksProvided = summary.remarks.trim().length > 10
    if (!remarksProvided) {
      warnings.push('Additional explanatory remarks recommended for audit trail')
    }

    // Completion percentage calculation
    let passed = 0
    if (financialSummaryCompleted) passed += 25
    if (resourceExpenditureCompleted) passed += 25
    if (requiredDocumentsUploaded) passed += 25
    if (previousYearComparisonAvailable) passed += 15
    if (remarksProvided) passed += 10

    const readyForSubmission = blockingErrors.length === 0

    return {
      financialSummaryCompleted,
      resourceExpenditureCompleted,
      requiredDocumentsUploaded,
      previousYearComparisonAvailable,
      remarksProvided,
      readyForSubmission,
      completionPercentage: passed,
      blockingErrors,
      warnings,
    }
  }

  // ---------------- EXPORT DATA HELPERS ----------------

  static exportFinancialSummaryCSV() {
    const summary = this.getFinancialSummary()
    const csvContent =
      'Metric,Amount,Unit,Data Source,Document Reference,Remarks\n' +
      `Total Turnover / Revenue,${summary.turnover},${summary.turnoverUnit},"${summary.dataSource}","${summary.documentReference}","${summary.remarks}"\n` +
      `Previous FY Turnover,${summary.previousTurnover},${summary.turnoverUnit},"${summary.dataSource}","${summary.documentReference}",""\n` +
      `Total Expenditure,${summary.totalExpenditure},${summary.turnoverUnit},"${summary.dataSource}","${summary.documentReference}",""\n` +
      `Capital Expenditure (CapEx),${summary.capEx},${summary.turnoverUnit},"${summary.dataSource}","${summary.documentReference}",""\n` +
      `Operating Expenditure (OpEx),${summary.opEx},${summary.turnoverUnit},"${summary.dataSource}","${summary.documentReference}",""\n` +
      `Environmental Expenditure,${summary.environmentalSpend},${summary.turnoverUnit},"${summary.dataSource}","${summary.documentReference}",""\n`

    this.downloadFile('MEIL_Financial_Summary_FY2026-27.csv', csvContent, 'text/csv;charset=utf-8;')
    return csvContent
  }

  static exportResourceExpendituresCSV(): string {
    const list = this.getExpenditures()
    const rows = list.map(i => `"${i.category}","${i.description}",${i.amount},${i.accountingPeriod},${i.source},${i.status}`).join('\n')
    const csvContent = 'Category,Description,Amount (₹ Cr),Accounting Period,Source,Status\n' + rows
    this.downloadFile('MEIL_Resource_Expenditures_FY2026-27.csv', csvContent, 'text/csv;charset=utf-8;')
    return csvContent
  }

  private static downloadFile(filename: string, content: string, mime: string) {
    if (!this.isClient) return
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export const financeStore = FinanceStoreService
export default FinanceStoreService
