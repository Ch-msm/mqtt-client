package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/websocket"
)

//go:embed static
var staticFiles embed.FS

// MQTTConfig 存储MQTT连接配置
type MQTTConfig struct {
	Broker   string `json:"broker"`
	Port     string `json:"port"`
	ClientID string `json:"clientId"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// MQTTMessage 消息结构
type MQTTMessage struct {
	Type    string      `json:"type"`    // 消息类型: connect, disconnect, subscribe, unsubscribe, publish, message
	Payload interface{} `json:"payload"` // 消息内容，根据消息类型会有不同结构
}

// PublishMessage 发布消息结构
type PublishMessage struct {
	Topic   string `json:"topic"`
	Message string `json:"message"`
	QoS     int    `json:"qos"`
	Retain  bool   `json:"retain"`
}

// SubscribeMessage 订阅消息结构
type SubscribeMessage struct {
	Topic string `json:"topic"`
	QoS   int    `json:"qos"`
}

// 服务端发送到客户端的消息结构
type ServerMessage struct {
	Type    string      `json:"type"`
	Success bool        `json:"success"`
	Payload interface{} `json:"payload,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// ReceivedMessage 接收消息结构
type ReceivedMessage struct {
	Topic     string    `json:"topic"`
	Message   string    `json:"message"`
	QoS       int       `json:"qos"`
	Retained  bool      `json:"retained"`
	Timestamp time.Time `json:"timestamp"`
}

// ClientManager 客户端连接管理器
type ClientManager struct {
	clients map[*websocket.Conn]*MQTTClient
	mutex   sync.Mutex
}

// MQTTClient MQTT客户端包装器
type MQTTClient struct {
	client           mqtt.Client
	ws               *websocket.Conn
	subscriptions    map[string]byte // 记录所有订阅的主题及QoS
	subscriptionsMux sync.Mutex
}

// WebSocket连接升级器
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源的请求，生产环境应该限制
	},
}

// 客户端管理器实例
var manager = ClientManager{
	clients: make(map[*websocket.Conn]*MQTTClient),
}

func main() {
	// 命令行参数
	port := flag.String("port", "9080", "HTTP服务端口")
	noOpen := flag.Bool("no-open", false, "不自动打开浏览器")
	flag.Parse()

	// 从嵌入的FS中提取static子目录
	staticContent, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatalf("无法获取静态文件目录: %v", err)
	}

	// 静态文件服务
	http.Handle("/", http.FileServer(http.FS(staticContent)))

	// WebSocket端点
	http.HandleFunc("/ws", handleWebSocket)

	// 启动服务器（在一个goroutine中）
	serverAddr := ":" + *port
	server := &http.Server{Addr: serverAddr, Handler: nil}

	go func() {
		log.Printf("启动Web MQTT客户端服务，监听端口: %s\n", *port)
		log.Printf("请在浏览器中访问: http://localhost:%s\n", *port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("无法启动服务器: %v", err)
		}
	}()

	// 等待服务器启动
	time.Sleep(100 * time.Millisecond)

	// 自动打开浏览器（除非用户指定不打开）
	if !*noOpen {
		url := fmt.Sprintf("http://localhost:%s", *port)
		openBrowser(url)
	}

	// 保持主线程运行
	select {}
}

// openBrowser 尝试打开默认浏览器访问给定URL
func openBrowser(url string) {
	var err error

	switch runtime.GOOS {
	case "linux":
		// Linux系统: 尝试多种浏览器打开命令
		err = tryLinuxBrowsers(url)
	case "windows":
		// Windows系统: 使用start命令
		err = exec.Command("cmd", "/c", "start", url).Start()
	case "darwin":
		// macOS系统: 使用open命令
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("未知操作系统: %s", runtime.GOOS)
	}

	if err != nil {
		log.Printf("无法打开浏览器: %v", err)
	} else {
		log.Printf("已在浏览器中打开: %s", url)
	}
}

// tryLinuxBrowsers 尝试多种Linux浏览器打开命令
func tryLinuxBrowsers(url string) error {
	// 常见的Linux浏览器打开命令
	browsers := []string{
		"xdg-open",
		"sensible-browser",
		"google-chrome",
		"firefox",
		"chromium-browser",
	}

	// 逐个尝试
	for _, browser := range browsers {
		cmd := exec.Command(browser, url)
		err := cmd.Start()
		if err == nil {
			// 成功启动浏览器
			return nil
		}
	}

	return fmt.Errorf("未找到可用的浏览器")
}

