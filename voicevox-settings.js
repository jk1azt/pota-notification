/**
 * 読み上げ設定画面のロジック
 */

let currentSettings = null;

/**
 * ページ読み込み時に設定を読み込む
 */
window.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupSliders();
  await refreshSpeakers();
});

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    currentSettings = await window.electronAPI.loadVoicevoxSettings();
    if (!currentSettings) {
      currentSettings = {
        hostname: 'localhost',
        port: 50021,
        speakerId: null,
        mhzEnabled: false,
        portableEnabled: false,
        numberEnglishEnabled: false,
        textTemplate: '[reference] [frequency] [mode] [activator] [comments]',
        volume: 1.0,
        speed: 1.0,
        pitch: 0.0,
        intonation: 1.0,
        breathing: 0.0,
        maxSpotsPerRead: 0
      };
    } else {
      // デフォルト値の設定
      if (currentSettings.hostname === undefined) {
        currentSettings.hostname = 'localhost';
      }
      if (currentSettings.port === undefined) {
        currentSettings.port = 50021;
      }
      if (currentSettings.speakerId === undefined) {
        currentSettings.speakerId = null;
      }
      if (currentSettings.mhzEnabled === undefined) {
        currentSettings.mhzEnabled = false;
      }
      if (currentSettings.portableEnabled === undefined) {
        currentSettings.portableEnabled = false;
      }
      if (currentSettings.numberEnglishEnabled === undefined) {
        currentSettings.numberEnglishEnabled = false;
      }
      if (currentSettings.volume === undefined) {
        currentSettings.volume = 1.0;
      }
      if (currentSettings.speed === undefined) {
        currentSettings.speed = 1.0;
      }
      if (currentSettings.pitch === undefined) {
        currentSettings.pitch = 0.0;
      }
      if (currentSettings.intonation === undefined) {
        currentSettings.intonation = 1.0;
      }
      if (currentSettings.breathing === undefined) {
        currentSettings.breathing = 0.0;
      }
      if (currentSettings.textTemplate === undefined) {
        currentSettings.textTemplate = '[reference] [frequency] [mode] [activator] [comments]';
      }
      if (currentSettings.maxSpotsPerRead === undefined) {
        currentSettings.maxSpotsPerRead = 0;
      }
    }
    renderSettings();
  } catch (error) {
    console.error('設定の読み込みエラー:', error);
    currentSettings = {
      hostname: 'localhost',
      port: 50021,
      speakerId: null,
      mhzEnabled: false,
      portableEnabled: false,
      textTemplate: '[reference] [frequency] [mode] [activator] [comments]',
      volume: 1.0,
      speed: 1.0,
      pitch: 0.0,
      intonation: 1.0,
      breathing: 0.0
    };
    renderSettings();
  }
}

/**
 * 設定を画面に表示
 */
function renderSettings() {
  // ホスト名
  const hostnameInput = document.getElementById('voicevox-hostname');
  if (hostnameInput) {
    hostnameInput.value = currentSettings.hostname || 'localhost';
  }

  // ポート番号
  const portInput = document.getElementById('voicevox-port');
  if (portInput) {
    portInput.value = currentSettings.port || 50021;
  }

  // MHz読み上げ
  const mhzCheckbox = document.getElementById('voicevox-mhz');
  if (mhzCheckbox) {
    mhzCheckbox.checked = currentSettings.mhzEnabled || false;
  }

  // ポータブル読み上げ
  const portableCheckbox = document.getElementById('voicevox-portable');
  if (portableCheckbox) {
    portableCheckbox.checked = currentSettings.portableEnabled || false;
  }

  // 数字英語読み上げ
  const numberEnglishCheckbox = document.getElementById('voicevox-number-english');
  if (numberEnglishCheckbox) {
    numberEnglishCheckbox.checked = currentSettings.numberEnglishEnabled || false;
  }

  // 読み上げテンプレート
  const templateTextarea = document.getElementById('voicevox-template');
  if (templateTextarea) {
    templateTextarea.value = currentSettings.textTemplate || '[reference] [frequency] [mode] [activator] [comments]';
  }

  // スライダーの値を設定
  updateSliderValue('param-volume', currentSettings.volume || 1.0);
  updateSliderValue('param-speed', currentSettings.speed || 1.0);
  updateSliderValue('param-pitch', currentSettings.pitch || 0.0);
  updateSliderValue('param-intonation', currentSettings.intonation || 1.0);
  updateSliderValue('param-breathing', currentSettings.breathing || 0.0);

  // 読み上げ数制限を設定
  const maxSpotsInput = document.getElementById('voicevox-max-spots');
  if (maxSpotsInput) {
    maxSpotsInput.value = currentSettings.maxSpotsPerRead !== undefined ? currentSettings.maxSpotsPerRead : 0;
  }
}

