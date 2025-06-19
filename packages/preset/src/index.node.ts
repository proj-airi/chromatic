import { env } from 'node:process'

import { createPresetChromatic } from './shared'

/**
 * Some tricks for both identifiable for UnoCSS IDE integration for previewing colors
 * and for UnoCSS playground to be able to use this preset.
 */
export const presetChromatic = createPresetChromatic((env.VSCODE_ESM_ENTRYPOINT ?? '').includes('extensionHostProcess'))
export { VAR_HUE } from './shared'
export type { PresetChromaticOptions } from './shared'

export default presetChromatic
