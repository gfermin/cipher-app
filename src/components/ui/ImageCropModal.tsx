'use client'
import { useState, useRef, useCallback } from 'react'
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
  type Crop,
  type PercentCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

const MAX_OUTPUT = 1024

interface Props {
  imageSrc: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

function makeCenteredCrop(pct: number): PercentCrop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: pct }, 1, 100, 100),
    100,
    100,
  )
}

export function ImageCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<PercentCrop>(makeCenteredCrop(90))
  const [zoom, setZoom] = useState(1)

  function onImageLoad() {
    setCrop(makeCenteredCrop(90))
  }

  function handleZoom(newZoom: number) {
    setZoom(newZoom)
    // Shrink crop box as zoom increases so the output shows a tighter area
    const pct = Math.max(90 / newZoom, 20)
    setCrop(makeCenteredCrop(pct))
  }

  const handleConfirm = useCallback(() => {
    const img = imgRef.current
    if (!img || !crop) return

    const pixelCrop = convertToPixelCrop(crop, img.width, img.height)
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height

    const naturalW = pixelCrop.width * scaleX
    const naturalH = pixelCrop.height * scaleY
    const outputSize = Math.min(naturalW, naturalH, MAX_OUTPUT)

    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      naturalW,
      naturalH,
      0,
      0,
      outputSize,
      outputSize,
    )

    canvas.toBlob(
      (blob) => { if (blob) onConfirm(blob) },
      'image/jpeg',
      0.92,
    )
  }, [crop, onConfirm])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card crop-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Crop Photo</div>
        </div>

        <div className="crop-viewport">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            aspect={1}
            circularCrop
            keepSelection
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              onLoad={onImageLoad}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '320px' }}
            />
          </ReactCrop>
        </div>

        <div className="crop-zoom-row">
          <span className="crop-zoom-icon">—</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
            className="crop-zoom-slider"
            aria-label="Zoom"
          />
          <span className="crop-zoom-icon crop-zoom-icon--large">+</span>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="crop-btn-confirm" onClick={handleConfirm}>Apply</button>
        </div>
      </div>
    </div>
  )
}
