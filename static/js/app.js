/**
 * Web MQTT 客户端主应用程序
 * 整合连接、发布和订阅功能
 */

// DOM完全加载后执行
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// 应用程序初始化
function initializeApp() {
    try {
        // 初始化各模块
        ConnectionManager.init();
        Publisher.init();
        Subscriber.init();
        
        // 添加事件监听，在页面卸载前保存配置
        window.addEventListener('beforeunload', function() {
            // 保存所有配置
            if (typeof ConnectionManager !== 'undefined' && ConnectionManager.saveConfig) {
                ConnectionManager.saveConfig();
            }
            if (typeof Publisher !== 'undefined' && Publisher.saveSettings) {
                Publisher.saveSettings();
            }
            if (typeof Subscriber !== 'undefined' && Subscriber.saveSettings) {
                Subscriber.saveSettings();
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