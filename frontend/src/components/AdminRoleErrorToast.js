import { useEffect } from "react";

export default function AdminRoleErrorToast({ show, onClose }) {
  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div style={styles.toast}>
      Cannot assign admin role: user has not completed registration
    </div>
  );
}

const styles = {
  toast: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 180,

    background: "linear-gradient(180deg, #1f5f3a 0%, #174a2d 100%)",
    color: "#f5f7f6",
    padding: "12px 18px",
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
