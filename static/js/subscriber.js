/**
 * 消息订阅模块
 * 处理MQTT主题的订阅和消息接收
 */

// 页面元素
const subscribeElements = {
    topic: document.getElementById('sub-topic'),
    qos: document.getElementById('sub-qos'),
    subscribeBtn: document.getElementById('subscribe-btn'),
    clearMessagesBtn: document.getElementById('clear-messages-btn'),
    subscriptionsList: document.getElementById('subscriptions-list'),
    receivedMessagesList: document.getElementById('received-messages-list')
};

// 活动订阅列表
const activeSubscriptions = {};

// 已接收消息的存储（最多保留100条）
const receivedMessages = [];
const MAX_RECEIVED_MESSAGES = 100;

// 初始化订阅功能事件处理
function initSubscriberHandlers() {
    // 订阅按钮点击事件
    subscribeElements.subscribeBtn.addEventListener('click', function(event) {
        event.preventDefault();
        subscribeToTopic();
    });
    
    // 清空消息按钮点击事件
    subscribeElements.clearMessagesBtn.addEventListener('click', clearReceivedMessages);
    
    // 添加消息处理器
    WebSocketClient.addHandler('subscribe', handleSubscribeResult);
    WebSocketClient.addHandler('unsubscribe', handleUnsubscribeResult);
    WebSocketClient.addHandler('connect', handleReconnect);
    WebSocketClient.addHandler('message', onMessage);
    
    // 从本地存储加载订阅设置
    loadSubscribeSettingsFromLocalStorage();
}

// 订阅主题
function subscribeToTopic(topicOverride, qosOverride) {
    // 检查连接状态
    if (!ConnectionManager.isConnected()) {
        alert('请先连接到MQTT代理');
        return;
    }

    // 获取订阅参数
    const topic = topicOverride || subscribeElements.topic.value.trim();
    const qos = qosOverride !== undefined ? qosOverride : parseInt(subscribeElements.qos.value);

    // 验证主题
    if (!topic) {
        alert('请输入要订阅的主题');
        return;
    }

    try {
        // 创建订阅消息
        const subscribeData = {
            topic: String(topic),
            qos: Number(qos)
        };
        
        // 发送订阅请求
        const success = WebSocketClient.send('subscribe', subscribeData);
        
        if (!success) {
            alert('无法发送订阅请求');
        }
    } catch (err) {
        console.error('订阅过程中出错:', err);
        alert(`订阅错误: ${err.message}`);
    }
}

// 处理订阅结果
function handleSubscribeResult(data) {
    if (data.success) {
        console.log(`成功订阅: ${data.payload.topic} (QoS: ${data.payload.qos})`);
        
        // 添加到活动订阅列表
        addToActiveSubscriptions(data.payload.topic, data.payload.qos);
        
        // 清空输入
        subscribeElements.topic.value = '';
        
        // 保存到本地存储
        saveSubscribeSettingsToLocalStorage();
    } else {
        alert(`订阅失败: ${data.error}`);
    }
}

// 取消订阅
function unsubscribeFromTopic(topic) {
    // 检查连接状态
    if (!ConnectionManager.isConnected()) {
        alert('未连接到MQTT代理');
        return;
    }

    try {
        // 发送取消订阅请求
        const success = WebSocketClient.send('unsubscribe', topic);
        
        if (!success) {
            alert('无法发送取消订阅请求');
        }
    } catch (err) {
        console.error('取消订阅过程中出错:', err);
        alert(`取消订阅错误: ${err.message}`);
    }
}

// 处理取消订阅结果
function handleUnsubscribeResult(data) {
    if (data.success && data.payload) {
        console.log(`成功取消订阅: ${data.payload}`);
        
        // 从活动订阅列表移除
        removeFromActiveSubscriptions(data.payload);
        
        // 保存到本地存储
        saveSubscribeSettingsToLocalStorage();
    } else {
        alert(`取消订阅失败: ${data.error}`);
    }
}

