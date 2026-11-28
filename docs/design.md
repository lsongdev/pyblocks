# Product and device design

## Product principles (agreed)

**Simple to start. Open to explore.** A child should be able to drag blocks, connect a board and upload a program without knowing a chipset, board model, runtime or wire protocol.

**Program first, hardware later.** The workspace and Python source exist independently of any physical device. Users may write a program before deciding which board is suitable, and adapt board-specific calls later.

**Discoverability is a feature.** Keep all supported boards and capabilities visible, grouped by native API and hardware capability. The toolbox is also a map of what can be programmed: discovering that an existing LEGO SPIKE hub is supported, or learning what another board can do, is a valuable experience in itself.

**Unify the experience, preserve the differences.** Use native APIs faithfully. Share transport, lifecycle and UI where appropriate; do not invent a lowest-common-denominator hardware API or impose board-specific editing silos.

## Separate concerns

- **Program:** workspace, generated or manually edited Python, project libraries. May depend on board-specific APIs, but is not bound to a board identity.
- **Connected device:** actual physical connection, verified protocol/runtime, observed hardware information and available device operations.
- **Deployment preferences:** last explicitly chosen device and protocol-specific options, such as a SPIKE program slot. These are not a required part of the project format.
- **Firmware installation:** a separate operation that chooses a compatible firmware image based on verified hardware facts and explicit choices where detection cannot resolve an ambiguity.

Compatibility diagnostics may be added later. They should inform rather than restrict editing. Device information may enrich the workspace but must not hide, disable, delete or rewrite other blocks.

## Proposed upload experience (discussion; not implemented)

1. Click **Upload and run**. Reuse the active device when available; otherwise ask the browser for a serial port.
2. Inspect the selected physical port and establish the appropriate protocol using verified USB identity and protocol handshakes. Do not infer the device from Python source or block types.
3. For a confirmed ordinary MicroPython REPL, upload directly without requiring a Matrix:bit, generic ESP32 or other board-model choice. Preserve the current main.py and library deployment semantics.
4. For a verified SPIKE Prime HubOS 3 connection, show a first-use device confirmation dialog. Identify the hub, firmware version, and known capabilities; allow choosing a program slot before any clearing, writing or starting operation. Explain that the selected slot will be overwritten. Only show slot counts, occupancy or connected peripherals if supported by verified protocol information or model documentation.
5. Keep the confirmed connection and its deployment options for subsequent uploads. Make the active device and relevant options visible near the upload controls, with an explicit **Change device** action. Changing the slot is separate from changing the device.
6. If a connection is lost, show the disconnected state. Reuse a permitted port only after revalidating its identity/protocol; never silently choose another physical device based on a matching VID/PID. Remember preferences locally as hints, not as proof of identity or authorization to write. A different hub must be confirmed independently where identity is uncertain.
7. Unsupported or ambiguous devices receive an actionable message or an explicit protocol selection if safe. Do not fall back to sending REPL control characters to a recognized LEGO hub with unsupported firmware.

A SPIKE confirmation should be a review of a detected device, not a general board-selection wizard. Cancellation must not overwrite a program or change the confirmed active target. The exact slot selector and persistence UI are open design decisions.

### Firmware installation is different from uploading Python

A working MicroPython runtime already supplies a deployment protocol. Its exact retail board model need not be known to upload Python. Installing firmware, however, replaces existing programs and files, and requires a compatible image, flash configuration and memory variant. Generic ESP32 and Matrix:bit can share an image where compatibility is established; chip/flash size alone does not prove board identity or PSRAM wiring. Prefer automatic matching where safe, ask only for unresolved material differences, and keep explicit confirmation before destructive installation. Do not automatically install firmware on a port that fails the REPL handshake.

## Current implementation and boundaries

At the time of writing, the toolbox is universal and the project format has no required target. SPIKE upload still uses source-based detection and slot 0; the proposed flow above replaces that in a future implementation. The existing SPIKE driver has an information request that returns RPC and firmware versions and a product-group/device field, but a dedicated non-writing connection/probe and a user confirmation step are not yet implemented. Verify the available slot range and whether slot metadata and stable device identity can actually be obtained before designing those features.

See [SPIKE Prime](spike-prime.md) and [Firmware installation](firmware.md) for current behavior.