// 处理WebSocket连接
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("升级WebSocket连接失败:", err)
		return
	}

	log.Println("WebSocket连接已建立")

	// 创建MQTT客户端
	mqttClient := &MQTTClient{
		ws:            conn,
		subscriptions: make(map[string]byte),
	}

	// 记录客户端连接
	manager.mutex.Lock()
	manager.clients[conn] = mqttClient
	manager.mutex.Unlock()

	// 开始监听消息
	go handleMessages(mqttClient)
}

// 处理来自WebSocket的消息
func handleMessages(client *MQTTClient) {
	defer func() {
		// 关闭WebSocket连接
		client.ws.Close()

		// 断开MQTT连接
		if client.client != nil && client.client.IsConnected() {
			client.client.Disconnect(250)
		}

		// 从管理器中移除客户端
		manager.mutex.Lock()
		delete(manager.clients, client.ws)
		manager.mutex.Unlock()

		log.Println("连接已关闭")
	}()

	for {
		// 读取消息
		_, message, err := client.ws.ReadMessage()
		if err != nil {
			log.Println("读取消息错误:", err)
			break
		}

		// 解析消息
		var mqttMsg MQTTMessage
		if err := json.Unmarshal(message, &mqttMsg); err != nil {
			log.Println("解析消息错误:", err)
			sendError(client.ws, "消息格式错误", nil)
			continue
		}

		// 处理不同类型的消息
		switch mqttMsg.Type {
		case "connect":
			handleConnect(client, mqttMsg.Payload)
		case "disconnect":
			handleDisconnect(client)
		case "subscribe":
			handleSubscribe(client, mqttMsg.Payload)
		case "unsubscribe":
			handleUnsubscribe(client, mqttMsg.Payload)
		case "publish":
			handlePublish(client, mqttMsg.Payload)
		default:
			sendError(client.ws, "不支持的消息类型", nil)
		}
	}
}

// 处理连接消息
func handleConnect(client *MQTTClient, payload interface{}) {
	// 解析连接配置
	configBytes, err := json.Marshal(payload)
	if err != nil {
		sendError(client.ws, "配置解析错误", err)
		return
	}

	var config MQTTConfig
	if err := json.Unmarshal(configBytes, &config); err != nil {
		sendError(client.ws, "配置解析错误", err)
		return
	}

	// 确认必要的配置已提供
	if config.Broker == "" {
		sendError(client.ws, "代理地址不能为空", nil)
		return
	}

	// 若客户端已连接，先断开
	if client.client != nil && client.client.IsConnected() {
		client.client.Disconnect(250)
	}

	// 创建MQTT客户端选项
	opts := mqtt.NewClientOptions()
	opts.AddBroker("tcp://" + config.Broker + ":" + config.Port)
	opts.SetClientID(config.ClientID)
	opts.SetCleanSession(true)
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(5 * time.Second)

	if config.Username != "" {
		opts.SetUsername(config.Username)
		opts.SetPassword(config.Password)
	}

	// 设置回调
	opts.SetOnConnectHandler(func(c mqtt.Client) {
		log.Println("MQTT连接成功")
		sendSuccess(client.ws, "connect", nil)

		// 如果有之前的订阅，重新订阅
		client.subscriptionsMux.Lock()
		subscriptions := make(map[string]byte)
		for topic, qos := range client.subscriptions {
			subscriptions[topic] = qos
		}
		client.subscriptionsMux.Unlock()

		for topic, qos := range subscriptions {
			token := c.Subscribe(topic, qos, func(c mqtt.Client, m mqtt.Message) {
				handleIncomingMessage(client, m)
			})
			if token.Wait() && token.Error() != nil {
				log.Printf("重新订阅主题 %s 失败: %v", topic, token.Error())
			}
		}
	})

	opts.SetConnectionLostHandler(func(c mqtt.Client, err error) {
		log.Println("MQTT连接断开:", err)
		sendError(client.ws, "连接断开", err)
	})

	// 创建并连接MQTT客户端
	mqttClient := mqtt.NewClient(opts)
	token := mqttClient.Connect()
	if token.Wait() && token.Error() != nil {
		sendError(client.ws, "连接失败", token.Error())
		return
	}

	// 保存MQTT客户端实例
	client.client = mqttClient
}

// 处理断开连接消息
func handleDisconnect(client *MQTTClient) {
	if client.client != nil && client.client.IsConnected() {
		client.client.Disconnect(250)
		sendSuccess(client.ws, "disconnect", nil)
	} else {
		sendError(client.ws, "未连接", nil)
	}
}

