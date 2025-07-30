/**
 * Web MQTT 客户端主应用程序
 * 整合连接、发布和订阅功能
 */

// DOM完全加载后执行
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// 从URL获取参数
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// 更新页面标题
function updatePageTitle(clientId) {
    if (clientId) {
        document.title = ` ${clientId} - Web MQTT 客户端`;
    }
}

// 基于客户端ID的配置管理
class ClientConfigManager {
    constructor() {
        this.currentClientId = null;
    }

    // 设置当前客户端ID
    setCurrentClientId(clientId) {
        this.currentClientId = clientId;
    }

    // 获取配置的存储key
    getConfigKey(clientId) {
        return `mqtt_client_config_${clientId}`;
    }

    // 保存当前配置
    saveCurrentConfig() {
        if (!this.currentClientId) {
            alert('没有设置客户端ID，无法保存配置');
            return;
        }

        try {
            const config = {
                // 连接配置
                broker: document.getElementById('broker').value,
                port: document.getElementById('port').value,
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                
                // 发布配置
                publishTopic: document.getElementById('pub-topic').value,
                publishPayload: document.getElementById('pub-payload').value,
                publishFrequency: document.getElementById('pub-frequency').value,
                publishQos: document.getElementById('pub-qos').value,
                publishRetain: document.getElementById('pub-retain').checked,
                
                // 订阅配置 - 获取当前所有活动订阅
                subscriptions: this.getCurrentSubscriptions(),
                
                // 保存时间
                savedAt: new Date().toISOString()
            };

            const configKey = this.getConfigKey(this.currentClientId);
            localStorage.setItem(configKey, JSON.stringify(config));
            
            console.log(`配置已保存: ${this.currentClientId}`, config);
            
            // 显示保存成功提示
            this.showSaveStatus('配置保存成功！', 'success');
            
        } catch (error) {
            console.error('保存配置时出错:', error);
            this.showSaveStatus('配置保存失败: ' + error.message, 'error');
        }
    }

    // 加载配置
    loadConfig(clientId) {
        if (!clientId) return;

        try {
            const configKey = this.getConfigKey(clientId);
            const savedConfig = localStorage.getItem(configKey);
            
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                
                // 恢复连接配置
                if (config.broker) document.getElementById('broker').value = config.broker;
                if (config.port) document.getElementById('port').value = config.port;
                if (config.username) document.getElementById('username').value = config.username;
                if (config.password) document.getElementById('password').value = config.password;
                
                // 恢复发布配置
                if (config.publishTopic) document.getElementById('pub-topic').value = config.publishTopic;
                if (config.publishPayload) document.getElementById('pub-payload').value = config.publishPayload;
                if (config.publishFrequency) document.getElementById('pub-frequency').value = config.publishFrequency;
                if (config.publishQos) document.getElementById('pub-qos').value = config.publishQos;
                if (config.publishRetain !== undefined) document.getElementById('pub-retain').checked = config.publishRetain;
                
                // 恢复订阅配置将在连接后处理
                this.pendingSubscriptions = config.subscriptions || [];
                
                // 如果有订阅配置，先在UI中显示这些订阅（不实际连接）
                if (this.pendingSubscriptions.length > 0) {
                    console.log('准备显示待恢复的订阅:', this.pendingSubscriptions);
                    // 延迟执行，确保Subscriber模块已加载
                    setTimeout(() => {
                        this.addPendingSubscriptionsToUI();
                    }, 100);
                }
                
                console.log(`配置已加载: ${clientId}`, config);
                
                // 显示加载成功提示
                this.showSaveStatus('配置加载成功！', 'success');
                
                return true;
            }
        } catch (error) {
            console.error('加载配置时出错:', error);
            this.showSaveStatus('配置加载失败: ' + error.message, 'error');
        }
        
