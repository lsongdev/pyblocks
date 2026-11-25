# MicroPython Blocks

[打开积木编辑器](https://lsong.org/blockly-demo/)

## 首次安装 MicroPython

编辑器的“上传并运行”按钮通过串口把当前代码写成 `main.py`，需要板卡已经运行支持串口 raw REPL 的 MicroPython。首次安装请在主界面右上角选择“设备 → 安装 MicroPython 固件”，连接板卡后在对话框中确认安装。右上角“设置”可修改语言，选择立即生效并保存在本地。

安装对话框支持经典 ESP32、8 MB Flash 的 Matrix:bit，BBC Micro:bit V1 / V2，以及原版 Raspberry Pi Pico（RP2040，不带 Wi-Fi）。它连接板卡、校验所选固件并在用户确认后刷写。固件来源和许可证见 [固件说明](public/firmware/NOTICE.txt)。

下面的外部工具可作为备用。

### Matrix:bit

以下步骤适用于本项目实测的经典 ESP32、8 MB Flash 版本。

1. 从 [MicroPython 官方下载页](https://micropython.org/download/ESP32_GENERIC/) 下载 `ESP32_GENERIC` 的完整 `.bin`。本项目验证过 v1.29.0。
2. 关闭正在占用板卡串口的监视器。在 Chrome 或 Edge 打开 [Espressif ESP Tool](https://espressif.github.io/esptool-js/)，通过 USB 连接板卡并选择对应串口。
3. 首次安装时，先备份需要保留的数据，再擦除 Flash。把下载的 `.bin` 写到 `0x1000`。擦除会清空原有固件和文件。
4. 安装后重启板卡，断开刷写工具，再回到积木编辑器点 “上传并运行” 写入 `main.py`。

### BBC Micro:bit V1 / V2

安装 MicroPython 后，可以直接在本编辑器点击 “上传并运行”，通过串口写入 `main.py`、重启并查看输出。Micro:bit 的文件系统不支持目录，项目中的 Python 库会与 `main.py` 一起放在根目录。

上传会先暂存完整文件。支持 `os.rename` 的板卡通过重命名替换文件；Micro:bit 则需要复制到目标文件，复制过程中断电可能留下不完整的目标文件，需要重新上传。

以下官方编辑器流程也可以用来安装固件或更新程序：

1. 在积木编辑器里点 `download`，导出 `main.py`。
2. 打开 [Micro:bit 官方 Python Editor](https://python.microbit.org/)，导入 `main.py`，点击 **Send to micro:bit**。也可以在官方编辑器中保存 `.hex`，再把它拖到 `MICROBIT` 盘。
3. 官方编辑器会把基金会版 MicroPython 和程序一起写入板卡。后续也可以用同样的步骤更新程序。

参见 [Micro:bit Python Editor 使用指南](https://microbit.org/get-started/user-guide/python-editor/)。

## 开发与目录

运行 `npm install`、`npm run dev` 启动开发环境；`npm test` 验证积木和代码生成，`npm run build` 构建编辑器。

| 路径 | 职责 |
| --- | --- |
| `src/main.js` | 编辑器入口，加载积木注册和界面 |
| `src/blocks/` | 积木定义和对应的 Python 生成器；`hardware/` 为通用能力，`boards/` 为板级 API，`shared/` 为共享定义 |
| `src/python/` | Python 命名分配、生成错误和事件回调生成 |
| `src/editor/` | 编辑器界面、工具箱、库管理与默认示例 |
| `src/device/` | 串口会话、程序上传和设备文件操作 |
| `src/firmware/` | 固件连接、安装逻辑与下载清单 |
| `src/project/` | 项目格式、校验与本地保存 |
| `src/i18n/`、`src/styles/` | 翻译与样式 |
| `test/`、`examples/` | 自动化验证与可导入的积木示例 |
| `src/firmware/images.json` | 固件版本、官方地址与 SHA-256 下载清单 |
| `tools/prepare-firmware.js` | 开发和构建前下载、缓存并校验固件 |
| `public/firmware/` | 自动下载的固件缓存（不提交 Git）与许可证说明 |

生成的 Python 变量名、函数名保留合法的中文、日文、韩文等 Unicode 拼写。数字开头会补上 `var_`，非法字符替换为 `_`；关键字、保留名或冲突名称添加数字后缀。项目保存的原始名称和 ID 不变。

## 固件下载与更新

`npm run dev` 和 `npm run build` 会自动执行固件准备脚本，从官方来源下载清单中的固件，核对 SHA-256 后写入 `public/firmware/`。缓存校验通过时直接复用；下载失败或校验不符时停止启动/构建。生产构建会将固件复制到 `dist/firmware/`，供网页同源下载，避免跨域限制。GitHub Pages 的构建流程同样适用。

仓库只保留 `src/firmware/images.json` 中的版本、地址和校验值，不再提交 BIN/HEX 文件。升级时更新清单中的版本、地址与 SHA-256，并验证板级 API；Micro:bit 来源固定到基金会编辑器的具体提交，避免上游分支变化导致校验信息失效。

## 面板大小

拖动积木与代码之间的分隔条调整宽度，拖动代码与串口输出之间的分隔条调整高度。尺寸按比例保存在本地，刷新后恢复。分隔条支持方向键、Shift 加速、Home/End 边界和双击恢复默认尺寸；窄屏隐藏左右分隔条。

面板使用 `https://lsong.org/scripts/dom/resizable.js` 的 `bindSplitter`。共享组件处理拖动、键盘、ARIA、比例布局、尺寸保存和窄屏启停；编辑器只配置最小尺寸、媒体查询和存储键。旁边存在 `../scripts` 工作区时，Vite 自动使用并打包本地实现，方便同步修改和验证；独立 checkout 使用线上模块，新接口需要先发布共享库。

## Raspberry Pi Pico 安装

在“设备 → 安装 MicroPython 固件”中选择 Raspberry Pi Pico。按住 BOOTSEL 键连接 USB，再松开；连接时在浏览器中选择 `RP2 Boot`。确认后通过 WebUSB PICOBOOT 写入官方 UF2，逐块读回比对，通过后重启。固件按清单下载并校验 SHA-256，不提交 Git。

当前仅支持原版 Pico，不支持 Pico W 或 Pico 2。首次进入 BOOTSEL 需要按键操作；MicroPython 已运行时也可在 REPL 中调用 `machine.bootloader()`。安装需要支持 WebUSB 的浏览器及 HTTPS 或 localhost；普通局域网 HTTP 地址不能使用 WebUSB。

## Micro:bit 无线与麦克风

“无线收发”使用基金会固件原生 `radio` 模块，支持 V1/V2：开关、组号/信道/功率配置、文本和字节收发、数据包详情、缓冲设置及恢复默认配置。接收会从队列中取走消息，没有消息时返回 `None`；文本接收可能因解码失败抛出异常。Radio 是 Micro:bit 数据包通信，并非 Wi-Fi 或 BLE。

“麦克风（V2）”使用 `microbit.microphone` 和 `SoundEvent`，包含声音强度、当前事件、历史事件查询及阈值设置。`was_event()` 和 `get_events()` 会清除声音事件历史；声音强度是相对读数，不是校准分贝或录音。V1 没有板载麦克风。

固件选择必须同时匹配板型和积木使用的 API。基金会 V2 固件文档描述了 BLE 刷写服务，但没有通用 BLE 通信积木所需的接口。MicroPython 主线 nRF 移植支持使用 SoftDevice 编译 BLE/ubluepy，其官网下载中的 MICROBIT 目标是 V1，不能作为 V2 基金会固件的直接替代。

接口来源：
- https://microbit-micropython.readthedocs.io/en/v2-docs/radio.html
- https://microbit-micropython.readthedocs.io/en/v2-docs/microphone.html
- https://microbit-micropython.readthedocs.io/en/v2-docs/ble.html
- https://github.com/micropython/micropython/blob/v1.29.0/ports/nrf/README.md

## MQTT（ESP32 / Matrix:bit）

“MQTT”分类使用 `umqtt.simple.MQTTClient`，项目提供的 ESP32_GENERIC v1.29.0 固件已经内置该模块，无需添加库文件。使用普通 TCP；默认服务器为 `broker.emqx.io`，端口 1883，默认订阅主题为 `test`。当前原版 Pico 和 Micro:bit 固件不作为 MQTT 支持目标。

导入 [MQTT 发布与订阅示例](examples/mqtt-publish-subscribe.blockly.json)，修改 Wi-Fi 名称和密码，按需修改 MQTT 服务器地址。示例等待 Wi-Fi 获得 IP 后连接服务器，订阅 `test`，打印收到的主题和 UTF-8 消息，每 10 秒发布 GPIO33 的 ADC 原始读数到 `blockly/data` 并发送保活请求。GPIO33 对应经典 Matrix:bit 的 P0；读数为 0–65535，并非电压或经过校准的传感器单位。服务器可向控制主题发布文本以验证接收。Wi-Fi 凭据不正确时，示例会继续等待连接；网络连接失败会在串口输出异常。

创建客户端返回对象，可保存到变量；每台设备的客户端 ID 应唯一。用户名为空表示不认证，密码可以为空。保活间隔单位为秒，范围 0–65535，0 禁用保活；需在间隔到期前主动发送 ping，并持续检查接收消息来处理响应。它不会自动发送心跳、恢复 Wi-Fi 或重连 MQTT。积木中的凭据会保存在项目与生成代码中。

先连接，再执行“当 MQTT 收到消息”注册回调，之后订阅主题，并在主循环中调用“检查收到的消息”。每个客户端仅保留最后注册的一个回调。回调的主题参数是文本，消息参数是原始字节，两者是函数局部参数，需在回调内部引用；如需在外部保留数据，请赋值给另一个变量。二进制消息保持字节类型，文本消息可使用“UTF-8 字节解码为文本”；非法 UTF-8 会报错。发布积木接受文本或字节，文本自动按 UTF-8 编码。

回调同步运行于处理 MQTT 的调用中，订阅等待确认和 QoS 1 发布等待确认时也可能触发。请保持处理代码简短，避免在回调里再次调用 MQTT。检查消息在无数据时返回，但开始接收报文后可能等待剩余数据；连接、订阅和 QoS 1 发布也可能阻塞，因此不适合要求严格实时响应的主循环。使用板卡按钮事件积木时，其自动监听循环会在顶层代码结束后启动；本示例的显式无限循环不会结束，不能直接与这些按钮事件组合。

支持 QoS 0/1，QoS 1 可能重复投递。订阅过滤器支持 `+` 和 `#`，发布主题不允许通配符。保留消息由服务器保存，空的保留消息用于清除它。连接积木使用默认的干净会话，重新连接后应重新订阅。端口与保活间隔的数字常量会在生成时校验，使用变量时需自行保证整数和有效范围。

接口依据：[固件模块清单](https://github.com/micropython/micropython/blob/v1.29.0/ports/esp32/boards/manifest.py)、[该固件对应的 MQTTClient 实现](https://github.com/micropython/micropython-lib/blob/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02/micropython/umqtt.simple/umqtt/simple.py)。
