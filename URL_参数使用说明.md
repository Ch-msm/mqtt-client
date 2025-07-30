# URL参数使用说明

## 功能概述

现在您可以通过URL参数传递客户端ID，使得客户端ID输入框变为只读状态，并在页面标题中显示当前的客户端ID。同时新增了基于客户端ID的配置保存功能。

## 使用方法

### 1. 基本用法
在URL中添加 `clientId` 参数：

```
http://localhost:9080/?clientId=your_client_id
```

例如：
```
http://localhost:9080/?clientId=device_001
http://localhost:9080/?clientId=sensor_gateway_01
http://localhost:9080/?clientId=production_client
```

### 2. 页面效果
- **客户端ID输入框**: 变为只读状态，显示灰色背景
- **页面标题**: 更新为 "{客户端ID} - Web MQTT 客户端"
- **功能保持**: 所有MQTT功能正常工作

### 3. 配置保存功能 🆕

#### 3.1 保存的字段
点击页面上的 **"保存"** 按钮时，系统会保存以下字段：
- **连接配置**: 代理地址、端口、用户名、密码
- **发布配置**: 发布主题、发布消息体、自动发布频率、QoS、保留消息设置
- **订阅配置**: 当前所有活动订阅主题

#### 3.2 配置存储方式
- 配置以**客户端ID为key**存储在浏览器本地缓存中
- 每个客户端ID的配置独立存储，互不影响
- 格式：`mqtt_client_config_{clientId}`

#### 3.3 自动加载
- 页面加载时，如果检测到客户端ID，会自动加载对应的配置
- 连接到MQTT服务器后，会自动恢复之前的订阅

#### 3.4 自动保存
- 页面关闭时会自动保存当前配置
- 手动点击保存按钮可立即保存配置

### 4. 兼容性
- 如果URL中没有 `clientId` 参数，应用保持原有行为
- 客户端ID输入框保持可编辑状态
- 自动生成默认的客户端ID
- 可以手动输入客户端ID并点击保存按钮保存配置

## 示例场景

### 多设备管理
为不同的设备或传感器创建不同的访问链接：

```bash
# 温度传感器 - 自动加载温度传感器的配置
http://localhost:9080/?clientId=temp_sensor_01

# 湿度传感器 - 自动加载湿度传感器的配置
http://localhost:9080/?clientId=humidity_sensor_01

# 控制网关 - 自动加载控制网关的配置
http://localhost:9080/?clientId=control_gateway
```

### 开发与生产环境分离
```bash
# 开发环境
http://localhost:9080/?clientId=dev_client_01

# 测试环境
http://localhost:9080/?clientId=test_client_01

# 生产环境
http://localhost:9080/?clientId=prod_client_01
```

### 工作流程示例
1. **首次访问**: `http://localhost:9080/?clientId=device_001`
2. **配置设备**: 设置代理地址、订阅主题等
3. **保存配置**: 点击保存按钮
4. **后续访问**: 再次访问相同URL时，所有配置自动恢复

## 技术实现

1. **JavaScript解析**: 使用`URLSearchParams`解析URL参数
2. **只读设置**: 动态设置输入框的`readonly`属性和样式
3. **标题更新**: 动态更新`document.title`
4. **配置管理**: 
   - 基于客户端ID的配置存储系统
   - 自动配置加载和保存
   - 订阅状态的智能恢复
5. **旧逻辑清理**: 移除了原有的全局本地存储逻辑

## 注意事项

- 密码字段出于安全考虑，在配置保存中包含（仅存储在本地浏览器）
- 订阅恢复会在MQTT连接成功后自动执行
- 配置保存状态会通过页面右上角的临时提示显示
- 每个浏览器的配置是独立的（基于localStorage） 