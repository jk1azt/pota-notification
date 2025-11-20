const { app, BrowserWindow, Notification, ipcMain, session, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { applyFilter } = require('./filter');
const {
  loadVoicevoxSettings,
  saveVoicevoxSettings,
  getVoicevoxSpeakers,
  synthesizeVoicevox,
  speakWithVoicevox,
  generateVoicevoxText,
  speakMultipleSpotsWithVoicevox
} = require('./voicevox');

let mainWindow;
let settingsWindow;
let voicevoxSettingsWindow;
let filterConfig = null;
let notificationSettings = {
  notificationEnabled: false,
  popupEnabled: false,
  soundEnabled: false,
  voicevoxEnabled: false
};
let knownSpotIds = new Set(); // 既知のスポットIDを保持

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const NOTIFICATION_SETTINGS_FILE = path.join(app.getPath('userData'), 'notification-settings.json');
const VOICEVOX_SETTINGS_FILE = path.join(app.getPath('userData'), 'voicevox-settings.json');

// Windowsで通知のアプリ名を設定（app.whenReady()の前に呼び出す必要がある）
if (process.platform === 'win32') {
  app.setAppUserModelId('com.pota.notification');
}
app.setName('POTA Notification');

/**
 * 設定ファイルを読み込む
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    filterConfig = JSON.parse(data);
    // 既存の設定にignoreOtherSpottersがない場合はfalseを設定
    if (filterConfig.ignoreOtherSpotters === undefined) {
      filterConfig.ignoreOtherSpotters = false;
    }
    // 既存の設定にnotificationSoundPathがない場合はnullを設定
    if (filterConfig.notificationSoundPath === undefined) {
      filterConfig.notificationSoundPath = null;
    }
    // 既存の設定にmaxNotificationCountがない場合は0を設定
    if (filterConfig.maxNotificationCount === undefined) {
      filterConfig.maxNotificationCount = 0;
    }
    // 既存の設定にmaxPopupCountがない場合は0を設定
    if (filterConfig.maxPopupCount === undefined) {
      filterConfig.maxPopupCount = 0;
    }
    console.log('設定を読み込みました:', filterConfig);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // ファイルが存在しない場合はデフォルト設定を使用
      filterConfig = {
        reference: { conditions: [], operator: 'or' },
        comments: { conditions: [], operator: 'or' },
        mode: { conditions: [], operator: 'or' },
        frequency: { conditions: [], operator: 'or' },
        ignoreOtherSpotters: false,
        notificationSoundPath: null,
        maxNotificationCount: 0,
        maxPopupCount: 0
      };
      console.log('設定ファイルが見つかりません。デフォルト設定を使用します。');
    } else {
      console.error('設定の読み込みエラー:', error);
      filterConfig = {
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
}

/**
 * 通知設定を読み込む
 */
async function loadNotificationSettings() {
  try {
    const data = await fs.readFile(NOTIFICATION_SETTINGS_FILE, 'utf-8');
    notificationSettings = JSON.parse(data);
    if (notificationSettings.soundEnabled === undefined) {
      notificationSettings.soundEnabled = false;
    }
    if (notificationSettings.voicevoxEnabled === undefined) {
      notificationSettings.voicevoxEnabled = false;
    }
    console.log('通知設定を読み込みました:', notificationSettings);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // ファイルが存在しない場合はデフォルト設定を使用（OFF）
      notificationSettings = {
        notificationEnabled: false,
        popupEnabled: false,
        soundEnabled: false,
        voicevoxEnabled: false
      };
      // デフォルト設定は保存しない（ユーザーが明示的に設定した時だけ保存）
      console.log('通知設定ファイルが見つかりません。デフォルト設定（OFF）を使用します。');
    } else {
      console.error('通知設定の読み込みエラー:', error);
      notificationSettings = {
        notificationEnabled: false,
        popupEnabled: false,
        soundEnabled: false,
        voicevoxEnabled: false
      };
    }
  }
}

/**
 * 通知設定を保存
 */
