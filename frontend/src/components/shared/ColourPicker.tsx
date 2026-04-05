// Curated palette for financial reports — professional, not garish

export const BACKGROUND_PALETTE = [
  { label: 'None',        value: undefined,   preview: 'bg-white border border-gray-300' },
  { label: 'Light gray',  value: '#f3f4f6',   preview: 'bg-[#f3f4f6]' },
  { label: 'Mid gray',    value: '#e5e7eb',   preview: 'bg-[#e5e7eb]' },
  { label: 'Dark header', value: '#1e293b',   preview: 'bg-[#1e293b]' },
  { label: 'Light blue',  value: '#eff6ff',   preview: 'bg-[#eff6ff]' },
  { label: 'Light green', value: '#f0fdf4',   preview: 'bg-[#f0fdf4]' },
  { label: 'Light amber', value: '#fffbeb',   preview: 'bg-[#fffbeb]' },
  { label: 'Light red',   value: '#fef2f2',   preview: 'bg-[#fef2f2]' },
]

export const TEXT_PALETTE = [
  { label: 'Default',     value: undefined,   preview: 'bg-gray-800' },
  { label: 'White',       value: '#ffffff',   preview: 'bg-white border border-gray-300' },
  { label: 'Light gray',  value: '#9ca3af',   preview: 'bg-[#9ca3af]' },
  { label: 'Dark gray',   value: '#374151',   preview: 'bg-[#374151]' },
  { label: 'Blue',        value: '#1d4ed8',   preview: 'bg-[#1d4ed8]' },
  { label: 'Green',       value: '#15803d',   preview: 'bg-[#15803d]' },
  { label: 'Red',         value: '#dc2626',   preview: 'bg-[#dc2626]' },
  { label: 'Orange',      value: '#ea580c',   preview: 'bg-[#ea580c]' },
]

interface Props {
  label: string
  value: string | undefined
  palette: typeof BACKGROUND_PALETTE
  onChange: (val: string | undefined) => void
}

export default function ColourPicker({ label, value, palette, onChange }: Props) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((c) => (
          <button
            key={c.label}
            title={c.label}
            onClick={() => onChange(c.value)}
            className={`w-5 h-5 rounded ${c.preview} transition-transform
              ${value === c.value ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800 scale-110' : 'hover:scale-110'}`}
          />
        ))}
        {/* Custom hex input */}
        <input
          type="color"
          value={value ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          title="Custom colour"
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
        />
      </div>
    </div>
  )
}
