/**
 * フィルタロジック
 * スポットデータに対してフィルタ条件を適用
 */

/**
 * フィルタ条件のデータ構造
 * @typedef {Object} FilterCondition
 * @property {string} value - フィルタ値
 * @property {string} type - フィルタタイプ ('contains' | 'exact')
 * @property {boolean} exclude - 除外フラグ
 * @property {boolean} enabled - 有効フラグ（falseの場合はフィルタに適用されない）
 */

/**
 * フィールドフィルタ設定
 * @typedef {Object} FieldFilter
 * @property {FilterCondition[]} conditions - フィルタ条件の配列
 * @property {string} operator - AND/OR演算子 ('and' | 'or')
 */

/**
 * フィルタ設定全体
 * @typedef {Object} FilterConfig
 * @property {FieldFilter} reference - referenceフィールドのフィルタ
 * @property {FieldFilter} comments - commentsフィールドのフィルタ
 * @property {FieldFilter} mode - modeフィールドのフィルタ
 * @property {FieldFilter} frequency - frequencyフィールドのフィルタ
 * @property {boolean} ignoreOtherSpotters - 他人のspotterは通知しない
 */

/**
 * 大文字小文字を区別しない文字列比較
 * @param {string} a - 比較文字列1
 * @param {string} b - 比較文字列2
 * @returns {boolean}
 */
function caseInsensitiveEquals(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/**
 * 大文字小文字を区別しない部分一致チェック
 * @param {string} text - 検索対象の文字列
 * @param {string} pattern - 検索パターン
 * @returns {boolean}
 */
function caseInsensitiveContains(text, pattern) {
  if (text === null || text === undefined || pattern === null || pattern === undefined) {
    return false;
  }
  return String(text).toLowerCase().includes(String(pattern).toLowerCase());
}

/**
 * コールサインを正規化（大文字に変換、スラッシュ以降を削除）
 * @param {string} callsign - コールサイン
 * @returns {string} 正規化されたコールサイン
 */
function normalizeCallsign(callsign) {
  if (!callsign || typeof callsign !== 'string') {
    return '';
  }
  // スラッシュ以降を削除してから大文字に変換
  const withoutSlash = callsign.split('/')[0].trim();
  return withoutSlash.toUpperCase();
}

/**
 * activatorとspotterが一致するかチェック
 * 大文字小文字を区別せず、スラッシュ以降は無視
 * @param {string} activator - activatorのコールサイン
 * @param {string} spotter - spotterのコールサイン
 * @returns {boolean} 一致する場合true
 */
function callsignsMatch(activator, spotter) {
  if (!activator || !spotter) {
    return false;
  }
  const normalizedActivator = normalizeCallsign(activator);
  const normalizedSpotter = normalizeCallsign(spotter);
  return normalizedActivator === normalizedSpotter;
}

/**
 * 単一のフィルタ条件をチェック（除外フラグは考慮しない）
 * @param {string} fieldValue - フィールドの値
 * @param {FilterCondition} condition - フィルタ条件
 * @returns {boolean} 条件に一致するかどうか（除外フラグは考慮しない）
 */
function checkConditionMatch(fieldValue, condition) {
  if (!condition || !condition.value) {
    return false;
  }

  if (condition.type === 'exact') {
    return caseInsensitiveEquals(fieldValue, condition.value);
  } else if (condition.type === 'contains') {
    return caseInsensitiveContains(fieldValue, condition.value);
  }

  return false;
}

/**
 * フィールドフィルタを適用（除外条件は除く）
 * @param {string} fieldValue - フィールドの値
 * @param {FieldFilter} fieldFilter - フィールドフィルタ設定
 * @returns {boolean} フィルタを通過するかどうか
 */
function applyFieldFilter(fieldValue, fieldFilter) {
  // フィルタ設定がない、または条件が空の場合は通過
  if (!fieldFilter || !fieldFilter.conditions || fieldFilter.conditions.length === 0) {
    return true;
  }

  // 除外条件を除き、有効な通常の条件のみをフィルタリング
  const includeConditions = fieldFilter.conditions.filter(c => !c.exclude && (c.enabled !== false));
  
  // 通常の条件がない場合は通過
  if (includeConditions.length === 0) {
    return true;
  }

  const operator = fieldFilter.operator || 'or';

  if (operator === 'and') {
    // AND条件: 全ての条件が一致する必要がある
    return includeConditions.every(condition => checkConditionMatch(fieldValue, condition));
  } else {
    // OR条件: いずれかの条件が一致すればOK
    return includeConditions.some(condition => checkConditionMatch(fieldValue, condition));
  }
}

/**
 * スポットデータにフィルタを適用
 * @param {Object} spot - スポットデータ
 * @param {FilterConfig} filterConfig - フィルタ設定
 * @returns {boolean} フィルタを通過するかどうか
 */
function applyFilter(spot, filterConfig) {
  if (!filterConfig) {
    return true; // フィルタ設定がない場合は全て通過
  }

  // ignoreOtherSpottersオプションが有効な場合、activatorとspotterが一致しない場合は除外
  if (filterConfig.ignoreOtherSpotters) {
    if (!callsignsMatch(spot.activator, spot.spotter)) {
      return false;
    }
  }

  // 除外条件を最優先でチェック
  // 各フィールドの除外条件をチェック（一致したら即座にfalseを返す）
  const fields = ['reference', 'comments', 'mode', 'frequency'];
  for (const field of fields) {
    const fieldFilter = filterConfig[field];
    if (fieldFilter && fieldFilter.conditions) {
      const excludeConditions = fieldFilter.conditions.filter(c => c.exclude && (c.enabled !== false));
      for (const condition of excludeConditions) {
        // 除外条件に一致したら即座にfalseを返す
        if (checkConditionMatch(spot[field] || '', condition)) {
          return false;
        }
      }
    }
  }

  // フィールド間AND条件: 全てのフィールドを通過する必要がある
  const referencePass = applyFieldFilter(spot.reference || '', filterConfig.reference);
  const commentsPass = applyFieldFilter(spot.comments || '', filterConfig.comments);
  const modePass = applyFieldFilter(spot.mode || '', filterConfig.mode);
  const frequencyPass = applyFieldFilter(spot.frequency || '', filterConfig.frequency);

  return referencePass && commentsPass && modePass && frequencyPass;
}

module.exports = {
  applyFilter,
  applyFieldFilter,
  checkCondition: checkConditionMatch
};

