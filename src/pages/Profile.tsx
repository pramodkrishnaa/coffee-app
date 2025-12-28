import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Package, MapPin, Plus, Trash2, Edit, Star } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  role: string;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  payment_status: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  grind_type: string;
  bag_size: string;
  quantity: number;
  unit_price: number;
}

interface Address {
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

const emptyAddress: Omit<Address, "id"> = {
  label: "Home",
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  is_default: false,
};

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  processing: "bg-yellow-500",
  shipped: "bg-purple-500",
  completed: "bg-green-500",
  canceled: "bg-red-500",
};

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    phone: "",
    address: "",
    role: "customer",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isNewAddress, setIsNewAddress] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchOrders();
      fetchAddresses();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      setProfile({
        full_name: data.full_name || "",
        phone: data.phone || "",
        address: data.address || "",
        role: data.role || "customer",
      });
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setOrders(data);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    if (orderItems[orderId]) return;

    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (data) {
      setOrderItems(prev => ({ ...prev, [orderId]: data }));
    }
  };

  const fetchAddresses = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });

    if (data) {
      setAddresses(data);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        address: profile.address,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully",
      });
    }
    setSaving(false);
  };

  const handleAddAddress = () => {
    setEditingAddress({ id: "", ...emptyAddress });
    setIsNewAddress(true);
    setAddressDialogOpen(true);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress({ ...address });
    setIsNewAddress(false);
    setAddressDialogOpen(true);
  };

  const validateAddress = (addr: Address): string | null => {
    if (!addr.label?.trim()) return "Label is required";
    if (!addr.name?.trim()) return "Full name is required";
    if (!addr.phone?.trim()) return "Phone number is required";
    if (!/^\d{10}$/.test(addr.phone.trim())) return "Please enter a valid 10-digit phone number";
    if (!addr.address?.trim()) return "Street address is required";
    if (!addr.city?.trim()) return "City is required";
    if (!addr.state?.trim()) return "State is required";
    if (!addr.pincode?.trim()) return "Pincode is required";
    if (!/^\d{6}$/.test(addr.pincode.trim())) return "Please enter a valid 6-digit pincode";
    return null;
  };

  const handleSaveAddress = async () => {
    if (!user || !editingAddress) return;

    // Validate address fields
    const validationError = validateAddress(editingAddress);
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setSavingAddress(true);
    
    try {
      if (editingAddress.is_default) {
        // Remove default from other addresses
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      if (isNewAddress) {
        const { error } = await supabase
          .from("user_addresses")
          .insert({
            user_id: user.id,
            label: editingAddress.label.trim(),
            name: editingAddress.name.trim(),
            phone: editingAddress.phone.trim(),
            address: editingAddress.address.trim(),
            city: editingAddress.city.trim(),
            state: editingAddress.state.trim(),
            pincode: editingAddress.pincode.trim(),
            is_default: editingAddress.is_default,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_addresses")
          .update({
            label: editingAddress.label.trim(),
            name: editingAddress.name.trim(),
            phone: editingAddress.phone.trim(),
            address: editingAddress.address.trim(),
            city: editingAddress.city.trim(),
            state: editingAddress.state.trim(),
            pincode: editingAddress.pincode.trim(),
            is_default: editingAddress.is_default,
          })
          .eq("id", editingAddress.id);

        if (error) throw error;
      }

      toast({
        title: "Address saved",
        description: isNewAddress ? "New address added successfully" : "Address updated successfully",
      });
      setAddressDialogOpen(false);
      fetchAddresses();
    } catch (error: any) {
      console.error("Address save error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save address. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const { error } = await supabase
      .from("user_addresses")
      .delete()
      .eq("id", addressId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete address",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Address deleted",
        description: "Address has been removed",
      });
      fetchAddresses();
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!user) return;

    // Remove default from all addresses
    await supabase
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", user.id);

    // Set new default
    await supabase
      .from("user_addresses")
      .update({ is_default: true })
      .eq("id", addressId);

    toast({
      title: "Default address updated",
    });
    fetchAddresses();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || loading) {
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl">My Account</h1>
            {profile.role === "admin" && (
              <Link to="/admin">
                <Button variant="outline">Admin Dashboard</Button>
              </Link>
            )}
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Orders</span>
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Addresses</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <h2 className="font-display text-xl">Profile Information</h2>

                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="text-foreground mt-1">{user?.email}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={profile.full_name || ""}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="font-display text-xl mb-6">Order History</h2>

                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No orders yet</p>
                    <Link to="/">
                      <Button>Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-4">
                    {orders.map((order) => (
                      <AccordionItem
                        key={order.id}
                        value={order.id}
                        className="border border-border rounded-lg overflow-hidden"
                      >
                        <AccordionTrigger
                          className="px-4 py-3 hover:no-underline"
                          onClick={() => fetchOrderItems(order.id)}
                        >
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="text-left">
                              <div className="font-mono text-sm">
                                Order #{order.id.slice(0, 8)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), "MMM dd, yyyy")}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-semibold">
                                Rs. {order.total_amount.toFixed(2)}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${statusColors[order.status]}`} />
                                <span className="text-sm capitalize">{order.status}</span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-3 pt-2">
                            {orderItems[order.id]?.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                              >
                                <div>
                                  <div className="font-medium">{item.product_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.grind_type.replace("_", " ")} • {item.bag_size} • Qty: {item.quantity}
                                  </div>
                                </div>
                                <div className="font-medium">
                                  Rs. {(item.unit_price * item.quantity).toFixed(2)}
                                </div>
                              </div>
                            ))}
                            {!orderItems[order.id] && (
                              <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-border">
                              <span className="text-muted-foreground">Payment Status</span>
                              <Badge
                                variant={order.payment_status === "success" ? "default" : "secondary"}
                              >
                                {order.payment_status}
                              </Badge>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </TabsContent>

            {/* Addresses Tab */}
            <TabsContent value="addresses">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl">Saved Addresses</h2>
                  <Button onClick={handleAddAddress}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Address
                  </Button>
                </div>

                {addresses.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No saved addresses</p>
                    <Button onClick={handleAddAddress}>Add Your First Address</Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-4 border border-border rounded-lg relative"
                      >
                        {addr.is_default && (
                          <Badge className="absolute top-2 right-2 bg-primary">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        <div className="font-medium mb-1">{addr.label}</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{addr.name}</p>
                          <p>{addr.phone}</p>
                          <p>{addr.address}</p>
                          <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAddress(addr)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {!addr.is_default && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetDefault(addr.id)}
                              >
                                Set Default
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteAddress(addr.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isNewAddress ? "Add New Address" : "Edit Address"}
            </DialogTitle>
          </DialogHeader>

          {editingAddress && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={editingAddress.label}
                  onChange={(e) =>
                    setEditingAddress({ ...editingAddress, label: e.target.value })
                  }
                  placeholder="e.g., Home, Office"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addrName">Full Name</Label>
                  <Input
                    id="addrName"
                    value={editingAddress.name}
                    onChange={(e) =>
                      setEditingAddress({ ...editingAddress, name: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addrPhone">Phone</Label>
                  <Input
                    id="addrPhone"
                    value={editingAddress.phone}
                    onChange={(e) =>
                      setEditingAddress({ ...editingAddress, phone: e.target.value })
                    }
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addrAddress">Street Address</Label>
                <Input
                  id="addrAddress"
                  value={editingAddress.address}
                  onChange={(e) =>
                    setEditingAddress({ ...editingAddress, address: e.target.value })
                  }
                  placeholder="123 Coffee Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addrCity">City</Label>
                  <Input
                    id="addrCity"
                    value={editingAddress.city}
                    onChange={(e) =>
                      setEditingAddress({ ...editingAddress, city: e.target.value })
                    }
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addrState">State</Label>
                  <Input
                    id="addrState"
                    value={editingAddress.state}
                    onChange={(e) =>
                      setEditingAddress({ ...editingAddress, state: e.target.value })
                    }
                    placeholder="Maharashtra"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addrPincode">Pincode</Label>
                  <Input
                    id="addrPincode"
                    value={editingAddress.pincode}
                    onChange={(e) =>
                      setEditingAddress({ ...editingAddress, pincode: e.target.value })
                    }
                    placeholder="400001"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={editingAddress.is_default}
                  onChange={(e) =>
                    setEditingAddress({ ...editingAddress, is_default: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <Label htmlFor="isDefault" className="font-normal">
                  Set as default address
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAddress} disabled={savingAddress}>
              {savingAddress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Address"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
