import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useRazorpay } from "@/hooks/useRazorpay";
import { Loader2, Check, CreditCard, Truck, ClipboardList, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShippingInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

const steps = [
  { id: 1, name: "Shipping", icon: Truck },
  { id: 2, name: "Payment", icon: CreditCard },
  { id: 3, name: "Review", icon: ClipboardList },
];

const Checkout = () => {
  const { user, loading: authLoading } = useAuth();
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openPayment, isLoaded: isRazorpayLoaded } = useRazorpay();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (items.length === 0 && !authLoading) {
      navigate("/cart");
    }
  }, [items, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSavedAddresses();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setShippingInfo(prev => ({
        ...prev,
        name: data.full_name || "",
        phone: data.phone || "",
        email: user.email || "",
      }));
    }
  };

  const fetchSavedAddresses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });

    if (data) {
      setSavedAddresses(data);
      const defaultAddr = data.find(a => a.is_default);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        applyAddress(defaultAddr);
      }
    }
  };

  const applyAddress = (addr: SavedAddress) => {
    setShippingInfo(prev => ({
      ...prev,
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    }));
  };

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    const addr = savedAddresses.find(a => a.id === addressId);
    if (addr) {
      applyAddress(addr);
    }
  };

  const validateShipping = () => {
    const { name, email, phone, address, city, state, pincode } = shippingInfo;
    if (!name || !email || !phone || !address || !city || !state || !pincode) {
      toast({
        title: "Missing Information",
        description: "Please fill in all shipping details",
        variant: "destructive",
      });
      return false;
    }
    if (!/^\d{6}$/.test(pincode)) {
      toast({
        title: "Invalid Pincode",
        description: "Please enter a valid 6-digit pincode",
        variant: "destructive",
      });
      return false;
    }
    if (!/^\d{10}$/.test(phone)) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateShipping()) return;
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handlePlaceOrder = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Create order in database first
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          total_amount: totalPrice,
          shipping_name: shippingInfo.name,
          shipping_email: shippingInfo.email,
          shipping_phone: shippingInfo.phone,
          shipping_address: shippingInfo.address,
          shipping_city: shippingInfo.city,
          shipping_state: shippingInfo.state,
          shipping_pincode: shippingInfo.pincode,
          payment_status: "pending",
          status: "new",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_name: item.product_name,
        grind_type: item.grind_type,
        bag_size: item.bag_size,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Process payment based on method
      if (paymentMethod === "razorpay") {
        // Check if Razorpay is loaded
        if (!isRazorpayLoaded()) {
          toast({
            title: "Payment Gateway Error",
            description: "Payment gateway is not available. Please refresh the page and try again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Open Razorpay payment
        try {
          const response = await openPayment({
            amount: Math.round(totalPrice * 100)/1000, // Convert to paise
            name: "Tiny Tiger Coffee",
            description: `Order #${order.id.slice(0, 8)}`,
            prefill: {
              name: shippingInfo.name,
              email: shippingInfo.email,
              contact: shippingInfo.phone,
            },
            notes: {
              order_id: order.id,
            },
            onSuccess: () => {
              // Will be handled in promise resolution
            },
            onError: (error) => {
              console.error("Payment error:", error);
            },
            onDismiss: () => {
              // Payment was cancelled
            },
          });

          // Payment successful - update order
          await supabase
            .from("orders")
            .update({
              payment_status: "success",
              payment_id: response.razorpay_payment_id,
            })
            .eq("id", order.id);

          // Clear cart and show success
          await clearCart();
          toast({
            title: "Payment Successful!",
            description: `Order #${order.id.slice(0, 8)} has been placed. You will receive a confirmation email shortly.`,
          });
          navigate("/profile");
        } catch (paymentError) {
          // Payment failed or cancelled
          console.error("Payment cancelled or failed:", paymentError);
          
          // Update order status to failed
          await supabase
            .from("orders")
            .update({ payment_status: "failed" })
            .eq("id", order.id);

          toast({
            title: "Payment Cancelled",
            description: "Your payment was cancelled. You can try again from your profile.",
            variant: "destructive",
          });
        }
      } else {
        // Cash on Delivery
        await supabase
          .from("orders")
          .update({ payment_status: "pending" })
          .eq("id", order.id);

        await clearCart();
        toast({
          title: "Order Placed Successfully!",
          description: `Order #${order.id.slice(0, 8)} has been placed. Pay ₹${totalPrice.toFixed(2)} on delivery.`,
        });
        navigate("/profile");
      }
    } catch (error) {
      console.error("Order error:", error);
      toast({
        title: "Order Failed",
        description: "There was an error placing your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl mb-8">Checkout</h1>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      currentStep > step.id
                        ? "bg-primary border-primary text-primary-foreground"
                        : currentStep === step.id
                        ? "border-primary text-primary"
                        : "border-muted text-muted-foreground"
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-sm font-medium",
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-24 h-0.5 mx-4",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-lg p-6">
              {/* Step 1: Shipping */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="font-display text-xl mb-4">Shipping Information</h2>

                  {savedAddresses.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <Label>Saved Addresses</Label>
                      <RadioGroup
                        value={selectedAddressId || ""}
                        onValueChange={handleAddressSelect}
                      >
                        {savedAddresses.map(addr => (
                          <div
                            key={addr.id}
                            className={cn(
                              "flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                              selectedAddressId === addr.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <RadioGroupItem value={addr.id} id={addr.id} />
                            <label htmlFor={addr.id} className="flex-1 cursor-pointer">
                              <div className="font-medium">{addr.label}</div>
                              <div className="text-sm text-muted-foreground">
                                {addr.name}, {addr.phone}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                              </div>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                            Or enter new address
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={shippingInfo.name}
                        onChange={(e) => {
                          setShippingInfo({ ...shippingInfo, name: e.target.value });
                          setSelectedAddressId(null);
                        }}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={shippingInfo.email}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={shippingInfo.phone}
                        onChange={(e) => {
                          setShippingInfo({ ...shippingInfo, phone: e.target.value });
                          setSelectedAddressId(null);
                        }}
                        placeholder="9876543210"
                        maxLength={10}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Street Address *</Label>
                      <Input
                        id="address"
                        value={shippingInfo.address}
                        onChange={(e) => {
                          setShippingInfo({ ...shippingInfo, address: e.target.value });
                          setSelectedAddressId(null);
                        }}
                        placeholder="123 Coffee Street, Apt 4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={shippingInfo.city}
                        onChange={(e) => {
                          setShippingInfo({ ...shippingInfo, city: e.target.value });
                          setSelectedAddressId(null);
                        }}
                        placeholder="Mumbai"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={shippingInfo.state}
                        onChange={(e) => {
                          setShippingInfo({ ...shippingInfo, state: e.target.value });
                          setSelectedAddressId(null);
                        }}
                        placeholder="Maharashtra"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode *</Label>
                      <Input
                        id="pincode"
                        value={shippingInfo.pincode}
                        onChange={(e) => {
                          setShippingInfo({ ...shippingInfo, pincode: e.target.value });
                          setSelectedAddressId(null);
                        }}
                        placeholder="400001"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Payment */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="font-display text-xl mb-4">Payment Method</h2>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                    <div
                      className={cn(
                        "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                        paymentMethod === "razorpay"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <RadioGroupItem value="razorpay" id="razorpay" />
                      <label htmlFor="razorpay" className="flex-1 cursor-pointer">
                        <div className="font-medium">Razorpay</div>
                        <div className="text-sm text-muted-foreground">
                          Pay securely with Credit/Debit Card, UPI, Net Banking
                        </div>
                      </label>
                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div
                      className={cn(
                        "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                        paymentMethod === "cod"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <RadioGroupItem value="cod" id="cod" />
                      <label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="font-medium">Cash on Delivery</div>
                        <div className="text-sm text-muted-foreground">
                          Pay when your order arrives
                        </div>
                      </label>
                      <Wallet className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="font-display text-xl mb-4">Review Your Order</h2>

                  <div className="space-y-4">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h3 className="font-medium mb-2">Shipping To</h3>
                      <p className="text-sm text-muted-foreground">
                        {shippingInfo.name}<br />
                        {shippingInfo.phone}<br />
                        {shippingInfo.address}<br />
                        {shippingInfo.city}, {shippingInfo.state} - {shippingInfo.pincode}
                      </p>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h3 className="font-medium mb-2">Payment Method</h3>
                      <p className="text-sm text-muted-foreground">
                        {paymentMethod === "razorpay" ? "Razorpay (Card/UPI/Net Banking)" : "Cash on Delivery"}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-3">Order Items</h3>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 p-3 border border-border rounded-lg"
                          >
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="w-16 h-16 object-cover rounded"
                            />
                            <div className="flex-1">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.grind_type.replace("_", " ")} • {item.bag_size} • Qty: {item.quantity}
                              </div>
                            </div>
                            <div className="font-medium">
                              Rs. {(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-border">
                {currentStep > 1 ? (
                  <Button variant="outline" onClick={handlePrevStep}>
                    Back
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => navigate("/cart")}>
                    Back to Cart
                  </Button>
                )}
                {currentStep < 3 ? (
                  <Button onClick={handleNextStep}>Continue</Button>
                ) : (
                  <Button onClick={handlePlaceOrder} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Place Order • Rs. ${totalPrice.toFixed(2)}`
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg p-6 sticky top-24">
              <h2 className="font-display text-xl mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.product_name} ({item.bag_size}) × {item.quantity}
                    </span>
                    <span>Rs. {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs. {totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
              </div>
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>Rs. {totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Checkout;

