/**
 * Preloadスクリプト
 * セキュリティのためのcontextIsolation設定とIPC通信の橋渡し
 */

const { contextBridge, ipcRenderer } = require('electron');

// IPC通信のAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 設定の読み込み
  loadConfig: () => ipcRenderer.invoke('load-config'),
  
  // 設定の保存
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // 通知設定の読み込み
  loadNotificationSettings: () => ipcRenderer.invoke('load-notification-settings'),
  
  // 通知設定の保存
  saveNotificationSettings: (settings) => ipcRenderer.invoke('save-notification-settings', settings),
  
  // 設定画面を開くための通知
  openSettings: () => ipcRenderer.send('open-settings'),
  
  // スポットデータを受信
  onSpotData: (callback) => {
    ipcRenderer.on('spot-data', (event, spot) => callback(spot));
  },
  
  // 通知音ファイルを選択
  selectSoundFile: () => ipcRenderer.invoke('select-sound-file'),

  // 通知音のテスト再生
  testNotificationSound: (soundPath) => ipcRenderer.invoke('test-notification-sound', soundPath),

  // VOICEVOX設定の読み込み
  loadVoicevoxSettings: () => ipcRenderer.invoke('load-voicevox-settings'),

  // VOICEVOX設定の保存
  saveVoicevoxSettings: (settings) => ipcRenderer.invoke('save-voicevox-settings', settings),

  // VOICEVOX話者一覧取得
  getVoicevoxSpeakers: (hostname, port) => ipcRenderer.invoke('get-voicevox-speakers', hostname, port),

  // VOICEVOX音声合成
  synthesizeVoicevox: (hostname, port, speakerId, text, params) => 
    ipcRenderer.invoke('synthesize-voicevox', hostname, port, speakerId, text, params),

  // VOICEVOX読み上げ文章生成
  generateVoicevoxText: (spot, voicevoxSettings) => 
    ipcRenderer.invoke('generate-voicevox-text', spot, voicevoxSettings)
});

