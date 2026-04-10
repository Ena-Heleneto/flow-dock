export interface OverlayDialog {
  showInputDialog: (title: string, initial?: string) => Promise<string | null>
  showConfirmDialog: (message: string) => Promise<boolean>
}

export function useOverlayDialog(): OverlayDialog {
  function showInputDialog(title: string, initial = ''): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.inset = '0'
      overlay.style.background = 'rgba(0,0,0,0.4)'
      overlay.style.display = 'flex'
      overlay.style.alignItems = 'center'
      overlay.style.justifyContent = 'center'
      overlay.style.zIndex = '9999'

      const box = document.createElement('div')
      box.style.background = 'white'
      box.style.padding = '12px'
      box.style.borderRadius = '8px'
      box.style.minWidth = '320px'

      const label = document.createElement('div')
      label.textContent = title
      label.style.marginBottom = '8px'

      const input = document.createElement('textarea')
      input.value = initial
      input.style.width = '100%'
      input.style.height = '120px'
      input.style.marginBottom = '8px'

      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.justifyContent = 'flex-end'
      actions.style.gap = '8px'

      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancel'
      const okBtn = document.createElement('button')
      okBtn.textContent = 'OK'
      okBtn.style.background = '#0ea5e9'
      okBtn.style.color = 'white'
      okBtn.style.border = 'none'
      okBtn.style.padding = '6px 10px'

      actions.appendChild(cancelBtn)
      actions.appendChild(okBtn)
      box.appendChild(label)
      box.appendChild(input)
      box.appendChild(actions)
      overlay.appendChild(box)
      document.body.appendChild(overlay)

      cancelBtn.onclick = () => {
        document.body.removeChild(overlay)
        resolve(null)
      }

      okBtn.onclick = () => {
        const val = input.value
        document.body.removeChild(overlay)
        resolve(val)
      }
    })
  }

  function showConfirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.inset = '0'
      overlay.style.background = 'rgba(0,0,0,0.4)'
      overlay.style.display = 'flex'
      overlay.style.alignItems = 'center'
      overlay.style.justifyContent = 'center'
      overlay.style.zIndex = '9999'

      const box = document.createElement('div')
      box.style.background = 'white'
      box.style.padding = '12px'
      box.style.borderRadius = '8px'
      box.style.minWidth = '240px'

      const label = document.createElement('div')
      label.textContent = message
      label.style.marginBottom = '8px'

      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.justifyContent = 'flex-end'
      actions.style.gap = '8px'

      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancel'
      const okBtn = document.createElement('button')
      okBtn.textContent = 'OK'
      okBtn.style.background = '#ef4444'
      okBtn.style.color = 'white'
      okBtn.style.border = 'none'
      okBtn.style.padding = '6px 10px'

      actions.appendChild(cancelBtn)
      actions.appendChild(okBtn)
      box.appendChild(label)
      box.appendChild(actions)
      overlay.appendChild(box)
      document.body.appendChild(overlay)

      cancelBtn.onclick = () => {
        document.body.removeChild(overlay)
        resolve(false)
      }

      okBtn.onclick = () => {
        document.body.removeChild(overlay)
        resolve(true)
      }
    })
  }

  return {
    showInputDialog,
    showConfirmDialog,
  }
}
