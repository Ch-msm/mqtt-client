/**
 * 消息发布模块
 * 处理MQTT消息的发布功能
 */

// 页面元素
const publishElements = {
    topic: document.getElementById('pub-topic'),
    qos: document.getElementById('pub-qos'),
    retain: document.getElementById('pub-retain'),
    payload: document.getElementById('pub-payload'),
    publishBtn: document.getElementById('publish-btn'),
    publishStatus: document.getElementById('publish-status'),
    sentMessagesList: document.getElementById('sent-messages-list'),
    // 自动发布相关元素
    frequency: document.getElementById('pub-frequency'),
    autoPublishStartBtn: document.getElementById('auto-publish-start-btn'),
    autoPublishStopBtn: document.getElementById('auto-publish-stop-btn')
};

// 已发送消息的存储数组（最多保留100条）
const sentMessages = [];
const MAX_SENT_MESSAGES = 100;

// 自动发布定时器
let autoPublishTimer = null;
let autoPublishCount = 0;

// 数据模拟器的上下文对象，用于在多次调用之间保持状态（如自增ID）
const dataSimulatorContext = {};

// 初始化发布功能事件处理
function initPublisherHandlers() {
    // 发布按钮点击事件
    publishElements.publishBtn.addEventListener('click', publishMessage);
    
    // 自动发布按钮事件
    publishElements.autoPublishStartBtn.addEventListener('click', startAutoPublish);
    publishElements.autoPublishStopBtn.addEventListener('click', stopAutoPublish);
    
    // 添加发布结果处理器
    WebSocketClient.addHandler('publish', handlePublishResult);

    // 从本地存储加载设置
    loadPublishSettingsFromLocalStorage();
    
    // 添加变更监听器
    publishElements.topic.addEventListener('change', savePublishSettingsToLocalStorage);
    publishElements.qos.addEventListener('change', savePublishSettingsToLocalStorage);
    publishElements.retain.addEventListener('change', savePublishSettingsToLocalStorage);
    publishElements.frequency.addEventListener('change', savePublishSettingsToLocalStorage);
    
    // 初始化时禁用停止按钮
    publishElements.autoPublishStopBtn.disabled = true;
    
    console.log('发布模块初始化完成');
}

// 开始自动发布
function startAutoPublish() {
    // 检查连接状态
    if (!ConnectionManager.isConnected()) {
        showPublishStatus('未连接到MQTT代理', 'status-error');
        return;
    }
    
    // 获取频率值（秒）
    const frequencySeconds = parseFloat(publishElements.frequency.value);
    if (isNaN(frequencySeconds) || frequencySeconds < 0.5) {
        showPublishStatus('请输入有效的发布频率（至少0.5秒）', 'status-error');
        return;
    }
    
    // 验证主题
    const topic = publishElements.topic.value.trim();
    if (!topic) {
        showPublishStatus('请输入主题', 'status-error');
        return;
    }
    
    // 重置计数器
    autoPublishCount = 0;
    
    // 设置自动发布状态
    setAutoPublishActive(true);
    
    // 先立即发送一次
    publishAutoMessage();
    
    // 设置定时器，频率转换为毫秒
    autoPublishTimer = setInterval(publishAutoMessage, frequencySeconds * 1000);
    
    showPublishStatus(`自动发布已开始，频率: ${frequencySeconds}秒`, 'status-success');
}

// 停止自动发布
function stopAutoPublish() {
    if (autoPublishTimer) {
        clearInterval(autoPublishTimer);
        autoPublishTimer = null;
        setAutoPublishActive(false);
        showPublishStatus(`自动发布已停止，共发送了${autoPublishCount}条消息`, 'status-info');
    }
}

// 设置自动发布活动状态
function setAutoPublishActive(isActive) {
    // 更新按钮状态
    publishElements.autoPublishStartBtn.disabled = isActive;
    publishElements.autoPublishStopBtn.disabled = !isActive;
    publishElements.publishBtn.disabled = isActive || !ConnectionManager.isConnected();
    
    // 如果正在自动发布，禁用输入字段
    publishElements.topic.disabled = isActive;
    publishElements.qos.disabled = isActive;
    publishElements.retain.disabled = isActive;
    publishElements.frequency.disabled = isActive;
}

// 自动发布消息
function publishAutoMessage() {
    // 获取发布参数
    const topic = publishElements.topic.value.trim();
    const qos = parseInt(publishElements.qos.value);
    const retain = publishElements.retain.checked;
    
    // 处理消息内容 - 使用数据模拟器处理模板表达式
    const originalMessage = publishElements.payload.value;
    const processedMessage = window.dataSimulator ? 
                           dataSimulator.processTemplate(originalMessage, dataSimulatorContext) : 
                           originalMessage;
    
    // 更新计数器（仅用于统计）
    autoPublishCount++;
    
    try {
        // 创建发布消息结构
        const publishData = {
            topic,
            message: processedMessage,
            qos,
            retain
        };
        
        // 发送发布请求
        const success = WebSocketClient.send('publish', publishData);
        
        if (!success) {
            showPublishStatus('自动发布失败: 无法发送请求', 'status-error');
            stopAutoPublish();
        }
    } catch (err) {
        console.error('自动发布过程中出错:', err);
        showPublishStatus(`自动发布错误: ${err.message}`, 'status-error');
        stopAutoPublish();
    }
}

