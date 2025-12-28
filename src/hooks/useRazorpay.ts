declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, callback: () => void) => void;
}

interface PaymentOptions {
  amount: number; // Amount in paise (INR smallest unit)
  currency?: string;
  name: string;
  description?: string;
  orderId?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  onSuccess: (response: RazorpayResponse) => void;
  onError?: (error: Error) => void;
  onDismiss?: () => void;
}

export const useRazorpay = () => {
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

  const isLoaded = (): boolean => {
    return typeof window !== 'undefined' && typeof window.Razorpay !== 'undefined';
  };

  const openPayment = (options: PaymentOptions): Promise<RazorpayResponse> => {
    return new Promise((resolve, reject) => {
      if (!isLoaded()) {
        const error = new Error('Razorpay SDK not loaded. Please check your internet connection.');
        options.onError?.(error);
        reject(error);
        return;
      }

      if (!razorpayKeyId) {
        const error = new Error('Razorpay Key ID not configured. Please set VITE_RAZORPAY_KEY_ID in your environment.');
        options.onError?.(error);
        reject(error);
        return;
      }

      const razorpayOptions: RazorpayOptions = {
        key: razorpayKeyId,
        amount: options.amount, // Amount in paise
        currency: options.currency || 'INR',
        name: options.name,
        description: options.description,
        image: '/favicon.ico',
        order_id: options.orderId,
        prefill: options.prefill,
        notes: options.notes,
        theme: {
          color: '#8B4513', // Coffee brown color
        },
        handler: (response) => {
          options.onSuccess(response);
          resolve(response);
        },
        modal: {
          ondismiss: () => {
            options.onDismiss?.();
            reject(new Error('Payment cancelled by user'));
          },
          escape: true,
          backdropclose: false,
        },
      };

      try {
        const razorpay = new window.Razorpay(razorpayOptions);
        razorpay.on('payment.failed', () => {
          const error = new Error('Payment failed. Please try again.');
          options.onError?.(error);
          reject(error);
        });
        razorpay.open();
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to open payment gateway');
        options.onError?.(err);
        reject(err);
      }
    });
  };

  return {
    isLoaded,
    openPayment,
    razorpayKeyId,
  };
};

export type { RazorpayResponse, PaymentOptions };

