@echo off
rem Web MQTT客户端启动脚本 - Windows版

rem 设置端口号（默认9080）
set PORT=9080
if not "%1"=="" set PORT=%1

rem 检查是否编译了可执行文件
if not exist mqtt-web-client.exe (
    echo 编译Web MQTT客户端...
    go build -o mqtt-web-client.exe main.go
    
    if errorlevel 1 (
        echo 编译失败，请确保安装了Go环境并配置了正确的依赖。
        pause
        exit /b 1
    )
)

rem 启动应用
echo 启动Web MQTT客户端，端口: %PORT%
mqtt-web-client.exe -port %PORT%

pause 