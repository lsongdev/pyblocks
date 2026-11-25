# PyBlocks

[打开积木编辑器](https://blocks.lsong.org/)

## 安装与离线使用（PWA）

在 HTTPS 网站上打开编辑器后，可通过浏览器菜单中的“安装应用”或“添加到主屏幕”安装。首次联网打开并完成缓存后，编辑器、Blockly 图片与音效以及随应用提供的固件均可离线使用。项目仍自动保存在当前浏览器的本地存储中，也可用“保存项目”导出备份。设备连接仍需浏览器支持 Web Serial / WebUSB。

新版本在所有编辑器窗口关闭后启用，不会自动刷新正在编辑或连接板卡的窗口。PWA 仅在生产构建启用；使用 `npm run build` 后运行 `npm run preview`，可在 localhost 测试安装和离线刷新。部署时完整上传 `dist/`，支持站点根目录或 `/pyblocks/` 等子目录。应用图标可通过 `python3 tools/generate-pwa-icons.py` 重新生成。

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

面板使用 `https://lsong.org/scripts/dom/resizable.js` 的 `bindSplitter`。共享组件处理拖动、键盘、ARIA、比例布局、尺寸保存和窄屏启停；编辑器只配置最小尺寸、媒体查询和存储键。旁边存在 `../scripts` 工作区时，Vite 自动使用并打包本地实现，方便同步修改和验证；独立 checkout 由 Vite 获取线上模块并打包，使离线时仍可调整面板，新接口需要先发布共享库。

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

## HTTP（ESP32 / Matrix:bit）

“HTTP”分类直接使用固件内置的 `requests.request()`，无需上传依赖。支持 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS，以及请求头、套接字超时、状态码、响应头、文本、字节和 JSON 读取。

导入 [HTTP GET 示例](examples/http-get.blockly.json)，修改 Wi-Fi 凭据。示例等待联网后请求 `http://example.com/`，打印状态码和响应文本，并通过“使用 HTTP 响应”积木生成 `with ... as 响应:`，在正常结束和异常退出时自动关闭响应。请求积木返回响应对象；需要多次读取时，将它保存到变量，或放入“使用 HTTP 响应”，避免多次执行请求。也可以在读取完成后显式调用“关闭 HTTP 响应”。关闭会释放连接和缓存，请在关闭前读取。

请求头积木放入请求的“请求头”区域，每项设置名称和值，值为不含换行的文本。请求体格式“无”不发送正文；“文本 / 字节”直接传给 `data=`；“JSON”将输入的 Python 值传给 `json=`，由库序列化并默认添加 `Content-Type: application/json`。JSON 模式输入文本会发送 JSON 字符串，不会把文本当作 JSON 对象解析。已有 JSON 文本可使用文本模式并设置 `Content-Type`。字典等 Python 对象可使用现有 Python 调用积木构造。

请求同步执行，不自动重试，网络和解析错误直接抛出；404 等 HTTP 状态码会正常返回响应。超时以秒为单位，默认 10，必须大于 0；它不是包含 DNS 和重定向的整个请求总时限。此固件库的重定向调用不保留原超时设置。响应头按原大小写查找，缺少时返回空文本。文本默认 UTF-8；JSON 读取返回解析后的 Python 值。读取正文会将整个内容缓存到内存，请选择小响应；HEAD 请求只读取状态码和响应头。

此版本 `requests` 支持 HTTPS，但其 TLS 实现使用 `CERT_NONE`，不验证服务器证书，不能将其视为已验证服务器身份的 HTTPS 连接。本项目没有为此添加隐藏的协议或重试封装。当前原版 Pico 和 Micro:bit 不作为 HTTP 支持目标。

实板验证：ESP32_GENERIC v1.29.0 的 Matrix:bit 已通过局域网 HTTP 测试服务验证 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS，包含中文文本和 JSON 请求体、自定义请求头、响应文本/字节/JSON、404 状态码、自动关闭后的连接与缓存释放，以及手动关闭。此项不包含 HTTPS 或超时故障验证。

接口依据：[固件对应的 requests 实现](https://github.com/micropython/micropython-lib/blob/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02/python-ecosys/requests/requests/__init__.py)。

## NTP 时间同步与异步任务（ESP32 / Matrix:bit）

当前 ESP32_GENERIC v1.29.0 固件已内置 `ntptime` 和 `asyncio`。在“计时”分类中配置 NTP 服务器与超时，默认 `pool.ntp.org`、1 秒；“查询 NTP 服务器时间”调用 `ntptime.time()`，每次通过 UDP 123 查询，不修改板卡时钟；“通过 NTP 同步系统时钟”调用 `ntptime.settime()`，将 RTC 设为 UTC。两者均为同步网络调用，错误直接抛出，不自动重试。套接字超时不包含 DNS 查询时间。NTP 不设置时区，也不自动定期校时。

“系统时间（纪元秒）”直接调用 `time.time()`；“系统 UTC 日期时间”调用 `time.gmtime()`，返回（年、月、日、时、分、秒、星期、年内天数）的元组，星期一为 0。ESP32 的纪元是 2000 年，Pico 的纪元是 1970 年，不能将这些读数一律当作 Unix 时间戳。绝对时间需要正确的 RTC；测量时长仍使用 `ticks_ms()` 与 `ticks_diff()`。此处没有将 UTC 加 8 小时写回 RTC。

“异步任务”分类包括运行异步程序、创建任务、异步等待、等待任务、读取任务结果、异步返回和请求取消任务。运行积木生成 `async def` 主函数并调用 `asyncio.run()`；创建任务积木生成独立的 `async def` 函数并调用 `asyncio.create_task()`，返回 Task，可存入变量。任务使用共享程序变量，不捕获外围函数或回调的局部参数。任务体内赋值会按现有事件机制生成相应的 `global` 声明；需要独立数据时使用不同变量。

异步等待毫秒调用 `await asyncio.sleep_ms(int(value))`，秒调用 `await asyncio.sleep(value)`；异步返回结束当前任务或主函数，未指定值时返回 `None`。等待任务会传播结果或异常。取消任务调用 `Task.cancel()`，是取消请求，不是立即强制停止；随后等待可能抛出 `CancelledError`。主函数结束不会自动等待所有任务，请显式等待需要完成的任务。异步等待、创建任务、等待任务和异步返回只能放在异步程序或任务里；同步函数、GPIO/MQTT 等同步回调内部不能使用 `await`，异步函数内也不能嵌套运行另一个事件循环。生成器会报告这些结构错误。

这是单线程协作调度，不是并行线程。任务需要通过 `await` 让出执行权；没有异步等待的无限循环会阻塞所有任务。普通延时、HTTP、MQTT、NTP 调用不会因为放进异步任务而自动变成非阻塞操作。板卡按键积木的独立轮询循环也不会自动与事件循环合并。当前只承诺项目 ESP32 固件支持这两个模块，不将原版 Pico/Micro:bit 视为已支持 NTP 的目标。

[时间同步与双任务示例](examples/ntp-asyncio.blockly.json)先联网、同步 UTC，再并发启动时钟任务和心跳任务，各执行三次后等待结束。修改 Wi-Fi 凭据后即可导入；NTP 网络不可达时会报错。

实板验证：Matrix:bit（ESP32_GENERIC v1.29.0）已验证通过 `pool.ntp.org` 查询时间与同步 RTC，返回正确的 UTC 日期时间；两个任务按异步延时交替执行，等待结果返回 42，取消请求后任务未执行后续语句，程序正常结束。此项不包含网络故障或取消异常捕获的实板验证。

接口依据：[固件对应的 ntptime 实现](https://github.com/micropython/micropython-lib/blob/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02/micropython/net/ntptime/ntptime.py)、[asyncio 文档](https://docs.micropython.org/en/v1.29.0/library/asyncio.html)、[time 文档](https://docs.micropython.org/en/v1.29.0/library/time.html)。

## 异常处理与串口交互

“逻辑”分类的“异常处理”包括尝试执行、多分支捕获、未发生异常时执行、最后执行、抛出、重新抛出及异常信息。直接生成 Python 的 `try/except/else/finally`，不添加隐藏重试。把捕获积木放入捕获区域，具体异常放在前面、通用 `Exception` 放在后面；异常变量在对应捕获体内使用。asyncio 的超时和取消异常可单独选择，需要目标固件支持 asyncio。无捕获分支时必须有 finally；else 必须配合捕获分支；重新抛出仅限同一函数的捕获体内。finally 能在正常退出、异常或函数返回时执行，不能保证断电、硬复位或解释器崩溃时执行。

串口窗口在连接后可输入文本，按 Enter 或点击“发送”。行尾可选 CR（默认）、LF、CRLF 或无行尾；上下方向键浏览最近 50 条发送记录，记录仅保存在当前页面内存，不随项目保存。输出由板卡回显，网页不重复添加本地回显。连接按钮旁的“中断”发送 Ctrl+C，“软重启”发送 Ctrl+D；Ctrl+D 在 REPL 提示符下会软重启并重新运行 main.py，在其他输入状态下的行为由固件决定，运行中应先中断。

上传、文件操作、固件安装、断开及发送期间会禁用输入和控制按钮。传输层按顺序发送，释放写锁后关闭串口；离开监视会话后拒绝新写入。此窗口是按行输入界面，不是完整的终端仿真器，也不自动识别 REPL 与用户程序输入状态。

“文本”分类增加“读取一行输入”，直接调用 `input()`，会阻塞当前程序及 asyncio 调度。[输入与异常处理示例](examples/serial-input-exceptions.blockly.json)反复读取整数，输入错误时捕获 ValueError，最后执行清理提示；点击中断退出循环。浏览器按 UTF-8 发送，但项目 ESP32 v1.29.0 固件的原生行编辑器只接受 ASCII 可打印字符，REPL/input() 会过滤中文字符；这不影响程序输出中文。需要非 ASCII 交互时应另外设计读取原始输入流的组件。

Matrix:bit 实板已验证按行发送、input() 交互、历史与草稿恢复、中断和软重启，以及生成的 ValueError 捕获与 finally 执行。传输字节、行尾、排队、断开和写入失败通过模拟串口测试。接口依据：[REPL 控制](https://docs.micropython.org/en/v1.29.0/reference/repl.html)、[原生行编辑器](https://github.com/micropython/micropython/blob/v1.29.0/shared/readline/readline.c)。

## Wi-Fi 扫描与 AP 热点（ESP32 / Matrix:bit）

“网络”分类按连接路由器（STA）、扫描、热点（AP）和接口地址组织。保留原有 Wi-Fi 连接、联网判断、IPv4 与断开积木。新增接口启停/状态、原生连接状态码、状态常量、RSSI、重连次数、MAC 字节、IPv4 字段读取及静态地址配置。接口启用与联网是两个概念；断开 Wi-Fi 只断开 STA 连接，关闭接口需用接口启停积木。

[扫描示例](examples/wifi-scan.blockly.json)先启用 STA，再调用一次 `scan()` 保存结果，遍历打印 SSID 字节和 RSSI。扫描为同步调用，会阻塞其他 asyncio 任务；每次执行都重新扫描，读多个字段时应复用保存的列表。每条记录为 `(ssid, bssid, channel, rssi, security, hidden)`；SSID/BSSID 是字节，RSSI 单位 dBm，安全类型保留固件编号。SSID 不保证 UTF-8，有需要时可用文本分类的 UTF-8 解码积木，并捕获解码异常。当前 ESP32 驱动将隐藏标记固定为 False，无法据此可靠识别隐藏网络；扫描失败也可能返回空列表。

[AP 示例](examples/wifi-ap.blockly.json)先配置名称、安全类型、密码、信道、客户端上限和隐藏名称，再单独启用 AP；默认 WPA2-PSK，示例密码 `change-me-123` 请按需修改。名称要求 1–32 个 UTF-8 字节，WPA2 密码要求 8–63 个可打印 ASCII 字符；开放模式需明确选择，密码会清空。经典 ESP32 此处支持信道 1–13、客户端上限 1–10，实际信道仍受当地法规与固件限制。常量在生成时校验，变量表达式由调用方确保有效，原生 API 的错误直接抛出。配置 AP 本身不会自动开启热点。

AP 的“有客户端连接？”调用 `isconnected()`，含义为至少有一个客户端，不是热点已启用。客户端列表调用 `status('stations')`；经典 ESP32 返回 `(MAC 字节, IPv4 或 None)`，其他移植可能不同。AP 没有客户端时仍可读取接口 IPv4，原有 STA IPv4 积木则在未联网时返回空文本。静态 IPv4 配置直接调用 `ifconfig((IP, subnet, gateway, DNS))`；需填写符合网络的地址，DNS 在某些实现中由接口共享。

STA 和 AP 可同时启用，但共享无线硬件，STA 连接可能决定 AP 信道。热点不会自动共享互联网、提供 NAT 或网页配网门户。重连次数配置为 -1 时无限重试、0 不重试，此处支持 -1–254，建议在连接前设置；无限重连时错误情况下状态也可能一直为 CONNECTING。RSSI 应在 STA 已连接时读取。连接状态保留原生编号和 ESP-IDF 原因码，不统一转换为假定的通用错误编号。

本组扩展针对项目 ESP32_GENERIC v1.29.0 核对，原版 Pico/Micro:bit 不作为 Wi-Fi 目标。新增 AP 与扫描已通过代码生成和模拟驱动测试，尚未实板验证。接口依据：[WLAN 文档](https://docs.micropython.org/en/v1.29.0/library/network.WLAN.html)、[ESP32 WLAN 实现](https://github.com/micropython/micropython/blob/v1.29.0/ports/esp32/network_wlan.c)。
