# Web MQTT 客户端

基于Web的MQTT客户端，允许用户连接到MQTT代理、发布和订阅消息。

## 功能特点

- 连接到任意MQTT代理（Broker）
- 自定义QoS等级（0, 1, 2）
- 支持保留消息（Retain）
- 支持订阅主题通配符（`+` 和 `#`）
- 实时显示接收到的消息
- 记录已发送的消息
- **自动打开默认浏览器**（兼容Windows和Linux）
- **本地存储保存连接配置和设置**
- 响应式设计，兼容桌面和移动设备

## 技术栈

- 前端：HTML5, CSS3, JavaScript（使用原生WebSocket API）
- 后端：Go（使用Gorilla WebSocket和Eclipse Paho MQTT客户端）

## 架构

本项目实现了一个基于Go的WebSocket代理服务器，来连接MQTT代理：

1. 浏览器通过WebSocket连接到Go后端
2. Go后端使用MQTT客户端库连接到实际的MQTT代理
3. 所有MQTT通信（连接、发布、订阅等）通过WebSocket在浏览器和Go后端之间传递
4. Go后端将所有收到的消息通过WebSocket转发给浏览器

## 快速开始

### 前提条件

- 安装 [Go](https://go.dev/dl/) (版本 1.16+)
- 建议安装MQTT代理用于测试，如 [Mosquitto](https://mosquitto.org/)

### 运行服务

1. 克隆本仓库：

```bash
git clone <仓库URL>
cd mqtt-client
```

2. 安装依赖：

```bash
go mod tidy
```

3. 运行服务器：

#### Linux/macOS:
```bash
./start.sh [端口号]
```

#### Windows:
```batch
start.bat [端口号]
```

或直接运行:

```bash
go run main.go [-port=9080] [-no-open]
```

参数说明:
- `-port=9080`: 可选，指定HTTP服务端口，默认为9080
- `-no-open`: 可选，设置此参数将不自动打开浏览器

默认情况下，应用将在 http://localhost:9080 上运行，并自动打开默认浏览器。

### 使用方法

1. 程序启动后会自动打开浏览器访问应用
2. 输入MQTT代理信息并连接（这些信息会被保存在本地存储中）
3. 连接成功后，你可以：
   - 在左侧面板发布消息到指定主题
   - 在右侧面板订阅主题并查看接收到的消息
4. 所有设置（如连接配置、已发布的主题、已订阅的主题）会被缓存，下次打开时自动恢复

## 开发说明

### 项目结构

```
mqtt-client/
├── static/                  # 前端静态文件
│   ├── css/
│   │   └── style.css        # 样式文件
│   ├── js/
│   │   ├── app.js           # 主应用逻辑
│   │   ├── connection.js    # 连接管理
│   │   ├── publisher.js     # 发布功能
│   │   ├── subscriber.js    # 订阅功能
│   │   └── websocket.js     # WebSocket客户端
│   └── index.html           # 主页面
├── main.go                  # Go后端入口和代理实现
├── go.mod                   # Go模块定义
├── start.sh                 # Linux启动脚本
├── start.bat                # Windows启动脚本
└── README.md                # 项目说明
```

### 测试MQTT代理设置

项目包含一个简单的Mosquitto MQTT代理配置文件 (`config.yaml`)，可用于本地测试：

```bash
# 安装Mosquitto
sudo apt-get install mosquitto mosquitto-clients

# 使用配置文件启动Mosquitto
mosquitto -c config.yaml
```

### 构建和部署

对于生产环境，你可以：

1. 编译Go程序：

```bash
go build -o mqtt-web-client
```

2. 运行编译后的程序：

```bash
./mqtt-web-client [-port=9080] [-no-open]
```

### 交叉编译

Go语言内置支持交叉编译，可以轻松地在一个平台上编译出适用于其他平台的可执行文件。这对于分发应用程序非常有用。

#### 主要平台交叉编译命令

**Linux 平台编译 Windows 可执行文件:**
```bash
GOOS=windows GOARCH=amd64 go build -o mqtt-web-client.exe main.go
```

**Linux 平台编译 macOS 可执行文件:**
```bash
GOOS=darwin GOARCH=amd64 go build -o mqtt-web-client-mac main.go
```

**Windows 平台编译 Linux 可执行文件:**
```cmd
set GOOS=linux
set GOARCH=amd64
go build -o mqtt-web-client-linux main.go
```

**编译成ARM架构 (如树莓派):**
```bash
GOOS=linux GOARCH=arm GOARM=7 go build -o mqtt-web-client-arm main.go
```

#### 所有主要目标平台批量编译脚本

##### Linux/macOS 脚本 (build-all.sh)
```bash
#!/bin/bash

# 创建输出目录
mkdir -p build

# 编译 64 位 Windows
GOOS=windows GOARCH=amd64 go build -o build/mqtt-web-client-windows-amd64.exe main.go

# 编译 32 位 Windows
GOOS=windows GOARCH=386 go build -o build/mqtt-web-client-windows-386.exe main.go

# 编译 64 位 Linux
GOOS=linux GOARCH=amd64 go build -o build/mqtt-web-client-linux-amd64 main.go

# 编译 32 位 Linux
GOOS=linux GOARCH=386 go build -o build/mqtt-web-client-linux-386 main.go

# 编译 ARM Linux (树莓派等)
GOOS=linux GOARCH=arm GOARM=7 go build -o build/mqtt-web-client-linux-arm main.go

# 编译 ARM64 Linux
GOOS=linux GOARCH=arm64 go build -o build/mqtt-web-client-linux-arm64 main.go

# 编译 64 位 macOS
GOOS=darwin GOARCH=amd64 go build -o build/mqtt-web-client-darwin-amd64 main.go

# 编译 ARM macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o build/mqtt-web-client-darwin-arm64 main.go

echo "交叉编译完成，可执行文件位于 build/ 目录"
```

##### Windows 脚本 (build-all.bat)
```bat
@echo off
echo 开始交叉编译...

mkdir build 2>nul

echo 编译 Windows 64位...
set GOOS=windows
set GOARCH=amd64
go build -o build\mqtt-web-client-windows-amd64.exe main.go

echo 编译 Windows 32位...
set GOOS=windows
set GOARCH=386
go build -o build\mqtt-web-client-windows-386.exe main.go

echo 编译 Linux 64位...
set GOOS=linux
set GOARCH=amd64
go build -o build\mqtt-web-client-linux-amd64 main.go

echo 编译 Linux 32位...
set GOOS=linux
set GOARCH=386
go build -o build\mqtt-web-client-linux-386 main.go

echo 编译 Linux ARM (树莓派)...
set GOOS=linux
set GOARCH=arm
set GOARM=7
go build -o build\mqtt-web-client-linux-arm main.go

echo 编译 Linux ARM64...
set GOOS=linux
set GOARCH=arm64
go build -o build\mqtt-web-client-linux-arm64 main.go

echo 编译 macOS 64位...
set GOOS=darwin
set GOARCH=amd64
go build -o build\mqtt-web-client-darwin-amd64 main.go

echo 编译 macOS ARM (Apple Silicon)...
set GOOS=darwin
set GOARCH=arm64
go build -o build\mqtt-web-client-darwin-arm64 main.go

echo 交叉编译完成，可执行文件位于 build 目录
```

#### 注意事项

1. 交叉编译时不能使用依赖 CGO 的包，如果有，需要设置 `CGO_ENABLED=0`
2. 对于需要静态链接的情况，可以添加 `-ldflags="-s -w"` 参数来减小生成的可执行文件大小
3. 由于本应用已经使用了 `embed` 包内嵌静态资源，交叉编译生成的可执行文件可以直接分发使用，无需附带额外的静态文件

## 注意事项

- 服务器代理模式提高了兼容性，几乎所有浏览器都支持WebSocket
- 此实现不直接从浏览器连接MQTT代理，而是通过Go后端代理连接
- 密码不会存储在本地存储中，需要每次手动输入以提高安全性
- 适合本地网络或受信任环境中使用

## 许可证

[MIT](LICENSE) 