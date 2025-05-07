/**
 * WebSocket通信模块
 * 处理与服务器之间的WebSocket通信
 */

// WebSocket连接实例
let wsConnection = null;

// 消息处理回调函数映射
const messageHandlers = {
    connect: [],
    disconnect: [],
    subscribe: [],
    unsubscribe: [],
    publish: [],
    message: [],
    error: []
};

// 初始化WebSocket连接
function initWebSocket() {
    // 确定WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log(`正在连接到WebSocket服务: ${wsUrl}`);
    
    // 创建WebSocket连接
    if (wsConnection) {
        wsConnection.close();
    }
    
    wsConnection = new WebSocket(wsUrl);
    
    // 设置事件处理器
    wsConnection.onopen = handleOpen;
    wsConnection.onclose = handleClose;
    wsConnection.onerror = handleError;
    wsConnection.onmessage = handleMessage;
    
    return wsConnection;
}

// WebSocket连接打开处理
function handleOpen(event) {
    console.log('WebSocket连接已建立');
}

// WebSocket连接关闭处理
function handleClose(event) {
    console.log('WebSocket连接已关闭');
    wsConnection = null;
    
    // 触发任何注册的断开事件处理器
    triggerHandlers('disconnect', { 
        forced: true,
        error: '与服务器的WebSocket连接已断开'
    });
}

// WebSocket错误处理
function handleError(event) {
    console.error('WebSocket错误:', event);
    triggerHandlers('error', { 
        message: '与服务器的WebSocket连接出错',
        error: 'WebSocket连接失败，请检查服务器是否正常运行'
    });
}

// WebSocket消息处理
function handleMessage(event) {
    try {
        const message = JSON.parse(event.data);
        
        // 检查消息类型和成功标志
        if (message.type) {
            // 触发对应类型的处理器
            triggerHandlers(message.type, message);
        }
        
    } catch (err) {
        console.error('解析WebSocket消息出错:', err);
    }
}

// 发送消息到服务器
function sendMessage(messageType, payload) {
    // 检查WebSocket连接状态
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        console.error('WebSocket未连接或未就绪');
        return false;
    }
    
    // 构建消息对象
    const message = {
        type: messageType,
        payload: payload
    };
    
    try {
        // 发送JSON消息
        wsConnection.send(JSON.stringify(message));
        return true;
    } catch (err) {
        console.error('发送WebSocket消息出错:', err);
        return false;
    }
}

// 添加消息处理器
function addMessageHandler(messageType, handler) {
    if (messageHandlers[messageType]) {
        messageHandlers[messageType].push(handler);
    } else {
        messageHandlers[messageType] = [handler];
    }
}

// 移除消息处理器
function removeMessageHandler(messageType, handler) {
    if (messageHandlers[messageType]) {
        const index = messageHandlers[messageType].indexOf(handler);
        if (index !== -1) {
            messageHandlers[messageType].splice(index, 1);
        }
    }
}

// 触发所有注册的处理器
function triggerHandlers(messageType, data) {
    if (messageHandlers[messageType]) {
        messageHandlers[messageType].forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error(`执行 ${messageType} 处理器错误:`, err);
            }
        });
    }
}

// 检查WebSocket连接状态
function isConnected() {
    return wsConnection && wsConnection.readyState === WebSocket.OPEN;
}

// 导出公共方法
window.WebSocketClient = {
    init: initWebSocket,
    send: sendMessage,
    addHandler: addMessageHandler,
    removeHandler: removeMessageHandler,
    isConnected: isConnected
}; 