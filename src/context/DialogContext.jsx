import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const DialogContext = createContext({});

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        message,
        title: options.title || 'Confirm Action',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'primary', // primary, danger, warning
        resolve
      });
    });
  }, []);

  const alert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        message,
        title: options.title || 'Notice',
        confirmText: options.confirmText || 'OK',
        variant: options.variant || 'primary',
        resolve
      });
    });
  }, []);

  const handleConfirm = () => {
    dialog?.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
  };

  const iconMap = {
    primary: <Info size={24} />,
    danger: <AlertTriangle size={24} />,
    warning: <AlertTriangle size={24} />,
    success: <CheckCircle2 size={24} />
  };

  const colorMap = {
    primary: 'var(--primary)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    success: 'var(--success)'
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && (
        <div className="dialog-overlay" onClick={handleCancel}>
          <div className="dialog-container" onClick={e => e.stopPropagation()}>
            <div className="dialog-icon-area" style={{ color: colorMap[dialog.variant] }}>
              {iconMap[dialog.variant]}
            </div>
            <h3 className="dialog-title">{dialog.title}</h3>
            <p className="dialog-message">{dialog.message}</p>
            <div className="dialog-actions">
              {dialog.type === 'confirm' && (
                <button className="dialog-btn dialog-btn--cancel" onClick={handleCancel}>
                  {dialog.cancelText}
                </button>
              )}
              <button 
                className={`dialog-btn dialog-btn--confirm dialog-btn--${dialog.variant}`}
                onClick={handleConfirm}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
