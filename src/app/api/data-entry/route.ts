import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import {
  getLevelRecords,
  saveLevelRecord,
  deleteLevelRecord,
  type LevelRecord,
  type ValidationIssue,
  type CalculationPayload,
} from '@/lib/level-records'
import {
  appendActivity,
  appendAudit,
  appendHistory,
  parseRecordIds,
  primaryRoleLabel,
} from '@/lib/workflow'

export const runtime = 'nodejs'

// GET /api/data-entry?projectId=&periodId=&level=
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const periodId = searchParams.get('periodId') || undefined
    const levelStr = searchParams.get('level')
    const level = levelStr ? Number(levelStr) : undefined

    const records = getLevelRecords(projectId, periodId, level)
    return NextResponse.json({ records, count: records.length })
  } catch (e: any) {
    console.error('GET /api/data-entry error', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch records' }, { status: 500 })
  }
}

// POST /api/data-entry
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const body = await req.json()
    const {
      id: recordId,
      level,
      levelKey,
      levelName,
      module,
      projectId,
      reportingPeriodId,
      data = {},
      evidenceId,
    } = body

    if (!level || !projectId || !reportingPeriodId) {
      return NextResponse.json(
        { error: 'level, projectId, and reportingPeriodId are required' },
        { status: 400 },
      )
    }

    const issues: ValidationIssue[] = []
    let calculation: CalculationPayload | null = null

    // Run rules based on level
    switch (Number(level)) {
      case 1: {
        // Energy Consumption
        const qty = Number(data.consumptionQuantity)
        if (!qty || qty <= 0) {
          issues.push({
            ruleCode: 'ENG-QTY-REQUIRED',
            severity: 'ERROR',
            message: 'Consumption quantity must be greater than 0',
            field: 'consumptionQuantity',
            suggestedAction: 'Enter the actual metered or billed energy consumption.',
          })
        }
        if (data.openingMeterReading !== undefined && data.closingMeterReading !== undefined) {
          const open = Number(data.openingMeterReading)
          const close = Number(data.closingMeterReading)
          if (!isNaN(open) && !isNaN(close) && close < open) {
            issues.push({
              ruleCode: 'ENG-MTR-SEQUENCE',
              severity: 'ERROR',
              message: `Closing meter reading (${close}) cannot be lower than opening reading (${open})`,
              field: 'closingMeterReading',
              suggestedAction: 'Verify meter rollover or check logbook reading entries.',
            })
          }
        }
        if (data.energyPurchased && qty && Number(data.energyPurchased) < qty && !data.remarks) {
          issues.push({
            ruleCode: 'ENG-STOCK-RECON',
            severity: 'WARNING',
            message: 'Consumption exceeds energy purchased this period; drawing from stock inventory.',
            field: 'remarks',
            suggestedAction: 'Add a remark confirming opening stock deduction to avoid double counting.',
          })
        }

        // Calculation
        const src = String(data.energySource || '').toLowerCase()
        let factor = 0.716 // default grid
        let scope = 'SCOPE_2'
        let meth = 'CEA v19'
        let gjRate = 0.0036
        if (src.includes('diesel')) {
          factor = 2.637; scope = 'SCOPE_1'; meth = 'IPCC 2006'; gjRate = 0.0383
        } else if (src.includes('petrol')) {
          factor = 2.296; scope = 'SCOPE_1'; meth = 'IPCC 2006'; gjRate = 0.0348
        } else if (src.includes('lpg')) {
          factor = 2.98; scope = 'SCOPE_1'; meth = 'IPCC 2006'; gjRate = 0.046
        } else if (src.includes('coal')) {
          factor = 1.9; scope = 'SCOPE_1'; meth = 'IPCC 2006'; gjRate = 0.0227
        } else if (src.includes('renewable')) {
          factor = 0.04; scope = 'SCOPE_2'; meth = 'ISAE 3000'; gjRate = 0.0036
        }
        const tco2e = (qty * factor) / 1000
        const gj = qty * gjRate

        calculation = {
          calculatedValue: Number(tco2e.toFixed(3)),
          resultUnit: 'tCO2e',
          scope,
          factorId: `${meth.replace(/\s+/g, '-').toUpperCase()}-${scope}`,
          factorVersion: 1,
          methodologyNote: `${meth} (${factor} kgCO2e/unit) deterministic calculation`,
          normalizedValue: Number(gj.toFixed(2)),
          normalizedUnit: 'GJ',
          sourceValue: qty,
          sourceUnit: data.unit || 'kWh',
        }
        break
      }

      case 2: {
        // Water Management
        const qty = Number(data.waterQuantity)
        if (!qty || qty <= 0) {
          issues.push({
            ruleCode: 'WTR-QTY-POSITIVE',
            severity: 'ERROR',
            message: 'Water quantity must be greater than 0',
            field: 'waterQuantity',
            suggestedAction: 'Enter the measured water quantity in kL.',
          })
        }
        if (data.openingReading !== undefined && data.closingReading !== undefined) {
          const open = Number(data.openingReading)
          const close = Number(data.closingReading)
          if (!isNaN(open) && !isNaN(close) && close < open) {
            issues.push({
              ruleCode: 'WTR-MTR-SEQUENCE',
              severity: 'ERROR',
              message: 'Closing water reading cannot be lower than opening reading',
              field: 'closingReading',
            })
          }
        }
        const reused = Number(data.waterReusedRecycled) || 0
        const act = String(data.waterActivity || '').toLowerCase()
        const net = act.includes('withdrawal') ? Math.max(0, qty - reused) : qty
        calculation = {
          calculatedValue: Number(net.toFixed(2)),
          resultUnit: 'kL Net Impact',
          scope: 'WATER_CIRCULARITY',
          methodologyNote: `Water activity: ${data.waterActivity}. Reused quantity: ${reused} kL.`,
          sourceValue: qty,
          sourceUnit: data.unit || 'kL',
        }
        break
      }

      case 3: {
        // GHG & Air Quality
        const actQty = Number(data.activityQuantity) || 0
        if (!actQty && !data.testResult) {
          issues.push({
            ruleCode: 'GHG-MEASURE-REQUIRED',
            severity: 'ERROR',
            message: 'Either activity quantity or measured test result must be provided',
            field: 'activityQuantity',
          })
        }
        const isScope1 = String(data.emissionDataType || '').includes('Scope 1')
        const tco2e = actQty > 0 ? (actQty * (isScope1 ? 2.637 : 0.716)) / 1000 : 0
        calculation = {
          calculatedValue: Number(tco2e.toFixed(3)),
          resultUnit: data.testResult ? 'Test Result Logged' : 'tCO2e',
          scope: isScope1 ? 'SCOPE_1' : 'SCOPE_2',
          methodologyNote: data.calculationMethod || 'Central ESG emission factors model',
          sourceValue: actQty,
          sourceUnit: data.unit || 'litres',
        }
        break
      }

      case 4: {
        // Waste Management
        const gen = Number(data.quantityGenerated)
        if (gen === undefined || isNaN(gen) || gen < 0) {
          issues.push({
            ruleCode: 'WST-GEN-NONNEGATIVE',
            severity: 'ERROR',
            message: 'Quantity generated must be ≥ 0',
            field: 'quantityGenerated',
          })
        }
        const isHazardous = String(data.wasteCategory || '').toLowerCase().includes('hazard')
        if (isHazardous && !data.transferManifestNumber) {
          issues.push({
            ruleCode: 'WST-HAZ-MANIFEST',
            severity: 'ERROR',
            message: 'Hazardous waste manifests (Form 10 / Manifest #) are mandatory under SPCB regulations',
            field: 'transferManifestNumber',
            suggestedAction: 'Enter the Form 10 manifest or transport authorization reference.',
          })
        }
        const reused = Number(data.quantityReused) || 0
        const recycled = Number(data.quantityRecycled) || 0
        const recovered = Number(data.quantityRecovered) || 0
        const disposed = Number(data.quantityDisposed) || 0
        const sumOut = reused + recycled + recovered + disposed
        if (gen > 0 && Math.abs(sumOut - gen) > 0.05 * gen && !data.remarks) {
          issues.push({
            ruleCode: 'WST-RECON-DIFF',
            severity: 'WARNING',
            message: `Disposed/diverted total (${sumOut.toFixed(2)}) differs from generated (${gen.toFixed(2)}) by >5%`,
            field: 'remarks',
            suggestedAction: 'Explain stock accumulation or interim yard storage in Remarks.',
          })
        }
        const divRate = gen > 0 ? Math.min(100, ((reused + recycled + recovered) / gen) * 100) : 0
        calculation = {
          calculatedValue: Number(divRate.toFixed(2)),
          resultUnit: '% Diversion from Disposal',
          scope: 'WASTE_CIRCULARITY',
          methodologyNote: `Diversion: (Reused ${reused} + Recycled ${recycled} + Recovered ${recovered}) / Gen ${gen}`,
          sourceValue: gen,
          sourceUnit: data.unit || 'MT',
        }
        break
      }

      case 5: {
        // Health & Safety
        const mhw = Number(data.totalPersonHoursWorked) || 0
        if (mhw <= 0) {
          issues.push({
            ruleCode: 'SAF-HOURS-REQUIRED',
            severity: 'ERROR',
            message: 'Total person-hours worked must be > 0 for safety rate derivation',
            field: 'totalPersonHoursWorked',
          })
        }
        const isLti = String(data.incidentType || '').toLowerCase().includes('lost-time') || String(data.incidentType || '').toLowerCase().includes('lti')
        const ltiCount = isLti ? 1 : 0
        const ltifr = mhw > 0 ? Number(((ltiCount * 1000000) / mhw).toFixed(3)) : 0
        calculation = {
          calculatedValue: ltifr,
          resultUnit: 'LTIFR (/1M person-hrs)',
          scope: 'BRSR_SAFETY',
          derivedLtifr: ltifr,
          methodologyNote: `Formula: (${ltiCount} LTI × 1,000,000) / ${mhw} person-hours`,
          sourceValue: mhw,
          sourceUnit: 'Hours',
        }
        break
      }

      case 6: {
        // Training & Workforce Well-being
        if (!data.trainingProgramme) {
          issues.push({
            ruleCode: 'TRN-PROG-NAME',
            severity: 'ERROR',
            message: 'Training programme name is required',
            field: 'trainingProgramme',
          })
        }
        const pCount = Number(data.participants) || 0
        const dur = Number(data.duration) || 0
        const durHours = String(data.durationUnit || '').toLowerCase().includes('min') ? dur / 60 : dur
        const personHours = pCount * durHours
        calculation = {
          calculatedValue: Number(personHours.toFixed(1)),
          resultUnit: 'Person-Training-Hours',
          scope: 'BRSR_PEOPLE',
          methodologyNote: `${pCount} participants × ${durHours.toFixed(1)} hours`,
          sourceValue: pCount,
          sourceUnit: 'Participants',
        }
        break
      }

      case 7: {
        // Environmental Compliance & Permits
        if (!data.permitNumber) {
          issues.push({
            ruleCode: 'ENV-PERMIT-NUM',
            severity: 'ERROR',
            message: 'Official permit / consent number is required',
            field: 'permitNumber',
          })
        }
        if (!data.expiryDate) {
          issues.push({
            ruleCode: 'ENV-EXPIRY-DATE',
            severity: 'WARNING',
            message: 'Expiry date is recommended for compliance monitoring and renewal alerts',
            field: 'expiryDate',
          })
        }
        if (data.nonComplianceIdentified && String(data.nonComplianceIdentified).includes('Yes') && !data.correctiveAction) {
          issues.push({
            ruleCode: 'ENV-REMEDY-PLAN',
            severity: 'ERROR',
            message: 'Corrective action plan and target due date are required for recorded non-compliances',
            field: 'correctiveAction',
          })
        }
        let daysLeft = 365
        if (data.expiryDate) {
          const exp = new Date(data.expiryDate).getTime()
          const now = Date.now()
          daysLeft = Math.round((exp - now) / 86400000)
        }
        calculation = {
          calculatedValue: daysLeft,
          resultUnit: 'Days until Expiration',
          scope: 'STATUTORY_COMPLIANCE',
          methodologyNote: daysLeft > 90 ? 'Consent valid & active' : daysLeft > 0 ? 'Renewal in progress window' : 'Expired — immediate action needed',
          sourceValue: daysLeft,
          sourceUnit: 'Days',
        }
        break
      }

      case 8: {
        // Incidents & Grievances
        if (!data.dateReported) {
          issues.push({
            ruleCode: 'GRV-DATE-REQUIRED',
            severity: 'ERROR',
            message: 'Date reported must be recorded',
            field: 'dateReported',
          })
        }
        if (!data.description) {
          issues.push({
            ruleCode: 'GRV-DESC-REQUIRED',
            severity: 'ERROR',
            message: 'Factual incident or grievance description is required',
            field: 'description',
          })
        }
        calculation = {
          calculatedValue: 1,
          resultUnit: 'Logged Incident / Grievance',
          scope: 'STAKEHOLDER_GOVERNANCE',
          methodologyNote: `Status: ${data.currentStatus || 'Open'}. Severity: ${data.impactSeverity || 'Standard'}.`,
        }
        break
      }

      case 9: {
        // Resource-efficiency Initiatives
        if (!data.activityInitiativeName) {
          issues.push({
            ruleCode: 'OPS-INITIATIVE-NAME',
            severity: 'ERROR',
            message: 'Initiative or project name is required',
            field: 'activityInitiativeName',
          })
        }
        const base = Number(data.baselineValue) || 0
        const rep = Number(data.reportingPeriodValue) || 0
        const diff = Math.max(0, base - rep)
        const pct = base > 0 ? ((diff / base) * 100).toFixed(1) : '0'
        calculation = {
          calculatedValue: Number(diff.toFixed(2)),
          resultUnit: `Achieved Reduction (${pct}%)`,
          scope: 'RESOURCE_EFFICIENCY',
          methodologyNote: `Baseline: ${base} vs Reporting: ${rep}. Achieved reduction: ${diff}.`,
          sourceValue: rep,
          sourceUnit: data.outputUnit || 'Units',
        }
        break
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'ERROR' || i.severity === 'BLOCKING')
    const hasWarnings = issues.some((i) => i.severity === 'WARNING')
    const validationStatus = hasErrors ? 'FAILED' : hasWarnings ? 'WARNING' : 'PASSED'

    const recId = recordId || `rec-l${level}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const record: LevelRecord = {
      id: recId,
      level: Number(level),
      levelKey: levelKey || `level${level}`,
      levelName: levelName || `Level ${level}`,
      module: module || 'ESG',
      projectId,
      reportingPeriodId,
      data,
      evidenceId: evidenceId || null,
      validationStatus,
      calculationStatus: calculation ? 'COMPUTED' : 'NOT_APPLICABLE',
      calculation,
      issues,
      status: 'DRAFT',
      revisionNumber: 1,
      enteredBy: user.name || 'Site User',
      enteredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    saveLevelRecord(record)

    // Sync to Prisma tables if Level 1, 2, 4, 5, 6
    try {
      if (Number(level) === 1 && !hasErrors) {
        await db.energyRecord.upsert({
          where: { id: recId },
          update: {
            source: data.energySource || 'Grid Electricity',
            quantity: Number(data.consumptionQuantity) || 1,
            sourceUnit: data.unit || 'KWH',
            vendor: data.sourceDocument || 'Meter Log',
            meterRef: data.meterEquipmentId || 'SITE-MTR',
            evidenceId: evidenceId || null,
            validationStatus,
            status: 'DRAFT',
          },
          create: {
            id: recId,
            projectId,
            reportingPeriodId,
            source: data.energySource || 'Grid Electricity',
            sourceCategory: String(data.energySource || '').toLowerCase().includes('renew') ? 'RENEWABLE' : 'NON_RENEWABLE',
            quantity: Number(data.consumptionQuantity) || 1,
            sourceUnit: data.unit || 'KWH',
            vendor: data.sourceDocument || 'Meter Log',
            meterRef: data.meterEquipmentId || 'SITE-MTR',
            evidenceId: evidenceId || null,
            validationStatus,
            status: 'DRAFT',
            enteredBy: user.name,
          },
        }).catch(() => {})
      } else if (Number(level) === 2 && !hasErrors) {
        await db.waterRecord.upsert({
          where: { id: recId },
          update: {
            source: data.waterSource || 'Groundwater',
            withdrawal: Number(data.waterQuantity) || 1,
            consumption: calculation?.calculatedValue || 0,
            recycledReused: Number(data.waterReusedRecycled) || 0,
            treatment: data.treatmentLevel || 'STP',
            destination: data.dischargeDestination || 'Landscaping',
            sourceUnit: data.unit || 'KL',
            evidenceId: evidenceId || null,
            validationStatus,
            status: 'DRAFT',
          },
          create: {
            id: recId,
            projectId,
            reportingPeriodId,
            source: data.waterSource || 'Groundwater',
            withdrawal: Number(data.waterQuantity) || 1,
            consumption: calculation?.calculatedValue || 0,
            recycledReused: Number(data.waterReusedRecycled) || 0,
            treatment: data.treatmentLevel || 'STP',
            destination: data.dischargeDestination || 'Landscaping',
            sourceUnit: data.unit || 'KL',
            evidenceId: evidenceId || null,
            validationStatus,
            status: 'DRAFT',
            enteredBy: user.name,
          },
        }).catch(() => {})
      } else if (Number(level) === 4 && !hasErrors) {
        await db.wasteRecord.upsert({
          where: { id: recId },
          update: {
            wasteType: data.wasteCategory || 'C&D Waste',
            generatedQty: Number(data.quantityGenerated) || 0,
            reusedQty: Number(data.quantityReused) || 0,
            recycledQty: Number(data.quantityRecycled) || 0,
            recoveredQty: Number(data.quantityRecovered) || 0,
            disposedQty: Number(data.quantityDisposed) || 0,
            manifestRef: data.transferManifestNumber || null,
            sourceUnit: data.unit || 'TON',
            evidenceId: evidenceId || null,
            validationStatus,
            status: 'DRAFT',
          },
          create: {
            id: recId,
            projectId,
            reportingPeriodId,
            wasteType: data.wasteCategory || 'C&D Waste',
            generatedQty: Number(data.quantityGenerated) || 0,
            reusedQty: Number(data.quantityReused) || 0,
            recycledQty: Number(data.quantityRecycled) || 0,
            recoveredQty: Number(data.quantityRecovered) || 0,
            disposedQty: Number(data.quantityDisposed) || 0,
            manifestRef: data.transferManifestNumber || null,
            sourceUnit: data.unit || 'TON',
            evidenceId: evidenceId || null,
            validationStatus,
            status: 'DRAFT',
            enteredBy: user.name,
          },
        }).catch(() => {})
      }
    } catch (dbErr) {
      console.warn('Prisma sync optional warning:', dbErr)
    }

    const isSubmittingForReview = Boolean(body.submitForReview)
    if (isSubmittingForReview) {
      record.status = 'SUBMITTED'
      saveLevelRecord(record)
    }

    // Auto-sync into db.submission so it immediately appears in Submissions module
    let synchedSubmission: any = null
    try {
      const proj = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, projectName: true, projectCode: true },
      })
      const per = await db.reportingPeriod.findUnique({
        where: { id: reportingPeriodId },
        select: { id: true, periodLabel: true, year: true },
      })

      const submissionTitle = `${proj?.projectName || 'Project'} — ${record.levelName} (${per?.periodLabel || 'FY 2026-27'})`

      // Look for an existing DRAFT submission for the same project + period + module
      const existingDraft = await db.submission.findFirst({
        where: {
          projectId,
          reportingPeriodId,
          module: record.module,
          status: 'DRAFT',
        },
        orderBy: { updatedAt: 'desc' },
      })

      if (existingDraft) {
        const existingRecordIds = parseRecordIds(existingDraft.recordIds)
        if (!existingRecordIds.includes(recId)) existingRecordIds.push(recId)
        synchedSubmission = await db.submission.update({
          where: { id: existingDraft.id },
          data: {
            title: submissionTitle,
            recordIds: JSON.stringify(existingRecordIds),
            status: isSubmittingForReview ? 'SUBMITTED' : 'DRAFT',
            submittedAt: isSubmittingForReview ? new Date() : null,
            submittedBy: user.id,
            completionPct: hasErrors ? 50 : 100,
            evidenceCount: evidenceId ? Math.max(1, existingDraft.evidenceCount) : existingDraft.evidenceCount,
            validationPassed: hasErrors ? 0 : Math.max(1, existingDraft.validationPassed),
            validationErrors: hasErrors ? issues.length : 0,
          },
          include: {
            project: { select: { id: true, projectCode: true, projectName: true } },
            reportingPeriod: { select: { id: true, periodLabel: true, year: true } },
          },
        })
      } else {
        synchedSubmission = await db.submission.create({
          data: {
            projectId,
            reportingPeriodId,
            module: record.module,
            title: submissionTitle,
            status: isSubmittingForReview ? 'SUBMITTED' : 'DRAFT',
            recordIds: JSON.stringify([recId]),
            submittedAt: isSubmittingForReview ? new Date() : null,
            submittedBy: user.id,
            completionPct: hasErrors ? 50 : 100,
            evidenceCount: evidenceId ? 1 : 0,
            validationPassed: hasErrors ? 0 : 1,
            validationErrors: hasErrors ? issues.length : 0,
          },
          include: {
            project: { select: { id: true, projectCode: true, projectName: true } },
            reportingPeriod: { select: { id: true, periodLabel: true, year: true } },
          },
        })
      }

      if (isSubmittingForReview && synchedSubmission) {
        await appendHistory({
          submissionId: synchedSubmission.id,
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          actorId: user.id,
          actorName: user.name,
          actorRole: primaryRoleLabel(user),
          action: 'SUBMIT',
          comment: `Submitted via Data Entry Workspace — ${record.levelName}`,
        }).catch(() => {})
      }
    } catch (syncErr) {
      console.warn('Submission synchronization notice:', syncErr)
    }

    // Append activity and audit log for cross-screen integration
    try {
      await appendActivity({
        projectId,
        actorId: user.id,
        actorName: user.name,
        actorRole: primaryRoleLabel(user),
        action: isSubmittingForReview ? 'SUBMIT' : 'DATA_ENTRY',
        title: `${record.levelName} ${isSubmittingForReview ? 'submitted for BU review' : 'saved as Draft'}`,
        description: `Source record ${recId.slice(-8)} captured with ${issues.length} issue(s).`,
        module: record.module,
        status: isSubmittingForReview ? 'SUBMITTED' : validationStatus,
      }).catch(() => {})

      await appendAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: primaryRoleLabel(user),
        action: isSubmittingForReview ? 'SUBMIT' : 'CREATE',
        entityType: 'DataEntryRecord',
        entityId: recId,
        newState: { level, levelName, validationStatus, calculation, status: record.status },
        reason: isSubmittingForReview ? 'Source record submitted for review' : 'Source record captured via Data Entry Module',
      }).catch(() => {})
    } catch {}

    return NextResponse.json({
      record,
      issues,
      calculation,
      derivedLtifr: calculation?.derivedLtifr,
      submission: synchedSubmission,
      submissionId: synchedSubmission?.id,
    })
  } catch (e: any) {
    console.error('POST /api/data-entry error', e)
    return NextResponse.json({ error: e?.message || 'Failed to save record' }, { status: 500 })
  }
}

// DELETE /api/data-entry?id=
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const ok = deleteLevelRecord(id)
    return NextResponse.json({ success: ok })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}