/**
 * スライダーの設定
 */
function setupSliders() {
  const sliders = [
    { id: 'param-volume', valueId: 'param-volume-value', min: 0, max: 2, step: 0.01 },
    { id: 'param-speed', valueId: 'param-speed-value', min: 0.5, max: 2, step: 0.01 },
    { id: 'param-pitch', valueId: 'param-pitch-value', min: -0.15, max: 0.15, step: 0.01 },
    { id: 'param-intonation', valueId: 'param-intonation-value', min: 0, max: 2, step: 0.01 },
    { id: 'param-breathing', valueId: 'param-breathing-value', min: 0, max: 1, step: 0.01 }
  ];

  sliders.forEach(slider => {
    const sliderElement = document.getElementById(slider.id);
    const valueElement = document.getElementById(slider.valueId);
    
    if (sliderElement && valueElement) {
      sliderElement.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateSliderValue(slider.id, value);
        updateSliderDisplay(slider.id, value);
      });
    }
  });
}

/**
 * スライダーの値を更新
 */
function updateSliderValue(sliderId, value) {
  const slider = document.getElementById(sliderId);
  if (slider) {
    slider.value = value;
    updateSliderDisplay(sliderId, value);
  }
}

/**
 * スライダーの表示を更新
 */
function updateSliderDisplay(sliderId, value) {
  const slider = document.getElementById(sliderId);
  const valueId = sliderId + '-value';
  const valueElement = document.getElementById(valueId);
  
  if (slider && valueElement) {
    const percentage = ((value - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min))) * 100;
    slider.style.setProperty('--value', percentage + '%');
    valueElement.textContent = value.toFixed(2);
  }
}

/**
 * 話者一覧を取得して更新
 */
async function refreshSpeakers() {
  const speakerSelect = document.getElementById('voicevox-speaker');
  const loadingDiv = document.getElementById('speaker-loading');
  const errorDiv = document.getElementById('speaker-error');
  
  if (!speakerSelect) return;

  // ローディング表示
  speakerSelect.innerHTML = '<option value="">話者を読み込み中...</option>';
  speakerSelect.disabled = true;
  if (loadingDiv) {
    loadingDiv.style.display = 'block';
  }
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }

  try {
    const hostname = document.getElementById('voicevox-hostname').value || 'localhost';
    const port = parseInt(document.getElementById('voicevox-port').value) || 50021;
    
    const speakers = await window.electronAPI.getVoicevoxSpeakers(hostname, port);
    
    // 話者一覧をクリア
    speakerSelect.innerHTML = '';
    
    if (!speakers || speakers.length === 0) {
      speakerSelect.innerHTML = '<option value="">話者が見つかりません</option>';
      if (errorDiv) {
        errorDiv.textContent = '話者が見つかりませんでした。VOICEVOX Engineが起動しているか確認してください。';
        errorDiv.style.display = 'block';
      }
    } else {
      // 話者を追加
      speakers.forEach(speaker => {
        const option = document.createElement('option');
        option.value = speaker.id;
        option.textContent = speaker.name;
        speakerSelect.appendChild(option);
      });
      
      // 保存されている話者IDを選択
      if (currentSettings && currentSettings.speakerId) {
        speakerSelect.value = currentSettings.speakerId;
      }
    }
  } catch (error) {
    console.error('話者一覧取得エラー:', error);
    speakerSelect.innerHTML = '<option value="">話者の取得に失敗しました</option>';
    if (errorDiv) {
      errorDiv.textContent = 'VOICEVOX Engineに接続できませんでした。エンジンが起動しているか、ホスト名とポート番号を確認してください。';
      errorDiv.style.display = 'block';
    }
  } finally {
    speakerSelect.disabled = false;
    if (loadingDiv) {
      loadingDiv.style.display = 'none';
    }
  }
}

/**
 * 接続テスト
 */
async function testConnection() {
  const hostname = document.getElementById('voicevox-hostname').value || 'localhost';
  const port = parseInt(document.getElementById('voicevox-port').value) || 50021;
  
  try {
    const speakers = await window.electronAPI.getVoicevoxSpeakers(hostname, port);
    if (speakers && speakers.length > 0) {
      alert(`接続成功！\n${speakers.length}個の話者が見つかりました。`);
      // 話者一覧も更新
      await refreshSpeakers();
    } else {
      alert('接続は成功しましたが、話者が見つかりませんでした。');
    }
  } catch (error) {
    console.error('接続テストエラー:', error);
    alert('接続に失敗しました。\nVOICEVOX Engineが起動しているか、ホスト名とポート番号を確認してください。\n\nエラー: ' + (error.message || '不明なエラー'));
  }
}

