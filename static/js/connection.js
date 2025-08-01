/**
 * 连接管理模块
 * 处理与MQTT Broker的连接、断开及状态管理
 */

// 连接配置
let mqttConfig = {
    broker: '',
    port: '',
    clientId: '',
    username: '',
    password: ''
};

// 连接状态
let isConnectedToMQTT = false;

// 页面元素
const elements = {
    broker: document.getElementById('broker'),
    port: document.getElementById('port'),
    clientId: document.getElementById('clientId'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    statusDisplay: document.getElementById('connection-status'),
    publishBtn: document.getElementById('publish-btn'),
    subscribeBtn: document.getElementById('subscribe-btn')
};

// 连接状态类
const ConnectionStatus = {
    DISCONNECTED: 'status-disconnected',
    CONNECTING: 'status-connecting',
    CONNECTED: 'status-connected',
    ERROR: 'status-error'
};

// 旧的本地存储配置函数已移除，现在使用基于客户端ID的配置管理

// 旧的本地存储配置加载函数已移除，现在使用基于客户端ID的配置管理

// 初始化事件处理
function initConnectionHandlers() {
    // 生成默认客户端ID（如果为空且不是只读）
    if (!elements.clientId.value && !elements.clientId.readOnly) {
        elements.clientId.value = `web_mqtt_${Math.random().toString(16).substr(2, 8)}`;
    }

    // 初始化WebSocket
    WebSocketClient.init();
    
    // 连接按钮事件
    elements.connectBtn.addEventListener('click', connectToBroker);
    
    // 断开连接按钮事件
    elements.disconnectBtn.addEventListener('click', disconnectFromBroker);
    
    // 添加消息处理器
    WebSocketClient.addHandler('connect', handleMQTTConnected);
    WebSocketClient.addHandler('disconnect', handleMQTTDisconnected);
    WebSocketClient.addHandler('error', handleError);
    WebSocketClient.addHandler('message', handleIncomingMessage);
    
    console.log('连接管理模块初始化完成');
}

// 连接到MQTT代理
function connectToBroker() {
    // 获取连接参数
    const broker = elements.broker.value.trim();
    const port = elements.port.value.trim();
    const clientId = elements.clientId.value.trim() || `web_mqtt_${Math.random().toString(16).substr(2, 8)}`;
    const username = elements.username.value.trim();
    const password = elements.password.value;

    // 验证必填参数
    if (!broker) {
        updateConnectionStatus('请输入代理地址', ConnectionStatus.ERROR);
        return;
    }

    // 保存配置
    mqttConfig = {
        broker,
        port,
        clientId,
        username,
        password
    };
    
    // 旧的本地存储逻辑已移除

    try {
        // 更新状态为连接中
        updateConnectionStatus('连接中...', ConnectionStatus.CONNECTING);
        
        // 发送连接请求
        const success = WebSocketClient.send('connect', mqttConfig);
        
        if (!success) {
            updateConnectionStatus('无法发送连接请求', ConnectionStatus.ERROR);
        }
        
    } catch (err) {
        console.error('连接错误:', err);
        updateConnectionStatus(`连接错误: ${err.message}`, ConnectionStatus.ERROR);
    }
}

// 断开连接
function disconnectFromBroker() {
    if (isConnectedToMQTT) {
        try {
            WebSocketClient.send('disconnect', {});
        } catch (err) {
            console.error('断开连接错误:', err);
        }
    }
}

// 处理MQTT连接成功
function handleMQTTConnected(data) {
    isConnectedToMQTT = true;
    updateConnectionStatus('已连接', ConnectionStatus.CONNECTED);
    updateUIForConnectedState(true);
    
    // 触发MQTT连接成功回调，用于恢复订阅
    setTimeout(() => {
        if (typeof window.onMQTTConnected === 'function') {
            window.onMQTTConnected();
        }
    }, 500);
}

// 处理MQTT断开连接
function handleMQTTDisconnected(data) {
    isConnectedToMQTT = false;
    
    // 如果是强制断开（如WebSocket连接断开）
    if (data.forced) {
        updateConnectionStatus('连接已断开', ConnectionStatus.ERROR);
    } else {
        updateConnectionStatus('已断开连接', ConnectionStatus.DISCONNECTED);
    }
    
    updateUIForConnectedState(false);
}

// 处理错误
function handleError(data) {
    console.error('MQTT错误:', data.error);
    updateConnectionStatus(`连接错误: ${data.error}`, ConnectionStatus.ERROR);
}

// 更新连接状态显示
function updateConnectionStatus(message, statusClass) {
    // 移除所有状态类
    elements.statusDisplay.classList.remove(
        ConnectionStatus.DISCONNECTED,
        ConnectionStatus.CONNECTING,
        ConnectionStatus.CONNECTED,
        ConnectionStatus.ERROR
    );
    
    // 添加新状态类
    elements.statusDisplay.classList.add(statusClass);
    
    // 设置状态文本
    let icon = '';
    switch(statusClass) {
        case ConnectionStatus.CONNECTED:
            icon = '<i class="material-icons">check_circle</i> ';
            break;
        case ConnectionStatus.CONNECTING:
            icon = '<i class="material-icons">hourglass_empty</i> ';
            break;
        case ConnectionStatus.DISCONNECTED:
            icon = '<i class="material-icons">highlight_off</i> ';
            break;
        case ConnectionStatus.ERROR:
            icon = '<i class="material-icons">error</i> ';
            break;
    }
    elements.statusDisplay.innerHTML = icon + message;
}

// 更新UI元素的启用/禁用状态
function updateUIForConnectedState(connected) {
    // 连接按钮
    elements.connectBtn.disabled = connected;
    elements.disconnectBtn.disabled = !connected;
    
    // 发布订阅按钮
    elements.publishBtn.disabled = !connected;
    elements.subscribeBtn.disabled = !connected;
    
    // 连接参数字段
    elements.broker.disabled = connected;
    elements.port.disabled = connected;
    elements.clientId.disabled = connected;
    elements.username.disabled = connected;
    elements.password.disabled = connected;
    
    // 更新发布者的自动发布UI状态
    if (window.Publisher && Publisher.updateConnectionState) {
        Publisher.updateConnectionState(connected);
    }
}

// 获取连接状态
function isMQTTConnected() {
    return isConnectedToMQTT;
}

// 处理接收到的消息
function handleIncomingMessage(message) {
    // 通知订阅者处理消息
    if (window.onMessage) {
        window.onMessage(message.payload);
    }
}

// 导出公共方法
window.ConnectionManager = {
    init: initConnectionHandlers,
    connect: connectToBroker,
    disconnect: disconnectFromBroker,
    isConnected: isMQTTConnected
}; 