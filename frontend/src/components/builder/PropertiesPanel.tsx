import { useState } from 'react'

type Tab = 'source' | 'columns' | 'rows' | 'format' | 'cf'

const TABS: { id: Tab; label: string }[] = [
  { id: 'source',   label: 'Source'  },
  { id: 'columns',  label: 'Columns' },
  { id: 'rows',     label: 'Rows'    },
  { id: 'format',   label: 'Format'  },
  { id: 'cf',       label: 'Rules'   },
]

export default function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('source')

  return (
    <aside className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors
              ${activeTab === t.id
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'source'  && <SourceTab />}
        {activeTab === 'columns' && <PlaceholderTab label="Columns editor" />}
        {activeTab === 'rows'    && <PlaceholderTab label="Rows editor" />}
        {activeTab === 'format'  && <PlaceholderTab label="Format settings" />}
        {activeTab === 'cf'      && <PlaceholderTab label="Conditional formatting rules" />}
      </div>
    </aside>
  )
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <p className="text-xs text-gray-600 text-center mt-8">{label}</p>
  )
}

function SourceTab() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 text-center mt-8">Source picker coming next</p>
    </div>
  )
}
