document.addEventListener('DOMContentLoaded', () => {
    const views = {
        login: document.getElementById('login-view'),
        register: document.getElementById('register-view'),
        main: document.getElementById('main-view')
    };
    const msgEl = document.getElementById('msg');
    const userEl = document.getElementById('current-user');
    const apiUrlEl = document.getElementById('api-url');

    const DEFAULT_SERVER = "http://45.207.213.103:8000";

    // 载入状态
    chrome.storage.local.get(['token', 'username', 'apiToken', 'server_http_url'], (res) => {
        const serverUrl = res.server_http_url || DEFAULT_SERVER;
        document.getElementById('login-server').value = serverUrl;
        document.getElementById('reg-server').value = serverUrl;

        if (res.token && res.username) {
            showView('main');
            userEl.textContent = res.username;
            updateApiUrlDisplay(serverUrl, res.username);
            updateStatusDot();
        } else {
            showView('login');
        }
    });

    // 视图切换
    document.getElementById('show-register').onclick = (e) => { e.preventDefault(); showView('register'); };
    document.getElementById('show-login').onclick = (e) => { e.preventDefault(); showView('login'); };

    // 注册逻辑
    document.getElementById('register-btn').onclick = async () => {
        const u = document.getElementById('reg-username').value;
        const p = document.getElementById('reg-password').value;
        let server = document.getElementById('reg-server').value.trim();
        if (!server.match(/^https?:\/\//)) server = 'http://' + server;
        if (server.endsWith('/')) server = server.slice(0, -1);

        if (!u || !p || !server) {
            showMessage('请填写所有字段', 'error');
            return;
        }

        try {
            const resp = await fetch(`${server}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await resp.json();
            if (resp.ok) {
                showMessage(data.message || '注册成功', 'success');
                showView('login');
                document.getElementById('login-server').value = server;
            } else {
                showMessage(data.detail || '注册失败', 'error');
            }
        } catch (e) {
            showMessage('无法连接到服务器，请检查地址', 'error');
        }
    };

    // 登录逻辑
    document.getElementById('login-btn').onclick = async () => {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        let server = document.getElementById('login-server').value.trim();
        if (!server.match(/^https?:\/\//)) server = 'http://' + server;
        if (server.endsWith('/')) server = server.slice(0, -1);

        if (!u || !p || !server) {
            showMessage('请填写所有字段', 'error');
            return;
        }

        // 自动转换 ws 协议用于 background
        const wsServer = server.replace('http://', 'ws://').replace('https://', 'wss://');

        try {
            const resp = await fetch(`${server}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await resp.json();
            if (resp.ok) {
                chrome.storage.local.set({
                    token: data.access_token,
                    username: data.user_id,
                    apiToken: data.api_token,
                    serverUrl: wsServer,
                    server_http_url: server,
                    manualOff: false // 登录后默认开启连接
                }, () => {
                    chrome.runtime.sendMessage({ type: 'CONNECT' });
                    userEl.textContent = data.user_id;
                    updateApiUrlDisplay(server, data.user_id);
                    showView('main');
                    updateStatusDot();
                });
            } else {
                showMessage(data.detail || '登录失败', 'error');
            }
        } catch (e) {
            showMessage('无法连接到服务器，请检查地址', 'error');
        }
    };

    // 退出逻辑
    document.getElementById('logout-btn').onclick = () => {
        chrome.storage.local.remove(['token', 'username', 'apiToken'], () => {
            showView('login');
        });
    };

    // 复制接口链接
    document.getElementById('copy-api-btn').onclick = () => {
        navigator.clipboard.writeText(apiUrlEl.textContent).then(() => {
            const oldText = document.getElementById('copy-api-btn').textContent;
            document.getElementById('copy-api-btn').textContent = '已复制!';
            setTimeout(() => {
                document.getElementById('copy-api-btn').textContent = oldText;
            }, 2000);
        });
    };

    // 断开/连接切换
    const toggleBtn = document.getElementById('toggle-conn-btn');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            chrome.action.getBadgeText({}, (text) => {
                if (text === 'ON') {
                    chrome.runtime.sendMessage({ type: 'MANUAL_DISCONNECT' });
                } else {
                    chrome.runtime.sendMessage({ type: 'MANUAL_CONNECT' });
                }
                // 立即刷新一下状态
                setTimeout(updateStatusDot, 200);
            });
        };
    }

    function showView(viewName) {
        Object.keys(views).forEach(v => {
            if (v === viewName) views[v].classList.remove('hidden');
            else views[v].classList.add('hidden');
        });
    }

    function showMessage(text, type) {
        msgEl.textContent = text;
        msgEl.className = 'message ' + type;
        setTimeout(() => { msgEl.textContent = ''; }, 5000);
    }

    function updateApiUrlDisplay(httpUrl, username) {
        apiUrlEl.textContent = `${httpUrl}/push/${username}`;
    }

    function updateStatusDot() {
        chrome.action.getBadgeText({}, (text) => {
            const dot = document.getElementById('status-dot');
            const txt = document.getElementById('status-text');
            const btn = document.getElementById('toggle-conn-btn');
            if (text === 'ON') {
                dot.classList.add('on');
                txt.textContent = '已连接';
                if (btn) {
                    btn.textContent = '断开连接';
                    btn.className = 'mini-btn on';
                }
            } else {
                dot.classList.remove('on');
                txt.textContent = '未连接';
                if (btn) {
                    btn.textContent = '开始连接';
                    btn.className = 'mini-btn off';
                }
            }
        });
    }

    // 定时刷新状态
    setInterval(updateStatusDot, 2000);
});
