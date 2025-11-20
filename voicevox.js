/**
 * VOICEVOX読み上げ機能
 */

const fs = require('fs').promises;
const https = require('https');
const http = require('http');

/**
 * VOICEVOX設定を読み込む
 */
async function loadVoicevoxSettings(settingsFilePath) {
  try {
    const data = await fs.readFile(settingsFilePath, 'utf-8');
    const settings = JSON.parse(data);
    console.log('VOICEVOX設定を読み込みました:', settings);
    return settings;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // ファイルが存在しない場合はデフォルト設定を返す
      return {
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
      console.error('VOICEVOX設定の読み込みエラー:', error);
      return {
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
    }
  }
}

/**
 * VOICEVOX設定を保存
 */
async function saveVoicevoxSettings(settingsFilePath, settings) {
  try {
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('VOICEVOX設定を保存しました:', settings);
    return { success: true };
  } catch (error) {
    console.error('VOICEVOX設定の保存エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * HTTPリクエストを送信（Promise版）
 */
function httpRequest(options, data = null, isBinary = false) {
  return new Promise((resolve, reject) => {
    const protocol = options.useHttps ? https : http;
    
    const req = protocol.request(options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (isBinary) {
            // バイナリデータの場合はBufferとして返す
            resolve(Buffer.concat(chunks));
          } else {
            // テキストデータの場合は文字列として処理
            const responseData = Buffer.concat(chunks).toString('utf-8');
            try {
              const contentType = res.headers['content-type'] || '';
              if (contentType.includes('application/json')) {
                resolve(JSON.parse(responseData));
              } else {
                resolve(responseData);
              }
            } catch (error) {
              resolve(responseData);
            }
          }
        } else {
          const errorData = Buffer.concat(chunks).toString('utf-8');
          reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(options.timeout || 30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (data) {
      if (typeof data === 'string') {
        req.write(data, 'utf-8');
      } else {
        req.write(data);
      }
    }
    
    req.end();
  });
}

/**
 * VOICEVOX Engineから話者一覧を取得
 */
async function getVoicevoxSpeakers(hostname, port) {
  try {
    const portNum = parseInt(port) || 50021;
    const options = {
      hostname: hostname || 'localhost',
      port: portNum,
      path: '/speakers',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      useHttps: false
    };
    
    const response = await httpRequest(options);
    
    // VOICEVOX APIは話者の配列を返す
    // 各話者には複数のスタイルがあり、スタイルIDが実際の話者IDとして使用される
    if (Array.isArray(response)) {
      const speakers = [];
      response.forEach(speaker => {
        // 各話者のスタイルを個別の話者として追加
        if (speaker.styles && Array.isArray(speaker.styles)) {
          speaker.styles.forEach(style => {
            speakers.push({
              id: style.id,
              name: `${speaker.name} - ${style.name}`
            });
          });
        }
      });
      return speakers;
    } else {
      return [];
    }
  } catch (error) {
    console.error('話者一覧取得エラー:', error);
    throw error;
  }
}

/**
 * VOICEVOX Engineで音声合成
 */
async function synthesizeVoicevox(hostname, port, speakerId, text, params = {}) {
  try {
    const portNum = parseInt(port) || 50021;
    const host = hostname || 'localhost';
    
    // まずaudio_queryを取得
    const queryOptions = {
      hostname: host,
      port: portNum,
      path: `/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      useHttps: false
    };
    
    const audioQuery = await httpRequest(queryOptions);
    
    // パラメータを設定
    if (params.volume !== undefined) {
      audioQuery.volumeScale = params.volume;
    }
    if (params.speed !== undefined) {
      audioQuery.speedScale = params.speed;
    }
    if (params.pitch !== undefined) {
      audioQuery.pitchScale = params.pitch;
    }
    if (params.intonation !== undefined) {
      audioQuery.intonationScale = params.intonation;
    }
    if (params.breathing !== undefined) {
      audioQuery.breathingScale = params.breathing;
    }
    
    // synthesisで音声を生成
    const synthesisOptions = {
      hostname: host,
      port: portNum,
      path: `/synthesis?speaker=${speakerId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      useHttps: false
    };
    
    const audioData = await httpRequest(synthesisOptions, JSON.stringify(audioQuery), true);
    
    // 音声データをBase64エンコードして返す
    return {
      success: true,
      audioData: audioData.toString('base64'),
      mimeType: 'audio/wav'
    };
  } catch (error) {
    console.error('音声合成エラー:', error);
    return {
      success: false,
      error: error.message || '音声合成に失敗しました'
    };
  }
}

/**
 * コールサインの数字を英語読みに変換
 * @param {string} text - 変換するテキスト
 * @returns {string} - 変換後のテキスト
 */
function convertNumbersToEnglish(text) {
  if (!text) return text;
  
  const numberMap = {
    '0': 'ゼロ',
    '1': 'ワン',
    '2': 'ツー',
    '3': 'スリー',
    '4': 'フォー',
    '5': 'ファイブ',
    '6': 'シックス',
    '7': 'セブン',
    '8': 'エイト',
    '9': 'ナイン'
  };
  
  return text.replace(/[0-9]/g, (match) => numberMap[match] || match);
}

/**
 * スポットデータから読み上げ文章を生成
 */
function generateVoicevoxText(spot, voicevoxSettings) {
  // テンプレートを取得（デフォルト値を使用）
  let template = voicevoxSettings.textTemplate || '[reference] [frequency] [mode] [activator] [comments]';
  
  // referenceを置換
  template = template.replace(/\[reference\]/g, spot.reference || '');
  
  // frequencyを置換（設定に応じてメガヘルツ/キロヘルツ形式に変換）
  const frequency = spot.frequency || '';
  if (frequency) {
    if (voicevoxSettings.mhzEnabled) {
      // MHzで読み上げる場合: 1000で割る
      const freqMHz = (parseFloat(frequency) / 1000).toFixed(3);
      template = template.replace(/\[frequency\]/g, `${freqMHz}メガヘルツ`);
    } else {
      // kHzで読み上げる場合: そのまま
      template = template.replace(/\[frequency\]/g, `${frequency}キロヘルツ`);
    }
  } else {
    template = template.replace(/\[frequency\]/g, '');
  }
  
  // modeを置換
  template = template.replace(/\[mode\]/g, spot.mode || '');
  
  // activatorを置換（設定に応じて/をポータブルに置換、数字を英語読みに変換）
  let activator = spot.activator || '';
  if (voicevoxSettings.portableEnabled) {
    activator = activator.replace(/\//g, 'ポータブル');
  }
  if (voicevoxSettings.numberEnglishEnabled) {
    activator = convertNumbersToEnglish(activator);
  }
  template = template.replace(/\[activator\]/g, activator);
  
  // commentsを置換
  template = template.replace(/\[comments\]/g, spot.comments || '');
  
  // nameを置換
  template = template.replace(/\[name\]/g, spot.name || spot.parkName || '');
  
  // locationDescを置換
  template = template.replace(/\[locationDesc\]/g, spot.locationDesc || '');
  
  // 連続する空白を1つに統一して、先頭・末尾の空白を削除
  template = template.replace(/\s+/g, ' ').trim();
  
  return template;
}

/**
 * VOICEVOXで読み上げ（音声再生用のコールバック関数を受け取る）
 */
async function speakWithVoicevox(spot, settingsFilePath, voicevoxEnabled, playAudioCallback) {
  if (!voicevoxEnabled) {
    return;
  }
  
  try {
    const voicevoxSettings = await loadVoicevoxSettings(settingsFilePath);
    
    if (!voicevoxSettings.speakerId) {
      console.log('VOICEVOX: 話者が設定されていません');
      return;
    }
    
    const text = generateVoicevoxText(spot, voicevoxSettings);
    
    const result = await synthesizeVoicevox(
      voicevoxSettings.hostname,
      voicevoxSettings.port,
      voicevoxSettings.speakerId,
      text,
      {
        volume: voicevoxSettings.volume,
        speed: voicevoxSettings.speed,
        pitch: voicevoxSettings.pitch,
        intonation: voicevoxSettings.intonation,
        breathing: voicevoxSettings.breathing
      }
    );
    
    if (result.success && result.audioData && playAudioCallback) {
      // 音声データを再生（コールバック関数を使用）
      await playAudioCallback(result.audioData, result.mimeType);
    } else if (!result.success) {
      console.error('VOICEVOX読み上げエラー:', result.error);
    }
  } catch (error) {
    console.error('VOICEVOX読み上げエラー:', error);
  }
}

/**
 * VOICEVOXで複数スポットを読み上げ（音声再生用のコールバック関数を受け取る）
 * @param {Array} spots - スポットデータの配列
 * @param {string} settingsFilePath - 設定ファイルのパス
 * @param {boolean} voicevoxEnabled - VOICEVOX有効フラグ
 * @param {Object} targetWebContents - 音声再生先のwebContents
 */
async function speakMultipleSpotsWithVoicevox(spots, settingsFilePath, voicevoxEnabled, targetWebContents) {
  if (!voicevoxEnabled || !Array.isArray(spots) || spots.length === 0) {
    return;
  }

  try {
    const voicevoxSettings = await loadVoicevoxSettings(settingsFilePath);

    if (!voicevoxSettings.speakerId) {
      console.log('VOICEVOX: 話者が設定されていません');
      return;
    }

    // 読み上げ数制限を適用
    const maxSpotsPerRead = voicevoxSettings.maxSpotsPerRead || 0;
    const spotsToRead = maxSpotsPerRead > 0
      ? spots.slice(0, maxSpotsPerRead)
      : spots;

    // 各スポットを順次処理（同時再生を防止）
    for (const spot of spotsToRead) {
      const text = generateVoicevoxText(spot, voicevoxSettings);

      const result = await synthesizeVoicevox(
        voicevoxSettings.hostname,
        voicevoxSettings.port,
        voicevoxSettings.speakerId,
        text,
        {
          volume: voicevoxSettings.volume,
          speed: voicevoxSettings.speed,
          pitch: voicevoxSettings.pitch,
          intonation: voicevoxSettings.intonation,
          breathing: voicevoxSettings.breathing
        }
      );

      if (result.success && result.audioData && targetWebContents) {
        // 音声データを再生
        const dataUri = `data:${result.mimeType};base64,${result.audioData}`;
        await targetWebContents.executeJavaScript(`
          (() => {
            return new Promise((resolve, reject) => {
              try {
                const audio = new Audio(${JSON.stringify(dataUri)});
                audio.volume = 1.0;
                audio.onended = () => resolve();
                audio.onerror = (error) => reject(error);
                audio.play().catch(error => {
                  console.error('VOICEVOX音声再生エラー:', error);
                  reject(error);
                });
              } catch (error) {
                console.error('VOICEVOX音声再生エラー:', error);
                reject(error);
              }
            });
          })()
        `);
      } else if (!result.success) {
        console.error('VOICEVOX読み上げエラー:', result.error);
      }
    }
  } catch (error) {
    console.error('VOICEVOX読み上げエラー:', error);
  }
}

module.exports = {
  loadVoicevoxSettings,
  saveVoicevoxSettings,
  getVoicevoxSpeakers,
  synthesizeVoicevox,
  generateVoicevoxText,
  speakWithVoicevox,
  speakMultipleSpotsWithVoicevox
};