// 添加到活动订阅列表
function addToActiveSubscriptions(topic, qos) {
    // 确保类型一致
    topic = String(topic);
    qos = Number(qos);
    
    // 存储订阅信息
    activeSubscriptions[topic] = { qos };
    
    // 更新UI
    renderActiveSubscriptions();
}

// 从活动订阅列表移除
function removeFromActiveSubscriptions(topic) {
    // 删除订阅信息
    delete activeSubscriptions[topic];
    
    // 更新UI
    renderActiveSubscriptions();
}

// 渲染活动订阅列表
function renderActiveSubscriptions() {
    // 清空当前列表
    subscribeElements.subscriptionsList.innerHTML = '';
    
    // 添加每个活动订阅
    Object.keys(activeSubscriptions).forEach(topic => {
        const subscription = activeSubscriptions[topic];
        
        const subscriptionItem = document.createElement('div');
        subscriptionItem.className = 'subscription-item';
        
        const topicInfo = document.createElement('div');
        topicInfo.className = 'subscription-info';
        topicInfo.innerHTML = `<i class="material-icons">topic</i> ${topic}`;
        
        const qosInfo = document.createElement('span');
        qosInfo.className = 'subscription-qos';
        qosInfo.style.color = 'var(--text-secondary)';
        qosInfo.textContent = ` (QoS: ${subscription.qos})`;
        topicInfo.appendChild(qosInfo);
        
        const unsubBtn = document.createElement('button');
        unsubBtn.className = 'secondary-btn small-btn';
        unsubBtn.innerHTML = '<i class="material-icons">cancel</i> 取消订阅';
        unsubBtn.onclick = function(event) {
            event.preventDefault();
            unsubscribeFromTopic(topic);
        };
        
        subscriptionItem.appendChild(topicInfo);
        subscriptionItem.appendChild(unsubBtn);
        
        subscribeElements.subscriptionsList.appendChild(subscriptionItem);
    });
}

// 处理接收到的消息
function handleReceivedMessage(message) {
    console.log('处理接收到的消息:', message);
    
    // 创建消息对象，确保字段存在
    const receivedMessage = {
        topic: message.topic || '未知主题',
        payload: message.message || message.payload || '空消息',
        qos: message.qos || 0,
        timestamp: message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
        retained: message.retained || false
    };
    
    // 添加到数组开头（最新的消息在前面）
    receivedMessages.unshift(receivedMessage);
    
    // 保持数组大小限制
    if (receivedMessages.length > MAX_RECEIVED_MESSAGES) {
        receivedMessages.pop();
    }
    
    // 更新UI
    renderReceivedMessages();
}

// 渲染接收到的消息列表
function renderReceivedMessages() {
    // 清空当前列表
    subscribeElements.receivedMessagesList.innerHTML = '';
    
    // 添加每条消息
    receivedMessages.forEach(message => {
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const topicSpan = document.createElement('div');
        topicSpan.className = 'message-topic';
        topicSpan.innerHTML = `<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">inbox</i>${message.topic}`;
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.innerHTML = `<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">access_time</i>${message.timestamp}`;
        
        header.appendChild(topicSpan);
        header.appendChild(timeSpan);
        
        const details = document.createElement('div');
        details.className = 'message-details';
        details.innerHTML = `<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">settings</i>QoS: ${message.qos}${message.retained ? ', <span style="color: var(--accent-color);"><i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">flag</i>保留消息</span>' : ''}`;
        
        const payload = document.createElement('pre');
        payload.className = 'message-payload';
        payload.textContent = message.payload;
        
        messageItem.appendChild(header);
        messageItem.appendChild(details);
        messageItem.appendChild(payload);
        
        subscribeElements.receivedMessagesList.appendChild(messageItem);
    });
}

// 清空接收到的消息
function clearReceivedMessages() {
    receivedMessages.length = 0;
    renderReceivedMessages();
}

