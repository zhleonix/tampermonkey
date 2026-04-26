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
            model: 'gemini-3.1-flash-lite-preview'
        },
        openai_local: {
            apiUrl: 'http://localhost:59603/v1/chat/completions',
            model: 'gpt-4o'
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
            await GM_setValue(API_KEY_STORAGE, key.trim());
            alert('API Key 已保存。');
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
            alert(`已切换到模型提供商：${provider.trim()}`);
            return provider.trim();
        }
        alert('无效的模型提供商，请输入正确名称。');
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
        alert(`已选择模型提供商：${providerSelect.value}`);
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
            alert('未找到指定的元素，请检查 targetSelector 配置');
            return;
        }

        const originalText = container.innerText.trim();
        if (!originalText) {
            alert('元素内容为空');
            return;
        }

        btn.innerText = '⏳ 处理中...';
        btn.disabled = true;

        const providerName = providerSelect.value || await GM_getValue(PROVIDER_STORAGE, CONFIG.provider) || DEFAULT_PROVIDER;
        const providerConfig = PROVIDERS[providerName] || PROVIDERS[DEFAULT_PROVIDER];

        const prompt = `
你是一个专业的编辑。
任务：审阅文本中的错别字，错误拼音，排列错乱的段落，按剧情发展的逻辑进行适当整理修正。
要求：
1. 绝对严禁改写、增删任何原文文字（汉语拼音除外，需替换为正常文字），必须保持原汁原味。
2. 保持原有的段落换行格式。
3. 只输出排序后的最终文本，不要包含任何解释或开场白。
4. 文本前10行顺序是正常的，不要修改顺序。
5. 注意上下文的相关性。

待排序文本：

${originalText}


        `;

        // If provider is local Chrome Prompt API, use injected bridge
        if (providerConfig.type === 'prompt_api') {
            try {
                injectPromptApiBridge();
                const resultText = await sendPromptToPage(prompt, providerConfig.model);
                if (resultText) {
                    container.innerText = resultText;
                    alert('✅ 处理完成！（本地 Prompt API）');
                } else {
                    alert('本地 Prompt API 返回空内容');
                }
            } catch (e) {
                console.error('Prompt API 调用失败', e);
                alert('Prompt API 调用失败：' + (e && e.message ? e.message : e));
            } finally {
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;
            }
            return;
        }

        // Remote providers: ensure API key exists
        let apiKey = await GM_getValue(API_KEY_STORAGE, '');
        if (!apiKey) {
            apiKey = await setApiKey();
            if (!apiKey) {
                alert('请先通过菜单设置 API Key。');
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
                        container.innerText = sortedText;
                        alert('✅ 处理完成！');
                    }
                } catch (e) {
                    console.error('解析失败', e);
                    console.error('返回内容', response);
                    alert('API 返回解析失败，请查看控制台');
                } finally {
                    btn.innerText = CONFIG.btnText;
                    btn.disabled = false;
                }
            },
            onerror: function(err) {
                console.error('API 请求出错', err);
                alert('API 请求失败，请检查网络或 API Key');
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;
            },
            ontimeout: function(err) {
                console.error('API 请求Timeout', err);
                alert('API 请求Timeout，请检查网络');
                btn.innerText = CONFIG.btnText;
                btn.disabled = false;

            },
        });
    };

})();