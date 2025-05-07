#!/bin/bash

# 创建输出目录
mkdir -p build

# 禁用CGO以确保静态链接
export CGO_ENABLED=0

echo "开始交叉编译..."

# 编译 64 位 Windows
echo "编译 Windows 64位..."
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o build/mqtt-web-client-windows-amd64.exe main.go

# 编译 32 位 Windows
echo "编译 Windows 32位..."
GOOS=windows GOARCH=386 go build -ldflags="-s -w" -o build/mqtt-web-client-windows-386.exe main.go

# 编译 64 位 Linux
echo "编译 Linux 64位..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o build/mqtt-web-client-linux-amd64 main.go

# 编译 32 位 Linux
echo "编译 Linux 32位..."
GOOS=linux GOARCH=386 go build -ldflags="-s -w" -o build/mqtt-web-client-linux-386 main.go

# 编译 ARM Linux (树莓派等)
echo "编译 Linux ARM (树莓派)..."
GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s -w" -o build/mqtt-web-client-linux-arm main.go

# 编译 ARM64 Linux
echo "编译 Linux ARM64..."
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o build/mqtt-web-client-linux-arm64 main.go

# 编译 64 位 macOS
echo "编译 macOS 64位..."
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o build/mqtt-web-client-darwin-amd64 main.go

# 编译 ARM macOS (Apple Silicon)
echo "编译 macOS ARM (Apple Silicon)..."
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o build/mqtt-web-client-darwin-arm64 main.go

echo "交叉编译完成，可执行文件位于 build/ 目录" 