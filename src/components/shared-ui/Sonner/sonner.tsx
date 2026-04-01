import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: '13.5px',
          fontWeight: 500,
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(38,59,79,0.10)',
        },
      }}
      style={
        {
          '--normal-bg': '#ffffff',
          '--normal-text': '#263B4F',
          '--normal-border': '#E5E7EB',

          '--success-bg': '#f0fdf9',
          '--success-border': 'rgba(51,174,149,0.30)',
          '--success-text': '#1a6b57',

          '--error-bg': '#fff5f5',
          '--error-border': 'rgba(223,69,58,0.30)',
          '--error-text': '#8b1a14',

          '--warning-bg': '#fffbeb',
          '--warning-border': 'rgba(245,158,11,0.30)',
          '--warning-text': '#78450a',

          '--info-bg': '#eff6ff',
          '--info-border': 'rgba(36,99,235,0.25)',
          '--info-text': '#1e3a8a',

          '--border-radius': '10px',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
