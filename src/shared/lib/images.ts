// Reduce una imagen (máx. 1600px, JPEG 85%) antes de subirla
export async function compressImage(file: File, maxSize = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Recorta la imagen en cuadrado (cover, centrado) y la reduce a 256px para
// la foto de perfil.
export async function resizeAvatar(file: File, size = 256): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const side = Math.min(img.width, img.height)
    const sx = (img.width - side) / 2
    const sy = (img.height - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
