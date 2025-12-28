import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Eye, Printer } from "lucide-react";
import { format } from "date-fns";

interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  payment_status: string;
  payment_id: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  grind_type: string;
  bag_size: string;
  quantity: number;
  unit_price: number;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  processing: "bg-yellow-500",
  shipped: "bg-purple-500",
  completed: "bg-green-500",
  canceled: "bg-red-500",
};

const AdminOrders = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminRole();
    }
  }, [user, authLoading, navigate]);

  const checkAdminRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data?.role === "admin") {
      setIsAdmin(true);
      fetchOrders();
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
    } else {
      setOrders(data || []);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    setOrderItems(data || []);
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    await fetchOrderItems(order.id);
    setDialogOpen(true);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Find the current order to check its previous status
    const currentOrder = orders.find(o => o.id === orderId);
    const previousStatus = currentOrder?.status;
    
    // Determine if we need to decrement stock
    // Only decrement when transitioning FROM new/processing TO shipped/completed
    const shouldDecrementStock = 
      (previousStatus === "new" || previousStatus === "processing") &&
      (newStatus === "shipped" || newStatus === "completed");

    // Update the order status
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
      return;
    }

    // Decrement stock if needed
    if (shouldDecrementStock) {
      await decrementStockForOrder(orderId);
    }

    toast({
      title: "Status Updated",
      description: `Order status changed to ${newStatus}${shouldDecrementStock ? ". Inventory updated." : ""}`,
    });
    fetchOrders();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const decrementStockForOrder = async (orderId: string) => {
    // Fetch order items for this order
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError || !items) {
      console.error("Error fetching order items:", itemsError);
      return;
    }

    // For each order item, find the matching variant and decrement stock
    for (const item of items) {
      // First, find the product by name
      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("name", item.product_name)
        .limit(1);

      if (!products || products.length === 0) {
        console.error(`Product not found: ${item.product_name}`);
        continue;
      }

      const productId = products[0].id;

      // Find the matching variant by product_id, grind_type, and size (bag_size)
      const { data: variants } = await supabase
        .from("variants")
        .select("id, stock_count")
        .eq("product_id", productId)
        .eq("grind_type", item.grind_type)
        .eq("size", item.bag_size)
        .limit(1);

      if (!variants || variants.length === 0) {
        console.error(`Variant not found for product: ${item.product_name}, grind: ${item.grind_type}, size: ${item.bag_size}`);
        continue;
      }

      const variant = variants[0];
      const newStockCount = Math.max(0, variant.stock_count - item.quantity);

      // Update the stock count
      const { error: updateError } = await supabase
        .from("variants")
        .update({ stock_count: newStockCount })
        .eq("id", variant.id);

      if (updateError) {
        console.error(`Error updating stock for variant ${variant.id}:`, updateError);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const filteredOrders = statusFilter === "all" 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-card border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/admin" className="font-display text-xl font-bold text-primary">
                Tiny Tiger Admin
              </Link>
              <nav className="hidden md:flex items-center gap-4">
                <Link
                  to="/admin"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/orders"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Orders
                </Link>
                <Link
                  to="/admin/inventory"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Inventory
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  View Store
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl">Orders</h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      #{order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div>{order.shipping_name}</div>
                      <div className="text-sm text-muted-foreground">{order.shipping_email}</div>
                    </TableCell>
                    <TableCell>Rs. {order.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={order.payment_status === "success" ? "default" : "secondary"}
                      >
                        {order.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusColors[order.status]}`} />
                            <span className="capitalize">{order.status}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Order Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Order #{selectedOrder?.id.slice(0, 8)}</span>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-2">Order Details</h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Date:</span>{" "}
                      {format(new Date(selectedOrder.created_at), "PPpp")}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <span className="capitalize">{selectedOrder.status}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Payment:</span>{" "}
                      {selectedOrder.payment_status}
                    </p>
                    {selectedOrder.payment_id && (
                      <p>
                        <span className="text-muted-foreground">Payment ID:</span>{" "}
                        <span className="font-mono">{selectedOrder.payment_id}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-2">Shipping Address</h4>
                  <div className="text-sm">
                    <p className="font-medium">{selectedOrder.shipping_name}</p>
                    <p>{selectedOrder.shipping_phone}</p>
                    <p>{selectedOrder.shipping_email}</p>
                    <p>{selectedOrder.shipping_address}</p>
                    <p>
                      {selectedOrder.shipping_city}, {selectedOrder.shipping_state} - {selectedOrder.shipping_pincode}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-3">Order Items</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.grind_type.replace("_", " ")} / {item.bag_size}
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            Rs. {item.unit_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            Rs. {(item.unit_price * item.quantity).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-muted-foreground">Shipping: Free</p>
                  <p className="text-xl font-bold mt-1">
                    Total: Rs. {selectedOrder.total_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Status Update */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">Update Status:</span>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => handleStatusChange(selectedOrder.id, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[selectedOrder.status]}`} />
                      <span className="capitalize">{selectedOrder.status}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;

