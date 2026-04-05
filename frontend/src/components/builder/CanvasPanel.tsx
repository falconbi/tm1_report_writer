import { useReportStore } from '../../store/useReportStore'

export default function CanvasPanel() {
  const { definition } = useReportStore()
  const hasSource = !!(definition.cube && definition.view)

  return (
    <main className="flex-1 overflow-auto bg-gray-950 p-8">
      {!hasSource ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
          <span className="text-4xl">📊</span>
          <p className="text-sm">Select a cube and view to begin</p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto">
          {/* ReportRenderer will live here */}
          <div className="bg-white rounded shadow-lg p-8 text-gray-900 min-h-96 flex items-center justify-center text-gray-400 text-sm">
            Report preview — renderer coming next
          </div>
        </div>
      )}
    </main>
  )
}
