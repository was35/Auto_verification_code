let socket = null;
let deviceId = null;
const RECONNECT_INTERVAL = 5000;
const PING_INTERVAL = 20000;
const DEFAULT_SERVER_URL = "ws://45.207.213.103:8000";

// 生成或获取设备唯一ID
chrome.storage.local.get(['deviceId'], (result) => {
    if (result.deviceId) {
        deviceId = result.deviceId;
    } else {
        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
        chrome.storage.local.set({ deviceId: deviceId });
    }
});

function connectWebSocket() {
    chrome.storage.local.get(['token', 'serverUrl', 'manualOff'], (res) => {
        // 如果用户手动关闭了连接，则不自动连接
        if (res.manualOff) {
            console.log("WebSocket 处于手动关闭状态，跳过自动连接");
            return;
        }

        const token = res.token;
        const serverUrl = res.serverUrl || DEFAULT_SERVER_URL;
        if (!token) return;

        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const wsUrl = `${serverUrl}/ws/${deviceId}?token=${token}`;
        console.log("正在尝试连接 WebSocket...");

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("WebSocket 已成功连接");
            chrome.action.setBadgeText({ text: 'ON' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            startHeartbeat();
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'VERIFICATION_CODE') {
                    handleIncomingCode(data.code);
                }
            } catch (e) {
                console.error("解析消息失败:", e);
            }
        };

        socket.onclose = (e) => {
            console.log("WebSocket 已断开:", e.reason);
            chrome.action.setBadgeText({ text: 'OFF' });
            chrome.action.setBadgeBackgroundColor({ color: '#F44336' });

            // 只有在非手动关闭的情况下才尝试重连
            chrome.storage.local.get(['manualOff'], (res) => {
                if (!res.manualOff) {
                    setTimeout(connectWebSocket, RECONNECT_INTERVAL);
                }
            });
        };

        socket.onerror = (error) => {
            console.error("WebSocket 错误:", error);
            socket.close();
        };
    });
}

// 心跳机制
let heartbeatTimer = null;
function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
        } else {
            clearInterval(heartbeatTimer);
        }
    }, PING_INTERVAL);
}

// V3 生命周期保活
chrome.alarms.create('reconnect-alarm', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'reconnect-alarm') {
        connectWebSocket();
    }
});

function handleIncomingCode(code) {
    chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'FILL_CODE',
                code: code
            }).catch(() => { });
        });
    });

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '收到验证码',
        message: `验证码 ${code} 已收到，正在尝试自动填充`,
        priority: 2
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CONNECT' || message.type === 'MANUAL_CONNECT') {
        chrome.storage.local.set({ manualOff: false }, () => {
            connectWebSocket();
        });
        sendResponse({ status: 'connecting' });
    } else if (message.type === 'MANUAL_DISCONNECT') {
        chrome.storage.local.set({ manualOff: true }, () => {
            if (socket) {
                socket.close();
            }
        });
        sendResponse({ status: 'disconnected' });
    }
});

// 初始化
connectWebSocket();
