/**
 * 設定画面のロジック
 */

let currentConfig = null;
let conditionIdCounter = 0;

/**
 * ページ読み込み時に設定を読み込む
 */
window.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderSettings();
});

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    currentConfig = await window.electronAPI.loadConfig();
    if (!currentConfig) {
    currentConfig = {
      reference: { conditions: [], operator: 'or' },
      comments: { conditions: [], operator: 'or' },
      mode: { conditions: [], operator: 'or' },
      frequency: { conditions: [], operator: 'or' },
      ignoreOtherSpotters: false,
      notificationSoundPath: null,
      maxNotificationCount: 0,
      maxPopupCount: 0
    };
    } else {
      // 既存の設定にignoreOtherSpottersがない場合はfalseを設定
      if (currentConfig.ignoreOtherSpotters === undefined) {
        currentConfig.ignoreOtherSpotters = false;
      }
      // 既存の設定にnotificationSoundPathがない場合はnullを設定
      if (currentConfig.notificationSoundPath === undefined) {
        currentConfig.notificationSoundPath = null;
      }
      // 既存の設定にmaxNotificationCountがない場合は0を設定
      if (currentConfig.maxNotificationCount === undefined) {
        currentConfig.maxNotificationCount = 0;
      }
      // 既存の設定にmaxPopupCountがない場合は0を設定
      if (currentConfig.maxPopupCount === undefined) {
        currentConfig.maxPopupCount = 0;
      }
    }
  } catch (error) {
    console.error('設定の読み込みエラー:', error);
    currentConfig = {
      reference: { conditions: [], operator: 'or' },
      comments: { conditions: [], operator: 'or' },
      mode: { conditions: [], operator: 'or' },
      frequency: { conditions: [], operator: 'or' },
      ignoreOtherSpotters: false,
      notificationSoundPath: null,
      maxNotificationCount: 0,
      maxPopupCount: 0
    };
  }
}

/**
 * 設定を画面に表示
 */
function renderSettings() {
  const fields = ['reference', 'comments', 'mode', 'frequency'];

  fields.forEach(field => {
    // 既存の条件にenabledプロパティがない場合はtrueを設定（互換性のため）
    if (currentConfig[field] && currentConfig[field].conditions) {
      currentConfig[field].conditions.forEach(condition => {
        if (condition.enabled === undefined) {
          condition.enabled = true;
        }
      });
    }

    // オペレーターの選択
    const operatorRadios = document.querySelectorAll(`input[name="${field}-operator"]`);
    operatorRadios.forEach(radio => {
      if (radio.value === (currentConfig[field]?.operator || 'or')) {
        radio.checked = true;
      }
    });

    // 条件リストをレンダリング
    renderConditions(field);
  });

  // ignoreOtherSpottersチェックボックスを設定
  const ignoreOtherSpottersCheckbox = document.getElementById('ignore-other-spotters');
  if (ignoreOtherSpottersCheckbox) {
    ignoreOtherSpottersCheckbox.checked = currentConfig.ignoreOtherSpotters || false;
  }

  // 通知音パスを設定
  const notificationSoundPathInput = document.getElementById('notification-sound-path');
  if (notificationSoundPathInput) {
    notificationSoundPathInput.value = currentConfig.notificationSoundPath || '';
  }

  // 通知数制限を設定
  const maxNotificationCountInput = document.getElementById('max-notification-count');
  if (maxNotificationCountInput) {
    maxNotificationCountInput.value = currentConfig.maxNotificationCount !== undefined ? currentConfig.maxNotificationCount : 0;
  }

  const maxPopupCountInput = document.getElementById('max-popup-count');
  if (maxPopupCountInput) {
    maxPopupCountInput.value = currentConfig.maxPopupCount !== undefined ? currentConfig.maxPopupCount : 0;
  }
}

/**
 * 条件リストをレンダリング
 */
