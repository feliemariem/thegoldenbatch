import { useEffect } from "react";

export default function CopiedToast({ show, onClose }) {
  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      onClose();
    }, 1500);

    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div style={styles.toast}>
      Copied!
    </div>
  );
}

const styles = {
  toast: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 20,
    background: "#2f6b3e",
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 700,
    boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
    zIndex: 9999,
    width: "fit-content",
    maxWidth: "calc(100vw - 40px)"
  },
};
