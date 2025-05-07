@echo off
echo 开始交叉编译...

mkdir build 2>nul

:: 禁用CGO以确保静态链接
set CGO_ENABLED=0

echo 编译 Windows 64位...
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w" -o build\mqtt-web-client-windows-amd64.exe main.go

echo 编译 Windows 32位...
set GOOS=windows
set GOARCH=386
go build -ldflags="-s -w" -o build\mqtt-web-client-windows-386.exe main.go

echo 编译 Linux 64位...
set GOOS=linux
set GOARCH=amd64
go build -ldflags="-s -w" -o build\mqtt-web-client-linux-amd64 main.go

echo 编译 Linux 32位...
set GOOS=linux
set GOARCH=386
go build -ldflags="-s -w" -o build\mqtt-web-client-linux-386 main.go

echo 编译 Linux ARM (树莓派)...
set GOOS=linux
set GOARCH=arm
set GOARM=7
go build -ldflags="-s -w" -o build\mqtt-web-client-linux-arm main.go

echo 编译 Linux ARM64...
set GOOS=linux
set GOARCH=arm64
go build -ldflags="-s -w" -o build\mqtt-web-client-linux-arm64 main.go

echo 编译 macOS 64位...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags="-s -w" -o build\mqtt-web-client-darwin-amd64 main.go

echo 编译 macOS ARM (Apple Silicon)...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags="-s -w" -o build\mqtt-web-client-darwin-arm64 main.go

echo 交叉编译完成，可执行文件位于 build 目录 