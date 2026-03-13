// Helper function to safely format event dates
export const formatEventDate = (dateStr) => {
  if (!dateStr) return { day: '?', month: '???' };

  const dateOnly = dateStr.split('T')[0];
  const date = new Date(dateOnly + 'T00:00:00');

  if (isNaN(date.getTime())) {
    return { day: '?', month: '???' };
  }

  return {
    day: date.getDate(),
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  };
};

// Helper function to format peso amounts (handles cents)
export function formatPeso(amount) {
  const num = parseFloat(amount);
  if (Number.isNaN(num)) return '₱0';
  return num % 1 === 0
    ? `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
    : `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper function to get milestone message based on payment percentage
export function getMilestoneMessage(percentage) {
  if (percentage === 0) return "Your pledge is set! Make your first payment to get started.";
  if (percentage < 25) return "Great start! Every peso counts.";
  if (percentage < 50) return "You're on your way!";
  if (percentage < 75) return "Halfway there — keep it up!";
  if (percentage < 100) return "Almost there — the finish line is in sight!";
  return "Pledge complete! Thank you for stepping up for our batch.";
}

// Helper function to format birthday without timezone conversion
export const formatBirthday = (dateStr) => {
  if (!dateStr) return '';
  // Extract just the date portion (YYYY-MM-DD) and parse at local midnight
  const dateOnly = dateStr.split('T')[0];
  const date = new Date(dateOnly + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// Calculate days remaining until the reunion (Dec 16, 2028)
export const getDaysUntilReunion = () => {
  const reunionDate = new Date('2028-12-16');  // Reunion date
  const today = new Date();                     // Current date
  const diffTime = reunionDate - today;         // Difference in milliseconds
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));  // Convert ms to days
  return diffDays;  // Positive = days left, 0 = today, negative = past
};
