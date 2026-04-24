import React from 'react';
import type { CSSProperties } from 'react';
import { exportConfigAsJson, importConfigFromJson, PersistenceError } from '../../lib/persistence';
import { useConfigStore } from '../../store/config-store';
import { useToastStore } from '../../store/toast-store';

const TOOLBAR: CSSProperties = {
  position: 'sticky',
  top: '1rem',
  justifySelf: 'end',
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
  padding: '0.5rem 0.75rem',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
};

const BTN: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  padding: '0.45rem 0.7rem',
  borderRadius: '8px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const STATUS: CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  padding: '0.25rem 0.5rem',
  borderRadius: '999px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
};

export function PersistenceToolbar() {
  const config = useConfigStore((s) => s.config);
  const lastSavedAt = useConfigStore((s) => s.lastSavedAt);
  const syncToLocalStorage = useConfigStore((s) => s.syncToLocalStorage);
  const loadFromLocalStorage = useConfigStore((s) => s.loadFromLocalStorage);
  const replaceConfig = useConfigStore((s) => s.replaceConfig);
  const pushToast = useToastStore((s) => s.pushToast);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const handleRestore = React.useCallback(() => {
    loadFromLocalStorage();
    pushToast('info', 'Configuration restored from local storage.');
  }, [loadFromLocalStorage, pushToast]);

  const handleExport = React.useCallback(() => {
    exportConfigAsJson(config);
    pushToast('success', 'Configuration snapshot exported.');
  }, [config, pushToast]);

  const handleSaveNow = React.useCallback(() => {
    syncToLocalStorage();
    pushToast('success', 'Configuration saved locally.');
  }, [pushToast, syncToLocalStorage]);

  const handleImportClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImport = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const imported = await importConfigFromJson(file);
      replaceConfig(imported);
      pushToast('success', 'Configuration snapshot imported successfully.');
    } catch (error) {
      if (error instanceof PersistenceError) {
        pushToast('error', error.message, 3600);
      } else {
        pushToast('error', 'Failed to import configuration snapshot.', 3600);
      }
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }, [pushToast, replaceConfig]);

  const savedLabel = lastSavedAt ? `💾 Auto-saved ${new Date(lastSavedAt).toLocaleTimeString()}` : '💾 Auto-save enabled';

  return (
    <div style={TOOLBAR} data-testid="persistence-toolbar">
      <span style={STATUS}>{savedLabel}</span>
      <button type="button" style={BTN} onClick={handleRestore}>📂 Restore Local</button>
      <button type="button" style={BTN} onClick={handleExport}>📤 Export JSON</button>
      <button type="button" style={BTN} onClick={handleImportClick} disabled={isImporting}>
        {isImporting ? '📥 Importing...' : '📥 Import JSON'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      <button type="button" style={BTN} onClick={handleSaveNow}>Save Now</button>
    </div>
  );
}
