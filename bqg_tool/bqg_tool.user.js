// ==UserScript==
// @name         文本剧情逻辑重排助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  读取指定DOM，调用OpenAI API按逻辑排序，保留原话并更新回页面
// @author       Gemini
// @match        https://www.bqg683.xyz/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      localhost
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(async function() {
    'use strict';

    // ================= Popup 弹窗函数 =================
    function showPopup(message) {
        // 创建overlay容器
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            cursor: pointer;
        `;

        // 创建popup内容
        const popup = document.createElement('div');
        popup.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            max-width: 400px;
            word-wrap: break-word;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            animation: popupFadeIn 0.3s ease-in;
        `;
        popup.textContent = message;

        // 添加淡入动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes popupFadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // 点击overlay或popup自动消失
        function removePopup() {
            overlay.remove();
        }
        overlay.addEventListener('click', removePopup);
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 3秒后自动消失
        setTimeout(removePopup, 3000);
    }

    // ================= 配置区域 =================
    const CONFIG = {
        btnText: '🧩 AI整理',
        provider: 'google',
        targetSelector: '#chaptercontent', // ！！！修改这里：指定存放段落的 DOM 选择器
        splitSeparator: '\n' // 识别段落的分隔符
    };

    const PROVIDERS = {
        google: {
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            model: 'gemini-3.1-flash-lite'
        },
        GLM: {
            apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            model: 'glm-4.7-flash'
        },
        openai_local: {
            apiUrl: 'http://localhost:59603/v1/chat/completions',
            model: 'gpt-4o'
        },
        ollama: {
            apiUrl: 'http://127.0.0.1:11434/v1/chat/completions',
            model: 'qwen2.5vl:3b'
        }
        ,chrome: {
            type: 'prompt_api', // local Chrome Prompt API (no remote HTTP)
            model: '' // only default model now
        }
    };

    const DEFAULT_PROVIDER = 'google';
    const PROVIDER_STORAGE = 'modelProvider';
    const API_KEY_STORAGE = 'openaiApiKey';
    const MENU_LABEL_SET_API_KEY = '设置 API Key';
    const MENU_LABEL_SET_PROVIDER = '选择模型提供商';

    async function setApiKey() {
        const key = prompt('请输入 API Key');
        if (key) {
            const current = await GM_getValue(PROVIDER_STORAGE, CONFIG.provider);
            await GM_setValue(API_KEY_STORAGE+current, key.trim());
            showPopup('API Key 已保存。');
            return key.trim();
        }
        return '';
    }

    async function setProvider() {
        const options = Object.keys(PROVIDERS).join(' / ');
        const current = await GM_getValue(PROVIDER_STORAGE, CONFIG.provider);
        const provider = prompt(`请输入模型提供商名称：${options}`, current);
        if (provider && PROVIDERS[provider.trim()]) {
            await GM_setValue(PROVIDER_STORAGE, provider.trim());
            showPopup(`已切换到模型提供商：${provider.trim()}`);
            return provider.trim();
        }
        showPopup('无效的模型提供商，请输入正确名称。');
        return current;
    }

    GM_registerMenuCommand(MENU_LABEL_SET_API_KEY, async () => {
        await setApiKey();
    });
    GM_registerMenuCommand(MENU_LABEL_SET_PROVIDER, async () => {
        await setProvider();
    });

    // ================= UI 按钮创建 =================
    const providerSelect = document.createElement('select');
    providerSelect.style.cssText = 'padding: 6px 10px; border-radius: 5px; border: 1px solid #ccc; background: white; font-size: 14px;';
    for (const providerName of Object.keys(PROVIDERS)) {
        const option = document.createElement('option');
        option.value = providerName;
        option.textContent = providerName;
        providerSelect.appendChild(option);
    }

    const currentProvider = await GM_getValue(PROVIDER_STORAGE, CONFIG.provider) || DEFAULT_PROVIDER;
    providerSelect.value = currentProvider;
    providerSelect.addEventListener('change', async () => {
        await GM_setValue(PROVIDER_STORAGE, providerSelect.value);
        showPopup(`已选择模型提供商：${providerSelect.value}`);
    });

    const providerLabel = document.createElement('span');
    providerLabel.textContent = '模型：';
    providerLabel.style.cssText = 'font-size: 14px; color: #333;';

    const btn = document.createElement('button');
    btn.innerText = CONFIG.btnText;
    btn.style.cssText = `
        padding: 10px 15px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-size: 14px;
    `;

    const controlPanel = document.createElement('div');
    controlPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 8px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.08);
    `;
    // Arrange provider label and select on the top row, button on a separate bottom row
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex; align-items:center; gap:8px;';
    topRow.appendChild(providerLabel);
    topRow.appendChild(providerSelect);
    controlPanel.appendChild(topRow);

    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'margin-top:6px; width:100%; display:flex; justify-content:flex-end;';
    bottomRow.appendChild(btn);
    controlPanel.appendChild(bottomRow);
    document.body.appendChild(controlPanel);

    // Injected page bridge script for Chrome Prompt API (only inject once)
    function injectPromptApiBridge() {
        if (window.__TM_PROMPT_API_BRIDGE_INJECTED__) return;
        window.__TM_PROMPT_API_BRIDGE_INJECTED__ = true;

        const script = document.createElement('script');
        script.textContent = `(() => {
            if (window.__PROMPT_API_BRIDGE__) return;
            window.__PROMPT_API_BRIDGE__ = true;

            async function tryCallPromptAPI(promptText, model) {
                // Primary: use LanguageModel.create() + session.prompt() as per Chrome Prompt API example.
                try {
                    if (window.LanguageModel && typeof LanguageModel.create === 'function') {
                        
                        const session = await LanguageModel.create({
                            expectedInputs: [
                                { type: "text", languages: ["en"] },
                            ],
                            expectedOutputs: [{ type: "text", languages: ["en"] }],
                        });
                        console.log('Prompt API session created', session);
                        const response = await session.prompt([
                            {
                                role: 'user',
                                content: [ { type: 'text', value: promptText } ]
                            }
                        ]);
                        console.log('Prompt API response', response);
                        // Try to extract text result from common response shapes
                        try {
                            if (Array.isArray(response) && response.length) {
                                const first = response[0];
                                if (first && first.content && Array.isArray(first.content)) {
                                    const textItem = first.content.find(c => c.type === 'text');
                                    if (textItem) return textItem.value;
                                }
                            }
                            if (response && response.output && Array.isArray(response.output)) {
                                const textItem = response.output.find(c => c.type === 'text');
                                if (textItem) return textItem.value;
                            }
                        } catch (e) { /* ignore extraction errors */ }
                        return String(response || '');
                    }
                } catch (e) { /* ignore and try other entry points */ }

               

                throw new Error('Prompt API not available');
            }

            window.addEventListener('message', async (ev) => {
                try {
                    const msg = ev.data;
                    if (!msg || !msg.__TM_PROMPT_API_REQUEST__) return;
                    const id = msg.id;
                    const promptText = msg.prompt;
                    const model = msg.model;

                    try {
                        const res = await tryCallPromptAPI(promptText, model);
                        // Normalize result to string if possible
                        const text = (res && (res.text || res.output || res.result)) || String(res || '');
                        window.postMessage({__TM_PROMPT_API_RESPONSE__: true, id, ok: true, result: text}, '*');
                    } catch (err) {
                        window.postMessage({__TM_PROMPT_API_RESPONSE__: true, id, ok: false, error: err && err.message ? err.message : String(err)}, '*');
                    }
                } catch (e) {
                    // swallow
                }
            }, false);
        })();`;
        document.documentElement.appendChild(script);
        script.remove();
    }

    // Send prompt to injected bridge and await response
    function sendPromptToPage(promptText, model, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).slice(2);
            function handler(ev) {
                const msg = ev.data;
                if (!msg || !msg.__TM_PROMPT_API_RESPONSE__ || msg.id !== id) return;
                window.removeEventListener('message', handler);
                if (msg.ok) resolve(msg.result);
                else reject(new Error(msg.error || 'Unknown error from Prompt API'));
            }
            window.addEventListener('message', handler);
            window.postMessage({__TM_PROMPT_API_REQUEST__: true, id, prompt: promptText, model}, '*');

            const timer = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Prompt API response timeout'));
            }, timeoutMs);
            // clear timer on resolution
            const origResolve = resolve;
            resolve = (v) => { clearTimeout(timer); origResolve(v); };
            const origReject = reject;
            reject = (e) => { clearTimeout(timer); origReject(e); };
        });
    }

    // ================= 核心逻辑 =================
    btn.onclick = async () => {
        const container = document.querySelector(CONFIG.targetSelector);
        if (!container) {
            showPopup('未找到指定的元素，请检查 targetSelector 配置');
            return;
        }

        const originalText = container.innerText.trim();
        if (!originalText) {
            showPopup('元素内容为空');
            return;
        }

        btn.innerText = '⏳ 处理中...';
        btn.disabled = true;

        const providerName = providerSelect.value || await GM_getValue(PROVIDER_STORAGE, CONFIG.provider) || DEFAULT_PROVIDER;
        const providerConfig = PROVIDERS[providerName] || PROVIDERS[DEFAULT_PROVIDER];

        const prompt = `
# Role
你是一个极其严谨、注重细节的专业小说文本编辑。

# Task
我将为你提供一段受到损坏的小说章节。这段文本存在【无关干扰字符】、【错别字/拼音】以及【中后半部分段落错乱】的问题。请你按照剧情发展的逻辑，对其进行净化、修正和重新排序。

# Constraints (严格约束)
1. **关于增删改写限制**：
   - 【允许且必须】剔除故意插入的无关干扰字符（如小广告、乱码、无意义符号）。
   - 【允许且必须】将错误拼音替换为正确的汉字，修正明显的错别字。
   - 【绝对严禁】对小说原本的情节、语句进行任何修饰、润色、扩展或凭空捏造。除了剔除杂质和错字修正外，必须保持原汁原味。每个段落开头如有各种空格字符，需要保留，严禁删除。
2. **关于前10行**：文本的前10行（以换行符为准）顺序是完全正常的，作为剧情基调参考，【绝对严禁】修改前10行的先后顺序。
3. **关于格式**：保持段落之间的正常换行。
4. **关于输出**：只输出排序、修正后的最终干净文本。**绝对严禁**包含任何解释、开场白、过渡句或“好的，为您整理如下”等废话。

# Input Data
待排序文本如下：

${originalText}


        `;

        // If provider is local Chrome Prompt API, use injected bridge
        if (providerConfig.type === 'prompt_api') {
            try {
                injectPromptApiBridge();
                const resultText = await sendPromptToPage(prompt, providerConfig.model);
                if (resultText) {
                    container.innerText = resultText;
                    showPopup('✅ 处理完成！（本地 Prompt API）');
                } else {
                    showPopup('本地 Prompt API 返回空内容');
                }
            } catch (e) {
                console.error('Prompt API 调用失败', e);
                showPopup('Prompt API 调用失败：' + (e && e.message ? e.message : e));
            } finally {
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;
            }
            return;
        }

        // Remote providers: ensure API key exists
        let apiKey = await GM_getValue(API_KEY_STORAGE+providerName, '');
        if (!apiKey) {
            apiKey = await setApiKey();
            if (!apiKey) {
                showPopup('请先通过菜单设置 API Key。');
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;
                return;
            }
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: providerConfig.apiUrl,
            timeout: 90000, //ms
            // 👇 关键：防止后台被关闭
            synchronous: false,
            // 👇 关键：忽略页面卸载导致的中断
            abortOnPageUnload: false,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            data: JSON.stringify({
                model: providerConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1 // 低随机性确保严谨
            }),
            onload: function(response) {
                try {
                    const res = JSON.parse(response.responseText);
                    const sortedText = res.choices[0].message.content.trim();

                    if (sortedText) {
                        // 更新回页面
                        container.innerText = '　　' + sortedText + '\n\n';
                        showPopup('✅ 处理完成！');
                    }
                } catch (e) {
                    console.error('解析失败', e);
                    console.error('返回内容', response);
                    // 尝试提取错误信息
                    let errorMsg = 'API 返回解析失败';
                    try {
                        const errorRes = JSON.parse(response.responseText);
                        const errContent = errorRes.error?.message || errorRes.message || JSON.stringify(errorRes);
                        errorMsg = `状态码: ${response.status}\n错误: ${errContent}`;
                    } catch (parseErr) {
                        if (response.status) {
                            errorMsg = `状态码: ${response.status}\n响应: ${response.responseText.substring(0, 200)}`;
                        }
                    }
                    showPopup(errorMsg);
                } finally {
                    btn.innerText = CONFIG.btnText;
                    btn.disabled = false;
                }
            },
            onerror: function(err) {
                console.error('API 请求出错', err);
                let errorMsg = 'API 请求失败，请检查网络或 API Key';
                if (err.responseText) {
                    try {
                        const errorRes = JSON.parse(err.responseText);
                        const errContent = errorRes.error?.message || errorRes.message || JSON.stringify(errorRes);
                        errorMsg = `状态码: ${err.status || '未知'}\n错误: ${errContent}`;
                    } catch (parseErr) {
                        errorMsg = `状态码: ${err.status || '未知'}\n响应: ${err.responseText.substring(0, 200)}`;
                    }
                } else if (err.statusText) {
                    errorMsg = `状态码: ${err.status || '未知'}\n错误: ${err.statusText}`;
                }
                showPopup(errorMsg);
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;
            },
            ontimeout: function(err) {
                console.error('API 请求Timeout', err);
                let errorMsg = 'API 请求Timeout，请检查网络';
                if (err.responseText) {
                    errorMsg += `（状态码: ${err.status || '未知'}）`;
                } else if (err.statusText) {
                    errorMsg += `（${err.statusText}）`;
                }
                showPopup(errorMsg);
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;

            },
        });
    };

})();