// MQTT消息接收回调
function onMessage(message) {
    console.log('订阅者收到消息:', message);
    
    // 确保message是正确的格式
    if (message && message.payload) {
        // 解析正确的消息格式
        console.log(`处理消息: 主题=${message.payload.topic}, 内容=${message.payload.message}`);
        handleReceivedMessage(message.payload);
    } else {
        console.error('接收到格式不正确的消息:', message);
    }
}

// 保存订阅设置到本地存储
function saveSubscribeSettingsToLocalStorage() {
    // 保存当前准备订阅的主题和QoS
    const currentSettings = {
        topic: String(subscribeElements.topic.value),
        qos: Number(subscribeElements.qos.value)
    };
    
    localStorage.setItem('mqttSubscribeSettings', JSON.stringify(currentSettings));
    
    // 保存活跃订阅列表
    const activeSubscriptionsArray = [];
    Object.keys(activeSubscriptions).forEach(topic => {
        activeSubscriptionsArray.push({
            topic: String(topic),
            qos: Number(activeSubscriptions[topic].qos)
        });
    });
    
    localStorage.setItem('mqttActiveSubscriptions', JSON.stringify(activeSubscriptionsArray));
    console.log('已保存活跃订阅到本地存储:', activeSubscriptionsArray);
}

// 从本地存储加载订阅设置
function loadSubscribeSettingsFromLocalStorage() {
    // 加载当前准备订阅的设置
    const savedSettings = localStorage.getItem('mqttSubscribeSettings');
    
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            
            // 填充表单字段
            if (settings.topic) subscribeElements.topic.value = String(settings.topic);
            if (settings.qos !== undefined) subscribeElements.qos.value = Number(settings.qos);
            
            console.log('已从本地存储加载订阅设置');
        } catch (err) {
            console.error('解析保存的订阅设置出错:', err);
        }
    }
    
    // 加载活跃订阅列表
    const savedSubscriptions = localStorage.getItem('mqttActiveSubscriptions');
    if (savedSubscriptions) {
        try {
            const subscriptions = JSON.parse(savedSubscriptions);
            console.log('从本地存储加载的活跃订阅:', subscriptions);
            
            // 填充活跃订阅列表
            subscriptions.forEach(sub => {
                if (sub.topic) {
                    // 添加到活跃订阅列表（但不实际订阅，等连接后再订阅）
                    addToActiveSubscriptions(String(sub.topic), Number(sub.qos || 0));
                }
            });
            
            // 如果已连接，则重新订阅上次的活跃订阅
            if (window.ConnectionManager && window.ConnectionManager.isConnected()) {
                resubscribeFromLocalStorage();
            }
        } catch (err) {
            console.error('解析保存的活跃订阅出错:', err);
        }
    }
}

// 重新订阅本地存储中的主题
function resubscribeFromLocalStorage() {
    if (!window.ConnectionManager.isConnected()) {
        console.log('未连接到MQTT代理，暂不重新订阅');
        return;
    }
    
    console.log('开始重新订阅本地存储的主题');
    Object.keys(activeSubscriptions).forEach(topic => {
        const qos = activeSubscriptions[topic].qos;
        console.log(`重新订阅主题: ${topic}, QoS: ${qos}`);
        subscribeToTopic(String(topic), Number(qos));
    });
}

// 处理重连事件
function handleReconnect() {
    console.log('检测到连接事件，准备重新订阅主题');
    // 延迟一点时间确保连接已稳定
    setTimeout(() => {
        resubscribeFromLocalStorage();
    }, 500);
}

// 导出公共方法
window.Subscriber = {
    init: initSubscriberHandlers,
    onMessage: onMessage,
    loadSubscriptions: loadSubscribeSettingsFromLocalStorage,
    resubscribe: resubscribeFromLocalStorage,
    saveSettings: saveSubscribeSettingsToLocalStorage
}; 