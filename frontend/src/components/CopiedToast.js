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
    transform: "translateX(-40%)",
    bottom: 180, // higher, still centered

    background: "linear-gradient(180deg, #1f5f3a 0%, #174a2d 100%)",
    color: "#f5f7f6",
    padding: "8px 12px",
    borderRadius: 10,
    fontSize: "0.85rem",
    fontWeight: 600,
    boxShadow: `
    0 10px 25px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.12)
  `,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    zIndex: 9999,
    width: "fit-content",
    maxWidth: "calc(100vw - 40px)",
    textAlign: "center",
  },
};

