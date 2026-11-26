// UIFlow2 2.5.3 boot.py reads this native NVS option before deciding to run main.py.
// Keep this vendor setting outside the reusable MicroPython serial transport.
export const uiflowBootSetup = `import esp32
nvs = esp32.NVS('uiflow')
nvs.set_u8('boot_option', 0)
nvs.commit()
print('PyBlocks: UIFlow boot configured')`;
