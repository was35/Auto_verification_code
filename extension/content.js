chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FILL_CODE') {
        const code = request.code;

        // 1. 写入剪切板
        navigator.clipboard.writeText(code).then(() => {
            console.log('Code copied to clipboard');
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });

        // 2. 尝试自动填写
        const input = findVerificationCodeInput();
        if (input) {
            input.value = code;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 3. 弹窗提示
        showNotification(code);
    }
});

function findVerificationCodeInput() {
    console.log("正在寻找验证码输入框...");

    // 1. 检查当前聚焦的元素
    let activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'INPUT' && !['checkbox', 'radio', 'submit', 'button'].includes(activeEl.type)) {
        console.log("找到当前聚焦的输入框:", activeEl);
        return activeEl;
    }

    // 2. 常见的验证码输入框特征 (按优先级排列)
    const selectors = [
        'input[autocomplete="one-time-code"]', // 标准 H5 验证码
        'input[id*="captcha"]',
        'input[name*="captcha"]',
        'input[id*="verify"]',
        'input[name*="verify"]',
        'input[placeholder*="验证码"]',
        'input[placeholder*="通知"]',
        'input[placeholder*="code"]',
        'input[id*="code"]',
        'input[name*="code"]',
        '.code-input',
        '.verify-input',
        'input[maxlength="6"]',
        'input[maxlength="4"]',
        'input[type="number"][pattern="[0-9]*"]',
        'input[type="tel"]'
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
            console.log("根据选择器找到输入框:", selector, el);
            return el;
        }
    }

    // 3. 兜底：如果只有一个可见的 text/number 输入框
    const allInputs = Array.from(document.querySelectorAll('input')).filter(i => {
        return ['text', 'number', 'tel', 'password'].includes(i.type) && isVisible(i);
    });
    if (allInputs.length === 1) {
        console.log("页面只有一个可见输入框，尝试填充:", allInputs[0]);
        return allInputs[0];
    }

    console.warn("未找到匹配的验证码输入框");
    return null;
}

function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function showNotification(code) {
    const div = document.createElement('div');
    div.id = 'auto-verify-notif';
    div.innerHTML = `
        <div class="av-content">
            <h3>收到验证码: <span class="av-code">${code}</span></h3>
            <p>已写入剪切板，可以直接粘贴。</p>
            <button id="av-confirm">确定</button>
        </div>
    `;
    document.body.appendChild(div);

    document.getElementById('av-confirm').onclick = () => {
        // 点击按钮是一个明确的用户手势，复制成功率更高
        navigator.clipboard.writeText(code);
        div.remove();
    };

    // 自动移除
    setTimeout(() => {
        if (div.parentNode) div.remove();
    }, 10000);
}
