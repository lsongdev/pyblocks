# MicroPython Blocks

[打开积木编辑器](https://lsong.org/blockly-demo/)

## 首次安装 MicroPython

编辑器的“上传并运行”按钮通过串口把当前代码写成 `main.py`，需要板卡已经运行支持串口 raw REPL 的 MicroPython。首次安装请在主界面右上角选择“设备 → 安装 MicroPython 固件”，连接板卡后在对话框中确认安装。也可以打开独立的 [MicroPython 安装页](https://lsong.org/blockly-demo/firmware.html)。本地开发时可以访问 `/firmware.html`。右上角“设置”可修改语言，选择立即生效并保存在本地。

安装页支持经典 ESP32、8 MB Flash 的 Matrix:bit，以及 BBC Micro:bit V1 / V2。它连接板卡、校验所选固件并在用户确认后刷写。BBC Micro:bit 也可以从安装页下载对应版本的 HEX，拖到 `MICROBIT` 盘。固件来源和许可证见 [固件说明](public/firmware/NOTICE.txt)。

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

运行 `npm install`、`npm run dev` 启动开发环境；`npm test` 验证积木和代码生成，`npm run build` 构建编辑器与固件安装页。

| 路径 | 职责 |
| --- | --- |
| `src/main.js` | 编辑器入口，加载积木注册和界面 |
| `src/blocks/` | 积木定义和对应的 Python 生成器；`hardware/` 为通用能力，`boards/` 为板级 API，`shared/` 为共享定义 |
| `src/python/` | Python 命名分配、生成错误和事件回调生成 |
| `src/editor/` | 编辑器界面、工具箱、库管理与默认示例 |
| `src/device/` | 串口会话、程序上传和设备文件操作 |
| `src/firmware/` | 独立固件安装页逻辑 |
| `src/project/` | 项目格式、校验与本地保存 |
| `src/i18n/`、`src/styles/` | 翻译与样式 |
| `test/`、`examples/` | 自动化验证与可导入的积木示例 |
| `public/firmware/` | 固件文件、校验来源和许可证说明 |

生成的 Python 变量名、函数名保留合法的中文、日文、韩文等 Unicode 拼写。数字开头会补上 `var_`，非法字符替换为 `_`；关键字、保留名或冲突名称添加数字后缀。项目保存的原始名称和 ID 不变。
