/**
 * 通知ポップアップのロジック
 */

/**
 * ページ読み込み時にスポットデータを待機
 */
window.addEventListener('DOMContentLoaded', () => {
  // スポットデータを受信
  if (window.electronAPI && window.electronAPI.onSpotData) {
    window.electronAPI.onSpotData((spot) => {
      displaySpot(spot);
    });
  }
  
  // 5秒後に自動的に閉じる
  setTimeout(() => {
    window.close();
  }, 5000);
});

/**
 * スポットデータを表示
 */
function displaySpot(spot) {
  document.getElementById('reference').textContent = spot.reference || 'N/A';
  document.getElementById('activator').textContent = spot.activator || 'N/A';
  document.getElementById('park').textContent = spot.parkName || spot.name || 'Unknown';
  document.getElementById('frequency').textContent = spot.frequency || 'N/A';
  document.getElementById('mode').textContent = spot.mode || 'N/A';
  
  if (spot.comments) {
    document.getElementById('comments').textContent = spot.comments;
    document.getElementById('comments-container').style.display = 'block';
  } else {
    document.getElementById('comments-container').style.display = 'none';
  }
}

/**
 * 通知を閉じる
 */
function closeNotification() {
  window.close();
}