/**
 * テスト読み上げ
 */
async function testVoicevox() {
  try {
    const hostname = document.getElementById('voicevox-hostname').value || 'localhost';
    const port = parseInt(document.getElementById('voicevox-port').value) || 50021;
    const speakerId = parseInt(document.getElementById('voicevox-speaker').value);
    
    if (!speakerId) {
      alert('話者を選択してください。');
      return;
    }

    const volume = parseFloat(document.getElementById('param-volume').value);
    const speed = parseFloat(document.getElementById('param-speed').value);
    const pitch = parseFloat(document.getElementById('param-pitch').value);
    const intonation = parseFloat(document.getElementById('param-intonation').value);
    const breathing = parseFloat(document.getElementById('param-breathing').value);
    const portableEnabled = document.getElementById('voicevox-portable').checked;
    const numberEnglishEnabled = document.getElementById('voicevox-number-english').checked;
    const mhzEnabled = document.getElementById('voicevox-mhz').checked;
    const textTemplate = document.getElementById('voicevox-template').value || '[reference] [frequency] [mode] [activator] [comments]';

    // テスト用のスポットデータを作成（実際のデータ形式に合わせる）
    const testSpot = {
      spotId: 44521631,
      activator: 'JK1AZT/8',
      frequency: '7144',
      mode: 'SSB',
      reference: 'JP-1001',
      parkName: null,
      spotTime: '2025-11-19T17:38:21',
      spotter: 'JK1AZT/8',
      comments: 'ssb',
      source: 'Web',
      name: 'Akkeshi-Kiritappu-Konbumori Quasi-National Park',
      locationDesc: 'JP-HK'
    };

    // 現在の設定からvoicevoxSettingsオブジェクトを作成
    const voicevoxSettings = {
      mhzEnabled: mhzEnabled,
      portableEnabled: portableEnabled,
      numberEnglishEnabled: numberEnglishEnabled,
      textTemplate: textTemplate
    };

    // generateVoicevoxText関数を使用して読み上げ文章を生成
    const testText = await window.electronAPI.generateVoicevoxText(testSpot, voicevoxSettings);
    
    const result = await window.electronAPI.synthesizeVoicevox(
      hostname,
      port,
      speakerId,
      testText,
      {
        volume,
        speed,
        pitch,
        intonation,
        breathing
      }
    );

    if (!result || !result.success) {
      throw new Error(result?.error || '読み上げに失敗しました。');
    }
  } catch (error) {
    console.error('テスト読み上げエラー:', error);
    alert('テスト読み上げに失敗しました: ' + (error.message || '不明なエラー'));
  }
}

/**
 * 設定を保存
 */
async function saveSettings() {
  const hostname = document.getElementById('voicevox-hostname').value || 'localhost';
  const port = parseInt(document.getElementById('voicevox-port').value) || 50021;
  const speakerId = document.getElementById('voicevox-speaker').value ? 
    parseInt(document.getElementById('voicevox-speaker').value) : null;
  const mhzEnabled = document.getElementById('voicevox-mhz').checked;
  const portableEnabled = document.getElementById('voicevox-portable').checked;
  const numberEnglishEnabled = document.getElementById('voicevox-number-english').checked;
  const textTemplate = document.getElementById('voicevox-template').value || '[reference] [frequency] [mode] [activator] [comments]';
  const maxSpotsInput = document.getElementById('voicevox-max-spots');
  const maxSpotsPerRead = maxSpotsInput ? (parseInt(maxSpotsInput.value, 10) || 0) : 0;

  currentSettings = {
    hostname: hostname,
    port: port,
    speakerId: speakerId,
    mhzEnabled: mhzEnabled,
    portableEnabled: portableEnabled,
    numberEnglishEnabled: numberEnglishEnabled,
    textTemplate: textTemplate,
    volume: parseFloat(document.getElementById('param-volume').value),
    speed: parseFloat(document.getElementById('param-speed').value),
    pitch: parseFloat(document.getElementById('param-pitch').value),
    intonation: parseFloat(document.getElementById('param-intonation').value),
    breathing: parseFloat(document.getElementById('param-breathing').value),
    maxSpotsPerRead: maxSpotsPerRead < 0 ? 0 : maxSpotsPerRead
  };

  try {
    const result = await window.electronAPI.saveVoicevoxSettings(currentSettings);
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

