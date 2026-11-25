import assert from 'node:assert/strict'
import { initialPreviewState, openHoverPreview, openTouchPreview, confirmTouchPreview, closePreview } from './preview-state.ts'

let state = initialPreviewState()
state = openHoverPreview(state, { section: 'anatomy', aircraftId: 'concept-anatomy', nodeId: 'fuselagem', mediaKind: 'png' })
assert.equal(state.open, true)
assert.equal(state.armedForTouch, false)

state = openTouchPreview(state, { section: 'fleet', aircraftId: 'legacy-450', nodeId: 'wing', mediaKind: 'video' })
assert.equal(state.open, true)
assert.equal(state.armedForTouch, true)
assert.equal(confirmTouchPreview(state, 'wing'), true)
assert.equal(confirmTouchPreview(state, 'gear'), false)

state = closePreview()
assert.equal(state.open, false)
assert.equal(state.nodeId, null)

console.log('preview-state OK')
