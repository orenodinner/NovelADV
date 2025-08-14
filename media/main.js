// media/main.js

(function () {
    const vscode = acquireVsCodeApi();

    const chatLog = document.getElementById('chat-log');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    
    let thinkingIndicator = null;

    /**
     * メッセージを送信する
     */
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text && !sendButton.disabled) {
            addMessageToLog(text, 'user');
            
            vscode.postMessage({
                command: 'user-message',
                text: text
            });

            messageInput.value = '';
            sendButton.disabled = true;
        }
    }
    
    /**
     * チャットログにメッセージを追加する
     * @param {string} text メッセージ内容
     * @param {'user' | 'assistant' | 'error'} type メッセージの送信者
     */
    function addMessageToLog(text, type) {
        if (thinkingIndicator) {
            thinkingIndicator.remove();
            thinkingIndicator = null;
        }

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${type}-message`;
        
        // テキストを安全に設定
        bubble.textContent = text;
        
        chatLog.appendChild(bubble);
        scrollToBottom();
        return bubble;
    }

    /**
     * チャットログを一番下までスクロールする
     */
    function scrollToBottom() {
        chatLog.scrollTop = chatLog.scrollHeight;
    }
    
    /**
     * APIキーの設定を促すメッセージを表示する
     */
    function requestApiKeySetup() {
        const setupButton = document.createElement('button');
        setupButton.textContent = 'Set API Key';
        setupButton.onclick = () => {
            vscode.postMessage({ command: 'setup-api-key' });
        };
        const bubble = addMessageToLog('API key is not set. Please set it to continue. ', 'error');
        bubble.appendChild(setupButton);
    }


    // --- イベントリスナーの設定 ---
    sendButton.addEventListener('click', sendMessage);
    saveButton.addEventListener('click', () => vscode.postMessage({ command: 'save-game' }));
    loadButton.addEventListener('click', () => vscode.postMessage({ command: 'load-game' }));

    messageInput.addEventListener('keydown', (e) => {
        // Ctrl+Enter or Cmd+Enterで送信
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 拡張機能からのメッセージを処理
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'assistant-message':
                addMessageToLog(message.text, 'assistant');
                sendButton.disabled = false;
                break;
            case 'error-message':
                addMessageToLog(message.text, 'error');
                sendButton.disabled = false;
                break;
            case 'llm-response-start':
                thinkingIndicator = addMessageToLog('Thinking', 'assistant thinking');
                sendButton.disabled = true;
                break;
            case 'llm-response-chunk':
                if (thinkingIndicator) {
                    thinkingIndicator.textContent += message.chunk;
                    scrollToBottom();
                }
                break;
            case 'llm-response-end':
                if (thinkingIndicator) {
                    thinkingIndicator.classList.remove('thinking');
                    thinkingIndicator.textContent = message.fullText; // 最終的なテキストで確定
                    thinkingIndicator = null;
                }
                sendButton.disabled = false;
                break;
            case 'llm-response-error':
                 if (thinkingIndicator) {
                    thinkingIndicator.remove();
                    thinkingIndicator = null;
                }
                addMessageToLog(`エラー: ${message.error}`, 'error');
                sendButton.disabled = false;
                break;
            case 'request-api-key':
                requestApiKeySetup();
                break;
            case 'api-key-set-success':
                addMessageToLog('APIキーが設定されました。再度メッセージを送信してください。', 'assistant');
                break;
            case 'load-history':
                chatLog.innerHTML = ''; // ログをクリア
                message.history.forEach(msg => {
                    addMessageToLog(msg.content, msg.role);
                });
                sendButton.disabled = false;
                break;
        }
    });

    // Webviewのロード完了を拡張機能側に通知
    vscode.postMessage({ command: 'webview-ready' });
}());