async function saveNotificationSettings(settings) {
  try {
    notificationSettings = settings;
    await fs.writeFile(NOTIFICATION_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('通知設定を保存しました:', settings);
    return { success: true };
  } catch (error) {
    console.error('通知設定の保存エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 設定ファイルを保存
 */
async function saveConfig(config) {
  try {
    filterConfig = config;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    console.log('設定を保存しました:', config);
    return { success: true };
  } catch (error) {
    console.error('設定の保存エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * メインウィンドウを作成
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'POTA Notification',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  // ページタイトルが変更されても常に「POTA Notification」を維持
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle('POTA Notification');
  });

  // https://pota.appを表示
  mainWindow.loadURL('https://pota.app');

  // デベロッパーツールを開く（開発時）
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


/**
 * 設定画面を作成
 */
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow,
    modal: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * 読み上げ設定画面を作成
 */
function createVoicevoxSettingsWindow() {
  if (voicevoxSettingsWindow) {
    voicevoxSettingsWindow.focus();
    return;
  }

  voicevoxSettingsWindow = new BrowserWindow({
    width: 800,
    height: 700,
    parent: mainWindow,
    modal: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  voicevoxSettingsWindow.loadFile('voicevox-settings.html');

  voicevoxSettingsWindow.on('closed', () => {
    voicevoxSettingsWindow = null;
  });
}

/**
 * APIレスポンスを監視して新しいスポットを検知
 */
function setupApiMonitoring() {
  if (!mainWindow) {
    return;
  }

  let checkInterval = null;

  // ページがロード完了した後に定期的にチェックを開始
  mainWindow.webContents.on('did-finish-load', () => {
    // 既存のインターバルをクリア
    if (checkInterval) {
      clearInterval(checkInterval);
    }

    // ページロード後、少し待ってからチェック開始
    setTimeout(() => {
      checkForNewSpots();
    }, 3000);

    // 定期的にページからスポットデータを取得
    checkInterval = setInterval(async () => {
      await checkForNewSpots();
    }, 10000); // 10秒ごとにチェック
  });
}

/**
 * ページから新しいスポットをチェック
 */
async function checkForNewSpots() {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  try {
    // ページのJavaScriptからAPIレスポンスを取得
    // ページが既に取得したデータにアクセスするか、
    // XMLHttpRequestをフックしてレスポンスを取得
    const spots = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          // ページが既に持っているスポットデータを取得する方法
          // または、直接APIを呼び出す
          const response = await fetch('https://api.pota.app/v1/spots');
          if (response.ok) {
            return await response.json();
          }
          return [];
        } catch (error) {
          console.error('スポット取得エラー:', error);
          return [];
        }
      })()
    `);

    if (Array.isArray(spots)) {
      await processSpots(spots);
    }
  } catch (error) {
    console.error('スポットチェックエラー:', error);
  }
}

/**
 * スポットを処理して新しいものを検知
 */
async function processSpots(spots) {
  if (!Array.isArray(spots)) {
    return;
  }

  // フィルタを通過したスポットを配列に集約
  const filteredSpots = [];

  for (const spot of spots) {
    const spotId = spot.spotId;

    // 既知のスポットIDでない場合は新規スポット
    if (!knownSpotIds.has(spotId)) {
      knownSpotIds.add(spotId);

      // フィルタを適用
      if (filterConfig && applyFilter(spot, filterConfig)) {
        // フィルタを通過したスポットを配列に追加
        filteredSpots.push(spot);
      }
    }
  }

  // フィルタ後のスポットがある場合のみ処理
  if (filteredSpots.length > 0) {
    // 通知音を1回だけ再生
    await handleNotificationSound();

    // デスクトップ通知の最大件数制限を適用
    const maxNotificationCount = filterConfig?.maxNotificationCount || 0;
    const notificationSpots = maxNotificationCount > 0 
      ? filteredSpots.slice(0, maxNotificationCount)
      : filteredSpots;

    // ポップアップ通知の最大件数制限を適用
    const maxPopupCount = filterConfig?.maxPopupCount || 0;
    const popupSpots = maxPopupCount > 0
      ? filteredSpots.slice(0, maxPopupCount)
      : filteredSpots;

    // デスクトップ通知を表示
    for (const spot of notificationSpots) {
      showNotification(spot);
    }

    // ポップアップ通知を表示
    for (const spot of popupSpots) {
      showPopupNotification(spot);
    }

    // VOICEVOXで読み上げ（複数スポット対応）
    const targetWebContents = getAudioTargetWebContents();
    if (targetWebContents) {
      await speakMultipleSpotsWithVoicevox(
        filteredSpots,
        VOICEVOX_SETTINGS_FILE,
        notificationSettings.voicevoxEnabled,
        targetWebContents
      );
    }
  }

  // メモリリークを防ぐため、既知のスポットIDの数を制限（最新1000件）
  if (knownSpotIds.size > 1000) {
    const idsArray = Array.from(knownSpotIds);
    knownSpotIds = new Set(idsArray.slice(-1000));
  }
}

/**
 * 通知音を再生（ChromiumのAudio APIを使用）
 * セキュリティポリシーを回避するため、メインプロセスでファイルを読み込んでBase64エンコードし、data URIとして渡す
 * @param {string|null} customPath - 任意の音声ファイルパス（未指定の場合は設定値を使用）
 * @returns {Promise<boolean>} 成功可否
 */
async function playNotificationSound(customPath = null) {
  const soundPath = customPath ?? filterConfig?.notificationSoundPath;
  
  if (!soundPath) {
    // 未設定の場合はWindowsのデフォルト通知音を使用（Notificationのデフォルト動作）
    return false;
  }

  const targetWebContents = getAudioTargetWebContents();
  if (!targetWebContents) {
    console.error('音声を再生できるウィンドウがありません');
    return false;
  }

  try {
    await playSoundFromPath(soundPath, targetWebContents);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('通知音ファイルが見つかりません:', soundPath);
    } else {
      console.error('通知音再生エラー:', error);
    }
    return false;
  }
}

/**
 * 音声再生に使用するwebContentsを取得
 */
function getAudioTargetWebContents() {
  if (mainWindow?.webContents) {
    return mainWindow.webContents;
  }
  if (settingsWindow?.webContents) {
    return settingsWindow.webContents;
  }
  return null;
}

/**
 * 指定したファイルをdata URI化してAudioで再生
 */
async function playSoundFromPath(soundPath, targetWebContents) {
  // ファイルの存在確認
  await fs.access(soundPath);

  // メインプロセスでファイルを読み込んでBase64エンコード
  const fileBuffer = await fs.readFile(soundPath);
  const base64Data = fileBuffer.toString('base64');

  // ファイル拡張子からMIMEタイプを判定
  const ext = path.extname(soundPath).toLowerCase();
  const mimeTypes = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm'
  };
  const mimeType = mimeTypes[ext] || 'audio/wav';

  // data URIを作成
  const dataUri = `data:${mimeType};base64,${base64Data}`;

  // ChromiumのAudio APIを使って音声を再生
  await targetWebContents.executeJavaScript(`
    (() => {
      try {
        const audio = new Audio(${JSON.stringify(dataUri)});
        audio.volume = 1.0;
        audio.play().catch(error => {
          console.error('音声再生エラー:', error);
        });
      } catch (error) {
        console.error('音声再生エラー:', error);
      }
    })()
  `);
}

/**
 * 通知音再生を統合的に扱う
 * サウンド設定がONの場合にカスタム音声または簡易ビープ音を鳴らす
 */
async function handleNotificationSound() {
  if (!notificationSettings.soundEnabled) {
    return;
  }

  const hasCustomSound = Boolean(filterConfig?.notificationSoundPath);
  if (!hasCustomSound) {
    return;
  }

  await playNotificationSound();
}

/**
 * デスクトップ通知を表示
 */
function showNotification(spot) {
  if (!notificationSettings.notificationEnabled) {
    return;
  }

  const hasCustomSound = Boolean(filterConfig?.notificationSoundPath);
  const soundEnabled = Boolean(notificationSettings.soundEnabled);
  const shouldSilent = hasCustomSound || !soundEnabled;

  const title = 'POTA Notification';
  const body = `${spot.reference}: ${spot.activator} - ${spot.parkName || spot.name || 'Unknown'}\n${spot.frequency} ${spot.mode}`;

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'icon.png'),
      silent: shouldSilent
    });

    notification.show();

    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.focus();
      }
    });
  }
}

/**
 * ポップアップウィンドウを表示
 */
function showPopupNotification(spot) {
  if (!notificationSettings.popupEnabled) {
    return;
  }

  let popupWindow = new BrowserWindow({
    width: 480,
    height: 450,
    title: 'POTA Notification',
    frame: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  popupWindow.loadFile('notification.html');

  // ページが読み込まれたらスポットデータを送信
  popupWindow.webContents.once('did-finish-load', () => {
    popupWindow.webContents.send('spot-data', spot);
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * IPCハンドラーの設定
 */
function setupIpcHandlers() {
  // 設定の読み込み
  ipcMain.handle('load-config', async () => {
    await loadConfig();
    return filterConfig;
  });

  // 設定の保存
  ipcMain.handle('save-config', async (event, config) => {
    return await saveConfig(config);
  });

  // 通知設定の読み込み
  ipcMain.handle('load-notification-settings', async () => {
    await loadNotificationSettings();
    return notificationSettings;
  });

  // 通知設定の保存
  ipcMain.handle('save-notification-settings', async (event, settings) => {
    const result = await saveNotificationSettings(settings);
    // メニューを更新
    updateMenu();
    return result;
  });

  // 設定画面を開く
  ipcMain.on('open-settings', () => {
    createSettingsWindow();
  });

  // 通知音ファイルを選択
  ipcMain.handle('select-sound-file', async () => {
    const result = await dialog.showOpenDialog({
      title: '通知音ファイルを選択',
      filters: [
        { name: '音声ファイル', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'aac'] },
        { name: 'すべてのファイル', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { filePath: result.filePaths[0] };
    }
    return null;
  });

  // 通知音のテスト再生
  ipcMain.handle('test-notification-sound', async (event, soundPath) => {
    const targetPath = soundPath || filterConfig?.notificationSoundPath;
    if (!targetPath) {
      return { success: false, error: '通知音ファイルが設定されていません。' };
    }

    const targetWebContents = getAudioTargetWebContents();
    if (!targetWebContents) {
      return { success: false, error: '音声を再生できるウィンドウがありません。' };
    }

    try {
      await playSoundFromPath(targetPath, targetWebContents);
      return { success: true };
    } catch (error) {
      console.error('テスト通知音再生エラー:', error);
      return { success: false, error: error.message || '不明なエラーが発生しました。' };
    }
  });

  // VOICEVOX設定の読み込み
  ipcMain.handle('load-voicevox-settings', async () => {
    return await loadVoicevoxSettings(VOICEVOX_SETTINGS_FILE);
  });

  // VOICEVOX設定の保存
  ipcMain.handle('save-voicevox-settings', async (event, settings) => {
    return await saveVoicevoxSettings(VOICEVOX_SETTINGS_FILE, settings);
  });

  // VOICEVOX話者一覧取得
  ipcMain.handle('get-voicevox-speakers', async (event, hostname, port) => {
    try {
      return await getVoicevoxSpeakers(hostname, port);
    } catch (error) {
      console.error('話者一覧取得エラー:', error);
      throw error;
    }
  });

  // VOICEVOX音声合成
  ipcMain.handle('synthesize-voicevox', async (event, hostname, port, speakerId, text, params) => {
    try {
      const result = await synthesizeVoicevox(hostname, port, speakerId, text, params);
      
      // 音声データを再生
      if (result.success && result.audioData) {
        const targetWebContents = getAudioTargetWebContents();
        if (targetWebContents) {
          const dataUri = `data:${result.mimeType};base64,${result.audioData}`;
          await targetWebContents.executeJavaScript(`
            (() => {
              try {
                const audio = new Audio(${JSON.stringify(dataUri)});
                audio.volume = 1.0;
                audio.play().catch(error => {
                  console.error('VOICEVOX音声再生エラー:', error);
                });
              } catch (error) {
                console.error('VOICEVOX音声再生エラー:', error);
              }
            })()
          `);
        }
      }
      
      return result;
    } catch (error) {
      console.error('音声合成エラー:', error);
      return {
        success: false,
        error: error.message || '音声合成に失敗しました'
      };
    }
  });

  // VOICEVOX読み上げ文章生成
  ipcMain.handle('generate-voicevox-text', async (event, spot, voicevoxSettings) => {
    try {
      return generateVoicevoxText(spot, voicevoxSettings);
    } catch (error) {
      console.error('読み上げ文章生成エラー:', error);
      throw error;
    }
  });
}

/**
 * メニューバーを作成
 */
function createMenu() {
  const template = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: '通知設定',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            createSettingsWindow();
          }
        },
        {
          label: '読み上げ設定',
          click: () => {
            createVoicevoxSettingsWindow();
          }
        },
        { type: 'separator' },
        {
          label: '終了',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直す' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' }
      ]
    },
    {
      label: '通知',
      submenu: [
        {
          label: '通知',
          type: 'checkbox',
          checked: notificationSettings.notificationEnabled,
          click: async (menuItem) => {
            notificationSettings.notificationEnabled = menuItem.checked;
            await saveNotificationSettings(notificationSettings);
          }
        },
        {
          label: 'ポップアップ',
          type: 'checkbox',
          checked: notificationSettings.popupEnabled,
          click: async (menuItem) => {
            notificationSettings.popupEnabled = menuItem.checked;
            await saveNotificationSettings(notificationSettings);
          }
        },
        {
          label: 'サウンド再生',
          type: 'checkbox',
          checked: notificationSettings.soundEnabled,
          click: async (menuItem) => {
            notificationSettings.soundEnabled = menuItem.checked;
            await saveNotificationSettings(notificationSettings);
          }
        },
        {
          label: '読み上げ機能',
          type: 'checkbox',
          checked: notificationSettings.voicevoxEnabled,
          click: async (menuItem) => {
            notificationSettings.voicevoxEnabled = menuItem.checked;
            await saveNotificationSettings(notificationSettings);
          }
        }
      ]
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: '再読み込み' },
        { role: 'forceReload', label: '強制再読み込み' },
        { role: 'toggleDevTools', label: '開発者ツール' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'ズームリセット' },
        { role: 'zoomIn', label: 'ズームイン' },
        { role: 'zoomOut', label: 'ズームアウト' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'フルスクリーン' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // メニューを更新する関数を返す（後で使用可能）
  return menu;
}

/**
 * メニューバーを更新（通知設定変更時に呼び出す）
 */
function updateMenu() {
  const menu = Menu.getApplicationMenu();
  if (menu) {
    const notificationMenu = menu.items.find(item => item.label === '通知');
    if (notificationMenu && notificationMenu.submenu) {
      const notificationItem = notificationMenu.submenu.items.find(item => item.label === '通知');
      const popupItem = notificationMenu.submenu.items.find(item => item.label === 'ポップアップ');
      const soundItem = notificationMenu.submenu.items.find(item => item.label === 'サウンド再生');
      const voicevoxItem = notificationMenu.submenu.items.find(item => item.label === '読み上げ機能');
      if (notificationItem) {
        notificationItem.checked = notificationSettings.notificationEnabled;
      }
      if (popupItem) {
        popupItem.checked = notificationSettings.popupEnabled;
      }
      if (soundItem) {
        soundItem.checked = notificationSettings.soundEnabled;
      }
      if (voicevoxItem) {
        voicevoxItem.checked = notificationSettings.voicevoxEnabled;
      }
    }
  }
}

/**
 * アプリケーションの初期化
 */
app.whenReady().then(async () => {
  // 設定を読み込む
  await loadConfig();
  
  // 通知設定を読み込む
  await loadNotificationSettings();

  // メインウィンドウを作成
  createMainWindow();

  // API監視を設定（メインウィンドウ作成後）
  setupApiMonitoring();

  // IPCハンドラーを設定
  setupIpcHandlers();

  // メニューバーを作成
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

