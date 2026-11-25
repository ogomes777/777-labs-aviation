export type PreviewMediaKind = 'png' | 'video' | 'fallback'

export type PreviewState = {
  open: boolean
  armedForTouch: boolean
  nodeId: string | null
  section: 'anatomy' | 'fleet' | null
  aircraftId: string | null
  mediaKind: PreviewMediaKind | null
}

export const initialPreviewState = (): PreviewState => ({
  open: false,
  armedForTouch: false,
  nodeId: null,
  section: null,
  aircraftId: null,
  mediaKind: null,
})

export function openHoverPreview(state: PreviewState, payload: Omit<PreviewState, 'open' | 'armedForTouch'>): PreviewState {
  return { ...state, ...payload, open: true, armedForTouch: false }
}

export function openTouchPreview(state: PreviewState, payload: Omit<PreviewState, 'open' | 'armedForTouch'>): PreviewState {
  return { ...state, ...payload, open: true, armedForTouch: true }
}

export function confirmTouchPreview(state: PreviewState, nodeId: string): boolean {
  return state.open && state.armedForTouch && state.nodeId === nodeId
}

export function closePreview(): PreviewState {
  return initialPreviewState()
}
