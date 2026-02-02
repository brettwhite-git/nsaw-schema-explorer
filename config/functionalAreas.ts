// Functional Area Configuration
// Maps subject areas to business domain categories

import { FunctionalArea, FunctionalAreaGroup, SubjectAreaInfo } from '../types';

/**
 * Pattern-based mapping rules for subject areas to functional areas
 * Order matters - first match wins
 */
const FUNCTIONAL_AREA_RULES: Array<{
  patterns: string[];
  functionalArea: FunctionalArea;
}> = [
  // Order to Cash (Sales & Revenue)
  {
    patterns: [
      'Order to Cash',
      'Sales Order', 'Sales Insights',
      'Customer Invoice', 'Customer Payment', 'Customer Refund', 'Customer Deposit',
      'Cash Sale', 'Cash Refund',
      'Credit Memo',
      'Estimate', 'Opportunity',
      'Return Authorization',
      'Item Fulfillment', 'Store Pickup Fulfillment',
      'Invoice Group', 'Charge', 'Statement Charge',
      'Revenue Arrangement', 'Revenue Commitment',
      'Subscription',
    ],
    functionalArea: 'Order to Cash',
  },

  // Procure to Pay (Purchasing & Payables)
  {
    patterns: [
      'Procure to Pay',
      'Vendor Bill', 'Vendor Payment', 'Vendor Return', 'Vendor Prepayment',
      'Purchase Order', 'Purchase Requisition', 'Purchase Contract',
      'Item Receipt',
      'Inbound Shipment',
      'Procurement Spend',
    ],
    functionalArea: 'Procure to Pay',
  },

  // Financial Management (Accounting & GL)
  {
    patterns: [
      'Journal', 'Statistical Journal', 'System Journal', 'Cross Charge Journal', 'Paycheck Journal',
      'Budget',
      'GL Impact',
      'Currency Revaluation',
      'Account Analysis',
      'Netting Settlement',
      'Deposit Application',
    ],
    functionalArea: 'Financial Management',
  },

  // Inventory & Warehouse
  {
    patterns: [
      'Inventory',
      'Bin Transfer', 'Bin Putaway',
      'Transfer Order', 'Transfer',
      'Fulfillment Request',
      'Wave',
      'Ownership Transfer',
    ],
    functionalArea: 'Inventory & Warehouse',
  },

  // Manufacturing & Production
  {
    patterns: [
      'Assembly Build', 'Assembly Unbuild',
      'Work Order', 'Work Breakdown',
      'Manufacturing',
    ],
    functionalArea: 'Manufacturing',
  },

  // Banking & Treasury
  {
    patterns: [
      'Check',
      'Credit Card',
      'Deposit',
      'Tax Payment', 'Tax Liability', 'Sales Tax',
    ],
    functionalArea: 'Banking',
  },

  // HR & Payroll
  {
    patterns: [
      'Paycheck',
      'Timesheet', 'Time Tracking',
      'Expense Report',
      'Commission',
    ],
    functionalArea: 'HR & Payroll',
  },

  // Customer Management
  {
    patterns: [
      'Support Case', 'Support Issue',
    ],
    functionalArea: 'Customer Management',
  },

  // Analytics & Predictions
  {
    patterns: [
      'Prediction',
      'Insights',
      'Churn',
      'Stockout',
      'Markdown',
    ],
    functionalArea: 'Analytics & Predictions',
  },
];

/**
 * Get functional area for a subject area name
 * Uses pattern matching against the subject area name (case-insensitive)
 */
export function getFunctionalArea(subjectAreaName: string): FunctionalArea {
  // Remove "NetSuite - " prefix for cleaner matching
  const normalizedName = subjectAreaName.replace(/^NetSuite\s*-\s*/i, '');

  for (const rule of FUNCTIONAL_AREA_RULES) {
    for (const pattern of rule.patterns) {
      if (normalizedName.toLowerCase().includes(pattern.toLowerCase())) {
        return rule.functionalArea;
      }
    }
  }

  // Default fallback for any unmatched subject areas
  return 'Financial Management';
}

/**
 * Display order for functional areas
 */
const FUNCTIONAL_AREA_ORDER: FunctionalArea[] = [
  'Order to Cash',
  'Procure to Pay',
  'Financial Management',
  'Inventory & Warehouse',
  'Manufacturing',
  'Banking',
  'HR & Payroll',
  'Customer Management',
  'Analytics & Predictions',
];

/**
 * Group subject areas by functional area
 * Returns groups in consistent display order
 */
export function groupByFunctionalArea(
  subjectAreas: SubjectAreaInfo[]
): FunctionalAreaGroup[] {
  // Build map of functional area -> subject areas
  const groups = new Map<FunctionalArea, SubjectAreaInfo[]>();

  for (const sa of subjectAreas) {
    const functionalArea = getFunctionalArea(sa.name);

    if (!groups.has(functionalArea)) {
      groups.set(functionalArea, []);
    }
    groups.get(functionalArea)!.push(sa);
  }

  // Build result in display order, excluding empty groups
  return FUNCTIONAL_AREA_ORDER
    .filter((fa) => groups.has(fa) && groups.get(fa)!.length > 0)
    .map((fa) => {
      const areas = groups.get(fa)!;
      // Sort subject areas alphabetically within each group
      areas.sort((a, b) => a.name.localeCompare(b.name));

      return {
        name: fa,
        subjectAreas: areas,
        totalRecords: areas.reduce((sum, a) => sum + a.recordCount, 0),
        totalTables: areas.reduce((sum, a) => sum + a.presentationTables.length, 0),
      };
    });
}
