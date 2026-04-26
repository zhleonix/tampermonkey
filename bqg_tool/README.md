To add local script into TamperMonkey, add following scripts:

```js
// ==UserScript==
// @name         文本剧情逻辑重排助手_File
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  读取指定DOM，调用OpenAI API按逻辑排序，保留原话并更新回页面
// @author       zhleonix
// @match        https://www.bqg683.xyz/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      localhost
// @connect      generativelanguage.googleapis.com
// @require      file:///d:/workspace/tampermonkey/bqg_tool/bqg_tool.user.js
// ==/UserScript==


```

> NOTE
> Ensure local file access is enabled in Chrome Extension Configuration for TamperMonkey!