        return false;
    }

    // 获取当前活动订阅
    getCurrentSubscriptions() {
        if (typeof window.Subscriber !== 'undefined' && window.Subscriber.getActiveSubscriptions) {
            return window.Subscriber.getActiveSubscriptions();
        }
        // 如果Subscriber模块还没有加载，返回空数组
        return [];
    }

    // 将待恢复的订阅添加到UI显示（但不实际订阅）
    addPendingSubscriptionsToUI() {
        if (this.pendingSubscriptions && this.pendingSubscriptions.length > 0) {
            console.log('添加待恢复订阅到UI:', this.pendingSubscriptions);
            this.pendingSubscriptions.forEach(sub => {
                // 调用订阅模块的内部方法，仅添加到UI，不实际发送订阅请求
                if (typeof window.Subscriber !== 'undefined' && window.Subscriber.addToActiveSubscriptionsUI) {
                    window.Subscriber.addToActiveSubscriptionsUI(sub.topic, sub.qos);
                }
            });
        }
    }

    // 恢复订阅
    restoreSubscriptions() {
        if (this.pendingSubscriptions && this.pendingSubscriptions.length > 0) {
            console.log('开始恢复订阅:', this.pendingSubscriptions);
            // 延迟恢复订阅，确保连接已建立
            setTimeout(() => {
                this.pendingSubscriptions.forEach(sub => {
                    console.log(`恢复订阅: ${sub.topic}, QoS: ${sub.qos}`);
                    if (typeof window.Subscriber !== 'undefined' && window.Subscriber.subscribeToTopic) {
                        window.Subscriber.subscribeToTopic(sub.topic, sub.qos);
                    } else {
                        console.error('Subscriber模块不可用');
                    }
                });
                this.pendingSubscriptions = [];
                console.log('订阅恢复完成');
            }, 1000);
        } else {
            console.log('没有需要恢复的订阅');
        }
    }

    // 显示保存状态
    showSaveStatus(message, type) {
        // 创建临时提示元素
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            ${type === 'success' ? 'background-color: #4CAF50;' : 'background-color: #F44336;'}
        `;
        statusDiv.textContent = message;
        
        document.body.appendChild(statusDiv);
        
        // 3秒后移除提示
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 3000);
    }
}

// 创建全局配置管理器实例
const configManager = new ClientConfigManager();

// 应用程序初始化
function initializeApp() {
    try {
        // 检查URL中是否有客户端ID参数
        const urlClientId = getURLParameter('clientId');
        
        if (urlClientId) {
            // 设置客户端ID并使输入框只读
            const clientIdInput = document.getElementById('clientId');
            clientIdInput.value = urlClientId;
            clientIdInput.readOnly = true;
            clientIdInput.style.backgroundColor = '#f5f5f5';
            clientIdInput.style.cursor = 'not-allowed';
            
            // 更新页面标题
            updatePageTitle(urlClientId);
            
            // 设置当前客户端ID到配置管理器
            configManager.setCurrentClientId(urlClientId);
            
            // 加载该客户端ID的配置
            configManager.loadConfig(urlClientId);
        }
        
        // 初始化各模块
        ConnectionManager.init();
        Publisher.init();
        Subscriber.init();
        
        // 设置保存按钮事件
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                // 如果没有通过URL设置客户端ID，使用当前输入框的值
                if (!configManager.currentClientId) {
                    const clientId = document.getElementById('clientId').value.trim();
                    if (clientId) {
                        configManager.setCurrentClientId(clientId);
                    }
                }
                configManager.saveCurrentConfig();
            });
        }
        
        // 添加事件监听，在页面卸载前保存配置
        window.addEventListener('beforeunload', function() {
            // 如果有客户端ID，自动保存配置
            if (configManager.currentClientId) {
                configManager.saveCurrentConfig();
            }
        });
        
        console.log('Web MQTT 客户端初始化完成');
        
    } catch (err) {
        console.error('应用初始化错误:', err);
        alert(`初始化错误: ${err.message}`);
    }
}

// 处理接收到的MQTT消息
window.onMessage = function(message) {
    console.log('收到MQTT消息:', message);
    // 将消息转发给订阅者处理
    if (typeof Subscriber !== 'undefined' && Subscriber.onMessage) {
        Subscriber.onMessage(message);
    } else {
        console.error('订阅者模块未初始化或onMessage方法不可用');
    }
};

// 连接成功后的回调，用于恢复订阅
window.onMQTTConnected = function() {
    console.log('MQTT连接成功，尝试恢复订阅...');
    configManager.restoreSubscriptions();
};

// 导出配置管理器供其他模块使用
window.ConfigManager = configManager;