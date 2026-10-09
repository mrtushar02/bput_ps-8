'use client'
/**
 * meilESG — Finance & Resource Data Contributor Workspace
 * Contains full implementations for:
 * Screen 2: My Assignments
 * Screen 3: Financial Data Entry (Multi-step with real inputs & YoY calculation)
 * Screen 4: Resource Expenditure (Category table, Add/Edit modal, distribution)
 * Screen 5: Evidence & Documents (Drag-drop upload simulation, live checklist, docs table)
 * Screen 6: My Submissions (Workflow status, reviewer comments, resubmission flow)
 * Screen 7: Reports & Exports (Filterable reports, working CSV/JSON export)
 * Screen 8: Activity Log (Filterable audit trail)
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Link2, Send, FileBarChart, History, CheckCircle2,
  AlertTriangle, Upload, Plus, Trash2, Edit3, Eye, Download,
  ArrowRight, ArrowLeft, Save, ShieldCheck, Check, AlertCircle,
  HelpCircle, RefreshCw, X, FileSpreadsheet, FileCheck2, Filter,
  Layers, Clock, Sparkles, Building2, ChevronRight, Lock
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import {
  financeStore,
  type FinanceAssignment,
  type FinancialSummaryData,
  type ResourceExpenditureItem,
  type EvidenceDocumentItem,
  type SubmissionRecord,
  type ActivityEvent,
  type ValidationChecklistResult
} from '@/lib/finance-store'

export function FinanceWorkspace() {
  const { activeModule, setActiveModule } = useApp()

  // State management
  const [assignments, setAssignments] = useState<FinanceAssignment[]>([])
  const [financialData, setFinancialData] = useState<FinancialSummaryData>(financeStore.getFinancialSummary())
  const [expenditures, setExpenditures] = useState<ResourceExpenditureItem[]>([])
  const [documents, setDocuments] = useState<EvidenceDocumentItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [validationResult, setValidationResult] = useState<ValidationChecklistResult>(financeStore.validateRecord())

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showAddExpenditureModal, setShowAddExpenditureModal] = useState(false)
  const [showUploadDocModal, setShowUploadDocModal] = useState(false)
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [buFilter, setBuFilter] = useState<string>('all')

  // New expenditure form state
  const [newExpCategory, setNewExpCategory] = useState<ResourceExpenditureItem['category']>('Pollution Control')
  const [newExpDesc, setNewExpDesc] = useState('')
  const [newExpAmount, setNewExpAmount] = useState<number>(0)
  const [newExpSource, setNewExpSource] = useState<'CapEx' | 'OpEx'>('CapEx')

  // New document form state
  const [newDocName, setNewDocName] = useState('')
  const [newDocCategory, setNewDocCategory] = useState<EvidenceDocumentItem['category']>('Financial Statement')
  const [newDocLinked, setNewDocLinked] = useState<'Financial Summary' | 'Resource Expenditure'>('Financial Summary')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  // Drag and drop ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load store data
  const refreshData = () => {
    setAssignments(financeStore.getAssignments())
    setFinancialData(financeStore.getFinancialSummary())
    setExpenditures(financeStore.getExpenditures())
    setDocuments(financeStore.getEvidenceDocuments())
    setSubmissions(financeStore.getSubmissions())
    setActivities(financeStore.getActivities())
    setValidationResult(financeStore.validateRecord())
  }

  useEffect(() => {
    refreshData()
  }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Handle financial summary edits
  const handleFinancialFieldChange = (field: keyof FinancialSummaryData, val: any) => {
    const updated = { ...financialData, [field]: val }
    setFinancialData(updated)
    financeStore.saveFinancialSummary(updated)
    setValidationResult(financeStore.validateRecord())
  }

  // Save draft action
  const handleSaveDraft = () => {
    setSaveStatus('saving')
    setTimeout(() => {
      financeStore.saveFinancialSummary(financialData)
      financeStore.logActivity(
        'Draft saved',
        'Financial Summary — Gayatri Solar Plant draft saved to local secure store',
        'saved',
        'MEIL-SOL-GJT'
      )
      refreshData()
      setSaveStatus('saved')
      showToast('Draft successfully saved to secure storage')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 400)
  }

  // Manual validation trigger
  const handleValidateData = () => {
    const res = financeStore.validateRecord()
    setValidationResult(res)
    if (res.readyForSubmission) {
      showToast('All validation checks passed! Ready for submission.')
    } else {
      showToast(`Validation: ${res.blockingErrors.length} blocking error(s) found.`)
    }
  }

  // Add expenditure item
  const handleAddExpenditure = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExpDesc || newExpAmount <= 0) {
      alert('Please enter a valid description and positive amount.')
      return
    }
    const item: ResourceExpenditureItem = {
      id: `exp-${Date.now()}`,
      category: newExpCategory,
      description: newExpDesc,
      amount: Number(newExpAmount),
      accountingPeriod: 'FY 2026-27',
      source: newExpSource,
      status: 'Draft',
      dateAdded: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    financeStore.addExpenditure(item)
    setShowAddExpenditureModal(false)
    setNewExpDesc('')
    setNewExpAmount(0)
    refreshData()
    showToast(`Added ₹ ${item.amount.toFixed(2)} Cr to ${item.category}`)
  }

  // Delete expenditure item
  const handleDeleteExpenditure = (id: string) => {
    if (confirm('Are you sure you want to delete this expenditure line item?')) {
      financeStore.deleteExpenditure(id)
      refreshData()
      showToast('Expenditure line item removed')
    }
  }

  // Add uploaded document simulation
  const handleUploadDocument = (filename?: string) => {
    const docName = filename || newDocName || 'Financial_Schedule_Annexure.pdf'
    setUploadProgress(10)
    const timer = setInterval(() => {
      setUploadProgress(p => {
        if (!p || p >= 90) {
          clearInterval(timer)
          const doc: EvidenceDocumentItem = {
            id: `doc-${Date.now()}`,
            documentName: docName,
            category: newDocCategory,
            linkedTo: newDocLinked,
            uploadDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            uploadedBy: 'Rakesh Verma',
            size: '2.4 MB',
            status: 'Under Review'
          }
          financeStore.addEvidenceDocument(doc)
          setShowUploadDocModal(false)
          setNewDocName('')
          refreshData()
          showToast(`Uploaded ${doc.documentName} successfully`)
          return null
        }
        return p + 30
      })
    }, 150)
  }

  // Delete evidence document
  const handleDeleteDocument = (id: string) => {
    if (confirm('Delete this supporting evidence document?')) {
      financeStore.deleteEvidenceDocument(id)
      refreshData()
      showToast('Document deleted')
    }
  }

  // Submit record for review
  const handleSubmitForReview = () => {
    const res = financeStore.validateRecord()
    if (!res.readyForSubmission) {
      alert(`Cannot submit: ${res.blockingErrors.join('\n')}`)
      return
    }
    financeStore.submitRecordForReview('MEIL-SOL-GJT')
    refreshData()
    showToast('Record submitted for BU review approval!')
    setActiveModule('fin-submissions')
  }

  // Resubmit record returned for correction
  const handleResubmit = (subId: string) => {
    financeStore.resubmitRecord(subId)
    refreshData()
    setSelectedSubmission(null)
    showToast('Corrected record resubmitted for review approval!')
  }

  // Calculations for display
  const totalResourceExpenditure = financeStore.getTotalResourceExpenditure()
  const distribution = financeStore.getCategoryDistribution()
  const yoyTurnover = financeStore.calculateYoY(financialData.turnover, financialData.previousTurnover)

  /* -------------------------------------------------------------------------- */
  /* STEPPER COMPONENT FOR ENTRY SCREENS (Panels 2, 3, 4)                       */
  /* -------------------------------------------------------------------------- */
  const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = [
      { num: 1, label: 'Reporting Information', moduleKey: 'fin-data' as const },
      { num: 2, label: 'Financial Summary', moduleKey: 'fin-data' as const },
      { num: 3, label: 'Resource Expenditure', moduleKey: 'fin-expenditure' as const },
      { num: 4, label: 'Evidence & Validation', moduleKey: 'fin-evidence' as const }
    ]

    return (
      <div className="relative mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {steps.map((st, idx) => {
            const isCurrent = currentStep === st.num
            const isDone = currentStep > st.num

            return (
              <React.Fragment key={st.num}>
                <button
                  type="button"
                  onClick={() => setActiveModule(st.moduleKey)}
                  className="flex items-center gap-2.5 text-left transition hover:opacity-85"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                    isCurrent
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ring-4 ring-blue-100'
                      : isDone
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-400'
                  }`}>
                    {isDone ? <Check className="h-4 w-4" /> : st.num}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isCurrent ? 'text-blue-900' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                      {st.label}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">
                      {isCurrent ? 'Current' : isDone ? 'Completed' : 'Upcoming'}
                    </div>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <div className="hidden h-0.5 w-12 bg-slate-200 md:block lg:w-20" />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-blue-200 bg-white/95 px-5 py-3 shadow-2xl backdrop-blur-md text-xs font-bold text-slate-800"
          >
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 2 — MY ASSIGNMENTS                                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-assignments' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">My Assignments</h1>
                <p className="text-xs font-medium text-slate-500">
                  Every entity, project, reporting period, and data module assigned to your scope
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Returned for Correction">Returned for Correction</option>
                </select>

                <select
                  value={buFilter}
                  onChange={e => setBuFilter(e.target.value)}
                  className="rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All Business Units</option>
                  <option value="Solar BU">Solar BU</option>
                  <option value="Infra BU">Infra BU</option>
                  <option value="Ports BU">Ports BU</option>
                </select>

                <button
                  onClick={() => { setStatusFilter('all'); setBuFilter('all'); }}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Assignments Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Project / Entity</th>
                    <th className="pb-3">Business Unit</th>
                    <th className="pb-3">Period</th>
                    <th className="pb-3">Module</th>
                    <th className="pb-3">Completion</th>
                    <th className="pb-3">Evidence</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {assignments
                    .filter(a => statusFilter === 'all' || a.status === statusFilter)
                    .filter(a => buFilter === 'all' || a.businessUnit === buFilter)
                    .map(item => (
                      <tr key={item.id} className="group hover:bg-blue-50/40 transition">
                        <td className="py-4 pl-2 font-bold text-slate-800">
                          <div>{item.entityName}</div>
                          <div className="text-[10px] font-medium text-slate-400">{item.entityId}</div>
                        </td>
                        <td className="py-4 text-slate-600 font-medium">{item.businessUnit}</td>
                        <td className="py-4 text-slate-500">{item.reportingPeriod}</td>
                        <td className="py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            item.module === 'Financial Summary'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          }`}>
                            {item.module}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${
                                  item.completion === 100 ? 'bg-blue-600' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${item.completion}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700">{item.completion}%</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {item.evidenceStatus}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            item.status === 'In Progress'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Draft'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : item.status === 'Returned for Correction'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 pr-2 text-right">
                          {item.status === 'Submitted' ? (
                            <button
                              onClick={() => setActiveModule('fin-submissions')}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                            >
                              <span>View</span>
                              <Eye className="h-3 w-3" />
                            </button>
                          ) : item.status === 'Returned for Correction' ? (
                            <button
                              onClick={() => setActiveModule('fin-data')}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
                            >
                              <span>Fix Correction</span>
                              <Edit3 className="h-3 w-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (item.module === 'Resource Expenditure') {
                                  setActiveModule('fin-expenditure')
                                } else {
                                  setActiveModule('fin-data')
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                            >
                              <span>{item.completion > 0 ? 'Continue Draft' : 'Enter Data'}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 3 — FINANCIAL DATA ENTRY (Matching Panel 2)                     */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-data' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900">Financial Data Entry</h1>
                    <p className="text-xs font-medium text-slate-500">
                      Enter verified financial figures for the assigned entity
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
                  Gayatri Solar Plant (MEIL-SOL-GJT) · FY 2026-27
                </div>
                <button
                  onClick={() => setActiveModule('fin-assignments')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Assignments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper (Step 2 active) */}
          <Stepper currentStep={2} />

          {/* Step 1: Reporting Information (Read-only / Pre-filled) */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
                1
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">1. Reporting Information</h2>
                <p className="text-xs text-slate-500">Entity details (pre-filled from assignment)</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Entity / Company Name</label>
                <input
                  type="text"
                  readOnly
                  value="Gayatri Solar Plant"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Entity ID</label>
                <input
                  type="text"
                  readOnly
                  value="MEIL-SOL-GJT"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Business Unit</label>
                <input
                  type="text"
                  readOnly
                  value="Solar BU"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Location</label>
                <input
                  type="text"
                  readOnly
                  value="Andhra Pradesh, India"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Reporting Financial Year</label>
                <input
                  type="text"
                  readOnly
                  value="FY 2026-27"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">BRSR Reporting Period</label>
                <input
                  type="text"
                  readOnly
                  value="1 April 2026 - 31 March 2027"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Currency</label>
                <input
                  type="text"
                  readOnly
                  value="INR (₹)"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Prepared By</label>
                <input
                  type="text"
                  readOnly
                  value="Rakesh Verma"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Submission ID</label>
                <input
                  type="text"
                  readOnly
                  value="AUTO-GENERATED (MEIL-SOL-GJT-2026-01)"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Financial Summary Form (Matching Panel 2) */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
                  2
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">2. Financial Summary</h2>
                  <p className="text-xs text-slate-500">
                    Enter verified financial figures from authorized financial records
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600">YoY Growth:</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                  {yoyTurnover.text}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Turnover */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Total Turnover / Revenue <span className="text-rose-500">*</span>
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.turnover}
                    onChange={e => handleFinancialFieldChange('turnover', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                  <select
                    value={financialData.turnoverUnit}
                    onChange={e => handleFinancialFieldChange('turnoverUnit', e.target.value)}
                    className="rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none"
                  >
                    <option value="Crore">Crore</option>
                    <option value="Lakh">Lakh</option>
                    <option value="Thousand">Thousand</option>
                  </select>
                </div>
              </div>

              {/* Previous FY Turnover */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Previous FY Turnover
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.previousTurnover}
                    onChange={e => handleFinancialFieldChange('previousTurnover', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                  <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                    Crore
                  </span>
                </div>
              </div>

              {/* Total Expenditure */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Total Expenditure
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.totalExpenditure}
                    onChange={e => handleFinancialFieldChange('totalExpenditure', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                  <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                    Crore
                  </span>
                </div>
              </div>

              {/* CapEx */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Capital Expenditure (CapEx)
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.capEx}
                    onChange={e => handleFinancialFieldChange('capEx', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                  <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                    Crore
                  </span>
                </div>
              </div>

              {/* OpEx */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Operating Expenditure (OpEx)
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.opEx}
                    onChange={e => handleFinancialFieldChange('opEx', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                  <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                    Crore
                  </span>
                </div>
              </div>

              {/* Environmental Expenditure */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Environmental Expenditure
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.environmentalSpend}
                    onChange={e => handleFinancialFieldChange('environmentalSpend', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                  <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                    Crore
                  </span>
                </div>
              </div>

              {/* Data Source */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Financial Data Source <span className="text-rose-500">*</span>
                </label>
                <select
                  value={financialData.dataSource}
                  onChange={e => handleFinancialFieldChange('dataSource', e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="Audited Financial Statement">Audited Financial Statement</option>
                  <option value="Approved Financial Statement">Approved Financial Statement</option>
                  <option value="General Ledger Extract">General Ledger Extract</option>
                  <option value="Approved Finance Report">Approved Finance Report</option>
                  <option value="Other Documented Source">Other Documented Source</option>
                </select>
              </div>

              {/* Document Reference */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Document Reference
                </label>
                <input
                  type="text"
                  value={financialData.documentReference}
                  onChange={e => handleFinancialFieldChange('documentReference', e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Supporting Remarks
                </label>
                <input
                  type="text"
                  placeholder="Enter any additional remarks..."
                  value={financialData.remarks}
                  onChange={e => handleFinancialFieldChange('remarks', e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveModule('fin-assignments')}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Assignments</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : 'Save as Draft'}</span>
              </button>

              <button
                onClick={handleValidateData}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validate Data</span>
              </button>

              <button
                onClick={() => setActiveModule('fin-expenditure')}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
              >
                <span>Next: Resource Expenditure</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 4 — RESOURCE EXPENDITURE (Matching Panel 3)                     */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-expenditure' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Resource Expenditure</h1>
                  <p className="text-xs font-medium text-slate-500">
                    Enter expenditure related to environment and resource-efficiency initiatives
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
                  Gayatri Solar Plant (MEIL-SOL-GJT) · FY 2026-27
                </div>
                <button
                  onClick={() => setActiveModule('fin-assignments')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Assignments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper (Step 3 active) */}
          <Stepper currentStep={3} />

          {/* Resource-Related Expenditure Table */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Resource-Related Expenditure</h2>
                <p className="text-xs text-slate-500">Enter category-wise expenditure details</p>
              </div>

              <button
                onClick={() => setShowAddExpenditureModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Record</span>
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Category</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Amount (₹ Crore)</th>
                    <th className="pb-3">Accounting Period</th>
                    <th className="pb-3">Source</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {expenditures.map(item => (
                    <tr key={item.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-bold text-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            item.category === 'Pollution Control' ? 'bg-rose-500' :
                            item.category === 'Energy Efficiency' ? 'bg-amber-500' :
                            item.category === 'Renewable Energy' ? 'bg-emerald-500' :
                            item.category === 'Water Conservation' ? 'bg-cyan-500' :
                            item.category === 'Waste Management' ? 'bg-indigo-500' : 'bg-purple-500'
                          }`} />
                          <span>{item.category}</span>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600 font-medium">{item.description}</td>
                      <td className="py-4 font-bold text-slate-900">
                        {item.amount.toFixed(2)}
                      </td>
                      <td className="py-4 text-slate-500">{item.accountingPeriod}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.source === 'CapEx'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {item.source}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const newAmt = prompt(`Update amount for ${item.description} (in ₹ Cr):`, String(item.amount))
                              if (newAmt && !isNaN(Number(newAmt))) {
                                financeStore.updateExpenditure(item.id, { amount: Number(newAmt) })
                                refreshData()
                                showToast('Expenditure amount updated')
                              }
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            title="Edit Record"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpenditure(item.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Summary Cards (Total + Category Distribution) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Total Resource Expenditure Card */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Resource Expenditure
              </div>
              <div className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                ₹ {totalResourceExpenditure.toFixed(2)} <span className="text-xl font-bold text-slate-600">Cr</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Environmental and resource-efficiency expenditure
              </div>
            </div>

            {/* Category Distribution Bar */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Category Distribution</h3>
                  <span className="text-[11px] font-semibold text-slate-400">Amount in ₹ Crore</span>
                </div>

                {/* Multi-segment progress bar */}
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {distribution.map(d => (
                    <div
                      key={d.category}
                      style={{ width: `${d.percentage}%` }}
                      className={`${d.color}`}
                      title={`${d.category}: ₹ ${d.amount.toFixed(2)} Cr (${d.percentage.toFixed(0)}%)`}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                  {distribution.map(d => (
                    <div key={d.category} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${d.color}`} />
                      <span>{d.category}</span>
                      <span className="font-bold text-slate-900">
                        {d.percentage.toFixed(0)}% ({d.amount.toFixed(1)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveModule('fin-data')}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back: Financial Summary</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save as Draft</span>
              </button>

              <button
                onClick={handleValidateData}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validate Data</span>
              </button>

              <button
                onClick={() => setActiveModule('fin-evidence')}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
              >
                <span>Next: Evidence & Validation</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 5 — EVIDENCE & DOCUMENTS (Matching Panel 4)                     */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-evidence' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Evidence & Documents</h1>
                  <p className="text-xs font-medium text-slate-500">
                    Upload supporting documents and validate submission
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
                  Gayatri Solar Plant (MEIL-SOL-GJT) · FY 2026-27
                </div>
                <button
                  onClick={() => setActiveModule('fin-assignments')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Assignments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper (Step 4 active) */}
          <Stepper currentStep={4} />

          {/* TWO COLUMNS: Left Upload + Right Validation Checklist */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Document Upload Drag-and-drop Area (6 Cols) */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Document Upload</h2>
                <p className="text-xs text-slate-500">Upload supporting financial records</p>

                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50/80"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.csv"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        handleUploadDocument(e.target.files[0].name)
                      }
                    }}
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-xs">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-800">
                    Drag & drop files here or <span className="text-blue-600 underline">click to upload</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Supported formats: PDF, XLSX, CSV (Max 25 MB)
                  </div>

                  {uploadProgress !== null && (
                    <div className="mt-4 w-full max-w-xs">
                      <div className="flex justify-between text-[11px] font-bold text-slate-600">
                        <span>Uploading…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Stored under encrypted AWS S3 / Azure Blob vault</span>
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(true)}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Add with custom metadata →
                </button>
              </div>
            </div>

            {/* Right: Validation Checklist (6 Cols) */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Validation Checklist</h2>
                <p className="text-xs text-slate-500">Check data completeness before submission</p>

                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Financial summary completed', passed: validationResult.financialSummaryCompleted },
                    { label: 'Resource expenditure completed', passed: validationResult.resourceExpenditureCompleted },
                    { label: 'Required documents uploaded', passed: validationResult.requiredDocumentsUploaded },
                    { label: 'Previous year comparison available', passed: validationResult.previousYearComparisonAvailable },
                    { label: 'Remarks provided (if required)', passed: validationResult.remarksProvided },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        item.passed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {item.passed ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className={`text-xs font-semibold ${item.passed ? 'text-slate-800' : 'text-rose-600'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status pill */}
              <div className="mt-6">
                <div className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold shadow-xs ${
                  validationResult.readyForSubmission
                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border border-amber-300 bg-amber-50 text-amber-800'
                }`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${validationResult.readyForSubmission ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span>{validationResult.readyForSubmission ? 'Ready for submission' : 'Pending items before submission'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded Documents Table */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Uploaded Documents</h2>
                <p className="text-xs text-slate-500">Linked to this reporting submission</p>
              </div>

              <button
                onClick={() => setShowUploadDocModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Upload Document</span>
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Document Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Linked To</th>
                    <th className="pb-3">Upload Date</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {documents.map(doc => (
                    <tr key={doc.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>{doc.documentName}</span>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600 font-medium">{doc.category}</td>
                      <td className="py-4 text-slate-500">{doc.linkedTo}</td>
                      <td className="py-4 text-slate-500">{doc.uploadDate}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          doc.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : doc.status === 'Under Review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => alert(`Previewing secure document: ${doc.documentName}`)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            title="Preview Document"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => alert(`Downloading verified attachment: ${doc.documentName}`)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            title="Download Document"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <div className="text-xs font-bold text-slate-700">Submission Actions</div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save as Draft</span>
              </button>

              <button
                onClick={handleValidateData}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validate Data</span>
              </button>

              <button
                onClick={handleSubmitForReview}
                disabled={!validationResult.readyForSubmission}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md transition ${
                  validationResult.readyForSubmission
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit for Review</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 6 — MY SUBMISSIONS                                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-submissions' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">My Submissions</h1>
                <p className="text-xs font-medium text-slate-500">
                  Track records you submitted, check review feedback, and correct returned entries
                </p>
              </div>

              <button
                onClick={() => setActiveModule('fin-data')}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start md:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Financial Entry</span>
              </button>
            </div>

            {/* Summary Counters */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-slate-500">Drafts</div>
                <div className="mt-1 text-2xl font-black text-slate-800">
                  {submissions.filter(s => s.status === 'Draft').length}
                </div>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-blue-700">Submitted</div>
                <div className="mt-1 text-2xl font-black text-blue-900">
                  {submissions.filter(s => s.status === 'Submitted').length}
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-indigo-700">Under Review</div>
                <div className="mt-1 text-2xl font-black text-indigo-900">
                  {submissions.filter(s => s.status === 'Under Review').length}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-rose-700">Returned</div>
                <div className="mt-1 text-2xl font-black text-rose-900">
                  {submissions.filter(s => s.status === 'Returned for Correction').length}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-emerald-700">Accepted</div>
                <div className="mt-1 text-2xl font-black text-emerald-900">
                  {submissions.filter(s => s.status === 'Accepted').length}
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Submission ID</th>
                    <th className="pb-3">Entity</th>
                    <th className="pb-3">FY</th>
                    <th className="pb-3">Module</th>
                    <th className="pb-3">Submitted Date</th>
                    <th className="pb-3">Reviewer</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-mono font-bold text-blue-700">
                        {sub.id}
                      </td>
                      <td className="py-4 font-bold text-slate-800">{sub.entityName}</td>
                      <td className="py-4 text-slate-600">{sub.financialYear}</td>
                      <td className="py-4 text-slate-600 font-medium">{sub.module}</td>
                      <td className="py-4 text-slate-500">{sub.submittedDate}</td>
                      <td className="py-4 text-slate-600">{sub.reviewer}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          sub.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'Returned for Correction'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : sub.status === 'Under Review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                          >
                            <span>Details</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                          {sub.status === 'Returned for Correction' && (
                            <button
                              onClick={() => {
                                setActiveModule('fin-data')
                                showToast('Reviewer comments loaded for correction.')
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
                            >
                              <span>Correct</span>
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submission Details Modal / Drawer */}
          <AnimatePresence>
            {selectedSubmission && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs font-mono font-bold text-blue-600">
                        {selectedSubmission.id}
                      </div>
                      <h3 className="text-lg font-black text-slate-900">
                        {selectedSubmission.entityName}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Comments from reviewer */}
                  {selectedSubmission.latestComment && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Reviewer Feedback ({selectedSubmission.reviewer})</span>
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-slate-700">
                        "{selectedSubmission.latestComment}"
                      </p>
                    </div>
                  )}

                  {/* Submission Timeline */}
                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Submission History & Timeline
                    </h4>
                    <div className="mt-3 space-y-3">
                      {selectedSubmission.timeline.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <Clock className="h-3 w-3" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{item.step}</span>
                            <span className="text-slate-400"> by {item.actor}</span>
                            <div className="text-[11px] text-slate-400">{item.timestamp}</div>
                            {item.note && <div className="mt-0.5 text-slate-600 italic">"{item.note}"</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions inside modal */}
                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                    {selectedSubmission.status === 'Returned for Correction' && (
                      <button
                        onClick={() => handleResubmit(selectedSubmission.id)}
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        Resubmit for Review
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 7 — REPORTS & EXPORTS                                           */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-reports' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <h1 className="text-2xl font-black text-slate-900">Reports & Exports</h1>
            <p className="text-xs font-medium text-slate-500">
              Authorized exports and compliance data extractions for SEBI BRSR and management audits
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Report 1: Financial Summary */}
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Financial Summary Report</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Turnover, YoY comparisons, CapEx/OpEx and official source citations for FY 2026-27.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      financeStore.exportFinancialSummaryCSV()
                      showToast('Exported Financial Summary CSV')
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Report 2: Resource Expenditure */}
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Resource Expenditure Report</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Category-wise environmental initiatives, clean energy CapEx, and water conservation spend.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      financeStore.exportResourceExpendituresCSV()
                      showToast('Exported Resource Expenditures CSV')
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Report 3: BRSR Section A/C Supporting Schedule */}
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">BRSR Financial Schedules</h3>
                <p className="mt-1 text-xs text-slate-500">
                  SEBI Principle 6 Environmental Protection expenditure mappings and intensity denominators.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const json = JSON.stringify(financeStore.getFinancialSummary(), null, 2)
                      const blob = new Blob([json], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `meilESG_BRSR_Financial_Schedule.json`
                      a.click()
                      showToast('Exported BRSR JSON schedule')
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 8 — ACTIVITY LOG                                                */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-activity' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <h1 className="text-2xl font-black text-slate-900">Activity Log</h1>
            <p className="text-xs font-medium text-slate-500">
              Audit trail of recorded actions, draft revisions, document uploads, and validation events
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Date & Time</th>
                    <th className="pb-3">Activity Type</th>
                    <th className="pb-3">Record / Reference</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Actor</th>
                    <th className="pb-3 pr-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {activities.map(act => (
                    <tr key={act.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-mono text-slate-500">{act.timestamp}</td>
                      <td className="py-4 font-bold text-slate-800">{act.title}</td>
                      <td className="py-4 font-mono text-blue-700">{act.entity || 'MEIL-SOL-GJT'}</td>
                      <td className="py-4 text-slate-600 max-w-md">{act.description}</td>
                      <td className="py-4 text-slate-700 font-semibold">{act.actor}</td>
                      <td className="py-4 pr-2 text-right">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Success
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: ADD EXPENDITURE RECORD                                          */}
      {/* ---------------------------------------------------------------------- */}
      <AnimatePresence>
        {showAddExpenditureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Add Resource Expenditure Record</h3>
                <button onClick={() => setShowAddExpenditureModal(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddExpenditure} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={newExpCategory}
                    onChange={e => setNewExpCategory(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Pollution Control">Pollution Control</option>
                    <option value="Energy Efficiency">Energy Efficiency</option>
                    <option value="Renewable Energy">Renewable Energy</option>
                    <option value="Water Conservation">Water Conservation</option>
                    <option value="Waste Management">Waste Management</option>
                    <option value="Other Initiatives">Other Initiatives</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solar panel rooftop inverter upgrades"
                    value={newExpDesc}
                    onChange={e => setNewExpDesc(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Amount (in ₹ Crore)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newExpAmount || ''}
                      onChange={e => setNewExpAmount(parseFloat(e.target.value) || 0)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Source Type</label>
                    <select
                      value={newExpSource}
                      onChange={e => setNewExpSource(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="CapEx">CapEx</option>
                      <option value="OpEx">OpEx</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenditureModal(false)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Save Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: UPLOAD EVIDENCE DOCUMENT                                        */}
      {/* ---------------------------------------------------------------------- */}
      <AnimatePresence>
        {showUploadDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Upload Supporting Document</h3>
                <button onClick={() => setShowUploadDocModal(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Document Name / File</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solar_Plant_CapEx_Ledger_2026.pdf"
                    value={newDocName}
                    onChange={e => setNewDocName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Document Category</label>
                  <select
                    value={newDocCategory}
                    onChange={e => setNewDocCategory(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Financial Statement">Financial Statement</option>
                    <option value="Capital Expenditure">Capital Expenditure</option>
                    <option value="Operating Expenditure">Operating Expenditure</option>
                    <option value="Environmental Expenditure">Environmental Expenditure</option>
                    <option value="General Ledger Extract">General Ledger Extract</option>
                    <option value="Supporting Document">Supporting Document</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Linked Module</label>
                  <select
                    value={newDocLinked}
                    onChange={e => setNewDocLinked(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Financial Summary">Financial Summary</option>
                    <option value="Resource Expenditure">Resource Expenditure</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUploadDocModal(false)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUploadDocument()}
                    className="rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Upload Document
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