// 发布消息
function publishMessage() {
    // 检查连接状态
    if (!ConnectionManager.isConnected()) {
        showPublishStatus('未连接到MQTT代理', 'status-error');
        return;
    }

    // 获取发布参数
    const topic = publishElements.topic.value.trim();
    const qos = parseInt(publishElements.qos.value);
    const retain = publishElements.retain.checked;
    
    // 处理消息内容 - 使用数据模拟器处理模板表达式
    const originalMessage = publishElements.payload.value;
    const processedMessage = window.dataSimulator ? 
                           dataSimulator.processTemplate(originalMessage, dataSimulatorContext) : 
                           originalMessage;

    // 验证主题
    if (!topic) {
        showPublishStatus('请输入主题', 'status-error');
        return;
    }

    try {
        // 创建发布消息结构
        const publishData = {
            topic,
            message: processedMessage,
            qos,
            retain
        };
        
        // 发送发布请求
        const success = WebSocketClient.send('publish', publishData);
        
        if (!success) {
            showPublishStatus('无法发送发布请求', 'status-error');
        }
    } catch (err) {
        console.error('发布过程中出错:', err);
        showPublishStatus(`发布错误: ${err.message}`, 'status-error');
    }
}

// 处理发布结果
function handlePublishResult(data) {
    if (data.success) {
        // 如果不是自动发布，才显示状态
        if (!autoPublishTimer) {
            showPublishStatus('发布成功!', 'status-success');
        }
        
        // 记录已发送的消息
        addToSentMessages(
            data.payload.topic,
            data.payload.message,
            data.payload.qos,
            data.payload.retain
        );
        
        // 保存设置
        savePublishSettingsToLocalStorage();
    } else {
        showPublishStatus(`发布失败: ${data.error}`, 'status-error');
        // 如果自动发布时失败，停止自动发布
        if (autoPublishTimer) {
            stopAutoPublish();
        }
    }
}

// 显示发布状态消息
function showPublishStatus(message, statusClass) {
    publishElements.publishStatus.textContent = message;
    publishElements.publishStatus.className = 'message-status';
    publishElements.publishStatus.classList.add(statusClass);
    
    // 只有成功状态消息才自动清除
    if (statusClass === 'status-success') {
        // 3秒后自动清除状态消息
        setTimeout(() => {
            publishElements.publishStatus.className = 'message-status';
            publishElements.publishStatus.textContent = '';
        }, 3000);
    }
}

// 添加到已发送消息列表
function addToSentMessages(topic, payload, qos, retain) {
    // 创建消息对象
    const message = {
        topic,
        payload,
        qos,
        retain,
        timestamp: new Date().toLocaleTimeString()
    };
    
    // 添加到数组开头（最新的消息在前面）
    sentMessages.unshift(message);
    
    // 保持数组大小限制
    if (sentMessages.length > MAX_SENT_MESSAGES) {
        sentMessages.pop();
    }
    
    // 更新UI
    renderSentMessages();
}

// 渲染已发送消息列表
function renderSentMessages() {
    // 清空当前列表
    publishElements.sentMessagesList.innerHTML = '';
    
    // 添加每条消息
    sentMessages.forEach(message => {
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const topicSpan = document.createElement('div');
        topicSpan.className = 'message-topic';
        topicSpan.innerHTML = `<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">send</i>${message.topic}`;
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.innerHTML = `<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">access_time</i>${message.timestamp}`;
        
        header.appendChild(topicSpan);
        header.appendChild(timeSpan);
        
        const details = document.createElement('div');
        details.className = 'message-details';
        details.innerHTML = `<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">settings</i>QoS: ${message.qos}, Retain: ${message.retain ? '<span style="color: var(--success-color);">是</span>' : '<span style="color: var(--text-secondary);">否</span>'}`;
        
        const payload = document.createElement('pre');
        payload.className = 'message-payload';
        payload.textContent = message.payload;
        
        messageItem.appendChild(header);
        messageItem.appendChild(details);
        messageItem.appendChild(payload);
        
        publishElements.sentMessagesList.appendChild(messageItem);
    });
}

// 保存发布主题和QoS到本地存储
function savePublishSettingsToLocalStorage() {
    const settings = {
        topic: publishElements.topic.value,
        qos: publishElements.qos.value,
        retain: publishElements.retain.checked,
        frequency: publishElements.frequency.value
    };
    
    localStorage.setItem('mqttPublishSettings', JSON.stringify(settings));
    console.log('发布设置已保存到本地存储');
}

// 从本地存储加载发布设置
function loadPublishSettingsFromLocalStorage() {
    const savedSettings = localStorage.getItem('mqttPublishSettings');
    
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            
            // 填充表单字段
            if (settings.topic) publishElements.topic.value = settings.topic;
            if (settings.qos) publishElements.qos.value = settings.qos;
            if (settings.retain !== undefined) publishElements.retain.checked = settings.retain;
            if (settings.frequency) publishElements.frequency.value = settings.frequency;
            
            console.log('已从本地存储加载发布设置');
        } catch (err) {
            console.error('解析保存的发布设置出错:', err);
        }
    }
}

// 当MQTT连接状态变化时更新UI
function updateUIForConnectionState(isConnected) {
    // 更新常规发布按钮状态
    publishElements.publishBtn.disabled = !isConnected || (autoPublishTimer !== null);
    
    // 更新自动发布按钮状态
    publishElements.autoPublishStartBtn.disabled = !isConnected || (autoPublishTimer !== null);
    publishElements.autoPublishStopBtn.disabled = (autoPublishTimer === null);
    
    // 如果断开连接，自动停止发布
    if (!isConnected && autoPublishTimer !== null) {
        stopAutoPublish();
    }
}

// 导出公共方法
window.Publisher = {
    init: initPublisherHandlers,
    saveSettings: savePublishSettingsToLocalStorage,
    updateConnectionState: updateUIForConnectionState
}; 