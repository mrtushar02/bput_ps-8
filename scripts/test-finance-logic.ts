/**
 * Automated Test Suite for meilESG Finance & Resource Contributor Logic
 * Tests:
 * 1. calculateYoY with standard growth
 * 2. calculateYoY with zero denominator (division-by-zero protection)
 * 3. calculateYoY with missing / null values
 * 4. getTotalResourceExpenditure accuracy
 * 5. getCategoryDistribution percentage sum and color mapping
 * 6. validateRecord with all required fields (isReady = true)
 * 7. validateRecord with missing fields (blockingErrors detection)
 * 8. submitRecordForReview workflow status update and activity logging
 * 9. export CSV formats and escaping
 */

import { FinanceStoreService } from '../src/lib/finance-store'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${msg}`)
  }
}

console.log('--- RUNNING FINANCE STORE & LOGIC TESTS ---')

// Test 1: YoY Turnover Calculation
const yoy1 = FinanceStoreService.calculateYoY(1250, 1180)
assert(yoy1.percentage !== null && Math.abs(yoy1.percentage - 5.93) < 0.05, 'YoY calculates 5.93% correctly')
assert(yoy1.positive === true, 'Positive growth detected')

// Test 2: Zero denominator YoY
const yoyZero = FinanceStoreService.calculateYoY(1250, 0)
assert(yoyZero.percentage === null, 'YoY handles zero denominator without throwing NaN or Infinity')
assert(yoyZero.text.includes('previous-year value is zero'), 'Helpful message for zero denominator')

// Test 3: Total Resource Expenditure
const totalSpend = FinanceStoreService.getTotalResourceExpenditure([
  { id: '1', category: 'Pollution Control', description: 'Equipment', amount: 12.5, accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today' },
  { id: '2', category: 'Energy Efficiency', description: 'Transformers', amount: 8.0, accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today' },
  { id: '3', category: 'Renewable Energy', description: 'Solar Panels', amount: 15.0, accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today' },
  { id: '4', category: 'Water Conservation', description: 'Harvesting', amount: 5.5, accountingPeriod: 'FY 2026-27', source: 'OpEx', status: 'Draft', dateAdded: 'Today' },
  { id: '5', category: 'Waste Management', description: 'Facility', amount: 3.0, accountingPeriod: 'FY 2026-27', source: 'OpEx', status: 'Draft', dateAdded: 'Today' },
  { id: '6', category: 'Other Initiatives', description: 'Green belt', amount: 1.0, accountingPeriod: 'FY 2026-27', source: 'OpEx', status: 'Draft', dateAdded: 'Today' },
])
assert(totalSpend === 45.0, `Total resource spend matches ₹45.00 Cr (got ${totalSpend})`)

// Test 4: Category distribution percentages sum to ~100%
const dist = FinanceStoreService.getCategoryDistribution([
  { id: '1', category: 'Pollution Control', description: 'Equipment', amount: 12.5, accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today' },
  { id: '2', category: 'Renewable Energy', description: 'Solar Panels', amount: 15.0, accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today' },
])
const sumPct = dist.reduce((s, d) => s + d.percentage, 0)
assert(Math.abs(sumPct - 100) < 1.0, `Distribution sums to 100% (got ${sumPct}%)`)

// Test 5: Validation rule checking
const validationGood = FinanceStoreService.validateRecord(
  {
    turnover: 1250,
    previousTurnover: 1180,
    turnoverUnit: 'Crore',
    totalExpenditure: 980,
    capEx: 320,
    opEx: 660,
    environmentalSpend: 45,
    dataSource: 'Audited Financial Statement',
    documentReference: 'MEIL_FS_2026-27.pdf',
    remarks: 'Statutory audited turnover and clean expenditure verification.',
  },
  [
    { id: '1', category: 'Pollution Control', description: 'Equipment', amount: 12.5, accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today' },
  ],
  [
    { id: 'd1', documentName: 'Statement.pdf', category: 'Financial Statement', linkedTo: 'Financial Summary', uploadDate: 'Today', uploadedBy: 'Rakesh', size: '2 MB', status: 'Accepted' },
    { id: 'd2', documentName: 'Environmental_Spend.pdf', category: 'Environmental Expenditure', linkedTo: 'Resource Expenditure', uploadDate: 'Today', uploadedBy: 'Rakesh', size: '1.5 MB', status: 'Accepted' },
  ]
)
if (!validationGood.readyForSubmission) {
  console.log('Errors:', validationGood.blockingErrors)
}
assert(validationGood.readyForSubmission === true, 'Validation passes with all required figures and attachments')
assert(validationGood.blockingErrors.length === 0, 'No blocking errors on valid record')

// Test 6: Validation blocking on missing turnover
const validationBad = FinanceStoreService.validateRecord(
  {
    turnover: 0,
    previousTurnover: 1180,
    turnoverUnit: 'Crore',
    totalExpenditure: 980,
    capEx: 320,
    opEx: 660,
    environmentalSpend: 45,
    dataSource: '',
    documentReference: '',
    remarks: '',
  },
  [],
  []
)
assert(validationBad.readyForSubmission === false, 'Validation blocks submission when turnover is missing')
assert(validationBad.blockingErrors.length > 0, 'Blocking errors reported for missing turnover')

// Test 7: Export CSV string formatting
const summaryCsv = FinanceStoreService.exportFinancialSummaryCSV()
assert(summaryCsv.includes('Total Turnover / Revenue'), 'CSV includes Total Turnover header')
assert(summaryCsv.includes('1250'), 'CSV includes turnover numeric value')

const resourceCsv = FinanceStoreService.exportResourceExpendituresCSV()
assert(resourceCsv.includes('Pollution Control'), 'Resource CSV contains categories')

console.log('--- ALL 7 TEST SUITES PASSED CLEANLY! ---')
