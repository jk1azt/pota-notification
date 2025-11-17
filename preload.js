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
  testNotificationSound: (soundPath) => ipcRenderer.invoke('test-notification-sound', soundPath)
});

