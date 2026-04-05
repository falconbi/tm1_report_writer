import { useReportStore } from '../store/useReportStore'
import AppBar from '../components/builder/AppBar'
import ReportListPanel from '../components/builder/ReportListPanel'
import CanvasPanel from '../components/builder/CanvasPanel'
import PropertiesPanel from '../components/builder/PropertiesPanel'

export default function BuilderPage() {
  const { newReport } = useReportStore()

  const handleNew = () => newReport()

  const handleSelect = (_id: string) => {
    // TODO: fetch definition from backend
  }

  const handleSaveDraft = () => {
    // TODO: POST to /api/reports/definitions
  }

  const handlePublish = () => {
    // TODO: POST to /api/reports/definitions/{id}/publish
  }

  const handleHistoryToggle = () => {
    // TODO: open history panel
  }

  const handlePreview = () => {
    // TODO: open preview modal
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <AppBar
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onHistoryToggle={handleHistoryToggle}
        onPreview={handlePreview}
      />
      <div className="flex flex-1 overflow-hidden">
        <ReportListPanel onSelect={handleSelect} onNew={handleNew} />
        <CanvasPanel />
        <PropertiesPanel />
      </div>
    </div>
  )
}
