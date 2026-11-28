# Firmware installation

Firmware installation is separate from normal Python upload. A compatible running MicroPython REPL does not require identifying the exact retail board model before uploading a program. See the [product and device design](design.md) for the proposed automatic device workflow.

The installer has two steps: **choose and connect**, then **review and install**. Detection and firmware matching are separate; an unsupported configuration is a detection result, not a failed installation.

## 1. Choose a family and model

Open **Install MicroPython firmware** and choose:

| Family | Available selections |
| --- | --- |
| ESP32 | Automatic chip detection; `ESP32_GENERIC` (Classic ESP32 / Matrix:bit, 8 MB), `ESP32_GENERIC-SPIRAM` (XiaoMiao, 4 MB + PSRAM), `ESP32_GENERIC_S3` (ESP32-S3 / Quad PSRAM, 4/8/16/32 MB), `ESP32_GENERIC_S3-SPIRAM_OCT` (ESP32-S3 / Octal PSRAM) |
| M5Stack | Core/Basic (4 or 16 MB), original M5Stick-C (4 MB) |
| Micro:bit | Automatic V1/V2 detection, or an explicit version |
| Raspberry Pi | Original RP2040 Pico |
| STM32 | USB DFU: board-specific local DfuSe file; official download links for F411 Black Pill, VCC-GND F407VE, Pyboard v1.1 and other STM32 boards |

Model choices without integrated images are shown as **Not yet supported** and disabled. The ESP32 automatic option can still identify a supported-by-the-loader chip even when no matching firmware is bundled. Firmware is not yet integrated for ESP32-S2/C3, Core2/CoreS3, Pico W or Pico 2.

Select the exact product when known: an ESP32 chip and flash capacity do not identify an M5Stack product. Original M5Stick-C, Plus and Plus2 do not share the same firmware selection.

### XiaoMiao model

The XiaoMiao handheld uses a classic ESP32-WROVER-B with 4 MB flash and 8 MB PSRAM. Under the **ESP32** family, select **ESP32_GENERIC-SPIRAM (XiaoMiao, 4 MB + PSRAM)**. The installer writes the PSRAM-enabled `ESP32_GENERIC-SPIRAM` image at address `0x1000`; do not use the 8 MB Matrix:bit image or an ESP32-S3 image. The top-level Display setup blocks generate their own ST7735 or OLED helpers, so no extra Python driver upload is required. Display reset wiring may differ between board revisions.

Click **Connect and detect**, then choose the USB device in the browser. Use Chrome/Edge over HTTPS or localhost. Detection does not install firmware. For serial ESP devices it enters the bootloader and loads a RAM stub, so the currently running program is interrupted; closing or returning resets and releases the connection.

### ESP32-S3 memory variants

MicroPython v1.29.0 provides a standard image for boards with no PSRAM or Quad PSRAM, plus a separate **Octal PSRAM** image (for example, N8R8 / N16R8 modules). Automatic chip matching selects the standard image. Select the Octal model explicitly when required by the module specification; detecting flash size cannot determine the PSRAM wiring. Both full images are written at address **0x0**, unlike classic ESP32's **0x1000**. At least 4 MB flash is required. See the [official ESP32-S3 download instructions](https://micropython.org/download/ESP32_GENERIC_S3/).

### M5Stick-C connection

Original M5Stick-C uses an FTDI USB bridge. The installer uses the complete idle/assert DTR/RTS initialization and final DTR release before synchronizing with its ROM loader. It resets and releases the port after a failed detection as well as a successful session. Disconnect other serial tools before trying again. Selecting a different firmware cannot fix a device that has not entered download mode.

## 2. Review the result

The confirmation page shows:

- Detected chip.
- Flash capacity and whether it was actually detected.
- Resolved or selected model.
- Matching firmware/version/filename, if available.
- A short description of the APIs the firmware supplies.

Capacity is automatically read on ESP devices. If it cannot be identified, a manual field appears with the integrated model's available sizes; choose only from the actual hardware specifications. A manual value cannot override a successfully detected capacity.

Micro:bit images are selected by detected board version; there is no capacity choice. Pico's capacity is explicitly described as the selected original model's specification, **not a measurement**. Confirm the physical Pico model yourself.

A chip mismatch explains the detected and required chip and offers automatic matching where applicable. For example, choosing classic ESP32 then detecting ESP32-S3 can switch to automatic matching and select the standard S3 image. Capacity mismatches likewise cannot be overridden to force an incompatible image.

Use **Choose another device** to return to selection. The old session is closed and device ownership released before connecting again. ESP32 links to the official MicroPython downloads; M5Stack and micro:bit link to their own firmware resources.

## Install

**Install firmware** is available only after a supported match. Clicking it is the separate confirmation that starts firmware download, hash verification and flashing. Installation replaces existing programs, files and configuration: export anything you want to keep first.

Progress remains visible during writing/verification. M5 UIFlow2 targets additionally configure direct `main.py` startup after flashing; see the [M5Stack guide](m5stack.md). Pico requires BOOTSEL/WebUSB; micro:bit uses its Foundation firmware and USB flashing adapter.

Selection cancellation, connection/detection errors, unsupported matches and actual installation failures have different messages. After success or failure, the installer releases the connection; a new device selection is required to retry.

## Validation

Automated tests exercise exact model/capacity/image selection, offsets, unsupported chips, manual-capacity boundaries, chip/version mismatch suggestions, detection without installation, the explicit install action, cancellation, errors and connection cleanup. The selection UI was checked in Chrome. The M5Stick-C FTDI detection path was checked on a physical ESP32-PICO-D4 / 4 MB board using the browser loader, including RAM stub startup, flash-capacity reading, reset and port release. Browser detection succeeded once, but repeat attempts still failed intermittently. No flash was erased or written during that check. ESP32-S3 image matching, offsets and hashes are checked in software; S3 physical flashing has not been verified. XiaoMiao firmware selection and generated ST7735/button helpers are covered by automated checks; physical flashing and display behavior have not been verified here. The previous M5Stick-C full installation verification is documented separately.

## STM32 USB DFU (experimental)

There is no single STM32 firmware for every MCU and board. Select the actual board and download its `.dfu` file from the official [STM32 firmware catalog](https://micropython.org/download/?port=stm32). For Black Pill, confirm crystal frequency, revision and external flash variant. Enter the ROM bootloader with BOOT0 high during reset, using the MCU's native USB port. Chrome/Edge with WebUSB is required; Windows may need a WinUSB driver for the bootloader. Some STM32 chips (including common F103 Blue Pill ROM bootloaders) do not support USB DFU and require another programmer. The generic selection does not imply their support.

Connect, choose the local file and explicitly confirm the physical board and firmware variant. The USB identity 0483:df11 is not a model identifier. The installer validates DfuSe structure/CRC, VID/PID, internal flash descriptor and accessible sectors before any erase, erases only intersecting sectors, writes and reads back every byte. Option bytes, external flash targets, mass erase and read-unprotect are not supported. CRC is not an authenticity check: obtain the image from the official site. No bundled STM32 image is supplied yet because pinned SHA-256 values have not been independently verified. On success release BOOT0 and reset manually. Software validation does not establish physical DFU compatibility; back up files and firmware first. See [ST AN3156](https://www.st.com/resource/en/application_note/an3156-how-to-use-usb-dfu-protocol-in-bootloader-on-stm32-mcus-stmicroelectronics.pdf).
