#!/bin/bash

# Web MQTT客户端启动脚本

# 设置端口号（默认9080）
PORT=${1:-9080}

# 检查是否编译了可执行文件
if [ ! -f ./mqtt-web-client ]; then
    echo "编译Web MQTT客户端..."
    go build -o mqtt-web-client main.go
    
    if [ $? -ne 0 ]; then
        echo "编译失败，请确保安装了Go环境并配置了正确的依赖。"
        exit 1
    fi
fi

# 启动应用
echo "启动Web MQTT客户端，端口: $PORT"
./mqtt-web-client -port $PORT