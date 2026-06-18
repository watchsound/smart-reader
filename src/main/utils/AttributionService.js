/**
 * AttributionService — thin amortization wrapper over CallLedgerStore.
 *
 * Owns: amortization arithmetic + lens grouping + label resolution.
 * Does NOT own raw SQL — CallLedgerStore handles all data access.
 *
 * Task 6 skeleton; Tasks 7 and 8 will implement getBars() and getGroupDetail().
 */

const CallLedgerStore = require('../db/CallLedgerStore');
const { ATTENTION_STATE, PHASE_GROUP } = require('../../commons/model/featureSurface');

class AttributionService {
  /**
   * Get bar chart data (aggregated cost + call counts per intent/provider).
   * Task 7 will implement: uses aggregateAttribution + intentSpendInWindow + amortization + lens grouping.
   */
  async getBars(_opts) {
    throw new Error('not implemented — Task 7');
  }

  /**
   * Get detailed rows for a single group (intent or provider).
   * Task 8 will implement: uses attributionGroupDetail + amortized unit-cost calc.
   */
  async getGroupDetail(_opts) {
    throw new Error('not implemented — Task 8');
  }

  /**
   * Get density strip (sparkline-style mini data).
   * Delegates directly to CallLedgerStore — Task 5 already implemented attributionDensityStrip.
   */
  async getDensityStrip(opts) {
    return CallLedgerStore.attributionDensityStrip(opts);
  }
}

module.exports = AttributionService;
