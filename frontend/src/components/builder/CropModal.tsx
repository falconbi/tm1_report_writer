import { useState, useRef } from 'react'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X } from 'lucide-react'

interface CropModalProps {
  imageUrl: string
  imageName: string
  onCrop: (croppedBlob: Blob, croppedFilename: string) => void
  onClose: () => void
}

const ASPECT_PRESETS = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
]

export default function CropModal({ imageUrl, imageName, onCrop, onClose }: CropModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleCrop = async () => {
    if (!imgRef.current || !crop || !crop.width || !crop.height) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height

    const pixelCrop: PixelCrop = {
      x: Math.round(crop.x * scaleX),
      y: Math.round(crop.y * scaleY),
      width: Math.round(crop.width * scaleX),
      height: Math.round(crop.height * scaleY),
      unit: 'px',
    }

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
      imgRef.current,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    canvas.toBlob((blob) => {
      if (blob) {
        const extension = imageName.split('.').pop() || 'png'
        const baseName = imageName.replace(/\.[^/.]+$/, '')
        const croppedFilename = `${baseName}_cropped.${extension}`
        onCrop(blob, croppedFilename)
      }
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-100">Crop Image</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-2 mb-3 flex-wrap">
            {ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setAspect(preset.value)}
                className={`px-3 py-1 text-xs rounded ${
                  aspect === preset.value
                    ? 'bg-blue-400 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={aspect}
            className="max-h-[60vh] flex items-center justify-center"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt={imageName}
              className="max-w-full max-h-[60vh] object-contain"
            />
          </ReactCrop>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            disabled={!crop || !crop.width || !crop.height}
            className="px-4 py-2 text-sm bg-blue-400 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  )
}
