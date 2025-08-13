// media/main.js

(function () {
    // VS Code APIを取得
    const vscode = acquireVsCodeApi();

    const chatLog = document.getElementById('chat-log');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    let thinkingIndicator = null;

    /**
     * メッセージを送信する
     */
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            // ユーザーメッセージをUIに追加
            addMessageToLog(text, 'user');
            
            // 拡張機能側にメッセージを送信
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
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${type}-message`;
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

    // イベントリスナーの設定
    sendButton.addEventListener('click', sendMessage);

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
            case 'llm-response-start':
                thinkingIndicator = addMessageToLog('', 'assistant thinking');
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
            case 'api-key-set-success':
                // APIキーが設定されたら、再度メッセージ送信を試みるなど、
                // 待機していたアクションを再開できる
                addMessageToLog('APIキーが設定されました。再度メッセージを送信してください。', 'assistant');
                break;
        }
    });

    // 初期状態では送信ボタンを有効にする
    sendButton.disabled = false;
}());