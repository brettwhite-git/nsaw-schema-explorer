// Naming conventions of Oracle's DW table and column names (moved from the legacy types.ts).
// Pure: used by scripts/build-ontology.mjs (bundled with esbuild) and by the app.

/**
 * Physical table type classification based on suffix
 * Derived from DW table naming conventions
 */
export type PhysicalTableType =
  | 'dimension'    // _D - Dimension tables (lookup/reference data)
  | 'fact'         // _F - Fact tables (transactional data)
  | 'hierarchy'    // _DH - Hierarchy tables (drill-down support)
  | 'global'       // _G - Global/reference tables
  | 'calculated'   // _CF - Calculated/derived fields
  | 'enhanced'     // _EF - Enhanced/flattened fact tables
  | 'prediction'   // _P - Prediction tables (ML-generated)
  | 'security'     // _SEC - Security tables
  | 'unknown';

export function isNsawGeneratedTable(tableName: string): boolean {
  const nsawOnlyPatterns = [
    'DAY_D',
    'FISCALCALPERIOD',
    '_CF_DH',
    'DUMMY',
    'PREDICTION_P',
  ];
  return nsawOnlyPatterns.some(pattern => tableName.includes(pattern));
}

/**
 * Override map for ALL_CAPS compound words where word boundaries are lost.
 * Keyed on the extracted middle part (between DW_NS_ prefix and type suffix),
 * applied only when the extracted name is ALL_CAPS with no underscores.
 * Values drawn from Entity Key CSV Domain Code column.
 */
const RECORD_TYPE_OVERRIDES: Record<string, string> = {
  'ACCOUNTTYPE': 'accountType',
  'ACCOUNTINGCONTEXT': 'accountingContext',
  'BILLINGCLASS': 'billingClass',
  'COSTESTIMATETYPE': 'costEstimateType',
  'CUSTOMERSUBSIDIARYRELATIONSHIP': 'customerSubsidiaryRelationship',
  'VENDORSUBSIDIARYRELATIONSHIP': 'vendorSubsidiaryRelationship',
  'EMPLOYEESUBSIDIARYRELATIONSHIP': 'employeeSubsidiaryRelationship',
  'ITEMGROUP': 'itemGroup',
  'CALENDAREVENT': 'calendarEvent',
  'PHONECALL': 'phoneCall',
  'BILLINGACCOUNT': 'billingAccount',
};

/**
 * Infer NetSuite record type from DW table name
 * DW_NS_CUSTOMER_D → customer
 * DW_NS_accountingBook_D → accountingBook (preserves authored casing)
 * DW_NS_SALES_ORDER_LINES_F → salesOrder (strips _LINES suffix)
 * DW_NS_ACCOUNTTYPE_D → accountType (override for compound ALL_CAPS)
 */
export function inferRecordType(dwTableName: string): string | null {
  if (isNsawGeneratedTable(dwTableName)) {
    return null;
  }

  // Remove DW_NS_ prefix, optional _LINES/_SNAPSHOT, type suffix, and _SEC suffix
  const match = dwTableName.match(/^DW_NS_(.+?)(_LINES|_SNAPSHOT)?(_D|_F|_DH|_EF|_G|_P|_TL|_CF_DH)?(_SEC)?$/);
  if (!match) return null;

  let recordName = match[1];

  // If the extracted name already contains lowercase letters, it was authored
  // with intentional casing (e.g., accountingBook) — preserve it, just ensure
  // the first letter is lowercase for consistency with NS record ID conventions.
  const hasLowercase = /[a-z]/.test(recordName);
  if (hasLowercase) {
    return recordName.charAt(0).toLowerCase() + recordName.slice(1);
  }

  // ALL_CAPS path: check override map for compound words without underscores
  if (!recordName.includes('_')) {
    const override = RECORD_TYPE_OVERRIDES[recordName];
    if (override) {
      return override;
    }
  }

  // Standard ALL_CAPS with underscores: convert UPPER_SNAKE to camelCase
  recordName = recordName
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  return recordName;
}

/**
 * Infer NetSuite field name from DW column name
 * ACCOUNTNUMBER → accountNumber
 */
export function inferFieldName(dwColumnName: string): string {
  // Simple conversion: ACCOUNTNUMBER → accountNumber
  return dwColumnName.charAt(0).toLowerCase() +
         dwColumnName.slice(1).toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * True when the table is a row-level-security variant (name ends in _SEC).
 * Security is an orthogonal flag, NOT a role: DW_NS_X_F_SEC is still a fact table.
 */
export function isSecuredTable(tableName: string): boolean {
  return tableName.endsWith('_SEC');
}

/**
 * Parse physical table suffix to determine table type
 * Uses DW naming convention: DW_NS_[NAME]_[SUFFIX]
 *
 * A trailing _SEC is stripped first so it no longer masks the real type
 * (DW_NS_X_F_SEC -> 'fact'; use isSecuredTable() for the flag). 'security'
 * is returned only when nothing else is recognisable after stripping.
 * _CF_DH is a hierarchy (checked before the generic _CF rule).
 */
export function parsePhysicalTableType(tableName: string): PhysicalTableType {
  const secured = isSecuredTable(tableName);
  const base = secured ? tableName.slice(0, -4) : tableName;

  // Check suffixes in order of specificity
  if (base.endsWith('_EF')) return 'enhanced';
  if (base.endsWith('_DH')) return 'hierarchy';
  if (base.endsWith('_CF') || base.includes('_CF_')) return 'calculated';
  if (base.endsWith('_G')) return 'global';
  if (base.endsWith('_P')) return 'prediction';
  if (base.endsWith('_F')) return 'fact';
  if (base.endsWith('_D')) return 'dimension';
  return secured ? 'security' : 'unknown';
}