// 处理订阅消息
func handleSubscribe(client *MQTTClient, payload interface{}) {
	// 检查连接状态
	if client.client == nil || !client.client.IsConnected() {
		sendError(client.ws, "未连接到MQTT代理", nil)
		return
	}

	// 解析订阅信息
	subBytes, err := json.Marshal(payload)
	if err != nil {
		sendError(client.ws, "订阅信息解析错误", err)
		return
	}

	var subMsg SubscribeMessage
	if err := json.Unmarshal(subBytes, &subMsg); err != nil {
		sendError(client.ws, "订阅信息解析错误", err)
		return
	}

	// 验证主题
	if subMsg.Topic == "" {
		sendError(client.ws, "订阅主题不能为空", nil)
		return
	}

	// 订阅主题
	token := client.client.Subscribe(subMsg.Topic, byte(subMsg.QoS), func(c mqtt.Client, m mqtt.Message) {
		handleIncomingMessage(client, m)
	})

	if token.Wait() && token.Error() != nil {
		sendError(client.ws, "订阅失败", token.Error())
		return
	}

	// 记录订阅
	client.subscriptionsMux.Lock()
	client.subscriptions[subMsg.Topic] = byte(subMsg.QoS)
	client.subscriptionsMux.Unlock()

	// 发送成功响应
	sendSuccess(client.ws, "subscribe", subMsg)
}

// 处理取消订阅消息
func handleUnsubscribe(client *MQTTClient, payload interface{}) {
	// 检查连接状态
	if client.client == nil || !client.client.IsConnected() {
		sendError(client.ws, "未连接到MQTT代理", nil)
		return
	}

	// 解析取消订阅信息
	topicBytes, err := json.Marshal(payload)
	if err != nil {
		sendError(client.ws, "取消订阅信息解析错误", err)
		return
	}

	var topic string
	if err := json.Unmarshal(topicBytes, &topic); err != nil {
		sendError(client.ws, "取消订阅信息解析错误", err)
		return
	}

	// 验证主题
	if topic == "" {
		sendError(client.ws, "取消订阅主题不能为空", nil)
		return
	}

	// 取消订阅
	token := client.client.Unsubscribe(topic)
	if token.Wait() && token.Error() != nil {
		sendError(client.ws, "取消订阅失败", token.Error())
		return
	}

	// 从记录中删除
	client.subscriptionsMux.Lock()
	delete(client.subscriptions, topic)
	client.subscriptionsMux.Unlock()

	// 发送成功响应
	sendSuccess(client.ws, "unsubscribe", topic)
}

// 处理发布消息
func handlePublish(client *MQTTClient, payload interface{}) {
	// 检查连接状态
	if client.client == nil || !client.client.IsConnected() {
		sendError(client.ws, "未连接到MQTT代理", nil)
		return
	}

	// 解析发布信息
	pubBytes, err := json.Marshal(payload)
	if err != nil {
		sendError(client.ws, "发布信息解析错误", err)
		return
	}

	var pubMsg PublishMessage
	if err := json.Unmarshal(pubBytes, &pubMsg); err != nil {
		sendError(client.ws, "发布信息解析错误", err)
		return
	}

	// 验证主题
	if pubMsg.Topic == "" {
		sendError(client.ws, "发布主题不能为空", nil)
		return
	}

	// 发布消息
	token := client.client.Publish(pubMsg.Topic, byte(pubMsg.QoS), pubMsg.Retain, pubMsg.Message)
	if token.Wait() && token.Error() != nil {
		sendError(client.ws, "发布失败", token.Error())
		return
	}

	// 发送成功响应
	sendSuccess(client.ws, "publish", pubMsg)
}

// 处理收到的MQTT消息
func handleIncomingMessage(client *MQTTClient, message mqtt.Message) {
	// 创建接收消息对象
	recvMsg := ReceivedMessage{
		Topic:     message.Topic(),
		Message:   string(message.Payload()),
		QoS:       int(message.Qos()),
		Retained:  message.Retained(),
		Timestamp: time.Now(),
	}

	// 发送到WebSocket客户端
	sendSuccess(client.ws, "message", recvMsg)
}

// 发送成功响应
func sendSuccess(conn *websocket.Conn, msgType string, payload interface{}) {
	response := ServerMessage{
		Type:    msgType,
		Success: true,
		Payload: payload,
	}

	if err := conn.WriteJSON(response); err != nil {
		log.Println("发送成功响应错误:", err)
	}
}

// 发送错误响应
func sendError(conn *websocket.Conn, message string, err error) {
	errorMsg := message
	if err != nil {
		errorMsg += ": " + err.Error()
	}

	response := ServerMessage{
		Type:    "error",
		Success: false,
		Error:   errorMsg,
	}

	if err := conn.WriteJSON(response); err != nil {
		log.Println("发送错误响应错误:", err)
	}
}