function renderConditions(field) {
  const container = document.getElementById(`${field}-conditions`);
  container.innerHTML = '';

  const conditions = currentConfig[field]?.conditions || [];

  if (conditions.length === 0) {
    container.innerHTML = '<div class="empty-message">条件が設定されていません</div>';
    return;
  }

  conditions.forEach((condition, index) => {
    const conditionItem = createConditionElement(field, condition, index);
    container.appendChild(conditionItem);
  });
}

/**
 * 条件要素を作成
 */
function createConditionElement(field, condition, index) {
  const div = document.createElement('div');
  div.className = 'condition-item';
  div.dataset.index = index;

  const id = `condition-${field}-${index}-${++conditionIdCounter}`;

  div.innerHTML = `
    <label style="display: flex; align-items: center;">
      <input 
        type="checkbox" 
        id="${id}-enabled"
        ${condition.enabled !== false ? 'checked' : ''}
        onchange="updateCondition('${field}', ${index}, 'enabled', this.checked)"
        style="margin-right: 5px;"
      />
    </label>
    <input 
      type="text" 
      id="${id}-value"
      placeholder="フィルタ値" 
      value="${escapeHtml(condition.value || '')}"
      onchange="updateCondition('${field}', ${index}, 'value', this.value)"
      ${condition.enabled === false ? 'disabled' : ''}
    />
    <select 
      id="${id}-type"
      onchange="updateCondition('${field}', ${index}, 'type', this.value)"
      ${condition.enabled === false ? 'disabled' : ''}
    >
      <option value="contains" ${condition.type === 'contains' ? 'selected' : ''}>含まれている</option>
      <option value="exact" ${condition.type === 'exact' ? 'selected' : ''}>完全一致</option>
    </select>
    <label>
      <input 
        type="checkbox" 
        id="${id}-exclude"
        ${condition.exclude ? 'checked' : ''}
        onchange="updateCondition('${field}', ${index}, 'exclude', this.checked)"
        ${condition.enabled === false ? 'disabled' : ''}
      />
      除外
    </label>
    <button class="btn-remove" onclick="removeCondition('${field}', ${index})">削除</button>
  `;

  return div;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 条件を追加
 */
function addCondition(field) {
  if (!currentConfig[field]) {
    currentConfig[field] = { conditions: [], operator: 'or' };
  }

  currentConfig[field].conditions.push({
    value: '',
    type: 'contains',
    exclude: false,
    enabled: true
  });

  renderConditions(field);
}

/**
 * 条件を更新
 */
function updateCondition(field, index, property, value) {
  if (!currentConfig[field] || !currentConfig[field].conditions[index]) {
    return;
  }

  currentConfig[field].conditions[index][property] = value;
  
  // enabledが変更された場合、入力フィールドの有効/無効を切り替え
  if (property === 'enabled') {
    const container = document.getElementById(`${field}-conditions`);
    const conditionItem = container.querySelector(`.condition-item[data-index="${index}"]`);
    if (conditionItem) {
      const valueInput = conditionItem.querySelector('input[type="text"]');
      const typeSelect = conditionItem.querySelector('select');
      const excludeCheckbox = conditionItem.querySelector('input[type="checkbox"][id$="-exclude"]');
      
      if (valueInput) valueInput.disabled = !value;
      if (typeSelect) typeSelect.disabled = !value;
      if (excludeCheckbox) excludeCheckbox.disabled = !value;
    }
  }
}

/**
 * 条件を削除
 */
function removeCondition(field, index) {
  if (!currentConfig[field] || !currentConfig[field].conditions[index]) {
    return;
  }

  currentConfig[field].conditions.splice(index, 1);
  renderConditions(field);
}

/**
 * ignoreOtherSpottersオプションを更新
 */
function updateIgnoreOtherSpotters(value) {
  currentConfig.ignoreOtherSpotters = value;
}

/**
 * 通知音ファイルを選択
 */
async function selectNotificationSound() {
  try {
    const result = await window.electronAPI.selectSoundFile();
    if (result && result.filePath) {
      currentConfig.notificationSoundPath = result.filePath;
      const notificationSoundPathInput = document.getElementById('notification-sound-path');
      if (notificationSoundPathInput) {
        notificationSoundPathInput.value = result.filePath;
      }
    }
  } catch (error) {
    console.error('通知音ファイル選択エラー:', error);
    alert('通知音ファイルの選択に失敗しました: ' + error.message);
  }
}

/**
 * 通知音設定をクリア
 */
function clearNotificationSound() {
  currentConfig.notificationSoundPath = null;
  const notificationSoundPathInput = document.getElementById('notification-sound-path');
  if (notificationSoundPathInput) {
    notificationSoundPathInput.value = '';
  }
}

/**
 * 通知音のテスト再生
 */
async function testNotificationSound() {
  const notificationSoundPathInput = document.getElementById('notification-sound-path');
  const soundPath = (notificationSoundPathInput?.value || '').trim() || currentConfig?.notificationSoundPath;

  if (!soundPath) {
    alert('通知音ファイルを選択してください。');
    return;
  }

  try {
    const result = await window.electronAPI.testNotificationSound(soundPath);
    if (!result || !result.success) {
      throw new Error(result?.error || '不明なエラーが発生しました。');
    }
  } catch (error) {
    console.error('テスト再生エラー:', error);
    alert('テスト再生に失敗しました: ' + (error.message || '不明なエラー'));
  }
}

/**
 * 設定を保存
 */
async function saveSettings() {
  // オペレーターの値を取得
  const fields = ['reference', 'comments', 'mode', 'frequency'];
  fields.forEach(field => {
    const operatorRadios = document.querySelectorAll(`input[name="${field}-operator"]:checked`);
    if (operatorRadios.length > 0) {
      if (!currentConfig[field]) {
        currentConfig[field] = { conditions: [], operator: 'or' };
      }
      currentConfig[field].operator = operatorRadios[0].value;
    }

    // 空の値をフィルタリング
    if (currentConfig[field] && currentConfig[field].conditions) {
      currentConfig[field].conditions = currentConfig[field].conditions.filter(
        c => c.value && c.value.trim() !== ''
      );
    }
  });

  // ignoreOtherSpottersオプションを取得
  const ignoreOtherSpottersCheckbox = document.getElementById('ignore-other-spotters');
  if (ignoreOtherSpottersCheckbox) {
    currentConfig.ignoreOtherSpotters = ignoreOtherSpottersCheckbox.checked;
  }

  // 通知音パスを取得
  const notificationSoundPathInput = document.getElementById('notification-sound-path');
  if (notificationSoundPathInput) {
    currentConfig.notificationSoundPath = notificationSoundPathInput.value || null;
  }

  // 通知数制限を取得
  const maxNotificationCountInput = document.getElementById('max-notification-count');
  if (maxNotificationCountInput) {
    const value = parseInt(maxNotificationCountInput.value, 10);
    currentConfig.maxNotificationCount = isNaN(value) || value < 0 ? 0 : value;
  }

  const maxPopupCountInput = document.getElementById('max-popup-count');
  if (maxPopupCountInput) {
    const value = parseInt(maxPopupCountInput.value, 10);
    currentConfig.maxPopupCount = isNaN(value) || value < 0 ? 0 : value;
  }

  try {
    const result = await window.electronAPI.saveConfig(currentConfig);
    if (result.success) {
      alert('設定を保存しました');
      window.close();
    } else {
      alert('設定の保存に失敗しました: ' + (result.error || '不明なエラー'));
    }
  } catch (error) {
    console.error('設定保存エラー:', error);
    alert('設定の保存に失敗しました: ' + error.message);
  }
}

/**
 * 設定画面を閉じる
 */
function closeSettings() {
  window.close();
}

